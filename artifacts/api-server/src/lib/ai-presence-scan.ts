import Exa from "exa-js";
import { tavily } from "@tavily/core";
import { logger } from "./logger";
import { checkBrandInGoogleAio, type GoogleAioCheckResult } from "./dataforseo";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIPresencePlatform {
  key: string;
  displayName: string;
  color: string;
  found: boolean;
  score: number;
  pct: number;
  evidence: string | null;
}

export interface AIPresencePerformingTopic {
  topic: string;
  platform: string;
  url: string;
  date: string | null;
  snippet: string;
}

export interface AIPresenceTopicOpportunity {
  topic: string;
  platform: string;
  url: string;
  date: string | null;
  opportunity: string;
}

export interface AIPresenceCitedPage {
  url: string;
  title: string;
  snippet: string;
}

export interface AIPresenceCitedSource {
  domain: string;
  title: string;
  url: string;
  favicon: string;
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
  urlsCited: number;
  citedSourcesCount: number;
  performingTopics: AIPresencePerformingTopic[];
  topicOpportunities: AIPresenceTopicOpportunity[];
  citedPagesList: AIPresenceCitedPage[];
  citedSourcesList: AIPresenceCitedSource[];
  googleAio: {
    citedInAio: boolean;
    aioExists: boolean;
    aioText: string | null;
    keywordChecked: string | null;
  } | null;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  publishedDate?: string;
}

interface ExaSearchResult {
  title?: string | null;
  url?: string | null;
  publishedDate?: string | null;
}

interface PerPlatformExaEvidence {
  mentionCount: number;
  hasDirectCitation: boolean;
  recentMentions: number;
}

// ─── FIX 1: Smart brand slug extraction ───────────────────────────────────────
// Short names (1-2 chars) use the full domain to avoid false substring matches.
// e.g. "x.com" -> "x.com", "hubspot.com" -> "hubspot"

function getBrandSlug(domain: string): string {
  const clean = domain.replace(/^www\./, "").toLowerCase();
  const name = clean.split(".")[0] ?? clean;
  if (name.length <= 2) {
    return clean;
  }
  // Strip common SaaS URL prefixes: tryprofound -> profound, getpostman -> postman
  const prefixes = ["try", "get", "use", "app", "my", "go", "join", "meet", "hello", "hey"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix) && name.length > prefix.length + 2) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

function detectPlatform(url?: string | null): string {
  if (!url) return "Web";
  if (url.includes("reddit.com")) return "Reddit";
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X (Twitter)";
  if (url.includes("youtube.com")) return "YouTube";
  if (url.includes("medium.com")) return "Medium";
  if (url.includes("g2.com")) return "G2";
  if (url.includes("producthunt.com")) return "Product Hunt";
  if (url.includes("hackernews") || url.includes("news.ycombinator")) return "Hacker News";
  if (url.includes("techcrunch.com")) return "TechCrunch";
  if (url.includes("capterra.com")) return "Capterra";
  return "Web";
}

// ─── FIX 1 cont: Word-boundary matching for short slugs ───────────────────────

function resultMentionsBrand(
  text: string,
  domain: string,
  brandSlug: string,
): boolean {
  const t = text.toLowerCase();
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase();

  // Short slugs (1-2 chars) or slugs that equal the full domain (already has dot):
  // require word boundary or exact domain match to prevent "x" matching "next"
  if (brandSlug.length <= 2 || brandSlug.includes(".")) {
    const wordBoundaryRegex = new RegExp(`\\b${brandSlug.replace(".", "\\.")}\\b`, "i");
    return wordBoundaryRegex.test(text) || t.includes(cleanDomain);
  }

  // Normal slugs: require at least a space-padded match, quoted, start-of-string,
  // or full domain reference to avoid partial matches inside other words
  return (
    t.includes(` ${brandSlug} `) ||
    t.includes(`"${brandSlug}"`) ||
    t.startsWith(brandSlug) ||
    t.includes(`${brandSlug},`) ||
    t.includes(`${brandSlug}.`) ||
    t.includes(cleanDomain)
  );
}

// Authoritative sources that add credibility bonus
const AUTHORITATIVE_DOMAINS = [
  "techcrunch.com", "wired.com", "theverge.com", "searchengineland.com",
  "venturebeat.com", "bloomberg.com", "reuters.com", "forbes.com",
  "wsj.com", "ft.com", "thenextweb.com", "arstechnica.com",
];

// ─── FIX 2: Dynamic scoring with quality bonuses ──────────────────────────────
// Scale: 0/20/35/50/65/75 base + bonuses push above 75 for strong evidence.
// Exa-only fallback when Tavily returns nothing.

function scorePlatform(
  tavilyResults: TavilyResult[],
  domain: string,
  brandSlug: string,
  exaEvidence?: PerPlatformExaEvidence,
): { found: boolean; score: number; evidence: string | null } {
  const cleanDomain = domain.replace(/^www\./, "");
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  // Only count third-party pages - the brand's own site is not evidence of AI citation
  const thirdPartyTavily = tavilyResults.filter(r => !r.url?.includes(cleanDomain));

  const matchingTavily = thirdPartyTavily.filter(r =>
    resultMentionsBrand(`${r.title ?? ""} ${r.content ?? ""}`, domain, brandSlug),
  );

  // Exa-only fallback: when Tavily returned nothing, use per-platform Exa evidence
  if (matchingTavily.length === 0 && exaEvidence) {
    const exaScore = Math.min(
      exaEvidence.mentionCount * 20 +
      (exaEvidence.hasDirectCitation ? 15 : 0) +
      (exaEvidence.recentMentions * 5),
      75,
    );
    if (exaScore > 0) {
      return {
        found: exaScore >= 20,
        score: exaScore,
        evidence: "Based on web presence signals",
      };
    }
    return { found: false, score: 0, evidence: null };
  }

  // Graduated base score from Tavily match count
  let baseScore = 0;
  if (matchingTavily.length === 1) baseScore = 20;
  else if (matchingTavily.length === 2) baseScore = 35;
  else if (matchingTavily.length === 3) baseScore = 50;
  else if (matchingTavily.length === 4) baseScore = 65;
  else if (matchingTavily.length >= 5) baseScore = 75;

  let bonus = 0;

  // Bonus: a result URL directly references the brand's domain
  const hasDomainInUrl = matchingTavily.some(r => r.url?.includes(cleanDomain));
  if (hasDomainInUrl) bonus += 10;

  // Bonus: recent mentions (last 3 months)
  const hasRecentResult = matchingTavily.some(r => {
    if (!r.publishedDate) return false;
    return (now - new Date(r.publishedDate).getTime()) < ninetyDaysMs;
  });
  if (hasRecentResult) bonus += 10;

  // Bonus: authoritative source
  const hasAuthSource = matchingTavily.some(r =>
    AUTHORITATIVE_DOMAINS.some(d => r.url?.includes(d)),
  );
  if (hasAuthSource) bonus += 5;

  // Bonus from per-platform Exa evidence
  if (exaEvidence) {
    if (exaEvidence.hasDirectCitation) bonus += 10;
    if (exaEvidence.recentMentions > 0) {
      // Cap at 5 for 1-2 recent, 8 for 3+
      bonus += exaEvidence.recentMentions >= 3 ? 8 : 5;
    }
  }

  const finalScore = Math.min(baseScore + bonus, 99);
  const found = finalScore >= 20;

  const best = matchingTavily[0];
  const evidence = best
    ? `${best.title ?? ""}: ${(best.content ?? "").slice(0, 150)}`
    : null;

  return { found, score: finalScore, evidence };
}

// ─── FIX 3: Per-platform Exa evidence (separate search per AI system) ─────────

async function getPerPlatformExaEvidence(
  exa: Exa,
  domain: string,
  brandSlug: string,
  brandName: string,
): Promise<{
  chatgpt: PerPlatformExaEvidence;
  gemini: PerPlatformExaEvidence;
  perplexity: PerPlatformExaEvidence;
  claude: PerPlatformExaEvidence;
  grok: PerPlatformExaEvidence;
}> {
  const cleanDomain = domain.replace(/^www\./, "");
  const brandQuery = brandSlug.length > 2
    ? `"${cleanDomain}" OR "${brandName}"`
    : `"${cleanDomain}"`;

  const sinceDate = "2025-06-01";
  const recentMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const [chatgptRes, geminiRes, perplexityRes, claudeRes, grokRes] = await Promise.allSettled([
    exa.search(
      `${brandQuery} ChatGPT recommended suggest mentioned 2025 2026`,
      { type: "auto", numResults: 5, startPublishedDate: sinceDate },
    ),
    exa.search(
      `${brandQuery} Gemini Google AI recommended mentioned 2025 2026`,
      { type: "auto", numResults: 5, startPublishedDate: sinceDate },
    ),
    exa.search(
      `${brandQuery} Perplexity cited mentioned recommended 2025 2026`,
      { type: "auto", numResults: 5, startPublishedDate: sinceDate },
    ),
    exa.search(
      `${brandQuery} Claude Anthropic cited mentioned recommended 2025 2026`,
      { type: "auto", numResults: 5, startPublishedDate: sinceDate },
    ),
    exa.search(
      `${brandQuery} Grok xAI cited mentioned recommended 2025 2026`,
      { type: "auto", numResults: 5, startPublishedDate: sinceDate },
    ),
  ]);

  function extractEvidence(
    settled: PromiseSettledResult<{ results?: ExaSearchResult[] }>,
  ): PerPlatformExaEvidence {
    if (settled.status !== "fulfilled") {
      return { mentionCount: 0, hasDirectCitation: false, recentMentions: 0 };
    }
    const results = settled.value.results ?? [];
    const thirdParty = results.filter(r => !r.url?.includes(cleanDomain));
    const mentioning = thirdParty.filter(r =>
      resultMentionsBrand(`${r.title ?? ""} ${r.url ?? ""}`, domain, brandSlug),
    );
    return {
      mentionCount: mentioning.length,
      hasDirectCitation: mentioning.some(r => r.url?.includes(cleanDomain)),
      recentMentions: mentioning.filter(r => {
        if (!r.publishedDate) return false;
        return (now - new Date(r.publishedDate).getTime()) < recentMs;
      }).length,
    };
  }

  return {
    chatgpt: extractEvidence(chatgptRes),
    gemini: extractEvidence(geminiRes),
    perplexity: extractEvidence(perplexityRes),
    claude: extractEvidence(claudeRes),
    grok: extractEvidence(grokRes),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runAIPresenceScan(domain: string): Promise<AIPresenceScanResult | null> {
  const exa = getExaClient();
  const tvly = getTavilyClient();

  if (!exa && !tvly) {
    logger.info({ domain }, "ai-presence-scan: no API keys configured, skipping");
    return null;
  }

  const brandSlug = getBrandSlug(domain);
  const rawBrand = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  const brandName = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1);

  logger.info(
    { domain, brandName, brandSlug, hasExa: !!exa, hasTavily: !!tvly },
    "ai-presence-scan: starting",
  );

  // Run Tavily + Exa + Google AIO check all in parallel
  const googleAioPromise: Promise<GoogleAioCheckResult> = checkBrandInGoogleAio(domain, brandName);

  const [
    exaBrandSearch,
    tavilyChatGPT,
    tavilyGemini,
    tavilyPerplexity,
    tavilyClaude,
    tavilyGrok,
    tavilyTopicDiscovery,
  ] = await Promise.allSettled([
    // General Exa: used for topEvidence snippet shown in UI
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

    // Tavily: ChatGPT-specific
    tvly
      ? tvly.search(
          `Does ChatGPT recommend or mention ${brandName}? ChatGPT AI response ${domain}`,
          { searchDepth: "advanced", maxResults: 7, topic: "general", days: 180 },
        )
      : Promise.resolve(null),

    // Tavily: Gemini-specific
    tvly
      ? tvly.search(
          `Does Google Gemini recommend or mention ${brandName}? Gemini AI response ${domain}`,
          { searchDepth: "advanced", maxResults: 7, topic: "general", days: 180 },
        )
      : Promise.resolve(null),

    // Tavily: Perplexity-specific
    tvly
      ? tvly.search(
          `Does Perplexity AI recommend or cite ${brandName}? Perplexity answer ${domain}`,
          { searchDepth: "advanced", maxResults: 7, topic: "general", days: 180 },
        )
      : Promise.resolve(null),

    // Tavily: Claude-specific
    tvly
      ? tvly.search(
          `Does Anthropic Claude recommend or mention ${brandName}? Claude AI response ${domain}`,
          { searchDepth: "advanced", maxResults: 5, topic: "general", days: 180 },
        )
      : Promise.resolve(null),

    // Tavily: Grok-specific
    tvly
      ? tvly.search(
          `Does xAI Grok recommend or mention ${brandName}? Grok AI response ${domain}`,
          { searchDepth: "advanced", maxResults: 5, topic: "general", days: 180 },
        )
      : Promise.resolve(null),

    // Tavily: category-adjacent content for topic opportunity mining.
    // Intentionally NOT framed around AI platforms - searches for the brand's
    // niche/category so that "not mentioned" results are actual content gaps
    // in the brand's space, not generic AI-monitoring articles.
    tvly
      ? tvly.search(
          `best ${brandSlug} alternatives tools review 2025 2026`,
          { searchDepth: "basic", maxResults: 12, topic: "general", days: 365 },
        )
      : Promise.resolve(null),
  ]);

  // Per-platform Exa evidence (3 targeted searches, run after we have brandSlug)
  let exaPlatformEvidence: {
    chatgpt: PerPlatformExaEvidence;
    gemini: PerPlatformExaEvidence;
    perplexity: PerPlatformExaEvidence;
    claude: PerPlatformExaEvidence;
    grok: PerPlatformExaEvidence;
  } | null = null;

  if (exa) {
    try {
      exaPlatformEvidence = await getPerPlatformExaEvidence(exa, domain, brandSlug, brandName);
      logger.info(
        { domain, chatgpt: exaPlatformEvidence.chatgpt, gemini: exaPlatformEvidence.gemini, perplexity: exaPlatformEvidence.perplexity, claude: exaPlatformEvidence.claude, grok: exaPlatformEvidence.grok },
        "ai-presence-scan: per-platform Exa evidence",
      );
    } catch (err) {
      logger.warn({ err, domain }, "ai-presence-scan: per-platform Exa failed");
    }
  }

  // Extract general Exa results for topEvidence
  const exaResults =
    exaBrandSearch.status === "fulfilled" && exaBrandSearch.value
      ? (exaBrandSearch.value.results ?? []).map(r => ({
          title: r.title ?? undefined,
          url: r.url ?? undefined,
          highlights: (r as { highlights?: string[] }).highlights ?? [],
        }))
      : [];

  if (exaBrandSearch.status === "rejected") {
    logger.warn({ err: exaBrandSearch.reason, domain }, "ai-presence-scan: general Exa failed");
  }

  // Extract Tavily results
  const extractTavily = (
    s: PromiseSettledResult<{ results?: TavilyResult[] } | null>,
  ): TavilyResult[] =>
    s.status === "fulfilled" && s.value ? (s.value.results ?? []) : [];

  const chatgptRaw = extractTavily(tavilyChatGPT);
  const geminiRaw = extractTavily(tavilyGemini);
  const perplexityRaw = extractTavily(tavilyPerplexity);
  const claudeRaw = extractTavily(tavilyClaude);
  const grokRaw = extractTavily(tavilyGrok);

  logger.info(
    { domain, chatgptResults: chatgptRaw.length, geminiResults: geminiRaw.length, perplexityResults: perplexityRaw.length, claudeResults: claudeRaw.length, grokResults: grokRaw.length },
    "ai-presence-scan: Tavily raw counts",
  );

  // Score each platform with its own Tavily results + per-platform Exa evidence
  const chatgpt = scorePlatform(chatgptRaw, domain, brandSlug, exaPlatformEvidence?.chatgpt);
  const gemini = scorePlatform(geminiRaw, domain, brandSlug, exaPlatformEvidence?.gemini);
  const perplexity = scorePlatform(perplexityRaw, domain, brandSlug, exaPlatformEvidence?.perplexity);
  const claude = scorePlatform(claudeRaw, domain, brandSlug, exaPlatformEvidence?.claude);
  const grok = scorePlatform(grokRaw, domain, brandSlug, exaPlatformEvidence?.grok);

  const overallScore = Math.min(
    Math.round((chatgpt.score + gemini.score + perplexity.score) / 3),
    99,
  );
  const hasData = chatgpt.found || gemini.found || perplexity.found || claude.found || grok.found;

  const topEvidence = exaResults.length > 0
    ? (exaResults[0]?.highlights?.[0] ?? null)
    : null;

  const platformDefs: AIPresencePlatform[] = [
    { key: "chat_gpt", displayName: "ChatGPT", color: "#10A37F", found: chatgpt.found, score: chatgpt.score, pct: 0, evidence: chatgpt.evidence },
    { key: "gemini", displayName: "Gemini", color: "#4285F4", found: gemini.found, score: gemini.score, pct: 0, evidence: gemini.evidence },
    { key: "perplexity", displayName: "Perplexity", color: "#20B2AA", found: perplexity.found, score: perplexity.score, pct: 0, evidence: perplexity.evidence },
    { key: "claude", displayName: "Claude", color: "#F97316", found: claude.found, score: claude.score, pct: 0, evidence: claude.evidence },
    { key: "grok", displayName: "Grok", color: "#111827", found: grok.found, score: grok.score, pct: 0, evidence: grok.evidence },
  ];
  const totalScore = platformDefs.reduce((s, p) => s + p.score, 0);
  const platforms: AIPresencePlatform[] = platformDefs.map(p => ({
    ...p,
    pct: totalScore > 0 ? Math.round((p.score / totalScore) * 100) : 0,
  }));

  // ─── Build topics and citations from combined Tavily + Exa results ────────────
  const allTavilyResults: TavilyResult[] = [
    ...chatgptRaw, ...geminiRaw, ...perplexityRaw, ...claudeRaw, ...grokRaw,
  ];

  // Category-adjacent results used exclusively for topic opportunities.
  // Falls back to allTavilyResults if the dedicated search returned nothing.
  const discoveryRaw = extractTavily(tavilyTopicDiscovery);
  const topicSourceResults: TavilyResult[] = discoveryRaw.length > 0 ? discoveryRaw : allTavilyResults;

  const cleanDomainLower = domain.replace(/^www\./, "").toLowerCase();

  // Cited pages: brand's own URLs found in Exa general results
  const citedPagesList: AIPresenceCitedPage[] = exaResults
    .filter(r => r.url?.toLowerCase().includes(cleanDomainLower))
    .map(r => ({
      url: r.url ?? "",
      title: r.title ?? "",
      snippet: r.highlights[0]?.slice(0, 150) ?? "",
    }))
    .slice(0, 10);

  // Performing topics: Tavily results from third-party sites that mention the brand
  const seenPerformingUrls = new Set<string>();
  const performingTopics: AIPresencePerformingTopic[] = allTavilyResults
    .filter(r => {
      if (!r.url || r.url.toLowerCase().includes(cleanDomainLower)) return false;
      if (seenPerformingUrls.has(r.url)) return false;
      if (!resultMentionsBrand(`${r.title ?? ""} ${r.content ?? ""}`, domain, brandSlug)) return false;
      seenPerformingUrls.add(r.url);
      return true;
    })
    .map(r => ({
      topic: (r.title ?? "").replace(/[|\-].*$/, "").trim().slice(0, 80),
      platform: detectPlatform(r.url),
      url: r.url ?? "",
      date: r.publishedDate ?? null,
      snippet: (r.content ?? "").slice(0, 150),
    }))
    .filter(t => t.topic.length > 10)
    .slice(0, 20);

  // Topic opportunities: category-adjacent results where brand is NOT mentioned (gaps).
  // Uses the dedicated discovery search so topics are in the brand's actual niche,
  // not AI-monitoring articles from the per-platform mention queries.
  const seenOpportunityUrls = new Set<string>();
  const topicOpportunities: AIPresenceTopicOpportunity[] = topicSourceResults
    .filter(r => {
      if (!r.url || r.url.toLowerCase().includes(cleanDomainLower)) return false;
      if (seenOpportunityUrls.has(r.url)) return false;
      if (resultMentionsBrand(`${r.title ?? ""} ${r.content ?? ""}`, domain, brandSlug)) return false;
      seenOpportunityUrls.add(r.url);
      return true;
    })
    .map(r => ({
      topic: (r.title ?? "").replace(/[|\-].*$/, "").trim().slice(0, 80),
      platform: detectPlatform(r.url),
      url: r.url ?? "",
      date: r.publishedDate ?? null,
      opportunity: "Your brand is not mentioned here - publish content to fill this gap",
    }))
    .filter(t => t.topic.length > 10)
    .slice(0, 15);

  // Cited sources: unique external domains that mention the brand
  const seenCitedDomains = new Set<string>();
  const citedSourcesList: AIPresenceCitedSource[] = allTavilyResults
    .filter(r => {
      if (!r.url || r.url.toLowerCase().includes(cleanDomainLower)) return false;
      return resultMentionsBrand(`${r.title ?? ""} ${r.content ?? ""}`, domain, brandSlug);
    })
    .map(r => {
      try {
        const host = new URL(r.url!).hostname.replace(/^www\./, "");
        return { domain: host, title: r.title ?? "", url: r.url ?? "", favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=32` };
      } catch { return null; }
    })
    .filter((s): s is AIPresenceCitedSource => {
      if (!s) return false;
      if (seenCitedDomains.has(s.domain)) return false;
      seenCitedDomains.add(s.domain);
      return true;
    })
    .slice(0, 10);

  const urlsCited = citedPagesList.length;
  const citedSourcesCount = citedSourcesList.length;

  // Collect Google AIO result (was started in parallel at scan begin)
  let googleAio: AIPresenceScanResult["googleAio"] = null;
  try {
    const aioResult = await googleAioPromise;
    googleAio = {
      citedInAio: aioResult.citedInAio,
      aioExists: aioResult.aioExists,
      aioText: aioResult.aioText,
      keywordChecked: aioResult.keywordChecked,
    };
    logger.info(
      { domain, citedInAio: aioResult.citedInAio, aioExists: aioResult.aioExists, kw: aioResult.keywordChecked },
      "ai-presence-scan: Google AIO result",
    );
  } catch (err) {
    logger.warn({ err, domain }, "ai-presence-scan: Google AIO check failed");
  }

  logger.info(
    {
      domain,
      overallScore,
      hasData,
      chatgptScore: chatgpt.score,
      geminiScore: gemini.score,
      perplexityScore: perplexity.score,
      claudeScore: claude.score,
      grokScore: grok.score,
      performingTopics: performingTopics.length,
      topicOpportunities: topicOpportunities.length,
      citedSources: citedSourcesCount,
      brandSlug,
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
    urlsCited,
    citedSourcesCount,
    performingTopics,
    topicOpportunities,
    citedPagesList,
    citedSourcesList,
    googleAio,
  };
}
