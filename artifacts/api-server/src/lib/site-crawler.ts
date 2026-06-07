// Multi-page site crawler - no DataForSEO required.
// Fetches pages in parallel batches, detects per-page issues, aggregates scores.

const UA = "GeoIQ-Audit/1.0 (+https://geoiqai.com)";

export interface PageCrawlResult {
  url: string;
  status: number;
  ttfbMs: number;
  sizeBytes: number;
  isHttps: boolean;
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

export interface CrawlIssue {
  id: string;
  title: string;
  severity: "error" | "warning" | "notice";
  pageCount: number;
  description: string;
  fixType: string;
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
  // Homepage-level signals
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
}

const ISSUE_DEFS: Omit<CrawlIssue, "pageCount">[] = [
  { id: "broken_page",         severity: "error",   title: "Broken page (4xx/5xx response)",          description: "These pages cannot be crawled by AI systems.",                                     fixType: "" },
  { id: "slow_page",           severity: "error",   title: "Slow server response (TTFB over 3s)",      description: "Slow pages get lower priority in AI crawler queues.",                              fixType: "slow_server" },
  { id: "missing_title",       severity: "warning", title: "Missing meta title",                       description: "AI systems use the page title to understand and categorize content.",              fixType: "no_meta_title" },
  { id: "title_too_long",      severity: "warning", title: "Meta title over 60 characters",            description: "Long titles get truncated in AI-generated summaries.",                             fixType: "meta_title_long" },
  { id: "missing_description", severity: "warning", title: "Missing meta description",                 description: "AI systems use meta descriptions to generate page summaries.",                     fixType: "no_meta_desc" },
  { id: "missing_h1",          severity: "warning", title: "No H1 heading on page",                    description: "H1 headings tell AI systems what the page is primarily about.",                    fixType: "no_h1" },
  { id: "missing_schema",      severity: "warning", title: "No structured data (JSON-LD)",             description: "Schema markup helps AI extract facts and relationships from your content.",         fixType: "" },
  { id: "missing_canonical",   severity: "warning", title: "No canonical tag",                         description: "Missing canonicals can cause duplicate content confusion for crawlers.",           fixType: "no_canonical" },
  { id: "missing_alt",         severity: "warning", title: "Images missing alt text",                  description: "Alt text helps AI systems understand visual content.",                             fixType: "missing_alt" },
  { id: "large_page",          severity: "warning", title: "Large page (over 500KB HTML)",             description: "Large pages take longer to crawl and are sometimes de-prioritized.",               fixType: "" },
  { id: "no_internal_links",   severity: "notice",  title: "Page has no internal links",               description: "Isolated pages are harder to discover and may not be crawled regularly.",         fixType: "" },
];

function extractSitemapUrls(xml: string, origin: string, max: number): string[] {
  const locs = xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const loc of locs) {
    const url = loc.replace(/<\/?loc>/g, "").trim();
    try {
      const u = new URL(url);
      if (u.origin !== origin) continue;
      // Skip non-HTML resources
      if (/\.(xml|rss|jpg|jpeg|png|gif|webp|svg|css|js|woff|woff2|ttf|pdf|zip)$/i.test(u.pathname)) continue;
      const norm = u.origin + u.pathname;
      if (!seen.has(norm)) {
        seen.add(norm);
        urls.push(norm);
        if (urls.length >= max) break;
      }
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
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = origin + href;
    } else {
      continue;
    }
    try {
      const u = new URL(url);
      if (u.origin !== origin) continue;
      if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|woff|pdf|zip|ico)$/i.test(u.pathname)) continue;
      const norm = u.origin + u.pathname.replace(/\/$/, "") + "/";
      if (!seen.has(norm)) {
        seen.add(norm);
        urls.push(norm);
        if (urls.length >= max) break;
      }
    } catch { continue; }
  }
  return urls;
}

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
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: [], category: "redirect" };
    }
    if (status >= 400 || status === 0) {
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: ["broken_page"], category: "broken" };
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { url, status, ttfbMs, sizeBytes: 0, isHttps: url.startsWith("https://"), metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: [], category: "healthy" };
    }

    const html = await resp.text();
    const sizeBytes = Buffer.byteLength(html, "utf8");
    const issues: string[] = [];

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
    const metaTitleLength = metaTitle?.length ?? 0;
    if (!metaTitle) issues.push("missing_title");
    else if (metaTitleLength > 60) issues.push("title_too_long");

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : null;
    const metaDescriptionLength = metaDescription?.length ?? 0;
    if (!metaDescription) issues.push("missing_description");

    const hasH1 = /<h1[^>]*>/i.test(html);
    if (!hasH1) issues.push("missing_h1");

    const hasSchema = html.includes("application/ld+json");
    if (!hasSchema) issues.push("missing_schema");

    const hasCanonical = /rel=["']canonical["']/.test(html);
    if (!hasCanonical) issues.push("missing_canonical");

    const imgTags = html.match(/<img[^>]*>/gi) ?? [];
    const imagesMissingAlt = imgTags.filter(t => !/\balt\s*=/i.test(t)).length;
    if (imagesMissingAlt > 0) issues.push("missing_alt");

    if (sizeBytes > 500 * 1024) issues.push("large_page");
    if (ttfbMs > 3000) issues.push("slow_page");

    let origin = "";
    try { origin = new URL(url).origin; } catch { /* ignore */ }
    const internalLinkCount = (html.match(/href=["']([^"']+)["']/g) ?? [])
      .filter(h => { const href = h.match(/href=["']([^"']+)["']/)?.[1] ?? ""; return href.startsWith("/") || href.includes(origin.replace("https://", "").replace("http://", "")); }).length;
    if (internalLinkCount === 0) issues.push("no_internal_links");

    return { url, status, ttfbMs, sizeBytes, isHttps: url.startsWith("https://"), metaTitle, metaTitleLength, metaDescription, metaDescriptionLength, hasH1, hasSchema, hasCanonical, imagesMissingAlt, internalLinkCount, issues, category: issues.length === 0 ? "healthy" : "issues" };
  } catch {
    return { url, status: 0, ttfbMs: Date.now() - start, sizeBytes: 0, isHttps: url.startsWith("https://"), metaTitle: null, metaTitleLength: 0, metaDescription: null, metaDescriptionLength: 0, hasH1: false, hasSchema: false, hasCanonical: false, imagesMissingAlt: 0, internalLinkCount: 0, issues: ["broken_page"], category: "broken" };
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

export async function crawlSite(domain: string, maxPages = 25): Promise<SiteCrawlResult> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
  let origin: string;
  try { origin = new URL(base).origin; } catch { origin = base; }
  const domainClean = base.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Phase 1: Parallel fetch homepage + robots + sitemap + llms.txt
  const fetchStart = Date.now();
  const [homeResult, robotsResult, sitemapResult, llmsResult] = await Promise.allSettled([
    fetch(`${base}/`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), redirect: "follow" }),
    fetch(`${base}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
    fetch(`${base}/sitemap.xml`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
    fetch(`${base}/llms.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }),
  ]);
  const ttfbMs = Date.now() - fetchStart;

  const homeResp = homeResult.status === "fulfilled" ? homeResult.value : null;
  const statusCode = homeResp?.status ?? 0;
  const isHttps = base.startsWith("https://") && (homeResp?.ok ?? false);
  const html = homeResp?.ok ? await homeResp.text() : "";
  const serverHeader = homeResp?.headers.get("server") ?? "";

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
  else {
    const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,40})["']/i);
    if (gen) cms = gen[1].split(" ")[0] ?? null;
  }
  let framework: string | null = null;
  if (/_next\/static/i.test(html)) framework = "Next.js";
  else if (/__gatsby/i.test(html)) framework = "Gatsby";
  else if (/nuxt|__NUXT__/i.test(html)) framework = "Nuxt.js";
  else if (/data-reactroot|__NEXT_DATA__/i.test(html)) framework = "React";
  else if (/ng-version/i.test(html)) framework = "Angular";
  else if (/__svelte/i.test(html)) framework = "Svelte";
  else if (/vue\.js|__vue__/i.test(html)) framework = "Vue.js";
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
    { bot: "GPTBot", name: "ChatGPT", ...gptBot },
    { bot: "PerplexityBot", name: "Perplexity", ...perplexityBot },
    { bot: "ClaudeBot", name: "Claude / Anthropic", ...claudeBot },
    { bot: "Google-Extended", name: "Google Gemini", ...googleExtended },
  ];

  // Phase 2: Determine URLs to crawl
  let urlsToCrawl: string[] = [];

  if (hasSitemap && sitemapResp?.ok) {
    try {
      const sitemapXml = await sitemapResp.text();
      urlsToCrawl = extractSitemapUrls(sitemapXml, origin, maxPages);
    } catch { /* ignore */ }
  }

  if (urlsToCrawl.length < 3 && html) {
    // Fall back to internal link extraction
    const links = extractInternalLinks(html, origin, maxPages - 1);
    const homeNorm = `${origin}/`;
    const combined = [homeNorm, ...links.filter(l => l !== homeNorm)];
    const seen = new Set<string>();
    urlsToCrawl = [];
    for (const u of [...combined, ...urlsToCrawl]) {
      if (!seen.has(u)) { seen.add(u); urlsToCrawl.push(u); }
    }
    urlsToCrawl = urlsToCrawl.slice(0, maxPages);
  }

  // Always include homepage
  const homeNorm = `${origin}/`;
  if (!urlsToCrawl.includes(homeNorm)) urlsToCrawl.unshift(homeNorm);

  // Phase 3: Crawl all pages in batches of 8
  const pages = await crawlBatches(urlsToCrawl.slice(0, maxPages), 8);

  // Phase 4: Aggregate
  const healthy = pages.filter(p => p.category === "healthy").length;
  const broken = pages.filter(p => p.category === "broken").length;
  const hasIssuesCount = pages.filter(p => p.category === "issues").length;
  const redirects = pages.filter(p => p.category === "redirect").length;
  const htmlPages = pages.filter(p => p.category !== "redirect");

  // Issue counts
  const issueCounts = new Map<string, number>();
  for (const page of pages) {
    for (const issue of page.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }
  const issues: CrawlIssue[] = ISSUE_DEFS
    .filter(d => (issueCounts.get(d.id) ?? 0) > 0)
    .map(d => ({ ...d, pageCount: issueCounts.get(d.id) ?? 0 }))
    .sort((a, b) => {
      const order = { error: 0, warning: 1, notice: 2 };
      return order[a.severity] - order[b.severity] || b.pageCount - a.pageCount;
    });

  const errorsCount = issues.filter(i => i.severity === "error").reduce((s, i) => s + i.pageCount, 0);
  const warningsCount = issues.filter(i => i.severity === "warning").reduce((s, i) => s + i.pageCount, 0);

  // Thematic scores
  const n = htmlPages.length || 1;
  const crawlability = Math.round((1 - broken / (pages.length || 1)) * 100);
  const httpsScore = Math.round(htmlPages.filter(p => p.isHttps).length / n * 100);
  const performanceScore = Math.round(htmlPages.filter(p => p.ttfbMs < 2000 && p.ttfbMs > 0).length / n * 100);
  const linkingScore = Math.round(htmlPages.filter(p => p.internalLinkCount > 0).length / n * 100);
  const markupScore = Math.round(htmlPages.filter(p => p.hasSchema).length / n * 100);

  const aiChecks = [hasLlmsTxt, hasOrgSchema, hasFaqSchema, gptBot.allowed, perplexityBot.allowed, claudeBot.allowed, hasSchema, hasCanonical];
  const aiSearchScore = Math.round(aiChecks.filter(Boolean).length / aiChecks.length * 100);

  // Site health: weighted average of thematic scores
  const siteHealthScore = Math.round((crawlability * 0.3 + httpsScore * 0.2 + performanceScore * 0.25 + linkingScore * 0.15 + markupScore * 0.1));
  const aiHealthScore = aiSearchScore;

  return {
    domain: domainClean,
    crawledCount: pages.length,
    pageBreakdown: { healthy, broken, hasIssues: hasIssuesCount, redirects },
    siteHealthScore,
    aiHealthScore,
    errorsCount,
    warningsCount,
    issues,
    thematicScores: { crawlability, https: httpsScore, performance: performanceScore, internalLinking: linkingScore, markup: markupScore, aiSearch: aiSearchScore },
    botAccess,
    hasRobotsTxt,
    hasLlmsTxt,
    hasSitemap,
    robotsTxt: robotsTxt.slice(0, 2000),
    pages: pages.slice(0, 50),
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
  };
}
