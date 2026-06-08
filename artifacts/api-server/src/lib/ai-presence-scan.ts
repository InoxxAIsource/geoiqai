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
  score?: number;
}

interface ExaResult {
  title?: string;
  url?: string;
  highlights?: string[];
}

function scoreFromResults(
  results: TavilyResult[],
  exaResults: ExaResult[],
  brandName: string,
  domain: string,
): { found: boolean; score: number; evidence: string | null; urlCited: boolean } {
  const brandLower = brandName.toLowerCase();
  const domainLower = domain.toLowerCase();

  // Combine Tavily content + Exa highlights for matching
  const combined: { text: string; url?: string }[] = [
    ...results.map(r => ({ text: `${r.title ?? ""} ${r.content ?? ""}`, url: r.url })),
    ...exaResults.map(r => ({ text: `${r.title ?? ""} ${(r.highlights ?? []).join(" ")}`, url: r.url })),
  ];

  const matching = combined.filter(c =>
    c.text.toLowerCase().includes(brandLower),
  );

  if (matching.length === 0) return { found: false, score: 0, evidence: null, urlCited: false };

  // Score: each matching result adds up to 25 points, capped at 100
  const score = Math.min(matching.length * 25, 100);
  const urlCited = matching.some(c => c.url?.toLowerCase().includes(domainLower));

  // Best evidence snippet
  const bestTavily = results.find(r =>
    (r.title?.toLowerCase().includes(brandLower) || r.content?.toLowerCase().includes(brandLower))
  );
  const evidence = bestTavily?.content?.slice(0, 250) ?? null;

  return { found: true, score, evidence, urlCited };
}

/**
 * Runs a web-evidence-based AI presence scan for a domain.
 * Uses Exa neural search + Tavily targeted searches to find real evidence
 * of the brand being mentioned in AI-generated content.
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

  const rawBrand = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  const brandName = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1);
  const brandLower = rawBrand.toLowerCase();

  logger.info({ domain, brandName, hasExa: !!exa, hasTavily: !!tvly }, "ai-presence-scan: starting");

  // Run all searches in parallel - fail gracefully per search
  const [
    exaBrandSearch,
    tavilyChatGPT,
    tavilyGemini,
    tavilyPerplexity,
  ] = await Promise.allSettled([
    exa
      ? exa.searchAndContents(
          `${brandName} ${domain} mentioned recommended cited by AI assistant`,
          {
            type: "neural",
            numResults: 10,
            startPublishedDate: "2025-01-01",
            highlights: {
              query: `${brandName} recommended mentioned AI`,
              numSentences: 2,
              highlightsPerUrl: 2,
            },
          },
        )
      : Promise.resolve(null),

    tvly
      ? tvly.search(`${brandName} ${domain} ChatGPT recommended suggests`, {
          searchDepth: "basic",
          maxResults: 5,
          topic: "general",
        })
      : Promise.resolve(null),

    tvly
      ? tvly.search(`${brandName} ${domain} Gemini Google AI recommended`, {
          searchDepth: "basic",
          maxResults: 5,
          topic: "general",
        })
      : Promise.resolve(null),

    tvly
      ? tvly.search(`${brandName} ${domain} Perplexity cited source`, {
          searchDepth: "basic",
          maxResults: 5,
          topic: "general",
        })
      : Promise.resolve(null),
  ]);

  // Extract Exa results safely
  const exaResults: ExaResult[] =
    exaBrandSearch.status === "fulfilled" && exaBrandSearch.value
      ? (exaBrandSearch.value.results ?? []).map(r => ({
          title: r.title ?? undefined,
          url: r.url ?? undefined,
          highlights: (r as { highlights?: string[] }).highlights ?? [],
        }))
      : [];

  if (exaBrandSearch.status === "rejected") {
    logger.warn({ err: exaBrandSearch.reason, domain }, "ai-presence-scan: Exa search failed");
  }

  // Extract Tavily results safely
  const extractTavily = (
    settled: PromiseSettledResult<{ results?: TavilyResult[] } | null>,
  ): TavilyResult[] => {
    if (settled.status !== "fulfilled" || !settled.value) return [];
    return settled.value.results ?? [];
  };

  const chatgptRaw = extractTavily(tavilyChatGPT);
  const geminiRaw = extractTavily(tavilyGemini);
  const perplexityRaw = extractTavily(tavilyPerplexity);

  if (tavilyChatGPT.status === "rejected") {
    logger.warn({ err: tavilyChatGPT.reason, domain }, "ai-presence-scan: Tavily ChatGPT search failed");
  }

  // Score each platform using Tavily evidence + Exa as supporting signal
  const chatgpt = scoreFromResults(chatgptRaw, exaResults, brandLower, domain);
  const gemini = scoreFromResults(geminiRaw, exaResults, brandLower, domain);
  const perplexity = scoreFromResults(perplexityRaw, exaResults, brandLower, domain);

  // Overall score: average of the 3 platform scores
  const rawTotal = chatgpt.score + gemini.score + perplexity.score;
  const overallScore = Math.min(Math.round(rawTotal / 3), 100);
  const hasData = chatgpt.found || gemini.found || perplexity.found;

  // Top Exa evidence snippet
  const topEvidence =
    exaResults.length > 0
      ? (exaResults[0]?.highlights?.[0] ?? null)
      : null;

  // Build platform breakdown (only found platforms shown in UI)
  const platformDefs: AIPresencePlatform[] = [
    { key: "chat_gpt", displayName: "ChatGPT", color: "#10A37F", found: chatgpt.found, score: chatgpt.score, pct: 0, evidence: chatgpt.evidence },
    { key: "gemini", displayName: "Gemini", color: "#4285F4", found: gemini.found, score: gemini.score, pct: 0, evidence: gemini.evidence },
    { key: "perplexity", displayName: "Perplexity", color: "#20B2AA", found: perplexity.found, score: perplexity.score, pct: 0, evidence: perplexity.evidence },
  ];
  const activePlatforms = platformDefs.filter(p => p.found);
  const totalScore = activePlatforms.reduce((s, p) => s + p.score, 0);
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
      geminiFound: gemini.found,
      perplexityFound: perplexity.found,
      exaResultsCount: exaResults.length,
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
