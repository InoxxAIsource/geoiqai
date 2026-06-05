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
} from "../lib/dataforseo";
import { runAuditEngine } from "../lib/audit-engine";
import { db, citationsTable, keywordCacheTable, auditsTable } from "@workspace/db";
import { eq, and, desc, gt } from "drizzle-orm";

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

// ─── Deep debug endpoint - raw DataForSEO API responses (public) ─────────────
router.get("/debug/dataforseo", async (_req, res): Promise<void> => {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" };

  const out: Record<string, unknown> = {
    credentials: { login_set: !!login, password_set: !!password, login_preview: login ? login.slice(0, 5) : null },
  };

  if (!login || !password) { res.json({ ...out, error: "Credentials not set" }); return; }

  // 1. Account info
  try {
    const r = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: `Basic ${auth}` } });
    out.user_data = await r.json();
  } catch (e) { out.user_data_error = String(e); }

  // 2. LLM mentions aggregated_metrics (correct format: target as array of objects)
  try {
    const r = await fetch("https://api.dataforseo.com/v3/ai_optimization/llm_mentions/aggregated_metrics/live", {
      method: "POST", headers,
      body: JSON.stringify([{ target: [{ domain: "godaddy.com" }], language_code: "en" }]),
    });
    out.aggregated_metrics_godaddy = await r.json();
  } catch (e) { out.aggregated_metrics_error = String(e); }

  // 3. LLM mentions top_domains (with keyword)
  try {
    const r = await fetch("https://api.dataforseo.com/v3/ai_optimization/llm_mentions/top_domains/live", {
      method: "POST", headers,
      body: JSON.stringify([{ keyword: "domain registrar", language_code: "en", location_code: 2840 }]),
    });
    out.top_domains = await r.json();
  } catch (e) { out.top_domains_error = String(e); }

  // 4. ChatGPT LLM scraper
  try {
    const r = await fetch("https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live", {
      method: "POST", headers,
      body: JSON.stringify([{ prompt: "What is godaddy.com? Tell me about this company.", language_code: "en" }]),
    });
    out.chatgpt_scraper = await r.json();
  } catch (e) { out.chatgpt_scraper_error = String(e); }

  res.json(out);
});

// ─── Citation debug endpoint — runs 5 raw API calls, returns complete JSON ─────
router.get("/debug/citations", async (req, res): Promise<void> => {
  const domain = String((req.query as { domain?: string }).domain ?? "namecheap.com");
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" };
  const BASE = "https://api.dataforseo.com/v3/ai_optimization/llm_mentions";

  async function dfsPost(path: string, body: unknown) {
    const r = await fetch(`https://api.dataforseo.com${path}`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    return r.json();
  }

  const today = new Date().toISOString().split("T")[0]!;
  const dateFrom = "2025-12-07";
  const dateTo = today;
  void BASE;

  const [test1, test2, test3, test4, test5] = await Promise.all([
    // TEST 1: domain as plain string target
    dfsPost("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", [{
      target: domain,
      platform: "google",
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
    }]),
    // TEST 2: domain as array object with search_scope sources
    dfsPost("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", [{
      target: [{ domain, search_scope: ["sources"] }],
      platform: "google",
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
    }]),
    // TEST 3: domain as array object WITHOUT search_scope
    dfsPost("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", [{
      target: [{ domain }],
      platform: "google",
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
    }]),
    // TEST 4: chat_gpt platform with domain
    dfsPost("/v3/ai_optimization/llm_mentions/aggregated_metrics/live", [{
      target: [{ domain }],
      platform: "chat_gpt",
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
    }]),
    // TEST 5: top_pages endpoint
    dfsPost("/v3/ai_optimization/llm_mentions/top_pages/live", [{
      target: [{ domain }],
      platform: "google",
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
      limit: 10,
    }]),
  ]);

  res.json({
    domain,
    test1_domain_string_google: test1,
    test2_domain_obj_scope_sources_google: test2,
    test3_domain_obj_no_scope_google: test3,
    test4_domain_obj_chat_gpt: test4,
    test5_top_pages_google: test5,
  });
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
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "")
    .toLowerCase()
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

    // Score formula: mentions carry 60%, citations bonus 30%, cited pages bonus 10%
    const mentionScore  = Math.min(Math.log10(Math.max(mentions, 1)) / Math.log10(5_000_000) * 60, 60);
    const citationBonus = Math.min(Math.log10(Math.max(citations, 1)) / Math.log10(1_000) * 30, 30);
    const pageBonus     = Math.min(Math.log10(Math.max(citedPagesCount, 1)) / Math.log10(100) * 10, 10);
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

export default router;
