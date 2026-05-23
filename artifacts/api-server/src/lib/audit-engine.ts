import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDomainKeywords } from "./dataforseo";

// --- OpenAI client (ChatGPT + fallback) ---
const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL,
});

// --- xAI client (real Grok) ---
const XAI_API_KEY = process.env.XAI_API_KEY ?? "";
const xaiClient = XAI_API_KEY
  ? new OpenAI({ apiKey: XAI_API_KEY, baseURL: "https://api.x.ai/v1" })
  : null;

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

export interface TechnicalCheck {
  id: string;
  name: string;
  score: number;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface TechnicalAuditResult {
  checks: TechnicalCheck[];
  overallScore: number;
  socialLinks: string[];
  contactEmail: string | null;
  brandDescription: string;
}

export interface AuditEngineResult {
  unreachable?: boolean;
  brandName: string;
  category: string;
  market: string;
  chatgpt: AuditQueryResult;
  gemini: AuditQueryResult;
  perplexity: AuditQueryResult;
  claude: AuditQueryResult;
  grok: AuditQueryResult;
  keywordsUsed: string[];
  keywordsFromDataforseo: number;
  keywordsFilteredOut: number;
  rawChatgptResponse: string;
  rawGeminiResponse: string;
  rawPerplexityResponse: string;
  rawClaudeResponse: string;
  rawGrokResponse: string;
  technicalAudit: TechnicalAuditResult;
}

export interface Recommendation {
  action: string;
  priority: "high" | "medium" | "low";
  effortHours: number;
  impactScore: number;
  category: string;
  citeCategory: "C" | "I" | "T" | "E";
}

export interface EeatScore {
  total: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  strengths: string;
  weaknesses: string;
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
  headings: string[];
  bodyText: string;
  rawHtml: string;
  success: boolean;
}

// Fetch rendered page text via Jina AI Reader (handles SPAs, returns clean markdown).
// Falls back gracefully if Jina is unavailable or times out.
async function fetchJinaText(fullUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://r.jina.ai/${fullUrl}`, {
      signal: controller.signal,
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const text = await res.text();
    // Jina prepends metadata lines like "Title:", "URL:", "Published:", strip them
    const lines = text.split("\n");
    const contentStart = lines.findIndex(
      (l, i) => i > 0 && l.trim() !== "" && !l.startsWith("Title:") && !l.startsWith("URL:") && !l.startsWith("Published:") && !l.startsWith("Description:")
    );
    const body = contentStart >= 0 ? lines.slice(contentStart).join("\n").trim() : text.trim();
    return body.substring(0, 5000);
  } catch {
    return "";
  }
}

async function scrapeUrl(url: string): Promise<ScrapedData> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const domain = extractDomain(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 GeoIQ Bot/1.0" },
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

    // Extract all h2/h3 headings for richer context
    const headingMatches = html.matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/gi);
    const headings = [...headingMatches]
      .map((m) => m[1]!.trim())
      .filter((h) => h.length > 2 && h.length < 120)
      .slice(0, 20);

    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Keep up to 4000 chars — enough for a real content summary
    const rawBodyText = stripped.substring(0, 4000);

    // If the raw scrape yielded very little (SPA / JS-rendered site), use Jina reader
    // which renders JavaScript and returns clean text. Run in parallel with the raw scrape.
    const jinaText = rawBodyText.replace(/\s+/g, " ").trim().length < 200
      ? await fetchJinaText(fullUrl)
      : "";

    const bodyText = jinaText || rawBodyText;

    return { domain, title, metaDescription, h1, headings, bodyText, rawHtml: html, success: true };
  } catch {
    return { domain, title: "", metaDescription: "", h1: "", headings: [], bodyText: "", rawHtml: "", success: false };
  }
}

// --- Technical GEO audit helpers ---

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 GeoIQ Bot/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function checkCrawlerAccess(robotsTxt: string | null): TechnicalCheck {
  const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "Claude-Web", "anthropic-ai", "ClaudeBot", "GoogleBot"];
  if (!robotsTxt) {
    return {
      id: "robots",
      name: "Crawler Access (robots.txt)",
      score: 70,
      status: "warn",
      detail: "No robots.txt found. AI crawlers can access your site by default, but explicit rules are recommended.",
    };
  }

  // Check for universal Allow: / with no broad Disallow - this is fully open access
  const hasUniversalAllow = /User-agent:\s*\*[\s\S]*?Allow:\s*\/(?:\s|$)/i.test(robotsTxt);
  const hasBroadDisallow = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?:\s|$)/i.test(robotsTxt);

  // Check if specific AI bots are explicitly blocked
  const blockedAiBots = AI_CRAWLERS.filter((c) => {
    const botSection = new RegExp(`User-agent:\\s*${c}[\\s\\S]*?Disallow:\\s*\\/(?:\\s|$)`, "i");
    return botSection.test(robotsTxt);
  });

  if (blockedAiBots.length > 0) {
    return { id: "robots", name: "Crawler Access (robots.txt)", score: 0, status: "fail", detail: `AI crawlers may be blocked (${blockedAiBots.join(", ")} has Disallow: /). This significantly hurts visibility.` };
  }

  if (hasBroadDisallow) {
    return { id: "robots", name: "Crawler Access (robots.txt)", score: 0, status: "fail", detail: "robots.txt blocks all crawlers (Disallow: /). AI crawlers cannot access your site." };
  }

  const mentioned = AI_CRAWLERS.filter((c) => new RegExp(c, "i").test(robotsTxt));

  if (hasUniversalAllow || mentioned.length >= 5) {
    return { id: "robots", name: "Crawler Access (robots.txt)", score: 100, status: "pass", detail: "AI crawlers can access your site. robots.txt allows crawling." };
  }
  if (mentioned.length >= 3) {
    return { id: "robots", name: "Crawler Access (robots.txt)", score: 70, status: "warn", detail: "robots.txt found but doesn't explicitly name all AI crawlers. Consider adding GPTBot, PerplexityBot, and anthropic-ai." };
  }
  // robots.txt exists, not blocking anything - treat as open
  return { id: "robots", name: "Crawler Access (robots.txt)", score: 70, status: "warn", detail: "robots.txt found. Add explicit Allow rules for GPTBot, PerplexityBot, and anthropic-ai to confirm AI crawler access." };
}

function checkLlmsTxt(llmsTxt: string | null): TechnicalCheck {
  if (!llmsTxt) {
    return { id: "llms", name: "llms.txt File", score: 0, status: "fail", detail: "No llms.txt found. This file tells AI systems about your brand directly." };
  }
  const lines = llmsTxt.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length >= 20) {
    return { id: "llms", name: "llms.txt File", score: 80, status: "pass", detail: "llms.txt found. Good AI accessibility." };
  }
  return { id: "llms", name: "llms.txt File", score: 40, status: "warn", detail: "llms.txt exists but has limited content. Expand it with more brand context." };
}

function checkSchemaMarkup(rawHtml: string): TechnicalCheck {
  if (!rawHtml) {
    return { id: "schema", name: "Schema Markup", score: 0, status: "fail", detail: "No schema markup found. AI engines struggle to identify your brand entity." };
  }
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(rawHtml);
  if (!hasJsonLd) {
    return { id: "schema", name: "Schema Markup", score: 0, status: "fail", detail: "No schema markup found. AI engines struggle to identify your brand entity." };
  }
  const hasOrg = /"@type"\s*:\s*"Organization"/i.test(rawHtml);
  if (hasOrg) {
    return { id: "schema", name: "Schema Markup", score: 100, status: "pass", detail: "Schema.org Organization markup found. AI engines understand your entity." };
  }
  return { id: "schema", name: "Schema Markup", score: 50, status: "warn", detail: "Some schema markup found, but no Organization type. Add Organization schema for better entity recognition." };
}

function checkContentStructure(rawHtml: string, bodyText: string): TechnicalCheck {
  if (!rawHtml) {
    return { id: "content", name: "Content Structure", score: 5, status: "fail", detail: "Content is extremely thin. AI engines have almost nothing to cite or quote meaningfully." };
  }
  const wordCount = bodyText.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const hasH1 = /<h1[^>]*>/i.test(rawHtml);
  const hasH2 = /<h2[^>]*>/i.test(rawHtml);
  const checksPass = (wordCount > 300 ? 1 : 0) + (hasH1 ? 1 : 0) + (hasH2 ? 1 : 0);
  if (checksPass >= 3) {
    return { id: "content", name: "Content Structure", score: 100, status: "pass", detail: `Good content structure: ${wordCount}+ words, clear heading hierarchy.` };
  }
  if (checksPass >= 2) {
    return { id: "content", name: "Content Structure", score: 50, status: "warn", detail: `Partial structure detected. ${wordCount} words. Consider adding more headings and structured content.` };
  }
  return { id: "content", name: "Content Structure", score: 5, status: "fail", detail: "Content is extremely thin. AI engines have almost nothing to cite or quote meaningfully." };
}

function checkEntityConsistency(rawHtml: string): { check: TechnicalCheck; socialLinks: string[]; contactEmail: string | null } {
  const socialPatterns = [
    /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]{1,50}/gi,
    /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9-]{1,50}/gi,
    /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]{1,50}/gi,
    /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,50}/gi,
    /https?:\/\/(www\.)?youtube\.com\/(channel|@|c\/)[a-zA-Z0-9_.-]{1,100}/gi,
    /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-]{1,50}/gi,
    /https?:\/\/(www\.)?producthunt\.com\/[a-zA-Z0-9/_-]{1,100}/gi,
    /https?:\/\/(www\.)?crunchbase\.com\/organization\/[a-zA-Z0-9-]{1,100}/gi,
  ];

  const socialLinks: string[] = [];
  for (const pattern of socialPatterns) {
    const matches = rawHtml.match(pattern);
    if (matches && matches[0]) socialLinks.push(matches[0]!);
  }

  // Also extract sameAs from JSON-LD to catch links only in structured data
  const jsonLdMatches = rawHtml.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of jsonLdMatches) {
    try {
      const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, "").trim());
      const sameAs: unknown[] = Array.isArray(json?.sameAs) ? json.sameAs : (json?.sameAs ? [json.sameAs] : []);
      for (const url of sameAs) {
        if (typeof url === "string" && !socialLinks.includes(url)) {
          socialLinks.push(url);
        }
      }
    } catch { /* skip malformed JSON-LD */ }
  }

  const emailMatch = rawHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const contactEmail = emailMatch ? emailMatch[0]! : null;

  let check: TechnicalCheck;
  if (socialLinks.length >= 3) {
    check = { id: "entity", name: "Entity Consistency", score: 100, status: "pass", detail: `${socialLinks.length} social profile links found. AI engines can verify your entity identity.` };
  } else if (socialLinks.length >= 1) {
    check = { id: "entity", name: "Entity Consistency", score: 50, status: "warn", detail: `${socialLinks.length} social profile link(s) found. Add more to strengthen entity signals.` };
  } else {
    check = { id: "entity", name: "Entity Consistency", score: 0, status: "fail", detail: "No social profile links found. AI engines use social signals to verify entity identity." };
  }

  return { check, socialLinks: [...new Set(socialLinks)], contactEmail };
}

export async function runTechnicalAudit(domain: string, rawHtml: string, bodyText: string): Promise<TechnicalAuditResult> {
  const baseUrl = `https://${domain}`;
  const [robotsTxt, llmsTxt] = await Promise.all([
    fetchText(`${baseUrl}/robots.txt`),
    fetchText(`${baseUrl}/llms.txt`),
  ]);

  const crawlerCheck = checkCrawlerAccess(robotsTxt);
  const llmsCheck = checkLlmsTxt(llmsTxt);
  const schemaCheck = checkSchemaMarkup(rawHtml);
  const contentCheck = checkContentStructure(rawHtml, bodyText);
  const { check: entityCheck, socialLinks, contactEmail } = checkEntityConsistency(rawHtml);

  const checks = [crawlerCheck, llmsCheck, schemaCheck, contentCheck, entityCheck];
  const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);

  const metaMatch =
    rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const brandDescription = metaMatch ? metaMatch[1]!.trim() : "";

  return { checks, overallScore, socialLinks, contactEmail, brandDescription };
}

interface CategoryData {
  brandName: string;
  category: string;
  market: string;
  competitors: string[];
}

const VALID_CATEGORIES = new Set([
  "social media", "video platform", "search engine", "discussion forum",
  "news media", "entertainment", "ecommerce", "saas tool", "health app",
  "fintech", "edtech", "developer tool", "productivity", "food delivery",
  "travel", "real estate", "other",
]);

// Domains with these TLDs are almost always tech/SaaS products.
// Skip the AI classification step and default directly rather than risk a mis-class.
const TECH_TLDS = new Set([".ai", ".io", ".dev", ".app", ".so", ".xyz", ".tools", ".tech"]);

function domainSafeDefault(domain: string): string {
  const lower = domain.toLowerCase();
  for (const tld of TECH_TLDS) {
    if (lower.endsWith(tld)) return "saas tool";
  }
  return "saas tool";
}

async function detectCategory(scraped: ScrapedData): Promise<CategoryData> {
  const domain = scraped.domain;

  // If the scrape failed or returned almost nothing, skip the AI call entirely.
  // A mis-classification on thin/empty content is worse than a safe default.
  const hasContent = scraped.success && (scraped.title.length > 0 || scraped.metaDescription.length > 0 || scraped.bodyText.length > 20);

  if (!hasContent) {
    return {
      brandName: domain,
      category: domainSafeDefault(domain),
      market: "India",
      competitors: [],
    };
  }

  try {
    const prompt = `Analyze this website and return JSON only, no other text.

Domain: ${domain}
Title: ${scraped.title}
Description: ${scraped.metaDescription}
H1: ${scraped.h1}
Content preview: ${scraped.bodyText.substring(0, 400)}

Rules:
- Only use the page title, description, h1, and content to pick the category. Do not infer from the domain name alone.
- If the page describes a software tool, API, AI product, or online service for businesses or developers, use "saas tool" or "developer tool".
- Only use "news media" if the page content clearly shows a news publication or media outlet with articles and journalism.

Return exactly this JSON:
{
  "brand_name": "the product or brand name (short, not the full page title)",
  "category": "one of: social media, video platform, search engine, discussion forum, news media, entertainment, ecommerce, saas tool, health app, fintech, edtech, developer tool, productivity, food delivery, travel, real estate, other",
  "market": "one of: India, Global, US, UK",
  "top_competitors": ["competitor1", "competitor2", "competitor3"]
}`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    // Validate the returned category is a known value. Reject anything unrecognised.
    const rawCategory = typeof parsed.category === "string" ? parsed.category.toLowerCase().trim() : "";
    const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : domainSafeDefault(domain);

    return {
      brandName: typeof parsed.brand_name === "string" && parsed.brand_name.length > 0
        ? parsed.brand_name
        : domain,
      category,
      market: parsed.market ?? "India",
      competitors: Array.isArray(parsed.top_competitors) ? parsed.top_competitors.slice(0, 3) : [],
    };
  } catch {
    return {
      brandName: domain,
      category: domainSafeDefault(domain),
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
        // RapidAPI perplexity2 returns: choices.content.parts[0].text
        const choices = data.choices as Record<string, unknown> | undefined;
        const parts = (choices?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined;
        const partsText = typeof parts?.[0]?.text === "string" ? parts[0].text : null;
        const text =
          partsText ??
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

async function queryClaude(prompt: string): Promise<{ text: string; simulated: boolean }> {
  // Simulate Claude via OpenAI. Set ANTHROPIC_API_KEY for real Claude responses.
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Claude, an AI assistant made by Anthropic. Answer questions about products, tools, and services thoughtfully. Be direct and mention specific brands, products, and services you know about.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    return { text: response.choices[0]?.message?.content ?? "", simulated: true };
  } catch {
    return { text: "", simulated: true };
  }
}

async function queryGrok(prompt: string): Promise<{ text: string; simulated: boolean }> {
  if (xaiClient) {
    try {
      const response = await xaiClient.chat.completions.create({
        model: "grok-3-fast-beta",
        messages: [
          { role: "system", content: "You are Grok, an AI assistant made by xAI. Answer questions about products, tools, and services with direct, honest information. Name specific products and services where you know them." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.35,
      });
      return { text: response.choices[0]?.message?.content ?? "", simulated: false };
    } catch {
      // fall through to simulated
    }
  }

  // Fallback: OpenAI simulating Grok
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Grok, an AI assistant made by xAI. Answer questions about products, tools, and services with direct, honest information. Name specific products and services where you know them.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.35,
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

// Informational query patterns (price, date, news) — not useful for product discovery
const INFORMATIONAL_KW = /\b(price|rate|today|news|history|definition|meaning|live|current|latest|update|forecast|chart|vs\b|compare|review|tutorial|guide|how to|what is|when is|why is)\b/i;
// Navigation intent — user is looking for a login/signup page, not discovering tools
const NAVIGATION_KW = /\b(login|log in|log-in|sign in|sign-up|signup|sign up|register|download|install|account|password|reset|forgot|contact|support|careers|jobs)\b/i;

/**
 * Extract topical (non-branded, non-informational, non-navigational) keywords from
 * DataForSEO results and use them as supplemental prompts alongside the standard
 * category-based prompts.
 *
 * Strategy: category prompts are always the backbone (accurate, battle-tested).
 * DataForSEO topical keywords ADD up to 2 bonus prompts when they pass quality filters.
 * This preserves score accuracy while adding topical signal for brands with good keywords.
 *
 * A keyword passes quality filters when it:
 *   1. Does NOT contain any brand variation
 *   2. Is at least 2 words long (single-word queries carry no product-category signal)
 *   3. Is NOT a price/date/news informational query
 *   4. Is NOT a navigation query (login, signup, etc.)
 */
interface KeywordPromptResult {
  prompts: string[];
  keywordsFromDataforseo: number;
  keywordsFilteredOut: number;
}

function buildKeywordPrompts(
  keywords: Array<{ keyword: string }>,
  brandName: string,
  domain: string,
  category: string,
  market: string,
  competitors: string[],
): KeywordPromptResult {
  const base = generatePrompts(brandName, domain, category, market, competitors);

  const variations = getBrandVariations(brandName, domain);
  const root = domain.replace(/^www\./i, "").replace(/\.[a-z]{2,6}$/i, "").toLowerCase();

  const topical = keywords.filter((k) => {
    const kw = k.keyword.toLowerCase();
    if (variations.some((v) => kw.includes(v))) return false;
    if (root.length > 3 && kw.includes(root)) return false;
    if (kw.trim().split(/\s+/).length < 2) return false;
    if (INFORMATIONAL_KW.test(kw)) return false;
    if (NAVIGATION_KW.test(kw)) return false;
    return true;
  });

  const extra = topical.slice(0, 2).map((k) => {
    const kw = k.keyword;
    if (/^(what|how|which|where|when|who|why|is|are|can|does|do)\b/i.test(kw)) return kw;
    return `What are the best tools or platforms for ${kw}? List the top options with a brief description of each.`;
  });

  console.log(
    `[DataForSEO] ${domain} — ${keywords.length} fetched, ${keywords.length - topical.length} filtered out (branded/informational/navigational), ${topical.length} topical passed, ${extra.length} added as bonus prompts`,
  );

  return {
    prompts: [...base, ...extra],
    keywordsFromDataforseo: keywords.length,
    keywordsFilteredOut: keywords.length - topical.length,
  };
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

  // If the domain could not be reached, bail out immediately.
  // Do NOT run AI queries or technical checks - they will also fail and waste time.
  if (!scraped.success) {
    const failedCheck = (id: string, name: string): TechnicalCheck => ({
      id, name, score: 0, status: "fail",
      detail: "Domain could not be reached. Check the URL and try again.",
    });
    return {
      unreachable: true,
      brandName: domain,
      category: "other",
      market: "India",
      chatgpt: { found: false, detail: null, score: 0, competitors: [] },
      gemini: { found: false, detail: null, score: 0, competitors: [] },
      perplexity: { found: false, detail: null, score: 0, competitors: [] },
      claude: { found: false, detail: null, score: 0, competitors: [] },
      grok: { found: false, detail: null, score: 0, competitors: [] },
      keywordsUsed: [],
      keywordsFromDataforseo: 0,
      keywordsFilteredOut: 0,
      rawChatgptResponse: "",
      rawGeminiResponse: "",
      rawPerplexityResponse: "",
      rawClaudeResponse: "",
      rawGrokResponse: "",
      technicalAudit: {
        checks: [
          failedCheck("robots", "Crawler Access (robots.txt)"),
          failedCheck("llms", "llms.txt File"),
          failedCheck("schema", "Schema Markup"),
          failedCheck("content", "Content Structure"),
          failedCheck("entity", "Entity Consistency"),
        ],
        overallScore: 0,
        socialLinks: [],
        contactEmail: null,
        brandDescription: "",
      },
    };
  }

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
  let keywordsFromDataforseo = 0;
  let keywordsFilteredOut = 0;
  let prompts: string[];

  if (dfsKeywords.length > 0) {
    const kpResult = buildKeywordPrompts(dfsKeywords, brandName, domain, category, market, competitors);
    prompts = kpResult.prompts;
    keywordsFromDataforseo = kpResult.keywordsFromDataforseo;
    keywordsFilteredOut = kpResult.keywordsFilteredOut;
  } else {
    prompts = generatePrompts(brandName, domain, category, market, competitors);
    console.log(`[DataForSEO] ${domain} — no keywords from DataForSEO, using category-based prompts`);
  }

  // Direct brand query — used only for display ("what did [AI] say about you")
  // This is separate from scoring prompts which must never name the brand.
  // We inject real scraped website content so the AI summarizes actual site copy,
  // not just whatever its training data happens to know about the brand name.
  const siteContext = scraped.success
    ? [
        scraped.title ? `Page title: ${scraped.title}` : "",
        scraped.metaDescription ? `Meta description: ${scraped.metaDescription}` : "",
        scraped.h1 ? `Main heading: ${scraped.h1}` : "",
        scraped.headings.length > 0 ? `Section headings: ${scraped.headings.join(" | ")}` : "",
        scraped.bodyText ? `Website content:\n${scraped.bodyText}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  // For training-data engines (ChatGPT, Gemini, Claude, Grok): inject scraped site content
  // so they summarise the real website rather than guessing from training data alone.
  const trainingDataDirectPrompt = siteContext
    ? `Below is content scraped directly from the website ${brandName} (${domain}):\n\n${siteContext}\n\nBased on this website content, summarize what ${brandName} is, what it does, who it is for, and what its key features or offerings are. Write a clear, factual summary based only on what the site says.`
    : `Based on your training data, what do you know about ${brandName} at ${domain}? If you don't have specific information, say so clearly.`;

  // For Perplexity (live web search): let it search the web rather than being given scraped content.
  // A clean web-search style query gives the most accurate live visibility signal.
  const perplexityDirectPrompt = `Search the web for ${brandName} (${domain}) and tell me: what does this brand do, who is it for, and what is it currently known for online? If you can visit their website, please do. Give me a current, factual summary.`;

  // Run all AI queries + technical audit + direct brand queries all in parallel
  const chatgptTasks = prompts.map((p) => queryOpenAIChatGPT(p));
  const geminiTasks = prompts.map((p) => queryGemini(p));
  const perplexityTasks = prompts.map((p) => queryPerplexity(p));
  const claudeTasks = prompts.map((p) => queryClaude(p));
  const grokTasks = prompts.map((p) => queryGrok(p));

  const [
    chatgptTexts, geminiResults, perplexityResults, claudeResults, grokResults,
    technicalAudit,
    directChatgpt, directGemini, directPerplexity, directClaude, directGrok,
  ] = await Promise.all([
    Promise.all(chatgptTasks),
    Promise.all(geminiTasks),
    Promise.all(perplexityTasks),
    Promise.all(claudeTasks),
    Promise.all(grokTasks),
    runTechnicalAudit(domain, scraped.rawHtml, scraped.bodyText),
    queryOpenAIChatGPT(trainingDataDirectPrompt),
    queryGemini(trainingDataDirectPrompt),
    queryPerplexity(perplexityDirectPrompt),
    queryClaude(trainingDataDirectPrompt),
    queryGrok(trainingDataDirectPrompt),
  ]);

  const chatgptResponses = chatgptTexts.map((text, i) => ({ prompt: prompts[i]!, text }));
  const geminiResponses = geminiResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));
  const perplexityResponses = perplexityResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));
  const claudeResponses = claudeResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));
  const grokResponses = grokResults.map((r, i) => ({ prompt: prompts[i]!, text: r.text }));

  const geminiSimulated = geminiResults.some((r) => r.simulated);
  const perplexitySimulated = perplexityResults.some((r) => r.simulated);
  const claudeSimulated = claudeResults.some((r) => r.simulated);
  const grokSimulated = grokResults.some((r) => r.simulated);

  const chatgpt = calculateSystemScore(brandName, domain, chatgptResponses, false);
  const gemini = calculateSystemScore(brandName, domain, geminiResponses, geminiSimulated);
  const perplexity = calculateSystemScore(brandName, domain, perplexityResponses, perplexitySimulated);
  const claude = calculateSystemScore(brandName, domain, claudeResponses, claudeSimulated);
  const grok = calculateSystemScore(brandName, domain, grokResponses, grokSimulated);

  // Use direct brand responses for display — these show what each AI actually knows about the brand
  const rawChatgptResponse = directChatgpt.trim() || chatgptTexts.filter((t) => t.trim())[0] || "";
  const rawGeminiResponse = directGemini.text.trim() || geminiResults.map((r) => r.text).filter((t) => t.trim())[0] || "";
  const rawPerplexityResponse = directPerplexity.text.trim() || perplexityResults.map((r) => r.text).filter((t) => t.trim())[0] || "";
  const rawClaudeResponse = directClaude.text.trim() || claudeResults.map((r) => r.text).filter((t) => t.trim())[0] || "";
  const rawGrokResponse = directGrok.text.trim() || grokResults.map((r) => r.text).filter((t) => t.trim())[0] || "";

  return {
    brandName,
    category,
    market,
    chatgpt,
    gemini,
    perplexity,
    claude,
    grok,
    keywordsUsed: prompts,
    keywordsFromDataforseo,
    keywordsFilteredOut,
    rawChatgptResponse,
    rawGeminiResponse,
    rawPerplexityResponse,
    rawClaudeResponse,
    rawGrokResponse,
    technicalAudit,
  };
}

const DEFAULT_EEAT: EeatScore = {
  total: 40,
  experience: 8,
  expertise: 12,
  authoritativeness: 10,
  trustworthiness: 10,
  strengths: "Basic content structure present.",
  weaknesses: "Weak on Experience — add case studies or customer stories. Weak on Authoritativeness — get listed on authoritative directories.",
};

export async function generateRecommendations(
  brandName: string,
  domain: string,
  category: string,
  market: string,
  chatgpt: AuditQueryResult,
  gemini: AuditQueryResult,
  perplexity: AuditQueryResult,
  technicalAudit: TechnicalAuditResult,
): Promise<{ recommendations: Recommendation[]; eeatScore: EeatScore }> {
  const techSignals = technicalAudit.checks.map((c) => `${c.name}: ${c.status} (${c.score}/100) — ${c.detail}`).join("\n");

  // Determine what is already fixed so Claude does not recommend re-doing it
  const findCheck = (keyword: string) => technicalAudit.checks.find(c => c.name.toLowerCase().includes(keyword));
  const robotsCheck = findCheck("robot");
  const llmsCheck = findCheck("llm");
  const schemaCheck = findCheck("schema");
  const contentCheck = findCheck("content");
  const entityCheck = findCheck("entity") ?? findCheck("social");

  const stateFor = (check: typeof robotsCheck, friendlyName: string) => {
    if (!check) return "";
    return check.score >= 70
      ? `${friendlyName}: ALREADY DONE (${check.score}/100) — do NOT recommend this, it is fixed`
      : `${friendlyName}: NEEDS FIX (${check.score}/100) — recommend this`;
  };

  const currentStateBlock = [
    stateFor(robotsCheck, "Robots.txt AI crawler access"),
    stateFor(llmsCheck, "llms.txt file"),
    stateFor(schemaCheck, "Schema markup"),
    stateFor(contentCheck, "Content structure"),
    stateFor(entityCheck, "Social/entity signals"),
  ].filter(Boolean).join("\n");

  const aiTotal = chatgpt.score + gemini.score + perplexity.score;

  const auditSummary = `Brand: ${brandName}
Domain: ${domain}
Category: ${category}
Market: ${market}
ChatGPT score: ${chatgpt.score}/33 — Found: ${chatgpt.found}
Gemini score: ${gemini.score}/33 — Found: ${gemini.found}
Perplexity score: ${perplexity.score}/33 — Found: ${perplexity.found}
Current AI visibility: ${aiTotal}/99 (${Math.round(aiTotal * 100 / 99)}%)
Social profiles found: ${technicalAudit.socialLinks.length}
Contact email: ${technicalAudit.contactEmail ? "yes" : "no"}
Technical signals:
${techSignals}

CURRENT STATE — items already fixed (do NOT recommend these):
${currentStateBlock || "No technical data available yet."}`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a GEO (Generative Engine Optimization) expert who uses the CITE and EEAT frameworks.

CITE Framework — tag every recommendation with one category:
C (Citations): Getting cited by authoritative sources that AI training data includes. Crunchbase, Product Hunt, G2, TechCrunch, Reddit, and Hacker News are heavily included in AI training datasets.
I (Indexability): Technical fixes so AI crawlers can access and read the site. llms.txt, robots.txt, structured data, and site speed affect Perplexity's live crawler immediately.
T (Trustworthiness): Entity consistency, social signals, structured data that establish the brand as a real verified entity.
E (Entity Recognition): Schema markup, Knowledge Graph presence, brand entity establishment so AI knows who the brand is.

EEAT Framework — score the brand's content quality:
Experience (0-25): Does the content show firsthand knowledge? Case studies, personal stories, real user outcomes.
Expertise (0-25): Is it technically accurate and detailed? Specific claims, how-to content, deep explanations.
Authoritativeness (0-25): Does it cite sources? Is the brand referenced by others? External validation.
Trustworthiness (0-25): Is it factually dense? Contact info present, privacy policy, verifiable claims.

You understand ChatGPT and Gemini answer from training data (cutoff 2023-2024) so new brands won't appear until the next training run. Perplexity searches the live web in real time. Be honest about timelines. Return valid JSON only.`,
        },
        {
          role: "user",
          content: `Here is the AI visibility audit:\n\n${auditSummary}\n\nIMPORTANT: The CURRENT STATE section above lists items that are ALREADY DONE. Do NOT recommend fixing things that are already done. Only recommend actions that are actually needed right now based on what is broken or missing.\n\nReturn a JSON object with exactly this structure:\n{\n  "recommendations": [\n    {\n      "action": "specific 2-sentence action including WHY it helps and expected timeline",\n      "priority": "high",\n      "effort_hours": 2,\n      "impact_score": 12,\n      "category": "citations",\n      "cite_category": "C"\n    }\n  ],\n  "eeat": {\n    "experience": 8,\n    "expertise": 18,\n    "authoritativeness": 12,\n    "trustworthiness": 15,\n    "strengths": "Strong on Expertise and Trustworthiness.",\n    "weaknesses": "Weak on Experience — add personal examples or case studies. Weak on Authoritativeness — get listed on G2 and Crunchbase."\n  }\n}\n\nGenerate exactly 5 recommendations for what this brand needs to do RIGHT NOW (not things already done).\nEach must have cite_category of C, I, T, or E.\npriority: high, medium, or low\ncategory: citations, content, technical, pr, social\nEEAT scores must be 0-25 each. Be realistic based on the technical signals above.`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as {
      recommendations?: Record<string, unknown>[];
      items?: Record<string, unknown>[];
      eeat?: {
        experience?: number;
        expertise?: number;
        authoritativeness?: number;
        trustworthiness?: number;
        strengths?: string;
        weaknesses?: string;
      };
    };
    const items = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? parsed.items ?? []);

    const VALID_CITE = new Set(["C", "I", "T", "E"]);
    const recommendations: Recommendation[] = items.slice(0, 5).map((item: Record<string, unknown>) => {
      const rawCite = String(item.cite_category ?? item.citeCategory ?? "");
      return {
        action: String(item.action ?? ""),
        priority: (["high", "medium", "low"].includes(String(item.priority)) ? item.priority : "medium") as "high" | "medium" | "low",
        effortHours: Number(item.effort_hours ?? 2),
        impactScore: Number(item.impact_score ?? 8),
        category: String(item.category ?? "content"),
        citeCategory: (VALID_CITE.has(rawCite) ? rawCite : "C") as "C" | "I" | "T" | "E",
      };
    });

    const eeat = parsed.eeat ?? {};
    const experience = Math.min(25, Math.max(0, Number(eeat.experience ?? 8)));
    const expertise = Math.min(25, Math.max(0, Number(eeat.expertise ?? 12)));
    const authoritativeness = Math.min(25, Math.max(0, Number(eeat.authoritativeness ?? 10)));
    const trustworthiness = Math.min(25, Math.max(0, Number(eeat.trustworthiness ?? 10)));
    const eeatScore: EeatScore = {
      total: experience + expertise + authoritativeness + trustworthiness,
      experience,
      expertise,
      authoritativeness,
      trustworthiness,
      strengths: String(eeat.strengths ?? ""),
      weaknesses: String(eeat.weaknesses ?? ""),
    };

    return { recommendations, eeatScore };
  } catch {
    return {
      recommendations: [
        {
          action: `Publish a detailed comparison article positioning ${brandName} against top competitors in ${category}. Include specific use cases and customer testimonials. This builds training data citations that affect ChatGPT and Gemini in 3-6 months.`,
          priority: "high",
          effortHours: 4,
          impactScore: 15,
          category: "content",
          citeCategory: "C",
        },
        {
          action: `Get ${brandName} listed on G2, Capterra, and ProductHunt with complete profiles. AI systems pull heavily from these authoritative review sources — impact on ChatGPT/Gemini in 3-6 months, Perplexity within days.`,
          priority: "high",
          effortHours: 2,
          impactScore: 12,
          category: "citations",
          citeCategory: "C",
        },
        {
          action: `Add a llms.txt file and JSON-LD Organization schema to your homepage. This helps Perplexity's crawler identify and describe your brand accurately within days.`,
          priority: "medium",
          effortHours: 2,
          impactScore: 10,
          category: "technical",
          citeCategory: "I",
        },
        {
          action: `Add consistent social profile links (LinkedIn, Twitter/X, GitHub) to your homepage and JSON-LD sameAs field. AI engines use these to verify entity identity and build trust signals.`,
          priority: "medium",
          effortHours: 1,
          impactScore: 8,
          category: "social",
          citeCategory: "T",
        },
        {
          action: `Create a structured FAQ page answering common questions about ${category} in ${market}. Natural language Q&A content is the primary format Perplexity and ChatGPT cite when answering user queries.`,
          priority: "low",
          effortHours: 3,
          impactScore: 6,
          category: "content",
          citeCategory: "E",
        },
      ],
      eeatScore: DEFAULT_EEAT,
    };
  }
}
