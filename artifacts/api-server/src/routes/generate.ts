import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

function extractJsonFromScriptTag(scriptTag: string): Record<string, unknown> | null {
  try {
    const match = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const raw = match ? match[1].trim() : scriptTag.trim();
    const parsed = JSON.parse(raw);
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

const aiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 30000,
  maxRetries: 1,
});

async function fetchDomainContent(domain: string): Promise<string> {
  try {
    const resp = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "GeoIQ-Generator/1.0 (+https://geoiqai.com)" },
      redirect: "follow",
    });
    if (!resp.ok) return "";
    const html = await resp.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
  } catch {
    return "";
  }
}

// ─── llms.txt generator ────────────────────────────────────────────────────────
router.post("/generate/llmstxt", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  logger.info({ domain }, "generate/llmstxt: starting");
  const content = await fetchDomainContent(domain);

  try {
    const completion = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: "You generate llms.txt files for websites. Return plain text only - no markdown code blocks, no backticks, no explanation. Just the file content.",
        },
        {
          role: "user",
          content: `Generate an llms.txt file for ${domain}.${content ? `\n\nHomepage content: ${content}` : ""}

Format:
# Brand Name - Short Tagline
> One or two sentences describing what the company does.

## Key Topics
- Topic 1
- Topic 2
- Topic 3

## Products and Services
- Product or service 1
- Product or service 2

## About
One paragraph about the company, its mission, and who it serves.

## Contact
- Website: https://${domain}

Keep it under 400 words. Write in plain, factual prose - not marketing speak.`,
        },
      ],
    });

    const output = completion.choices[0]?.message?.content ?? "";
    res.json({ content: output, filename: "llms.txt" });
  } catch (err) {
    logger.error({ err, domain }, "generate/llmstxt failed");
    res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

// ─── Organization schema generator ────────────────────────────────────────────
router.post("/generate/org-schema", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  logger.info({ domain }, "generate/org-schema: starting");
  const content = await fetchDomainContent(domain);

  try {
    const completion = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: "You generate Organization JSON-LD schema markup. Return only the complete <script> tag with valid JSON-LD inside. No explanation, no markdown, no code blocks.",
        },
        {
          role: "user",
          content: `Generate Organization schema markup for ${domain}.${content ? `\n\nHomepage content: ${content}` : ""}

Include: name, url, description, sameAs (social profiles if you can infer them), and any other relevant fields.
Return the complete <script type="application/ld+json"> tag ready to paste into <head>.
Use real values where you can infer them. Leave out fields you cannot reasonably infer.`,
        },
      ],
    });

    const output = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonFromScriptTag(output);
    const fieldCandidates: Array<{ label: string; value: string | undefined }> = parsed ? [
      { label: "Name", value: parsed.name as string },
      { label: "URL", value: parsed.url as string },
      { label: "Type", value: parsed["@type"] as string },
      { label: "Description", value: (parsed.description as string)?.slice(0, 150) },
      { label: "Founded", value: parsed.foundingDate as string },
      { label: "Location", value: typeof parsed.address === "string" ? parsed.address as string : (parsed.address as Record<string, string>)?.addressLocality },
    ] : [];
    const fields = fieldCandidates.filter((f): f is { label: string; value: string } => typeof f.value === "string" && f.value.length > 0);
    res.json({ code: output, fields });
  } catch (err) {
    logger.error({ err, domain }, "generate/org-schema failed");
    res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

// ─── FAQ schema generator ──────────────────────────────────────────────────────
router.post("/generate/faq-schema", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  logger.info({ domain }, "generate/faq-schema: starting");
  const content = await fetchDomainContent(domain);

  try {
    const completion = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1100,
      messages: [
        {
          role: "system",
          content: "You generate FAQPage JSON-LD schema markup. Return only the complete <script> tag with valid JSON-LD inside. No explanation, no markdown, no code blocks.",
        },
        {
          role: "user",
          content: `Generate FAQPage schema markup for ${domain}.${content ? `\n\nHomepage content: ${content}` : ""}

Create 5 realistic FAQ questions that a user would actually ask about this brand or product.
Write clear, direct answers (2-4 sentences each).
Return the complete <script type="application/ld+json"> tag ready to paste into the page.`,
        },
      ],
    });

    const output = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonFromScriptTag(output);
    let questions: Array<{ name: string; answer: string }> = [];
    if (parsed) {
      const entities = (parsed.mainEntity ?? (parsed["@graph"] as Array<Record<string, unknown>>)?.[0]?.mainEntity ?? []) as Array<Record<string, unknown>>;
      questions = entities
        .map((q) => ({
          name: (q.name as string) ?? "",
          answer: ((q.acceptedAnswer as Record<string, string>)?.text) ?? "",
        }))
        .filter((q) => q.name && q.answer);
    }
    res.json({ code: output, questions });
  } catch (err) {
    logger.error({ err, domain }, "generate/faq-schema failed");
    res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

// ─── robots.txt generator (static, no AI needed) ──────────────────────────────
router.post("/generate/robots", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const content = `User-agent: *
Allow: /

# AI crawlers - explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: https://${domain}/sitemap.xml`;

  res.json({ content, filename: "robots.txt" });
});

export default router;
