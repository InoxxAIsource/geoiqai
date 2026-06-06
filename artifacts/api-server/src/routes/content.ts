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
      "1/ 72% of users now start research with an AI tool. If your brand doesn't show up in ChatGPT, Gemini, or Perplexity, you're invisible to most of your potential customers.",
      "2/ Traditional SEO and AI visibility are different games. Google ranks pages by backlinks. AI systems cite pages by factual density and direct answers.",
      "3/ The #1 thing that gets pages cited in AI: answer the question directly in the first paragraph. AI models pull featured answers from the opening.",
      "4/ Add a FAQ section to every important page. Five or more Q&As dramatically improve citation rate.",
      "5/ Include verifiable statistics with sources. AI systems prefer citable numbers over vague claims every single time.",
      "6/ Use clear H2/H3 structure. Well-structured headings help AI understand what your content covers and which sections answer which queries.",
      "7/ The content loop that actually works: Write, score your AI visibility, fix the gaps, write better. Most brands skip the scoring step entirely.",
      "Free AI visibility scan at geoiqai.com - takes 30 seconds. Check where your brand actually stands.",
    ],
  },
  linkedin: {
    content: "Most startups don't realize they have an AI visibility problem.\n\nThey track their Google rankings. They monitor organic traffic. But they never ask: is my brand showing up when someone asks ChatGPT about our category?\n\n72% of users now start research with an AI tool. Not Google. AI.\n\nIf you're not getting cited in ChatGPT, Gemini, or Perplexity, you're invisible to most of your potential customers before they ever reach Google.\n\nThe fix is not complicated. It is about structured content:\n- Answer questions directly in the first paragraph\n- Add FAQ sections with 5+ questions\n- Include verifiable statistics with sources\n- Use clear H2/H3 headings\n- Define your entities and comparisons explicitly\n\nFree AI visibility scan at geoiqai.com - takes 30 seconds.\n\nWhat is your brand's AI visibility score?",
  },
  email: {
    subjects: [
      "Your brand might be invisible to AI right now",
      "72% of users search with AI first - is your brand showing up?",
      "The metric nobody is tracking (but should be)",
    ],
    previewText: "Getting cited in ChatGPT is the new page one ranking",
    body: "Hi there,\n\nQuick question: when someone asks ChatGPT or Gemini about tools in your category, does your brand show up?\n\nFor most startups, the answer is no - and they don't even know it.\n\n72% of users now start their research with an AI tool. If you're not being cited in those answers, you're losing customers before they ever reach your site.\n\nThe good news: it's fixable. FAQ sections, clear entity definitions, verifiable statistics - not a full site rebuild.\n\nGeoIQ tracks your AI visibility score across ChatGPT, Gemini, and Perplexity. Free scan at geoiqai.com shows where you stand in 30 seconds.",
    cta: "Check your AI visibility score - it's free",
    ps: "P.S. Most users find at least 3 quick wins in their first scan. Worth 30 seconds.",
  },
  reddit: {
    titles: [
      "How I got my startup showing up in ChatGPT answers (what actually worked)",
      "TIL your Google SEO ranking has almost nothing to do with AI visibility",
      "I tracked brand mentions in ChatGPT for 3 months - here's what the data shows",
    ],
    body: "Been working on AI visibility for a while and wanted to share what actually works.\n\nThe short version: getting cited in AI is about content structure, not backlinks. The two biggest wins:\n\n1. FAQ sections. Genuinely the highest ROI change for most pages. AI models love Q&A format.\n\n2. Direct answers in the first paragraph. If your opening doesn't answer the search intent, AI won't cite you.\n\nHappy to share more details on what we learned if useful.\n\nWhat has worked for you?",
  },
  producthunt: {
    tagline: "Track your brand's visibility in ChatGPT and Gemini",
    description: "GeoIQ is an AI visibility platform for startups. Run free audits to see how ChatGPT, Gemini, and Perplexity represent your brand, then fix the gaps with actionable recommendations.",
    firstComment: "Hey hunters! We built GeoIQ because we couldn't find an easy way to check if our startup was showing up in AI search results. The free scan takes 30 seconds and shows your score across all three major AI systems. Happy to answer any questions.",
  },
  hackernews: {
    title: "Show HN: GeoIQ - Track how ChatGPT and Gemini represent your brand",
    firstComment: "We built this after noticing our startup wasn't showing up in AI search results despite ranking well on Google. The tool runs automated queries across ChatGPT, Gemini, and Perplexity and scores your AI visibility on 10 factors. Free tier available.",
  },
  indiehackers: {
    title: "How we went from invisible in ChatGPT to showing up consistently",
    body: "Six months ago, GeoIQ wasn't showing up in any ChatGPT or Gemini responses about AI visibility tools.\n\nWe had decent Google SEO. Reasonable domain authority. But AI was ignoring us completely.\n\nAfter a lot of testing, we found the core issue: our content wasn't structured for AI citation. No FAQ sections. No inline statistics. No clear entity definitions.\n\nWe fixed those things. Within three weeks, we started showing up in AI responses.\n\nThat experience became the product. GeoIQ now scans any domain and gives you an AI visibility score across ChatGPT, Gemini, and Perplexity - plus the specific fixes that will improve your score.\n\nFree tier available at geoiqai.com.",
  },
  instagram: {
    content: "AI visibility is the new SEO.\n\nWhen someone asks ChatGPT about tools in your category, does your brand show up?\n\nFor most startups, the answer is no.\n\n72% of users now start research with AI tools. Not Google.\n\nHere's what actually gets you cited in AI answers:\n- Direct answers in your first paragraph\n- FAQ sections (5+ questions)\n- Verifiable statistics with sources\n- Clear H2/H3 structure\n\nFree AI visibility scan at geoiqai.com\n\n#AIvisibility #GEO #ChatGPT #startupmarketing",
  },
  linkedinarticle: {
    title: "Why Your Startup Is Invisible in ChatGPT (And How to Fix It)",
    content: "72% of users now start research with an AI tool. Not Google. AI.\n\nIf your brand isn't appearing in ChatGPT, Gemini, or Perplexity responses, you're invisible to most of your potential customers before they ever reach your website.\n\nThis is the AI visibility gap - and most startups don't even know they have it.\n\n## Why Traditional SEO Isn't Enough\n\nGoogle rewards backlinks and domain authority. AI systems reward factual density, clear entity definitions, and direct answers. A page can rank on page 2 of Google but still get cited regularly by ChatGPT.\n\n## What Actually Gets You Cited in AI\n\n**1. Answer the question in the first paragraph**\nAI models pull answers from the opening of a page. Bury the lead and you won't get cited.\n\n**2. Add a FAQ section**\nFive or more Q&As significantly improve citation rate.\n\n**3. Include verifiable statistics**\nA specific number with a source beats vague claims every time.\n\n**4. Use clear heading structure**\nH2/H3 headings help AI understand what your content covers.\n\n**5. Define your entities explicitly**\nState clearly what your product does, who it's for, and how it compares.\n\n## The Content Loop That Works\n\nWrite content, score your AI visibility, fix the gaps, write better.\n\nGeoIQ tracks your brand score across ChatGPT, Gemini, and Perplexity. Free scan at geoiqai.com.",
  },
};

router.post("/content/repurpose", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { content, domain, platforms } = req.body as {
    content?: string; domain?: string; platforms?: string[];
  };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
  if (!platforms?.length) { res.status(400).json({ error: "platforms is required" }); return; }

  if (process.env.DATAFORSEO_SANDBOX === "true") {
    const results: Record<string, unknown> = {};
    for (const p of platforms) {
      if (MOCK_REPURPOSE_RESULTS[p]) results[p] = MOCK_REPURPOSE_RESULTS[p];
    }
    res.json({ results, isMock: true });
    return;
  }

  const platformInstructions: Record<string, string> = {
    twitter: '"twitter": {"tweets": ["hook tweet (no thread word)", "1/ ...", ...8-12 tweets total, last has CTA, max 280 chars each]}',
    linkedin: '"linkedin": {"content": "150-300 words, bold hook first line, line breaks every 2-3 lines, question at end"}',
    linkedinarticle: '"linkedinarticle": {"title": "...", "content": "full article with H2/H3 headers, 600+ words"}',
    email: '"email": {"subjects": ["s1","s2","s3"], "previewText": "...", "body": "200-400 words", "cta": "button text", "ps": "PS line"}',
    instagram: '"instagram": {"content": "caption with line breaks, hashtags at end"}',
    reddit: '"reddit": {"titles": ["t1","t2","t3"], "body": "authentic self-post, no promotional language"}',
    producthunt: '"producthunt": {"tagline": "max 60 chars", "description": "max 260 chars", "firstComment": "maker comment"}',
    hackernews: '"hackernews": {"title": "Show HN: style title", "firstComment": "brief honest comment"}',
    indiehackers: '"indiehackers": {"title": "...", "body": "milestone/story format, genuine founder voice, 300-500 words"}',
  };

  const prompt = `Repurpose the following content for multiple social platforms.

Original content:
${content.slice(0, 4000)}

Brand/domain: ${domain ?? "the brand"}

Generate content for these platforms: ${platforms.join(", ")}

Return ONLY valid JSON (no markdown, no code blocks):
{
  ${platforms.map(p => platformInstructions[p] ?? `"${p}": {"content": "..."}`).join(",\n  ")}
}

Adapt tone and format for each platform. Be authentic.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const parsed = parseJSON<Record<string, unknown>>(raw);
    if (!parsed) { res.status(500).json({ error: "Failed to parse AI response" }); return; }
    res.json({ results: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Repurposing failed";
    res.status(500).json({ error: msg });
  }
});

export default router;

