import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, usersTable, monitoredBrandsTable, dailyScoresTable, auditsTable, keywordCacheTable } from "@workspace/db";
import { eq, and, desc, gt } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const STARTER_LIMIT = 50;

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

  // Keywords from DataForSEO cache
  const cachedKeywordRows = (cachedKws[0]?.keywords ?? []) as { keyword: string; volume: number; competition?: number }[];
  const rawKeywords = cachedKeywordRows.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume ?? 0 }));
  const dfsKeywords = rawKeywords.slice(0, 8).map(k => `${k.keyword}${k.volume ? ` (${k.volume}/mo)` : ""}`);
  const keywords = dfsKeywords.length > 0 ? dfsKeywords : auditKeywords;
  const competitors = (audit?.competitorsFound ?? []).slice(0, 5);

  // Technical audit data from rawResults
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
    ? `WHAT ${brandName.toUpperCase()} ACTUALLY DOES (from AI analysis of their website):
${brandDescription}`
    : `WHAT ${brandName.toUpperCase()} DOES:
No website analysis available yet. Ask the user to describe their product, or ask them to run an audit first.`;

  const keywordsBlock = keywords.length > 0
    ? `KEYWORDS AI SYSTEMS ARE BEING ASKED ABOUT ${brandName}:
${keywords.map(k => `- ${k}`).join("\n")}`
    : "";

  const competitorsBlock = competitors.length > 0
    ? `KNOWN COMPETITORS:
${competitors.map(c => `- ${c}`).join("\n")}`
    : "";

  const checkedAgo = auditCheckedAt
    ? (() => {
      const hours = Math.round((Date.now() - new Date(auditCheckedAt).getTime()) / 36e5);
      return hours < 24 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`;
    })()
    : null;

  const technicalBlock = technicalChecks.length > 0
    ? `TECHNICAL AUDIT DATA (last checked: ${checkedAgo ?? "unknown"} - use these exact scores, never say you cannot check the site):
${technicalChecks.map(c => `- ${c.name}: ${c.score}/100 (${c.status}) - ${c.detail}`).join("\n")}
Technical total: ${technicalOverallScore}/100`
    : `TECHNICAL AUDIT:
No technical audit data yet. Tell the user to run an audit first. Never make up technical scores.`;

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
2. Write for ${brandName}'s ACTUAL users as described above. If the description says they serve Indian women with diabetes and PCOS, every tweet, blog post, and suggestion must target that audience - NOT founders, NOT tech people, unless that IS the actual audience.
3. Always reference actual scores and data. If score is 0, say it's invisible. If ChatGPT is strong but Gemini is weak, point that out specifically.
4. When writing content (tweets, blogs, FAQs, pitch emails) - write for the real audience the brand description describes.
5. No em dashes. No filler like "leverage" or "seamlessly". Write like a smart person talking to another smart person.
6. If you're unsure who the target audience is, ask before writing any content.
7. Never say you cannot check the site or that you don't have access to the website. You have the latest audit data in your context. Use it.`;
}

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

  const reply = await callClaude(systemPrompt, chatMessages, 1200);

  await db
    .update(usersTable)
    .set({ agentMessagesUsed: (user.agentMessagesUsed ?? 0) + 1 })
    .where(eq(usersTable.id, user.id));

  const remaining =
    user.plan === "starter" ? Math.max(0, STARTER_LIMIT - (user.agentMessagesUsed ?? 0) - 1) : null;

  res.json({
    reply,
    remaining,
    plan: user.plan,
    keywords: ctx.rawKeywords,
    technicalChecks: ctx.technicalChecks,
    technicalOverallScore: ctx.technicalOverallScore,
    auditCheckedAt: ctx.auditCheckedAt,
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
