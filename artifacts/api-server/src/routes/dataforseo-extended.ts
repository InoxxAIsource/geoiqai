import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import {
  getGoogleAiOverview,
  getBacklinksSummary,
  getBacklinkDomainGaps,
  runOnPageAudit,
  getDomainKeywords,
  getLocationCode,
  getLlmTopDomains,
  getLlmCrossAggregated,
  getChatGptScraper,
  getGeminiScraper,
  getAiKeywordVolume,
  getKeywordsForKeywords,
  getDfAccountInfo,
  filterRankedKeywords,
  buildCategoryFallbackKeywords,
  getLlmAggregatedMetrics,
  getLlmTopPagesList,
  getLlmSearchTopics,
  getLlmKeywordAggMetrics,
  getLlmTopicPrompts,
} from "../lib/dataforseo";
import { runAuditEngine } from "../lib/audit-engine";
import { db, citationsTable, keywordCacheTable, auditsTable, promptTrackingTable } from "@workspace/db";
import { eq, and, desc, gt } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

// ─── DataForSEO connection test (public, no auth) ────────────────────────────
// Call this to verify credentials are set and working. Returns raw account info.
router.get("/test-dataforseo", async (_req, res): Promise<void> => {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";

  const credInfo = {
    DATAFORSEO_LOGIN_set: !!login,
    DATAFORSEO_PASSWORD_set: !!password,
    login_preview: login ? `${login.slice(0, 3)}***` : "(not set)",
  };

  if (!login || !password) {
    res.json({
      status: "disconnected",
      reason: "DATAFORSEO_LOGIN and/or DATAFORSEO_PASSWORD environment variables are not set.",
      credentials: credInfo,
    });
    return;
  }

  const info = await getDfAccountInfo();

  res.json({
    status: info.connected ? "connected" : "error",
    credentials: credInfo,
    balance: info.balance,
    error: info.error ?? null,
    tip: !info.connected
      ? "Check that DATAFORSEO_LOGIN is your email and DATAFORSEO_PASSWORD is your API password from dashboard.dataforseo.com"
      : null,
  });
});

// ─── DataForSEO status - lightweight ping for sidebar indicator (public) ──────
router.get("/dataforseo/status", async (_req, res): Promise<void> => {
  const info = await getDfAccountInfo();
  res.json(info);
});


// ─── Clear keyword cache for a domain (auth required) ─────────────────────────
router.delete("/dataforseo/keyword-cache", requireAuth, async (req, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }
  try {
    await db.delete(keywordCacheTable).where(eq(keywordCacheTable.domain, domain));
    res.json({ ok: true, domain });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear keyword cache" });
  }
});

// ─── Public quick site health check (no auth) ────────────────────────────────
// Fetches the homepage, measures TTFB, reads security headers, detects tech stack.
// Intentionally skips PageSpeed Insights to keep response time under 10s.
router.post("/onpage/quick", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  try {
    const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
    const homeUrl = `${base}/`;

    const fetchStart = Date.now();
    const homeResp = await fetch(homeUrl, {
      headers: { "User-Agent": "GeoIQ-Audit/1.0 (+https://geoiqai.com)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    const ttfbMs = Date.now() - fetchStart;

    const isHttps = homeUrl.startsWith("https://") && homeResp.ok;
    const html = homeResp.ok ? await homeResp.text() : "";
    const serverHeader = homeResp.headers.get("server") ?? "";

    // Security headers
    const hsts = homeResp.headers.get("strict-transport-security") !== null;
    const xFrameOptions = homeResp.headers.get("x-frame-options") !== null;
    const hasCsp = homeResp.headers.get("content-security-policy") !== null;
    const xContentTypeOptions = homeResp.headers.get("x-content-type-options") !== null;
    const referrerPolicy = homeResp.headers.get("referrer-policy") !== null;

    // CMS detection
    let cms: string | null = null;
    if (/wp-content|wp-includes/i.test(html)) cms = "WordPress";
    else if (/webflow\.com|\.wf-page/i.test(html) || homeResp.headers.get("x-wf-site")) cms = "Webflow";
    else if (/<meta[^>]+generator["']?\s*=?\s*["']Ghost/i.test(html)) cms = "Ghost";
    else if (/squarespace\.com|static\.squarespace/i.test(html)) cms = "Squarespace";
    else if (/shopify\.com|cdn\.shopify/i.test(html)) cms = "Shopify";
    else {
      const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,40})["']/i);
      if (gen) cms = gen[1].split(" ")[0] ?? null;
    }

    // Framework detection
    let framework: string | null = null;
    if (/_next\/static/i.test(html)) framework = "Next.js";
    else if (/__gatsby|gatsby-/i.test(html)) framework = "Gatsby";
    else if (/nuxt|__NUXT__/i.test(html)) framework = "Nuxt.js";
    else if (/data-reactroot|__NEXT_DATA__|react-dom/i.test(html)) framework = "React";
    else if (/ng-version|angular\.min\.js/i.test(html)) framework = "Angular";
    else if (/__svelte|svelte\.dev/i.test(html)) framework = "Svelte";
    else if (/vue\.js|vue\.min\.js|__vue__/i.test(html)) framework = "Vue.js";

    // CDN detection
    let cdn: string | null = null;
    if (homeResp.headers.get("cf-ray")) cdn = "Cloudflare";
    else if (homeResp.headers.get("x-vercel-id")) cdn = "Vercel";
    else if (homeResp.headers.get("x-nf-request-id")) cdn = "Netlify";
    else if (homeResp.headers.get("x-amz-cf-id")) cdn = "AWS CloudFront";
    else if ((homeResp.headers.get("x-served-by") ?? "").includes("fastly")) cdn = "Fastly";

    // Analytics
    const analytics: string[] = [];
    if (/gtag\(|G-[A-Z0-9]{6,}|analytics\.google\.com/i.test(html)) analytics.push("Google Analytics");
    if (/googletagmanager\.com/i.test(html)) analytics.push("GTM");
    if (/hotjar\.com|_hjSettings/i.test(html)) analytics.push("Hotjar");
    if (/mixpanel\.com/i.test(html)) analytics.push("Mixpanel");
    if (/posthog\.com|posthog\.init/i.test(html)) analytics.push("PostHog");
    if (/plausible\.io/i.test(html)) analytics.push("Plausible");
    if (/crisp\.chat|crispSDK/i.test(html)) analytics.push("Crisp");
    if (/intercom\.com|Intercom\(/i.test(html)) analytics.push("Intercom");

    const securityScore = [isHttps, hsts, xFrameOptions || hasCsp, xContentTypeOptions, referrerPolicy].filter(Boolean).length;

    res.json({
      ttfbMs,
      isHttps,
      security: {
        hsts,
        clickjacking: xFrameOptions || hasCsp,
        mimeSniffing: xContentTypeOptions,
        referrerPolicy,
        score: securityScore,
        total: 5,
      },
      techStack: {
        cms,
        framework,
        cdn,
        analytics,
        server: serverHeader.split("/")[0].trim() || null,
      },
    });
  } catch {
    res.status(502).json({ error: "Could not fetch site" });
  }
});

// ─── Public Google AI check (used by free audit - rate-limited by IP) ──────────

const publicAiCheckCount = new Map<string, { count: number; resetAt: number }>();

router.post("/audit/google-ai-check", async (req, res): Promise<void> => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const entry = publicAiCheckCount.get(ip);
  if (entry && entry.resetAt > now && entry.count >= 5) {
    res.status(429).json({ error: "Rate limit: max 5 Google AI checks per day per IP." });
    return;
  }
  if (!entry || entry.resetAt <= now) {
    publicAiCheckCount.set(ip, { count: 1, resetAt: now + dayMs });
  } else {
    entry.count++;
  }

  const { domain, keywords } = req.body as { domain?: string; keywords?: string[] };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  const result = await getGoogleAiOverview(kws, domain, locationCode);
  res.json(result);
});

// ─── Auth-gated endpoints (paid plans only) ────────────────────────────────────

function requirePaid(req: AuthRequest, res: Parameters<Parameters<typeof router.post>[1]>[1], next: () => void) {
  if (req.user.plan === "free") {
    res.status(403).json({ error: "This feature requires a paid plan. Upgrade to Starter or Agency." });
    return;
  }
  next();
}

// Google AI Overview - paid dashboard
router.post("/dataforseo/google-ai-overview", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Google AI Overview requires a paid plan." });
    return;
  }

  const { domain, keywords, brandId } = req.body as {
    domain?: string;
    keywords?: string[];
    brandId?: string;
  };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, kws: kws.length }, "google-ai-overview request");

  const result = await getGoogleAiOverview(kws, domain, locationCode);

  // Persist brand_entities to citations table if we have a brandId and entities
  if (brandId && result.brandEntities.length > 0) {
    const bareDomain = domain.replace(/^www\./, "").toLowerCase();

    try {
      // Clear old brand-entity citations for this brand so we get a fresh snapshot
      await db
        .delete(citationsTable)
        .where(
          and(
            eq(citationsTable.brandId, brandId),
            eq(citationsTable.aiSystem, "google_ai_overview"),
          ),
        );

      // Insert fresh entities
      const rows = result.brandEntities.map(ent => {
        const entUrl = ent.url.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
        const isOwnBrand =
          entUrl.includes(bareDomain) ||
          bareDomain.includes(entUrl.split("/")[0] ?? "") ||
          ent.name.toLowerCase().replace(/\s+/g, "").includes(bareDomain.split(".")[0] ?? "");

        return {
          brandId,
          aiSystem: "google_ai_overview",
          prompt: kws.join(", "),
          citedUrl: ent.url,
          citedDomain: ent.url,
          brandName: ent.name,
          citationType: isOwnBrand ? "brand" : "competitor",
          timesCited: ent.mentionCount,
        };
      });

      await db.insert(citationsTable).values(rows);
      req.log.info({ brandId, count: rows.length }, "brand_entities saved to citations");
    } catch (err) {
      req.log.warn({ err }, "Failed to save brand_entities to citations - non-fatal");
    }
  }

  res.json(result);
});

// Brand entity citations - returns saved brand_entities for a brand
router.get("/citations/brand-entities", requireAuth, async (req, res): Promise<void> => {
  const brandId = String(req.query["brandId"] ?? "");
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(citationsTable)
      .where(
        and(
          eq(citationsTable.brandId, brandId),
          eq(citationsTable.aiSystem, "google_ai_overview"),
        ),
      );

    res.json({ citations: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch brand entity citations");
    res.status(500).json({ error: "Failed to fetch citations" });
  }
});

// Backlinks summary
router.post("/backlinks/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Backlinks data requires a paid plan." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  req.log.info({ domain }, "backlinks summary request");
  const result = await getBacklinksSummary(domain);
  if (!result) {
    res.status(502).json({ error: "Could not fetch backlink data. Check DataForSEO credentials." });
    return;
  }
  res.json(result);
});

// Backlinks competitor gap
router.post("/backlinks/competitors", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Backlink gap analysis requires a paid plan." });
    return;
  }

  const { myDomain, competitorDomains } = req.body as { myDomain?: string; competitorDomains?: string[] };
  if (!myDomain || !Array.isArray(competitorDomains) || competitorDomains.length === 0) {
    res.status(400).json({ error: "myDomain and competitorDomains[] are required" });
    return;
  }

  req.log.info({ myDomain, competitors: competitorDomains.length }, "backlinks competitor gap request");
  const result = await getBacklinkDomainGaps(myDomain, competitorDomains);
  res.json(result);
});

// OnPage full audit
router.post("/onpage/audit", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "OnPage audit requires a paid plan." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  req.log.info({ domain }, "onpage audit request");
  const result = await runOnPageAudit(domain);

  if (result.status === "error") {
    res.status(502).json({ error: "OnPage audit failed. Check DataForSEO credentials or try again." });
    return;
  }

  res.json(result);
});

// LLM Mentions - top cited domains for a set of keywords
router.post("/dataforseo/llm-top-domains", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "LLM citation data requires a paid plan." });
    return;
  }

  const { domain, keywords } = req.body as { domain?: string; keywords?: string[] };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, kws: kws.length }, "llm-top-domains request");

  const result = await getLlmTopDomains(kws, locationCode);
  req.log.info({ domain, domains: result.domains.length, cost: result.estimatedCostUsd, cached: result.cached }, "llm-top-domains done");
  res.json(result);
});

// LLM Mentions - cross-domain aggregated mention rates
router.post("/dataforseo/llm-cross-aggregated", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Competitive AI mention data requires a paid plan." });
    return;
  }

  const { domain, competitorDomains, keywords } = req.body as {
    domain?: string;
    competitorDomains?: string[];
    keywords?: string[];
  };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const competitors: string[] = Array.isArray(competitorDomains) ? competitorDomains.slice(0, 4) : [];

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, competitors: competitors.length, kws: kws.length }, "llm-cross-aggregated request");

  const result = await getLlmCrossAggregated(domain, competitors, kws, locationCode);
  req.log.info({ domain, targets: result.targets.length, cost: result.estimatedCostUsd, cached: result.cached }, "llm-cross-aggregated done");
  res.json(result);
});

// ChatGPT LLM Scraper - real citation sources from chatgpt.com
router.post("/dataforseo/chatgpt-scraper", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "ChatGPT citation scraper requires a paid plan." });
    return;
  }

  const { domain, keywords } = req.body as { domain?: string; keywords?: string[] };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 3)
    : (await getDomainKeywords(domain)).slice(0, 3).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, kws: kws.length }, "chatgpt-scraper request");

  const result = await getChatGptScraper(kws, domain, locationCode);
  req.log.info({ domain, sources: result.allSources.length, cited: result.domainCited, cost: result.estimatedCostUsd, cached: result.cached }, "chatgpt-scraper done");
  res.json(result);
});

// Gemini LLM Scraper - real citation sources from gemini.google.com
router.post("/dataforseo/gemini-scraper", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Gemini citation scraper requires a paid plan." });
    return;
  }

  const { domain, keywords } = req.body as { domain?: string; keywords?: string[] };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 3)
    : (await getDomainKeywords(domain)).slice(0, 3).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, kws: kws.length }, "gemini-scraper request");

  const result = await getGeminiScraper(kws, domain, locationCode);
  req.log.info({ domain, sources: result.allSources.length, cited: result.domainCited, cost: result.estimatedCostUsd, cached: result.cached }, "gemini-scraper done");
  res.json(result);
});

// AI Keyword Search Volume - look up AI search volume for known keywords
// When <= 3 keywords are passed (typical for Prompt Research topic search), we first
// call keywords_for_keywords/live to discover related keywords, then return those.
// When > 3 keywords are passed (explicit volume lookup), we skip discovery.
router.post("/dataforseo/ai-keyword-volume", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "AI keyword volume requires a paid plan." });
    return;
  }

  const { keywords, domain, mode } = req.body as { keywords?: string[]; domain?: string; mode?: "volume" | "discover" };
  if (!Array.isArray(keywords) || keywords.length === 0) {
    res.status(400).json({ error: "keywords[] is required" });
    return;
  }

  const locationCode = domain ? getLocationCode(domain) : 2840;
  req.log.info({ keywords: keywords.length, locationCode, mode }, "ai-keyword-volume request");

  // Discovery mode: 1-3 seed keywords -> find related keywords with AI volume
  const useDiscovery = mode === "discover" || (mode !== "volume" && keywords.length <= 3);

  if (useDiscovery) {
    const discResult = await getKeywordsForKeywords(keywords, locationCode);
    req.log.info({ count: discResult.items.length, cost: discResult.estimatedCostUsd, cached: discResult.cached }, "ai-keyword-volume discover done");

    if (discResult.items.length > 0) {
      res.json({
        keywords: discResult.items,
        estimatedCostUsd: discResult.estimatedCostUsd,
        cached: discResult.cached,
        mode: "discover",
      });
      return;
    }
    // If discovery returned nothing, fall through to volume lookup as fallback
    req.log.warn({ keywords }, "keywords_for_keywords returned 0 items, falling back to volume lookup");
  }

  const result = await getAiKeywordVolume(keywords, locationCode);
  req.log.info({ count: result.items?.length ?? 0, cost: result.estimatedCostUsd, cached: result.cached }, "ai-keyword-volume done");
  res.json({ keywords: result.items, estimatedCostUsd: result.estimatedCostUsd, cached: result.cached, mode: "volume" });
});

// Site-specific keywords - ranked keywords filtered to remove brand-name terms
router.post("/dataforseo/site-keywords", requireAuth, async (req, res): Promise<void> => {
  const { domain, category } = req.body as { domain?: string; category?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  // Transform a short generic keyword into buyer-intent question format so LLMs
  // are more likely to run web search and return citation sources.
  // "keyword research" -> "best keyword research tool 2026"
  function toIntentKeyword(kw: string): string {
    const words = kw.trim().split(/\s+/);
    if (words.length <= 3) {
      return `best ${kw.toLowerCase()} tool 2026`;
    }
    return kw;
  }

  const rawKeywords = await getDomainKeywords(domain);
  const filtered = filterRankedKeywords(rawKeywords, domain, 5);

  if (filtered.length >= 1) {
    req.log.info({ domain, count: filtered.length }, "site-keywords: ranked");
    res.json({ keywords: filtered.slice(0, 3).map(toIntentKeyword), source: "ranked" });
    return;
  }

  const fallback = buildCategoryFallbackKeywords(category);
  req.log.info({ domain, category }, "site-keywords: fallback");
  res.json({ keywords: fallback.map(toIntentKeyword), source: "fallback" });
});

// ─── Location code to country name mapping ────────────────────────────────────
const LOCATION_NAMES: Record<number, string> = {
  2840: "United States", 2826: "United Kingdom", 2356: "India", 2124: "Canada",
  2036: "Australia", 2276: "Germany", 2250: "France", 2724: "Spain",
  2380: "Italy", 2392: "Japan", 2076: "Brazil", 2484: "Mexico",
  2586: "Pakistan", 2682: "Saudi Arabia", 2158: "Taiwan", 2410: "South Korea",
  2702: "Singapore", 2458: "Malaysia", 2360: "Indonesia", 2764: "Thailand",
  2616: "Poland", 2528: "Netherlands", 2752: "Sweden", 2578: "Norway",
  2208: "Denmark", 2246: "Finland", 2804: "Ukraine", 2792: "Turkey",
  2818: "Egypt", 2704: "Vietnam", 2710: "South Africa",
  2566: "Nigeria", 2104: "Myanmar", 2050: "Bangladesh", 2144: "Sri Lanka",
  2524: "Nepal", 2608: "Philippines", 2012: "Algeria",
  2756: "Switzerland", 2788: "Tunisia",
};

const PLATFORM_NAMES: Record<string, string> = {
  google: "AI Overview (Google)", chat_gpt: "ChatGPT", gemini: "Gemini",
  perplexity: "Perplexity", claude: "Claude", ai_mode: "AI Mode (Google)",
  google_ai_mode: "AI Mode (Google)", copilot: "Microsoft Copilot", bing: "Bing AI",
};

const PLATFORM_COLORS: Record<string, string> = {
  google: "#4285F4", chat_gpt: "#10A37F", gemini: "#8B5CF6",
  perplexity: "#5B21B6", claude: "#CC785C", ai_mode: "#34A853",
  google_ai_mode: "#34A853", copilot: "#0078D4", bing: "#008373",
};

/** Extract short brand name from a domain. "netflix.com" -> "netflix" */
function extractBrandName(domain: string): string {
  return domain
    .toLowerCase()                               // lowercase first so regex matches uppercase TLDs
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "")
    .trim();
}

/**
 * Generate keyword candidates for a brand name.
 * "primevideo" -> ["primevideo", "prime video"]
 * "hotstar" -> ["hotstar"]
 * "netflix" -> ["netflix"]
 */
/**
 * High-confidence suffixes: these words appear in genuine multi-word product names
 * and almost never form the tail of a single-word brand.
 *
 * Examples of correct splits:
 *   primevideo   -> prime video      disneyplus  -> disney plus
 *   googlepay    -> google pay       googlemaps  -> google maps
 *   appletv      -> apple tv         googleplay  -> google play
 *   microsoftstore -> microsoft store  paramountplus -> paramount plus
 *
 * Deliberately excluded (too ambiguous, self-corrects via mention count anyway):
 *   tube  (youtube), box (dropbox), hub (github), chat (snapchat),
 *   mail  (hotmail), cloud (soundcloud), app (whatsapp), works (freshworks),
 *   base, space, desk, book, news, line, link, go, now, max, live, pass
 */
const COMPOUND_SUFFIXES = ["video", "plus", "pay", "maps", "store", "music", "play", "tv", "shop"];

function brandKeywordCandidates(brandName: string): string[] {
  const candidates = [brandName];
  for (const suffix of COMPOUND_SUFFIXES) {
    // Prefix must be >= 3 chars so we don't split very short names
    if (brandName.endsWith(suffix) && brandName.length - suffix.length >= 3) {
      candidates.push(brandName.slice(0, -suffix.length) + " " + suffix);
      break; // only one variant
    }
  }
  return candidates;
}

// Visibility Overview - uses DataForSEO LLM Mentions API (funded account required)
router.get("/dataforseo/visibility-overview", requireAuth, async (req, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const bareD = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const brandName = extractBrandName(bareD);
  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const candidates = brandKeywordCandidates(brandName);
  req.log.info({ domain: bareD, brandName, candidates }, "visibility-overview: starting");

  try {
    // Round 1: all parallel — keyword candidates per platform + domain citations + cited pages
    // DataForSEO only has data for 2 platforms: "google" (AI Overview) and "chat_gpt" (ChatGPT)
    const round1 = await Promise.all([
      getLlmKeywordAggMetrics(candidates[0]!, sixMonthsAgo, today, "google"),
      getLlmKeywordAggMetrics(candidates[0]!, sixMonthsAgo, today, "chat_gpt"),
      candidates[1] ? getLlmKeywordAggMetrics(candidates[1], sixMonthsAgo, today, "google")    : Promise.resolve(null),
      candidates[1] ? getLlmKeywordAggMetrics(candidates[1], sixMonthsAgo, today, "chat_gpt")  : Promise.resolve(null),
      getLlmAggregatedMetrics(bareD, sixMonthsAgo, today, "google"),
      getLlmAggregatedMetrics(bareD, sixMonthsAgo, today, "chat_gpt"),
      getLlmTopPagesList(bareD, sixMonthsAgo, today, 50, "google"),
      getLlmTopPagesList(bareD, sixMonthsAgo, today, 50, "chat_gpt"),
    ]);
    const [kw1Google, kw1Chatgpt, kw2Google, kw2Chatgpt, domainGoogle, domainChatgpt, pagesGoogle, pagesChatgpt] = round1;

    // Pick best keyword: compare total mentions across both platforms
    const kw1Total = kw1Google.mentions + kw1Chatgpt.mentions;
    const kw2Total = (kw2Google?.mentions ?? 0) + (kw2Chatgpt?.mentions ?? 0);
    const useKw2 = kw2Total > kw1Total;
    const bestKeyword = useKw2 ? candidates[1]! : candidates[0]!;
    const kwGoogle = useKw2 ? kw2Google! : kw1Google;
    const kwChatgpt = useKw2 ? kw2Chatgpt! : kw1Chatgpt;

    // Round 2: topics using the best keyword (parallel)
    const [performingData, opportunitiesData] = await Promise.all([
      getLlmSearchTopics(bestKeyword, sixMonthsAgo, today, "include", 50),
      getLlmSearchTopics(bestKeyword, sixMonthsAgo, today, "exclude", 30),
    ]);

    // Keyword mentions: sum from both platforms
    const googleMentions  = kwGoogle.mentions;
    const chatgptMentions = kwChatgpt.mentions;
    const mentions        = googleMentions + chatgptMentions;
    const aiSearchVolume  = kwGoogle.aiSearchVolume + kwChatgpt.aiSearchVolume;

    // Domain citations: sum from both platforms (from search_scope: ["sources"])
    const citations   = domainGoogle.mentions + domainChatgpt.mentions;
    const citedPagesFromMetrics = domainGoogle.citedPages + domainChatgpt.citedPages;

    // Cited pages: merge both platform page lists, deduplicate by URL, sum mentions
    const allPages = [...pagesGoogle.pages, ...pagesChatgpt.pages];
    const pageMap = new Map<string, { url: string; mentions: number; ai_search_volume: number }>();
    for (const page of allPages) {
      const existing = pageMap.get(page.url);
      if (existing) {
        existing.mentions += page.mentions;
        existing.ai_search_volume += page.ai_search_volume;
      } else {
        pageMap.set(page.url, { ...page });
      }
    }
    const mergedPages = [...pageMap.values()].sort((a, b) => b.mentions - a.mentions);
    const citedPagesCount = citedPagesFromMetrics > 0 ? citedPagesFromMetrics : mergedPages.length;

    req.log.info({
      brandName,
      bestKeyword,
      kw1Total,
      kw2Total,
      googleMentions,
      chatgptMentions,
      mentions,
      citations,
      citedPagesCount,
      domainGoogleMentions: domainGoogle.mentions,
      domainChatgptMentions: domainChatgpt.mentions,
    }, "visibility-overview: raw results");

    // Score formula (final): mentions 70pts log-scale, citations bonus 20pts, pages bonus 10pts
    const mentionScore  = Math.min(Math.log10(Math.max(mentions, 1)) / Math.log10(10_000_000) * 70, 70);
    const citationBonus = citations > 0 ? Math.min(Math.log10(citations) / 6 * 20, 20) : 0;
    const pageBonus     = citedPagesCount > 0 ? Math.min(citedPagesCount / 100 * 10, 10) : 0;
    const score = mentions === 0 ? 0 : Math.min(100, Math.round(mentionScore + citationBonus + pageBonus));
    req.log.info({ mentions, citations, citedPages: citedPagesCount, mentionScore, citationBonus, pageBonus, finalScore: score }, "SCORE DEBUG");

    // Platform distribution: directly from per-platform keyword calls
    // Only show platforms with data > 0 (DataForSEO only has google + chat_gpt)
    const rawPlatforms = [
      { key: "google",   mentions: googleMentions,  ai_search_volume: kwGoogle.aiSearchVolume },
      { key: "chat_gpt", mentions: chatgptMentions, ai_search_volume: kwChatgpt.aiSearchVolume },
    ].filter(p => p.mentions > 0);
    const totalPlatMentions = Math.max(rawPlatforms.reduce((s, p) => s + p.mentions, 0), 1);
    const platformData = rawPlatforms
      .sort((a, b) => b.mentions - a.mentions)
      .map(p => ({
        key: p.key,
        displayName: PLATFORM_NAMES[p.key] ?? p.key,
        color: PLATFORM_COLORS[p.key] ?? "#6B7280",
        mentions: p.mentions,
        ai_search_volume: p.ai_search_volume,
        // Actual % of total; never round to 0 if mentions > 0
        pct: p.mentions > 0 ? Math.max(parseFloat(((p.mentions / totalPlatMentions) * 100).toFixed(1)), 0.1) : 0,
      }));

    // Countries: from keyword agg total breakdown (google platform preferred for volume)
    const kwTotal = kwGoogle.total ?? kwChatgpt.total;
    const kwLocations = (kwTotal?.location ?? []) as Array<{ key: string; mentions: number }>;
    const totalLocMentions = Math.max(kwLocations.reduce((s, l) => s + (l.mentions || 0), 0), 1);
    const countries = [...kwLocations]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10)
      .map(l => ({
        code: Number(l.key),
        name: LOCATION_NAMES[Number(l.key)] ?? "🌐 Other",
        mentions: l.mentions,
        pct: Math.round((l.mentions / totalLocMentions) * 100),
      }));

    // Cited sources from domain breakdown
    const domainTotal = domainGoogle.total ?? domainChatgpt.total;
    const sourcesDomain = (domainTotal?.sources_domain ?? []) as Array<{ key: string; mentions: number; ai_search_volume: number }>;
    const citedSources = [...sourcesDomain]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20)
      .map(s => ({ domain: s.key, mentions: s.mentions, ai_search_volume: s.ai_search_volume }));

    const hasData = mentions > 0 || citations > 0;
    req.log.info({ domain: bareD, bestKeyword, score, mentions, citations, citedPagesCount, hasData }, "visibility-overview: done");

    res.json({
      domain: bareD,
      brandName: bestKeyword,
      score,
      mentions,
      aiSearchVolume,
      citations,
      citedPagesCount,
      hasData,
      platforms: platformData,
      // Note shown in UI under the platform chart
      platformsNote: "Data source: Google AI Overview + ChatGPT (GPT-5). Gemini and Perplexity data coming soon.",
      countries,
      citedSources,
      citedPages: mergedPages.slice(0, 50),
      performingTopics: performingData.items,
      performingTopicsCount: performingData.totalCount,
      topicOpportunities: opportunitiesData.items,
      topicOpportunitiesCount: opportunitiesData.totalCount,
      dateFrom: sixMonthsAgo,
      dateTo: today,
      cached: false,
    });
  } catch (err) {
    req.log.error({ err, domain }, "visibility-overview error");
    res.status(500).json({ error: "Failed to load visibility data. Please try again." });
  }
});

// Brand Performance - uses real audit data from audit engine
router.get("/dataforseo/brand-performance", requireAuth, async (req, res): Promise<void> => {
  const { domain, force } = req.query as { domain?: string; force?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  try {
    const bareD = domain.replace(/^www\./, "");
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Try cached audit first
    let scoreChatgpt = 0, scoreGemini = 0, scorePerplexity = 0, scoreTotal = 0;
    let auditDate: string | null = null;
    let fromCache = false;

    if (force !== "true") {
      const [existing] = await db.select({
        scoreTotal: auditsTable.scoreTotal,
        scoreChatgpt: auditsTable.scoreChatgpt,
        scoreGemini: auditsTable.scoreGemini,
        scorePerplexity: auditsTable.scorePerplexity,
        createdAt: auditsTable.createdAt,
      })
        .from(auditsTable)
        .where(and(eq(auditsTable.domain, bareD), gt(auditsTable.createdAt, cutoff)))
        .orderBy(desc(auditsTable.createdAt))
        .limit(1);

      if (existing) {
        scoreChatgpt = existing.scoreChatgpt;
        scoreGemini = existing.scoreGemini;
        scorePerplexity = existing.scorePerplexity;
        scoreTotal = existing.scoreTotal;
        auditDate = existing.createdAt?.toISOString() ?? null;
        fromCache = true;
      }
    }

    if (!fromCache) {
      const result = await runAuditEngine(bareD, null, null, null);
      scoreChatgpt = result.chatgpt.score;
      scoreGemini = result.gemini.score;
      scorePerplexity = result.perplexity.score;
      scoreTotal = Math.round((scoreChatgpt + scoreGemini + scorePerplexity) / 3);
      auditDate = new Date().toISOString();
      // Persist
      try {
        await db.insert(auditsTable).values({
          url: bareD, domain: bareD,
          brandName: result.brandName, category: result.category, market: result.market,
          scoreTotal, scoreChatgpt, scoreGemini, scorePerplexity,
          chatgptFound: result.chatgpt.found, geminiFound: result.gemini.found,
          perplexityFound: result.perplexity.found,
          chatgptDetail: result.chatgpt.detail, geminiDetail: result.gemini.detail,
          perplexityDetail: result.perplexity.detail,
          competitorsFound: result.chatgpt.competitors, keywordsUsed: result.keywordsUsed,
          rawResults: { chatgpt: result.rawChatgptResponse, gemini: result.rawGeminiResponse, perplexity: result.rawPerplexityResponse } as unknown as Record<string, unknown>,
          isPaid: false,
        });
      } catch { /* non-fatal */ }
    }

    // Keywords for narrative drivers
    const kws = (await getDomainKeywords(bareD)).slice(0, 5).map(k => k.keyword);

    res.json({
      domain: bareD,
      overallScore: scoreTotal,
      chatgpt: scoreChatgpt,
      gemini: scoreGemini,
      perplexity: scorePerplexity,
      sentiment: { positive: scoreTotal > 50 ? 65 : 30, neutral: 25, negative: scoreTotal > 50 ? 10 : 45 },
      narrativeDrivers: kws.map((kw, i) => ({
        topic: kw,
        mentions: Math.max(0, Math.round((scoreTotal * 5) - i * 20)),
        trend: (["up", "flat", "up", "down", "up"] as const)[i] ?? "flat",
      })),
      topQuestions: kws.slice(0, 5).map((kw, i) => ({
        question: `What are the best ${kw} tools for startups?`,
        frequency: Math.max(0, Math.round((scoreTotal * 12) - i * 150)),
        you: scoreTotal > 20 && i < 3,
      })),
      perceptionSummary: scoreTotal > 40
        ? `AI systems recognize ${bareD} as a relevant player in this space, with ${scoreTotal}/100 visibility across ChatGPT, Gemini, and Perplexity. The brand is mainly associated with ${kws[0] ?? "your category"}.`
        : scoreTotal > 10
        ? `${bareD} has limited AI visibility (${scoreTotal}/100). It appears occasionally in AI responses but isn't consistently cited. Focus on entity recognition, structured data, and authoritative backlinks.`
        : `${bareD} has very low AI visibility (${scoreTotal}/100). AI systems rarely mention this domain in relevant responses. Start with an llms.txt file, Organization schema markup, and getting listed on authoritative directories.`,
      cached: fromCache,
      auditDate,
    });
  } catch (err) {
    req.log.error({ err, domain }, "brand-performance error");
    res.status(500).json({ error: "Could not load brand performance data. Please try again." });
  }
});

void requirePaid;

// ─── Competitor Research — compare brand AI visibility across domains ─────────
const compOpenai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "no-key",
  timeout: 20000,
  maxRetries: 0,
});

// Identical formula used by visibility-overview: 70pt mentions + 20pt citations + 10pt pages
function calcScore(mentions: number, citations: number, citedPages: number): number {
  if (mentions === 0) return 0;
  const mentionScore  = Math.min(Math.log10(Math.max(mentions, 1)) / Math.log10(10_000_000) * 70, 70);
  const citationBonus = citations > 0 ? Math.min(Math.log10(citations) / 6 * 20, 20) : 0;
  const pageBonus     = citedPages > 0 ? Math.min(citedPages / 100 * 10, 10) : 0;
  return Math.min(100, Math.round(mentionScore + citationBonus + pageBonus));
}

router.post("/dataforseo/competitor-research", requireAuth, async (req, res): Promise<void> => {
  const { yourDomain, competitorDomains } = req.body as {
    yourDomain?: string;
    competitorDomains?: string[];
  };
  if (!yourDomain) { res.status(400).json({ error: "yourDomain is required" }); return; }

  // Normalize to lowercase so extractBrandName regex strips TLDs correctly
  const allDomains = [yourDomain, ...(Array.isArray(competitorDomains) ? competitorDomains.slice(0, 3) : [])]
    .filter(Boolean)
    .map(d => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? d);
  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  req.log.info({ domains: allDomains, dateFrom: sixMonthsAgo, dateTo: today }, "competitor-research: start");

  // Build 6 monthly date slices for trend chart
  const startMs = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const monthSlices = Array.from({ length: 6 }, (_, i) => {
    const from = new Date(startMs + i * 30 * 24 * 60 * 60 * 1000);
    const to   = new Date(Math.min(from.getTime() + 30 * 24 * 60 * 60 * 1000, Date.now()));
    return { from: from.toISOString().split("T")[0]!, to: to.toISOString().split("T")[0]! };
  });

  try {
    // Per-domain: fetch keyword mentions + domain citations + cited pages in parallel
    const domainFetches = allDomains.map(async (domain, idx) => {
      const brandName = extractBrandName(domain);
      const candidates = brandKeywordCandidates(brandName);
      const [kw1G, kw1C, kw2G, kw2C, pagesG, pagesC, domG, domC] = await Promise.all([
        getLlmKeywordAggMetrics(candidates[0]!, sixMonthsAgo, today, "google"),
        getLlmKeywordAggMetrics(candidates[0]!, sixMonthsAgo, today, "chat_gpt"),
        candidates[1] ? getLlmKeywordAggMetrics(candidates[1], sixMonthsAgo, today, "google") : Promise.resolve(null),
        candidates[1] ? getLlmKeywordAggMetrics(candidates[1], sixMonthsAgo, today, "chat_gpt") : Promise.resolve(null),
        getLlmTopPagesList(domain, sixMonthsAgo, today, 50, "google"),
        getLlmTopPagesList(domain, sixMonthsAgo, today, 50, "chat_gpt"),
        getLlmAggregatedMetrics(domain, sixMonthsAgo, today, "google"),
        getLlmAggregatedMetrics(domain, sixMonthsAgo, today, "chat_gpt"),
      ]);
      const kw1Total = kw1G.mentions + kw1C.mentions;
      const kw2Total = (kw2G?.mentions ?? 0) + (kw2C?.mentions ?? 0);
      const useKw2 = kw2Total > kw1Total;
      const bestKeyword = useKw2 ? candidates[1]! : candidates[0]!;
      const mentions  = useKw2 ? kw2Total : kw1Total;
      const citations = domG.mentions + domC.mentions;
      // Merge pages from both platforms, deduplicate by URL (matches visibility-overview logic)
      const pageUrlSet = new Set<string>();
      for (const p of [...pagesG.pages, ...pagesC.pages]) if (p.url) pageUrlSet.add(p.url);
      const citedPages = pageUrlSet.size;
      const score = calcScore(mentions, citations, citedPages);
      req.log.info({ domain, brandName, mentions, citations, citedPages, score }, "competitor-research: domain metrics");
      return { domain, brandName, bestKeyword, mentions, citations, citedPages, score, isYou: idx === 0 };
    });

    const domainResults = await Promise.all(domainFetches);

    // Topics (parallel fetch for both brands)
    const yourBrand = domainResults[0]!.bestKeyword;
    const compBrand = domainResults[1]?.bestKeyword;

    const [yourTopics, compTopics] = await Promise.all([
      getLlmSearchTopics(yourBrand, sixMonthsAgo, today, "include", 100),
      compBrand
        ? getLlmSearchTopics(compBrand, sixMonthsAgo, today, "include", 100)
        : Promise.resolve({ items: [], totalCount: 0, cached: false }),
    ]);

    // Monthly trend: reuse getLlmKeywordAggMetrics per 30-day slice (results are cached after first run)
    const trendSeries = await Promise.all(domainResults.map(async (d) => {
      const monthPoints = await Promise.all(monthSlices.map(async (slice) => {
        const [g, c] = await Promise.all([
          getLlmKeywordAggMetrics(d.bestKeyword, slice.from, slice.to, "google"),
          getLlmKeywordAggMetrics(d.bestKeyword, slice.from, slice.to, "chat_gpt"),
        ]);
        const monthMentions = g.mentions + c.mentions;
        return { date: slice.from, mentions: monthMentions, score: calcScore(monthMentions, d.citations, d.citedPages) };
      }));
      return { domain: d.domain, points: monthPoints };
    }));

    req.log.info({
      trendPoints: trendSeries.map(t => t.points.filter(p => p.mentions > 0).length),
      yourTopics: yourTopics.items.length,
      compTopics: compTopics.items.length,
    }, "competitor-research: secondary data");

    // Build rank maps (1-based: rank 1 = most prominent in results)
    const yourRankMap = new Map<string, number>();
    yourTopics.items.forEach((item, idx) => {
      const key = item.question.toLowerCase().trim();
      if (key) yourRankMap.set(key, idx + 1);
    });
    const compRankMap = new Map<string, number>();
    compTopics.items.forEach((item, idx) => {
      const key = item.question.toLowerCase().trim();
      if (key) compRankMap.set(key, idx + 1);
    });

    // Merge topics for gap table
    const topicMap = new Map<string, {
      topic: string;
      yourMentions: number;
      compMentions: number;
      yourAiVolume: number;
      compAiVolume: number;
      aiVolume: number;
    }>();
    for (const item of yourTopics.items) {
      const key = item.question.toLowerCase().trim();
      if (!key) continue;
      topicMap.set(key, { topic: item.question, yourMentions: 1, compMentions: 0, yourAiVolume: item.ai_search_volume, compAiVolume: 0, aiVolume: item.ai_search_volume });
    }
    for (const item of compTopics.items) {
      const key = item.question.toLowerCase().trim();
      if (!key) continue;
      const existing = topicMap.get(key);
      if (existing) {
        existing.compMentions = 1;
        existing.compAiVolume = item.ai_search_volume;
        existing.aiVolume = Math.max(existing.aiVolume, item.ai_search_volume);
      } else {
        topicMap.set(key, { topic: item.question, yourMentions: 0, compMentions: 1, yourAiVolume: 0, compAiVolume: item.ai_search_volume, aiVolume: item.ai_search_volume });
      }
    }

    type TopicStatus = "unique" | "missing" | "shared" | "weak" | "strong";
    const classifyStatus = (key: string, yourPresent: number, compPresent: number): TopicStatus => {
      if (yourPresent === 0 && compPresent > 0) return "missing";
      if (yourPresent > 0 && compPresent === 0) return "unique";
      // Both present: compare rank position (lower rank number = more prominent in results)
      const yourRank = yourRankMap.get(key) ?? 9999;
      const compRank = compRankMap.get(key) ?? 9999;
      if (compRank < yourRank * 0.6) return "weak";   // competitor ranks significantly higher
      if (yourRank < compRank * 0.6) return "strong"; // you rank significantly higher
      return "shared";
    };

    const topicList = [...topicMap.entries()]
      .map(([key, t]) => ({
        topic: t.topic,
        yourMentions: t.yourMentions,
        compMentions: t.compMentions,
        yourAiVolume: t.yourAiVolume,
        compAiVolume: t.compAiVolume,
        aiVolume: t.aiVolume,
        status: classifyStatus(key, t.yourMentions, t.compMentions),
      }))
      .sort((a, b) => b.aiVolume - a.aiVolume);

    const topicCounts = {
      all: topicList.length,
      missing: topicList.filter(t => t.status === "missing").length,
      weak: topicList.filter(t => t.status === "weak").length,
      shared: topicList.filter(t => t.status === "shared").length,
      strong: topicList.filter(t => t.status === "strong").length,
      unique: topicList.filter(t => t.status === "unique").length,
    };

    // Aggregate cited source domains from topics
    const sourceMap = new Map<string, number>();
    for (const item of yourTopics.items) {
      for (const url of item.sources ?? []) {
        try {
          const domain = new URL(url).hostname.replace(/^www\./, "");
          if (domain) sourceMap.set(domain, (sourceMap.get(domain) ?? 0) + 1);
        } catch { /* skip malformed urls */ }
      }
    }
    const sources = [...sourceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([domain, count]) => ({ domain, count }));

    // Generate insights (2 sentences max, 50 words)
    let insights: string[] = [];
    try {
      const you = domainResults[0]!;
      const comp = domainResults[1];
      if (comp) {
        const topMissing = topicList.filter(t => t.status === "missing").slice(0, 3).map(t => t.topic);
        const topUnique = topicList.filter(t => t.status === "unique").slice(0, 3).map(t => t.topic);
        const prompt = `You are a GEO analyst. Compare these two brands based on AI mention data.

Your brand: ${you.domain} - AI Mentions: ${you.mentions.toLocaleString()}, Score: ${you.score}/100
Competitor: ${comp.domain} - AI Mentions: ${comp.mentions.toLocaleString()}, Score: ${comp.score}/100

Topics competitor leads in (missing from your brand): ${topMissing.join(", ") || "none found"}
Topics only your brand appears in: ${topUnique.join(", ") || "none found"}

Write exactly 2 sentences. Sentence 1: which specific topic the competitor leads in and why it matters. Sentence 2: one specific action to close the gap. Maximum 50 words total. Be specific, not generic. No bullets, no numbering.`;

        const completion = await compOpenai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          temperature: 0.4,
        });
        const text = completion.choices[0]?.message?.content?.trim() ?? "";
        insights = text.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 2);
      }
    } catch (err) {
      req.log.warn({ err }, "competitor-research: insights generation failed");
    }

    req.log.info({ domains: allDomains, scores: domainResults.map(d => d.score), topics: topicList.length, topicCounts, sources: sources.length }, "competitor-research: done");

    res.json({ domains: domainResults, trend: trendSeries, topics: topicList, topicCounts, insights, sources, cached: false });
  } catch (err) {
    req.log.error({ err }, "competitor-research error");
    res.status(500).json({ error: "Could not load competitor data. Please try again." });
  }
});

// ─── Topic Prompts (expand a topic row - paid only) ──────────────────────────
router.post("/dataforseo/topic-prompts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "upgrade", message: "Expand prompts available on Starter plan." });
    return;
  }
  const { topicName, dateFrom, dateTo, platform = "google" } = req.body as {
    topicName?: string;
    dateFrom?: string;
    dateTo?: string;
    platform?: string;
  };
  if (!topicName || !dateFrom || !dateTo) {
    res.status(400).json({ error: "topicName, dateFrom, and dateTo are required" });
    return;
  }
  const result = await getLlmTopicPrompts(topicName, dateFrom, dateTo, platform);
  req.log.info({ topicName, itemCount: result.items.length, cached: result.cached }, "topic-prompts: done");
  res.json(result);
});

// ─── Prompt Research — brand/domain-level AI prompt discovery ────────────────
router.post("/dataforseo/prompt-research", requireAuth, async (req, res): Promise<void> => {
  const { input } = req.body as { input?: string };
  if (!input?.trim()) { res.status(400).json({ error: "input is required" }); return; }

  // Normalize to brand name: strip protocol, www, TLD
  const brandName = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.[a-z]{2,6}(\.[a-z]{2})?$/i, "")
    .toLowerCase()
    .trim() || input.trim().toLowerCase();

  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  req.log.info({ input, brandName }, "prompt-research: start");

  try {
    const [googleResult, chatgptResult] = await Promise.all([
      getLlmSearchTopics(brandName, sixMonthsAgo, today, "include", 100, "google"),
      getLlmSearchTopics(brandName, sixMonthsAgo, today, "include", 100, "chat_gpt"),
    ]);

    const allItems = [...googleResult.items, ...chatgptResult.items];
    req.log.info({ brandName, google: googleResult.items.length, chatgpt: chatgptResult.items.length, total: allItems.length }, "prompt-research: items fetched");

    // Filter to brand-relevant items (brand name must appear in the question or answer)
    const brandLower = brandName.toLowerCase();
    const brandRelevantItems = allItems.filter(item => {
      const q = item.question.toLowerCase();
      const a = item.answer.toLowerCase();
      return q.includes(brandLower) || a.includes(brandLower);
    });
    // Fall back to all items if fewer than 5 brand-relevant ones
    const itemsForTopics = brandRelevantItems.length >= 5 ? brandRelevantItems : allItems;
    req.log.info({ brandName, brandRelevant: brandRelevantItems.length, usingAll: itemsForTopics === allItems }, "prompt-research: brand filter");

    // Extract brands from answer text when brand_entities is empty
    function extractBrandsFromText(text: string): string[] {
      if (!text) return [];
      const words = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?\b/g) ?? [];
      const freq: Record<string, number> = {};
      for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
      return Object.entries(freq)
        .filter(([, c]) => c > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 10);
    }

    // Better topic naming: strip leading stop-word phrases, use first 3 meaningful words
    const TOPIC_STOP = /^(how to |what is |what are |how do |how does |where is |where can |when does |why is |why does |best |top |free |is |are |does |can |will |which |who is |who are )/i;
    function makeTopicKey(question: string): { key: string; display: string } {
      let cleaned = question.toLowerCase().replace(TOPIC_STOP, "").trim();
      // Keep stripping repeated stop words
      for (let i = 0; i < 3; i++) cleaned = cleaned.replace(TOPIC_STOP, "").trim();
      const words = cleaned.split(/\s+/).filter(w => w.length > 1);
      const key = words.slice(0, 3).join(" ");
      const display = words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return { key, display };
    }

    // Cluster into topics
    interface TopicBucket {
      topic: string;
      prompts: typeof allItems;
      totalAiVolume: number;
      brands: Set<string>;
      sources: Set<string>;
    }
    const topicMap = new Map<string, TopicBucket>();
    for (const item of itemsForTopics) {
      if (!item.question) continue;
      const { key: topicKey, display: topicDisplay } = makeTopicKey(item.question);
      if (!topicKey) continue;
      if (!topicMap.has(topicKey)) {
        topicMap.set(topicKey, { topic: topicDisplay, prompts: [], totalAiVolume: 0, brands: new Set(), sources: new Set() });
      }
      const bucket = topicMap.get(topicKey)!;
      bucket.prompts.push(item);
      bucket.totalAiVolume += item.ai_search_volume;
      // Brand entities - use DataForSEO field if present, else extract from answer
      const entities = item.brandEntities.length > 0 ? item.brandEntities : extractBrandsFromText(item.answer);
      for (const b of entities) if (b) bucket.brands.add(b);
      for (const url of item.sources) {
        try { const d = new URL(url).hostname.replace(/^www\./, ""); if (d) bucket.sources.add(d); } catch { /* skip */ }
      }
    }

    // Global brand + source aggregates (use allItems so Brands tab shows all competition)
    const brandCountMap = new Map<string, { count: number; topics: string[] }>();
    const sourceCountMap = new Map<string, { count: number; topics: string[] }>();
    for (const item of allItems) {
      const entities = item.brandEntities.length > 0 ? item.brandEntities : extractBrandsFromText(item.answer);
      const topicDisplay = makeTopicKey(item.question).display;
      for (const b of entities) {
        if (!b) continue;
        const e = brandCountMap.get(b) ?? { count: 0, topics: [] };
        e.count++;
        if (e.topics.length < 3 && topicDisplay) e.topics.push(topicDisplay);
        brandCountMap.set(b, e);
      }
      for (const url of item.sources) {
        try {
          const d = new URL(url).hostname.replace(/^www\./, "");
          if (!d) continue;
          const e = sourceCountMap.get(d) ?? { count: 0, topics: [] };
          e.count++;
          if (e.topics.length < 3 && topicDisplay) e.topics.push(topicDisplay);
          sourceCountMap.set(d, e);
        } catch { /* skip */ }
      }
    }

    // Intent classification via AI
    const top20 = allItems.slice(0, 20).map(i => i.question).filter(Boolean);
    let intent = { informational: 57, navigational: 16, commercial: 13, transactional: 10, task: 4 };
    if (top20.length > 0) {
      try {
        const completion = await compOpenai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Classify these AI search queries by intent. Return JSON only with these exact keys: { "informational": number, "navigational": number, "commercial": number, "transactional": number, "task": number }. Values are whole-number percentages summing to 100.\n\nQueries:\n${top20.join("\n")}` }],
          max_tokens: 80,
          temperature: 0.2,
          response_format: { type: "json_object" },
        });
        const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, number>;
        if (typeof raw.informational === "number") {
          intent = { informational: raw.informational ?? 0, navigational: raw.navigational ?? 0, commercial: raw.commercial ?? 0, transactional: raw.transactional ?? 0, task: raw.task ?? 0 };
        }
      } catch { /* keep defaults */ }
    }

    const totalAiVolume = allItems.reduce((s, i) => s + i.ai_search_volume, 0);

    const topics = [...topicMap.values()]
      .map(b => {
        // Aggregate monthly searches across all prompts in the topic (sum by month)
        const monthlyMap = new Map<string, { year: number; month: number; count: number }>();
        for (const p of b.prompts) {
          for (const m of p.monthlySearches) {
            const mkey = `${m.year}-${m.month}`;
            const prev = monthlyMap.get(mkey) ?? { year: m.year, month: m.month, count: 0 };
            prev.count += m.count;
            monthlyMap.set(mkey, prev);
          }
        }
        const monthlySearches = [...monthlyMap.values()].sort((a, x) => a.year !== x.year ? a.year - x.year : a.month - x.month);
        return {
          topic: b.topic,
          totalAiVolume: b.totalAiVolume,
          promptCount: b.prompts.length,
          monthlySearches,
          prompts: b.prompts.map(p => ({ question: p.question, platform: p.platform, ai_search_volume: p.ai_search_volume, sources: p.sources.slice(0, 5), brands: (p.brandEntities.length > 0 ? p.brandEntities : extractBrandsFromText(p.answer)).slice(0, 5) })),
          brands: [...b.brands].slice(0, 10),
          sources: [...b.sources].slice(0, 10),
        };
      })
      .sort((a, b) => b.totalAiVolume - a.totalAiVolume)
      .slice(0, 100);

    const brands = [...brandCountMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 100).map(([name, v]) => ({ name, mentions: v.count, topTopics: v.topics }));
    const sourceDomains = [...sourceCountMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 100).map(([domain, v]) => ({ domain, mentions: v.count, topics: v.topics }));

    req.log.info({ brandName, totalItems: allItems.length, totalTopics: topics.length, totalBrands: brands.length, totalSources: sourceDomains.length, totalAiVolume }, "prompt-research: done");

    res.json({
      brandName,
      totalAiVolume,
      totalTopics: topics.length,
      totalPrompts: allItems.length,
      totalBrands: brands.length,
      totalSources: sourceDomains.length,
      intent,
      topics,
      prompts: allItems.slice(0, 200).map(i => ({ question: i.question, platform: i.platform, ai_search_volume: i.ai_search_volume, sources: i.sources.slice(0, 3), brands: i.brandEntities.slice(0, 3) })),
      brands,
      sourceDomains,
      dateFrom: sixMonthsAgo,
      dateTo: today,
      cached: googleResult.cached && chatgptResult.cached,
    });
  } catch (err) {
    req.log.error({ err }, "prompt-research error");
    res.status(500).json({ error: "Could not load prompt research data. Please try again." });
  }
});

// ─── Monitor Prompt (save to prompt_tracking) ────────────────────────────────
router.post("/dataforseo/monitor-prompt", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { prompt, platform = "google", topic, yourDomain, competitorDomain } = req.body as {
    prompt?: string;
    platform?: string;
    topic?: string;
    yourDomain?: string;
    competitorDomain?: string;
  };
  if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }
  await db.insert(promptTrackingTable).values({
    userId: user.id,
    prompt,
    platform,
    topic: topic ?? null,
    yourDomain: yourDomain ?? null,
    competitorDomain: competitorDomain ?? null,
  });
  req.log.info({ topic, prompt: prompt.slice(0, 60) }, "monitor-prompt: saved");
  res.json({ ok: true });
});

export default router;
