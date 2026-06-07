import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import OpenAI from "openai";
import Exa from "exa-js";

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

function getExa(): Exa | null {
  if (!process.env.EXA_API_KEY) return null;
  return new Exa(process.env.EXA_API_KEY);
}

// Simple in-memory cache (24h TTL) to protect Exa free-tier limits
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "").split(".")[0] ?? "unknown";
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch { return "Unknown"; }
}

// ─── POST /api/ai-pr/find-journalists ─────────────────────────────────────────

router.post("/api/ai-pr/find-journalists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();
  if (!exa) {
    res.status(503).json({ error: "EXA_API_KEY not configured. Add it to Replit Secrets." });
    return;
  }

  const { topic } = req.body as { topic?: string };
  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const cacheKey = `journalists:${topic.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json({ success: true, cached: true, journalists: cached }); return; }

  try {
    const articleResults = await exa.search(
      `${topic} journalist article 2025 2026`,
      {
        type: "auto",
        numResults: 20,
        category: "news",
        startPublishedDate: "2025-01-01",
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      }
    );

    const authorMap: Record<string, {
      name: string;
      publication: string;
      articles: { title: string; url: string; date: string | null | undefined; snippet: string }[];
    }> = {};

    for (const result of articleResults.results) {
      if (!result.author) continue;
      const author = result.author.trim();
      if (!authorMap[author]) {
        authorMap[author] = { name: author, publication: extractDomain(result.url), articles: [] };
      }
      authorMap[author]!.articles.push({
        title: result.title ?? "",
        url: result.url,
        date: result.publishedDate,
        snippet: (result.highlights as string[] | undefined)?.[0] ?? "",
      });
    }

    const top = Object.values(authorMap).slice(0, 10);

    const journalists = await Promise.all(
      top.map(async (journalist) => {
        try {
          const profileResults = await exa.search(
            `${journalist.name} journalist writer ${journalist.publication}`,
            {
              type: "auto",
              numResults: 3,
              category: "people",
              contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
            }
          );

          const profileText = profileResults.results
            .map(r => (r.highlights as string[] | undefined)?.join(" ") ?? "")
            .join(" ");

          const twitterMatch = profileText.match(/@([a-zA-Z0-9_]+)/);
          const linkedinResult = profileResults.results.find(r => r.url?.includes("linkedin.com"));

          return {
            ...journalist,
            article_count: journalist.articles.length,
            twitter: twitterMatch ? `@${twitterMatch[1]}` : null,
            linkedin_url: linkedinResult?.url ?? null,
            profile_snippet: (profileResults.results[0]?.highlights as string[] | undefined)?.[0] ?? null,
          };
        } catch {
          return { ...journalist, article_count: journalist.articles.length, twitter: null, linkedin_url: null, profile_snippet: null };
        }
      })
    );

    const result = journalists.filter(j => j.articles.length > 0);
    setCached(cacheKey, result);
    res.json({ success: true, cached: false, journalists: result });
  } catch (err: unknown) {
    req.log.error({ err }, "journalist finder error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

// ─── POST /api/ai-pr/monitor-coverage ─────────────────────────────────────────

router.post("/api/ai-pr/monitor-coverage", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();
  if (!exa) {
    res.status(503).json({ error: "EXA_API_KEY not configured. Add it to Replit Secrets." });
    return;
  }

  const { brand, competitor } = req.body as { brand?: string; competitor?: string };
  if (!brand || !competitor) { res.status(400).json({ error: "brand and competitor are required" }); return; }

  const cacheKey = `coverage:${brand.toLowerCase().trim()}:${competitor.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json({ success: true, cached: true, ...(cached as object) }); return; }

  try {
    const [brandMentions, competitorMentions, similarSites] = await Promise.all([
      exa.search(`${brand} AI visibility tool review`, {
        type: "auto", numResults: 10, category: "news", startPublishedDate: "2025-06-01",
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }),
      exa.search(`${competitor} AI SEO tool review mention`, {
        type: "auto", numResults: 10, category: "news", startPublishedDate: "2025-06-01",
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }),
      exa.findSimilar("https://geoiqai.com", {
        numResults: 10,
        contents: { highlights: { numSentences: 2 } },
      }),
    ]);

    const opportunities = competitorMentions.results
      .filter(article => {
        const fullText = [article.title ?? "", ...((article.highlights as string[] | undefined) ?? [])].join(" ").toLowerCase();
        return !fullText.includes(brand.toLowerCase());
      })
      .map(article => ({ ...article, opportunity: true, note: `${competitor} mentioned but not ${brand}` }));

    const result = {
      brand_mentions: brandMentions.results,
      competitor_mentions: competitorMentions.results,
      opportunities,
      similar_sites: similarSites.results,
    };

    setCached(cacheKey, result);
    res.json({ success: true, cached: false, ...result });
  } catch (err: unknown) {
    req.log.error({ err }, "coverage monitor error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

// ─── POST /api/ai-pr/generate-pitch ───────────────────────────────────────────

router.post("/api/ai-pr/generate-pitch", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();

  const { journalistName, publication, articleUrl, pitchAngle, keyMessage } = req.body as {
    journalistName?: string;
    publication?: string;
    articleUrl?: string;
    pitchAngle?: string;
    keyMessage?: string;
  };

  if (!journalistName || !publication) {
    res.status(400).json({ error: "journalistName and publication are required" });
    return;
  }

  let recentWork = "";

  if (exa && articleUrl) {
    try {
      const articleContent = await exa.search(
        `${journalistName} ${publication} recent articles AI SEO GEO search`,
        {
          type: "auto",
          numResults: 3,
          category: "news",
          contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
        }
      );
      recentWork = articleContent.results
        .map(r => `Title: ${r.title ?? ""}\nExcerpt: ${((r.highlights as string[] | undefined) ?? []).join(" ")}`)
        .join("\n\n");
    } catch { /* skip if lookup fails */ }
  }

  try {
    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a PR specialist for B2B SaaS. Return ONLY raw JSON. No markdown. No backticks. No explanation.",
        },
        {
          role: "user",
          content: `Write a personalized journalist pitch email.

PRODUCT:
GeoIQ (geoiqai.com) tracks if brands appear in ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Overview. Gives a GEO score and specific fixes. Free audit, paid plans from Rs 3,999/mo.

JOURNALIST: ${journalistName}
PUBLICATION: ${publication}
PITCH ANGLE: ${pitchAngle ?? "Tool review request"}
KEY MESSAGE: ${keyMessage ?? "not provided"}

THEIR RECENT WORK:
${recentWork || "No recent articles fetched"}

Write an email under 150 words. Reference their specific work. No em dashes. No bullet points. No bold text. Write like a smart founder talking to a journalist, not a PR agency.

Return this JSON only:
{
  "subject": "Subject line under 60 chars",
  "body": "Full email body as plain text with newlines",
  "personalization": "One sentence on why this angle fits this journalist"
}`,
        },
      ],
    });

    const raw = (completion.choices[0]?.message?.content ?? "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let pitch: { subject: string; body: string; personalization: string };
    try {
      pitch = JSON.parse(raw) as typeof pitch;
    } catch {
      pitch = { subject: "Following your AI search coverage", body: raw, personalization: "" };
    }

    res.json({ success: true, pitch });
  } catch (err: unknown) {
    req.log.error({ err }, "pitch generator error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Generation failed" });
  }
});

export default router;
