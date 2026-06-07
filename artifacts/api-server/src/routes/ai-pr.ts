import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import OpenAI from "openai";
import Exa from "exa-js";
import { db, journalistContactsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

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

  const ACADEMIC_EXCLUDE = [
    "tandfonline.com", "researchgate.net", "academia.edu", "scholar.google.com",
    "jstor.org", "springer.com", "sciencedirect.com", "pubmed.ncbi.nlm.nih.gov",
    "arxiv.org", "ssrn.com",
  ];
  const JOURNALISM_INCLUDE = [
    "searchengineland.com", "searchenginejournal.com", "moz.com", "techcrunch.com",
    "wired.com", "theverge.com", "venturebeat.com", "digiday.com", "adweek.com",
    "contentmarketinginstitute.com", "ahrefs.com", "neilpatel.com", "backlinko.com",
    "marketingland.com", "theguardian.com", "bbc.com", "forbes.com", "inc.com",
    "entrepreneur.com", "fastcompany.com", "businessinsider.com", "yourstory.com", "inc42.com",
  ];
  const COUNTRY_MAP: Record<string, string> = {
    "searchengineland.com": "United States", "searchenginejournal.com": "United States",
    "techcrunch.com": "United States", "wired.com": "United States",
    "theverge.com": "United States", "venturebeat.com": "United States",
    "digiday.com": "United States", "adweek.com": "United States",
    "forbes.com": "United States", "inc.com": "United States",
    "entrepreneur.com": "United States", "fastcompany.com": "United States",
    "businessinsider.com": "United States", "moz.com": "United States",
    "ahrefs.com": "United States", "neilpatel.com": "United States",
    "contentmarketinginstitute.com": "United States",
    "theguardian.com": "United Kingdom", "bbc.com": "United Kingdom",
    "thetimes.co.uk": "United Kingdom", "independent.co.uk": "United Kingdom",
    "lemonde.fr": "France", "spiegel.de": "Germany",
    "yourstory.com": "India", "inc42.com": "India",
    "economictimes.com": "India", "livemint.com": "India",
  };

  try {
    let searchResults;

    if (searchMode === "ai" && storyDescription) {
      searchResults = await exa.search(
        `${storyDescription} written by journalist reporter writer editor 2025 2026`,
        {
          type: "neural", numResults: 25, category: "news", startPublishedDate: "2025-01-01",
          excludeDomains: ACADEMIC_EXCLUDE,
          includeDomains: JOURNALISM_INCLUDE,
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } },
        }
      );
    } else if (searchMode === "outlet" && outlet) {
      searchResults = await exa.search(
        `${outlet} journalist reporter writer article 2025 2026`,
        {
          type: "auto", numResults: 15,
          excludeDomains: ACADEMIC_EXCLUDE,
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } },
        }
      );
    } else {
      const kw = topic ?? "AI SEO";
      searchResults = await exa.search(
        `${kw} written by journalist reporter writer editor 2025 2026`,
        {
          type: "neural", numResults: 25, category: "news", startPublishedDate: "2025-01-01",
          excludeDomains: ACADEMIC_EXCLUDE,
          includeDomains: JOURNALISM_INCLUDE,
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } },
        }
      );
      if (searchResults.results.length < 4) {
        searchResults = await exa.search(`${kw} journalist article 2025`, {
          type: "auto", numResults: 20, category: "news",
          excludeDomains: ACADEMIC_EXCLUDE,
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } },
        });
      }
    }

    const authorMap: Record<string, {
      name: string; publication: string; domain: string;
      articles: { title: string; url: string; date: string | null | undefined; snippet: string }[];
    }> = {};

    for (const r of searchResults.results) {
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

    const top = Object.values(authorMap).filter(j => j.articles.length > 0).slice(0, 15);

    // Batch: topics + whySelected in one Claude call
    const batchPrompt = top.map((j, i) => `${i + 1}. ${j.name} (${j.publication}): ${j.articles.map(a => a.title).slice(0, 4).join("; ")}`).join("\n");
    const ALLOWED_TOPICS = ["AI SEO", "GEO", "ChatGPT", "Google Search", "Content Marketing", "Technical SEO", "Link Building", "PPC", "Social Media", "PR", "Technology", "Marketing", "AI Tools", "Local SEO", "Startups"];
    const topicsResult = await aiJson<{ results: { name: string; topics: string[]; whySelected?: string }[] }>(
      `For each journalist below, return 3 topic tags chosen from: ${ALLOWED_TOPICS.join(", ")}.${searchMode === "ai" && storyDescription ? ` Also add whySelected: one sentence explaining fit for story: "${storyDescription}"` : ""}

${batchPrompt}

Return JSON: { "results": [ { "name": "...", "topics": ["Tag1","Tag2","Tag3"]${searchMode === "ai" ? `, "whySelected": "..."` : ""} } ] }`,
      { results: [] }
    );
    const topicsMap: Record<string, { topics: string[]; whySelected?: string }> = {};
    for (const r of topicsResult.results) {
      topicsMap[r.name] = { topics: r.topics ?? [], whySelected: r.whySelected };
    }

    const journalists = top.map(j => ({
      ...j,
      article_count: j.articles.length,
      twitter: null,
      linkedin_url: null,
      country: COUNTRY_MAP[j.domain] ?? null,
      topics: topicsMap[j.name]?.topics ?? [],
      whySelected: topicsMap[j.name]?.whySelected ?? null,
    }));

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

// ─── GET /api/ai-pr/hunter-usage ──────────────────────────────────────────────

router.get("/ai-pr/hunter-usage", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(journalistContactsTable)
      .where(sql`looked_up_at >= ${startOfMonth.toISOString()} AND email IS NOT NULL`);
    const used = result[0]?.count ?? 0;
    const resetDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
    res.json({ success: true, used, limit: 50, resetDate: resetDate.toISOString() });
  } catch {
    res.json({ success: true, used: 0, limit: 50, resetDate: null });
  }
});

// ─── POST /api/ai-pr/get-contact ──────────────────────────────────────────────

router.post("/ai-pr/get-contact", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { firstName, lastName, domain, articleUrls } = req.body as {
    firstName?: string; lastName?: string; domain?: string; articleUrls?: string[];
  };
  if (!firstName || !lastName || !domain) {
    res.status(400).json({ error: "firstName, lastName, domain required" });
    return;
  }

  const name = `${firstName} ${lastName}`;

  // Check DB cache
  try {
    const cached = await db.select().from(journalistContactsTable)
      .where(and(eq(journalistContactsTable.name, name), eq(journalistContactsTable.domain, domain)))
      .limit(1);
    if (cached[0]) {
      res.json({ success: true, contact: cached[0], fromCache: true });
      return;
    }
  } catch { /* proceed */ }

  const results: {
    email?: string; emailConfidence?: number; emailNote?: string; emailPattern?: string;
    twitter?: string; twitterUrl?: string; linkedinUrl?: string;
  } = {};

  const EMAIL_BLOCKLIST = ["noreply", "no-reply", "support", "info@", "contact@", "hello@",
    "news@", "editor@", "webmaster@", "admin@", "press@", "tips@", "letters@", "feedback@"];
  const TWITTER_RESERVED = new Set(["search","intent","share","compose","home","explore","notifications","i","web","hashtag"]);

  function extractEmail(text: string): string | undefined {
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    return matches.find(e => {
      const lower = e.toLowerCase();
      return lower.endsWith(`@${domain}`) && !EMAIL_BLOCKLIST.some(b => lower.startsWith(b));
    }) ?? matches.find(e => {
      const lower = e.toLowerCase();
      return !EMAIL_BLOCKLIST.some(b => lower.startsWith(b)) && !lower.includes("example") && lower.includes("@");
    });
  }

  function extractTwitter(text: string): { handle: string; url: string } | undefined {
    const m = text.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,30})(?:[^a-zA-Z0-9_/]|$)/g);
    for (const raw of m ?? []) {
      const handle = raw.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,30})/)?.[1];
      if (handle && !TWITTER_RESERVED.has(handle.toLowerCase())) {
        return { handle: `@${handle}`, url: `https://x.com/${handle}` };
      }
    }
    return undefined;
  }

  const exa = getExa();

  // Step 1: Scrape article pages directly for byline contact info
  if (exa && articleUrls && articleUrls.length > 0) {
    try {
      const urls = articleUrls.slice(0, 3);
      const contents = await exa.getContents(urls, { text: { maxCharacters: 8000 } } as never);
      const allText = (contents as { results?: { text?: string; url?: string }[] })
        .results?.map(r => r.text ?? "").join("\n\n") ?? "";

      const email = extractEmail(allText);
      if (email) { results.email = email; results.emailConfidence = 80; results.emailNote = "Found on article page"; }

      const tw = extractTwitter(allText);
      if (tw) { results.twitter = tw.handle; results.twitterUrl = tw.url; }

      const liMatch = allText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]{2,60})/);
      if (liMatch) results.linkedinUrl = `https://linkedin.com/in/${liMatch[1]}`;
    } catch { /* skip */ }
  }

  // Step 2: Fetch journalist author/bio page on the outlet
  if (exa && (!results.email || !results.twitter)) {
    try {
      const bioSearch = await exa.search(
        `"${name}" site:${domain} author bio contact`,
        { type: "auto", numResults: 2, contents: { text: { maxCharacters: 5000 } } as never }
      );
      const bioText = (bioSearch.results as { text?: string }[]).map(r => r.text ?? "").join("\n");
      if (bioText) {
        if (!results.email) {
          const email = extractEmail(bioText);
          if (email) { results.email = email; results.emailConfidence = 75; results.emailNote = "Found on author profile"; }
        }
        if (!results.twitter) {
          const tw = extractTwitter(bioText);
          if (tw) { results.twitter = tw.handle; results.twitterUrl = tw.url; }
        }
        if (!results.linkedinUrl) {
          const liMatch = bioText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]{2,60})/);
          if (liMatch) results.linkedinUrl = `https://linkedin.com/in/${liMatch[1]}`;
        }
      }
    } catch { /* skip */ }
  }

  // Step 3: Broader Exa search for contact page / social profiles
  if (exa && (!results.email || !results.twitter)) {
    try {
      const socialSearch = await exa.search(
        `${name} ${domain} contact email twitter`,
        { type: "auto", numResults: 3, contents: { text: { maxCharacters: 3000 } } as never }
      );
      const socialText = (socialSearch.results as { text?: string; url?: string }[])
        .map(r => `${r.url ?? ""}\n${r.text ?? ""}`).join("\n\n");
      if (!results.email) {
        const email = extractEmail(socialText);
        if (email) { results.email = email; results.emailConfidence = 65; results.emailNote = "Found via web search"; }
      }
      if (!results.twitter) {
        const tw = extractTwitter(socialText);
        if (tw) { results.twitter = tw.handle; results.twitterUrl = tw.url; }
      }
      if (!results.linkedinUrl) {
        const found = (socialSearch.results as { url?: string }[]).find(r => r.url?.includes("linkedin.com/in/"));
        if (found?.url) results.linkedinUrl = found.url;
      }
    } catch { /* skip */ }
  }

  // Step 4: Hunter.io fallback (only if key set and still no email)
  if (!results.email) {
    const hunterKey = process.env.HUNTER_API_KEY;
    if (hunterKey) {
      try {
        const u = new URL("https://api.hunter.io/v2/email-finder");
        u.searchParams.set("domain", domain);
        u.searchParams.set("first_name", firstName);
        u.searchParams.set("last_name", lastName);
        u.searchParams.set("api_key", hunterKey);
        const r = await fetch(u.toString());
        const d = await r.json() as { data?: { email?: string; score?: number; type?: string } };
        if (d.data?.email) {
          results.email = d.data.email;
          results.emailConfidence = d.data.score;
          results.emailNote = "Found via Hunter.io";
        }
      } catch { /* skip */ }

      // Domain pattern fallback
      if (!results.email) {
        try {
          const u = new URL("https://api.hunter.io/v2/domain-search");
          u.searchParams.set("domain", domain);
          u.searchParams.set("limit", "5");
          u.searchParams.set("api_key", hunterKey);
          const r = await fetch(u.toString());
          const d = await r.json() as { data?: { pattern?: string } };
          if (d.data?.pattern) {
            results.emailPattern = `${d.data.pattern}@${domain}`;
            const guessed = results.emailPattern
              .replace("{first}", firstName.toLowerCase())
              .replace("{last}", lastName.toLowerCase())
              .replace("{f}", (firstName[0] ?? "x").toLowerCase())
              .replace("{l}", (lastName[0] ?? "x").toLowerCase());
            results.email = guessed;
            results.emailConfidence = 35;
            results.emailNote = "Guessed from outlet email pattern";
          }
        } catch { /* skip */ }
      }
    }
  }

  const contactData = {
    name, firstName, lastName, domain,
    email: results.email ?? null,
    emailConfidence: results.emailConfidence ?? null,
    emailType: null,
    emailVerified: null,
    emailNote: results.emailNote ?? null,
    emailPattern: results.emailPattern ?? null,
    twitter: results.twitter ?? null,
    twitterUrl: results.twitterUrl ?? null,
    linkedinUrl: results.linkedinUrl ?? null,
  };

  try {
    await db.insert(journalistContactsTable).values(contactData)
      .onConflictDoUpdate({
        target: [journalistContactsTable.name, journalistContactsTable.domain],
        set: { ...contactData, lookedUpAt: sql`now()` },
      });
  } catch { /* skip */ }

  res.json({ success: true, contact: contactData, fromCache: false });
});

export default router;
