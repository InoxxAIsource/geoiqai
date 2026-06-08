import { Router } from "express";
import { requireAuth, verifyToken, type AuthRequest } from "../lib/auth";
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
  getLlmTopicPrompts,
  sandboxMode,
  getDfCache,
  setDfCache,
  logDfsCost,
} from "../lib/dataforseo";
import { runAuditEngine } from "../lib/audit-engine";
import { runAIPresenceScan } from "../lib/ai-presence-scan";
import { crawlSite } from "../lib/site-crawler";
import { db, citationsTable, keywordCacheTable, auditsTable, promptTrackingTable, siteAuditHistoryTable, dataforseoCacheTable } from "@workspace/db";
import { getPlanLimits } from "../lib/plan-limits";
import { eq, and, desc, gt } from "drizzle-orm";
import OpenAI from "openai";
import { anthropic } from "@workspace/integrations-anthropic-ai";

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

// ─── Public quick site health check (optionally authenticated) ───────────────
// Fetches homepage + robots.txt + sitemap + llms.txt in parallel.
// Returns dual scores: Site Health and AI Search Health.
// If a valid auth token is present, saves result to site_audit_history.

function checkBotAccess(robotsTxt: string, botName: string): { allowed: boolean; note: string } {
  if (!robotsTxt.trim()) return { allowed: true, note: "Not explicitly blocked (no robots.txt)" };
  const lines = robotsTxt.split("\n").map(l => (l.split("#")[0] ?? "").trim()).filter(Boolean);
  let inBot = false;
  let inWild = false;
  let botFound = false;
  let botDisallow = false;
  let wildDisallow = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const agent = line.slice(11).trim();
      inBot = agent.toLowerCase() === botName.toLowerCase();
      inWild = agent === "*";
      if (inBot) botFound = true;
    } else if (lower.startsWith("disallow:")) {
      const path = line.slice(9).trim();
      if (inBot && path === "/") botDisallow = true;
      if (inWild && path === "/") wildDisallow = true;
    } else if (lower.startsWith("allow:")) {
      const path = line.slice(6).trim();
      if (inBot && path === "/") botDisallow = false;
      if (inWild && path === "/") wildDisallow = false;
    }
  }
  if (botFound) {
    return botDisallow
      ? { allowed: false, note: `Blocked by User-agent: ${botName} rule` }
      : { allowed: true, note: "Allowed (explicit rule in robots.txt)" };
  }
  return wildDisallow
    ? { allowed: false, note: "Blocked by wildcard (*) Disallow: /" }
    : { allowed: true, note: "Not explicitly blocked" };
}

router.post("/onpage/quick", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const authHeader = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  const userId = authHeader ? verifyToken(authHeader) : null;

  try {
    const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
    const domainClean = base.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const ua = { headers: { "User-Agent": "GeoIQ-Audit/1.0 (+https://geoiqai.com)" } };
    const fetchStart = Date.now();
    const [homeResult, robotsResult, sitemapResult, llmsResult] = await Promise.allSettled([
      fetch(`${base}/`, { ...ua, signal: AbortSignal.timeout(10000), redirect: "follow" }),
      fetch(`${base}/robots.txt`, { ...ua, signal: AbortSignal.timeout(6000) }),
      fetch(`${base}/sitemap.xml`, { ...ua, signal: AbortSignal.timeout(6000) }),
      fetch(`${base}/llms.txt`, { ...ua, signal: AbortSignal.timeout(6000) }),
    ]);
    const ttfbMs = Date.now() - fetchStart;

    const homeResp = homeResult.status === "fulfilled" ? homeResult.value : null;
    const statusCode = homeResp?.status ?? 0;
    const isHttps = base.startsWith("https://") && (homeResp?.ok ?? false);
    const html = homeResp?.ok ? await homeResp.text() : "";
    const serverHeader = homeResp?.headers.get("server") ?? "";

    // Meta title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
    const metaTitleLength = metaTitle?.length ?? 0;

    // Meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : null;
    const metaDescriptionLength = metaDescription?.length ?? 0;

    // H1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const hasH1 = !!h1Match;
    const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 120) : null;

    // Schema
    const hasSchema = html.includes("application/ld+json");
    const hasOrgSchema = /"@type"\s*:\s*"Organization"/.test(html);
    const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/.test(html);
    const hasSoftwareSchema = /"@type"\s*:\s*"SoftwareApplication"/.test(html);

    // Canonical
    const hasCanonical = /rel=["']canonical["']/.test(html);

    // Images missing alt
    const imgTags = html.match(/<img[^>]*>/gi) ?? [];
    const imagesMissingAlt = imgTags.filter(t => !/\balt\s*=/i.test(t)).length;

    // Security headers
    const hsts = homeResp?.headers.get("strict-transport-security") !== null;
    const xFrameOptions = homeResp?.headers.get("x-frame-options") !== null;
    const hasCsp = homeResp?.headers.get("content-security-policy") !== null;
    const xContentTypeOptions = homeResp?.headers.get("x-content-type-options") !== null;
    const referrerPolicy = homeResp?.headers.get("referrer-policy") !== null;

    // CMS / framework / CDN / analytics (unchanged)
    let cms: string | null = null;
    if (/wp-content|wp-includes/i.test(html)) cms = "WordPress";
    else if (/webflow\.com|\.wf-page/i.test(html) || homeResp?.headers.get("x-wf-site")) cms = "Webflow";
    else if (/<meta[^>]+generator["']?\s*=?\s*["']Ghost/i.test(html)) cms = "Ghost";
    else if (/squarespace\.com|static\.squarespace/i.test(html)) cms = "Squarespace";
    else if (/shopify\.com|cdn\.shopify/i.test(html)) cms = "Shopify";
    else {
      const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,40})["']/i);
      if (gen) cms = gen[1].split(" ")[0] ?? null;
    }

    let framework: string | null = null;
    if (/_next\/static/i.test(html)) framework = "Next.js";
    else if (/__gatsby|gatsby-/i.test(html)) framework = "Gatsby";
    else if (/nuxt|__NUXT__/i.test(html)) framework = "Nuxt.js";
    else if (/data-reactroot|__NEXT_DATA__|react-dom/i.test(html)) framework = "React";
    else if (/ng-version|angular\.min\.js/i.test(html)) framework = "Angular";
    else if (/__svelte|svelte\.dev/i.test(html)) framework = "Svelte";
    else if (/vue\.js|vue\.min\.js|__vue__/i.test(html)) framework = "Vue.js";

    let cdn: string | null = null;
    if (homeResp?.headers.get("cf-ray")) cdn = "Cloudflare";
    else if (homeResp?.headers.get("x-vercel-id")) cdn = "Vercel";
    else if (homeResp?.headers.get("x-nf-request-id")) cdn = "Netlify";
    else if (homeResp?.headers.get("x-amz-cf-id")) cdn = "AWS CloudFront";
    else if ((homeResp?.headers.get("x-served-by") ?? "").includes("fastly")) cdn = "Fastly";

    const analytics: string[] = [];
    if (/gtag\(|G-[A-Z0-9]{6,}|analytics\.google\.com/i.test(html)) analytics.push("Google Analytics");
    if (/googletagmanager\.com/i.test(html)) analytics.push("GTM");
    if (/hotjar\.com|_hjSettings/i.test(html)) analytics.push("Hotjar");
    if (/mixpanel\.com/i.test(html)) analytics.push("Mixpanel");
    if (/posthog\.com|posthog\.init/i.test(html)) analytics.push("PostHog");
    if (/plausible\.io/i.test(html)) analytics.push("Plausible");
    if (/crisp\.chat|crispSDK/i.test(html)) analytics.push("Crisp");
    if (/intercom\.com|Intercom\(/i.test(html)) analytics.push("Intercom");

    // robots.txt
    const robotsResp = robotsResult.status === "fulfilled" ? robotsResult.value : null;
    const hasRobotsTxt = robotsResp?.ok ?? false;
    const robotsTxt = hasRobotsTxt ? await robotsResp!.text() : "";

    // sitemap + llms.txt
    const sitemapResp = sitemapResult.status === "fulfilled" ? sitemapResult.value : null;
    const hasSitemap = (sitemapResp?.ok && (sitemapResp.status ?? 0) < 400) ?? false;

    const llmsResp = llmsResult.status === "fulfilled" ? llmsResult.value : null;
    const hasLlmsTxt = (llmsResp?.ok && (llmsResp.status ?? 0) < 400) ?? false;

    // Bot access
    const gptBot = checkBotAccess(robotsTxt, "GPTBot");
    const perplexityBot = checkBotAccess(robotsTxt, "PerplexityBot");
    const claudeBot = checkBotAccess(robotsTxt, "ClaudeBot");
    const googleExtended = checkBotAccess(robotsTxt, "Google-Extended");

    const botAccess = [
      { bot: "GPTBot", name: "ChatGPT", ...gptBot },
      { bot: "PerplexityBot", name: "Perplexity", ...perplexityBot },
      { bot: "ClaudeBot", name: "Claude / Anthropic", ...claudeBot },
      { bot: "Google-Extended", name: "Google Gemini", ...googleExtended },
    ];

    // Dual scores
    const siteChecksPassing = [isHttps, !!metaTitle, !!metaDescription, hasH1, hasSitemap, hasCanonical, ttfbMs < 2000, hasRobotsTxt].filter(Boolean).length;
    const siteHealthScore = Math.round((siteChecksPassing / 8) * 100);

    const aiChecksPassing = [hasLlmsTxt, hasOrgSchema, hasFaqSchema, gptBot.allowed, perplexityBot.allowed, claudeBot.allowed, hasSchema, hasCanonical].filter(Boolean).length;
    const aiHealthScore = Math.round((aiChecksPassing / 8) * 100);

    // Save to history if authenticated
    if (userId) {
      db.insert(siteAuditHistoryTable).values({
        userId,
        domain: domainClean,
        siteHealthScore,
        aiHealthScore,
        errorsCount: (!isHttps ? 1 : 0) + (botAccess.filter(b => !b.allowed).length),
        warningsCount: [!metaTitle, !metaDescription, !hasH1, !hasSitemap, !hasLlmsTxt, !hasOrgSchema, !hasFaqSchema, !hasCanonical, imagesMissingAlt > 0, ttfbMs > 3000].filter(Boolean).length,
        results: { siteHealthScore, aiHealthScore, ttfbMs, statusCode },
      }).catch(() => { /* non-fatal */ });
    }

    res.json({
      ttfbMs,
      statusCode,
      isHttps,
      security: { hsts, clickjacking: xFrameOptions || hasCsp, mimeSniffing: xContentTypeOptions, referrerPolicy, score: [isHttps, hsts, xFrameOptions || hasCsp, xContentTypeOptions, referrerPolicy].filter(Boolean).length, total: 5 },
      techStack: { cms, framework, cdn, analytics, server: serverHeader.split("/")[0].trim() || null },
      metaTitle,
      metaTitleLength,
      metaDescription,
      metaDescriptionLength,
      hasH1,
      h1Text,
      hasSchema,
      hasOrgSchema,
      hasFaqSchema,
      hasSoftwareSchema,
      hasCanonical,
      imagesMissingAlt,
      hasSitemap,
      hasLlmsTxt,
      hasRobotsTxt,
      robotsTxt: robotsTxt.slice(0, 2000),
      botAccess,
      gptBotAllowed: gptBot.allowed,
      perplexityBotAllowed: perplexityBot.allowed,
      claudeBotAllowed: claudeBot.allowed,
      googleExtendedAllowed: googleExtended.allowed,
      siteHealthScore,
      aiHealthScore,
      pagesChecked: 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not fetch site";
    res.status(502).json({ error: msg });
  }
});

// ─── Deep multi-page site crawl ───────────────────────────────────────────────
router.post("/site-audit/crawl", async (req, res): Promise<void> => {
  const { domain } = req.body as { domain?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }
  try {
    const result = await crawlSite(domain, 25);
    // Optionally save to history if authenticated
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const user = await verifyToken(token);
      if (user) {
        await db.insert(siteAuditHistoryTable).values({
          userId: user,
          domain: result.domain,
          siteHealthScore: result.siteHealthScore,
          aiHealthScore: result.aiHealthScore,
          errorsCount: result.errorsCount,
          warningsCount: result.warningsCount,
          results: result as unknown as Record<string, unknown>,
        });
      }
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "site-audit/crawl failed");
    res.status(500).json({ error: "Crawl failed" });
  }
});

// ─── Site audit history (auth required) ──────────────────────────────────────
router.get("/site-audit-history", requireAuth, async (req, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  const userId = (req as AuthRequest).user.id;
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }
  const domainClean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    const rows = await db
      .select()
      .from(siteAuditHistoryTable)
      .where(and(eq(siteAuditHistoryTable.userId, userId), eq(siteAuditHistoryTable.domain, domainClean)))
      .orderBy(desc(siteAuditHistoryTable.auditedAt))
      .limit(8);
    res.json(rows.reverse());
  } catch {
    res.status(500).json({ error: "Could not fetch audit history" });
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
  if (result.estimatedCostUsd > 0) logDfsCost("serp_google_ai_overview", result.estimatedCostUsd, domain);
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

  if (result.estimatedCostUsd > 0) logDfsCost("onpage_audit", result.estimatedCostUsd, domain, (req as AuthRequest).user?.id);
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
  if (!result.cached && result.estimatedCostUsd > 0) logDfsCost("serp_chatgpt_scraper", result.estimatedCostUsd, domain, (req as AuthRequest).user?.id);
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
  if (!result.cached && result.estimatedCostUsd > 0) logDfsCost("serp_gemini_scraper", result.estimatedCostUsd, domain, (req as AuthRequest).user?.id);
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
  if (!result.cached && result.estimatedCostUsd > 0) logDfsCost("ai_keyword_volume", result.estimatedCostUsd, domain, (req as AuthRequest).user?.id);
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
  const user = (req as AuthRequest).user;
  const { domain, force } = req.query as { domain?: string; force?: string };
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  // Plan check: free users cannot use AI Presence
  const planLimits = getPlanLimits(user.plan);
  if (planLimits.llm_mention_domains === 0) {
    res.status(403).json({
      error: "domain_limit_reached",
      message: "AI Presence tracking requires a Starter or Agency plan.",
      upgrade_url: "/pricing",
      current_plan: user.plan,
    });
    return;
  }

  const bareD = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const rescanHours = planLimits.rescan_hours < 999 ? planLimits.rescan_hours : 72;
  const cacheTtlMs = rescanHours * 60 * 60 * 1000;
  const topCacheKey = `vis_ov_v2:${bareD}`;

  // Top-level cache: serves the full assembled response without re-running all sub-requests
  if (force !== "true") {
    const [cacheRow] = await db.select().from(dataforseoCacheTable).where(eq(dataforseoCacheTable.key, topCacheKey)).limit(1);
    if (cacheRow && cacheRow.expiresAt > new Date()) {
      req.log.info({ domain: bareD, key: topCacheKey }, "visibility-overview: top-level cache hit");
      res.json({ ...(cacheRow.data as object), from_cache: true, cached_at: cacheRow.cachedAt.toISOString(), expires_at: cacheRow.expiresAt.toISOString() });
      return;
    }
  } else {
    // Force refresh: only block if the cached result has real data and minimum time has not elapsed.
    // Allow re-scanning if the cached result was empty/zero (hasData=false) - no point rate-limiting that.
    const [cacheRow] = await db.select().from(dataforseoCacheTable).where(eq(dataforseoCacheTable.key, topCacheKey)).limit(1);
    if (cacheRow) {
      const cachedData = cacheRow.data as Record<string, unknown>;
      const cachedHasData = cachedData?.hasData === true;
      const hoursSince = (Date.now() - cacheRow.cachedAt.getTime()) / (1000 * 60 * 60);
      if (cachedHasData && hoursSince < rescanHours) {
        const hoursLeft = Math.ceil(rescanHours - hoursSince);
        res.status(429).json({
          error: "rescan_too_soon",
          message: `Next scan available in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
          hours_left: hoursLeft,
          rescan_hours: rescanHours,
        });
        return;
      }
    }
  }

  const brandName = extractBrandName(bareD);
  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const candidates = brandKeywordCandidates(brandName);
  req.log.info({ domain: bareD, brandName, candidates }, "visibility-overview: starting");

  try {
    // Pull from most recent GeoIQ audit (within 30 days). If none exists, trigger one on-demand.
    const AUDIT_MAX_AGE_DAYS = 30;
    const cutoff = new Date(Date.now() - AUDIT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const recentAudits = await db
      .select()
      .from(auditsTable)
      .where(and(eq(auditsTable.domain, bareD), gt(auditsTable.createdAt, cutoff)))
      .orderBy(desc(auditsTable.createdAt))
      .limit(1);
    let audit = recentAudits[0] ?? null;

    // No recent audit found - try Exa+Tavily web-evidence scan first, fall back to audit engine
    if (!audit) {
      req.log.info({ domain: bareD }, "visibility-overview: no recent audit, trying Exa+Tavily scan");
      try {
        const scanResult = await runAIPresenceScan(bareD);
        if (scanResult) {
          // Store scan result as an audit record so subsequent loads are fast
          const [inserted] = await db.insert(auditsTable).values({
            url: `https://${bareD}`,
            domain: bareD,
            brandName: scanResult.brandName,
            category: null,
            market: null,
            scoreTotal: scanResult.score,
            scoreChatgpt: scanResult.chatgptScore,
            scoreGemini: scanResult.geminiScore,
            scorePerplexity: scanResult.perplexityScore,
            chatgptFound: scanResult.chatgptFound,
            geminiFound: scanResult.geminiFound,
            perplexityFound: scanResult.perplexityFound,
            chatgptDetail: scanResult.chatgptEvidence,
            geminiDetail: scanResult.geminiEvidence,
            perplexityDetail: scanResult.perplexityEvidence,
            competitorsFound: [],
            keywordsUsed: [],
            rawResults: {
              source: "exa_tavily_scan",
              evidenceCount: scanResult.evidenceCount,
              topEvidence: scanResult.topEvidence,
              googleAio: scanResult.googleAio ?? null,
              platforms: scanResult.platforms,
              urlsCited: scanResult.urlsCited,
              citedSourcesCount: scanResult.citedSourcesCount,
              performingTopics: scanResult.performingTopics,
              topicOpportunities: scanResult.topicOpportunities,
              citedPagesList: scanResult.citedPagesList,
              citedSourcesList: scanResult.citedSourcesList,
            },
          }).returning();
          audit = inserted ?? null;
          req.log.info({ domain: bareD, score: scanResult.score, hasData: scanResult.hasData }, "visibility-overview: Exa+Tavily scan complete");
        } else {
          // Neither API key set - fall back to the full audit engine
          req.log.info({ domain: bareD }, "visibility-overview: no scan keys, falling back to audit engine");
          const AUDIT_TIMEOUT_MS = 90_000;
          const engineResult = await Promise.race([
            runAuditEngine(`https://${bareD}`, null, null, null),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Audit timed out after 90s")), AUDIT_TIMEOUT_MS)
            ),
          ]);
          if (!engineResult.unreachable) {
            const { brandName: engBrand, category: engCat, market: engMarket, chatgpt, gemini, perplexity, technicalAudit, keywordsUsed } = engineResult;
            const rawAiTotal = chatgpt.score + gemini.score + perplexity.score;
            const aiVisibilityScore = Math.min(Math.round(rawAiTotal * 100 / (3 * 33)), 100);
            const scoreTechnical = technicalAudit.overallScore;
            const scoreTotal = Math.round(aiVisibilityScore * 0.6 + scoreTechnical * 0.4);
            const allCompetitors = [...new Set([...chatgpt.competitors, ...gemini.competitors, ...perplexity.competitors])];
            const [inserted] = await db.insert(auditsTable).values({
              url: `https://${bareD}`,
              domain: bareD,
              brandName: engBrand,
              category: engCat,
              market: engMarket,
              scoreTotal,
              scoreChatgpt: chatgpt.score,
              scoreGemini: gemini.score,
              scorePerplexity: perplexity.score,
              chatgptFound: chatgpt.found,
              geminiFound: gemini.found,
              perplexityFound: perplexity.found,
              chatgptDetail: chatgpt.detail,
              geminiDetail: gemini.detail,
              perplexityDetail: perplexity.detail,
              competitorsFound: allCompetitors,
              keywordsUsed,
              rawResults: { source: "audit_engine", scoreAiVisibility: aiVisibilityScore, scoreTechnical },
            }).returning();
            audit = inserted ?? null;
          }
        }
      } catch (scanErr) {
        req.log.warn({ err: scanErr, domain: bareD }, "visibility-overview: scan failed, returning empty state");
      }
    }

    const bestKeyword = audit?.brandName ?? candidates[0]!;
    const score = audit?.scoreTotal ?? 0;
    const hasData = audit != null && (audit.chatgptFound || audit.geminiFound || audit.perplexityFound);

    // Extract Google AIO data stored by runAIPresenceScan (in rawResults JSON)
    type GoogleAioStored = {
      citedInAio: boolean;
      aioExists: boolean;
      aioText: string | null;
      keywordChecked: string | null;
    } | null;
    const rawData = (audit?.rawResults ?? null) as Record<string, unknown> | null;
    const googleAio = (rawData?.googleAio ?? null) as GoogleAioStored;

    // Build per-platform rows - prefer full platform list stored by runAIPresenceScan
    type StoredPlatform = { key: string; displayName: string; color: string; found: boolean; score: number; pct: number };
    const storedPlatforms = (rawData?.platforms ?? null) as StoredPlatform[] | null;
    const platformDefs: StoredPlatform[] = storedPlatforms?.length
      ? storedPlatforms
      : [
          { key: "chat_gpt", displayName: "ChatGPT", color: "#10A37F", found: audit?.chatgptFound ?? false, score: audit?.scoreChatgpt ?? 0, pct: 0 },
          { key: "gemini", displayName: "Gemini", color: "#4285F4", found: audit?.geminiFound ?? false, score: audit?.scoreGemini ?? 0, pct: 0 },
          { key: "perplexity", displayName: "Perplexity", color: "#20B2AA", found: audit?.perplexityFound ?? false, score: audit?.scorePerplexity ?? 0, pct: 0 },
        ];
    const activePlatforms = platformDefs.filter(p => p.found);
    const totalPlatformScore = activePlatforms.reduce((s, p) => s + p.score, 0);
    const platformData = activePlatforms.map(p => ({
      key: p.key,
      displayName: p.displayName,
      color: p.color,
      mentions: p.score,
      ai_search_volume: p.score,
      pct: totalPlatformScore > 0 ? Math.round((p.score / totalPlatformScore) * 100) : 0,
    }));

    const mentions = activePlatforms.length;
    const aiSearchVolume = 0;

    // Extract rich data stored by runAIPresenceScan (present for new scans only)
    type StoredTopic = { topic: string; platform: string; url: string; date: string | null; snippet: string };
    type StoredOpportunity = { topic: string; platform: string; url: string; date: string | null; opportunity: string };
    type StoredCitedPage = { url: string; title: string; snippet: string };
    type StoredCitedSource = { domain: string; title: string; url: string; favicon: string };

    const storedPerformingTopics = (rawData?.performingTopics ?? []) as StoredTopic[];
    const storedTopicOpportunities = (rawData?.topicOpportunities ?? []) as StoredOpportunity[];
    const storedCitedPagesList = (rawData?.citedPagesList ?? []) as StoredCitedPage[];
    const storedCitedSourcesList = (rawData?.citedSourcesList ?? []) as StoredCitedSource[];
    const citations = (rawData?.urlsCited as number | undefined) ?? 0;
    const citedPagesCount = storedCitedPagesList.length;

    const mergedPages = storedCitedPagesList.map(p => ({
      url: p.url,
      title: p.title,
      snippet: p.snippet,
      mentions: 1,
      ai_search_volume: 0,
    }));

    const performingData = {
      items: storedPerformingTopics.map(t => ({
        question: t.topic,
        platform: t.platform,
        model_name: t.platform,
        ai_search_volume: 0,
        location_code: 0,
        url: t.url,
        date: t.date,
        snippet: t.snippet,
      })),
      totalCount: storedPerformingTopics.length,
      cached: false,
    };

    const opportunitiesData = {
      items: storedTopicOpportunities.map(t => ({
        question: t.topic,
        platform: t.platform,
        model_name: t.platform,
        ai_search_volume: 0,
        location_code: 0,
        url: t.url,
        date: t.date,
        opportunity: t.opportunity,
      })),
      totalCount: storedTopicOpportunities.length,
      cached: false,
    };

    const countries: { code: number; name: string; mentions: number; pct: number }[] = [];

    const citedSources = storedCitedSourcesList.map(s => ({
      domain: s.domain,
      title: s.title,
      url: s.url,
      favicon: s.favicon,
      mentions: 1,
      ai_search_volume: 0,
    }));
    req.log.info({ domain: bareD, bestKeyword, score, hasData, platforms: activePlatforms.length, auditId: audit?.id ?? null }, "visibility-overview: done");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + cacheTtlMs);
    const resultPayload = {
      domain: bareD,
      brandName: bestKeyword,
      score,
      mentions,
      aiSearchVolume,
      citations,
      citedPagesCount,
      hasData,
      platforms: platformData,
      platformsNote: "Powered by live web intelligence",
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
      from_cache: false,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      googleAio: googleAio ?? null,
    };

    // Store top-level cache
    await db.insert(dataforseoCacheTable)
      .values({ key: topCacheKey, data: resultPayload as unknown as Record<string, unknown>, expiresAt })
      .onConflictDoUpdate({
        target: dataforseoCacheTable.key,
        set: { data: resultPayload as unknown as Record<string, unknown>, cachedAt: now, expiresAt },
      });

    res.json(resultPayload);
  } catch (err) {
    req.log.error({ err, domain }, "visibility-overview error");
    res.status(500).json({ error: "Failed to load visibility data. Please try again." });
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
  const user = (req as AuthRequest).user;
  const { yourDomain, competitorDomains, force } = req.body as {
    yourDomain?: string;
    competitorDomains?: string[];
    force?: boolean;
  };

  // Plan check: free users cannot use Brand Benchmarks
  const planLimits = getPlanLimits(user.plan);
  if (planLimits.competitor_slots === 0) {
    res.status(403).json({
      error: "domain_limit_reached",
      message: "Brand Benchmarks requires a Starter or Agency plan.",
      upgrade_url: "/pricing",
      current_plan: user.plan,
    });
    return;
  }

  if (!yourDomain) { res.status(400).json({ error: "yourDomain is required" }); return; }

  // Cap competitors to plan limit
  const cappedCompetitors = Array.isArray(competitorDomains)
    ? competitorDomains.slice(0, planLimits.competitor_slots)
    : [];

  // Normalize to lowercase so extractBrandName regex strips TLDs correctly
  const allDomains = [yourDomain, ...cappedCompetitors]
    .filter(Boolean)
    .map(d => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? d);
  const today = new Date().toISOString().split("T")[0]!;
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const rescanHours = planLimits.rescan_hours < 999 ? planLimits.rescan_hours : 72;
  const cacheTtlMs = rescanHours * 60 * 60 * 1000;
  const topCacheKey = `comp_res_v1:${allDomains.join(":")}`;

  // Top-level cache
  if (!force) {
    const [cacheRow] = await db.select().from(dataforseoCacheTable).where(eq(dataforseoCacheTable.key, topCacheKey)).limit(1);
    if (cacheRow && cacheRow.expiresAt > new Date()) {
      req.log.info({ domains: allDomains, key: topCacheKey }, "competitor-research: top-level cache hit");
      res.json({ ...(cacheRow.data as object), from_cache: true, cached_at: cacheRow.cachedAt.toISOString(), expires_at: cacheRow.expiresAt.toISOString() });
      return;
    }
  } else {
    // Force refresh: block if minimum rescan time has not elapsed
    const [cacheRow] = await db.select().from(dataforseoCacheTable).where(eq(dataforseoCacheTable.key, topCacheKey)).limit(1);
    if (cacheRow) {
      const hoursSince = (Date.now() - cacheRow.cachedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < rescanHours) {
        const hoursLeft = Math.ceil(rescanHours - hoursSince);
        res.status(429).json({
          error: "rescan_too_soon",
          message: `Next scan available in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
          hours_left: hoursLeft,
          rescan_hours: rescanHours,
        });
        return;
      }
    }
  }

  req.log.info({ domains: allDomains, dateFrom: sixMonthsAgo, dateTo: today }, "competitor-research: start");

  try {
    // DataForSEO LLM Mentions API calls removed to eliminate ~$1.60/call cost.
    // Competitor scores are zeroed pending an alternative data source.
    const domainResults: { domain: string; brandName: string; bestKeyword: string; mentions: number; citations: number; citedPages: number; score: number; isYou: boolean }[] = [];
    for (const [idx, domain] of allDomains.entries()) {
      const brandName = extractBrandName(domain);
      const candidates = brandKeywordCandidates(brandName);
      const bestKeyword = candidates[0]!;
      domainResults.push({ domain, brandName, bestKeyword, mentions: 0, citations: 0, citedPages: 0, score: 0, isYou: idx === 0 });
    }

    type TopicItem = { question: string; platform: string; model_name: string; ai_search_volume: number; location_code: number; sources: string[]; brandEntities: string[]; monthlySearches: Array<{ year: number; month: number; count: number }>; answer: string };
    const yourTopics: { items: TopicItem[]; totalCount: number; cached: boolean } = { items: [], totalCount: 0, cached: false };
    const compTopics: { items: TopicItem[]; totalCount: number; cached: boolean } = { items: [], totalCount: 0, cached: false };
    req.log.info({ domains: allDomains }, "competitor-research: LLM API calls disabled, returning zeroed metrics");

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

    // Generate insights via Claude
    let insights: string[] = [];
    try {
      const you = domainResults[0]!;
      const comp = domainResults[1];
      if (comp) {
        const topMissing = topicList.filter(t => t.status === "missing").slice(0, 3).map(t => t.topic);
        const topUnique = topicList.filter(t => t.status === "unique").slice(0, 3).map(t => t.topic);
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 300,
          system: `You are a GEO competitive analyst. Write specific, actionable insights. No em dashes. No asterisks. No bullet points. Return plain text only.`,
          messages: [{
            role: "user",
            content: `Write 2 competitor insights based on this real data:

User domain: ${you.domain}
User score: ${you.score}/100
User AI mentions: ${you.mentions.toLocaleString()}

Competitor: ${comp.domain}
Competitor score: ${comp.score}/100
Competitor AI mentions: ${comp.mentions.toLocaleString()}

Topics where competitor leads: ${topMissing.join(", ") || "none found"}
Topics where user leads: ${topUnique.join(", ") || "none found"}

Each insight: specific problem + specific fix. Under 60 words each. Plain text. Two sentences only.`,
          }],
        });
        const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
        insights = text.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 2);
      }
    } catch (err) {
      req.log.warn({ err }, "competitor-research: insights generation failed");
    }

    req.log.info({ domains: allDomains, scores: domainResults.map(d => d.score), topics: topicList.length, topicCounts, sources: sources.length }, "competitor-research: done");
    logDfsCost("competitor-research", 0, allDomains.join(","), user.id ?? "unknown");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + cacheTtlMs);
    const resultPayload = {
      domains: domainResults,
      trend: [],
      topics: topicList,
      topicCounts,
      insights,
      sources,
      cached: false,
      analyzedAt: now.toISOString(),
      from_cache: false,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    // Store top-level cache
    await db.insert(dataforseoCacheTable)
      .values({ key: topCacheKey, data: resultPayload as unknown as Record<string, unknown>, expiresAt })
      .onConflictDoUpdate({
        target: dataforseoCacheTable.key,
        set: { data: resultPayload as unknown as Record<string, unknown>, cachedAt: now, expiresAt },
      });

    res.json(resultPayload);
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
    // DataForSEO LLM Mentions API calls removed to eliminate ~$1.60/call cost.
    type PromptItem = { question: string; platform: string; model_name: string; ai_search_volume: number; location_code: number; sources: string[]; brandEntities: string[]; monthlySearches: Array<{ year: number; month: number; count: number }>; answer: string };
    const allItems: PromptItem[] = [];
    req.log.info({ brandName, total: 0 }, "prompt-research: LLM API calls disabled");

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
    const NON_BRANDS = new Set([
      "the", "a", "an", "some", "top", "best", "new", "free", "video",
      "streaming", "service", "services", "platform", "app", "content",
      "media", "online", "digital", "watch", "movies", "shows", "series",
      "episodes", "subscription", "plan", "price", "cost", "how", "what",
      "why", "when", "where", "and", "or", "but", "for", "with", "from",
      "that", "this", "these", "those", "can", "will", "you", "your",
      "their", "there", "here", "also", "more", "most", "other", "users",
      "people", "way", "ways", "like", "just", "even", "also", "still",
      "many", "much", "use", "used", "get", "has", "have", "had",
    ]);
    function extractBrandsFromText(text: string): string[] {
      if (!text) return [];
      const words = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?\b/g) ?? [];
      const freq: Record<string, number> = {};
      for (const w of words) {
        if (NON_BRANDS.has(w.toLowerCase())) continue;
        if (/^\d+$/.test(w)) continue;
        if (w.split(" ").length > 4) continue;
        freq[w] = (freq[w] ?? 0) + 1;
      }
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
      cached: false,
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

// ─── Prompt Tracking Count ────────────────────────────────────────────────────
router.get("/dataforseo/prompt-tracking/count", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rows = await db
    .select({ id: promptTrackingTable.id })
    .from(promptTrackingTable)
    .where(eq(promptTrackingTable.userId, user.id));
  res.json({ count: rows.length });
});

// ─── Batch Monitor Prompts ────────────────────────────────────────────────────
router.post("/dataforseo/monitor-prompt-batch", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { prompts, platforms, topic, domain } = req.body as {
    prompts?: string[];
    platforms?: string[];
    topic?: string;
    domain?: string;
  };
  if (!prompts?.length || !platforms?.length) {
    res.status(400).json({ error: "prompts and platforms are required" });
    return;
  }

  const LIMIT = 50;
  const existing = await db
    .select({ id: promptTrackingTable.id })
    .from(promptTrackingTable)
    .where(eq(promptTrackingTable.userId, user.id));

  const slots = LIMIT - existing.length;
  if (slots <= 0) {
    res.status(403).json({ error: "Prompt limit reached (50/50). Upgrade to Agency plan for unlimited tracking." });
    return;
  }

  const rows: Array<{ userId: string; prompt: string; platform: string; topic: string | null; yourDomain: string | null }> = [];
  outer: for (const prompt of prompts) {
    for (const platform of platforms) {
      if (rows.length >= slots) break outer;
      rows.push({ userId: user.id, prompt: prompt.trim(), platform, topic: topic ?? null, yourDomain: domain ?? null });
    }
  }

  if (rows.length > 0) await db.insert(promptTrackingTable).values(rows);

  req.log.info({ topic, added: rows.length, platforms }, "monitor-prompt-batch: saved");
  res.json({ ok: true, added: rows.length, slotsUsed: existing.length + rows.length, limit: LIMIT });
});

export default router;
