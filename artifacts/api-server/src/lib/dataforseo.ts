import { db, keywordCacheTable, dataforseoCacheTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import type { KeywordData } from "@workspace/db";

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
  score: number;
}

export interface OnPageCategory {
  name: string;
  score: number;
  checks: OnPageCheck[];
}

export interface OnPageAuditResult {
  overallScore: number;
  categories: OnPageCategory[];
  status: "done" | "pending" | "error";
  taskId: string | null;
  estimatedCostUsd: number;
}

function checkScore(val: number): number {
  return Math.round(Math.min(100, Math.max(0, val)));
}

function checkStatus(val: number): "pass" | "warn" | "fail" {
  if (val >= 80) return "pass";
  if (val >= 40) return "warn";
  return "fail";
}

function mapOnPageChecks(checks: Record<string, number>): OnPageCategory[] {
  const get = (k: string) => checkScore(Number(checks[k] ?? 0));

  const content: OnPageCheck[] = [
    { name: "Meta title present and optimised", score: get("title"), status: checkStatus(get("title")), detail: get("title") >= 80 ? "Title tag is well configured" : "Title tag is missing or too short/long" },
    { name: "Meta description", score: get("meta_description"), status: checkStatus(get("meta_description")), detail: get("meta_description") >= 80 ? "Meta description is present" : "Missing or duplicate meta description" },
    { name: "H1 tag structure", score: get("h1"), status: checkStatus(get("h1")), detail: get("h1") >= 80 ? "H1 tag is present and unique" : "H1 tag missing or duplicated" },
    { name: "Content length and depth", score: get("content_length"), status: checkStatus(get("content_length")), detail: get("content_length") >= 80 ? "Pages have sufficient content depth" : "Content is too thin — AI needs more to cite" },
    { name: "Duplicate content", score: 100 - get("duplicate_content"), status: checkStatus(100 - get("duplicate_content")), detail: get("duplicate_content") < 20 ? "No significant duplicate content found" : "Duplicate content detected — AI engines penalise this" },
  ];

  const technical: OnPageCheck[] = [
    { name: "Canonical tags", score: get("canonical"), status: checkStatus(get("canonical")), detail: get("canonical") >= 80 ? "Canonical tags are correctly configured" : "Canonical tag issues found" },
    { name: "robots.txt / AI crawler access", score: get("robots_txt"), status: checkStatus(get("robots_txt")), detail: get("robots_txt") >= 80 ? "robots.txt allows AI crawlers" : "robots.txt may be blocking AI crawlers" },
    { name: "Broken internal links", score: 100 - get("broken_links"), status: checkStatus(100 - get("broken_links")), detail: get("broken_links") < 20 ? "No significant broken links found" : "Broken links found — fix for better crawlability" },
    { name: "Page response code", score: get("response_code"), status: checkStatus(get("response_code")), detail: get("response_code") >= 80 ? "Pages returning correct 200 status" : "Some pages returning error codes" },
    { name: "Mobile-friendliness", score: get("is_https"), status: checkStatus(get("is_https")), detail: get("is_https") >= 80 ? "Site is served over HTTPS" : "HTTPS not configured properly" },
  ];

  const authority: OnPageCheck[] = [
    { name: "Schema.org markup", score: get("structured_data"), status: checkStatus(get("structured_data")), detail: get("structured_data") >= 80 ? "Structured data present — helps AI understand entities" : "No structured data — AI struggles to identify entities" },
    { name: "Internal linking depth", score: get("internal_links_count"), status: checkStatus(get("internal_links_count")), detail: get("internal_links_count") >= 80 ? "Good internal link structure" : "Sparse internal linking — AI can't discover key pages" },
    { name: "External links (citations)", score: get("external_links_count"), status: checkStatus(get("external_links_count")), detail: get("external_links_count") >= 80 ? "Pages cite external sources" : "No external citations — reduces authority signals" },
  ];

  const engagement: OnPageCheck[] = [
    { name: "Image alt text", score: get("no_image_alt"), status: checkStatus(get("no_image_alt")), detail: get("no_image_alt") >= 80 ? "Images have descriptive alt text" : "Images missing alt text — missed entity context" },
    { name: "Heading hierarchy (H2/H3)", score: get("h2"), status: checkStatus(get("h2")), detail: get("h2") >= 80 ? "Good heading structure" : "Missing H2/H3 structure — hurts AI extractability" },
  ];

  const avgScore = (checks: OnPageCheck[]) =>
    checks.length ? Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length) : 0;

  return [
    { name: "Content Quality", score: avgScore(content), checks: content },
    { name: "Technical Structure", score: avgScore(technical), checks: technical },
    { name: "Authority Signals", score: avgScore(authority), checks: authority },
    { name: "Engagement Signals", score: avgScore(engagement), checks: engagement },
  ];
}

export async function runOnPageAudit(domain: string): Promise<OnPageAuditResult> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  const errorResult: OnPageAuditResult = {
    overallScore: 0, categories: [], status: "error", taskId: null, estimatedCostUsd: 0,
  };

  if (!login || !password) return errorResult;

  const url = `https://${domain.replace(/^https?:\/\//, "")}`;

  try {
    // Step 1: create task
    const createResp = await fetch(`${DATAFORSEO_BASE}/v3/on_page/task_post`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify([{
        target: url,
        max_crawl_pages: 10,
        load_resources: false,
        enable_javascript: false,
        store_raw_html: false,
        check_spell: false,
      }]),
      signal: AbortSignal.timeout(15000),
    });
    if (!createResp.ok) return errorResult;

    const createData = (await createResp.json()) as Record<string, unknown>;
    const taskId = String(
      ((createData.tasks as Array<Record<string, unknown>>)?.[0] as Record<string, unknown>)?.id ?? ""
    );
    if (!taskId) return errorResult;

    // Step 2: poll summary/live (up to 45 seconds)
    let summaryResult: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 9; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const summResp = await fetch(`${DATAFORSEO_BASE}/v3/on_page/summary/live`, {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify([{ id: taskId }]),
          signal: AbortSignal.timeout(10000),
        });
        if (!summResp.ok) continue;
        const summData = (await summResp.json()) as Record<string, unknown>;
        const res = ((summData.tasks as Array<Record<string, unknown>>)?.[0]
          ?.result as Array<Record<string, unknown>>)?.[0];
        if (res && String(res.crawl_progress ?? "") === "finished") {
          summaryResult = res;
          break;
        }
        if (res && attempt >= 5) {
          summaryResult = res;
          break;
        }
      } catch {
        // continue polling
      }
    }

    if (!summaryResult) {
      return { overallScore: 0, categories: [], status: "pending", taskId, estimatedCostUsd: 0.02 };
    }

    const pageMetrics = (summaryResult.page_metrics ?? {}) as Record<string, unknown>;
    const onpageScore = Number(pageMetrics.onpage_score ?? 0);
    const rawChecks = (pageMetrics.checks ?? {}) as Record<string, number>;

    const categories = mapOnPageChecks(rawChecks);
    const overallScore = Math.round(onpageScore);

    return {
      overallScore,
      categories,
      status: "done",
      taskId,
      estimatedCostUsd: 0.02,
    };
  } catch {
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
