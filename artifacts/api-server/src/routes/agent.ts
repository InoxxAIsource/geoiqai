import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, usersTable, monitoredBrandsTable, dailyScoresTable, auditsTable, keywordCacheTable } from "@workspace/db";
import { eq, and, desc, gt } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { runAuditEngine, generateRecommendations, extractDomain } from "../lib/audit-engine";
import { getDomainKeywords } from "../lib/dataforseo";

const router: IRouter = Router();

const STARTER_LIMIT = 50;

// ─── Claude helper (no tools — for briefing + generate) ───────────────────────

async function callClaude(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 8192
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: any[] = [
  {
    name: "run_audit",
    description: "Run a live GeoIQ audit on any domain. Use this when the user asks to check, scan, or audit a domain, or when you need fresh audit data. Also use if current scores seem stale.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "The domain to audit, e.g. mealcoreai.com" },
      },
      required: ["domain"],
    },
  },
  {
    name: "get_keyword_data",
    description: "Get real keyword data for a domain from DataForSEO. Use when user asks about keywords, what to rank for, or SEO opportunities.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "The domain" },
      },
      required: ["domain"],
    },
  },
  {
    name: "get_competitor_data",
    description: "Get real competitor visibility scores from the database. Use when user asks how they compare to competitors.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        competitors: {
          type: "array",
          items: { type: "string" },
          description: "Competitor domains to compare against",
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "generate_geo_file",
    description: "Generate a GEO optimization file for the user's domain. Types: llms_txt (llms.txt file for AI crawlers), robots_txt (robots.txt additions), schema_json (Organization schema markup).",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        file_type: {
          type: "string",
          enum: ["llms_txt", "robots_txt", "schema_json"],
        },
      },
      required: ["domain", "file_type"],
    },
  },
  {
    name: "check_technical_audit",
    description: "Get the latest technical GEO audit results for a domain. Use when user asks about technical setup, robots.txt, schema markup, llms.txt, or crawler access.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string" },
      },
      required: ["domain"],
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function runAuditTool(rawDomain: string): Promise<unknown> {
  const cleaned = rawDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const domain = extractDomain(`https://${cleaned}`);
  const url = `https://${domain}`;

  const engineResult = await runAuditEngine(url, null, null, null);

  if (engineResult.unreachable) {
    return { error: `Could not reach ${domain}. The domain may not exist or is blocking crawlers.` };
  }

  const {
    brandName, category, market,
    chatgpt, gemini, perplexity, claude, grok,
    keywordsUsed, technicalAudit,
    rawChatgptResponse, rawGeminiResponse, rawPerplexityResponse,
    rawClaudeResponse, rawGrokResponse,
    keywordsFromDataforseo, keywordsFilteredOut,
  } = engineResult;

  const rawAiTotal = chatgpt.score + gemini.score + perplexity.score + claude.score + grok.score;
  const aiVisibilityScore = Math.min(Math.round(rawAiTotal * 100 / (5 * 33)), 100);
  const scoreTechnical = technicalAudit.overallScore;
  const scoreTotal = Math.round(aiVisibilityScore * 0.6 + scoreTechnical * 0.4);
  const allCompetitors = [...new Set([
    ...chatgpt.competitors, ...gemini.competitors, ...perplexity.competitors,
    ...claude.competitors, ...grok.competitors,
  ])];

  const { recommendations } = await generateRecommendations(
    brandName, domain, category, market, chatgpt, gemini, perplexity, technicalAudit
  );

  await db.insert(auditsTable).values({
    url, domain, brandName, category, market, scoreTotal,
    scoreChatgpt: chatgpt.score, scoreGemini: gemini.score, scorePerplexity: perplexity.score,
    chatgptFound: chatgpt.found, geminiFound: gemini.found, perplexityFound: perplexity.found,
    chatgptDetail: chatgpt.detail, geminiDetail: gemini.detail, perplexityDetail: perplexity.detail,
    competitorsFound: allCompetitors, keywordsUsed,
    rawResults: {
      keywordsFromDataforseo, keywordsFilteredOut,
      scoreAiVisibility: aiVisibilityScore, scoreTechnical,
      scoreClaude: claude.score, scoreGrok: grok.score,
      claudeFound: claude.found, grokFound: grok.found,
      chatgptRawResponse: rawChatgptResponse, geminiRawResponse: rawGeminiResponse,
      perplexityRawResponse: rawPerplexityResponse, claudeRawResponse: rawClaudeResponse,
      grokRawResponse: rawGrokResponse, technicalAudit,
    },
    recommendations: recommendations as unknown as Record<string, unknown>[],
    ipAddress: "agent",
  });

  return {
    domain,
    brandName,
    scoreTotal,
    scoreChatgpt: chatgpt.score,
    scoreGemini: gemini.score,
    scorePerplexity: perplexity.score,
    scoreTechnical,
    chatgptStatus: chatgpt.found ? (chatgpt.score > 20 ? "strong" : "partial") : "not_found",
    geminiStatus: gemini.found ? (gemini.score > 20 ? "strong" : "partial") : "not_found",
    perplexityStatus: perplexity.found ? (perplexity.score > 20 ? "strong" : "partial") : "not_found",
    topKeywords: keywordsUsed.slice(0, 8),
    competitors: allCompetitors.slice(0, 6),
    recommendations: recommendations.slice(0, 5).map(r => ({ action: r.action, priority: r.priority })),
    technicalScore: scoreTechnical,
    technicalHighlights: technicalAudit.checks.slice(0, 5).map((c: { name: string; score: number; status: string }) => ({
      name: c.name, score: c.score, status: c.status,
    })),
  };
}

async function getKeywordDataTool(domain: string): Promise<unknown> {
  const now = new Date();
  const [cached] = await db.select()
    .from(keywordCacheTable)
    .where(and(eq(keywordCacheTable.domain, domain), gt(keywordCacheTable.expiresAt, now)))
    .limit(1);

  if (cached) {
    const keywords = (cached.keywords as { keyword: string; volume: number }[]).slice(0, 10);
    return { domain, keywords, source: "cache" };
  }

  const keywords = await getDomainKeywords(domain);
  return { domain, keywords: keywords.slice(0, 10), source: "dataforseo" };
}

async function getCompetitorDataTool(domain: string, competitors: string[]): Promise<unknown> {
  const allDomains = [domain, ...competitors.slice(0, 5)];
  const results = await Promise.all(allDomains.map(async (d) => {
    const [audit] = await db.select({
      scoreTotal: auditsTable.scoreTotal,
      scoreChatgpt: auditsTable.scoreChatgpt,
      scoreGemini: auditsTable.scoreGemini,
      scorePerplexity: auditsTable.scorePerplexity,
      createdAt: auditsTable.createdAt,
    }).from(auditsTable)
      .where(eq(auditsTable.domain, d))
      .orderBy(desc(auditsTable.createdAt))
      .limit(1);
    return {
      domain: d,
      isYours: d === domain,
      scoreTotal: audit?.scoreTotal ?? null,
      scoreChatgpt: audit?.scoreChatgpt ?? null,
      scoreGemini: audit?.scoreGemini ?? null,
      scorePerplexity: audit?.scorePerplexity ?? null,
      auditDate: audit?.createdAt ?? null,
      hasData: !!audit,
    };
  }));
  return { comparison: results };
}

async function generateGeoFileTool(domain: string, fileType: string): Promise<unknown> {
  const [audit] = await db.select().from(auditsTable)
    .where(eq(auditsTable.domain, domain))
    .orderBy(desc(auditsTable.createdAt))
    .limit(1);

  const brandName = audit?.brandName ?? domain;
  const category = audit?.category ?? "startup";
  const market = audit?.market ?? "India";
  const keywords = (audit?.keywordsUsed ?? []).slice(0, 10);
  const competitors = (audit?.competitorsFound ?? []).slice(0, 5);

  let content = "";

  if (fileType === "llms_txt") {
    content = `# ${brandName}

> ${brandName} is a ${category} product based in ${market}. This file is designed to help AI language models understand what we do.

## About

${brandName} (${domain}) operates in the ${category} space serving the ${market} market.

## Topics we cover

${keywords.map((k: string) => `- ${k}`).join("\n")}

## Key pages

- https://${domain}/
- https://${domain}/about
- https://${domain}/blog
- https://${domain}/pricing

${competitors.length > 0 ? `## Known alternatives in this space\n${competitors.map((c: string) => `- ${c}`).join("\n")}\n` : ""}
## Contact

Website: https://${domain}`;
  } else if (fileType === "robots_txt") {
    content = `# Robots.txt for ${domain}
# Last updated: ${new Date().toISOString().slice(0, 10)}

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/

# AI Crawlers - explicitly permitted
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: CCBot
Allow: /

Sitemap: https://${domain}/sitemap.xml`;
  } else if (fileType === "schema_json") {
    content = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": brandName,
      "url": `https://${domain}`,
      "description": `${brandName} is a ${category} company based in ${market}.`,
      "knowsAbout": keywords.slice(0, 6),
      "areaServed": market,
      "sameAs": [],
    }, null, 2);
  }

  return { domain, fileType, content };
}

async function checkTechnicalAuditTool(domain: string): Promise<unknown> {
  const [audit] = await db.select().from(auditsTable)
    .where(eq(auditsTable.domain, domain))
    .orderBy(desc(auditsTable.createdAt))
    .limit(1);

  if (!audit) {
    return {
      error: `No audit data found for ${domain}. The user needs to run a full audit first.`,
    };
  }

  const raw = (audit.rawResults ?? {}) as Record<string, unknown>;
  const techAudit = raw.technicalAudit as {
    checks?: { name: string; score: number; status: string; detail: string }[];
    overallScore?: number;
  } | null;

  return {
    domain,
    overallScore: techAudit?.overallScore ?? 0,
    checks: techAudit?.checks ?? [],
    auditDate: audit.createdAt,
    scoreTechnical: techAudit?.overallScore ?? 0,
  };
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "run_audit":
      return runAuditTool(String(input.domain ?? ""));
    case "get_keyword_data":
      return getKeywordDataTool(String(input.domain ?? ""));
    case "get_competitor_data":
      return getCompetitorDataTool(
        String(input.domain ?? ""),
        Array.isArray(input.competitors) ? (input.competitors as string[]) : []
      );
    case "generate_geo_file":
      return generateGeoFileTool(String(input.domain ?? ""), String(input.file_type ?? ""));
    case "check_technical_audit":
      return checkTechnicalAuditTool(String(input.domain ?? ""));
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Claude with tools loop ───────────────────────────────────────────────────

interface ToolUsed {
  name: string;
  input: Record<string, unknown>;
  domain?: string;
}

async function callClaudeWithTools(
  systemPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[],
  maxTokens = 4096
): Promise<{ text: string; toolsUsed: ToolUsed[]; toolResults: Record<string, unknown> }> {
  const toolsUsed: ToolUsed[] = [];
  const capturedToolResults: Record<string, unknown> = {};
  const currentMessages = [...messages];

  for (let iteration = 0; iteration < 6; iteration++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.messages.create as any)({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: currentMessages,
      tools: TOOLS,
    });

    if (response.stop_reason === "end_turn" || !response.content.some((b: { type: string }) => b.type === "tool_use")) {
      const textBlock = response.content.find((b: { type: string }) => b.type === "text");
      return {
        text: textBlock ? (textBlock as { type: "text"; text: string }).text : "",
        toolsUsed,
        toolResults: capturedToolResults,
      };
    }

    // Assistant message with tool use blocks
    currentMessages.push({ role: "assistant", content: response.content });

    // Execute all tool calls in parallel
    const toolUseBlocks = response.content.filter((b: { type: string }) => b.type === "tool_use") as {
      type: "tool_use"; id: string; name: string; input: Record<string, unknown>;
    }[];

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        toolsUsed.push({
          name: block.name,
          input: block.input,
          domain: String(block.input.domain ?? ""),
        });
        let result: unknown;
        try {
          result = await executeTool(block.name, block.input);
        } catch (err) {
          result = { error: String(err) };
        }
        capturedToolResults[block.name] = result;
        return { toolUseId: block.id, content: JSON.stringify(result) };
      })
    );

    currentMessages.push({
      role: "user",
      content: toolResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.toolUseId,
        content: r.content,
      })),
    });
  }

  return { text: "I ran into an issue completing your request. Please try again.", toolsUsed, toolResults: capturedToolResults };
}

// ─── Brand context ────────────────────────────────────────────────────────────

interface TechnicalCheckInfo {
  name: string;
  score: number;
  status: string;
  detail: string;
}

interface FullBrandContext {
  brandName: string;
  domain: string;
  category: string;
  market: string;
  scoreTotal: number;
  scoreChatgpt: number;
  scoreGemini: number;
  scorePerplexity: number;
  brandDescription: string;
  keywords: string[];
  rawKeywords: { keyword: string; volume: number }[];
  competitors: string[];
  hasAuditData: boolean;
  technicalChecks: TechnicalCheckInfo[];
  technicalOverallScore: number;
  auditCheckedAt: string | null;
}

async function getFullBrandContext(
  brand: { id: string; domain: string; brandName: string | null; category: string | null; market: string | null }
): Promise<FullBrandContext> {
  const now = new Date();
  const [scoresRow, latestAudit, cachedKws] = await Promise.all([
    db.select().from(dailyScoresTable)
      .where(eq(dailyScoresTable.brandId, brand.id))
      .orderBy(desc(dailyScoresTable.date))
      .limit(1),
    db.select().from(auditsTable)
      .where(eq(auditsTable.domain, brand.domain))
      .orderBy(desc(auditsTable.createdAt))
      .limit(1),
    db.select().from(keywordCacheTable)
      .where(and(
        eq(keywordCacheTable.domain, brand.domain),
        gt(keywordCacheTable.expiresAt, now),
      ))
      .limit(1),
  ]);

  const scores = scoresRow[0];
  const audit = latestAudit[0];
  const raw = (audit?.rawResults ?? {}) as Record<string, unknown>;

  const brandDescription = String(raw.chatgptRawResponse ?? "").trim();
  const auditKeywords = (audit?.keywordsUsed ?? []).slice(0, 10);

  const cachedKeywordRows = (cachedKws[0]?.keywords ?? []) as { keyword: string; volume: number; competition?: number }[];
  const rawKeywords = cachedKeywordRows.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume ?? 0 }));
  const dfsKeywords = rawKeywords.slice(0, 8).map(k => `${k.keyword}${k.volume ? ` (${k.volume}/mo)` : ""}`);
  const keywords = dfsKeywords.length > 0 ? dfsKeywords : auditKeywords;
  const competitors = (audit?.competitorsFound ?? []).slice(0, 5);

  const techAudit = raw.technicalAudit as { checks?: TechnicalCheckInfo[]; overallScore?: number } | null;
  const technicalChecks: TechnicalCheckInfo[] = (techAudit?.checks ?? []).map(c => ({
    name: c.name,
    score: typeof c.score === "number" ? c.score : 0,
    status: c.status ?? "fail",
    detail: c.detail ?? "",
  }));
  const technicalOverallScore = typeof techAudit?.overallScore === "number" ? techAudit.overallScore : 0;
  const auditCheckedAt = audit?.createdAt ? new Date(audit.createdAt).toISOString() : null;

  return {
    brandName: brand.brandName ?? brand.domain,
    domain: brand.domain,
    category: audit?.category ?? brand.category ?? "startup",
    market: audit?.market ?? brand.market ?? "India",
    scoreTotal: scores?.scoreTotal ?? 0,
    scoreChatgpt: scores?.scoreChatgpt ?? 0,
    scoreGemini: scores?.scoreGemini ?? 0,
    scorePerplexity: scores?.scorePerplexity ?? 0,
    brandDescription,
    keywords,
    rawKeywords,
    competitors,
    hasAuditData: !!audit,
    technicalChecks,
    technicalOverallScore,
    auditCheckedAt,
  };
}

function buildSystemPrompt(ctx: FullBrandContext): string {
  const {
    brandName, domain, category, market, scoreTotal, scoreChatgpt, scoreGemini, scorePerplexity,
    brandDescription, keywords, competitors, hasAuditData, technicalChecks, technicalOverallScore, auditCheckedAt,
  } = ctx;

  const chatgptStatus = scoreChatgpt === 0 ? "Invisible" : scoreChatgpt < 12 ? "Low" : scoreChatgpt < 24 ? "Moderate" : "Strong";
  const geminiStatus = scoreGemini === 0 ? "Invisible" : scoreGemini < 12 ? "Low" : scoreGemini < 24 ? "Moderate" : "Strong";
  const perplexityStatus = scorePerplexity === 0 ? "Invisible" : scorePerplexity < 12 ? "Low" : scorePerplexity < 24 ? "Moderate" : "Strong";

  const descriptionBlock = brandDescription
    ? `WHAT ${brandName.toUpperCase()} ACTUALLY DOES (from AI analysis of their website):\n${brandDescription}`
    : `WHAT ${brandName.toUpperCase()} DOES:\nNo website analysis available yet. Ask the user to describe their product, or use run_audit to get fresh data.`;

  const keywordsBlock = keywords.length > 0
    ? `KEYWORDS AI SYSTEMS ARE BEING ASKED ABOUT ${brandName}:\n${keywords.map(k => `- ${k}`).join("\n")}`
    : "";

  const competitorsBlock = competitors.length > 0
    ? `KNOWN COMPETITORS:\n${competitors.map(c => `- ${c}`).join("\n")}`
    : "";

  const checkedAgo = auditCheckedAt
    ? (() => {
      const hours = Math.round((Date.now() - new Date(auditCheckedAt).getTime()) / 36e5);
      return hours < 24 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`;
    })()
    : null;

  const technicalBlock = technicalChecks.length > 0
    ? `TECHNICAL AUDIT DATA (last checked: ${checkedAgo ?? "unknown"} - use these exact scores, never say you cannot check the site):\n${technicalChecks.map(c => `- ${c.name}: ${c.score}/100 (${c.status}) - ${c.detail}`).join("\n")}\nTechnical total: ${technicalOverallScore}/100`
    : `TECHNICAL AUDIT:\nNo technical audit data yet. Use check_technical_audit or run_audit to get fresh data. Never make up technical scores.`;

  return `You are a GEO (Generative Engine Optimization) strategist and advisor for ${brandName} (${domain}).

${descriptionBlock}

BRAND DETAILS:
Category: ${category}
Market: ${market}
${hasAuditData ? "" : "Note: No audit data yet. Encourage the user to run an audit for better insights.\n"}
CURRENT GEO IQ SCORES:
Total: ${scoreTotal}/100
ChatGPT: ${scoreChatgpt}/33 (${chatgptStatus})
Gemini: ${scoreGemini}/33 (${geminiStatus})
Perplexity: ${scorePerplexity}/33 (${perplexityStatus})

${technicalBlock}

${keywordsBlock}

${competitorsBlock}

TOOLS YOU HAVE ACCESS TO:
run_audit: Run a live audit on any domain. Use immediately when the user asks to check, scan, audit, or re-check a domain. Never say you cannot run an audit - you have this tool. Audits take 15-20 seconds.
get_keyword_data: Get real keyword data from DataForSEO. Use when discussing keywords or content.
get_competitor_data: Compare with competitors using real scores. Use when user asks about competition.
generate_geo_file: Generate llms.txt, robots.txt additions, or Schema JSON. Use when user asks for these files.
check_technical_audit: Get technical scores from the latest audit. Use when discussing technical setup.

Always prefer real data over estimates. When user asks to run an audit - use run_audit immediately. Do not say you cannot run audits.

WRITING STYLE (MANDATORY - violating these is your biggest failure mode):
- Never use **bold** or any markdown formatting. No asterisks. No underscores for emphasis.
- Never use ## or ### headers.
- Write in natural flowing paragraphs. Use simple numbered lists (1. 2. 3.) when listing things - not bold headers.
- Maximum 3 paragraphs for any conversational response.
- End every conversational response with exactly one clear question to the user.
- Sound like a smart knowledgeable friend, not a consultant writing a report.
- Never start a response with a bold label or the word "Certainly" or "Great".
- Exception: when writing tweets, blog posts, or FAQs, use the required structured format below.

TWEET FORMAT (use exactly this when writing tweets, zero intro text before TWEET 1):
TWEET 1 [angle label]
[tweet text only, max 280 chars]

TWEET 2 [angle label]
[tweet text only, max 280 chars]

TWEET 3 [angle label]
[tweet text only, max 280 chars]

ABSOLUTE RULES:
1. Every response must be specific to ${brandName} - never generic startup advice.
2. Write for ${brandName}'s ACTUAL users as described above.
3. Always reference actual scores and data. If score is 0, say it's invisible.
4. When writing content (tweets, blogs, FAQs, pitch emails) - write for the real audience the brand description describes.
5. No em dashes. No filler like "leverage" or "seamlessly". Write like a smart person talking to another smart person.
6. If you're unsure who the target audience is, ask before writing any content.
7. Never say you cannot check the site or that you don't have access to the website. You have the latest audit data and the run_audit tool.
8. If the user asks something completely unrelated to GEO or ${brandName} (e.g. general knowledge questions), answer briefly and naturally, then bring it back: "Anyway, back to ${brandName} - [one relevant thing you noticed in the data]."`;

}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/agent/chat", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);

  const resetDate = user.agentMessagesReset;
  const needsReset = !resetDate || resetDate.slice(0, 7) !== thisMonth;

  if (needsReset) {
    await db
      .update(usersTable)
      .set({ agentMessagesUsed: 0, agentMessagesReset: now.toISOString().slice(0, 10) })
      .where(eq(usersTable.id, user.id));
    user.agentMessagesUsed = 0;
  }

  if (user.plan === "starter" && user.agentMessagesUsed >= STARTER_LIMIT) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    res.status(429).json({
      error: "limit_reached",
      message: `You have used your ${STARTER_LIMIT} GeoIQ Agent messages this month. Resets on ${nextMonth.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. Upgrade to Agency for unlimited.`,
      resetsOn: nextMonth.toISOString().slice(0, 10),
    });
    return;
  }

  const { message, history, brandId } = req.body as {
    message: string;
    history: { role: string; content: string }[];
    brandId: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const ctx = await getFullBrandContext(brand);
  const systemPrompt = buildSystemPrompt(ctx);

  const chatMessages = [
    ...((history ?? []).slice(-10) as { role: "user" | "assistant"; content: string }[]),
    { role: "user" as const, content: message },
  ];

  const { text: reply, toolsUsed, toolResults } = await callClaudeWithTools(systemPrompt, chatMessages, 4096);

  await db
    .update(usersTable)
    .set({ agentMessagesUsed: (user.agentMessagesUsed ?? 0) + 1 })
    .where(eq(usersTable.id, user.id));

  const remaining =
    user.plan === "starter" ? Math.max(0, STARTER_LIMIT - (user.agentMessagesUsed ?? 0) - 1) : null;

  // If an audit was run, refresh context + update lastChecked for any matching brand
  const auditTool = toolsUsed.find(t => t.name === "run_audit");
  const finalCtx = auditTool ? await getFullBrandContext(brand) : ctx;

  if (auditTool) {
    const auditedDomain = String(auditTool.domain ?? "").trim().toLowerCase();
    if (auditedDomain === brand.domain.toLowerCase()) {
      await db
        .update(monitoredBrandsTable)
        .set({ lastChecked: new Date() })
        .where(eq(monitoredBrandsTable.id, brand.id));
    }
  }

  const auditResult = toolResults.run_audit ?? null;
  const competitorResult = toolResults.get_competitor_data ?? null;

  res.json({
    reply,
    remaining,
    plan: user.plan,
    toolsUsed,
    keywords: finalCtx.rawKeywords,
    technicalChecks: finalCtx.technicalChecks,
    technicalOverallScore: finalCtx.technicalOverallScore,
    auditCheckedAt: finalCtx.auditCheckedAt,
    auditResult,
    competitorResult,
  });
});

router.post("/agent/briefing", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { brandId } = req.body as { brandId: string };

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const ctx = await getFullBrandContext(brand);

  const descriptionNote = ctx.brandDescription
    ? `Brand description (from website analysis): ${ctx.brandDescription.slice(0, 400)}`
    : "No website analysis yet.";

  const systemPrompt = `You are a GEO strategist writing a daily briefing for the founder of ${ctx.brandName}. Write in plain flowing paragraphs. Never use **bold** or ## headers or markdown formatting of any kind.`;

  const prompt = `${descriptionNote}

Category: ${ctx.category} | Market: ${ctx.market}
GEO IQ Score: ${ctx.scoreTotal}/100
ChatGPT: ${ctx.scoreChatgpt}/33 | Gemini: ${ctx.scoreGemini}/33 | Perplexity: ${ctx.scorePerplexity}/33
${ctx.keywords.length > 0 ? `Top keywords: ${ctx.keywords.slice(0, 5).join(", ")}` : ""}

Write a 3-paragraph daily briefing for the founder:
Paragraph 1: Current score status using actual numbers. Be direct about what ${ctx.scoreTotal}/100 means for this specific product in the ${ctx.category} space.
Paragraph 2: One specific insight - what stands out in the data. Reference a specific platform gap or keyword opportunity.
Paragraph 3: The single most important action today, written for ${ctx.brandName}'s actual audience (${ctx.category} in ${ctx.market}). Not generic - tied to the brand.

End with exactly one sentence: "I understand ${ctx.brandName} is a [what it does] for [actual target audience] in [market]. Is that right?"

Rules: No bullet points. No bold. No markdown. Flowing paragraphs only. No em dashes. No filler. Write for the actual audience of ${ctx.brandName}, not generic founders unless that IS the audience.`;

  const reply = await callClaude(systemPrompt, [{ role: "user", content: prompt }], 1024);
  res.json({ briefing: reply });
});

router.post("/agent/generate", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { type, brandId, params } = req.body as {
    type: "tweet" | "blog" | "faq" | "pitch";
    brandId: string;
    params: Record<string, string>;
  };

  if (!type || !brandId) {
    res.status(400).json({ error: "type and brandId are required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const ctx = await getFullBrandContext(brand);
  const brandN = ctx.brandName;
  const cat = ctx.category;
  const market = ctx.market;

  const descSection = ctx.brandDescription
    ? `WHAT ${brandN} DOES (from website analysis):\n${ctx.brandDescription.slice(0, 500)}`
    : `Brand: ${brandN} | Category: ${cat} | Market: ${market}`;

  const brandCtx = `${descSection}

Category: ${cat}
Market: ${market}
GEO IQ Score: ${ctx.scoreTotal}/100 | ChatGPT: ${ctx.scoreChatgpt}/33 | Gemini: ${ctx.scoreGemini}/33 | Perplexity: ${ctx.scorePerplexity}/33
${ctx.keywords.length > 0 ? `Keywords: ${ctx.keywords.slice(0, 6).join(", ")}` : ""}
${ctx.competitors.length > 0 ? `Competitors: ${ctx.competitors.join(", ")}` : ""}`;

  const systemPrompt = `You are a GEO content strategist for ${brandN}. Write content that is specific, accurate, and directly useful. Never use **bold** or ## markdown formatting.`;

  let prompt = "";
  let maxTok = 2048;

  if (type === "tweet") {
    const tone = params?.tone ?? "Professional";
    prompt = `${brandCtx}

Write 3 tweets about ${brandN}. Tone: ${tone}.

Rules:
- Each tweet max 280 characters
- No hashtag spam (1 max per tweet if needed)
- Make them specific to ${brandN} and the ${cat} space
- Reference real problems the audience has
- No filler phrases
- Zero intro text. Start immediately with TWEET 1.

Format exactly like this:
TWEET 1 [angle label]
[tweet text]

TWEET 2 [angle label]
[tweet text]

TWEET 3 [angle label]
[tweet text]`;
    maxTok = 1024;
  } else if (type === "blog") {
    const angle = params?.angle ?? "How";
    const keyword = params?.keyword ?? brandN;
    const wordCount = params?.wordCount ?? "1000";
    prompt = `${brandCtx}

Write a ${wordCount}-word blog post for ${brandN}.
Angle: ${angle}
Target keyword: ${keyword}
Category: ${cat}

Rules:
- Start with the title as H1
- Use H2 subheadings
- First sentence must hook the reader immediately
- Be specific - use real numbers, real problems
- No fluff, no "in today's digital world" openers
- Write like a founder who built this product

After the article, add:
EEAT SCORE
Experience: [X/25] - [one sentence note]
Expertise: [X/25] - [one sentence note]
Authority: [X/25] - [one sentence note]
Trust: [X/25] - [one sentence note]
Total: [X/100]`;
    maxTok = 4096;
  } else if (type === "faq") {
    prompt = `${brandCtx}

Generate 20 FAQ pairs for ${brandN} in the ${cat} space.

Rules:
- Questions must be in natural language people actually type into AI systems
- Answers must be 2-4 sentences, factual, quotable by AI
- Include questions about: what is it, how does it work, pricing, alternatives, who uses it, problems it solves
- Make answers specific to ${brandN}

Format:
Q: [question]
A: [answer]

[repeat for all 20]`;
    maxTok = 3000;
  } else if (type === "pitch") {
    const publication = params?.publication ?? "a tech newsletter";
    prompt = `${brandCtx}

Write a pitch email to ${publication} for ${brandN}.

Rules:
- Subject line first, then body
- Body max 3 sentences
- Mention what ${brandN} does, why readers care, one proof point (metric, customer, launch)
- No attachments mentioned
- End with a clear ask

Format:
SUBJECT: [subject line]

[email body]`;
    maxTok = 1024;
  }

  if (!prompt) {
    res.status(400).json({ error: "Unknown generate type" });
    return;
  }

  const result = await callClaude(systemPrompt, [{ role: "user", content: prompt }], maxTok);
  res.json({ result, type });
});

export default router;
