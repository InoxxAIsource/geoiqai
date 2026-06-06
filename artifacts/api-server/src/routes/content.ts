import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, dataforseoCacheTable, contentAnalysesTable } from "@workspace/db";
import { like, desc, eq } from "drizzle-orm";

const router = Router();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Factor {
  name: string;
  score: number;
  status: "good" | "warning" | "missing";
  feedback: string;
  fix: string | null;
}

interface TopFix {
  priority: number;
  impact: "high" | "medium" | "low";
  title: string;
  description: string;
  timeToFix: string;
  scoreImpact: string;
  fix: string | null;
}

interface AnalysisResult {
  overallScore: number;
  scoreLabel: string;
  factors: Factor[];
  topFixes: TopFix[];
  missingPrompts: string[];
  competitorTips?: string[];
  isMock?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseJSON<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = text.match(/(\{[\s\S]*\})/);
    if (match) { try { return JSON.parse(match[0]) as T; } catch { return null; } }
    return null;
  }
}

function generateMockPrompts(topic: string): string[] {
  const t = topic.trim();
  const tl = t.toLowerCase();
  const isVerbPhrase = /^(get |improve |increase |track |measure |appear |rank |show |create |build |optimize |fix |check |find |make |boost |grow |use )/i.test(t);
  if (isVerbPhrase) {
    return [
      `how to ${tl}`,
      `best ways to ${tl}`,
      `step by step guide to ${tl}`,
      `common mistakes when trying to ${tl}`,
    ];
  }
  return [
    `what are the best ${tl}`,
    `how to choose ${tl}`,
    `${tl} comparison and reviews 2026`,
    `free ${tl} guide for startups`,
  ];
}

function getMockAnalysis(targetTopic: string): AnalysisResult {
  return {
    overallScore: 54,
    scoreLabel: "Needs Work",
    isMock: true,
    factors: [
      { name: "Factual Statements", score: 7, status: "good", feedback: "Content includes several clear factual statements AI can extract and cite.", fix: null },
      { name: "FAQ Section", score: 1, status: "missing", feedback: "No FAQ section found. AI models prefer Q&A format for direct answers.", fix: `Add this FAQ section to your content:\n\nQ: What is ${targetTopic}?\nA: [2-3 sentence direct answer]\n\nQ: How does ${targetTopic} work?\nA: [2-3 sentence explanation]\n\nQ: What are the benefits of ${targetTopic}?\nA: [3-4 bullet points with sources]` },
      { name: "Structured Data", score: 0, status: "missing", feedback: "No structured data detected. Required for Google AI Overview inclusion.", fix: `Add this JSON-LD to your page <head>:\n\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "What is ${targetTopic}?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "[Your answer here]"\n    }\n  }]\n}\n</script>` },
      { name: "Statistics and Data", score: 5, status: "warning", feedback: "Some numbers present but most lack source attribution. AI prefers cited data.", fix: "Add source attribution to each statistic. Example: 'According to [Source], 67% of...' rather than just '67% of...'" },
      { name: "Comparison Tables", score: 0, status: "missing", feedback: "No comparison tables found. AI models frequently cite structured comparisons.", fix: null },
      { name: "Entity Definitions", score: 6, status: "warning", feedback: "Key terms are mentioned but not always formally defined for AI to extract.", fix: null },
      { name: "Authoritative Citations", score: 3, status: "missing", feedback: "Few or no external source references. AI trusts pages that cite credible sources.", fix: null },
      { name: "Prompt Coverage", score: 4, status: "warning", feedback: "Content answers some common queries but misses several high-volume prompts for this topic.", fix: null },
      { name: "Quotable Statements", score: 7, status: "good", feedback: "Several concise, citable phrases found. Keep them under 30 words for best AI extraction.", fix: null },
      { name: "Heading Hierarchy", score: 6, status: "warning", feedback: "Heading structure exists but could be more granular. AI uses headings to understand content sections.", fix: null },
    ],
    topFixes: [
      {
        priority: 1,
        impact: "high",
        title: "Add FAQPage schema markup",
        description: "FAQPage JSON-LD is the single most effective trigger for Google AI Overview. Without it your page cannot appear in AI-generated answers for question-type queries.",
        timeToFix: "20 minutes",
        scoreImpact: "+18 pts",
        fix: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "What is ${targetTopic}?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "Add your 2-3 sentence direct answer here."\n      }\n    }\n  ]\n}\n</script>`,
      },
      {
        priority: 2,
        impact: "high",
        title: "Add FAQ section with 5 Q&As",
        description: "ChatGPT and Perplexity cite pages that directly answer questions. A dedicated FAQ section targeting common prompts can increase your citation rate significantly.",
        timeToFix: "30 minutes",
        scoreImpact: "+12 pts",
        fix: `## Frequently Asked Questions\n\n### What is ${targetTopic}?\n[2-3 sentence direct answer]\n\n### How does ${targetTopic} work?\n[2-3 sentence explanation]\n\n### What are the benefits of ${targetTopic}?\n- Benefit 1 with specific metric\n- Benefit 2 with specific metric\n- Benefit 3 with specific metric\n\n### Who should use ${targetTopic}?\n[1-2 sentences defining the target audience]\n\n### How much does ${targetTopic} cost?\n[Pricing information or range]`,
      },
      {
        priority: 3,
        impact: "medium",
        title: "Add 3-5 statistics with source attribution",
        description: "AI models strongly prefer citing pages with data. Adding sourced statistics increases your citation probability and builds authority signals that AI systems recognize.",
        timeToFix: "45 minutes",
        scoreImpact: "+8 pts",
        fix: null,
      },
    ],
    missingPrompts: generateMockPrompts(targetTopic),
    competitorTips: [
      "Pages that rank for this topic in AI typically have comparison tables with 4+ columns",
      "Top cited pages include at least 3 statistics from credible sources with inline attribution",
      "FAQ sections with 5+ questions perform best in Google AI Overview",
    ],
  };
}

// ─── POST /api/content/fetch-url ────────────────────────────────────────────────

router.post("/content/fetch-url", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url?.trim()) { res.status(400).json({ error: "url is required" }); return; }

  const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "GeoIQ/1.0 (content analyzer)" },
    });
    clearTimeout(timeout);

    if (!response.ok) { res.status(400).json({ error: `Could not fetch URL: HTTP ${response.status}` }); return; }

    const html = await response.text();
    // Strip HTML tags, collapse whitespace, truncate
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);

    res.json({ content: text, charCount: text.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Could not fetch URL: ${msg}` });
  }
});

// ─── POST /api/content/analyze ──────────────────────────────────────────────────

router.post("/content/analyze", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { content, targetTopic, sourceUrl, domain } = req.body as {
    content?: string;
    targetTopic?: string;
    sourceUrl?: string;
    domain?: string;
  };

  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
  if (!targetTopic?.trim()) { res.status(400).json({ error: "targetTopic is required" }); return; }

  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  // Sandbox mode - return mock immediately
  if (process.env.DATAFORSEO_SANDBOX === "true") {
    const mock = getMockAnalysis(targetTopic);
    // Save mock to DB
    try {
      await db.insert(contentAnalysesTable).values({
        userId,
        domain: domain ?? "unknown",
        sourceUrl: sourceUrl ?? null,
        targetTopic,
        score: mock.overallScore,
        scoreLabel: mock.scoreLabel,
        factors: mock.factors,
        topFixes: mock.topFixes,
        missingPrompts: mock.missingPrompts,
      });
    } catch { /* non-fatal */ }
    res.json(mock);
    return;
  }

  const truncatedContent = content.slice(0, 8000);

  const prompt = `You are a GEO (Generative Engine Optimization) expert.
Analyze this content for AI citation readiness.
Content to analyze: ${truncatedContent}
Target topic: ${targetTopic}

Score these 10 factors from 0-10:
1. Factual Statements - clear facts AI can extract and cite
2. FAQ Section - Q&A format that matches AI prompts
3. Structured Data - mentions of schema markup needs
4. Statistics & Data - numbers with sources
5. Comparison Tables - structured comparisons
6. Entity Definitions - clear who/what/where definitions
7. Authoritative Citations - external source references
8. Prompt Coverage - content answers common AI queries
9. Quotable Statements - concise citable phrases under 30 words
10. Heading Hierarchy - clear H1/H2/H3 structure

Return ONLY valid JSON (no markdown, no code blocks):
{
  "overallScore": 67,
  "scoreLabel": "Good",
  "factors": [
    {
      "name": "Factual Statements",
      "score": 8,
      "status": "good",
      "feedback": "Content has clear factual statements AI can cite",
      "fix": null
    },
    {
      "name": "FAQ Section",
      "score": 1,
      "status": "missing",
      "feedback": "No FAQ section found. AI models prefer Q&A format.",
      "fix": "Add this FAQ section:\\n\\nQ: What is ${targetTopic}?\\nA: [2-3 sentence direct answer]\\n\\nQ: How does ${targetTopic} work?\\nA: [2-3 sentence explanation]"
    }
  ],
  "topFixes": [
    {
      "priority": 1,
      "impact": "high",
      "title": "Add FAQPage schema markup",
      "description": "FAQPage JSON-LD is the single most effective trigger for Google AI Overview.",
      "timeToFix": "20 minutes",
      "scoreImpact": "+18 pts",
      "fix": "<script type=\\"application/ld+json\\">...</script>"
    }
  ],
  "missingPrompts": [
    "how to get cited in ChatGPT",
    "why is my brand not showing in ChatGPT",
    "best ways to appear in ChatGPT answers",
    "how to improve ChatGPT brand visibility"
  ],
  "competitorTips": [
    "Pages that rank for this topic in AI typically have comparison tables",
    "Top cited pages include statistics from credible sources",
    "FAQ sections with 5+ questions perform best in Google AI Overview"
  ]
}

Rules:
- status: "good" for score >= 7, "warning" for 4-6, "missing" for <= 3
- scoreLabel: "Excellent" for 81+, "Good" for 61-80, "Needs Work" for 41-60, "Poor" for <= 40
- Generate exactly 10 factors
- Generate 3-5 topFixes ordered by impact
- missingPrompts: Generate 4 natural AI search queries that real users would type, related to the topic "${targetTopic}". Do NOT use templates like "what is [topic]" or "how to use [topic]". Generate contextually relevant questions that sound like real searches. For example, if the topic is "get cited in ChatGPT", write queries like "how to get cited in ChatGPT", "why is my brand not showing in AI answers", "best ways to appear in Perplexity results". If the topic is "AI visibility tools", write queries like "what are the best AI visibility tools", "how to track brand mentions in ChatGPT", "free tools to check AI brand visibility".
- For fix fields, include exact copy-pasteable content. Use null if no specific fix text is needed.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const result = parseJSON<AnalysisResult>(text);

    if (!result) { res.status(500).json({ error: "Could not parse analysis result. Please try again." }); return; }

    // Save to DB
    try {
      await db.insert(contentAnalysesTable).values({
        userId,
        domain: domain ?? "unknown",
        sourceUrl: sourceUrl ?? null,
        targetTopic,
        score: result.overallScore,
        scoreLabel: result.scoreLabel,
        factors: result.factors,
        topFixes: result.topFixes,
        missingPrompts: result.missingPrompts,
      });
    } catch { /* non-fatal */ }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/content/topics ─────────────────────────────────────────────────────

router.get("/content/topics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const domain = (req.query.domain as string)?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";

  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  if (process.env.DATAFORSEO_SANDBOX === "true") {
    res.json({
      isMock: true,
      writeThese: [
        { topic: `best ${domain.split(".")[0]} alternatives 2026`, competitor: "Competitor A", aiVolume: "2,400" },
        { topic: `how to improve AI visibility score`, competitor: "RankScale", aiVolume: "1,800" },
        { topic: `generative engine optimization guide`, competitor: "Profound.io", aiVolume: "3,200" },
      ],
      improveThese: [
        { topic: `what is geo optimization`, yourMentions: 2, aiVolume: "4,100" },
        { topic: `chatgpt brand visibility tips`, yourMentions: 1, aiVolume: "2,900" },
      ],
      brandQuestions: [
        { question: `What is the best AI visibility tool?`, yourRank: "Not ranked" },
        { question: `How do I track my brand in ChatGPT?`, yourRank: "You appear" },
        { question: `Is GeoIQ better than Semrush for AI?`, yourRank: "You appear" },
      ],
    });
    return;
  }

  try {
    // Query brand_perf cache for brand questions
    const [bpRow] = await db
      .select()
      .from(dataforseoCacheTable)
      .where(like(dataforseoCacheTable.key, `brand_perf_v2:${domain}%`))
      .orderBy(desc(dataforseoCacheTable.cachedAt))
      .limit(1);

    type BPData = {
      topQuestions?: Array<{ question: string; brandMentioned: boolean; yourRank: number; category: string }>;
      competitorData?: Array<{ name: string; shareOfVoice: number; sentiment: number; businessDrivers?: Array<{ driver: string; competitorFreq: number; yourFreq: number }> }>;
    };

    const bpData = (bpRow?.data ?? null) as BPData | null;
    const brandQuestions = (bpData?.topQuestions ?? []).slice(0, 10).map(q => ({
      question: q.question,
      yourRank: q.brandMentioned ? "You appear" : "Not ranked",
      category: q.category,
    }));

    // Extract "write these" from competitor data - drivers where competitor leads
    const writeThese: Array<{ topic: string; competitor: string; aiVolume: string }> = [];
    if (bpData?.competitorData) {
      for (const comp of bpData.competitorData.slice(0, 3)) {
        for (const driver of (comp.businessDrivers ?? [])) {
          if (driver.competitorFreq > driver.yourFreq) {
            writeThese.push({
              topic: driver.driver,
              competitor: comp.name,
              aiVolume: `${(driver.competitorFreq * 400).toLocaleString()}`,
            });
          }
        }
      }
    }

    // Query prompt research cache
    const [prRow] = await db
      .select()
      .from(dataforseoCacheTable)
      .where(like(dataforseoCacheTable.key, `%prompt%${domain}%`))
      .orderBy(desc(dataforseoCacheTable.cachedAt))
      .limit(1);

    // Query competitor research cache
    const [compRow] = await db
      .select()
      .from(dataforseoCacheTable)
      .where(like(dataforseoCacheTable.key, `%competitor%${domain}%`))
      .orderBy(desc(dataforseoCacheTable.cachedAt))
      .limit(1);

    type PRData = { topics?: Array<{ topic: string; aiVolume?: number; yourMentions?: number }> };
    const prData = (prRow?.data ?? null) as PRData | null;
    const improveThese = (prData?.topics ?? []).slice(0, 8).map(t => ({
      topic: t.topic,
      yourMentions: t.yourMentions ?? 1,
      aiVolume: t.aiVolume ? t.aiVolume.toLocaleString() : "N/A",
    }));

    const hasAnyData = brandQuestions.length > 0 || writeThese.length > 0 || improveThese.length > 0;

    res.json({
      isMock: false,
      hasAnyData,
      hasBrandPerf: bpRow != null,
      hasPromptResearch: prRow != null,
      hasCompetitorResearch: compRow != null,
      writeThese: writeThese.slice(0, 6),
      improveThese: improveThese.slice(0, 6),
      brandQuestions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load topics";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/content/analyses ───────────────────────────────────────────────────

router.get("/content/analyses", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    const rows = await db
      .select()
      .from(contentAnalysesTable)
      .where(eq(contentAnalysesTable.userId, userId))
      .orderBy(desc(contentAnalysesTable.analyzedAt))
      .limit(50);

    res.json({ analyses: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load analyses";
    res.status(500).json({ error: msg });
  }
});

export default router;
