import Exa from "exa-js";
import { tavily } from "@tavily/core";
import { logger } from "./logger";

function getExaClient(): Exa | null {
  const key = process.env.EXA_API_KEY;
  if (!key) return null;
  return new Exa(key);
}

function getTavilyClient(): ReturnType<typeof tavily> | null {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  return tavily({ apiKey: key });
}

export interface AIPresencePlatform {
  key: string;
  displayName: string;
  color: string;
  found: boolean;
  score: number;
  pct: number;
  evidence: string | null;
}

export interface AIPresenceScanResult {
  score: number;
  hasData: boolean;
  brandName: string;
  chatgptScore: number;
  chatgptFound: boolean;
  chatgptEvidence: string | null;
  geminiScore: number;
  geminiFound: boolean;
  geminiEvidence: string | null;
  perplexityScore: number;
  perplexityFound: boolean;
  perplexityEvidence: string | null;
  platforms: AIPresencePlatform[];
  evidenceCount: number;
  topEvidence: string | null;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface ExaResult {
  title?: string;
  url?: string;
  highlights?: string[];
}

/**
 * Determines if a result mentions the brand.
 * Checks the domain slug, the full domain, and common brand name variants.
 * Uses OR logic - any match counts.
 */
function resultMentionsBrand(
  text: string,
  domain: string,
  brandSlug: string,
): boolean {
  const t = text.toLowerCase();
  // Match the bare domain slug (e.g. "jiostar"), the full domain ("jiostar.com"),
  // and a few common variant patterns (e.g. "jio star", hyphenated)
  return (
    t.includes(brandSlug) ||
    t.includes(domain.toLowerCase()) ||
    t.includes(brandSlug.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
  );
}

/**
 * Scores a single AI platform based on Tavily search results only.
 * Exa results are handled separately as a platform-wide boost signal.
 * Strategy:
 *   - Tavily results that mention the brand: up to 75 points (25 per result, max 3)
 *   - found = score >= 25 (at least one Tavily result mentions the brand)
 */
function scorePlatform(
  tavilyResults: TavilyResult[],
  domain: string,
  brandSlug: string,
): { found: boolean; score: number; evidence: string | null } {
  const matchingTavily = tavilyResults.filter(r =>
    resultMentionsBrand(`${r.title ?? ""} ${r.content ?? ""}`, domain, brandSlug),
  );

  const score = Math.min(matchingTavily.length * 25, 75);
  const found = score >= 25;

  // Best evidence snippet from Tavily (more readable than Exa highlights)
  const bestTavily = matchingTavily[0];
  const evidence = bestTavily?.content?.slice(0, 250) ?? null;

  return { found, score, evidence };
}

/**
 * Runs a web-evidence-based AI presence scan for a domain.
 * Uses Exa neural search + Tavily targeted searches to find real evidence
 * of the brand being mentioned across AI systems.
 *
 * Returns null if neither EXA_API_KEY nor TAVILY_API_KEY is set,
 * signaling the caller to fall back to the existing audit engine.
 */
export async function runAIPresenceScan(domain: string): Promise<AIPresenceScanResult | null> {
  const exa = getExaClient();
  const tvly = getTavilyClient();

  if (!exa && !tvly) {
    logger.info({ domain }, "ai-presence-scan: no API keys configured, skipping");
    return null;
  }

  // Extract brand name from domain: "jiostar.com" -> "Jiostar", "hubspot.com" -> "Hubspot"
  const rawBrand = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  const brandName = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1);
  const brandSlug = rawBrand.toLowerCase();

  logger.info({ domain, brandName, brandSlug, hasExa: !!exa, hasTavily: !!tvly }, "ai-presence-scan: starting");

  // Run all 4 searches in parallel - each failure is isolated
  const [exaBrandSearch, tavilyChatGPT, tavilyGemini, tavilyPerplexity] =
    await Promise.allSettled([
      // Exa: neural search for brand in AI-related content (supporting signal for all platforms)
      exa
        ? exa.searchAndContents(
            `${brandName} ${domain} mentioned recommended cited AI ChatGPT Gemini Perplexity`,
            {
              type: "neural",
              numResults: 10,
              startPublishedDate: "2025-01-01",
              highlights: {
                query: `${brandName} AI recommended`,
                numSentences: 2,
                highlightsPerUrl: 2,
              },
            },
          )
        : Promise.resolve(null),

      // Tavily: ChatGPT-specific evidence
      // Semantic intent: "what would a page look like that discusses ChatGPT citing this brand?"
      tvly
        ? tvly.search(
            `Does ChatGPT recommend or mention ${brandName}? ChatGPT AI response ${domain}`,
            {
              searchDepth: "advanced",
              maxResults: 7,
              topic: "general",
              days: 180,
            },
          )
        : Promise.resolve(null),

      // Tavily: Gemini-specific evidence
      tvly
        ? tvly.search(
            `Does Google Gemini recommend or mention ${brandName}? Gemini AI response ${domain}`,
            {
              searchDepth: "advanced",
              maxResults: 7,
              topic: "general",
              days: 180,
            },
          )
        : Promise.resolve(null),

      // Tavily: Perplexity-specific evidence
      tvly
        ? tvly.search(
            `Does Perplexity AI recommend or cite ${brandName}? Perplexity answer ${domain}`,
            {
              searchDepth: "advanced",
              maxResults: 7,
              topic: "general",
              days: 180,
            },
          )
        : Promise.resolve(null),
    ]);

  // Extract Exa results
  const exaResults: ExaResult[] =
    exaBrandSearch.status === "fulfilled" && exaBrandSearch.value
      ? (exaBrandSearch.value.results ?? []).map(r => ({
          title: r.title ?? undefined,
          url: r.url ?? undefined,
          highlights: (r as { highlights?: string[] }).highlights ?? [],
        }))
      : [];

  if (exaBrandSearch.status === "rejected") {
    logger.warn({ err: exaBrandSearch.reason, domain }, "ai-presence-scan: Exa failed");
  }

  // Extract Tavily results
  const extractTavily = (
    s: PromiseSettledResult<{ results?: TavilyResult[] } | null>,
  ): TavilyResult[] =>
    s.status === "fulfilled" && s.value ? (s.value.results ?? []) : [];

  const chatgptRaw = extractTavily(tavilyChatGPT);
  const geminiRaw = extractTavily(tavilyGemini);
  const perplexityRaw = extractTavily(tavilyPerplexity);

  // Score each platform from Tavily only (Exa handled separately as a boost signal)
  const chatgpt = scorePlatform(chatgptRaw, domain, brandSlug);
  const gemini = scorePlatform(geminiRaw, domain, brandSlug);
  const perplexity = scorePlatform(perplexityRaw, domain, brandSlug);

  // Count how many Exa results mention the brand (neural search as supporting signal)
  const exaMatchCount = exaResults.filter(r =>
    resultMentionsBrand(`${r.title ?? ""} ${(r.highlights ?? []).join(" ")}`, domain, brandSlug),
  ).length;

  // Per-platform Exa boost: Tavily doesn't always surface platform-specific pages for every AI system.
  // If Exa found strong brand presence (5+ neural results) and a platform got 0 from Tavily,
  // apply a proportional Exa-based score to that platform.
  // Scale: 5 matches = 30pts (found), 7+ = 45pts, 9+ = 60pts
  if (exaMatchCount >= 5) {
    const exaBoostScore = exaMatchCount >= 9 ? 60 : exaMatchCount >= 7 ? 45 : 30;
    if (!chatgpt.found) {
      chatgpt.found = true;
      chatgpt.score = exaBoostScore;
    }
    if (!gemini.found) {
      gemini.found = true;
      gemini.score = Math.round(exaBoostScore * 0.85);
    }
    if (!perplexity.found) {
      perplexity.found = true;
      perplexity.score = Math.round(exaBoostScore * 0.85);
    }
    logger.info({ domain, exaMatchCount, exaBoostScore }, "ai-presence-scan: Exa per-platform boost applied");
  }

  // Overall score: average of the 3 platform scores
  const overallScore = Math.min(
    Math.round((chatgpt.score + gemini.score + perplexity.score) / 3),
    100,
  );
  const hasData = chatgpt.found || gemini.found || perplexity.found;

  // Top Exa evidence snippet
  const topEvidence =
    exaResults.length > 0 ? (exaResults[0]?.highlights?.[0] ?? null) : null;

  // Build platform rows for UI
  const platformDefs: AIPresencePlatform[] = [
    { key: "chat_gpt", displayName: "ChatGPT", color: "#10A37F", found: chatgpt.found, score: chatgpt.score, pct: 0, evidence: chatgpt.evidence },
    { key: "gemini", displayName: "Gemini", color: "#4285F4", found: gemini.found, score: gemini.score, pct: 0, evidence: gemini.evidence },
    { key: "perplexity", displayName: "Perplexity", color: "#20B2AA", found: perplexity.found, score: perplexity.score, pct: 0, evidence: perplexity.evidence },
  ];
  const totalScore = platformDefs.reduce((s, p) => s + p.score, 0);
  const platforms: AIPresencePlatform[] = platformDefs.map(p => ({
    ...p,
    pct: totalScore > 0 ? Math.round((p.score / totalScore) * 100) : 0,
  }));

  logger.info(
    {
      domain,
      overallScore,
      hasData,
      chatgptFound: chatgpt.found,
      chatgptScore: chatgpt.score,
      geminiFound: gemini.found,
      geminiScore: gemini.score,
      perplexityFound: perplexity.found,
      perplexityScore: perplexity.score,
      exaMatchCount,
    },
    "ai-presence-scan: complete",
  );

  return {
    score: overallScore,
    hasData,
    brandName,
    chatgptScore: chatgpt.score,
    chatgptFound: chatgpt.found,
    chatgptEvidence: chatgpt.evidence,
    geminiScore: gemini.score,
    geminiFound: gemini.found,
    geminiEvidence: gemini.evidence,
    perplexityScore: perplexity.score,
    perplexityFound: perplexity.found,
    perplexityEvidence: perplexity.evidence,
    platforms,
    evidenceCount: exaResults.length,
    topEvidence,
  };
}
