// Multi-page site crawler with Google PageSpeed Insights for Core Web Vitals.
// No DataForSEO OnPage plan required.

const UA = "GeoIQ-Audit/1.0 (+https://geoiqai.com)";

export interface PageCrawlResult {
  url: string;
  status: number;
  ttfbMs: number;
  sizeBytes: number;
  isHttps: boolean;
  isCompressed: boolean;
  textRatio: number;
  metaTitle: string | null;
  metaTitleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  hasH1: boolean;
  hasSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  internalLinkCount: number;
  issues: string[];
  category: "healthy" | "broken" | "redirect" | "issues";
}

export interface CwvMetric {
  displayValue: string;
  numericValue: number;
  score: "good" | "needs-improvement" | "poor";
}

export interface CoreWebVitals {
  performanceScore: number;
  lcp: CwvMetric | null;
  cls: CwvMetric | null;
  tbt: CwvMetric | null;
  fcp: CwvMetric | null;
  tti: CwvMetric | null;
  speedIndex: CwvMetric | null;
  ttfbPsi: CwvMetric | null;
  overallCategory: "FAST" | "AVERAGE" | "SLOW" | null;
  strategy: "mobile" | "desktop";
}

export interface CrawlIssue {
  id: string;
  title: string;
  severity: "error" | "warning" | "notice";
  pageCount: number;
  description: string;
  fixType: string;
  affectedPages: string[];
}

export interface SiteCrawlResult {
  domain: string;
  crawledCount: number;
  pageBreakdown: { healthy: number; broken: number; hasIssues: number; redirects: number };
  siteHealthScore: number;
  aiHealthScore: number;
  errorsCount: number;
  warningsCount: number;
  issues: CrawlIssue[];
  thematicScores: {
    crawlability: number;
    https: number;
    performance: number;
    internalLinking: number;
    markup: number;
    aiSearch: number;
  };
  botAccess: { bot: string; name: string; allowed: boolean; note: string }[];
  hasRobotsTxt: boolean;
  hasLlmsTxt: boolean;
  hasSitemap: boolean;
  robotsTxt: string;
  pages: PageCrawlResult[];
  cwv: CoreWebVitals | null;
  // Homepage signals
  metaTitle: string | null;
  metaTitleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  hasH1: boolean;
  h1Text: string | null;
  hasSchema: boolean;
  hasOrgSchema: boolean;
  hasFaqSchema: boolean;
  hasCanonical: boolean;
  imagesMissingAlt: number;
  ttfbMs: number;
  statusCode: number;
  isHttps: boolean;
  gptBotAllowed: boolean;
  perplexityBotAllowed: boolean;
  claudeBotAllowed: boolean;
  googleExtendedAllowed: boolean;
  security: { hsts: boolean; clickjacking: boolean; mimeSniffing: boolean; referrerPolicy: boolean; score: number; total: number };
  techStack: { cms: string | null; framework: string | null; cdn: string | null; analytics: string[]; server: string | null };
  isJsRendered: boolean;
}

const ISSUE_DEFS: Omit<CrawlIssue, "pageCount" | "affectedPages">[] = [
  { id: "broken_page",         severity: "error",   title: "Broken page (4xx/5xx response)",        description: "These pages cannot be crawled by AI systems.",                                          fixType: "broken_page" },
  { id: "slow_page",           severity: "error",   title: "Slow server response (TTFB over 3s)",    description: "Slow pages get lower priority in AI crawler queues.",                                   fixType: "slow_server" },
  { id: "missing_title",       severity: "warning", title: "Missing meta title",                     description: "AI systems use the page title to understand and categorize content.",                   fixType: "missing_title" },
  { id: "title_too_long",      severity: "warning", title: "Meta title over 60 characters",          description: "Long titles get truncated in AI-generated summaries.",                                  fixType: "title_too_long" },
  { id: "missing_description", severity: "warning", title: "Missing meta description",               description: "AI systems use meta descriptions to generate page summaries.",                          fixType: "missing_description" },
  { id: "missing_h1",          severity: "warning", title: "No H1 heading on page",                  description: "H1 headings tell AI systems what the page is primarily about.",                         fixType: "missing_h1" },
  { id: "missing_schema",      severity: "warning", title: "No structured data (JSON-LD)",           description: "Schema markup helps AI extract facts and relationships from your content.",              fixType: "missing_schema" },
  { id: "missing_canonical",   severity: "warning", title: "No canonical tag",                       description: "Missing canonicals can cause duplicate content confusion for crawlers.",                fixType: "missing_canonical" },
  { id: "missing_alt",         severity: "warning", title: "Images missing alt text",                description: "Alt text helps AI systems understand visual content.",                                  fixType: "missing_alt" },
  { id: "large_page",          severity: "warning", title: "Large page (over 500KB HTML)",           description: "Large pages take longer to crawl and are sometimes de-prioritized.",                    fixType: "large_page" },
  { id: "no_compression",      severity: "warning", title: "Page not compressed (no gzip/brotli)",   description: "Uncompressed pages transfer 60-80% more data and load slower.",                        fixType: "no_compression" },
  { id: "low_text_ratio",      severity: "warning", title: "Low text-to-HTML ratio (under 10%)",     description: "Very little readable text relative to HTML - AI systems may treat this as thin content.", fixType: "low_text_ratio" },
  { id: "no_internal_links",   severity: "notice",  title: "Page has no internal links",             description: "Isolated pages are harder to discover and may not be crawled regularly.",               fixType: "no_internal_links" },
];

// ─── CWV scoring helpers ───────────────────────────────────────────────────────

function cwvScore(score: number | null | undefined): "good" | "needs-improvement" | "poor" {
  if (score === null || score === undefined) return "poor";
  if (score >= 0.9) return "good";
  if (score >= 0.5) return "needs-improvement";
  return "poor";
}

function parsePsiAudit(audit: Record<string, unknown> | undefined): CwvMetric | null {
  if (!audit) return null;
  return {
    displayValue: String(audit.displayValue ?? ""),
    numericValue: Number(audit.numericValue ?? 0),
    score: cwvScore(audit.score as number),
  };
}

async function fetchPageSpeedInsights(url: string): Promise<CoreWebVitals | null> {
  try {
    const key = process.env.GOOGLE_PSI_API_KEY ?? "";
    const keyParam = key ? `&key=${encodeURIComponent(key)}` : "";
    const [mobileResp] = await Promise.all([
      fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${keyParam}`,
        { signal: AbortSignal.timeout(25000) },
      ).then(r => r.ok ? r.json() as Promise<Record<string, unknown>> : null).catch(() => null),
    ]);

    const data = mobileResp as Record<string, unknown> | null;
    if (!data) return null;

    const lr = data.lighthouseResult as Record<string, unknown> | undefined;
    const audits = (lr?.audits ?? {}) as Record<string, Record<string, unknown>>;
    const categories = (lr?.categories ?? {}) as Record<string, Record<string, unknown>>;
    const le = data.loadingExperience as Record<string, unknown> | undefined;

    const perfScore = Math.round(((categories.performance?.score as number) ?? 0) * 100);
    const overallCat = (le?.overall_category as string | undefined) ?? null;

    return {
      performanceScore: perfScore,
      lcp:        parsePsiAudit(audits["largest-contentful-paint"]),
      cls:        parsePsiAudit(audits["cumulative-layout-shift"]),
      tbt:        parsePsiAudit(audits["total-blocking-time"]),
      fcp:        parsePsiAudit(audits["first-contentful-paint"]),
      tti:        parsePsiAudit(audits["interactive"]),
      speedIndex: parsePsiAudit(audits["speed-index"]),
      ttfbPsi:    parsePsiAudit(audits["server-response-time"]),
      overallCategory: (overallCat === "FAST" || overallCat === "AVERAGE" || overallCat === "SLOW") ? overallCat : null,
      strategy: "mobile",
    };
  } catch {
    return null;
  }
}

// ─── Robots.txt bot access parser ─────────────────────────────────────────────

function checkBotAccess(robotsTxt: string, botName: string): { allowed: boolean; note: string } {
  if (!robotsTxt.trim()) return { allowed: true, note: "Not explicitly blocked (no robots.txt)" };
  const lines = robotsTxt.split("\n").map(l => (l.split("#")[0] ?? "").trim()).filter(Boolean);
  let inBot = false; let inWild = false; let botFound = false;
  let botDisallow = false; let wildDisallow = false;
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
  if (botFound) return botDisallow ? { allowed: false, note: `Blocked by User-agent: ${botName}` } : { allowed: true, note: "Allowed (explicit rule)" };
  return wildDisallow ? { allowed: false, note: "Blocked by wildcard (*) rule" } : { allowed: true, note: "Not explicitly blocked" };
}

// ─── URL extractors ────────────────────────────────────────────────────────────

function extractSitemapUrls(xml: string, origin: string, max: number): string[] {
  const locs = xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const loc of locs) {
    const url = loc.replace(/<\/?loc>/g, "").trim();
    try {
      const u = new URL(url);
      if (u.origin !== origin) continue;
      if (/\.(xml|rss|jpg|jpeg|png|gif|webp|svg|css|js|woff|woff2|ttf|pdf|zip)$/i.test(u.pathname)) continue;
      const norm = u.origin + u.pathname;
      if (!seen.has(norm)) { seen.add(norm); urls.push(norm); if (urls.length >= max) break; }
    } catch { continue; }
  }
  return urls;
}

function extractInternalLinks(html: string, origin: string, max: number): string[] {
  const hrefMatches = html.match(/href=["']([^"'#?][^"']*)["']/g) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of hrefMatches) {
    const href = m.match(/href=["']([^"']+)["']/)?.[1] ?? "";
    let url: string;
    if (href.startsWith("http")) url = href;
    else if (href.startsWith("/")) url = origin + href;
    else continue;
    try {
      const u = new URL(url);
      if (u.origin !== origin) continue;
      if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|woff|pdf|zip|ico)$/i.test(u.pathname)) continue;
      const norm = u.origin + u.pathname.replace(/\/$/, "") + "/";
      if (!seen.has(norm)) { seen.add(norm); urls.push(norm); if (urls.length >= max) break; }
    } catch { continue; }
  }
  return urls;
}

// ─── Single page crawler ──────────────────────────────────────────────────────

async function crawlPage(url: string): Promise<PageCrawlResult> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    const ttfbMs = Date.now() - start;
    const status = resp.status;

    if (status >= 300 && status < 400) {
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), isCompressed: false, textRatio: 0, metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: [], category: "redirect" };
    }
    if (status >= 400 || status === 0) {
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), isCompressed: false, textRatio: 0, metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: ["broken_page"], category: "broken" };
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), isCompressed: false, textRatio: 0, metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: [], category: "healthy" };
    }

    // Compression check (before reading body)
    const contentEncoding = resp.headers.get("content-encoding") ?? "";
    const isCompressed = /gzip|br|deflate|zstd/i.test(contentEncoding);

    const html = await resp.text();
    const sizeBytes = Buffer.byteLength(html, "utf8");
    const issues: string[] = [];

    if (!isCompressed) issues.push("no_compression");

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
    const metaTitleLength = metaTitle?.length ?? 0;
    if (!metaTitle) issues.push("missing_title");
    else if (metaTitleLength > 60) issues.push("title_too_long");

    // Description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : null;
    const metaDescriptionLength = metaDescription?.length ?? 0;
    if (!metaDescription) issues.push("missing_description");

    // H1
    const hasH1 = /<h1[^>]*>/i.test(html);
    if (!hasH1) issues.push("missing_h1");

    // Schema
    const hasSchema = html.includes("application/ld+json");
    if (!hasSchema) issues.push("missing_schema");

    // Canonical
    const hasCanonical = /rel=["']canonical["']/.test(html);
    if (!hasCanonical) issues.push("missing_canonical");

    // Images without alt
    const imgTags = html.match(/<img[^>]*>/gi) ?? [];
    const imagesMissingAlt = imgTags.filter(t => !/\balt\s*=/i.test(t)).length;
    if (imagesMissingAlt > 0) issues.push("missing_alt");

    // Page size
    if (sizeBytes > 500 * 1024) issues.push("large_page");

    // Slow response
    if (ttfbMs > 3000) issues.push("slow_page");

    // Text-to-HTML ratio
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const textRatio = html.length > 0 ? Math.round((textContent.length / html.length) * 100) : 0;
    if (textRatio < 10 && sizeBytes > 5 * 1024) issues.push("low_text_ratio");

    // Internal links
    let origin = "";
    try { origin = new URL(url).origin; } catch { /* ignore */ }
    const internalLinkCount = (html.match(/href=["']([^"']+)["']/g) ?? [])
      .filter(h => { const href = h.match(/href=["']([^"']+)["']/)?.[1] ?? ""; return href.startsWith("/") || href.includes(origin.replace("https://", "").replace("http://", "")); }).length;
    if (internalLinkCount === 0) issues.push("no_internal_links");

    return { url, status, ttfbMs, sizeBytes, isHttps: url.startsWith("https://"), isCompressed, textRatio, metaTitle, metaTitleLength, metaDescription, metaDescriptionLength, hasH1, hasSchema, hasCanonical, imagesMissingAlt, internalLinkCount, issues, category: issues.length === 0 ? "healthy" : "issues" };
  } catch {
    return { url, status: 0, ttfbMs: Date.now() - start, sizeBytes: 0, isHttps: url.startsWith("https://"), isCompressed: false, textRatio: 0, metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: ["broken_page"], category: "broken" };
  }
}

async function crawlBatches(urls: string[], batchSize: number): Promise<PageCrawlResult[]> {
  const results: PageCrawlResult[] = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(url => crawlPage(url)));
    results.push(...batchResults);
  }
  return results;
}

// ─── Main crawl function ──────────────────────────────────────────────────────

export async function crawlSite(domain: string, maxPages = 25): Promise<SiteCrawlResult> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
  let origin: string;
  try { origin = new URL(base).origin; } catch { origin = base; }
  const domainClean = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const homeUrl = `${base}/`;

  // Phase 1: Parallel fetch homepage + robots + sitemap + llms.txt + PageSpeed
  const fetchStart = Date.now();
  const [homeResult, robotsResult, sitemapResult, llmsResult, psiResult] = await Promise.allSettled([
    fetch(homeUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), redirect: "follow" }),
    fetch(`${base}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
    fetch(`${base}/sitemap.xml`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
    fetch(`${base}/llms.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
    fetchPageSpeedInsights(homeUrl),
  ]);
  const ttfbMs = Date.now() - fetchStart;

  const homeResp = homeResult.status === "fulfilled" ? homeResult.value : null;
  const statusCode = homeResp?.status ?? 0;
  const isHttps = base.startsWith("https://") && (homeResp?.ok ?? false);
  const html = homeResp?.ok ? await homeResp.text() : "";
  const serverHeader = homeResp?.headers.get("server") ?? "";

  const cwv: CoreWebVitals | null = psiResult.status === "fulfilled" ? psiResult.value : null;

  // robots.txt
  const robotsResp = robotsResult.status === "fulfilled" ? robotsResult.value : null;
  const hasRobotsTxt = robotsResp?.ok ?? false;
  const robotsTxt = hasRobotsTxt ? await robotsResp!.text() : "";

  // sitemap + llms
  const sitemapResp = sitemapResult.status === "fulfilled" ? sitemapResult.value : null;
  const hasSitemap = (sitemapResp?.ok && (sitemapResp.status ?? 0) < 400) ?? false;
  const llmsResp = llmsResult.status === "fulfilled" ? llmsResult.value : null;
  const hasLlmsTxt = (llmsResp?.ok && (llmsResp.status ?? 0) < 400) ?? false;

  // Security headers
  const hsts = homeResp?.headers.get("strict-transport-security") !== null;
  const xFrame = homeResp?.headers.get("x-frame-options") !== null;
  const hasCsp = homeResp?.headers.get("content-security-policy") !== null;
  const mimeSniff = homeResp?.headers.get("x-content-type-options") !== null;
  const referrer = homeResp?.headers.get("referrer-policy") !== null;

  // Tech stack
  let cms: string | null = null;
  if (/wp-content|wp-includes/i.test(html)) cms = "WordPress";
  else if (/webflow\.com|\.wf-page/i.test(html)) cms = "Webflow";
  else if (/<meta[^>]+generator["']?\s*=?\s*["']Ghost/i.test(html)) cms = "Ghost";
  else if (/squarespace\.com/i.test(html)) cms = "Squarespace";
  else if (/shopify\.com|cdn\.shopify/i.test(html)) cms = "Shopify";
  else { const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,40})["']/i); if (gen) cms = gen[1].split(" ")[0] ?? null; }

  let framework: string | null = null;
  if (/_next\/static/i.test(html)) framework = "Next.js";
  else if (/__gatsby/i.test(html)) framework = "Gatsby";
  else if (/nuxt|__NUXT__/i.test(html)) framework = "Nuxt.js";
  else if (/data-reactroot|__NEXT_DATA__/i.test(html)) framework = "React";
  else if (/ng-version/i.test(html)) framework = "Angular";
  else if (/__svelte/i.test(html)) framework = "Svelte";
  else if (/vue\.js|__vue__/i.test(html)) framework = "Vue.js";

  // JS-rendered detection: heavy client-side framework with very little raw text
  const rawTextLen = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  const isJsRendered = !!(framework && ["React", "Angular", "Vue.js", "Svelte"].includes(framework) && rawTextLen < 500);

  let cdn: string | null = null;
  if (homeResp?.headers.get("cf-ray")) cdn = "Cloudflare";
  else if (homeResp?.headers.get("x-vercel-id")) cdn = "Vercel";
  else if (homeResp?.headers.get("x-nf-request-id")) cdn = "Netlify";
  else if (homeResp?.headers.get("x-amz-cf-id")) cdn = "AWS CloudFront";

  const analytics: string[] = [];
  if (/gtag\(|G-[A-Z0-9]{6,}/i.test(html)) analytics.push("Google Analytics");
  if (/googletagmanager\.com/i.test(html)) analytics.push("GTM");
  if (/hotjar\.com/i.test(html)) analytics.push("Hotjar");
  if (/posthog\.com/i.test(html)) analytics.push("PostHog");
  if (/plausible\.io/i.test(html)) analytics.push("Plausible");
  if (/crisp\.chat/i.test(html)) analytics.push("Crisp");
  if (/intercom\.com/i.test(html)) analytics.push("Intercom");

  // Homepage signals
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  const metaTitleLength = metaTitle?.length ?? 0;
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const metaDescription = descMatch ? descMatch[1].trim() : null;
  const metaDescriptionLength = metaDescription?.length ?? 0;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const hasH1 = !!h1Match;
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 120) : null;
  const hasSchema = html.includes("application/ld+json");
  const hasOrgSchema = /"@type"\s*:\s*"Organization"/.test(html);
  const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/.test(html);
  const hasCanonical = /rel=["']canonical["']/.test(html);
  const imgTags = html.match(/<img[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgTags.filter(t => !/\balt\s*=/i.test(t)).length;

  // Bot access
  const gptBot = checkBotAccess(robotsTxt, "GPTBot");
  const perplexityBot = checkBotAccess(robotsTxt, "PerplexityBot");
  const claudeBot = checkBotAccess(robotsTxt, "ClaudeBot");
  const googleExtended = checkBotAccess(robotsTxt, "Google-Extended");
  const botAccess = [
    { bot: "GPTBot",          name: "ChatGPT",          ...gptBot },
    { bot: "PerplexityBot",   name: "Perplexity",       ...perplexityBot },
    { bot: "ClaudeBot",       name: "Claude / Anthropic", ...claudeBot },
    { bot: "Google-Extended", name: "Google Gemini",    ...googleExtended },
  ];

  // Phase 2: Collect URLs to crawl
  let urlsToCrawl: string[] = [];
  if (hasSitemap && sitemapResp?.ok) {
    try {
      const sitemapXml = await sitemapResp.text();
      urlsToCrawl = extractSitemapUrls(sitemapXml, origin, maxPages);
    } catch { /* ignore */ }
  }
  if (urlsToCrawl.length < 3 && html) {
    const links = extractInternalLinks(html, origin, maxPages - 1);
    const homeNorm = `${origin}/`;
    const combined = [homeNorm, ...links.filter(l => l !== homeNorm)];
    const seen = new Set<string>();
    urlsToCrawl = [];
    for (const u of combined) { if (!seen.has(u)) { seen.add(u); urlsToCrawl.push(u); } }
    urlsToCrawl = urlsToCrawl.slice(0, maxPages);
  }
  const homeNorm = `${origin}/`;
  if (!urlsToCrawl.includes(homeNorm)) urlsToCrawl.unshift(homeNorm);

  // Phase 3: Crawl all pages in parallel batches of 8
  const pages = await crawlBatches(urlsToCrawl.slice(0, maxPages), 8);

  // Phase 4: Aggregate
  const healthy = pages.filter(p => p.category === "healthy").length;
  const broken = pages.filter(p => p.category === "broken").length;
  const hasIssuesCount = pages.filter(p => p.category === "issues").length;
  const redirects = pages.filter(p => p.category === "redirect").length;
  const htmlPages = pages.filter(p => p.category !== "redirect");

  const issueCounts = new Map<string, number>();
  const issuePages = new Map<string, string[]>();
  for (const page of pages) {
    for (const issue of page.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      const arr = issuePages.get(issue) ?? [];
      arr.push(page.url);
      issuePages.set(issue, arr);
    }
  }

  const issues: CrawlIssue[] = ISSUE_DEFS
    .filter(d => (issueCounts.get(d.id) ?? 0) > 0)
    .map(d => ({ ...d, pageCount: issueCounts.get(d.id) ?? 0, affectedPages: issuePages.get(d.id) ?? [] }))
    .sort((a, b) => ({ error: 0, warning: 1, notice: 2 }[a.severity] - { error: 0, warning: 1, notice: 2 }[b.severity] || b.pageCount - a.pageCount));

  const errorsCount = issues.filter(i => i.severity === "error").reduce((s, i) => s + i.pageCount, 0);
  const warningsCount = issues.filter(i => i.severity === "warning").reduce((s, i) => s + i.pageCount, 0);

  // Thematic scores
  const n = htmlPages.length || 1;
  const crawlability = Math.round((1 - broken / (pages.length || 1)) * 100);
  const httpsScore = Math.round(htmlPages.filter(p => p.isHttps).length / n * 100);
  const compressedPages = htmlPages.filter(p => p.isCompressed).length;
  const performanceScore = cwv
    ? cwv.performanceScore
    : Math.round(htmlPages.filter(p => p.ttfbMs < 2000 && p.ttfbMs > 0).length / n * 100);
  const linkingScore = Math.round(htmlPages.filter(p => p.internalLinkCount > 0).length / n * 100);
  const markupScore = Math.round(htmlPages.filter(p => p.hasSchema).length / n * 100);
  const compressionScore = Math.round(compressedPages / n * 100);

  const aiChecks = [hasLlmsTxt, hasOrgSchema, hasFaqSchema, gptBot.allowed, perplexityBot.allowed, claudeBot.allowed, hasSchema, hasCanonical];
  const aiSearchScore = Math.round(aiChecks.filter(Boolean).length / aiChecks.length * 100);

  // Site health: weighted average
  const siteHealthScore = Math.round(
    crawlability * 0.25 + httpsScore * 0.15 + performanceScore * 0.25 +
    linkingScore * 0.15 + markupScore * 0.1 + compressionScore * 0.1
  );

  return {
    domain: domainClean,
    crawledCount: pages.length,
    pageBreakdown: { healthy, broken, hasIssues: hasIssuesCount, redirects },
    siteHealthScore,
    aiHealthScore: aiSearchScore,
    errorsCount,
    warningsCount,
    issues,
    thematicScores: { crawlability, https: httpsScore, performance: performanceScore, internalLinking: linkingScore, markup: markupScore, aiSearch: aiSearchScore },
    botAccess,
    hasRobotsTxt, hasLlmsTxt, hasSitemap,
    robotsTxt: robotsTxt.slice(0, 2000),
    pages: pages.slice(0, 50),
    cwv,
    metaTitle, metaTitleLength,
    metaDescription, metaDescriptionLength,
    hasH1, h1Text,
    hasSchema, hasOrgSchema, hasFaqSchema, hasCanonical,
    imagesMissingAlt, ttfbMs, statusCode, isHttps,
    gptBotAllowed: gptBot.allowed,
    perplexityBotAllowed: perplexityBot.allowed,
    claudeBotAllowed: claudeBot.allowed,
    googleExtendedAllowed: googleExtended.allowed,
    security: { hsts, clickjacking: xFrame || hasCsp, mimeSniffing: mimeSniff, referrerPolicy: referrer, score: [isHttps, hsts, xFrame || hasCsp, mimeSniff, referrer].filter(Boolean).length, total: 5 },
    techStack: { cms, framework, cdn, analytics, server: serverHeader.split("/")[0].trim() || null },
    isJsRendered,
  };
}
