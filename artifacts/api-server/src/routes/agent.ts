import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, usersTable, monitoredBrandsTable, dailyScoresTable, auditsTable, keywordCacheTable, sprintSessionsTable, sprintProgressTable, answerMonitoringPromptsTable, answerMonitoringResultsTable } from "@workspace/db";
import { eq, and, desc, gt, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { runAuditEngine, generateRecommendations, extractDomain } from "../lib/audit-engine";
import { SPRINT_STEPS } from "./sprint";
import { getDomainKeywords } from "../lib/dataforseo";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const STARTER_LIMIT = 100;

// ─── Claude helper (no tools — for briefing + generate) ───────────────────────

async function callClaude(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 8192
): Promise<string> {
  logger.info({ model: "claude-sonnet-4-6", max_tokens: maxTokens, estimated_cost: +(maxTokens * 0.000015).toFixed(4), endpoint: "GEO Copilot / callClaude (briefing or generate)", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
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
  {
    name: "get_sprint_status",
    description: "Get the user's current GEO Sprint progress. Use when the user asks about their progress, what to do next, or how to improve their AI visibility score.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "The brand domain" },
      },
      required: ["domain"],
    },
  },
  {
    name: "complete_sprint_step",
    description: "Mark a GEO Sprint step as complete when the user confirms they have done it. Updates their progress and score.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        step_id: { type: "string", description: "The step id to mark complete, e.g. llmstxt, org_schema, reddit" },
      },
      required: ["domain", "step_id"],
    },
  },
  {
    name: "get_next_sprint_step",
    description: "Get the single most impactful next incomplete step for this user. Use when the user asks what to do today or what their next action should be.",
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

  const rawAiTotal = chatgpt.score + gemini.score + perplexity.score;
  const aiVisibilityScore = Math.min(Math.round(rawAiTotal * 100 / (3 * 33)), 100);
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

// ─── Sprint tool implementations ──────────────────────────────────────────────

async function getSprintStatusTool(domain: string, userId: string): Promise<unknown> {
  const [session] = await db
    .select()
    .from(sprintSessionsTable)
    .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, domain)))
    .limit(1);

  if (!session) {
    return { message: `No sprint found for ${domain}. The user should visit the GEO Sprint page to start.`, domain, started: false };
  }

  const completedRows = await db
    .select({ stepId: sprintProgressTable.stepId, completedAt: sprintProgressTable.completedAt })
    .from(sprintProgressTable)
    .where(and(eq(sprintProgressTable.userId, userId), eq(sprintProgressTable.domain, domain), eq(sprintProgressTable.completed, true)));

  const completedIds = new Set(completedRows.map((r) => r.stepId));
  const completedSteps = SPRINT_STEPS.filter((s) => completedIds.has(s.id));
  const completedPts = completedSteps.reduce((sum, s) => sum + s.score_impact, 0);
  const projectedScore = Math.min((session.currentScore ?? 0) + completedPts, 99);

  const incompleteSteps = SPRINT_STEPS.filter((s) => !completedIds.has(s.id));
  const nextStep = incompleteSteps.sort((a, b) => b.score_impact - a.score_impact)[0];

  return {
    domain,
    current_score: session.currentScore,
    projected_score: projectedScore,
    target_score: 30,
    completed_count: completedIds.size,
    total_steps: SPRINT_STEPS.length,
    completed_steps: completedSteps.map((s) => ({ id: s.id, title: s.title, phase: s.phase })),
    next_recommended_step: nextStep ? {
      id: nextStep.id,
      title: nextStep.title,
      phase: nextStep.phase,
      score_impact: nextStep.score_impact,
      time: nextStep.time,
      why: nextStep.why,
      research: nextStep.research,
      affects: nextStep.affects,
    } : null,
  };
}

async function completeSprintStepTool(domain: string, stepId: string, userId: string): Promise<unknown> {
  const step = SPRINT_STEPS.find((s) => s.id === stepId);
  if (!step) return { error: `Step "${stepId}" not found. Valid ids: ${SPRINT_STEPS.map((s) => s.id).join(", ")}` };

  const [session] = await db
    .select({ currentScore: sprintSessionsTable.currentScore })
    .from(sprintSessionsTable)
    .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, domain)))
    .limit(1);

  const scoreBefore = session?.currentScore ?? 0;
  const scoreAfter = scoreBefore + step.score_impact;

  await db
    .insert(sprintProgressTable)
    .values({ userId, domain, stepId: step.id, phase: step.phase, completed: true, completedAt: new Date(), scoreBefore, scoreAfter })
    .onConflictDoUpdate({
      target: [sprintProgressTable.userId, sprintProgressTable.domain, sprintProgressTable.stepId],
      set: { completed: true, completedAt: new Date(), scoreBefore, scoreAfter },
    });

  const completedRows = await db
    .select({ stepId: sprintProgressTable.stepId })
    .from(sprintProgressTable)
    .where(and(eq(sprintProgressTable.userId, userId), eq(sprintProgressTable.domain, domain), eq(sprintProgressTable.completed, true)));

  const completedIds = new Set(completedRows.map((r) => r.stepId));
  const totalPts = SPRINT_STEPS.filter((s) => completedIds.has(s.id)).reduce((sum, s) => sum + s.score_impact, 0);
  const newProjected = Math.min(scoreBefore + totalPts, 99);

  return {
    success: true,
    step_completed: step.title,
    score_impact: step.score_impact,
    new_projected_score: newProjected,
    total_completed: completedIds.size,
    total_steps: SPRINT_STEPS.length,
  };
}

async function getNextSprintStepTool(domain: string, userId: string): Promise<unknown> {
  const completedRows = await db
    .select({ stepId: sprintProgressTable.stepId })
    .from(sprintProgressTable)
    .where(and(eq(sprintProgressTable.userId, userId), eq(sprintProgressTable.domain, domain), eq(sprintProgressTable.completed, true)));

  const completedIds = new Set(completedRows.map((r) => r.stepId));

  // Find lowest phase that has incomplete steps
  const incompleteByPhase: Record<number, typeof SPRINT_STEPS> = {};
  for (const step of SPRINT_STEPS) {
    if (!completedIds.has(step.id)) {
      if (!incompleteByPhase[step.phase]) incompleteByPhase[step.phase] = [];
      incompleteByPhase[step.phase]!.push(step);
    }
  }

  const lowestPhase = Math.min(...Object.keys(incompleteByPhase).map(Number));
  const candidates = incompleteByPhase[lowestPhase] ?? [];
  // Sort by score_impact desc, then time asc (quick wins first)
  const next = candidates.sort((a, b) => b.score_impact - a.score_impact)[0];

  if (!next) {
    return { message: "All sprint steps complete. The user has finished the GEO Sprint.", completed_all: true };
  }

  const [session] = await db
    .select({ currentScore: sprintSessionsTable.currentScore })
    .from(sprintSessionsTable)
    .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, domain)))
    .limit(1);

  return {
    domain,
    next_step: {
      id: next.id,
      title: next.title,
      phase: next.phase,
      phase_name: next.phase_name,
      score_impact: next.score_impact,
      time: next.time,
      why: next.why,
      research: next.research,
      affects: next.affects,
      action_type: next.action_type,
      action_label: next.action_label,
    },
    current_score: session?.currentScore ?? 0,
    completed_count: completedIds.size,
    total_steps: SPRINT_STEPS.length,
  };
}

async function executeTool(name: string, input: Record<string, unknown>, userId?: string): Promise<unknown> {
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
    case "get_sprint_status":
      return getSprintStatusTool(String(input.domain ?? ""), userId ?? "");
    case "complete_sprint_step":
      return completeSprintStepTool(String(input.domain ?? ""), String(input.step_id ?? ""), userId ?? "");
    case "get_next_sprint_step":
      return getNextSprintStepTool(String(input.domain ?? ""), userId ?? "");
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
  maxTokens = 4096,
  userId?: string
): Promise<{ text: string; toolsUsed: ToolUsed[]; toolResults: Record<string, unknown> }> {
  const toolsUsed: ToolUsed[] = [];
  const capturedToolResults: Record<string, unknown> = {};
  const currentMessages = [...messages];

  for (let iteration = 0; iteration < 6; iteration++) {
    logger.info({ model: "claude-sonnet-4-6", max_tokens: maxTokens, iteration, estimated_cost: +(maxTokens * 0.000015).toFixed(4), endpoint: "GEO Copilot / callClaudeWithTools (chat loop - up to 6 iters)", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
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
          result = await executeTool(block.name, block.input, userId);
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

interface SprintContextInfo {
  completedCount: number;
  totalSteps: number;
  completedIds: string[];
  nextStep: typeof SPRINT_STEPS[0] | null;
  currentScore: number;
  topPendingSteps: typeof SPRINT_STEPS;
}

interface MonitoringContextInfo {
  tracked: number;
  mentioned: number;
  sov: number;
  negativePrompts: Array<{ prompt: string; context: string | null }>;
  bestPosition: { prompt: string; position: number } | null;
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
  sprint: SprintContextInfo | null;
  monitoring: MonitoringContextInfo | null;
}

async function getFullBrandContext(
  brand: { id: string; domain: string; brandName: string | null; category: string | null; market: string | null; userId?: string }
): Promise<FullBrandContext> {
  const now = new Date();
  const userId = brand.userId ?? "";

  const [scoresRow, latestAudit, cachedKws, sprintSession, sprintProgress] = await Promise.all([
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
    userId ? db.select().from(sprintSessionsTable)
      .where(and(eq(sprintSessionsTable.userId, userId), eq(sprintSessionsTable.domain, brand.domain)))
      .limit(1) : Promise.resolve([]),
    userId ? db.select({ stepId: sprintProgressTable.stepId })
      .from(sprintProgressTable)
      .where(and(eq(sprintProgressTable.userId, userId), eq(sprintProgressTable.domain, brand.domain), eq(sprintProgressTable.completed, true))) : Promise.resolve([]),
  ]);

  const monPrompts = userId
    ? await db.select().from(answerMonitoringPromptsTable)
        .where(and(eq(answerMonitoringPromptsTable.userId, userId), eq(answerMonitoringPromptsTable.domain, brand.domain), eq(answerMonitoringPromptsTable.active, true)))
        .limit(30)
    : [];

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

  // Sprint context
  let sprint: SprintContextInfo | null = null;
  if (sprintSession.length > 0) {
    const completedIds = new Set(sprintProgress.map(r => r.stepId));
    const incompleteSteps = SPRINT_STEPS.filter(s => !completedIds.has(s.id));
    const lowestPhase = incompleteSteps.length > 0 ? Math.min(...incompleteSteps.map(s => s.phase)) : 999;
    const phaseCandidates = incompleteSteps.filter(s => s.phase === lowestPhase);
    const nextStep = phaseCandidates.sort((a, b) => b.score_impact - a.score_impact)[0] ?? null;
    const topPendingSteps = incompleteSteps.sort((a, b) => b.score_impact - a.score_impact).slice(0, 3);

    sprint = {
      completedCount: completedIds.size,
      totalSteps: SPRINT_STEPS.length,
      completedIds: [...completedIds],
      nextStep,
      currentScore: sprintSession[0]?.currentScore ?? 0,
      topPendingSteps,
    };
  }

  // Answer monitoring context
  let monitoring: MonitoringContextInfo | null = null;
  if (monPrompts.length > 0) {
    const promptIds = monPrompts.map(p => p.id);
    const monResults = await db.select()
      .from(answerMonitoringResultsTable)
      .where(inArray(answerMonitoringResultsTable.promptId, promptIds))
      .orderBy(desc(answerMonitoringResultsTable.checkedAt));

    const latestByPromptLlm = new Map<string, typeof monResults[0]>();
    for (const r of monResults) {
      const key = `${r.promptId}:${r.llm}`;
      if (!latestByPromptLlm.has(key)) latestByPromptLlm.set(key, r);
    }

    const latestResults = [...latestByPromptLlm.values()];
    const mentionedCount = latestResults.filter(r => r.mentioned).length;
    const sov = latestResults.length > 0 ? Math.round((mentionedCount / latestResults.length) * 100) : 0;

    const negativeResults = latestResults.filter(r => r.sentiment === "negative" && r.brandContext);
    const negativePrompts = negativeResults.slice(0, 3).map(r => {
      const promptRow = monPrompts.find(p => p.id === r.promptId);
      return { prompt: promptRow?.prompt ?? "", context: r.brandContext };
    });

    const mentionedWithPosition = latestResults.filter(r => r.mentioned && r.position != null);
    const bestPos = mentionedWithPosition.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))[0];
    const bestPromptRow = bestPos ? monPrompts.find(p => p.id === bestPos.promptId) : null;
    const bestPosition = bestPos && bestPromptRow ? { prompt: bestPromptRow.prompt, position: bestPos.position! } : null;

    monitoring = {
      tracked: monPrompts.length,
      mentioned: mentionedCount,
      sov,
      negativePrompts,
      bestPosition,
    };
  }

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
    sprint,
    monitoring,
  };
}

function buildSystemPrompt(ctx: FullBrandContext): string {
  const {
    brandName, domain, category, market, scoreTotal, scoreChatgpt, scoreGemini, scorePerplexity,
    brandDescription, keywords, competitors, hasAuditData, technicalChecks, technicalOverallScore, auditCheckedAt,
    sprint, monitoring,
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

  const sprintBlock = sprint
    ? `GEO SPRINT PROGRESS (live data - use this, do not call get_sprint_status unless user asks for a refresh):
Completed: ${sprint.completedCount}/${sprint.totalSteps} steps
Current sprint score: ${sprint.currentScore}
Next recommended step: ${sprint.nextStep ? `${sprint.nextStep.title} (+${sprint.nextStep.score_impact} pts, ${sprint.nextStep.time}) - affects ${sprint.nextStep.affects.join(", ")}` : "All steps complete"}
Top 3 pending steps by impact:
${sprint.topPendingSteps.map(s => `- ${s.title} (+${s.score_impact} pts, ${s.time})`).join("\n")}
Score prediction: completing top 3 steps would add +${sprint.topPendingSteps.reduce((sum, s) => sum + s.score_impact, 0)} pts`
    : "";

  const monitoringBlock = monitoring
    ? `ANSWER MONITORING DATA (live - share proactively when relevant):
Tracked prompts: ${monitoring.tracked}
Share of Voice: ${monitoring.sov}% (mentioned in ${monitoring.mentioned} of tracked results)
${monitoring.bestPosition ? `Best position: #${monitoring.bestPosition.position} for "${monitoring.bestPosition.prompt}"` : ""}
${monitoring.negativePrompts.length > 0 ? `NEGATIVE SENTIMENT ALERT - ${monitoring.negativePrompts.length} prompt(s) show negative brand context:
${monitoring.negativePrompts.map(n => `- Prompt: "${n.prompt}" | AI said: "${(n.context ?? "").slice(0, 120)}"`).join("\n")}
Proactively flag these if the user asks about reputation or sentiment.` : "No negative sentiment detected."}`
    : "";

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

${sprintBlock}

${monitoringBlock}

TOOLS YOU HAVE ACCESS TO:
run_audit: Run a live audit on any domain. Use immediately when the user asks to check, scan, audit, or re-check a domain. Never say you cannot run an audit - you have this tool. Audits take 15-20 seconds.
get_keyword_data: Get real keyword data from DataForSEO. Use when discussing keywords or content.
get_competitor_data: Compare with competitors using real scores. Use when user asks about competition.
generate_geo_file: Generate llms.txt, robots.txt additions, or Schema JSON. Use when user asks for these files.
check_technical_audit: Get technical scores from the latest audit. Use when discussing technical setup.
get_sprint_status: Get the user's GEO Sprint progress - completed steps, current score, next recommended step. Use when user asks about progress or what to do.
get_next_sprint_step: Get the single highest-impact next step for this user based on their progress. Use when user asks what to do today or what their next action is.
complete_sprint_step: Mark a GEO Sprint step as done when the user confirms they have completed it. Use when user says "I did X" or "I just added X".

GEO SPRINT BEHAVIOR:
You have access to the user's GEO Sprint - a 30-day plan to reach 30% AI visibility across 18 research-backed steps.
When user asks what to do: call get_next_sprint_step, tell them their current score, recommend the single highest-impact next step, explain WHY it helps (cite the research), and offer to generate the content or navigate to the right feature.
When user says they completed something (e.g. "I just posted on Reddit", "I added the llms.txt"): call complete_sprint_step with the matching step_id, then acknowledge with their new projected score.
Celebrate completions - tell them the exact score impact and what to do next.
Example response after completing a step: "Reddit done - that is +15 pts. You are at an estimated 31%. You have hit the 30% target. Next phase: PR outreach. One article in TechCrunch or Search Engine Land will push you to 50%. Want me to find journalists covering your space?"

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

AUDIT RESPONSE FORMAT (use exactly this structure after every audit - whether from run_audit tool or /audit command - zero intro text before the scores):
CORE-EEAT Score: [0-100]
- Content (C): X/100
- Originality (O): X/100
- Relevance (R): X/100
- Expertise (E): X/100

CITE Score: [0-100]
- Citations (C): X/100
- Indexability (I): X/100
- Trustworthiness (T): X/100
- Entity (E): X/100

Top 3 priority fixes:
[C01/I01/T01/E01] Fix description - X hours - +X score
[C01/I01/T01/E01] Fix description - X hours - +X score
[C01/I01/T01/E01] Fix description - X hours - +X score

Status: DONE / NEEDS_INPUT / BLOCKED

Then write 1-2 paragraphs of plain-language analysis. End with one clear question.

Score guidelines for the CORE-EEAT breakdown:
- Content (C): based on homepage content depth, clear value prop, keyword coverage
- Originality (O): based on unique data, founder story, first-person insights, case studies
- Relevance (R): based on how well content matches the queries AI systems are asked about the brand
- Expertise (E): based on schema markup, author bios, publication dates, cited sources
Use technicalAudit data and AI scores to populate these. Estimate if exact data is missing.

Score guidelines for CITE breakdown:
- Citations (C): based on Crunchbase, Product Hunt, G2, press mentions, directory listings found
- Indexability (I): based on robots.txt crawler access, llms.txt, sitemap, crawl errors
- Trustworthiness (T): based on schema markup score, HTTPS, author bios, privacy/terms pages
- Entity (E): based on entity consistency check score, social profile completeness, Wikidata

Status rules:
- DONE: overall GEO IQ score >= 70
- NEEDS_INPUT: missing brand data or audit data needed to give accurate scores
- BLOCKED: crawl errors, blocked robots.txt, or domain unreachable

SLASH COMMAND HANDLING (when user sends a slash command, treat it as the full request below):
/visibility - run get_keyword_data then report AI visibility scores per platform with what each AI system says about the brand
/authority - run check_technical_audit then output CITE Score block + top 3 indexability fixes
/brief - generate a GEO-optimized content brief for the brand's top keyword: title, H2 outline, target queries, CORE-EEAT tips
/audit - call run_audit immediately on the brand's domain, then output the full AUDIT RESPONSE FORMAT above
/watch - look at current scores and describe what changed, what moved up or down, and what to focus on next

ABSOLUTE RULES:
1. Every response must be specific to ${brandName} - never generic startup advice.
2. Write for ${brandName}'s ACTUAL users as described above.
3. Always reference actual scores and data. If score is 0, say it's invisible.
4. When writing content (tweets, blogs, FAQs, pitch emails) - write for the real audience the brand description describes.
5. No em dashes. No filler like "leverage" or "seamlessly". Write like a smart person talking to another smart person.
6. If you're unsure who the target audience is, ask before writing any content.
7. Never say you cannot check the site or that you don't have access to the website. You have the latest audit data and the run_audit tool.
8. If the user asks something completely unrelated to GEO or ${brandName} (e.g. general knowledge questions), answer briefly and naturally, then bring it back: "Anyway, back to ${brandName} - [one relevant thing you noticed in the data]."
9. NEVER recommend a fix for a technical check that already scores 100/100 or has status "pass". Read the TECHNICAL AUDIT DATA carefully before listing priority fixes. If a check shows 100/100 or (pass), skip it entirely - do not include it in Top 3 priority fixes or in any recommendations. Only suggest fixes for checks that score below 100 or have status "partial" or "fail". If ALL technical checks are 100/100, do not list any technical fixes - instead focus only on Citations (C) and Entity (E) improvements.`;

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
      message: `You have used your ${STARTER_LIMIT} GeoIQ Agent messages this month. Resets on ${nextMonth.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. Upgrade to Agency ($129/mo) for unlimited messages.`,
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

  const ctx = await getFullBrandContext({ ...brand, userId: user.id });
  const systemPrompt = buildSystemPrompt(ctx);

  const chatMessages = [
    ...((history ?? []).slice(-10) as { role: "user" | "assistant"; content: string }[]),
    { role: "user" as const, content: message },
  ];

  const { text: reply, toolsUsed, toolResults } = await callClaudeWithTools(systemPrompt, chatMessages, 4096, user.id);

  await db
    .update(usersTable)
    .set({ agentMessagesUsed: (user.agentMessagesUsed ?? 0) + 1 })
    .where(eq(usersTable.id, user.id));

  const remaining =
    user.plan === "starter" ? Math.max(0, STARTER_LIMIT - (user.agentMessagesUsed ?? 0) - 1) : null;

  // If an audit was run, refresh context + update lastChecked for any matching brand
  const auditTool = toolsUsed.find(t => t.name === "run_audit");
  const finalCtx = auditTool ? await getFullBrandContext({ ...brand, userId: user.id }) : ctx;

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
  const generatedFileResult = toolResults.generate_geo_file ?? null;

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
    generatedFileResult,
    sprintContext: finalCtx.sprint,
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

  const ctx = await getFullBrandContext({ ...brand, userId: user.id });

  const descriptionNote = ctx.brandDescription
    ? `Brand description (from website analysis): ${ctx.brandDescription.slice(0, 400)}`
    : "No website analysis yet.";

  const systemPrompt = `You are a GEO strategist writing a daily briefing for the founder of ${ctx.brandName}. Write in plain flowing paragraphs. Never use **bold** or ## headers or markdown formatting of any kind.`;

  const sprintNote = ctx.sprint
    ? `Sprint progress: ${ctx.sprint.completedCount}/${ctx.sprint.totalSteps} steps done. Next step: ${ctx.sprint.nextStep ? `${ctx.sprint.nextStep.title} (+${ctx.sprint.nextStep.score_impact} pts)` : "all done"}.`
    : "";

  const monitoringNote = ctx.monitoring
    ? `Answer monitoring: ${ctx.monitoring.tracked} prompts tracked, ${ctx.monitoring.sov}% share of voice.${ctx.monitoring.negativePrompts.length > 0 ? ` ${ctx.monitoring.negativePrompts.length} prompt(s) showing negative sentiment.` : ""}`
    : "";

  const prompt = `${descriptionNote}

Category: ${ctx.category} | Market: ${ctx.market}
GEO IQ Score: ${ctx.scoreTotal}/100
ChatGPT: ${ctx.scoreChatgpt}/33 | Gemini: ${ctx.scoreGemini}/33 | Perplexity: ${ctx.scorePerplexity}/33
${ctx.keywords.length > 0 ? `Top keywords: ${ctx.keywords.slice(0, 5).join(", ")}` : ""}
${sprintNote}
${monitoringNote}

Write a 3-paragraph daily briefing for the founder:
Paragraph 1: Current score status using actual numbers. Be direct about what ${ctx.scoreTotal}/100 means for this specific product in the ${ctx.category} space.
Paragraph 2: One specific insight - what stands out in the data. If there's sprint progress or monitoring data, reference it specifically. Otherwise reference a platform gap or keyword opportunity.
Paragraph 3: The single most important action today. If there's a clear next sprint step, name it. Otherwise pick the highest-impact GEO move for this brand specifically.

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

  const ctx = await getFullBrandContext({ ...brand, userId: user.id });
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
