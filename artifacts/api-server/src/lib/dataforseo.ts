import { db, keywordCacheTable } from "@workspace/db";
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
