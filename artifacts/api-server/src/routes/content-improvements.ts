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
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.length > 8 && text.length < 1200) {
      matches.push(text);
    }
  }
  return [...new Set(matches)];
}

function buildSections(html: string): { name: string; text: string }[] {
  const h1s = extractTag(html, "h1");
  const h2s = extractTag(html, "h2").filter(t => t.split(" ").length > 1);
  const ps = extractTag(html, "p")
    .filter(p => p.split(" ").length >= 15)
    .slice(0, 10);

  const sections: { name: string; text: string }[] = [];

  if (h1s[0]) sections.push({ name: "Hero Headline", text: h1s[0] });
  if (ps[0]) sections.push({ name: "Hero Description", text: ps[0] });
  h2s.slice(0, 3).forEach((t, i) => {
    const names = ["Main Value Proposition", "Key Feature Section", "Secondary Feature Section"];
    sections.push({ name: names[i] ?? `Section ${i + 1}`, text: t });
  });
  ps.slice(1, 4).forEach((t, i) => {
    const names = ["Feature Description", "Benefits Section", "Social Proof / CTA"];
    sections.push({ name: names[i] ?? `Content Section ${i + 1}`, text: t });
  });

  return sections
    .filter(s => s.text.trim().length > 0)
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

  const sections = buildSections(html);

  if (sections.length === 0) {
    res.status(422).json({ error: "No content sections detected on the homepage." });
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
