import { db, keywordCacheTable, dataforseoCacheTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import type { KeywordData } from "@workspace/db";
import { logger } from "./logger";
import OpenAI from "openai";

// Lightweight OpenAI client used only for keyword generation fallback.
// Uses Replit AI Integrations proxy when available.
const kgOpenai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "no-key",
  timeout: 20000,
  maxRetries: 0,
});

const DATAFORSEO_BASE = process.env.DATAFORSEO_SANDBOX === "true"
  ? "https://sandbox.dataforseo.com"
  : "https://api.dataforseo.com";

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
 * Returns true if a keyword is a generic AI phrase with no product-specific buyer intent.
 *
 * Two cases covered:
 *   1. Specific AI system names (chatgpt, gemini, claude...) without a product modifier
 *      e.g. "chatgpt app" -> generic, "chatgpt alternative" -> NOT generic (keep)
 *   2. Generic "ai" word without a meaningful product modifier
 *      e.g. "ask ai", "free ai", "ai check", "ai app" -> all generic (remove)
 *      e.g. "ai visibility tool", "ai search ranking" -> NOT generic (keep)
 *
 * Product modifiers are genuine buyer-intent terms that indicate a specific product category,
 * NOT general usage words like "app", "free", "ask", "check".
 */
/**
 * Returns true if a keyword looks like a domain slug, brand slug, or adult content
 * rather than a genuine search query. Applied on top of isGenericAiOnly.
 *
 * Catches junk like "thehomesport", "baddiehub", "strip chat" that DataForSEO
 * Google Ads keywords_for_site sometimes returns for large domains whose users
 * research many unrelated niches.
 */
export function isSuspectKeyword(keyword: string): boolean {
  const kl = keyword.toLowerCase().trim();

  // Adult / explicit content filter
  const EXPLICIT = ["strip", "nude", "porn", "xxx", " sex", "escort", "onlyfan", "cam girl", "cam chat"];
  if (EXPLICIT.some(t => kl.includes(t))) return true;

  // Single compound word that looks like a website slug / brand name.
  // Real search queries are usually multiple words OR a very short common term.
  const words = kl.split(/\s+/);
  if (words.length === 1 && (words[0]?.length ?? 0) > 8) {
    // Keep it if it starts or ends with a common search-intent term
    const INTENT_AFFIXES = ["best", "free", "top", "tool", "how", "what", "vs", "review", "price", "cheap", "online", "buy", "compare"];
    const hasIntent = INTENT_AFFIXES.some(w => kl.startsWith(w) || kl.endsWith(w));
    if (!hasIntent) return true; // Looks like a domain slug (e.g. "thehomesport")
  }

  // Two-word phrases where both words sound like a brand compound (gaming/adult site names)
  // e.g. "crazy games", "baddie hub" — hard to auto-detect; we catch explicit ones above
  return false;
}

export function isGenericAiOnly(keyword: string): boolean {
  const kl = keyword.toLowerCase().trim();
  const AI_SYSTEM_NAMES = [
    "chatgpt", "gemini", "claude", "grok", "perplexity", "openai",
    "bard", "copilot", "llama", "mistral", "deepseek", "meta ai",
  ];
  // Only genuine product-category words count as modifiers.
  // Deliberately excludes: app, free, ask, check, agency, pro, plus, download, login, sign, etc.
  const PRODUCT_MODIFIERS = [
    "tool", "tracker", "checker", "monitor", "audit", "score",
    "rank", "ranking", "analytic", "analysis", "alternative", "platform",
    "software", "integration", "plugin", "extension",
    "visibility", "optimization", "brand", "citation",
    "geo", "seo", "search", "performance", "insight", "intelligence",
    "marketing", "saas", "crm", "dashboard", "report",
    "detect", "detection",
  ];
  const hasAiSystemName = AI_SYSTEM_NAMES.some(t => kl.includes(t));
  const hasGenericAi = /\bai\b/.test(kl);
  if (!hasAiSystemName && !hasGenericAi) return false;
  const hasModifier = PRODUCT_MODIFIERS.some(m => kl.includes(m));
  return !hasModifier;
}

/**
 * Fetch relevant keywords for a domain.
 *
 * Priority chain:
 *   1. DB cache (7-day TTL), with generic-AI filter applied
 *   2. DataForSEO Labs ranked_keywords/live (actual organic rankings)
 *   3. Google Ads keywords_for_site/live (ad-relevance; great for established domains)
 *   4. LLM-generated keywords + DataForSEO volume lookup (for new domains with no coverage)
 *
 * isGenericAiOnly() strips broad AI terms at every step so only product-specific
 * buyer-intent keywords reach the caller.
 *
 * Never throws — any error returns an empty array.
 */
export async function getDomainKeywords(domain: string, niche?: string, brandName?: string): Promise<KeywordData[]> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";

  // Check cache first
  const cached = await getCachedKeywords(domain);
  if (cached) {
    const goodCached = cached.filter(k => !isGenericAiOnly(k.keyword));
    if (goodCached.length >= 3) return goodCached;
    if (!login || !password) return goodCached;
  } else if (!login || !password) {
    // No DataForSEO creds — try LLM if we have a niche
    if (niche) {
      return generateKeywordsWithLLM(niche, brandName ?? domain, domain, getLocationCode(domain));
    }
    return [];
  }

  const locationCode = getLocationCode(domain);

  // Step 1: ranked_keywords — actual organic rankings, highest relevance signal
  const rankedResult = await fetchRankedKeywords(domain, locationCode);
  const filteredRanked = rankedResult.filter(k => !isGenericAiOnly(k.keyword) && !isSuspectKeyword(k.keyword));
  if (filteredRanked.length >= 3) {
    await cacheKeywords(domain, filteredRanked, locationCode);
    return filteredRanked;
  }

  // Step 2: keywords_for_site — ad-relevance signal; excellent for established domains
  // (ahrefs.com: returns "seo tools", "backlink checker" etc.)
  // For new AI-niche domains the results are generic and get filtered to 0.
  // Note: for large domains this can return off-topic keywords from adjacent niches;
  // isSuspectKeyword() filters those out.
  const googleAdsResult = await fetchKeywordsForSiteGoogleAds(domain, locationCode);
  const filteredAds = googleAdsResult.filter(k => !isGenericAiOnly(k.keyword) && !isSuspectKeyword(k.keyword));
  if (filteredAds.length >= 3) {
    await cacheKeywords(domain, filteredAds, locationCode);
    return filteredAds;
  }

  // Step 3: LLM-generated keywords — for new/niche domains where DataForSEO has no coverage.
  // (geoiqai.com: no ranked keywords, keywords_for_site returns only generic AI terms)
  if (niche) {
    const llmKeywords = await generateKeywordsWithLLM(niche, brandName ?? domain, domain, locationCode);
    if (llmKeywords.length > 0) {
      await cacheKeywords(domain, llmKeywords, locationCode);
      return llmKeywords;
    }
  }

  // Return whatever survived filtering even if sparse
  const combined = [...filteredRanked, ...filteredAds];
  if (combined.length > 0) await cacheKeywords(domain, combined, locationCode);
  return combined;
}

/**
 * Generate buyer-intent keywords using the LLM when DataForSEO has no coverage for the domain.
 * Generates candidate keywords from the niche description, then enriches with real search volumes.
 */
async function generateKeywordsWithLLM(
  niche: string,
  brandName: string,
  domain: string,
  locationCode: number,
): Promise<KeywordData[]> {
  try {
    const resp = await kgOpenai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: "You are a keyword research expert. Return ONLY a valid JSON array of strings. No explanation, no markdown, no code blocks.",
      }, {
        role: "user",
        content: `You run a keyword research firm. A founder built a tool in this category: "${niche}".

Brand: ${brandName} (${domain})

The tool specifically helps with:
- Checking if a brand appears in AI search responses (ChatGPT, Gemini, Perplexity)
- Generative Engine Optimization (GEO)
- Tracking AI citations and brand mentions in AI answers
- Improving how a brand ranks in AI-generated search results

Generate 10 natural search queries a founder or marketer would type into Google when looking for this kind of tool.

Rules:
- 2-5 words per keyword (short, natural phrasing)
- AI system names (chatgpt, gemini, perplexity) are ALLOWED when combined with a product action - e.g. "track brand in chatgpt", "brand visibility chatgpt gemini"
- Mix angles: product-finding, comparison, how-to, feature-specific
- Do NOT repeat the same phrase in every keyword - vary vocabulary and angle
- No brand names, no "free", no generic standalone AI names with no context

Return ONLY a JSON array of 10 strings.
Example output: ["track brand in chatgpt", "geo optimization tool", "ai search ranking tracker", "brand visibility chatgpt gemini", "generative engine optimization tool", "check brand ai visibility", "ai citation tracker", "seo for ai search", "brand mentions in ai answers", "ai search visibility software"]`,
      }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
    // Strip any accidental markdown code fences
    const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const candidates = JSON.parse(clean) as string[];
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    // Keep only strings, remove any that slipped through the generic filter
    const good = candidates
      .filter(k => typeof k === "string" && k.length > 0 && !isGenericAiOnly(k))
      .slice(0, 10);

    if (good.length === 0) return [];

    // Enrich with real search volumes from DataForSEO
    const volumes = await fetchKeywordVolumes(good, locationCode);
    logger.info({ niche, count: good.length }, "[Keywords] LLM-generated keywords");

    return good.map(kw => ({ keyword: kw, volume: volumes[kw] ?? 0, competition: 0 }));
  } catch (err) {
    logger.warn({ err, niche }, "[Keywords] LLM generation failed");
    return [];
  }
}

/**
 * Fetch search volumes for a list of known keywords using DataForSEO Google Ads search_volume.
 * Returns a map of keyword -> monthly search volume.
 */
async function fetchKeywordVolumes(keywords: string[], locationCode: number): Promise<Record<string, number>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/keywords_data/google_ads/search_volume/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        keywords,
        location_code: locationCode,
        language_code: "en",
      }]),
    });
    clearTimeout(timeout);

    if (!resp.ok) return {};

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const items = (tasks[0]?.result as Array<Record<string, unknown>>) ?? [];

    const result: Record<string, number> = {};
    for (const item of items) {
      const kw = String(item.keyword ?? "");
      const vol = Number(item.search_volume ?? 0);
      if (kw) result[kw] = vol;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Google Ads keywords_for_site/live - returns keywords advertisers associate with the domain.
 * Far more accurate than estimated Labs data for determining what a site competes for.
 */
async function fetchKeywordsForSiteGoogleAds(domain: string, locationCode: number): Promise<KeywordData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/keywords_data/google_ads/keywords_for_site/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        target: domain,
        location_code: locationCode,
        language_code: "en",
        search_partners: false,
        limit: 20,
      }]),
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const items = (tasks[0]?.result as Array<Record<string, unknown>>) ?? [];

    const keywords: KeywordData[] = items
      .map(item => ({
        keyword: String(item.keyword ?? ""),
        volume: Number(item.search_volume ?? 0),
        competition: Number(item.competition ?? 0),
      }))
      .filter(k => k.keyword && k.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 15);

    if (keywords.length > 0) {
      console.log(`[DataForSEO] google_ads keywords_for_site: ${keywords.length} keywords for ${domain}`);
    }
    return keywords;
  } catch {
    return [];
  }
}

/**
 * DataForSEO Labs ranked_keywords/live - used as secondary fallback only.
 * Known to return unreliable results for many domains (modeled/estimated data).
 */
async function fetchRankedKeywords(domain: string, locationCode: number): Promise<KeywordData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${DATAFORSEO_BASE}/v3/dataforseo_labs/google/ranked_keywords/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        target: domain,
        language_code: "en",
        location_code: locationCode,
        limit: 20,
        order_by: ["keyword_data.keyword_info.search_volume,desc"],
        filters: ["keyword_data.keyword_info.search_volume", ">", 100],
      }]),
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

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
        keywords.push({ keyword, volume, competition: Number(kwInfo.competition ?? 0) });
      }
    }

    if (keywords.length > 0) {
      logger.info({ count: keywords.length, domain }, "[DataForSEO] ranked_keywords");
    }
    return keywords;
  } catch {
    return [];
  }
}

/**
 * DataForSEO Labs keyword_suggestions/live - returns keyword ideas for a niche phrase.
 * Used when ranked_keywords and keywords_for_site return too few domain-specific keywords.
 * Best for new/young domains that do not have meaningful organic rankings yet.
 */
async function fetchKeywordSuggestions(niche: string, locationCode: number): Promise<KeywordData[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/dataforseo_labs/google/keyword_suggestions/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        keyword: niche,
        location_code: locationCode,
        language_code: "en",
        limit: 20,
        order_by: ["keyword_data.keyword_info.search_volume,desc"],
        filters: ["keyword_data.keyword_info.search_volume", ">", 50],
      }]),
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const result = tasks[0]?.result as Array<Record<string, unknown>> | undefined;
    const items = (result?.[0]?.items as Array<Record<string, unknown>>) ?? [];

    const keywords: KeywordData[] = [];
    for (const item of items.slice(0, 20)) {
      const kwData = (item.keyword_data ?? {}) as Record<string, unknown>;
      const kwInfo = (kwData.keyword_info ?? {}) as Record<string, unknown>;
      const keyword = String(kwData.keyword ?? "");
      const volume = Number(kwInfo.search_volume ?? 0);
      if (keyword && volume > 0) {
        keywords.push({ keyword, volume, competition: Number(kwInfo.competition ?? 0) });
      }
    }

    if (keywords.length > 0) {
      logger.info({ niche, count: keywords.length }, "[DataForSEO] keyword_suggestions");
    }
    return keywords;
  } catch {
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

function sandboxMode(): boolean {
  return process.env.DATAFORSEO_SANDBOX === "true";
}

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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

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
      .slice(0, 50)
      .map(([domain, mentions]) => ({
        domain,
        mentions,
        mentionRate: totalMentions > 0 ? mentions / totalMentions : 0,
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

export interface ChatGptAd {
  title: string;
  snippet: string | null;
  url: string;
  domain: string;
  imageUrl: string | null;
  advertiserName: string | null;
  advertiserUrl: string | null;
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
  ads: ChatGptAd[];
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
    ads: [],
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
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

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
    const adMap = new Map<string, ChatGptAd>();
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

      // Parse organic sources
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

      // Parse ChatGPT ad items
      const rawItems = (result.items as Array<Record<string, unknown>>) ?? [];
      for (const item of rawItems) {
        if (String(item.type ?? "") !== "chat_gpt_ad") continue;
        const adUrl = String(item.url ?? "");
        if (!adUrl || adMap.has(adUrl)) continue;
        const advertiser = item.advertiser as Record<string, unknown> | null;
        const adDomain = String(item.domain ?? "").replace(/^www\./, "") || (() => {
          try { return new URL(adUrl).hostname.replace(/^www\./, ""); } catch { return ""; }
        })();
        adMap.set(adUrl, {
          title: String(item.title ?? ""),
          snippet: item.snippet ? String(item.snippet) : null,
          url: adUrl,
          domain: adDomain,
          imageUrl: item.image_url ? String(item.image_url) : null,
          advertiserName: advertiser?.name ? String(advertiser.name) : null,
          advertiserUrl: advertiser?.url ? String(advertiser.url) : null,
        });
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
      ads: Array.from(adMap.values()),
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
    ads: [],
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
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

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
      ads: [],
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
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

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
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  const payload = [{
    targets: allTargets.map(domain => {
      const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
      return {
        aggregation_key: bare,
        target: [{ domain: bare, search_filter: "include", search_scope: ["any", "sources", "search_results"] }],
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

// ─── AI Keyword Discovery (keywords for keywords) ─────────────────────────────

export interface KwForKwItem {
  keyword: string;
  aiSearchVolume: number;
  difficulty: number | null;
  searchIntent: string | null;
}

export interface KwForKwResult {
  items: KwForKwItem[];
  estimatedCostUsd: number;
  cached: boolean;
}

/**
 * DataForSEO AI keyword discovery: given a seed keyword, returns related keywords
 * with AI search volume. Used by Prompt Research to turn a topic into a keyword list.
 *
 * Endpoint: /v3/ai_optimization/ai_keyword_data/keywords_for_keywords/live
 * Falls back to empty when no credentials or API returns nothing.
 */
export async function getKeywordsForKeywords(
  keywords: string[],
  locationCode = 2840,
): Promise<KwForKwResult> {
  const empty: KwForKwResult = { items: [], estimatedCostUsd: 0, cached: false };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return empty;

  const top3 = keywords.slice(0, 3);
  const cacheKey = `kw_for_kw:${locationCode}:${top3.map(k => k.slice(0, 30).replace(/\s+/g, "_")).join("|")}`;

  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as KwForKwResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/ai_keyword_data/keywords_for_keywords/live`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify([{
        keywords: top3,
        location_code: locationCode,
        language_code: "en",
      }]),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "[DataForSEO] keywords_for_keywords non-OK response");
      return empty;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const totalCost = tasks.reduce((s, t) => s + Number((t as Record<string, unknown>).cost ?? 0), 0);

    const rawItems = (((tasks[0]?.result as Array<Record<string, unknown>>)?.[0])?.items as Array<Record<string, unknown>>) ?? [];

    const items: KwForKwItem[] = rawItems.slice(0, 20).map(item => ({
      keyword: String(item.keyword ?? ""),
      aiSearchVolume: Number(item.ai_search_volume ?? item.search_volume ?? 0),
      difficulty: item.keyword_difficulty != null ? Number(item.keyword_difficulty) : null,
      searchIntent: item.search_intent ? String(item.search_intent) : null,
    })).filter(i => i.keyword);

    const result: KwForKwResult = { items, estimatedCostUsd: totalCost, cached: false };
    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, totalCost.toFixed(5));
    logger.info({ count: items.length, cost: totalCost }, "[DataForSEO] keywords_for_keywords done");
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("abort")) logger.warn({ err, keywords }, "[DataForSEO] keywords_for_keywords failed");
    return empty;
  }
}

// ─── DataForSEO Account Balance ─────────────────────────────────────────────────

export interface DfAccountInfo {
  connected: boolean;
  hasCredentials: boolean;
  balance: number | null;
  login: string | null;
  error?: string;
}

/**
 * Check DataForSEO credentials and return account balance.
 * Used by the API status endpoint and sidebar status pill.
 */
export async function getDfAccountInfo(): Promise<DfAccountInfo> {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";

  if (!login || !password) {
    return { connected: false, hasCredentials: false, balance: null, login: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/appendix/user_data`, {
      method: "GET",
      signal: controller.signal,
      headers: getAuthHeader(),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { connected: false, hasCredentials: true, balance: null, login, error: `HTTP ${resp.status}` };
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const result = (tasks[0]?.result as Array<Record<string, unknown>>)?.[0];

    // DataForSEO user_data endpoint returns rates/limits info but not a simple money balance.
    // We just verify connectivity here; balance is not available from this endpoint.
    const balance = result?.money_balance != null ? Number(result.money_balance) : null;

    return { connected: true, hasCredentials: true, balance, login };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { connected: false, hasCredentials: true, balance: null, login, error: msg };
  }
}

// ─── Site keyword helpers ───────────────────────────────────────────────────────

/**
 * Filter ranked keywords to exclude brand-name terms AND generic AI system-name keywords.
 * For ahrefs.com: removes "ahrefs" branded terms.
 * For geoiqai.com: removes "gemini ai", "claude ai", "grok ai" etc.
 */
export function filterRankedKeywords(keywords: KeywordData[], domain: string, limit = 5): string[] {
  const bare = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? "";
  const brandSlug = (bare.split(".")[0] ?? "").toLowerCase();
  const brandParts = brandSlug.split(/[-_]/).filter(p => p.length > 2);

  return keywords
    .filter(kw => {
      const kl = kw.keyword.toLowerCase();
      if (brandParts.some(part => kl.includes(part))) return false;
      if (isGenericAiOnly(kl)) return false;
      return true;
    })
    .slice(0, limit)
    .map(k => k.keyword);
}

/**
 * Build fallback prompts from a category string when no ranked keywords exist.
 */
export function buildCategoryFallbackKeywords(category: string | null | undefined): string[] {
  const cat = ((category ?? "").toLowerCase().trim()) || "software";
  return [
    `best ${cat} tool`,
    `${cat} software`,
    `${cat} for startups`,
  ];
}

// ─── Google AI Overview - Audit Result ─────────────────────────────────────────

export interface GoogleAiOverviewAuditResult {
  found: boolean;
  brandMentioned: boolean;
  brandInCitations: boolean;
  score: number;
  overviewText: string | null;
  citedSources: Array<{ url: string; domain: string; title: string }>;
  keywordsChecked: string[];
  unavailable?: boolean;
}

/**
 * Check whether a brand appears in Google AI Overview for its top keywords.
 * Uses DataForSEO SERP live/advanced endpoint. Results cached 24h.
 *
 * Scoring (averaged across all checked keywords):
 *   Brand in text + cited: 100
 *   Brand in text only:    70
 *   Brand in citations only: 50
 *   AI Overview found, brand absent: 20
 *   No AI Overview for this keyword: 0
 */
export async function getGoogleAiOverviewForAudit(
  keywords: string[],
  domain: string,
  brandName: string,
): Promise<GoogleAiOverviewAuditResult> {
  const unavailable: GoogleAiOverviewAuditResult = {
    found: false, brandMentioned: false, brandInCitations: false,
    score: 0, overviewText: null, citedSources: [], keywordsChecked: keywords,
    unavailable: true,
  };

  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || keywords.length === 0) return unavailable;

  const top3 = keywords.slice(0, 3);
  const cacheKey = `gao_audit:2840:${domain}:${top3.map(k => k.slice(0, 20).replace(/\W+/g, "_")).join("|")}`;

  const cached = await getDfCache(cacheKey);
  if (cached) return cached as unknown as GoogleAiOverviewAuditResult;
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return unavailable; }

  const bare = domain.replace(/^www\./, "").toLowerCase();
  const brandLower = brandName.toLowerCase();

  try {
    const controller = new AbortController();
    const tmout = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/serp/google/organic/live/advanced`, {
      method: "POST",
      signal: controller.signal,
      headers: getAuthHeader(),
      body: JSON.stringify(top3.map(kw => ({
        keyword: kw,
        location_code: 2840,
        language_code: "en",
        device: "desktop",
        os: "windows",
        depth: 10,
      }))),
    });
    clearTimeout(tmout);
    if (!resp.ok) return unavailable;

    const data = (await resp.json()) as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];

    let foundAny = false;
    let mentionedAny = false;
    let inCitationsAny = false;
    let overviewText: string | null = null;
    const allCited: Array<{ url: string; domain: string; title: string }> = [];
    const kwScores: number[] = [];

    for (let i = 0; i < top3.length; i++) {
      const taskResult = (tasks[i]?.result as Array<Record<string, unknown>>)?.[0];
      const items = (taskResult?.items as Array<Record<string, unknown>>) ?? [];
      const aiItem = items.find(it => it.type === "ai_overview") ?? items.find(it => it.type === "featured_snippet");

      if (!aiItem) { kwScores.push(0); continue; }

      foundAny = true;
      const rawText = String(aiItem.text ?? aiItem.content ?? "");
      if (!overviewText && rawText.length > 10) overviewText = rawText.slice(0, 800);

      const subItems = (aiItem.items as Array<Record<string, unknown>>) ?? [];
      let kwMentioned = rawText.toLowerCase().includes(bare) || rawText.toLowerCase().includes(brandLower);
      let kwInCitations = false;

      for (const sub of subItems) {
        const content = String(sub.content ?? sub.text ?? "");
        if (content.toLowerCase().includes(bare) || content.toLowerCase().includes(brandLower)) kwMentioned = true;
        const links = (sub.links as Array<Record<string, unknown>>) ?? [];
        for (const link of links) {
          const lu = String(link.url ?? "");
          const ld = (String(link.domain ?? "")
            || (lu.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? ""));
          const ldClean = ld.replace(/^www\./, "").toLowerCase();
          const lt = String(link.title ?? "");
          if (lu && !allCited.some(s => s.url === lu)) allCited.push({ url: lu, domain: ldClean, title: lt });
          if (ldClean && (ldClean.includes(bare) || bare.includes(ldClean))) kwInCitations = true;
        }
      }

      if (kwMentioned) mentionedAny = true;
      if (kwInCitations) inCitationsAny = true;
      kwScores.push(kwMentioned && kwInCitations ? 100 : kwMentioned ? 70 : kwInCitations ? 50 : 20);
    }

    const score = kwScores.length > 0
      ? Math.round(kwScores.reduce((a, b) => a + b, 0) / kwScores.length)
      : 0;

    const result: GoogleAiOverviewAuditResult = {
      found: foundAny, brandMentioned: mentionedAny, brandInCitations: inCitationsAny,
      score, overviewText, citedSources: allCited.slice(0, 10), keywordsChecked: top3,
    };

    await setDfCache(cacheKey, result as unknown as Record<string, unknown>, (top3.length * 0.002).toFixed(4));
    return result;
  } catch {
    return unavailable;
  }
}

// ─── LLM Aggregated Metrics ────────────────────────────────────────────────────

interface LlmGroupElement {
  type: string;
  key: string;
  mentions: number;
  ai_search_volume: number;
  impressions: number | null;
}

interface LlmAggTotal {
  location: LlmGroupElement[] | null;
  language: LlmGroupElement[] | null;
  platform: LlmGroupElement[] | null;
  sources_domain: LlmGroupElement[] | null;
  search_results_domain: LlmGroupElement[] | null;
}

export interface LlmAggResult {
  total: LlmAggTotal | null;
  mentions: number;      // direct: times this domain was cited in AI answers
  citedPages: number;    // direct: number of unique URLs cited
  cached: boolean;
}

/**
 * Fetches domain citation metrics from the LLM Mentions API.
 * When platform is specified ("google" | "chat_gpt"), fetches for that platform only.
 * Returns both the full total breakdown and direct mention/citedPages counts.
 */
export async function getLlmAggregatedMetrics(
  domain: string,
  dateFrom: string,
  dateTo: string,
  platform?: "google" | "chat_gpt",
): Promise<LlmAggResult> {
  const empty: LlmAggResult = { total: null, mentions: 0, citedPages: 0, cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return empty;

  const cacheKey = `llm_agg:${platform ?? "all"}:${domain}:${dateFrom}:${dateTo}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as LlmAggResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const auth = getAuthHeader();
    const body: Record<string, unknown> = {
      target: [{ domain, search_scope: ["sources"] }],
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
    };
    if (platform) body.platform = platform;

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/aggregated_metrics/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([body]),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const task = tasks[0];
    const taskResult = (task?.result as Array<Record<string, unknown>>)?.[0];
    const statusCode = Number(task?.status_code ?? 0);
    if (statusCode !== 20000 || !taskResult) return empty;

    // DataForSEO always returns result[0].total (never result[0].metrics for domain targets).
    // When platform is specified, total.platform[] has exactly one entry for that platform.
    const total = taskResult.total as LlmAggTotal | undefined;
    const platforms = (total?.platform ?? []) as Array<{ key: string; mentions: number }>;
    const mentions = platforms.reduce((s, p) => s + (p.mentions || 0), 0);
    // cited_pages is not returned by aggregated_metrics; use top_pages count separately
    const citedPages = 0;

    const res: LlmAggResult = { total: total ?? null, mentions, citedPages, cached: false };
    await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.001");
    return res;
  } catch {
    return empty;
  }
}

// ─── LLM Top Pages ─────────────────────────────────────────────────────────────

export interface LlmTopPage {
  url: string;
  mentions: number;
  ai_search_volume: number;
}

export interface LlmTopPagesResult {
  pages: LlmTopPage[];
  totalCount: number;
  cached: boolean;
}

export async function getLlmTopPagesList(
  domain: string,
  dateFrom: string,
  dateTo: string,
  limit = 50,
  platform?: "google" | "chat_gpt",
): Promise<LlmTopPagesResult> {
  const empty: LlmTopPagesResult = { pages: [], totalCount: 0, cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return empty;

  const cacheKey = `llm_pages:${platform ?? "all"}:${domain}:${dateFrom}:${dateTo}:${limit}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as LlmTopPagesResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const auth = getAuthHeader();
    const body: Record<string, unknown> = {
      target: [{ domain, search_filter: "include" }],
      date_from: dateFrom,
      date_to: dateTo,
      language_code: "en",
      limit,
    };
    if (platform) body.platform = platform;

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/top_pages/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([body]),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const taskResult = (tasks[0]?.result as Array<Record<string, unknown>>)?.[0];
    if (!taskResult) return empty;

    const items = (taskResult.items as Array<Record<string, unknown>>) ?? [];
    const pages: LlmTopPage[] = items.map(item => {
      const platforms = (item.platform as Array<Record<string, unknown>>) ?? [];
      return {
        url: String(item.key ?? ""),
        mentions: platforms.reduce((s, p) => s + (Number(p.mentions) || 0), 0),
        ai_search_volume: platforms.reduce((s, p) => s + (Number(p.ai_search_volume) || 0), 0),
      };
    });

    const res: LlmTopPagesResult = { pages, totalCount: pages.length, cached: false };
    await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.001");
    return res;
  } catch {
    return empty;
  }
}

// ─── LLM Search Topics ─────────────────────────────────────────────────────────

export interface LlmSearchTopic {
  question: string;
  platform: string;
  model_name: string;
  ai_search_volume: number;
  location_code: number;
  sources: string[]; // cited source URLs for this topic
  brandEntities: string[]; // brand names mentioned in AI responses for this query
  monthlySearches: Array<{ year: number; month: number; count: number }>;
  answer: string; // AI answer text (used for brand extraction fallback)
}

export interface LlmSearchTopicsResult {
  items: LlmSearchTopic[];
  totalCount: number;
  cached: boolean;
}

export async function getLlmSearchTopics(
  keyword: string,
  dateFrom: string,
  dateTo: string,
  filter: "include" | "exclude" = "include",
  limit = 50,
  platform: "google" | "chat_gpt" = "google",
): Promise<LlmSearchTopicsResult> {
  const empty: LlmSearchTopicsResult = { items: [], totalCount: 0, cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return empty;

  const cacheKey = `llm_topics_kw:${platform}:${keyword}:${dateFrom}:${dateTo}:${filter}:${limit}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as LlmSearchTopicsResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const auth = getAuthHeader();
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/search/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([{
        target: [{ keyword, search_filter: filter, search_scope: ["answer"] }],
        platform,
        date_from: dateFrom,
        date_to: dateTo,
        order_by: ["ai_search_volume,desc"],
        limit,
      }]),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const taskResult = (tasks[0]?.result as Array<Record<string, unknown>>)?.[0];
    if (!taskResult) return empty;

    const totalCount = Number(taskResult.total_count ?? 0);
    const items = (taskResult.items as Array<Record<string, unknown>>) ?? [];
    const topics: LlmSearchTopic[] = items.map(item => ({
      question: String(item.se_query ?? item.question ?? item.keyword ?? ""),
      platform: String(item.platform ?? platform),
      model_name: String(item.model_name ?? ""),
      ai_search_volume: Number(item.ai_search_volume ?? 0),
      location_code: Number(item.location_code ?? 2840),
      sources: ((item.sources as Array<Record<string, unknown>>) ?? [])
        .map(s => String(s.url ?? ""))
        .filter(Boolean),
      brandEntities: ((item.brand_entities as Array<Record<string, unknown>>) ?? [])
        .map(b => String(b.name ?? ""))
        .filter(Boolean),
      monthlySearches: (((item.ai_monthly_searches ?? item.monthly_searches) as Array<Record<string, unknown>>) ?? [])
        .map(m => ({ year: Number(m.year ?? 0), month: Number(m.month ?? 0), count: Number(m.count ?? m.search_volume ?? 0) })),
      answer: String(item.answer ?? item.snippet ?? ""),
    }));

    const res: LlmSearchTopicsResult = { items: topics, totalCount, cached: false };
    await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.002");
    return res;
  } catch {
    return empty;
  }
}

// ─── LLM Keyword Aggregated Metrics (brand keyword in answer text) ─────────────

export interface LlmKeywordAggResult {
  total: LlmAggTotal | null;   // full breakdown: platform[], location[], language[], sources_domain[]
  mentions: number;             // sum of platform[].mentions (keyword in AI answer text)
  aiSearchVolume: number;       // language["en"].ai_search_volume
  cached: boolean;
}

/**
 * Fetches aggregated LLM mention metrics for a BRAND KEYWORD (not domain).
 * Searches AI answer text for the keyword (e.g. "netflix"), returning the
 * total times it appears in AI-generated answers. This gives the large
 * Semrush-style "Mentions" number, plus per-platform and per-country breakdown.
 *
 * Endpoint: /v3/ai_optimization/llm_mentions/aggregated_metrics/live
 * target.keyword + search_scope: ["answer"]
 */
export async function getLlmKeywordAggMetrics(
  brandName: string,
  dateFrom: string,
  dateTo: string,
  platform?: "google" | "chat_gpt",
): Promise<LlmKeywordAggResult> {
  const empty: LlmKeywordAggResult = { total: null, mentions: 0, aiSearchVolume: 0, cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || !brandName) return empty;

  const cacheKey = `llm_kw_agg:${platform ?? "all"}:${brandName}:${dateFrom}:${dateTo}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as LlmKeywordAggResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const auth = getAuthHeader();
    const body: Record<string, unknown> = {
      target: [{ keyword: brandName, search_scope: ["answer"] }],
      date_from: dateFrom,
      date_to: dateTo,
    };
    if (platform) body.platform = platform;

    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/aggregated_metrics/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([body]),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const task = tasks[0];
    const taskResult = (task?.result as Array<Record<string, unknown>>)?.[0];
    const statusCode = Number(task?.status_code ?? 0);
    if (statusCode !== 20000 || !taskResult) return empty;

    const total = taskResult.total as LlmAggTotal | undefined;

    // DataForSEO always uses result[0].total (never metrics).
    // When platform is specified, total.platform[] has exactly one entry.
    const platformArr = (total?.platform ?? []) as Array<{ key: string; mentions: number; ai_search_volume?: number }>;
    const mentions = platformArr.reduce((s, p) => s + (p.mentions || 0), 0);
    const aiSearchVolume = platformArr.reduce((s, p) => s + (p.ai_search_volume || 0), 0);

    const res: LlmKeywordAggResult = { total: total ?? null, mentions, aiSearchVolume, cached: false };
    await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.001");
    return res;
  } catch {
    return empty;
  }
}

// ─── LLM Cross-Aggregated by group_by (single keyword target) ──────────────────

export interface LlmCrossAggGroupItem {
  aggregationKey: string;
  mentions: number;
  aiSearchVolume: number;
}

export interface LlmCrossAggByGroupResult {
  items: LlmCrossAggGroupItem[];
  cached: boolean;
}

/**
 * Fetches LLM cross-aggregated metrics for a single brand keyword, grouped
 * by llm_name, location_code, or date. Enables "Distribution by LLM" and
 * "Mentions by Country" sections using real per-platform breakdown data.
 *
 * Endpoint: /v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live
 * target.keyword + group_by: "llm_name" | "location_code" | "date"
 */
export async function getLlmCrossAggByGroup(
  brandName: string,
  dateFrom: string,
  dateTo: string,
  groupBy: "llm_name" | "location_code" | "date",
): Promise<LlmCrossAggByGroupResult> {
  const empty: LlmCrossAggByGroupResult = { items: [], cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password || !brandName) return empty;

  const cacheKey = `llm_cross_grp:${brandName}:${dateFrom}:${dateTo}:${groupBy}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as LlmCrossAggByGroupResult), cached: true };
  if (sandboxMode()) { logger.info({ cacheKey }, "[DFS] sandbox - skipping live call"); return empty; }

  try {
    const auth = getAuthHeader();
    const payload = [{
      target: [{ keyword: brandName, search_scope: ["answer"] }],
      date_from: dateFrom,
      date_to: dateTo,
      group_by: groupBy,
      language_code: "en",
    }];
    logger.info({ brandName, groupBy, dateFrom, dateTo }, "llm_cross_agg: request");
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/cross_aggregated_metrics/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(payload),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const task = tasks[0];
    const taskResult = (task?.result as Array<Record<string, unknown>>)?.[0];
    const rawItems = (taskResult?.items as Array<Record<string, unknown>>) ?? [];
    logger.info({
      brandName,
      statusCode: task?.status_code,
      statusMsg: task?.status_message,
      itemCount: rawItems.length,
      firstItem: rawItems[0] ?? null,
    }, "llm_cross_agg: response");
    if (!taskResult) return empty;

    const items: LlmCrossAggGroupItem[] = rawItems.map(item => {
      // DataForSEO may return mentions at item.total.mentions or item.mentions directly
      const tt = (item.total as Record<string, number>) ?? {};
      return {
        aggregationKey: String(item.aggregation_key ?? item.date ?? ""),
        mentions: Number(tt.mentions ?? item.mentions ?? 0),
        aiSearchVolume: Number(tt.ai_search_volume ?? tt.impressions ?? item.ai_search_volume ?? 0),
      };
    });

    const res: LlmCrossAggByGroupResult = { items, cached: false };
    // Only cache if we got real data - don't cache empty results so retries work
    if (items.length > 0) {
      await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.001");
    }
    return res;
  } catch (err) {
    logger.error({ brandName, groupBy, err }, "llm_cross_agg: error");
    return empty;
  }
}

// ─── LLM Topic Prompts (expand a topic row to show individual prompts) ─────────

export interface TopicPromptItem {
  prompt: string;
  answer: string;
  sources: string[];
  brandEntities: Array<{ name: string }>;
  fanOutQueries: string[];
  aiSearchVolume: number;
}

export interface TopicPromptsResult {
  items: TopicPromptItem[];
  cached: boolean;
}

export async function getLlmTopicPrompts(
  topicName: string,
  dateFrom: string,
  dateTo: string,
  platform = "google",
  limit = 20,
): Promise<TopicPromptsResult> {
  const empty: TopicPromptsResult = { items: [], cached: false };
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  if (!login || !password) return empty;

  const cacheKey = `topic_expand:${topicName}:${platform}:${dateFrom}:${dateTo}`;
  const cached = await getDfCache(cacheKey);
  if (cached) return { ...(cached as unknown as TopicPromptsResult), cached: true };

  try {
    const auth = getAuthHeader();
    logger.info({ topicName, platform }, "topic-prompts: request");
    const resp = await fetch(`${DATAFORSEO_BASE}/v3/ai_optimization/llm_mentions/search/live`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify([{
        target: [{ keyword: topicName, search_scope: ["answer"] }],
        platform,
        date_from: dateFrom,
        date_to: dateTo,
        language_code: "en",
        order_by: ["ai_search_volume,desc"],
        limit,
      }]),
    });
    const data = await resp.json() as Record<string, unknown>;
    const tasks = (data.tasks as Array<Record<string, unknown>>) ?? [];
    const taskResult = (tasks[0]?.result as Array<Record<string, unknown>>)?.[0];
    const statusCode = Number((tasks[0] as Record<string, unknown>)?.status_code ?? 0);
    const rawItems = (taskResult?.items as Array<Record<string, unknown>>) ?? [];
    logger.info({ topicName, statusCode, itemCount: rawItems.length }, "topic-prompts: response");
    if (!taskResult) return empty;

    const items: TopicPromptItem[] = rawItems.map(item => {
      const rawSources = (item.sources as Array<Record<string, unknown>>) ?? [];
      const rawEntities = (item.brand_entities as Array<Record<string, unknown>>) ?? [];
      const rawFanOut = (item.fan_out_queries as Array<unknown>) ?? [];
      return {
        prompt: String(item.se_query ?? item.question ?? item.keyword ?? ""),
        answer: String(item.answer ?? ""),
        sources: rawSources.map(s => String(s.url ?? "")).filter(Boolean),
        brandEntities: rawEntities.map(b => ({ name: String(b.name ?? "") })).filter(b => b.name),
        fanOutQueries: rawFanOut
          .slice(0, 5)
          .map(q => String((q as Record<string, unknown>)?.se_query ?? (q as Record<string, unknown>)?.question ?? q ?? ""))
          .filter(Boolean),
        aiSearchVolume: Number(item.ai_search_volume ?? 0),
      };
    });

    const res: TopicPromptsResult = { items, cached: false };
    if (items.length > 0) {
      await setDfCache(cacheKey, res as unknown as Record<string, unknown>, "0.002");
    }
    return res;
  } catch (err) {
    logger.error({ topicName, err }, "topic-prompts: error");
    return empty;
  }
}
