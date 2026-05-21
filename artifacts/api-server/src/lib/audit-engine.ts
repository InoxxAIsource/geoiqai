import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDomainKeywords } from "./dataforseo";

// --- OpenAI client (ChatGPT + fallback) ---
const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL,
});

// --- Perplexity via RapidAPI ---
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";

// --- Gemini client ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const geminiAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface AuditQueryResult {
  found: boolean;
  detail: string | null;
  score: number;
  competitors: string[];
  simulated?: boolean;
}

export interface AuditEngineResult {
  brandName: string;
  category: string;
  market: string;
  chatgpt: AuditQueryResult;
  gemini: AuditQueryResult;
  perplexity: AuditQueryResult;
  keywordsUsed: string[];
}

export interface Recommendation {
  action: string;
  priority: "high" | "medium" | "low";
  effortHours: number;
  impactScore: number;
  category: string;
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace("www.", "");
  } catch {
    return url.replace("www.", "").split("/")[0] ?? url;
  }
}

interface ScrapedData {
  domain: string;
  title: string;
  metaDescription: string;
  h1: string;
  bodyText: string;
  success: boolean;
}

async function scrapeUrl(url: string): Promise<ScrapedData> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const domain = extractDomain(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 GEOscore Bot/1.0" },
    });
    clearTimeout(timeout);

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1]!.trim() : "";

    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1]!.trim() : "";

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1]!.trim() : "";

    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const bodyText = stripped.substring(0, 600);

    return { domain, title, metaDescription, h1, bodyText, success: true };
  } catch {
    return { domain, title: "", metaDescription: "", h1: "", bodyText: "", success: false };
  }
}

interface CategoryData {
  brandName: string;
  category: string;
  market: string;
  competitors: string[];
}

async function detectCategory(scraped: ScrapedData): Promise<CategoryData> {
  try {
    const prompt = `Analyze this website and return JSON only, no other text:

Domain: ${scraped.domain}
Title: ${scraped.title}
Description: ${scraped.metaDescription}
H1: ${scraped.h1}
Content: ${scraped.bodyText.substring(0, 300)}

Return exactly this JSON structure:
{
  "brand_name": "extracted brand or product name (just the name, not the full title)",
  "category": "one of: social media, video platform, search engine, discussion forum, news media, entertainment, ecommerce, saas tool, health app, fintech, edtech, developer tool, productivity, food delivery, travel, real estate, other",
  "market": "one of: India, Global, US, UK",
  "top_competitors": ["competitor1", "competitor2", "competitor3"]
}`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    return {
      brandName: parsed.brand_name ?? scraped.domain,
      category: parsed.category ?? "saas tool",
      market: parsed.market ?? "India",
      competitors: Array.isArray(parsed.top_competitors) ? parsed.top_competitors.slice(0, 3) : [],
    };
  } catch {
    return {
      brandName: scraped.domain,
      category: "saas tool",
      market: "India",
      competitors: [],
    };
  }
}

function generatePrompts(
  brandName: string,
  domain: string,
  category: string,
  market: string,
  competitors: string[],
): string[] {
  // RULE: No part of the brand name, domain, or domain root may appear in any prompt.
  // Any brand token in a prompt causes AI to echo it back — triggering a false positive match.
  // A score only counts when the AI mentions the brand completely unprompted.

  // Human-readable noun phrase for each category, used in natural-language prompts.
  // "other" maps to a broad phrase so AI lists well-known platforms rather than
  // responding with "I don't understand what 'other tools' means".
  const CATEGORY_NOUN: Record<string, string> = {
    "social media":     "social media platforms and communities",
    "video platform":   "online video platforms",
    "search engine":    "search engines and web discovery tools",
    "discussion forum": "online discussion and community platforms",
    "news media":       "news and media platforms",
    "entertainment":    "entertainment and streaming platforms",
    "ecommerce":        "ecommerce and online shopping platforms",
    "saas tool":        "SaaS tools and cloud software",
    "health app":       "health, fitness, and wellness apps",
    "fintech":          "fintech and financial software platforms",
    "edtech":           "edtech and online learning platforms",
    "developer tool":   "developer tools and infrastructure platforms",
    "productivity":     "productivity and collaboration tools",
    "food delivery":    "food delivery and restaurant tech platforms",
    "travel":           "travel and hospitality platforms",
    "real estate":      "real estate and property tech platforms",
    "other":            "popular internet platforms and online services",
  };
  const noun = CATEGORY_NOUN[category] ?? `${category} platforms`;

  const prompts: string[] = [
    `What are the most popular and well-known ${noun} available today? List the top 10 with a short description of each.`,
    `Which ${noun} do you recommend for users in ${market}? Give the top 5 with pros and cons.`,
    `I am looking for the best ${noun}. What are the most reputable and widely used options right now?`,
  ];

  if (competitors.length > 0) {
    prompts.push(
      `What are the top alternatives to ${competitors[0]}? List similar ${noun} with brief descriptions.`,
    );
  } else {
    prompts.push(
      `What are the leading ${noun} used by businesses and individuals in ${market}? Include both established and emerging options.`,
    );
  }

  return prompts;
}

// --- Per-system query functions ---

async function queryOpenAIChatGPT(prompt: string): Promise<string> {
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are ChatGPT. Answer questions about products, tools, and services accurately and helpfully. Draw on your training knowledge. Mention specific brand names and products you know about.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

async function queryGemini(prompt: string): Promise<{ text: string; simulated: boolean }> {
  if (geminiAI) {
    try {
      const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return { text: result.response.text(), simulated: false };
    } catch {
      // fall through to simulated
    }
  }

  // Fallback: OpenAI simulating Gemini
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant. Answer questions about products, tools, and services with balanced, helpful information. Mention specific tools and services by name where you know them.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });
    return { text: response.choices[0]?.message?.content ?? "", simulated: true };
  } catch {
    return { text: "", simulated: true };
  }
}

async function queryPerplexity(prompt: string): Promise<{ text: string; simulated: boolean }> {
  if (RAPIDAPI_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("https://perplexity2.p.rapidapi.com/", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "perplexity2.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
        body: JSON.stringify({ content: prompt }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        // RapidAPI Perplexity returns text in various shapes — try common fields
        const text =
          (typeof data.answer === "string" ? data.answer : null) ??
          (typeof data.response === "string" ? data.response : null) ??
          (typeof data.text === "string" ? data.text : null) ??
          (typeof data.content === "string" ? data.content : null) ??
          (typeof data.output === "string" ? data.output : null) ??
          (typeof data.result === "string" ? data.result : null) ??
          (Array.isArray(data.choices)
            ? ((data.choices[0] as Record<string, unknown>)?.message as Record<string, unknown>)?.content as string ?? ""
            : "") ??
          "";
        if (text) return { text, simulated: false };
      }
    } catch {
      // fall through to simulated
    }
  }

  // Fallback: OpenAI when RAPIDAPI_KEY is not set
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a search-augmented AI assistant. Answer with specific information about products and services. Be direct and recommend specific options by name.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });
    return { text: response.choices[0]?.message?.content ?? "", simulated: true };
  } catch {
    return { text: "", simulated: true };
  }
}

// --- Scoring ---

// Phrases that indicate the AI does NOT know this brand — even if the name appears in the response
// (e.g. "I don't have information about xusjhf.com" still contains "xusjhf.com")
const NEGATIVE_SIGNALS = [
  "don't have information",
  "do not have information",
  "couldn't find",
  "could not find",
  "unable to find",
  "no information",
  "not familiar",
  "not aware of",
  "doesn't appear",
  "does not appear",
  "cannot find",
  "can't find",
  "no specific information",
  "no details",
  "not in my knowledge",
  "outside my knowledge",
  "not a well-known",
  "doesn't seem to exist",
  "does not seem to exist",
  "no record",
  "not recogni",
  "don't recogni",
  "fictional",
  "made up",
  "doesn't exist",
  "does not exist",
  "not real",
  "no data",
  "i'm not sure",
  "i am not sure",
  "i apologize",
  "as of my knowledge cutoff",
  "as of my last",
  "i don't know",
  "i do not know",
];

function hasNegativeSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATIVE_SIGNALS.some((s) => lower.includes(s));
}

// Common English words that are too generic to use as brand signals
const GENERIC_WORDS = new Set([
  "test","demo","example","sample","trial","temp","app","web","site","home",
  "page","data","info","help","free","shop","store","blog","news","mail",
  "link","work","jobs","chat","live","tech","base","core","hub","lab","go",
]);

/**
 * Build all lowercase string variations of a brand that could appear in AI responses.
 *
 * mealcoreai.com → ["mealcoreai.com", "mealcoreai", "meal core ai", "mealcoreai"]
 * cricket-arb.com → ["cricket-arb.com", "cricket-arb", "cricket arb"]
 * google.com      → ["google.com", "google"]
 *
 * Matching is done as simple case-insensitive substring search (after lowercasing both
 * sides) so all of these fire on "MealCoreAI", "MEALCOREAI", "meal core ai", etc.
 */
function getBrandVariations(brandName: string, domain: string): string[] {
  const vars = new Set<string>();

  // 1. Full domain as typed: mealcoreai.com
  vars.add(domain.toLowerCase());

  // 2. Domain root — strip leading www + TLD: mealcoreai
  const root = domain
    .replace(/^www\./i, "")
    .replace(/\.[a-z]{2,6}$/i, "")
    .toLowerCase();
  if (root.length > 3) vars.add(root);

  // 3. Root with hyphens/underscores as spaces: cricket-arb → cricket arb
  const rootSpaced = root.replace(/[-_]/g, " ");
  if (rootSpaced !== root && rootSpaced.length > 3) vars.add(rootSpaced);

  // 4. Exact brand name (lowercased): MealCoreAI → mealcoreai
  const brandLower = brandName.toLowerCase();
  if (brandLower.length > 3) vars.add(brandLower);

  // 5. CamelCase split: MealCoreAI → meal core ai
  const camelSplit = brandName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
  if (camelSplit !== brandLower && camelSplit.length > 3) vars.add(camelSplit);

  return [...vars].filter((v) => v.trim().length > 3);
}

/**
 * Return true if any brand variation appears in the text (case-insensitive substring match).
 * Skips variations that are common English words (would cause false positives).
 */
function textMatchesVariation(text: string, variations: string[]): boolean {
  const lower = text.toLowerCase();
  return variations
    .filter((v) => !GENERIC_WORDS.has(v.replace(/\s/g, "")))
    .some((v) => lower.includes(v));
}

/**
 * Extract keywords from domain root for targeted prompts.
 * mealcoreai → "meal" (first recognisable word ≥4 chars)
 */
function domainKeyword(domain: string): string {
  const root = domain.replace(/^www\./i, "").replace(/\.[a-z]{2,6}$/i, "");
  // Try camelCase split first
  const words = root
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  return words[0] ?? root;
}

interface ScoredResponse {
  prompt: string;
  text: string;
}

function calculateSystemScore(
  brandName: string,
  domain: string,
  responses: ScoredResponse[],
  simulated: boolean,
): AuditQueryResult {
  // All lowercase string variations we'll look for in AI responses
  const variations = getBrandVariations(brandName, domain);

  let score = 0;
  let found = false;
  let detail: string | null = null;
  const competitorSet = new Set<string>();

  for (const item of responses) {
    if (!item.text) continue;

    // Negative-signal filter: if AI says "I don't have information about X" that's NOT a match
    // even though the domain name appears literally in that disclaiming sentence.
    if (hasNegativeSignal(item.text)) continue;

    // Quick pre-check: does any variation appear anywhere in this response?
    if (!textMatchesVariation(item.text, variations)) continue;

    // Require a meaningful sentence — a bare URL in a list ("- mealcoreai.com") without any
    // description does not constitute genuine AI visibility. The segment must be ≥40 chars.
    const segments = item.text.split(/[.!?\n]+/);
    let mentionSentence: string | null = null;
    let mentionIndex = Infinity;

    for (const s of segments) {
      if (!textMatchesVariation(s, variations)) continue;
      const trimmed = s.replace(/^[\s\-*•#>|]+/, "").trim();
      // Must be long enough to contain a real description beyond just the name
      if (trimmed.length >= 40) {
        const pos = item.text.indexOf(trimmed);
        if (pos < mentionIndex) {
          mentionIndex = pos;
          mentionSentence = trimmed.substring(0, 180);
        }
      }
    }

    // Only count as found if AI provided a substantive description — not just a bare name/URL
    if (!mentionSentence) continue;

    found = true;

    // Position-based scoring: first 30% of response = 15pts, later = 8pts
    const totalLen = item.text.length;
    score += mentionIndex < totalLen * 0.3 ? 15 : 8;

    if (!detail) {
      detail = mentionSentence;
    }

    // Extract competitor mentions (capitalized proper nouns + .com/.io/.ai domains)
    const compPattern = /\b([A-Z][a-zA-Z]{2,}(?:\.(?:com|io|ai|co|app))?)\b/g;
    let match;
    while ((match = compPattern.exec(item.text)) !== null) {
      const name = match[1]!;
      if (
        !textMatchesVariation(name, variations) &&
        name.length > 3 &&
        !["The", "This", "That", "With", "For", "Can", "Are", "Has", "Its", "When", "What", "Here", "They", "Some", "More", "Also", "Very"].includes(name)
      ) {
        competitorSet.add(name);
      }
    }
  }

  return {
    found,
    score: Math.min(score, 33),
    detail: found ? (detail ?? `${brandName} was mentioned in AI responses`) : "Not found in AI responses",
    competitors: Array.from(competitorSet).slice(0, 5),
    simulated,
  };
}

/**
 * Build prompts from DataForSEO keywords.
 * Keywords are real user search queries — they test whether the brand surfaces
 * organically when users search for its actual topics.
 */
function buildKeywordPrompts(keywords: Array<{ keyword: string }>): string[] {
  return keywords.slice(0, 10).map((k) => k.keyword);
}

// --- Main export ---

export async function runAuditEngine(
  url: string,
  brandNameOverride: string | null,
  categoryOverride: string | null,
  marketOverride: string | null,
): Promise<AuditEngineResult> {
  const scraped = await scrapeUrl(url);
  const domain = scraped.domain;

  // Kick off category detection and DataForSEO in parallel
  const [catData, dfsKeywords] = await Promise.all([
    detectCategory(scraped),
    getDomainKeywords(domain),
  ]);

  // Never use an empty brand name — fall back to domain
  const rawBrand = brandNameOverride ?? catData.brandName;
  const brandName = rawBrand && rawBrand.trim().length > 0 ? rawBrand.trim() : domain;
  const category = categoryOverride ?? catData.category;
  const market = marketOverride ?? catData.market;
  const competitors = catData.competitors;

  // Prompt assembly — fallback chain:
  //   1. DataForSEO real keyword prompts (if available) — real user search queries
  //   2. Category-based generic prompts (fallback when DataForSEO returns nothing)
  // RULE: brand name MUST NOT appear in any prompt. Brand name in a prompt causes
  // the AI to echo it back, creating a false-positive match. Score only counts when
  // the AI mentions the brand completely unprompted.
  const prompts = dfsKeywords.length > 0
    ? buildKeywordPrompts(dfsKeywords)
    : generatePrompts(brandName, domain, category, market, competitors);

  // Run all AI queries in parallel
  const chatgptTasks = prompts.map((p) => queryOpenAIChatGPT(p));
  const geminiTasks = prompts.map((p) => queryGemini(p));
  const perplexityTasks = prompts.map((p) => queryPerplexity(p));

  const [chatgptTexts, geminiResults, perplexityResults] = await Promise.all([
    Promise.all(chatgptTasks),
    Promise.all(geminiTasks),
    Promise.all(perplexityTasks),
  ]);

  const chatgptResponses = chatgptTexts.map((text, i) => ({ prompt: prompts[i]!, text }));
  const geminiResponses = geminiResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));
  const perplexityResponses = perplexityResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));

  const geminiSimulated = geminiResults.some((r) => r.simulated);
  const perplexitySimulated = perplexityResults.some((r) => r.simulated);

  const chatgpt = calculateSystemScore(brandName, domain, chatgptResponses, false);
  const gemini = calculateSystemScore(brandName, domain, geminiResponses, geminiSimulated);
  const perplexity = calculateSystemScore(brandName, domain, perplexityResponses, perplexitySimulated);

  return {
    brandName,
    category,
    market,
    chatgpt,
    gemini,
    perplexity,
    keywordsUsed: prompts,
  };
}

export async function generateRecommendations(
  brandName: string,
  domain: string,
  category: string,
  market: string,
  chatgpt: AuditQueryResult,
  gemini: AuditQueryResult,
  perplexity: AuditQueryResult,
): Promise<Recommendation[]> {
  const auditSummary = `Brand: ${brandName}
Domain: ${domain}
Category: ${category}
Market: ${market}
ChatGPT score: ${chatgpt.score}/33 — Found: ${chatgpt.found}
Gemini score: ${gemini.score}/33 — Found: ${gemini.found}
Perplexity score: ${perplexity.score}/33 — Found: ${perplexity.found}`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a GEO (Generative Engine Optimization) expert. Generate specific, actionable recommendations. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Here is the AI visibility audit for a brand:\n\n${auditSummary}\n\nGenerate exactly 5 specific actionable recommendations to improve their AI visibility. Be very specific — name exact actions, not generic advice.\n\nReturn a JSON array:\n[\n  {\n    "action": "specific 2-sentence action to take",\n    "priority": "high",\n    "effort_hours": 2,\n    "impact_score": 12,\n    "category": "citations"\n  }\n]\n\nPriority must be: high, medium, or low\nCategory must be: citations, content, technical, pr, social`,
        },
      ],
      max_tokens: 800,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? parsed.items ?? []);

    return items.slice(0, 5).map((item: Record<string, unknown>) => ({
      action: String(item.action ?? ""),
      priority: (["high", "medium", "low"].includes(String(item.priority))
        ? item.priority
        : "medium") as "high" | "medium" | "low",
      effortHours: Number(item.effort_hours ?? 2),
      impactScore: Number(item.impact_score ?? 8),
      category: String(item.category ?? "content"),
    }));
  } catch {
    return [
      {
        action: `Publish a detailed comparison article positioning ${brandName} against top competitors in ${category}. Include specific use cases and customer testimonials.`,
        priority: "high",
        effortHours: 4,
        impactScore: 15,
        category: "content",
      },
      {
        action: `Get ${brandName} listed on G2, Capterra, and ProductHunt with complete profiles. AI systems pull heavily from these authoritative review sources.`,
        priority: "high",
        effortHours: 2,
        impactScore: 12,
        category: "citations",
      },
      {
        action: `Create a structured FAQ page answering common questions about ${category} in ${market}. Use natural language questions and position ${brandName} as the expert answer.`,
        priority: "medium",
        effortHours: 3,
        impactScore: 10,
        category: "content",
      },
      {
        action: `Add JSON-LD structured data markup to your homepage and product pages. This helps Gemini's knowledge graph understand and cite your brand correctly.`,
        priority: "medium",
        effortHours: 2,
        impactScore: 8,
        category: "technical",
      },
      {
        action: `Publish original research or a data report about trends in ${category}. Data-driven content gets cited by Perplexity's real-time web search more frequently.`,
        priority: "low",
        effortHours: 8,
        impactScore: 6,
        category: "pr",
      },
    ];
  }
}
