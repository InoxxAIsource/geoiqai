import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import OpenAI from "openai";

const router = Router();

const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const xaiClient = process.env.XAI_API_KEY
  ? new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" })
  : null;

const aiClient = xaiClient ?? openaiClient;
const aiModel = xaiClient ? "grok-3-fast-beta" : "gpt-4o-mini";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAttr(html: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = regex.exec(html);
  return m ? m[1].trim() : "";
}

function extractMetaContent(html: string, nameValue: string): string {
  // Handles any attribute order: <meta name="x" content="y"> or <meta content="y" name="x">
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${nameValue}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)[^>]*name=["']${nameValue}["']`, "i"),
    new RegExp(`<meta[^>]*property=["']og:${nameValue}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)[^>]*property=["']og:${nameValue}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1].trim().length > 5) return m[1].trim();
  }
  return "";
}

function extractTag(html: string, tag: string, minWords = 3, maxLen = 1200): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= minWords && text.length < maxLen && text.length > 10) {
      matches.push(text);
    }
  }
  return [...new Set(matches)];
}

function buildSections(html: string, _domain: string): { name: string; text: string }[] {
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const candidates: { priority: number; name: string; text: string }[] = [];

  // --- Title tag (priority 1) ---
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleanHtml);
  const pageTitle = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
  if (pageTitle) candidates.push({ priority: 1, name: "Page Title", text: pageTitle });

  // --- Meta description (priority 1) ---
  const metaDesc = extractMetaContent(cleanHtml, "description");
  if (metaDesc && metaDesc.split(/\s+/).length >= 4)
    candidates.push({ priority: 1, name: "Meta Description", text: metaDesc });

  // --- OG description (priority 2) ---
  const ogDesc = extractMetaContent(cleanHtml, "og:description") || extractMetaContent(cleanHtml, "description");
  const ogTitle = extractMetaContent(cleanHtml, "og:title") || extractMetaContent(cleanHtml, "title");
  if (ogTitle && ogTitle !== pageTitle && ogTitle.split(/\s+/).length >= 3)
    candidates.push({ priority: 2, name: "OG Title", text: ogTitle });

  // --- Headings (priority 2-3) ---
  const h1s = extractTag(cleanHtml, "h1", 2);
  const h2s = extractTag(cleanHtml, "h2", 2);
  const h3s = extractTag(cleanHtml, "h3", 3);

  h1s.slice(0, 2).forEach((t, i) => candidates.push({ priority: 2, name: i === 0 ? "Hero Headline" : "Secondary Headline", text: t }));
  h2s.slice(0, 4).forEach((t, i) => {
    const names = ["Main Value Proposition", "Key Feature Section", "Secondary Feature", "Supporting Headline"];
    candidates.push({ priority: 3, name: names[i] ?? `Section ${i + 1}`, text: t });
  });
  h3s.slice(0, 3).forEach((t, i) => candidates.push({ priority: 4, name: `Supporting Point ${i + 1}`, text: t }));

  // --- Paragraphs (priority 3) - lower threshold to 5 words ---
  const ps = extractTag(cleanHtml, "p", 5).slice(0, 10);
  ps.slice(0, 6).forEach((t, i) => {
    const names = ["Hero Description", "Feature Description", "Benefits Section", "Social Proof", "About Section", "CTA Copy"];
    candidates.push({ priority: 3, name: names[i] ?? `Paragraph ${i + 1}`, text: t });
  });

  // --- List items joined (priority 4) ---
  const lis = extractTag(cleanHtml, "li", 4).slice(0, 8);
  if (lis.length >= 2) {
    const bullets = lis.slice(0, 4).join(" | ");
    candidates.push({ priority: 4, name: "Key Benefits List", text: bullets });
  }
  lis.slice(0, 3).forEach((t, i) => candidates.push({ priority: 5, name: `Feature Point ${i + 1}`, text: t }));

  // --- Blockquotes / testimonials (priority 3) ---
  const quotes = extractTag(cleanHtml, "blockquote", 5);
  quotes.slice(0, 2).forEach((t, i) => candidates.push({ priority: 3, name: `Testimonial ${i + 1}`, text: t }));

  // --- Strong / em tags with enough words (priority 5) ---
  const strongs = extractTag(cleanHtml, "strong", 5).filter(s => s.split(/\s+/).length >= 5);
  strongs.slice(0, 2).forEach((t, i) => candidates.push({ priority: 5, name: `Key Claim ${i + 1}`, text: t }));

  // --- Body text fallback - extract sentence chunks (priority 6) ---
  const bodyMatch = /<body[\s\S]*?>([\s\S]*?)<\/body>/i.exec(cleanHtml);
  if (bodyMatch) {
    const bodyText = stripHtml(bodyMatch[1]);
    const chunks = bodyText
      .split(/(?<=[.!?])\s+/)
      .map(c => c.trim())
      .filter(c => c.split(/\s+/).length >= 7 && c.split(/\s+/).length <= 60 && c.length > 30);
    const unique = [...new Set(chunks)].slice(0, 8);
    unique.forEach((c, i) => candidates.push({ priority: 6, name: `Page Content ${i + 1}`, text: c }));
  }

  // --- Deduplicate by content similarity, sort by priority, cap at 10 ---
  const seen = new Set<string>();
  const deduped = candidates
    .sort((a, b) => a.priority - b.priority)
    .filter(s => {
      const key = s.text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      if (seen.has(key) || s.text.trim().length < 10) return false;
      seen.add(key);
      return true;
    });

  return deduped.slice(0, 10).map(({ name, text }) => ({ name, text }));
}

router.post("/content-improvements/analyze", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  if (user.plan === "free") {
    res.status(403).json({ error: "Content Improvements requires a paid plan. Upgrade to Starter or Agency." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  let html = "";
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GeoIQ/1.0; +https://geoiqai.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    html = await resp.text();
  } catch (err) {
    req.log.warn({ err, domain }, "failed to fetch homepage for content analysis");
    res.status(422).json({
      error: "Could not fetch the homepage. Make sure the domain is publicly accessible.",
    });
    return;
  }

  const sections = buildSections(html, domain);

  if (sections.length === 0) {
    res.status(422).json({
      error: "Could not extract readable content from this homepage. The site may be fully JavaScript-rendered (React, Next.js SPA) with no static HTML. Try a blog post URL or a page with static content.",
    });
    return;
  }

  const extractedCount = sections.length;
  const prompt = `You are a GEO (Generative Engine Optimization) expert. Your job is to help "${domain}" get cited more often by AI systems like ChatGPT, Gemini, and Perplexity.

You have been given ${extractedCount} content section(s) extracted from the site's homepage. You must produce a TOTAL of 7 improvement entries:
- Improve ALL ${extractedCount} extracted section(s) listed below
- Then add ${Math.max(0, 7 - extractedCount)} NEW recommended sections that the site is MISSING but should add to dramatically improve AI citability (e.g. an FAQ section, a "What is X?" explainer, a specific stats/numbers section, a founder story, a how-it-works section, customer proof with specifics, etc.)

For every section (both improved and new), produce:
1. currentContent: the original text (for new sections, write "[Missing - recommended addition]")
2. improvedContent: a well-written version optimized for AI citation
3. reason: one sentence explaining exactly why this improves AI citation chances
4. citabilityBefore: estimated score 0-100 (new missing sections start at 0)
5. citabilityAfter: estimated score 0-100 after the improvement
6. eeat: which of Experience, Expertise, Authority, Trust are strengthened

Writing rules for improved/new content:
- Use specific numbers, named cities, data points wherever possible
- Write in plain conversational language, not corporate-speak
- Make every sentence independently quotable and extractable
- Use question-answer format for FAQ-style sections
- If the site serves India, include specific Indian context (city names, INR, local market)
- Keep improved versions at a similar length to originals; new sections 1-3 sentences

Extracted sections to improve:
${sections.map((s, i) => `${i + 1}. ${s.name}:\n"${s.text}"`).join("\n\n")}

Return ONLY valid JSON, no markdown fences:
{
  "readinessScore": <0-100 overall AI readiness score>,
  "categoryScores": {
    "contentQuality": <0-100>,
    "authoritySignals": <0-100>,
    "technicalStructure": <0-100>,
    "engagementSignals": <0-100>
  },
  "sections": [
    {
      "id": "s1",
      "name": "<section name>",
      "currentContent": "<original text or [Missing - recommended addition]>",
      "improvedContent": "<optimized version>",
      "reason": "<one sentence>",
      "citabilityBefore": <0-100>,
      "citabilityAfter": <0-100>,
      "eeat": ["Experience"|"Expertise"|"Authority"|"Trust"]
    }
  ]
}`;

  try {
    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.65,
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      req.log.error({ raw }, "AI returned invalid JSON for content improvements");
      res.status(500).json({ error: "AI returned an unexpected response. Please try again." });
      return;
    }

    res.json({
      domain,
      analyzedAt: new Date().toISOString(),
      ...parsed,
    });
  } catch (err) {
    req.log.error({ err }, "AI content improvement generation failed");
    res.status(500).json({ error: "AI generation failed. Please try again in a moment." });
  }
});

export default router;
