import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import OpenAI from "openai";
import { db, dataforseoCacheTable, contentAnalysesTable } from "@workspace/db";

const xaiImages = new OpenAI({
  apiKey: process.env.XAI_API_KEY ?? "no-key",
  baseURL: "https://api.x.ai/v1",
});
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

  let sourceDomain = "";
  try { sourceDomain = new URL(normalizedUrl).hostname.replace(/^www\./, ""); } catch { sourceDomain = url.trim(); }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GeoIQ/1.0)" },
    });
    clearTimeout(timeout);

    if (!response.ok) { res.status(400).json({ error: `Could not fetch URL: HTTP ${response.status}` }); return; }

    const html = await response.text();

    // Remove non-content sections first
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "");

    // Try to extract main content block
    const mainMatch = stripped.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    const source = mainMatch ? mainMatch[1] : stripped;

    const text = source
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    const preview = text.slice(0, 100).trim();

    res.json({ content: text, preview, sourceDomain, charCount: text.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Could not fetch URL: ${msg}` });
  }
});

// ─── GET /api/content/proxy-image ────────────────────────────────────────────────

router.get("/content/proxy-image", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { url } = req.query as { url?: string };
  if (!url?.trim()) { res.status(400).json({ error: "url is required" }); return; }
  try {
    const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) { res.status(502).json({ error: "Could not fetch image" }); return; }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="tweet-image.${ext}"`);
    res.setHeader("Cache-Control", "no-store");
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download failed";
    res.status(500).json({ error: msg });
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

// ─── POST /api/content/write ─────────────────────────────────────────────────────

const MOCK_WRITTEN_ARTICLE = `# How to Improve Your AI Visibility

Getting cited in ChatGPT, Gemini, and Perplexity is the new version of ranking on page one. Here is what actually works.

## What Is AI Visibility?

AI visibility is how often your brand or content appears when someone asks an AI system about a topic in your space. When a user types "what are the best tools for tracking AI brand mentions?" into ChatGPT, the brands showing up have earned that placement through structured, factual content.

Key stat: 72% of users now start research with an AI tool, according to a 2025 BrightEdge survey.

## Why Traditional SEO Is Not Enough

Google ranks pages. AI systems cite sources. The criteria differ:

- Google rewards backlinks and domain authority
- AI systems reward factual density, clear entity definitions, and direct answers
- A page can rank on page 2 of Google but still get cited regularly by ChatGPT

## 5 Things That Get You Cited in AI

### 1. Answer the Question Directly in the First Paragraph

AI models pull answers from the opening of a page. If your introduction buries the main point, you will not get cited.

### 2. Add a FAQPage Section

Questions and answers map directly to how AI models retrieve information. Five or more Q&As significantly improve citation rate.

### 3. Include Verifiable Statistics

AI systems prefer content with numbers and sources. "68% of marketers use AI tools (BrightEdge 2025)" beats vague claims every time.

### 4. Use Clear H2/H3 Structure

Well-structured headings help AI models understand what your content covers and which sections answer which queries.

### 5. Define Your Entities Clearly

If you are a SaaS tool, explicitly state what you do, who you are for, and how you compare to alternatives. AI needs this context to cite you accurately.

## FAQ

**Q: How long does it take to improve AI visibility?**
A: Most pages see improvement within 2-4 weeks after implementing structural changes like FAQ sections and schema markup.

**Q: Does AI visibility affect organic SEO?**
A: Yes, positively. The same improvements that get you cited in AI also improve Google AI Overview appearances.

**Q: What is the best tool to check AI visibility?**
A: GeoIQ tracks your brand score across ChatGPT, Gemini, and Perplexity with weekly automated scans.

**Q: Is FAQPage schema required to rank in AI?**
A: Not required, but it significantly increases citation probability. It is the single highest-ROI change for most pages.

**Q: How many words does a page need to get cited in AI?**
A: Length matters less than structure and factual density. A 600-word page with clear answers often outperforms a 3,000-word wall of text.`;

router.post("/content/write", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { contentType, topic, targetKeyword, tone, wordCount } = req.body as {
    contentType?: string; topic?: string; targetKeyword?: string; tone?: string; wordCount?: string;
  };
  if (!topic?.trim()) { res.status(400).json({ error: "topic is required" }); return; }
  if (!targetKeyword?.trim()) { res.status(400).json({ error: "targetKeyword is required" }); return; }

  if (process.env.DATAFORSEO_SANDBOX === "true") {
    res.json({
      content: MOCK_WRITTEN_ARTICLE,
      metaTitle: "How to Improve AI Visibility in 2026 | GeoIQ",
      metaDescription: "Learn the 5 proven techniques to get your brand cited in ChatGPT, Gemini, and Perplexity. Includes FAQPage schema template and a practical checklist.",
      schema: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    { "@type": "Question", "name": "How long does it take to improve AI visibility?", "acceptedAnswer": { "@type": "Answer", "text": "Most pages see improvement within 2-4 weeks after implementing structural changes like FAQ sections and schema markup." } },\n    { "@type": "Question", "name": "What is the best tool to check AI visibility?", "acceptedAnswer": { "@type": "Answer", "text": "GeoIQ tracks your brand score across ChatGPT, Gemini, and Perplexity with weekly automated scans." } }\n  ]\n}\n</script>',
      suggestedLinks: [
        "how to add FAQPage schema markup",
        "AI visibility vs SEO - what is different in 2026",
        "how to measure AI brand mentions",
      ],
      isMock: true,
    });
    return;
  }

  const prompt = `You are a GEO content specialist. Write content optimized specifically for AI citation.

Every piece you write MUST include:
1. FAQPage-ready Q&A section (5 questions minimum)
2. At least 3 statistics with source attribution
3. Direct answer to the main query in first paragraph
4. Comparison or structured data where relevant
5. Clear entity definitions
6. Concise quotable statements under 30 words
7. Proper H1/H2/H3 hierarchy

Content type: ${contentType ?? "Blog post / Article"}
Topic: ${topic}
Target keyword: ${targetKeyword}
Tone: ${tone ?? "Professional"}
Length: approximately ${wordCount ?? "1000 words"}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "content": "# Title\\n\\nFull markdown content...",
  "metaTitle": "...",
  "metaDescription": "...",
  "schema": "<script type=\\"application/ld+json\\">...</script>",
  "suggestedLinks": ["related topic 1", "related topic 2", "related topic 3"]
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    type WriterResp = { content: string; metaTitle: string; metaDescription: string; schema: string; suggestedLinks: string[] };
    const parsed = parseJSON<WriterResp>(raw);
    if (!parsed) { res.status(500).json({ error: "Failed to parse AI response" }); return; }
    res.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/content/repurpose ─────────────────────────────────────────────────

const MOCK_REPURPOSE_RESULTS: Record<string, unknown> = {
  twitter: {
    tweets: [
      "AI visibility is the new SEO. Here is what actually moves the needle in 2026:",
      "72% of users now start research with an AI tool. If your brand doesn't show up in ChatGPT, Gemini, or Perplexity, you're invisible to most of your potential customers.",
      "Traditional SEO and AI visibility are different games. Google ranks pages by backlinks. AI systems cite pages by factual density and direct answers.",
      "The single biggest thing that gets pages cited in AI: answer the question directly in the first paragraph. AI models pull featured answers from the opening.",
      "Add a FAQ section to every important page. Five or more Q&As dramatically improve citation rate. Most brands skip this entirely.",
      "Include verifiable statistics with sources. AI systems prefer citable numbers over vague claims every single time.",
      "Use clear H2/H3 structure. Well-structured headings help AI understand what your content covers and which sections answer which queries.",
      "The content loop that actually works: Write, score your AI visibility, fix the gaps, write better. Free AI visibility scan at geoiqai.com - takes 30 seconds.",
    ],
    imagePlaceholder: true,
  },
  linkedin: {
    hook: "Most startups have an AI visibility problem and don't know it.",
    content: "Most startups have an AI visibility problem and don't know it.\n\nThey track Google rankings. They monitor organic traffic. But they never ask: is my brand showing up when someone asks ChatGPT about our category?\n\n72% of users now start research with an AI tool. Not Google. AI.\n\nIf you're not getting cited in ChatGPT, Gemini, or Perplexity, you're invisible to most of your potential customers before they ever reach Google.\n\nThe fix is not complicated. It's about structured content:\nAnswer questions directly in the first paragraph.\nAdd FAQ sections with 5+ questions.\nInclude verifiable statistics with sources.\nUse clear H2/H3 headings.\n\nFree AI visibility scan at geoiqai.com - takes 30 seconds.\n\nWhat is your brand's AI visibility score?\n\n#AIVisibility #GEO #SaaSMarketing",
    char_count: 612,
  },
  email: {
    subject: "Your brand might be invisible to AI right now",
    preview_text: "ChatGPT is the new search. Are you showing up?",
    content: "Quick question: when someone asks ChatGPT or Gemini about tools in your category, does your brand show up?\n\nFor most startups, the answer is no - and they don't even know it.\n\n72% of users now start their research with an AI tool. If you're not being cited in those answers, you're losing customers before they ever reach your site.\n\nThe good news: it's fixable. FAQ sections, clear entity definitions, verifiable statistics - not a full site rebuild.\n\nWhat to do this week:\nAdd a FAQ section to your top 3 pages (5+ questions each).\nRewrite your opening paragraphs to answer search intent directly.\nAdd at least one verifiable stat with a source on each page.\n\nGeoIQ tracks your AI visibility score across ChatGPT, Gemini, and Perplexity. Free scan at geoiqai.com shows where you stand in 30 seconds.",
  },
  reddit: {
    title: "How I got my startup showing up in ChatGPT answers (what actually worked)",
    content: "Been working on AI visibility for a while and wanted to share what actually works.\n\nThe short version: getting cited in AI is about content structure, not backlinks. The two biggest wins:\n\nFAQ sections. Genuinely the highest ROI change for most pages. AI models love Q&A format. We went from zero mentions to consistent citations within three weeks of adding proper FAQ sections.\n\nDirect answers in the first paragraph. If your opening doesn't answer the search intent, AI won't cite you. Most of our pages buried the lead - we rewrote the intros and saw an immediate improvement.\n\nOne thing that surprised me: Google ranking had almost no correlation with AI citation rate. We had pages on page 4 of Google getting cited regularly in ChatGPT.\n\nHappy to share more details on what we learned if useful.\n\nWhat has worked for you?",
    suggested_subreddits: ["r/SaaS", "r/marketing", "r/SEO"],
  },
  producthunt: {
    tagline: "See if ChatGPT recommends your brand in 60 seconds",
    description: "GeoIQ is an AI visibility platform for startups. Run free audits to see how ChatGPT, Gemini, and Perplexity represent your brand, then fix the gaps with actionable recommendations.\n\nMost startups are invisible in AI search without knowing it. Traditional SEO doesn't translate to AI citation. GeoIQ gives you a score across 10 factors that determine whether AI systems mention your brand, then tells you exactly what to fix.",
    first_comment: "Hey hunters! We built GeoIQ because we kept noticing our own startup wasn't showing up in AI search results despite ranking okay on Google. Turns out AI citation and Google ranking are almost completely unrelated. The free scan takes 30 seconds and shows your score across ChatGPT, Gemini, and Perplexity. Happy to answer any questions about how we measure AI visibility.",
    topics: ["Artificial Intelligence", "Marketing", "SEO"],
  },
  hackernews: {
    title: "Show HN: GeoIQ - Track how ChatGPT and Gemini represent your brand",
    comment: "We built this after noticing our startup wasn't showing up in AI search results despite ranking well on Google. The tool runs automated queries across ChatGPT, Gemini, and Perplexity and scores your AI visibility on 10 factors including factual density, entity clarity, and FAQ coverage.\n\nStack: React + Vite frontend, Express API, PostgreSQL, Drizzle ORM. AI calls go through OpenAI-compatible endpoints.\n\nCurrent limitations: we simulate Gemini and Perplexity via the OpenAI API - real multi-AI comparison requires separate API keys we haven't fully productized yet.\n\nWould love feedback on the scoring methodology. Free tier available at geoiqai.com.",
  },
  indiehackers: {
    title: "How we went from invisible in ChatGPT to showing up consistently",
    content: "Six months ago, GeoIQ wasn't showing up in any ChatGPT or Gemini responses about AI visibility tools.\n\nWe had decent Google SEO. Reasonable domain authority. But AI was ignoring us completely.\n\nAfter a lot of testing, we found the core issue: our content wasn't structured for AI citation. No FAQ sections. No inline statistics. No clear entity definitions.\n\nWe fixed those things. Within three weeks, we started showing up in AI responses.\n\nCurrent numbers: 40 paying users, about 600 monthly active on the free tier. MRR is small but growing week over week.\n\nThe hardest part was explaining the problem to potential customers. Most founders don't even know they have an AI visibility gap. That's still our biggest challenge.\n\nHappy to answer questions about what worked or what we'd do differently.\n\nWhat's your experience with AI visibility for your own products?",
  },
  instagram: {
    hook: "AI visibility is the new SEO - and most brands are failing at it.",
    caption: "AI visibility is the new SEO - and most brands are failing at it.\n\nWhen someone asks ChatGPT about tools in your category, does your brand show up?\n\nFor most startups, the answer is no.\n\n72% of users now start research with AI tools. Not Google.\n\nHere's what actually gets you cited in AI answers:\nDirect answers in your first paragraph.\nFAQ sections (5+ questions per page).\nVerifiable statistics with sources.\nClear heading structure.\n\nFree AI visibility scan at geoiqai.com - takes 30 seconds.",
    hashtags: ["AIvisibility", "GEO", "ChatGPT", "startupmarketing", "SaaS", "contentmarketing", "SEO", "AIsearch", "digitalmarketing", "growthhacking", "startuptips", "marketingstrategy", "indiehackers", "buildinpublic", "founders"],
  },
  linkedinarticle: {
    title: "Why Your Startup Is Invisible in ChatGPT (And How to Fix It in 3 Steps)",
    subtitle: "AI citation and Google ranking are almost entirely unrelated - here's what actually matters",
    content: "72% of users now start research with an AI tool. Not Google. AI.\n\nIf your brand isn't appearing in ChatGPT, Gemini, or Perplexity responses, you're invisible to most of your potential customers before they ever reach your website.\n\nThis is the AI visibility gap - and most startups don't even know they have it.\n\nTL;DR: Getting cited in AI requires factual density, FAQ sections, and direct answers - not backlinks. You can fix this without rebuilding your site.\n\nWhy Traditional SEO Isn't Enough\n\nGoogle rewards backlinks and domain authority. AI systems reward factual density, clear entity definitions, and direct answers. A page can rank on page 2 of Google but still get cited regularly by ChatGPT. The two systems are measuring completely different things.\n\nStep 1: Answer the Question in the First Paragraph\n\nAI models pull answers from the opening of a page. If your first paragraph doesn't directly address the search intent, AI won't cite you - no matter how good the rest of the content is. Rewrite your top pages to lead with the answer.\n\nStep 2: Add a FAQ Section\n\nFive or more Q&As significantly improve citation rate. AI systems are trained on Q&A data and actively look for structured question-answer pairs. This is the single highest-ROI change for most pages.\n\nStep 3: Include Verifiable Statistics\n\nA specific number with a source beats vague claims every time. AI systems prefer citable facts. Add one stat with a source to every important section.\n\nKey Takeaways\n\nAI citation and Google ranking are almost entirely unrelated.\nFAQ sections are the single highest-ROI improvement for AI visibility.\nThe opening paragraph determines whether AI cites your page.\nSpecific numbers with sources outperform vague claims.\nGeoIQ tracks your brand score across ChatGPT, Gemini, and Perplexity. Free scan at geoiqai.com.",
  },
};

router.post("/content/repurpose", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { content, domain, platforms } = req.body as {
    content?: string; domain?: string; platforms?: string[];
  };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
  if (!platforms?.length) { res.status(400).json({ error: "platforms is required" }); return; }

  const isPayingUser = req.user && req.user.plan !== "free";

  // Auto-fetch if content looks like a URL or bare domain (no spaces, short)
  let processedContent = content.trim();
  const looksLikeUrl = processedContent.length < 200 && !/\s/.test(processedContent) &&
    (/^https?:\/\//i.test(processedContent) || /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(processedContent));
  if (looksLikeUrl) {
    try {
      const fetchUrl = /^https?:\/\//i.test(processedContent) ? processedContent : `https://${processedContent}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GeoIQ/1.0)" },
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const html = await resp.text();
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "");
        const mainMatch = stripped.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
        const source = mainMatch ? mainMatch[1] : stripped;
        const text = source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
        if (text.length > 100) processedContent = text;
      }
    } catch {
      // fall through - use original content as best effort
    }
  }

  if (process.env.DATAFORSEO_SANDBOX === "true" && !isPayingUser) {
    const results: Record<string, unknown> = {};
    for (const p of platforms) {
      if (MOCK_REPURPOSE_RESULTS[p]) results[p] = MOCK_REPURPOSE_RESULTS[p];
    }
    res.json({ results, isMock: true });
    return;
  }

  const platformInstructions: Record<string, string> = {
    twitter: `"twitter": {"tweets": ["hook tweet - bold specific claim, max 240 chars", "tweet 2 max 240 chars", "tweet 3 max 240 chars", "tweet 4 max 240 chars", "tweet 5 max 240 chars", "tweet 6 max 240 chars", "tweet 7 max 240 chars", "CTA tweet with geoiqai.com max 240 chars"], "imagePrompt": "professional lifestyle photo relevant to topic, no text in image, bright and clean"}`,
    linkedin: `"linkedin": {"hook": "first line that stops the scroll - bold counterintuitive claim", "content": "150-300 word post starting with the hook, line breaks every 2-3 lines, one specific stat, ends with a question, max 3 hashtags at end", "char_count": 0}`,
    linkedinarticle: `"linkedinarticle": {"title": "specific title with a number", "subtitle": "one line subtitle", "content": "600-900 word article, TL;DR after intro, 3-4 sections with plain text section headers (no ## symbols), Key Takeaways bullet list at end written as plain sentences one per line"}`,
    email: `"email": {"subject": "max 50 chars specific benefit no emoji", "preview_text": "40 chars completing the subject thought", "content": "300-500 word email body: opening hook sentence, what is happening section, why it matters section, what to do section with 3 action items written as plain sentences one per line, CTA line at end"}`,
    instagram: `"instagram": {"hook": "first line under 125 chars to make user tap more", "caption": "100-150 word body with single-line breaks for rhythm, no hashtags in body", "hashtags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13","tag14","tag15"]}`,
    reddit: `"reddit": {"title": "honest question or observation format, no marketing language", "content": "200-400 words authentic story with real numbers, no promotional language, ends with genuine question to community", "suggested_subreddits": ["r/sub1","r/sub2","r/sub3"]}`,
    producthunt: `"producthunt": {"tagline": "verb-led specific benefit max 60 chars", "description": "200-250 word description: problem then solution then 3 key features as plain sentences", "first_comment": "150-200 word genuine founder story: why you built this and what you learned", "topics": ["Topic1","Topic2","Topic3"]}`,
    hackernews: `"hackernews": {"title": "Show HN: technical honest title", "comment": "150-200 words: what it does one sentence, how it works technically with stack, what you learned, current limitations honest, what feedback you want"}`,
    indiehackers: `"indiehackers": {"title": "milestone or genuine question title", "content": "300-500 words: personal story of problem noticed, what you built and why, what is working with real numbers, what you are struggling with honest, question for community"}`,
  };

  const systemPrompt = `You are an expert content strategist who writes platform-native, AI-optimized content.
AI-optimized means: factual claims, direct answers, specific numbers, clear structure.
Never use dashes, em dashes, markdown headers, asterisks, or bullet points in any content field.
Use plain sentences and line breaks only. For lists, write each item on its own line with no prefix character.
Return ONLY raw JSON. No markdown. No backticks. No explanation. No preamble.`;

  const prompt = `Repurpose the following content for social platforms.

Brand/company: ${domain ?? "the brand"}

Content to repurpose:
---
${processedContent.slice(0, 3000)}
---

Generate content for: ${platforms.join(", ")}

Rules:
- Pull specific claims, stats, and product details from the content above when available
- For Twitter: first-person founder voice, each tweet max 240 chars, no numbering prefix on tweets
- Always return valid JSON regardless of how much content is provided
- If content is limited, write reasonable founder-voice content based on context clues

Return ONLY valid JSON (no markdown, no code blocks, no explanation):
{
  ${platforms.map(p => platformInstructions[p] ?? `"${p}": {"content": "..."}`).join(",\n  ")}
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    req.log.info({ rawLen: raw.length, rawPreview: raw.slice(0, 400) }, "repurpose: claude raw");
    const parsed = parseJSON<Record<string, unknown>>(raw);
    if (!parsed) {
      req.log.error({ raw: raw.slice(0, 800) }, "repurpose: JSON parse failed");
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    // Generate DALL-E image for Twitter if imagePrompt was returned
    if (parsed.twitter && typeof parsed.twitter === "object") {
      const tw = parsed.twitter as Record<string, unknown>;
      const imagePrompt = tw.imagePrompt as string | undefined;
      delete tw.imagePrompt;
      req.log.info({ imagePrompt: imagePrompt ?? "MISSING" }, "repurpose: image generation");
      if (imagePrompt) {
        try {
          const imgResp = await xaiImages.images.generate({
            model: "grok-imagine-image",
            prompt: imagePrompt,
            n: 1,
          });
          const imgUrl = imgResp.data?.[0]?.url;
          req.log.info({ imgUrl: imgUrl ?? "NONE", dataLen: imgResp.data?.length }, "repurpose: image result");
          if (imgUrl) {
            tw.imageUrl = imgUrl;
            // Fetch and base64-encode immediately - xAI URLs expire within minutes
            try {
              const imgFetch = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
              if (imgFetch.ok) {
                const buf = await imgFetch.arrayBuffer();
                tw.imageData = Buffer.from(buf).toString("base64");
                tw.imageMime = imgFetch.headers.get("content-type") ?? "image/jpeg";
              }
            } catch (fetchErr) {
              req.log.warn({ err: fetchErr instanceof Error ? fetchErr.message : String(fetchErr) }, "repurpose: image base64 fetch failed");
            }
          }
        } catch (imgErr) {
          req.log.error({ err: imgErr instanceof Error ? imgErr.message : String(imgErr) }, "repurpose: dall-e failed");
        }
      }
    }

    res.json({ results: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Repurposing failed";
    res.status(500).json({ error: msg });
  }
});

export default router;

