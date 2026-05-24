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

function buildSections(html: string, domain: string): { name: string; text: string }[] {
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const sections: { name: string; text: string }[] = [];

  // Title tag
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleanHtml);
  const pageTitle = titleMatch ? stripHtml(titleMatch[1]).trim() : "";

  // Meta description
  const metaDesc = extractMetaContent(cleanHtml, "description");

  // OG title
  const ogTitle = extractMetaContent(cleanHtml, "title");

  // H1, H2, H3
  const h1s = extractTag(cleanHtml, "h1", 2);
  const h2s = extractTag(cleanHtml, "h2", 2).filter(t => t.split(/\s+/).length > 1);
  const h3s = extractTag(cleanHtml, "h3", 3).filter(t => t.split(/\s+/).length > 2);

  // Paragraphs - lower threshold to 6 words
  const ps = extractTag(cleanHtml, "p", 6)
    .filter(p => p.split(/\s+/).length >= 6)
    .slice(0, 12);

  // Also try list items, spans, and divs with meaningful content
  const lis = extractTag(cleanHtml, "li", 6).slice(0, 6);
  const spans = extractTag(cleanHtml, "span", 8).filter(s => s.split(/\s+/).length >= 8).slice(0, 4);

  // Build sections
  const headline = h1s[0] || ogTitle || pageTitle;
  if (headline) sections.push({ name: "Hero Headline", text: headline });

  if (metaDesc && metaDesc.split(/\s+/).length >= 5) {
    sections.push({ name: "Meta Description", text: metaDesc });
  }

  if (ps[0]) sections.push({ name: "Hero Description", text: ps[0] });

  h2s.slice(0, 2).forEach((t, i) => {
    const names = ["Main Value Proposition", "Key Feature Section"];
    sections.push({ name: names[i] ?? `Section ${i + 1}`, text: t });
  });

  ps.slice(1, 4).forEach((t, i) => {
    const names = ["Feature Description", "Benefits Section", "Social Proof / CTA"];
    sections.push({ name: names[i] ?? `Content Section ${i + 1}`, text: t });
  });

  h3s.slice(0, 2).forEach((t, i) => {
    sections.push({ name: `Supporting Claim ${i + 1}`, text: t });
  });

  if (sections.length < 3 && lis.length > 0) {
    const combined = lis.slice(0, 3).join(". ");
    sections.push({ name: "Key Benefits List", text: combined });
  }

  if (sections.length < 2 && spans.length > 0) {
    spans.slice(0, 2).forEach((t, i) => {
      sections.push({ name: `Value Statement ${i + 1}`, text: t });
    });
  }

  // Last resort: if we still have almost nothing, use title + domain + any text blobs
  if (sections.length === 0) {
    if (pageTitle) sections.push({ name: "Page Title", text: pageTitle });
    // Extract any text block from the whole body
    const bodyMatch = /<body[\s\S]*?>([\s\S]*?)<\/body>/i.exec(cleanHtml);
    if (bodyMatch) {
      const bodyText = stripHtml(bodyMatch[1]);
      const chunks = bodyText.split(/\.\s+/).filter(c => c.split(/\s+/).length >= 6).slice(0, 5);
      chunks.forEach((c, i) => {
        sections.push({ name: `Page Content ${i + 1}`, text: c.trim() });
      });
    }
  }

  // Deduplicate and cap
  const seen = new Set<string>();
  return sections
    .filter(s => {
      const key = s.text.trim().toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return s.text.trim().length > 0;
    })
    .slice(0, 7);
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

  const prompt = `You are a GEO (Generative Engine Optimization) expert. Analyze and improve these website content sections from "${domain}" to maximize visibility in AI search systems like ChatGPT, Gemini, and Perplexity.

For EACH section, produce:
1. An improved version that is more quotable, specific, and AI-extractable
2. One clear sentence explaining exactly why this change improves AI citation chances
3. Estimated citability score before and after (0-100)
4. Which EEAT signals are strengthened: Experience, Expertise, Authority, Trust

Improvement rules:
- Use question formats where natural
- Add specific numbers, named ingredients, or data points  
- Write conversationally, not corporately
- If the product serves India, mention specific Indian context
- Make every sentence AI-quotable in isolation
- Keep roughly the same length

Sections to improve:
${sections.map((s, i) => `${i + 1}. ${s.name}:\n"${s.text}"`).join("\n\n")}

Return ONLY valid JSON, no markdown:
{
  "readinessScore": <0-100>,
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
      "currentContent": "<exact original text>",
      "improvedContent": "<improved version>",
      "reason": "<one sentence explanation>",
      "citabilityBefore": <0-100>,
      "citabilityAfter": <0-100>,
      "eeat": [<one or more of: "Experience", "Expertise", "Authority", "Trust">]
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
