import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, dataforseoCacheTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const BRAND_PERFORMANCE_PAID = false;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BrandDriverData {
  driver: string;
  yourFrequency: number;
  competitorFrequencies?: Record<string, number>;
  sentiment: "positive" | "mixed" | "negative";
  isLeader: boolean;
}

interface BrandPerformanceResult {
  domain: string;
  brandName: string;
  overallScore: number;
  shareOfVoice: number;
  sentiment: { favorable: number; neutral: number; negative: number; summary: string };
  businessDrivers: BrandDriverData[];
  competitorData: Array<{
    name: string;
    shareOfVoice: number;
    sentiment: number;
    insightTitle?: string;
    insightText?: string;
    insightColor?: "green" | "amber" | "red";
    businessDrivers?: Array<{ driver: string; competitorFreq: number; yourFreq: number }>;
  }>;
  keyStrengths: string[];
  areasForImprovement: string[];
  narrativeDrivers: Array<{ topic: string; mentions: number; trend: "up" | "down" | "stable" }>;
  topQuestions: Array<{ question: string; brandMentioned: boolean; yourRank: number; category: string }>;
  insights: Array<{ number: number; title: string; description: string; action: string; linkTo: string }>;
  strategicOpportunities: Array<{ timeframe: "urgent" | "medium"; title: string; description: string; recommendations: string[] }>;
  citedSources?: Array<{ domain: string; mentions: number }>;
  answers?: Array<{ prompt: string; response: string; brandMentioned: boolean; sentiment: string; competitorsMentioned: string[]; keyThemes: string[] }>;
  isMock?: boolean;
  cached?: boolean;
  locked?: boolean;
  scannedAt: string;
  methodology: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractBrandName(domain: string): string {
  const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? domain;
  const name = bare.replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "").replace(/-/g, " ").trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseClaudeJSON<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { return null; }
    }
    return null;
  }
}

function getMockBrandData(domain: string, brandName: string, competitors: string[]): BrandPerformanceResult {
  const competitorBrandNames = competitors.map(c =>
    extractBrandName(c.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? c)
  );

  const defaultCompetitors = [
    { name: "Competitor A", shareOfVoice: 38, sentiment: 52 },
    { name: "Competitor B", shareOfVoice: 28, sentiment: 61 },
    { name: "Competitor C", shareOfVoice: 19, sentiment: 44 },
  ];
  const competitorData = competitorBrandNames.length > 0
    ? competitorBrandNames.map((name, i) => ({
        name,
        shareOfVoice: ([38, 28, 19, 12] as number[])[i] ?? 20,
        sentiment: ([52, 61, 44, 55] as number[])[i] ?? 50,
      }))
    : defaultCompetitors;

  const compFreqs = competitorBrandNames.reduce<Record<string, number>>((acc, name, i) => {
    acc[name] = ([7, 5, 6, 4] as number[])[i] ?? 5;
    return acc;
  }, {});

  const hasCompetitors = competitorBrandNames.length > 0;

  return {
    domain,
    brandName,
    overallScore: 72,
    shareOfVoice: 45,
    sentiment: {
      favorable: 68,
      neutral: 22,
      negative: 10,
      summary: `${brandName} is widely recognized for quality and reliability. AI systems consistently highlight its strengths while noting areas for improvement around pricing.`,
    },
    businessDrivers: [
      { driver: "Product Quality", yourFrequency: 9, competitorFrequencies: hasCompetitors ? compFreqs : undefined, sentiment: "positive", isLeader: true },
      { driver: "Pricing Value", yourFrequency: 6, competitorFrequencies: hasCompetitors ? Object.fromEntries(Object.entries(compFreqs).map(([k, v]) => [k, v + 2])) : undefined, sentiment: "mixed", isLeader: false },
      { driver: "User Experience", yourFrequency: 8, competitorFrequencies: hasCompetitors ? Object.fromEntries(Object.entries(compFreqs).map(([k, v]) => [k, v - 1])) : undefined, sentiment: "positive", isLeader: true },
      { driver: "Customer Support", yourFrequency: 4, competitorFrequencies: hasCompetitors ? Object.fromEntries(Object.entries(compFreqs).map(([k, v]) => [k, v - 1])) : undefined, sentiment: "mixed", isLeader: false },
      { driver: "Innovation", yourFrequency: 7, competitorFrequencies: hasCompetitors ? Object.fromEntries(Object.entries(compFreqs).map(([k, v]) => [k, v])) : undefined, sentiment: "positive", isLeader: true },
    ],
    competitorData,
    keyStrengths: [
      "Strong brand recognition",
      "High quality product or service",
      "Positive user experience",
    ],
    areasForImprovement: [
      "Pricing competitiveness",
      "Customer support responsiveness",
    ],
    narrativeDrivers: [
      { topic: "Brand Quality", mentions: 14, trend: "up" },
      { topic: "Value for Money", mentions: 10, trend: "down" },
      { topic: "Innovation", mentions: 12, trend: "stable" },
    ],
    topQuestions: [
      { question: `Is ${brandName} worth it?`, brandMentioned: true, yourRank: 1, category: "branded" },
      { question: `${brandName} review - is it legit?`, brandMentioned: true, yourRank: 1, category: "branded" },
      { question: `${brandName} pricing explained`, brandMentioned: true, yourRank: 2, category: "branded" },
      { question: `Is ${brandName} good for beginners?`, brandMentioned: true, yourRank: 1, category: "branded" },
      { question: `${brandName} pros and cons`, brandMentioned: true, yourRank: 1, category: "branded" },
      { question: `Who uses ${brandName}?`, brandMentioned: true, yourRank: 2, category: "branded" },
      { question: `How reliable is ${brandName}?`, brandMentioned: true, yourRank: 1, category: "branded" },
      { question: `${brandName} customer support quality`, brandMentioned: true, yourRank: 3, category: "branded" },
      { question: `${brandName} vs competitors`, brandMentioned: true, yourRank: 1, category: "comparison" },
      { question: `Best alternatives to ${brandName}`, brandMentioned: true, yourRank: 2, category: "comparison" },
      { question: `${brandName} vs industry leader`, brandMentioned: true, yourRank: 1, category: "comparison" },
      { question: `Which is better: ${brandName} or alternatives?`, brandMentioned: true, yourRank: 2, category: "comparison" },
      { question: `${brandName} compared to similar tools`, brandMentioned: true, yourRank: 1, category: "comparison" },
      { question: `${brandName} vs budget options`, brandMentioned: false, yourRank: 4, category: "comparison" },
      { question: `What features does ${brandName} offer?`, brandMentioned: true, yourRank: 1, category: "feature" },
      { question: `Does ${brandName} have mobile app?`, brandMentioned: true, yourRank: 2, category: "feature" },
      { question: `${brandName} integrations and APIs`, brandMentioned: true, yourRank: 1, category: "feature" },
      { question: `${brandName} weaknesses`, brandMentioned: true, yourRank: 1, category: "problem" },
      { question: `Cheaper alternatives to ${brandName}`, brandMentioned: false, yourRank: 3, category: "problem" },
      { question: `Common complaints about ${brandName}`, brandMentioned: true, yourRank: 2, category: "problem" },
    ],
    insights: [
      {
        number: 1,
        title: "Strong perception, visibility gap",
        description: `AI rates ${brandName} highly but mentions it less often than competitors.`,
        action: "Increase content output targeting non-branded queries.",
        linkTo: "narrative",
      },
      {
        number: 2,
        title: "Pricing narrative needs work",
        description: "Pricing is the most common friction point in AI responses.",
        action: "Create content addressing value and ROI directly.",
        linkTo: "perception",
      },
      {
        number: 3,
        title: "Questions opportunity",
        description: "Several high-volume questions go unanswered by your content.",
        action: "Create FAQ content targeting these exact prompts.",
        linkTo: "questions",
      },
    ],
    strategicOpportunities: [
      {
        timeframe: "urgent",
        title: "Close the Share of Voice gap",
        description: `Your brand scores well on sentiment but trails competitors on raw visibility. This means buyers who find you tend to choose you, but many never see you.`,
        recommendations: [
          "Publish content targeting 10 non-branded queries where competitors appear",
          "Submit to high-authority directories (G2, Capterra, Crunchbase)",
          "Build Reddit presence in relevant subreddits",
        ],
      },
      {
        timeframe: "medium",
        title: "Convert positive perception into citations",
        description: "High sentiment score means AI speaks well of your brand when prompted. Next step is getting cited proactively in unprompted responses.",
        recommendations: [
          "Add structured data markup to all product pages",
          "Create authoritative comparison content",
          "Build backlinks from AI-cited domains",
        ],
      },
    ],
    citedSources: [
      { domain: "g2.com", mentions: 45 },
      { domain: "reddit.com", mentions: 38 },
      { domain: "capterra.com", mentions: 22 },
      { domain: "techcrunch.com", mentions: 18 },
      { domain: "producthunt.com", mentions: 12 },
    ],
    answers: [
      { prompt: `Is ${brandName} worth the subscription?`, response: `${brandName} is generally considered worth it for users who value quality and reliability. The pricing is competitive for the features offered, though budget-conscious users may want to evaluate alternatives.`, brandMentioned: true, sentiment: "positive", competitorsMentioned: [], keyThemes: ["value", "quality"] },
      { prompt: `What are the main strengths of ${brandName}?`, response: `${brandName} stands out for its product quality and user experience. Users consistently praise the interface and reliability, making it a top choice in its category.`, brandMentioned: true, sentiment: "positive", competitorsMentioned: [], keyThemes: ["quality", "user experience"] },
      { prompt: `What are the weaknesses of ${brandName}?`, response: `${brandName}'s main weaknesses include pricing compared to budget alternatives and occasional customer support delays. These are areas where competitors sometimes have an edge.`, brandMentioned: true, sentiment: "mixed", competitorsMentioned: [], keyThemes: ["pricing", "support"] },
      { prompt: `How does ${brandName} compare to competitors?`, response: `${brandName} competes strongly on quality and brand trust. However, some competitors offer lower pricing or more specialized features for specific use cases.`, brandMentioned: true, sentiment: "neutral", competitorsMentioned: competitorBrandNames.slice(0, 2), keyThemes: ["competition", "pricing"] },
      { prompt: `Who should use ${brandName}?`, response: `${brandName} is best suited for users who prioritize quality and reliability over cost. It works well for both individuals and businesses that need a dependable solution.`, brandMentioned: true, sentiment: "positive", competitorsMentioned: [], keyThemes: ["use case", "target audience"] },
    ],
    scannedAt: new Date().toISOString(),
    methodology: "20 Claude AI synthetic responses",
    isMock: true,
  };
}

// ─── Cited sources from cached pages data ──────────────────────────────────────

async function getCitedSourcesFromCache(domain: string): Promise<Array<{ domain: string; mentions: number }>> {
  try {
    const rows = await db
      .select()
      .from(dataforseoCacheTable)
      .where(like(dataforseoCacheTable.key, `llm_pages%${domain}%`))
      .limit(4);

    const sources = new Map<string, number>();
    for (const row of rows) {
      const data = row.data as { pages?: Array<{ url: string; mentions: number }> };
      for (const page of data.pages ?? []) {
        try {
          const d = new URL(page.url).hostname.replace(/^www\./, "");
          sources.set(d, (sources.get(d) ?? 0) + (page.mentions ?? 1));
        } catch { /* skip */ }
      }
    }
    return [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([d, mentions]) => ({ domain: d, mentions }));
  } catch {
    return [];
  }
}

// ─── Suggest competitors ────────────────────────────────────────────────────────

router.get("/brand-performance/suggest-competitors", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const bareD = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? domain;
  const brandName = extractBrandName(bareD);
  const cacheKey = `brand_perf_competitors:${bareD}`;

  // Cache check - 7 days
  try {
    const [row] = await db.select().from(dataforseoCacheTable).where(eq(dataforseoCacheTable.key, cacheKey)).limit(1);
    if (row && row.expiresAt > new Date()) {
      res.json(row.data);
      return;
    }
  } catch { /* non-fatal */ }

  // Sandbox mode
  if (process.env.DATAFORSEO_SANDBOX === "true") {
    res.json({ competitors: ["primevideo.com", "disneyplus.com", "hulu.com", "hbomax.com", "peacocktv.com"] });
    return;
  }

  try {
    logger.info({ model: "claude-sonnet-4-6", max_tokens: 256, estimated_cost: +(256 * 0.000015).toFixed(4), endpoint: "Signal Tracker / suggest-competitors", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `What are the top 5 direct competitors of ${brandName} (${bareD})?
Return ONLY a JSON array of their domain names, without www. prefix.
Example: ["competitor1.com", "competitor2.com"]
Return pure JSON only. No markdown. No backticks.`,
      }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const competitors = parseClaudeJSON<string[]>(text) ?? [];
    const result = { competitors: competitors.slice(0, 5) };

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .insert(dataforseoCacheTable)
        .values({ key: cacheKey, data: result as unknown as Record<string, unknown>, costUsd: "0.001", expiresAt })
        .onConflictDoUpdate({
          target: dataforseoCacheTable.key,
          set: { data: result as unknown as Record<string, unknown>, cachedAt: new Date(), expiresAt },
        });
    } catch { /* non-fatal */ }

    res.json(result);
  } catch (err) {
    req.log.error({ err, domain }, "suggest-competitors error");
    res.json({ competitors: [] });
  }
});

// ─── Route ─────────────────────────────────────────────────────────────────────

router.post("/brand-performance", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { domain, competitors = [], language = "en", force } = req.body as {
    domain?: string;
    competitors?: string[];
    language?: string;
    force?: boolean;
  };

  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const bareD = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? domain;
  const brandName = extractBrandName(bareD);
  const sortedCompetitors = [...competitors].sort();
  const cacheKey = `brand_perf_v2:${bareD}:${sortedCompetitors.join(",") || "none"}:${language}`;

  try {
    // Paywall check
    if (BRAND_PERFORMANCE_PAID) {
      const user = req.user;
      const plan = (user as { plan?: string } | undefined)?.plan ?? "free";
      if (plan === "free") {
        res.json({ locked: true, message: "Brand Performance requires Starter plan" });
        return;
      }
    }

    // Cache check (30 days)
    if (!force) {
      try {
        const [row] = await db
          .select()
          .from(dataforseoCacheTable)
          .where(eq(dataforseoCacheTable.key, cacheKey))
          .limit(1);
        if (row && row.expiresAt > new Date()) {
          res.json({ ...(row.data as unknown as BrandPerformanceResult), cached: true });
          return;
        }
      } catch { /* non-fatal */ }
    }

    // Sandbox mode: return mock immediately with real competitor names
    if (process.env.DATAFORSEO_SANDBOX === "true") {
      res.json(getMockBrandData(bareD, brandName, competitors));
      return;
    }

    req.log.info({ domain: bareD }, "brand-performance: step 1 - generating prompts");

    // Shared abort controller - cancel all Claude calls after 90 seconds
    const ac = new AbortController();
    const abortTimer = setTimeout(() => ac.abort(), 90_000);

    // STEP 1: Generate 10 prompts (haiku is fast enough for list generation)
    logger.info({ model: "claude-haiku-4-5", max_tokens: 1024, estimated_cost: +(1024 * 0.00000125).toFixed(5), endpoint: "Signal Tracker / brand-performance step1 prompt-gen", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
    const promptGenMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Generate exactly 10 prompts a buyer would ask an AI assistant when evaluating ${brandName}.

Cover: product quality (2), pricing (2), vs competitors (2), reputation (2), weaknesses (2).

Return ONLY a JSON array of 10 strings. No markdown. No backticks. Start with [ and end with ]`,
      }],
    }, { signal: ac.signal as AbortSignal });

    const promptText = promptGenMsg.content[0]?.type === "text" ? promptGenMsg.content[0].text : "[]";
    const prompts = parseClaudeJSON<string[]>(promptText) ?? [];

    if (prompts.length < 5) {
      clearTimeout(abortTimer);
      req.log.warn({ domain: bareD, count: prompts.length }, "brand-performance: too few prompts, using mock");
      res.json(getMockBrandData(bareD, brandName, competitors));
      return;
    }

    req.log.info({ domain: bareD, count: prompts.length }, "brand-performance: step 2 - getting answers");

    // STEP 2: Answer all prompts in one haiku call - concise 1-2 sentence responses
    logger.info({ model: "claude-haiku-4-5", max_tokens: 4096, estimated_cost: +(4096 * 0.00000125).toFixed(5), endpoint: "Signal Tracker / brand-performance step2 answers", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
    const answersMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are a neutral AI assistant. Answer each prompt about ${brandName}. Be balanced, 1-2 sentences max per answer. Mention real competitors naturally.

Prompts:
${prompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Return ONLY a JSON array with exactly ${prompts.length} objects:
[{"prompt":"text","response":"answer","brandMentioned":true,"sentiment":"positive","competitorsMentioned":["name"],"keyThemes":["theme"]}]

sentiment: positive, neutral, or negative. Pure JSON only, no markdown.`,
      }],
    }, { signal: ac.signal as AbortSignal });

    const answersText = answersMsg.content[0]?.type === "text" ? answersMsg.content[0].text : "[]";
    type AnswerItem = { prompt: string; response: string; brandMentioned: boolean; sentiment: string; competitorsMentioned: string[]; keyThemes: string[]; isBrandRecommended: boolean };
    const answers = parseClaudeJSON<AnswerItem[]>(answersText) ?? [];

    if (answers.length < 3) {
      clearTimeout(abortTimer);
      req.log.warn({ domain: bareD, count: answers.length }, "brand-performance: too few answers, using mock");
      res.json(getMockBrandData(bareD, brandName, competitors));
      return;
    }

    req.log.info({ domain: bareD, count: answers.length }, "brand-performance: step 3 - analyzing");

    // STEP 3: Analyze all answers
    logger.info({ model: "claude-sonnet-4-6", max_tokens: 4096, estimated_cost: +(4096 * 0.000015).toFixed(4), endpoint: "Signal Tracker / brand-performance step3 analysis", timestamp: new Date().toISOString() }, "[COST-AUDIT] CLAUDE CALL");
    const competitorsList = competitors.length > 0 ? competitors.join(", ") : "none specified";
    const competitorBrandNames = competitors.map(c =>
      extractBrandName(c.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? c)
    );
    const competitorNamesStr = competitorBrandNames.length > 0 ? competitorBrandNames.join(", ") : "none";

    const analysisMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are a brand intelligence analyst.
Analyze these ${answers.length} AI responses about ${brandName}.

Responses:
${JSON.stringify(answers)}

Competitors being tracked: ${competitorsList}
Competitor brand names: ${competitorNamesStr}

Return ONLY this JSON structure. No markdown. No backticks. Pure JSON.

{
  "overallScore": 72,
  "shareOfVoice": 45,
  "sentiment": {
    "favorable": 65,
    "neutral": 25,
    "negative": 10,
    "summary": "2 sentence summary of how AI perceives this brand"
  },
  "businessDrivers": [
    {
      "driver": "Content Quality",
      "yourFrequency": 8,
      "competitorFrequencies": ${competitorBrandNames.length > 0 ? JSON.stringify(Object.fromEntries(competitorBrandNames.map(n => [n, 5]))) : "{}"},
      "sentiment": "positive",
      "isLeader": true
    }
  ],
  "competitorData": [
    {
      "name": "Actual competitor brand name",
      "shareOfVoice": 32,
      "sentiment": 58,
      "insightTitle": "Win on sentiment" or "You lead both" or "Gap to close" or "Catching up fast",
      "insightText": "One specific sentence with real numbers from this scan. Example: Primevideo leads share of voice 38% vs your 45%; you win sentiment 68% vs 52% — push sentiment-led proof to grow share.",
      "insightColor": "green" if you lead both metrics, "amber" if mixed results, "red" if trailing both,
      "businessDrivers": [
        { "driver": "Content Quality", "competitorFreq": 7, "yourFreq": 9 },
        { "driver": "Pricing Value", "competitorFreq": 8, "yourFreq": 6 },
        { "driver": "User Experience", "competitorFreq": 6, "yourFreq": 8 },
        { "driver": "Original Content", "competitorFreq": 5, "yourFreq": 9 },
        { "driver": "Customer Support", "competitorFreq": 3, "yourFreq": 4 }
      ]
    }
  ],
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "areasForImprovement": ["area 1", "area 2"],
  "narrativeDrivers": [
    { "topic": "Original Content", "mentions": 12, "trend": "up" }
  ],
  "topQuestions": [
    { "question": "Is ${brandName} worth it?", "brandMentioned": true, "yourRank": 1, "category": "branded" },
    { "question": "${brandName} vs competitor", "brandMentioned": true, "yourRank": 1, "category": "comparison" },
    { "question": "Does ${brandName} have feature X?", "brandMentioned": true, "yourRank": 1, "category": "feature" },
    { "question": "Problems with ${brandName}", "brandMentioned": true, "yourRank": 2, "category": "problem" }
  ],
  "insights": [
    { "number": 1, "title": "Short insight title", "description": "One sentence.", "action": "One sentence action.", "linkTo": "perception" },
    { "number": 2, "title": "Second insight", "description": "One sentence.", "action": "One sentence action.", "linkTo": "narrative" },
    { "number": 3, "title": "Third insight", "description": "One sentence.", "action": "One sentence action.", "linkTo": "questions" }
  ],
  "strategicOpportunities": [
    {
      "timeframe": "urgent",
      "title": "Close the Share of Voice gap on [specific topic from scan data]",
      "description": "Reference specific numbers: e.g. 'Your brand scores X/20 on [Driver] while [Competitor] scores Y/20. This gap is widening because [reason from responses]. AI systems currently reference [Competitor] when users ask about [topic].'",
      "recommendations": [
        "2-3 sentence specific recommendation referencing actual prompts from the scan. Name the exact query.",
        "2-3 sentence recommendation citing specific drivers or competitors from the data.",
        "2-3 sentence recommendation about a specific channel or content type that would address this gap."
      ]
    },
    {
      "timeframe": "urgent",
      "title": "Second urgent opportunity specific to this brand",
      "description": "2-3 sentences with exact numbers from scan data.",
      "recommendations": ["2-3 sentence rec 1", "2-3 sentence rec 2", "2-3 sentence rec 3"]
    },
    {
      "timeframe": "medium",
      "title": "Medium-term opportunity unique to this brand",
      "description": "2-3 sentences with specific data points.",
      "recommendations": ["2-3 sentence rec 1", "2-3 sentence rec 2", "2-3 sentence rec 3"]
    },
    {
      "timeframe": "medium",
      "title": "Fourth opportunity",
      "description": "2-3 sentences description.",
      "recommendations": ["2-3 sentence rec 1", "2-3 sentence rec 2", "2-3 sentence rec 3"]
    },
    {
      "timeframe": "medium",
      "title": "Fifth opportunity",
      "description": "2-3 sentences description.",
      "recommendations": ["2-3 sentence rec 1", "2-3 sentence rec 2", "2-3 sentence rec 3"]
    }
  ]
}

IMPORTANT RULES:
- businessDrivers: 4-6 items. For competitorFrequencies, use real competitor brand names as keys and estimate frequency 1-10.
- competitorData: Use real brand names from competitors list, not generic "Competitor A/B". Every competitor object MUST include insightTitle, insightText (with real SoV and sentiment numbers), insightColor, and businessDrivers (5 items matching the main businessDrivers list).
- topQuestions: Generate exactly 10 questions total - 4 branded, 3 comparison, 2 feature, 1 problem. category must be one of: branded, comparison, feature, problem.
- strategicOpportunities: Generate exactly 4-5 cards. Each recommendation must be 2-3 sentences, specific to this brand's actual data, naming competitors and exact numbers where relevant.
- All frequencies are 1-10. shareOfVoice and sentiment are 0-100 percent.
- insightColor: "green" = you lead both SoV and sentiment, "red" = competitor leads both, "amber" = mixed.`,
      }],
    }, { signal: ac.signal as AbortSignal });

    clearTimeout(abortTimer);

    const analysisText = analysisMsg.content[0]?.type === "text" ? analysisMsg.content[0].text : "{}";
    type AnalysisShape = Omit<BrandPerformanceResult, "domain" | "brandName" | "scannedAt" | "methodology" | "answers" | "citedSources">;
    const analysis = parseClaudeJSON<AnalysisShape>(analysisText);

    if (!analysis || typeof analysis.overallScore !== "number") {
      req.log.warn({ domain: bareD }, "brand-performance: analysis parsing failed, using mock");
      res.json(getMockBrandData(bareD, brandName, competitors));
      return;
    }

    // Fetch cited sources from cached pages data (non-blocking)
    const citedSources = await getCitedSourcesFromCache(bareD);

    const result: BrandPerformanceResult = {
      domain: bareD,
      brandName,
      overallScore: analysis.overallScore ?? 0,
      shareOfVoice: analysis.shareOfVoice ?? 0,
      sentiment: analysis.sentiment ?? { favorable: 50, neutral: 30, negative: 20, summary: "" },
      businessDrivers: analysis.businessDrivers ?? [],
      competitorData: analysis.competitorData ?? [],
      keyStrengths: analysis.keyStrengths ?? [],
      areasForImprovement: analysis.areasForImprovement ?? [],
      narrativeDrivers: analysis.narrativeDrivers ?? [],
      topQuestions: analysis.topQuestions ?? [],
      insights: analysis.insights ?? [],
      strategicOpportunities: analysis.strategicOpportunities ?? [],
      citedSources: citedSources.length > 0 ? citedSources : undefined,
      answers: answers.map(a => ({
        prompt: a.prompt,
        response: a.response,
        brandMentioned: a.brandMentioned,
        sentiment: a.sentiment,
        competitorsMentioned: a.competitorsMentioned ?? [],
        keyThemes: a.keyThemes ?? [],
      })),
      scannedAt: new Date().toISOString(),
      methodology: "10 Claude AI synthetic responses",
    };

    req.log.info({ domain: bareD, score: result.overallScore }, "brand-performance: complete, caching 30 days");

    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await db
        .insert(dataforseoCacheTable)
        .values({ key: cacheKey, data: result as unknown as Record<string, unknown>, costUsd: "0.10", expiresAt })
        .onConflictDoUpdate({
          target: dataforseoCacheTable.key,
          set: { data: result as unknown as Record<string, unknown>, cachedAt: new Date(), expiresAt },
        });
    } catch { /* non-fatal */ }

    res.json(result);
  } catch (err) {
    req.log.error({ err, domain }, "brand-performance error");
    const isAbort = err instanceof Error && err.name === "AbortError";
    res.status(500).json({ error: isAbort ? "Analysis timed out. Please try again." : "Analysis failed. Please try again." });
  }
});

export default router;
