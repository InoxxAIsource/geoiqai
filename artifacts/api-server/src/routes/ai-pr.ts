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

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
function getCached(key: string): unknown | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) { cache.delete(key); return null; }
  return e.data;
}
function setCached(key: string, data: unknown) { cache.set(key, { data, ts: Date.now() }); }

function extractDomain(url: string): string {
  try {
    const h = new URL(url).hostname.replace("www.", "");
    const parts = h.split(".");
    const name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return (name ?? "unknown").charAt(0).toUpperCase() + (name ?? "unknown").slice(1);
  } catch { return "Unknown"; }
}

function fullDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

async function aiJson<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const resp = await aiClient.chat.completions.create({
      model: aiModel, temperature: 0.3,
      messages: [
        { role: "system", content: "Return ONLY raw JSON. No markdown, no backticks, no explanation." },
        { role: "user", content: prompt },
      ],
    });
    const raw = (resp.choices[0]?.message?.content ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

// ─── POST /api/ai-pr/cited-media ──────────────────────────────────────────────

router.post("/ai-pr/cited-media", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();
  if (!exa) { res.status(503).json({ error: "EXA_API_KEY not configured." }); return; }

  const { topic } = req.body as { topic?: string };
  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const cacheKey = `cited-media:${topic.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json({ success: true, outlets: cached }); return; }

  try {
    const results = await exa.search(
      `top media outlets writing about ${topic} technology marketing 2025 2026`,
      {
        type: "auto",
        numResults: 25,
        category: "news",
        startPublishedDate: "2025-01-01",
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      }
    );

    // Group by domain
    const domainMap: Record<string, { domain: string; name: string; articles: { title: string; url: string; date: string | null | undefined }[]; headlines: string[] }> = {};
    for (const r of results.results) {
      const d = fullDomain(r.url);
      if (!domainMap[d]) {
        domainMap[d] = { domain: d, name: extractDomain(r.url), articles: [], headlines: [] };
      }
      domainMap[d]!.articles.push({ title: r.title ?? "", url: r.url, date: r.publishedDate });
      if (r.title) domainMap[d]!.headlines.push(r.title);
    }

    const uniqueOutlets = Object.values(domainMap).sort((a, b) => b.articles.length - a.articles.length).slice(0, 12);

    // Score each outlet for AI trust
    const outlets = await Promise.all(
      uniqueOutlets.map(async (outlet) => {
        const { score, reason } = await aiJson<{ score: number; reason: string }>(
          `Rate this media outlet's likelihood of being cited by AI systems like ChatGPT and Perplexity when answering questions about "${topic}".
Outlet: ${outlet.domain}
Recent headlines: ${outlet.headlines.slice(0, 5).join("; ")}
Score 1-100 based on: domain authority signals, content quality, how often authoritative sources cite this outlet.
Return JSON: { "score": 0-100, "reason": "brief one-sentence reason" }`,
          { score: 50, reason: "Unable to score" }
        );
        return { ...outlet, aiTrustScore: score, aiTrustReason: reason, articleCount: outlet.articles.length };
      })
    );

    const sorted = outlets.sort((a, b) => b.aiTrustScore - a.aiTrustScore);
    setCached(cacheKey, sorted);
    res.json({ success: true, outlets: sorted });
  } catch (err: unknown) {
    req.log.error({ err }, "cited-media error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

// ─── POST /api/ai-pr/find-journalists ─────────────────────────────────────────

router.post("/ai-pr/find-journalists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();
  if (!exa) { res.status(503).json({ error: "EXA_API_KEY not configured." }); return; }

  const { topic, mode, storyDescription, outlet } = req.body as {
    topic?: string;
    mode?: "keyword" | "ai" | "outlet";
    storyDescription?: string;
    outlet?: string;
  };

  const searchMode = mode ?? "keyword";
  const cacheKey = `journalists:${searchMode}:${(topic ?? storyDescription ?? outlet ?? "").toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json({ success: true, journalists: cached }); return; }

  try {
    let searchResults;
    let query = "";

    if (searchMode === "ai" && storyDescription) {
      query = `journalist writer reporter ${storyDescription} recent articles 2025 2026`;
      searchResults = await exa.search(query, {
        type: "auto", numResults: 20, category: "news", startPublishedDate: "2025-01-01",
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      });
    } else if (searchMode === "outlet" && outlet) {
      query = `${outlet} journalist reporter writer article`;
      searchResults = await exa.search(query, {
        type: "auto", numResults: 15,
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      });
    } else {
      // keyword mode - broader query with fallback
      const kw = topic ?? "AI SEO";
      query = `${kw} SEO search marketing technology journalist reporter writer article 2025 2026`;
      searchResults = await exa.search(query, {
        type: "auto", numResults: 20, category: "news", startPublishedDate: "2025-01-01",
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      });
      // Fallback: no category filter if too few results
      if (searchResults.results.length < 5) {
        searchResults = await exa.search(`who writes about ${kw} marketing technology 2025 2026`, {
          type: "auto", numResults: 15,
          contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
        });
      }
    }

    const authorMap: Record<string, {
      name: string;
      publication: string;
      domain: string;
      articles: { title: string; url: string; date: string | null | undefined; snippet: string }[];
    }> = {};

    for (const r of searchResults.results) {
      // Use author or fall back to "Staff Writer" with domain as publication
      const author = r.author?.trim() || null;
      const domain = fullDomain(r.url);
      const pub = extractDomain(r.url);
      const key = author ?? `${pub} Staff`;

      if (!authorMap[key]) {
        authorMap[key] = { name: author ?? `${pub} Staff`, publication: pub, domain, articles: [] };
      }
      authorMap[key]!.articles.push({
        title: r.title ?? "",
        url: r.url,
        date: r.publishedDate,
        snippet: (r.highlights as string[] | undefined)?.[0] ?? "",
      });
    }

    const top = Object.values(authorMap).filter(j => j.articles.length > 0).slice(0, 12);

    // For AI mode, generate "why selected" reason per journalist
    const journalists = await Promise.all(
      top.map(async (j) => {
        let whySelected: string | null = null;
        if (searchMode === "ai" && storyDescription) {
          const { reason } = await aiJson<{ reason: string }>(
            `A PR person has a story: "${storyDescription}". Journalist "${j.name}" from "${j.publication}" has written: ${j.articles.map(a => a.title).join("; ")}.
In one sentence, explain why this journalist is a good fit for this story.
Return JSON: { "reason": "one sentence" }`,
            { reason: "" }
          );
          whySelected = reason || null;
        }
        return { ...j, article_count: j.articles.length, twitter: null, linkedin_url: null, whySelected };
      })
    );

    setCached(cacheKey, journalists);
    res.json({ success: true, journalists });
  } catch (err: unknown) {
    req.log.error({ err }, "journalist finder error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

// ─── POST /api/ai-pr/monitor ──────────────────────────────────────────────────

router.post("/ai-pr/monitor", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();
  if (!exa) { res.status(503).json({ error: "EXA_API_KEY not configured." }); return; }

  const { keyword } = req.body as { keyword?: string };
  if (!keyword) { res.status(400).json({ error: "keyword is required" }); return; }

  const cacheKey = `monitor:${keyword.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json({ success: true, mentions: cached }); return; }

  try {
    const results = await exa.search(
      `"${keyword}" mentioned review article news blog 2025 2026`,
      {
        type: "auto", numResults: 20, category: "news", startPublishedDate: "2025-01-01",
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }
    );

    const mentions = await Promise.all(
      results.results.map(async (r) => {
        const snippets = (r.highlights as string[] | undefined) ?? [];
        const { sentiment } = await aiJson<{ sentiment: "Positive" | "Neutral" | "Negative" }>(
          `Analyze the sentiment of this text about "${keyword}": "${snippets.join(" ").slice(0, 400)}". Return JSON: { "sentiment": "Positive" | "Neutral" | "Negative" }`,
          { sentiment: "Neutral" as const }
        );
        return {
          title: r.title ?? "",
          url: r.url,
          publishedDate: r.publishedDate,
          author: r.author ?? null,
          publication: extractDomain(r.url),
          snippets,
          sentiment,
        };
      })
    );

    setCached(cacheKey, mentions);
    res.json({ success: true, mentions });
  } catch (err: unknown) {
    req.log.error({ err }, "monitor error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

// ─── POST /api/ai-pr/generate-pitch ───────────────────────────────────────────

router.post("/ai-pr/generate-pitch", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const exa = getExa();

  const { journalistName, publication, pressReleaseUrl, keyMessage, pitchAngle, mode } = req.body as {
    journalistName?: string;
    publication?: string;
    pressReleaseUrl?: string;
    keyMessage?: string;
    pitchAngle?: string;
    mode?: "scratch" | "press-release" | "key-message";
  };

  let context = "";

  // Fetch press release content via Exa if URL provided
  if (mode === "press-release" && pressReleaseUrl && exa) {
    try {
      const pr = await exa.search(pressReleaseUrl, {
        type: "auto", numResults: 1,
        contents: { text: true } as never,
      });
      const text = (pr.results[0] as { text?: string } | undefined)?.text ?? "";
      context = `PRESS RELEASE CONTENT:\n${text.slice(0, 1500)}`;
    } catch { /* skip */ }
  } else if (keyMessage) {
    context = `KEY MESSAGE: ${keyMessage}`;
  }

  // Fetch recent journalist work if exa available
  let recentWork = "";
  if (exa && journalistName && publication) {
    try {
      const articles = await exa.search(
        `${journalistName} ${publication} recent AI SEO search marketing`,
        { type: "auto", numResults: 3, category: "news", contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } } }
      );
      recentWork = articles.results.map(r => `Title: ${r.title ?? ""}\nSnippet: ${((r.highlights as string[] | undefined) ?? []).join(" ")}`).join("\n\n");
    } catch { /* skip */ }
  }

  try {
    const pitch = await aiJson<{ subject: string; body: string; personalization: string }>(
      `Write a personalized journalist pitch email for GeoIQ (geoiqai.com).

PRODUCT: GeoIQ tracks if brands appear in ChatGPT, Gemini, Perplexity, Claude, Grok, and Google AI Overview. Gives a GEO score and specific fixes. Free audit, paid plans from Rs 3,999/mo.

JOURNALIST: ${journalistName ?? "journalist"}
PUBLICATION: ${publication ?? "their publication"}
PITCH ANGLE: ${pitchAngle ?? "Tool review request"}
${context}

THEIR RECENT WORK:
${recentWork || "No articles found"}

Write email under 150 words. Reference their specific work naturally. No em dashes. No bullet points. No bold. Smart founder voice, not PR agency.

Return JSON: { "subject": "under 60 chars", "body": "plain text email with newlines", "personalization": "one sentence on why this fits this journalist" }`,
      { subject: "Checking in on AI search coverage", body: "Hi,\n\nI wanted to share something that might be interesting for your coverage of AI search...", personalization: "" }
    );

    res.json({ success: true, pitch });
  } catch (err: unknown) {
    req.log.error({ err }, "pitch error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Generation failed" });
  }
});

export default router;
