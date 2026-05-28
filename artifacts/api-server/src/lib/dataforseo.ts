import { db, keywordCacheTable, dataforseoCacheTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import type { KeywordData } from "@workspace/db";
import { logger } from "./logger";

const DATAFORSEO_BASE = "https://api.dataforseo.com";

function getAuthHeader(): Record<string, string> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return {};
  const encoded = Buffer.from(`${login}:${password}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

/**
 * Maps domain TLD to DataForSEO location code.
 * Default is US (2840) for .com domains.
 */
export function getLocationCode(domain: string): number {
  if (domain.endsWith(".in")) return 2356;
  if (domain.endsWith(".co.uk")) return 2826;
  if (domain.endsWith(".com.au")) return 2036;
  return 2840;
}

async function getCachedKeywords(domain: string): Promise<KeywordData[] | null> {
  try {
    const now = new Date();
    const [row] = await db
      .select()
      .from(keywordCacheTable)
      .where(eq(keywordCacheTable.domain, domain))
      .limit(1);

    if (row && row.expiresAt > now) {
      return row.keywords;
    }
    return null;
  } catch {
    return null;
  }
}

async function cacheKeywords(domain: string, keywords: KeywordData[], locationCode: number): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await db
      .insert(keywordCacheTable)
      .values({ domain, keywords, locationCode, cachedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: keywordCacheTable.domain,
        set: { keywords, locationCode, cachedAt: now, expiresAt },
      });
  } catch {
    // Non-fatal — cache write failure does not break the audit
  }
}

/**
 * Fetch the top organic keywords for a domain from DataForSEO.
 *
 * Fallback chain:
 *   1. DB cache (free, 7-day TTL)
 *   2. DataForSEO Ranked Keywords API ($0.04/call)
 *   3. Returns [] — caller must fall back to AI-generated prompts
 *
 * Never throws — any error returns an empty array.
 */
export async function getDomainKeywords(domain: string): Promise<KeywordData[]> {
  // 1. Check cache first
  const cached = await getCachedKeywords(domain);
  if (cached) {
    return cached;
  }

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) {
    return [];
  }

  const locationCode = getLocationCode(domain);

  const payload = [
    {
      target: domain,
      language_code: "en",
      location_code: locationCode,
      limit: 20,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: ["keyword_data.keyword_info.search_volume", ">", 100],
    },
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(
      `${DATAFORSEO_BASE}/v3/dataforseo_labs/google/ranked_keywords/live`,
      {
        method: "POST",
        signal: controller.signal,
        headers: getAuthHeader(),
        body: JSON.stringify(payload),
      },
    );
    clearTimeout(timeout);

    if (response.status === 401) {
      console.error("[DataForSEO] Invalid credentials — check DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD");
      return [];
    }
    if (response.status === 402) {
      console.error("[DataForSEO] Insufficient balance");
      return [];
    }
    if (!response.ok) {
      console.error(`[DataForSEO] API error ${response.status}`);
      return [];
    }

    const data = (await response.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const result = tasks[0]?.result as Array<Record<string, unknown>> | undefined;
    const items = (result?.[0]?.items as Array<Record<string, unknown>>) ?? [];

    const keywords: KeywordData[] = [];
    for (const item of items.slice(0, 15)) {
      const kwData = (item.keyword_data ?? {}) as Record<string, unknown>;
      const kwInfo = (kwData.keyword_info ?? {}) as Record<string, unknown>;
      const keyword = String(kwData.keyword ?? "");
      const volume = Number(kwInfo.search_volume ?? 0);

      if (keyword && volume > 0) {
        keywords.push({
          keyword,
          volume,
          competition: Number(kwInfo.competition ?? 0),
        });
      }
    }

    if (keywords.length > 0) {
      console.log(`[DataForSEO] ${keywords.length} keywords fetched for ${domain} (loc:${locationCode})`);
      await cacheKeywords(domain, keywords, locationCode);
    } else {
      console.log(`[DataForSEO] No keywords found for ${domain} — AI fallback will be used`);
    }

    return keywords;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout")) {
      console.error("[DataForSEO] Request timed out — using AI fallback");
    } else {
      console.error(`[DataForSEO] Unexpected error: ${message}`);
    }
    return [];
  }
}

// ─── Google AI Overview ────────────────────────────────────────────────────────

export interface GoogleAiKwResult {
  keyword: string;
  mentioned: boolean;
  position: number | null;
  snippet: string | null;
}

export interface BrandEntity {
  name: string;
  url: string;
  mentionCount: number;
  sentiment: string;
}

export interface GoogleAiOverviewResult {
  score: number;
  mentionCount: number;
  status: "featured" | "partial" | "not_found";
  keywords: GoogleAiKwResult[];
  brandEntities: BrandEntity[];
  estimatedCostUsd: number;
}

function domainMatchesTarget(text: string, domain: string): boolean {
  const bare = domain.replace(/^www\./, "").toLowerCase();
  const t = text.toLowerCase();
  return t.includes(bare) || t.includes(domain.toLowerCase());
}

export async function getGoogleAiOverview(
  keywords: string[],
  domain: string,
  locationCode = 2356,
): Promise<GoogleAiOverviewResult> {
  const empty: GoogleAiOverviewResult = {
    score: 0, mentionCount: 0, status: "not_found", keywords: [], brandEntities: [], estimatedCostUsd: 0,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return empty;

  const top5 = keywords.slice(0, 5);
  const payload = top5.map(kw => ({
    keyword: kw,
    location_code: locationCode,
    language_code: "en",
  }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/serp/google/organic/live/advanced`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });
    clearTimeout(timeout);
    if (!resp.ok) return empty;

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    const kwResults: GoogleAiKwResult[] = [];
    let mentionCount = 0;

    // Accumulate brand entities across all keyword tasks, deduped by name
    const entityMap = new Map<string, BrandEntity>();

    for (let i = 0; i < tasks.length; i++) {
      const kw = top5[i] ?? "";
      const result = (tasks[i]?.result as Array<Record<string, unknown>>)?.[0];
      const items = (result?.items as Array<Record<string, unknown>>) ?? [];

      // Extract brand_entities - DataForSEO may place them at result level or inside items[0]
      const resultEntities = (result?.brand_entities as Array<Record<string, unknown>>) ?? [];
      const item0Entities = ((items[0]?.brand_entities) as Array<Record<string, unknown>>) ?? [];
      const rawEntities = resultEntities.length > 0 ? resultEntities : item0Entities;

      for (const ent of rawEntities) {
        const name = String(ent.name ?? "").trim();
        if (!name) continue;
        const existing = entityMap.get(name);
        const mc = Number(ent.mention_count ?? ent.mentions ?? 1);
        if (existing) {
          existing.mentionCount += mc;
        } else {
          entityMap.set(name, {
            name,
            url: String(ent.url ?? ent.domain ?? ""),
            mentionCount: mc,
            sentiment: String(ent.sentiment ?? "neutral"),
          });
        }
      }

      const aiItem = items.find(it => it.type === "ai_overview");
      if (!aiItem) {
        kwResults.push({ keyword: kw, mentioned: false, position: null, snippet: null });
        continue;
      }

      // Check if domain appears in links or text within the ai_overview block
      const subItems = (aiItem.items as Array<Record<string, unknown>>) ?? [];
      let mentioned = false;
      let snippet: string | null = null;

      for (const sub of subItems) {
        const content = String(sub.content ?? "");
        const links = (sub.links as Array<Record<string, unknown>>) ?? [];
        const inLinks = links.some(l => domainMatchesTarget(String(l.domain ?? l.url ?? ""), domain));
        const inText = domainMatchesTarget(content, domain);
        if (inLinks || inText) {
          mentioned = true;
          snippet = content.slice(0, 200) || null;
          break;
        }
      }

      if (mentioned) mentionCount++;
      kwResults.push({ keyword: kw, mentioned, position: mentioned ? 1 : null, snippet });
    }

    const brandEntities = Array.from(entityMap.values())
      .sort((a, b) => b.mentionCount - a.mentionCount);

    const score = mentionCount >= 3 ? 33 : mentionCount === 2 ? 22 : mentionCount === 1 ? 11 : 0;
    const status: GoogleAiOverviewResult["status"] =
      mentionCount >= 3 ? "featured" : mentionCount >= 1 ? "partial" : "not_found";

    return {
      score,
      mentionCount,
      status,
      keywords: kwResults,
      brandEntities,
      estimatedCostUsd: top5.length * 0.003,
    };
  } catch {
    return empty;
  }
}

// ─── Backlinks Summary ─────────────────────────────────────────────────────────

export interface BacklinkSummaryResult {
  referringDomains: number;
  backlinks: number;
  domainRank: number;
  spamScore: number;
  estimatedCostUsd: number;
}

export async function getBacklinksSummary(target: string): Promise<BacklinkSummaryResult | null> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/backlinks/summary/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{ target, include_subdomains: true }]),
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const data = (await resp.json()) as Record<string, unknown>;
    const result = ((data.tasks as Array<Record<string, unknown>>)?.[0]
      ?.result as Array<Record<string, unknown>>)?.[0];
    if (!result) return null;

    return {
      referringDomains: Number(result.referring_domains ?? 0),
      backlinks: Number(result.backlinks ?? 0),
      domainRank: Number(result.rank ?? 0),
      spamScore: Number(result.spam_score ?? 0),
      estimatedCostUsd: 0.01,
    };
  } catch {
    return null;
  }
}

// ─── Backlink Domain Gap (sites linking to competitors but not to you) ─────────

export interface BacklinkGapEntry {
  url: string;
  domain: string;
  domainRank: number;
  refDomainsCount: number;
}

export interface BacklinkGapResult {
  gaps: BacklinkGapEntry[];
  estimatedCostUsd: number;
}

export async function getBacklinkDomainGaps(
  myDomain: string,
  competitorDomains: string[],
): Promise<BacklinkGapResult> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || competitorDomains.length === 0) {
    return { gaps: [], estimatedCostUsd: 0 };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/backlinks/domain_intersection/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        targets: competitorDomains.slice(0, 5),
        excluded_target: myDomain,
        include_subdomains: true,
        limit: 20,
        order_by: ["rank,desc"],
      }]),
    });
    clearTimeout(timeout);
    if (!resp.ok) return { gaps: [], estimatedCostUsd: 0 };

    const data = (await resp.json()) as Record<string, unknown>;
    const items = (((data.tasks as Array<Record<string, unknown>>)?.[0]
      ?.result as Array<Record<string, unknown>>)?.[0]
      ?.items as Array<Record<string, unknown>>) ?? [];

    const gaps: BacklinkGapEntry[] = items.slice(0, 15).map(it => ({
      url: String(it.url ?? it.domain ?? ""),
      domain: String(it.domain ?? (it.url ? new URL(String(it.url)).hostname : "")),
      domainRank: Number(it.rank ?? 0),
      refDomainsCount: Number(it.referring_domains ?? 0),
    }));

    return { gaps, estimatedCostUsd: 0.01 };
  } catch {
    return { gaps: [], estimatedCostUsd: 0 };
  }
}

// ─── OnPage Audit ──────────────────────────────────────────────────────────────

export interface OnPageCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix: string;
  score: number;
}

export interface OnPageCategory {
  name: string;
  score: number;
  checks: OnPageCheck[];
}

export interface OnPagePerformance {
  ttfbMs: number;
  pageSpeedScore: number | null;
  lcp: number | null;
  cls: number | null;
  fcp: number | null;
}

export interface OnPageTechStack {
  cms: string | null;
  framework: string | null;
  cdn: string | null;
  analytics: string[];
  server: string | null;
}

export interface OnPageAuditResult {
  overallScore: number;
  categories: OnPageCategory[];
  status: "done" | "pending" | "error";
  taskId: string | null;
  estimatedCostUsd: number;
  performance?: OnPagePerformance;
  techStack?: OnPageTechStack;
}

function checkStatus(score: number): "pass" | "warn" | "fail" {
  if (score >= 80) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

// DataForSEO page_metrics.checks values are PAGE COUNTS (not scores).
// "issue" keys: count of pages WITH the problem — lower is better.
// "presence" keys: count of pages WITH the feature — higher is better.
// We normalise against totalPages to get a 0-100 score.
function mapOnPageChecks(checks: Record<string, number>, totalPages: number): OnPageCategory[] {
  const n = Math.max(totalPages, 1);

  // Score for an "issue" key: 100% of pages clean = 100, all broken = 0
  const issueScore = (k: string) => Math.round(Math.max(0, (1 - (Number(checks[k] ?? 0) / n)) * 100));

  // Score for a "presence" key: 100% of pages have it = 100, none = 0
  const presenceScore = (k: string) => Math.round(Math.min(100, (Number(checks[k] ?? 0) / n) * 100));

  // DataForSEO also returns boolean 0/1 flags for site-wide checks
  const flag = (k: string) => Number(checks[k] ?? 0) > 0 ? 100 : 0;

  const content: OnPageCheck[] = [
    {
      name: "Meta title",
      score: issueScore("no_title"),
      status: checkStatus(issueScore("no_title")),
      detail: issueScore("no_title") >= 80
        ? "Title tags are present across crawled pages"
        : `${Number(checks["no_title"] ?? 0)} page(s) are missing a title tag`,
      fix: "Add a unique <title> tag (50-60 characters) to every page. For Next.js/React use a <Helmet> component. For plain HTML add it inside <head>.",
    },
    {
      name: "Meta description",
      score: issueScore("no_description"),
      status: checkStatus(issueScore("no_description")),
      detail: issueScore("no_description") >= 80
        ? "Meta descriptions are present"
        : `${Number(checks["no_description"] ?? 0)} page(s) missing meta description`,
      fix: "Add a unique meta description (120-160 chars) to each page. It should summarise the page's answer in plain language — AI engines extract this directly.",
    },
    {
      name: "H1 tag structure",
      score: issueScore("no_h1_tag"),
      status: checkStatus(issueScore("no_h1_tag")),
      detail: issueScore("no_h1_tag") >= 80
        ? "H1 tags are present on crawled pages"
        : `${Number(checks["no_h1_tag"] ?? 0)} page(s) missing an H1 tag`,
      fix: "Every page needs exactly one <h1> tag that matches the page's main topic. Put the direct answer to the page's core question in the H1 — not a brand tagline.",
    },
    {
      name: "Duplicate content",
      score: issueScore("duplicate_content"),
      status: checkStatus(issueScore("duplicate_content")),
      detail: issueScore("duplicate_content") >= 80
        ? "No significant duplicate content detected"
        : `${Number(checks["duplicate_content"] ?? 0)} page(s) have duplicate content`,
      fix: "Consolidate near-identical pages using canonical tags pointing to the preferred version. Delete thin duplicates entirely and 301-redirect them to the main page.",
    },
    {
      name: "Duplicate titles",
      score: issueScore("duplicate_title"),
      status: checkStatus(issueScore("duplicate_title")),
      detail: issueScore("duplicate_title") >= 80
        ? "Title tags are unique across pages"
        : `${Number(checks["duplicate_title"] ?? 0)} page(s) share a duplicate title`,
      fix: "Make every title unique. If pages share a title, differentiate them by including the specific topic, location, or entity that makes each page distinct.",
    },
  ];

  const technical: OnPageCheck[] = [
    {
      name: "HTTPS / secure connection",
      score: flag("is_https"),
      status: checkStatus(flag("is_https")),
      detail: flag("is_https") === 100
        ? "Site is served over HTTPS"
        : "Site is not fully served over HTTPS",
      fix: "Install an SSL certificate and force all traffic to HTTPS via a 301 redirect. Most hosts (Vercel, Netlify, Cloudflare) do this automatically. Check for mixed content warnings in Chrome DevTools.",
    },
    {
      name: "Canonical tags",
      score: presenceScore("canonical"),
      status: checkStatus(presenceScore("canonical")),
      detail: presenceScore("canonical") >= 80
        ? "Canonical tags are configured on most pages"
        : `Only ${presenceScore("canonical")}% of pages have canonical tags`,
      fix: "Add <link rel='canonical' href='...'> to every page pointing to its own URL (self-canonical). This prevents duplicate content issues and tells Google and AI crawlers which version to index.",
    },
    {
      name: "Broken links",
      score: issueScore("broken_links"),
      status: checkStatus(issueScore("broken_links")),
      detail: issueScore("broken_links") >= 80
        ? "No significant broken links found"
        : `${Number(checks["broken_links"] ?? 0)} broken link(s) found`,
      fix: "Fix broken links by updating URLs or removing them. Use a free tool like Screaming Frog or Ahrefs Site Audit to find all broken links. AI crawlers skip pages with high broken link counts.",
    },
    {
      name: "HTTP to HTTPS links",
      score: issueScore("https_to_http_links"),
      status: checkStatus(issueScore("https_to_http_links")),
      detail: issueScore("https_to_http_links") >= 80
        ? "Internal links are using HTTPS correctly"
        : `${Number(checks["https_to_http_links"] ?? 0)} page(s) have HTTP links`,
      fix: "Update all internal links to use https:// instead of http://. Search your codebase for 'http://' and replace with 'https://'. Also check your CMS settings for a base URL option.",
    },
    {
      name: "Redirects",
      score: issueScore("redirect"),
      status: checkStatus(issueScore("redirect")),
      detail: issueScore("redirect") >= 80
        ? "Minimal redirect chains detected"
        : `${Number(checks["redirect"] ?? 0)} page(s) involved in redirects`,
      fix: "Eliminate redirect chains (A -> B -> C) by pointing directly to the final destination (A -> C). Each redirect hop wastes crawl budget and slows page load for AI crawlers.",
    },
  ];

  const authority: OnPageCheck[] = [
    {
      name: "Schema.org / structured data",
      score: presenceScore("has_micromarkup"),
      status: checkStatus(presenceScore("has_micromarkup")),
      detail: presenceScore("has_micromarkup") >= 80
        ? "Structured data is present on most pages"
        : `Only ${presenceScore("has_micromarkup")}% of pages have schema markup`,
      fix: "Add JSON-LD schema to every key page. Start with Organization schema on the homepage, Article schema on blog posts, FAQPage schema on FAQ sections, and Product schema on product pages. Test at schema.org/validator.",
    },
    {
      name: "Duplicate H1 tags",
      score: issueScore("duplicate_h1"),
      status: checkStatus(issueScore("duplicate_h1")),
      detail: issueScore("duplicate_h1") >= 80
        ? "H1 tags are unique across pages"
        : `${Number(checks["duplicate_h1"] ?? 0)} page(s) have duplicate H1s`,
      fix: "Each page must have a unique H1 that describes that specific page's content. Copy the title tag pattern if needed — just make the H1 describe what is actually on the page.",
    },
    {
      name: "SEO-friendly URLs",
      score: flag("seo_friendly_url"),
      status: checkStatus(flag("seo_friendly_url")),
      detail: flag("seo_friendly_url") === 100
        ? "URLs appear SEO-friendly"
        : "Some URLs are not SEO-friendly",
      fix: "Use short, descriptive, hyphen-separated URLs. Avoid dynamic parameters like ?id=123. Example: /blog/how-to-rank-in-chatgpt is better than /blog/post?id=45. AI engines use URL structure as a context signal.",
    },
  ];

  const engagement: OnPageCheck[] = [
    {
      name: "Image alt text",
      score: issueScore("no_image_alt"),
      status: checkStatus(issueScore("no_image_alt")),
      detail: issueScore("no_image_alt") >= 80
        ? "Images have alt text across crawled pages"
        : `${Number(checks["no_image_alt"] ?? 0)} page(s) have images without alt text`,
      fix: "Add descriptive alt text to every meaningful image. Include relevant entity names and keywords naturally. Alt text is a primary source of entity context for AI image-understanding models.",
    },
    {
      name: "Heading hierarchy (H2/H3)",
      score: issueScore("no_h2_h3"),
      status: checkStatus(issueScore("no_h2_h3")),
      detail: issueScore("no_h2_h3") >= 80
        ? "Pages use a proper heading structure"
        : `${Number(checks["no_h2_h3"] ?? 0)} page(s) lack H2/H3 subheadings`,
      fix: "Structure your content with clear H2 and H3 subheadings that read like questions or direct answers. AI engines use heading hierarchy to understand page structure and extract quotable sections.",
    },
  ];

  const avgScore = (items: OnPageCheck[]) =>
    items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;

  return [
    { name: "Content Quality", score: avgScore(content), checks: content },
    { name: "Technical Structure", score: avgScore(technical), checks: technical },
    { name: "Authority Signals", score: avgScore(authority), checks: authority },
    { name: "Engagement Signals", score: avgScore(engagement), checks: engagement },
  ];
}

// Direct HTML crawl-based on-page audit — no DataForSEO on_page plan required.
// Fetches the homepage (and robots.txt) and checks SEO signals via regex.
export async function runOnPageAudit(domain: string): Promise<OnPageAuditResult> {
  const errorResult: OnPageAuditResult = {
    overallScore: 0, categories: [], status: "error", taskId: null, estimatedCostUsd: 0,
  };

  try {
    // Normalise to a full URL
    const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
    const homeUrl = `${base}/`;

    // Fetch homepage HTML and measure TTFB
    const fetchStart = Date.now();
    const homeResp = await fetch(homeUrl, {
      headers: { "User-Agent": "GeoIQ-Audit/1.0 (+https://geoiqai.com)" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const ttfbMs = Date.now() - fetchStart;

    // Start Google PageSpeed Insights call concurrently (free, no key needed)
    const finalUrl = homeResp.url ?? homeUrl;
    const psiPromise = fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(finalUrl)}&strategy=mobile&category=performance`,
      { signal: AbortSignal.timeout(20000) },
    ).then(r => r.ok ? r.json() as Promise<Record<string, unknown>> : null).catch(() => null);

    const isHttps = homeUrl.startsWith("https://") && homeResp.ok;
    const html = homeResp.ok ? await homeResp.text() : "";

    // ---- Security headers ----
    const hsts = homeResp.headers.get("strict-transport-security") !== null;
    const xFrameOptions = homeResp.headers.get("x-frame-options") !== null;
    const xContentTypeOptions = homeResp.headers.get("x-content-type-options") !== null;
    const cspHeader = homeResp.headers.get("content-security-policy");
    const hasCsp = cspHeader !== null;
    const referrerPolicy = homeResp.headers.get("referrer-policy") !== null;
    const serverHeader = homeResp.headers.get("server") ?? "";

    // ---- Technology stack detection ----
    let cms: string | null = null;
    if (/wp-content|wp-includes/i.test(html)) cms = "WordPress";
    else if (/webflow\.com|\.wf-page|x-wf-site/i.test(html) || homeResp.headers.get("x-wf-site")) cms = "Webflow";
    else if (/<meta[^>]+generator["']?\s*=?\s*["']Ghost/i.test(html)) cms = "Ghost";
    else if (/squarespace\.com|static\.squarespace/i.test(html)) cms = "Squarespace";
    else if (/shopify\.com|cdn\.shopify/i.test(html)) cms = "Shopify";
    else {
      const genMatch = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,40})["']/i);
      if (genMatch) cms = genMatch[1].split(" ")[0] ?? null;
    }

    let framework: string | null = null;
    if (/_next\/static/i.test(html)) framework = "Next.js";
    else if (/__gatsby|gatsby-/i.test(html)) framework = "Gatsby";
    else if (/nuxt|__NUXT__/i.test(html)) framework = "Nuxt.js";
    else if (/data-reactroot|__NEXT_DATA__|react-dom/i.test(html)) framework = "React";
    else if (/ng-version|angular\.min\.js/i.test(html)) framework = "Angular";
    else if (/__svelte|svelte\.dev/i.test(html)) framework = "Svelte";
    else if (/vue\.js|vue\.min\.js|__vue__/i.test(html)) framework = "Vue.js";
    else if (serverHeader.toLowerCase().includes("vercel") || homeResp.headers.get("x-vercel-id")) framework = framework ?? null;

    let cdn: string | null = null;
    if (homeResp.headers.get("cf-ray")) cdn = "Cloudflare";
    else if (homeResp.headers.get("x-vercel-id")) cdn = "Vercel";
    else if (homeResp.headers.get("x-nf-request-id")) cdn = "Netlify";
    else if (homeResp.headers.get("x-amz-cf-id") || homeResp.headers.get("x-amz-request-id")) cdn = "AWS CloudFront";
    else if ((homeResp.headers.get("x-served-by") ?? "").includes("fastly")) cdn = "Fastly";

    const analytics: string[] = [];
    if (/gtag\(|G-[A-Z0-9]{6,}|analytics\.google\.com/i.test(html)) analytics.push("Google Analytics");
    if (/googletagmanager\.com/i.test(html)) analytics.push("Google Tag Manager");
    if (/hotjar\.com|_hjSettings/i.test(html)) analytics.push("Hotjar");
    if (/mixpanel\.com|mixpanel\.init/i.test(html)) analytics.push("Mixpanel");
    if (/posthog\.com|posthog\.init/i.test(html)) analytics.push("PostHog");
    if (/plausible\.io/i.test(html)) analytics.push("Plausible");
    if (/crisp\.chat|crispSDK/i.test(html)) analytics.push("Crisp");
    if (/intercom\.com|Intercom\(/i.test(html)) analytics.push("Intercom");

    const techStack: OnPageTechStack = {
      cms,
      framework,
      cdn,
      analytics,
      server: serverHeader.split("/")[0].trim() || null,
    };

    // Fetch robots.txt
    let robotsTxt = "";
    try {
      const robotsResp = await fetch(`${base}/robots.txt`, {
        headers: { "User-Agent": "GeoIQ-Audit/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (robotsResp.ok) robotsTxt = await robotsResp.text();
    } catch { /* ignore */ }

    // ---- Extract signals from HTML ----

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    const hasTitle = title.length > 0;
    const titleLen = title.length;
    const titleScore = hasTitle ? (titleLen >= 30 && titleLen <= 70 ? 100 : 60) : 0;

    // Meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : "";
    const hasDesc = description.length > 0;
    const descLen = description.length;
    const descScore = hasDesc ? (descLen >= 80 && descLen <= 170 ? 100 : 60) : 0;

    // H1
    const h1Matches = html.match(/<h1[^>]*>/gi) ?? [];
    const h1Count = h1Matches.length;
    const h1Score = h1Count === 1 ? 100 : h1Count === 0 ? 0 : 50;

    // H2/H3
    const h2Matches = html.match(/<h2[^>]*>/gi) ?? [];
    const h2Count = h2Matches.length;
    const headingScore = h2Count >= 2 ? 100 : h2Count === 1 ? 70 : 0;

    // Canonical
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
      ?? html.match(/<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
    const hasCanonical = !!canonicalMatch;
    const canonicalScore = hasCanonical ? 100 : 0;

    // Schema markup (JSON-LD)
    const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) ?? [];
    const hasSchema = jsonLdMatches.length > 0;
    const schemaScore = hasSchema ? 100 : 0;

    // Open Graph / social tags
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["']/i);
    const hasOgTags = !!ogTitleMatch;
    const ogScore = hasOgTags ? 100 : 0;

    // Images without alt text
    const allImgMatches = html.match(/<img[^>]*>/gi) ?? [];
    const imgCount = allImgMatches.length;
    const imgsMissingAlt = allImgMatches.filter(img => !/alt=["'][^"']+["']/i.test(img)).length;
    const imgAltScore = imgCount === 0 ? 100 : Math.round((1 - imgsMissingAlt / imgCount) * 100);

    // Internal links
    const internalLinkMatches = html.match(new RegExp(`href=["']${base}[^"']*["']|href=["']/[^"']*["']`, "gi")) ?? [];
    const internalLinkCount = internalLinkMatches.length;
    const internalLinksScore = internalLinkCount >= 10 ? 100 : internalLinkCount >= 5 ? 70 : internalLinkCount >= 2 ? 50 : 20;

    // Robots.txt — check if GPTBot / AI crawlers are blocked
    const blocksGptBot = /User-agent:\s*GPTBot[\s\S]*?Disallow:\s*\//i.test(robotsTxt);
    const blocksClaudeBot = /User-agent:\s*ClaudeBot[\s\S]*?Disallow:\s*\//i.test(robotsTxt);
    const aiCrawlerScore = blocksGptBot || blocksClaudeBot ? 0 : 100;

    // Viewport / mobile meta
    const viewportMatch = html.match(/<meta[^>]+name=["']viewport["']/i);
    const mobileScore = viewportMatch ? 100 : 0;

    logger.info({
      domain, hasTitle, titleLen, hasDesc, descLen, h1Count, h2Count,
      hasCanonical, hasSchema, imgCount, imgsMissingAlt, internalLinkCount,
      blocksGptBot, blocksClaudeBot, isHttps,
    }, "onpage audit direct crawl result");

    // ---- Build categories ----

    const content: OnPageCheck[] = [
      {
        name: "Meta title",
        score: titleScore,
        status: checkStatus(titleScore),
        detail: hasTitle
          ? `Title: "${title.slice(0, 60)}${title.length > 60 ? "..." : ""}" (${titleLen} chars)`
          : "No title tag found",
        fix: "Add a unique <title> tag (50-60 chars) to every page. Use your primary keyword near the start. For React, use react-helmet or the <title> inside a Helmet component.",
      },
      {
        name: "Meta description",
        score: descScore,
        status: checkStatus(descScore),
        detail: hasDesc
          ? `Description is ${descLen} chars (ideal: 120-160)`
          : "No meta description found",
        fix: "Add a <meta name='description'> tag (120-160 chars) to every page. Write it as a clear answer to what the page covers — AI engines extract this directly as context.",
      },
      {
        name: "H1 tag structure",
        score: h1Score,
        status: checkStatus(h1Score),
        detail: h1Count === 0 ? "No H1 tag found" : h1Count === 1 ? "One H1 tag found (correct)" : `${h1Count} H1 tags found — should be exactly one`,
        fix: "Every page needs exactly one <h1> tag. Put the core answer or primary keyword in the H1 — AI engines treat it as the definitive label for the page.",
      },
      {
        name: "Heading hierarchy (H2/H3)",
        score: headingScore,
        status: checkStatus(headingScore),
        detail: h2Count === 0 ? "No H2 subheadings found" : `${h2Count} H2 headings found`,
        fix: "Add H2 and H3 subheadings that read like questions or section topics. AI engines use heading structure to extract quotable chunks from your content.",
      },
      {
        name: "Open Graph tags",
        score: ogScore,
        status: checkStatus(ogScore),
        detail: hasOgTags ? "Open Graph tags present" : "No og:title tag found",
        fix: "Add og:title, og:description, og:image, and og:url to every page. These help AI engines and social platforms understand your page's identity and content.",
      },
    ];

    // ---- Security header scores ----
    const hstsScore = hsts ? 100 : 0;
    const xFrameScore = xFrameOptions || hasCsp ? 100 : 0;
    const xCtoScore = xContentTypeOptions ? 100 : 0;
    const securityHeadersPassCount = [hsts, xFrameOptions || hasCsp, xContentTypeOptions, referrerPolicy].filter(Boolean).length;

    const technical: OnPageCheck[] = [
      {
        name: "HTTPS",
        score: isHttps ? 100 : 0,
        status: checkStatus(isHttps ? 100 : 0),
        detail: isHttps ? "Site is served over HTTPS" : "Site is not on HTTPS",
        fix: "Set up an SSL certificate and force all traffic to HTTPS with a 301 redirect. Cloudflare, Vercel, and Netlify all provide free SSL. Check for mixed content (HTTP assets on an HTTPS page) in Chrome DevTools.",
      },
      {
        name: "Canonical tag",
        score: canonicalScore,
        status: checkStatus(canonicalScore),
        detail: hasCanonical ? `Canonical URL: ${canonicalMatch![1]}` : "No canonical tag found",
        fix: "Add <link rel='canonical' href='YOUR_PAGE_URL'> to every page. This tells search engines and AI crawlers the definitive URL to index, preventing duplicate content issues.",
      },
      {
        name: "Mobile viewport tag",
        score: mobileScore,
        status: checkStatus(mobileScore),
        detail: viewportMatch ? "Viewport meta tag present" : "No viewport meta tag found",
        fix: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> inside your <head>. This is required for mobile-friendly rendering and influences how AI crawlers score your page.",
      },
      {
        name: "AI crawler access (robots.txt)",
        score: aiCrawlerScore,
        status: checkStatus(aiCrawlerScore),
        detail: blocksGptBot
          ? "robots.txt is blocking GPTBot (ChatGPT crawler)"
          : blocksClaudeBot
            ? "robots.txt is blocking ClaudeBot"
            : robotsTxt
              ? "robots.txt does not block major AI crawlers"
              : "No robots.txt found (AI crawlers have full access)",
        fix: "Check your robots.txt for 'Disallow: /' under 'User-agent: GPTBot' or 'User-agent: ClaudeBot'. Remove those rules to let ChatGPT and Claude index your content. This is often set accidentally by default CMS configs.",
      },
      // ---- Security headers ----
      {
        name: "HSTS (Strict-Transport-Security)",
        score: hstsScore,
        status: checkStatus(hstsScore),
        detail: hsts
          ? "HSTS header is set - browsers always use HTTPS"
          : "HSTS header missing - browsers may load HTTP on first visit",
        fix: "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' to your server response headers. On Cloudflare, enable HSTS in SSL/TLS > Edge Certificates. On Vercel/Netlify, add it in headers config.",
      },
      {
        name: "Clickjacking protection",
        score: xFrameScore,
        status: checkStatus(xFrameScore),
        detail: (xFrameOptions || hasCsp)
          ? "X-Frame-Options or CSP frame-ancestors is set"
          : "No clickjacking protection header found",
        fix: "Add 'X-Frame-Options: SAMEORIGIN' or a CSP header with 'frame-ancestors self' to prevent your site from being embedded in malicious iframes. This is a standard trust signal that security scanners check.",
      },
      {
        name: "MIME-type sniffing protection",
        score: xCtoScore,
        status: checkStatus(xCtoScore),
        detail: xContentTypeOptions
          ? "X-Content-Type-Options: nosniff is set"
          : "X-Content-Type-Options header missing",
        fix: "Add 'X-Content-Type-Options: nosniff' to your server headers. This prevents browsers from guessing file types and is a basic security hardening step. One line in your server or CDN config.",
      },
    ];

    const authority: OnPageCheck[] = [
      {
        name: "Schema.org markup (JSON-LD)",
        score: schemaScore,
        status: checkStatus(schemaScore),
        detail: hasSchema ? `${jsonLdMatches.length} JSON-LD block(s) found` : "No structured data found",
        fix: "Add JSON-LD schema to key pages. Start with Organization schema on the homepage, Article on blog posts, FAQPage on FAQ sections. AI engines use schema to identify your brand as an entity. Test at validator.schema.org.",
      },
      {
        name: "Internal links",
        score: internalLinksScore,
        status: checkStatus(internalLinksScore),
        detail: `${internalLinkCount} internal link(s) on homepage`,
        fix: "Add more internal links between your pages. A well-linked site lets AI crawlers discover all your content from the homepage. Link to your most important pages from the nav and from body content.",
      },
    ];

    const engagement: OnPageCheck[] = [
      {
        name: "Image alt text",
        score: imgAltScore,
        status: checkStatus(imgAltScore),
        detail: imgCount === 0
          ? "No images found on homepage"
          : imgsMissingAlt === 0
            ? `All ${imgCount} image(s) have alt text`
            : `${imgsMissingAlt} of ${imgCount} image(s) missing alt text`,
        fix: "Add descriptive alt text to every meaningful image. Include your brand name, product names, and relevant keywords naturally. Alt text is a primary way AI image models understand entities on your page.",
      },
    ];

    // ---- Await PageSpeed Insights ----
    let pageSpeedScore: number | null = null;
    let lcp: number | null = null;
    let cls: number | null = null;
    let fcp: number | null = null;

    try {
      const psiData = await psiPromise;
      if (psiData) {
        const lhr = (psiData as Record<string, unknown>).lighthouseResult as Record<string, unknown> | undefined;
        const perfScore = ((lhr?.categories as Record<string, unknown>)?.performance as Record<string, unknown>)?.score;
        pageSpeedScore = perfScore != null ? Math.round(Number(perfScore) * 100) : null;
        const audits = lhr?.audits as Record<string, Record<string, unknown>> | undefined;
        const lcpMs = audits?.["largest-contentful-paint"]?.numericValue;
        const fcpMs = audits?.["first-contentful-paint"]?.numericValue;
        const clsVal = audits?.["cumulative-layout-shift"]?.numericValue;
        lcp = lcpMs != null ? Math.round(Number(lcpMs)) / 1000 : null;
        fcp = fcpMs != null ? Math.round(Number(fcpMs)) / 1000 : null;
        cls = clsVal != null ? Math.round(Number(clsVal) * 1000) / 1000 : null;
      }
    } catch { /* PSI is optional, ignore */ }

    // Performance category checks
    const ttfbScore = ttfbMs < 800 ? 100 : ttfbMs < 1800 ? 60 : 20;
    const speedScore = pageSpeedScore != null ? pageSpeedScore : null;
    const lcpScore = lcp != null ? (lcp <= 2.5 ? 100 : lcp <= 4.0 ? 60 : 20) : null;
    const clsScore = cls != null ? (cls <= 0.1 ? 100 : cls <= 0.25 ? 60 : 20) : null;

    const performanceChecks: OnPageCheck[] = [
      {
        name: "Time to First Byte (TTFB)",
        score: ttfbScore,
        status: checkStatus(ttfbScore),
        detail: `TTFB: ${ttfbMs}ms${ttfbMs < 800 ? " (fast)" : ttfbMs < 1800 ? " (acceptable)" : " (slow - fix this)"}`,
        fix: "A high TTFB usually means a slow server or no CDN. Put your site behind Cloudflare (free tier works) or move to Vercel/Netlify. For server-side apps, add Redis caching for database queries. Target under 800ms.",
      },
      ...(speedScore != null ? [{
        name: "Mobile PageSpeed score",
        score: speedScore,
        status: checkStatus(speedScore),
        detail: `Google PageSpeed (mobile): ${speedScore}/100${speedScore >= 90 ? " (excellent)" : speedScore >= 50 ? " (needs work)" : " (critical - hurting crawlability)"}`,
        fix: "Key fixes: compress images (use WebP format), remove unused JavaScript, add lazy loading to images below the fold. Run the free test at pagespeed.web.dev for the full breakdown with specific line-by-line fixes.",
      }] : []),
      ...(lcp != null ? [{
        name: "Largest Contentful Paint (LCP)",
        score: lcpScore ?? 50,
        status: checkStatus(lcpScore ?? 50),
        detail: `LCP: ${lcp}s${lcp <= 2.5 ? " (good - under 2.5s)" : lcp <= 4.0 ? " (needs improvement)" : " (poor - over 4s)"}`,
        fix: "LCP is usually your hero image or largest text block. Preload it with <link rel='preload'>, serve images in WebP format, and make sure your server responds fast (see TTFB above). Target under 2.5 seconds.",
      }] : []),
      ...(cls != null ? [{
        name: "Cumulative Layout Shift (CLS)",
        score: clsScore ?? 50,
        status: checkStatus(clsScore ?? 50),
        detail: `CLS: ${cls}${cls <= 0.1 ? " (good - stable layout)" : cls <= 0.25 ? " (moderate shifting)" : " (poor - content jumps around)"}`,
        fix: "Layout shift happens when elements load without reserved space. Set explicit width/height on all images and video embeds. Avoid injecting content above existing content. For ads or embeds, reserve their space with min-height.",
      }] : []),
    ];

    const avgScore = (items: OnPageCheck[]) =>
      items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;

    const categories: OnPageCategory[] = [
      { name: "Content Quality", score: avgScore(content), checks: content },
      { name: "Technical Structure", score: avgScore(technical), checks: technical },
      { name: "Authority Signals", score: avgScore(authority), checks: authority },
      { name: "Engagement Signals", score: avgScore(engagement), checks: engagement },
      { name: "Performance", score: avgScore(performanceChecks), checks: performanceChecks },
    ];

    // Overall score = weighted average
    const overallScore = Math.round(
      avgScore(content) * 0.35 +
      avgScore(technical) * 0.30 +
      avgScore(authority) * 0.15 +
      avgScore(engagement) * 0.10 +
      avgScore(performanceChecks) * 0.10
    );

    const performance: OnPagePerformance = {
      ttfbMs,
      pageSpeedScore,
      lcp,
      cls,
      fcp,
    };

    logger.info({
      domain, ttfbMs, pageSpeedScore, lcp, cls, fcp,
      hsts, xFrameOptions: xFrameOptions || hasCsp, xContentTypeOptions,
      securityHeadersPassCount,
      cms, framework, cdn, analyticsCount: analytics.length,
    }, "onpage audit complete");

    return { overallScore, categories, status: "done", taskId: null, estimatedCostUsd: 0, performance, techStack };
  } catch (err) {
    logger.error({ domain, err }, "onpage direct crawl exception");
    return errorResult;
  }
}

// ─── Generic DataForSEO 24h cache helpers ──────────────────────────────────────

async function getDfCache(key: string): Promise<Record<string, unknown> | null> {
  try {
    const [row] = await db
      .select()
      .from(dataforseoCacheTable)
      .where(eq(dataforseoCacheTable.key, key))
      .limit(1);
    if (row && row.expiresAt > new Date()) {
      return row.data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

async function setDfCache(
  key: string,
  data: Record<string, unknown>,
  costUsd?: string,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db
      .insert(dataforseoCacheTable)
      .values({ key, data, costUsd: costUsd ?? null, expiresAt })
      .onConflictDoUpdate({
        target: dataforseoCacheTable.key,
        set: { data, costUsd: costUsd ?? null, cachedAt: new Date(), expiresAt },
      });
  } catch {
    // Non-fatal
  }
}

// ─── LLM Mentions - Top Domains ────────────────────────────────────────────────

export interface LlmTopDomain {
  domain: string;
  mentions: number;
  mentionRate: number;
}

export interface LlmTopDomainsResult {
  domains: LlmTopDomain[];
  keywords: string[];
  totalMentions: number;
  estimatedCostUsd: number;
  cached: boolean;
}

export async function getLlmTopDomains(
  keywords: string[],
  locationCode = 2840,
): Promise<LlmTopDomainsResult> {
  const empty: LlmTopDomainsResult = {
    domains: [],
    keywords,
    totalMentions: 0,
    estimatedCostUsd: 0,
    cached: false,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return empty;

  const top5 = keywords.slice(0, 5);
  const cacheKey = `llm_top:${locationCode}:${top5.slice(0, 3).map(k => k.slice(0, 30).replace(/\s+/g, "_")).join("|")}`;

  const cached = await getDfCache(cacheKey);
  if (cached) {
    return { ...(cached as unknown as LlmTopDomainsResult), cached: true };
  }

  const payload = top5.map(kw => ({
    keyword: kw,
    location_code: locationCode,
    language_code: "en",
  }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/top_domains/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return empty;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    const totalCost = tasks.reduce(
      (s, t) => s + Number((t as Record<string, unknown>).cost ?? 0),
      0,
    );

    const domainMap = new Map<string, number>();
    let totalMentions = 0;

    for (const task of tasks) {
      const resultItems = (task.result as Array<Record<string, unknown>>) ?? [];
      for (const resultItem of resultItems) {
        const items = (resultItem.items as Array<Record<string, unknown>>) ?? [];
        for (const item of items) {
          const raw = String(item.domain ?? item.url ?? "");
          const domain = raw
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0] ?? "";
          if (!domain) continue;
          const count = Number(
            item.mentions_count ?? item.mentions ?? item.count ?? 1,
          );
          domainMap.set(domain, (domainMap.get(domain) ?? 0) + count);
          totalMentions += count;
        }
      }
    }

    const domains: LlmTopDomain[] = Array.from(domainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([domain, mentions]) => ({
        domain,
        mentions,
        mentionRate: totalMentions > 0 ? Math.round((mentions / totalMentions) * 100) : 0,
      }));

    const result: LlmTopDomainsResult = {
      domains,
      keywords: top5,
      totalMentions,
      estimatedCostUsd: totalCost,
      cached: false,
    };

    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, totalCost.toFixed(5));
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("abort")) {
      // Log non-timeout errors only
    }
    return empty;
  }
}

// ─── ChatGPT LLM Scraper ───────────────────────────────────────────────────────

export interface ChatGptScraperSource {
  domain: string;
  url: string;
  title: string;
  sourceName: string | null;
  publicationDate: string | null;
}

export interface ChatGptScraperKwResult {
  keyword: string;
  mentioned: boolean;
  sources: ChatGptScraperSource[];
  snippet: string | null;
}

export interface ChatGptScraperResult {
  keywords: ChatGptScraperKwResult[];
  allSources: ChatGptScraperSource[];
  domainCited: boolean;
  mentionCount: number;
  estimatedCostUsd: number;
  cached: boolean;
  model: string | null;
}

export async function getChatGptScraper(
  keywords: string[],
  domain: string,
  locationCode = 2840,
): Promise<ChatGptScraperResult> {
  const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const top3 = keywords.slice(0, 3);

  const empty: ChatGptScraperResult = {
    keywords: top3.map(kw => ({ keyword: kw, mentioned: false, sources: [], snippet: null })),
    allSources: [],
    domainCited: false,
    mentionCount: 0,
    estimatedCostUsd: 0,
    cached: false,
    model: null,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || top3.length === 0) return empty;

  const cacheKey = `chatgpt_scraper:${locationCode}:${bare}:${top3.map(k => k.slice(0, 25).replace(/\s+/g, "_")).join("|")}`;
  const cached = await getDfCache(cacheKey);
  if (cached) {
    return { ...(cached as unknown as ChatGptScraperResult), cached: true };
  }

  const payload = top3.map(kw => ({
    keyword: kw,
    location_code: locationCode,
    language_code: "en",
    force_web_search: true,
    device: "desktop",
    os: "windows",
  }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });
    clearTimeout(timeout);

    if (!resp.ok) return empty;

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    const totalCost = tasks.reduce((s, t) => s + Number((t as Record<string, unknown>).cost ?? 0), 0);

    const kwResults: ChatGptScraperKwResult[] = [];
    const sourceMap = new Map<string, ChatGptScraperSource>();
    let mentionCount = 0;
    let model: string | null = null;

    for (let i = 0; i < tasks.length; i++) {
      const kw = top3[i] ?? "";
      const result = (tasks[i]?.result as Array<Record<string, unknown>>)?.[0];
      if (!result) {
        kwResults.push({ keyword: kw, mentioned: false, sources: [], snippet: null });
        continue;
      }

      if (!model) model = String(result.model ?? "");

      const rawSources = (result.sources as Array<Record<string, unknown>>) ?? [];
      const kwSources: ChatGptScraperSource[] = rawSources.map(s => ({
        domain: String(s.domain ?? "").replace(/^www\./, ""),
        url: String(s.url ?? ""),
        title: String(s.title ?? ""),
        sourceName: s.source_name ? String(s.source_name) : null,
        publicationDate: s.publication_date ? String(s.publication_date) : null,
      })).filter(s => s.domain);

      for (const src of kwSources) {
        if (!sourceMap.has(src.domain)) sourceMap.set(src.domain, src);
      }

      const markdown = String(result.markdown ?? "");

      // Check brand_entities - stronger signal than text matching
      const rawBrandEntities = (result.brand_entities as Array<Record<string, unknown>>) ?? [];
      const entityMentioned = rawBrandEntities.some(e => {
        const entityUrls = (e.urls as Array<Record<string, unknown>>) ?? [];
        const domainMatch = entityUrls.some(u => {
          const d = String(u.domain ?? "").replace(/^www\./, "");
          return d && (d.includes(bare) || bare.includes(d.split(".")[0] ?? ""));
        });
        const titleMatch = String(e.title ?? "").toLowerCase().includes(bare.split(".")[0] ?? "");
        return domainMatch || titleMatch;
      });

      const mentioned = entityMentioned
        || kwSources.some(s => s.domain.includes(bare) || bare.includes(s.domain.split(".")[0] ?? ""))
        || markdown.toLowerCase().includes(bare.toLowerCase());

      if (mentioned) mentionCount++;
      kwResults.push({
        keyword: kw,
        mentioned,
        sources: kwSources,
        snippet: markdown.slice(0, 300) || null,
      });
    }

    const allSources = Array.from(sourceMap.values()).sort((a, b) => {
      const aMatch = a.domain.includes(bare) ? -1 : 1;
      const bMatch = b.domain.includes(bare) ? -1 : 1;
      return aMatch - bMatch;
    });

    const domainCited = mentionCount > 0 || allSources.some(s => s.domain.includes(bare));

    const result: ChatGptScraperResult = {
      keywords: kwResults,
      allSources,
      domainCited,
      mentionCount,
      estimatedCostUsd: totalCost,
      cached: false,
      model,
    };

    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, totalCost.toFixed(5));
    return result;
  } catch {
    return empty;
  }
}

// ─── Gemini LLM Scraper ────────────────────────────────────────────────────────

export async function getGeminiScraper(
  keywords: string[],
  domain: string,
  locationCode = 2840,
): Promise<ChatGptScraperResult> {
  const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const top3 = keywords.slice(0, 3);

  const empty: ChatGptScraperResult = {
    keywords: top3.map(kw => ({ keyword: kw, mentioned: false, sources: [], snippet: null })),
    allSources: [],
    domainCited: false,
    mentionCount: 0,
    estimatedCostUsd: 0,
    cached: false,
    model: null,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || top3.length === 0) return empty;

  const cacheKey = `gemini_scraper:${locationCode}:${bare}:${top3.map(k => k.slice(0, 25).replace(/\s+/g, "_")).join("|")}`;
  const cached = await getDfCache(cacheKey);
  if (cached) {
    return { ...(cached as unknown as ChatGptScraperResult), cached: true };
  }

  const payload = top3.map(kw => ({
    keyword: kw,
    location_code: locationCode,
    language_code: "en",
    device: "desktop",
    os: "windows",
  }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/gemini/llm_scraper/live/advanced`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });
    clearTimeout(timeout);

    if (!resp.ok) return empty;

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    const totalCost = tasks.reduce((s, t) => s + Number((t as Record<string, unknown>).cost ?? 0), 0);

    const kwResults: ChatGptScraperKwResult[] = [];
    const sourceMap = new Map<string, ChatGptScraperSource>();
    let mentionCount = 0;
    let model: string | null = null;

    for (let i = 0; i < tasks.length; i++) {
      const kw = top3[i] ?? "";
      const result = (tasks[i]?.result as Array<Record<string, unknown>>)?.[0];
      if (!result) {
        kwResults.push({ keyword: kw, mentioned: false, sources: [], snippet: null });
        continue;
      }

      if (!model) model = String(result.model ?? "");

      const rawSources = (result.sources as Array<Record<string, unknown>>) ?? [];
      const kwSources: ChatGptScraperSource[] = rawSources.map(s => ({
        domain: String(s.domain ?? "").replace(/^www\./, ""),
        url: String(s.url ?? ""),
        title: String(s.title ?? ""),
        sourceName: s.source_name ? String(s.source_name) : null,
        publicationDate: s.publication_date ? String(s.publication_date) : null,
      })).filter(s => s.domain);

      for (const src of kwSources) {
        if (!sourceMap.has(src.domain)) sourceMap.set(src.domain, src);
      }

      const markdown = String(result.markdown ?? "");

      const rawBrandEntities = (result.brand_entities as Array<Record<string, unknown>>) ?? [];
      const entityMentioned = rawBrandEntities.some(e => {
        const entityUrls = (e.urls as Array<Record<string, unknown>>) ?? [];
        const domainMatch = entityUrls.some(u => {
          const d = String(u.domain ?? "").replace(/^www\./, "");
          return d && (d.includes(bare) || bare.includes(d.split(".")[0] ?? ""));
        });
        const titleMatch = String(e.title ?? "").toLowerCase().includes(bare.split(".")[0] ?? "");
        return domainMatch || titleMatch;
      });

      const mentioned = entityMentioned
        || kwSources.some(s => s.domain.includes(bare) || bare.includes(s.domain.split(".")[0] ?? ""))
        || markdown.toLowerCase().includes(bare.toLowerCase());

      if (mentioned) mentionCount++;
      kwResults.push({
        keyword: kw,
        mentioned,
        sources: kwSources,
        snippet: markdown.slice(0, 300) || null,
      });
    }

    const allSources = Array.from(sourceMap.values()).sort((a, b) => {
      const aMatch = a.domain.includes(bare) ? -1 : 1;
      const bMatch = b.domain.includes(bare) ? -1 : 1;
      return aMatch - bMatch;
    });

    const domainCited = mentionCount > 0 || allSources.some(s => s.domain.includes(bare));

    const result: ChatGptScraperResult = {
      keywords: kwResults,
      allSources,
      domainCited,
      mentionCount,
      estimatedCostUsd: totalCost,
      cached: false,
      model,
    };

    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, totalCost.toFixed(5));
    return result;
  } catch {
    return empty;
  }
}

// ─── AI Keyword Search Volume ──────────────────────────────────────────────────

export interface AiKeywordVolumeItem {
  keyword: string;
  aiSearchVolume: number;
  monthlyTrend: number | null;
}

export interface AiKeywordVolumeResult {
  items: AiKeywordVolumeItem[];
  estimatedCostUsd: number;
  cached: boolean;
}

export async function getAiKeywordVolume(
  keywords: string[],
  locationCode = 2840,
): Promise<AiKeywordVolumeResult> {
  const empty: AiKeywordVolumeResult = {
    items: keywords.map(kw => ({ keyword: kw, aiSearchVolume: 0, monthlyTrend: null })),
    estimatedCostUsd: 0,
    cached: false,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return empty;

  const top10 = keywords.slice(0, 10);
  const cacheKey = `ai_kw_volume:${locationCode}:${top10.slice(0, 5).map(k => k.slice(0, 20).replace(/\s+/g, "_")).join("|")}`;

  const cached = await getDfCache(cacheKey);
  if (cached) {
    return { ...(cached as unknown as AiKeywordVolumeResult), cached: true };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{ keywords: top10, location_code: locationCode, language_code: "en" }]),
    });
    clearTimeout(timeout);

    if (!resp.ok) return empty;

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const totalCost = tasks.reduce((s, t) => s + Number((t as Record<string, unknown>).cost ?? 0), 0);

    const rawItems = (((tasks[0]?.result as Array<Record<string, unknown>>)?.[0])?.items as Array<Record<string, unknown>>) ?? [];

    const itemMap = new Map<string, number>();
    const trendMap = new Map<string, number | null>();

    for (const item of rawItems) {
      const kw = String(item.keyword ?? "");
      const vol = Number(item.ai_search_volume ?? 0);
      itemMap.set(kw, vol);

      const monthly = (item.ai_monthly_searches as Array<Record<string, unknown>>) ?? [];
      if (monthly.length >= 3) {
        const latest = Number(monthly[0]?.ai_search_volume ?? 0);
        const older = Number(monthly[2]?.ai_search_volume ?? 0);
        trendMap.set(kw, older > 0 ? Math.round(((latest - older) / older) * 100) : null);
      } else {
        trendMap.set(kw, null);
      }
    }

    const items: AiKeywordVolumeItem[] = top10.map(kw => ({
      keyword: kw,
      aiSearchVolume: itemMap.get(kw) ?? 0,
      monthlyTrend: trendMap.get(kw) ?? null,
    }));

    const result: AiKeywordVolumeResult = { items, estimatedCostUsd: totalCost, cached: false };
    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, totalCost.toFixed(5));
    return result;
  } catch {
    return empty;
  }
}

// ─── LLM Mentions - Cross Aggregated ──────────────────────────────────────────

export interface LlmCrossAggTarget {
  domain: string;
  mentionCount: number;
  mentionRate: number;
}

export interface LlmCrossAggResult {
  targets: LlmCrossAggTarget[];
  keywords: string[];
  estimatedCostUsd: number;
  cached: boolean;
}

export async function getLlmCrossAggregated(
  myDomain: string,
  competitorDomains: string[],
  keywords: string[],
  locationCode = 2840,
): Promise<LlmCrossAggResult> {
  const allTargets = [myDomain, ...competitorDomains.slice(0, 4)];
  const empty: LlmCrossAggResult = {
    targets: allTargets.map(d => ({ domain: d.replace(/^www\./, ""), mentionCount: 0, mentionRate: 0 })),
    keywords,
    estimatedCostUsd: 0,
    cached: false,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return empty;

  const top5kw = keywords.slice(0, 5);
  const sortedTargets = [...allTargets].sort().join("|");
  const cacheKey = `llm_cross:${locationCode}:${sortedTargets.slice(0, 80)}:${top5kw.slice(0, 2).map(k => k.slice(0, 20).replace(/\s+/g, "_")).join("|")}`;

  const cached = await getDfCache(cacheKey);
  if (cached) {
    return { ...(cached as unknown as LlmCrossAggResult), cached: true };
  }

  const payload = [{
    targets: allTargets.map(domain => {
      const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
      return {
        aggregation_key: bare,
        target: [{ domain: bare, search_filter: "include", search_scope: ["answer", "sources"] }],
      };
    }),
    keywords: top5kw,
    location_code: locationCode,
    language_code: "en",
  }];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(
      `${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live`,
      {
        method: "POST",
        signal: controller.signal,
        headers: getAuthHeader(),
        body: JSON.stringify(payload),
      },
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      return empty;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    const totalCost = tasks.reduce(
      (s, t) => s + Number((t as Record<string, unknown>).cost ?? 0),
      0,
    );

    const result0 = (tasks[0]?.result as Array<Record<string, unknown>>)?.[0];
    const items = (result0?.items as Array<Record<string, unknown>>) ?? [];

    const targetMap = new Map<string, number>();

    for (const item of items) {
      // aggregation_key is set when using structured targets format
      const raw = String(item.aggregation_key ?? item.domain ?? item.target ?? item.url ?? "");
      const domain = raw
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? "";
      if (!domain) continue;
      const count = Number(
        item.total_mentions ?? item.mentions_count ?? item.mentions ?? 0,
      );
      targetMap.set(domain, (targetMap.get(domain) ?? 0) + count);
    }

    const maxMentions = Math.max(...Array.from(targetMap.values()), 1);
    const targets: LlmCrossAggTarget[] = allTargets.map(domain => {
      const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
      const count = targetMap.get(bare) ?? 0;
      return {
        domain: bare,
        mentionCount: count,
        mentionRate: Math.round((count / maxMentions) * 100),
      };
    });

    const crossResult: LlmCrossAggResult = {
      targets,
      keywords: top5kw,
      estimatedCostUsd: totalCost,
      cached: false,
    };

    await setDfCache(
      cacheKey,
      crossResult as unknown as Record<string, unknown>,
      totalCost.toFixed(5),
    );
    return crossResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("abort")) {
      // Log non-timeout errors only
    }
    return empty;
  }
}
