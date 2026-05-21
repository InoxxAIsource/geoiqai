import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL,
});

export interface AuditQueryResult {
  found: boolean;
  detail: string | null;
  score: number;
  competitors: string[];
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

    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
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
  "category": "one of: health app, saas tool, ecommerce, fintech, edtech, food delivery, travel, real estate, other",
  "market": "one of: India, Global, US, UK",
  "top_competitors": ["competitor1", "competitor2", "competitor3"]
}`;

    const response = await client.chat.completions.create({
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

function generatePrompts(brandName: string, category: string, market: string, competitors: string[]): string[] {
  const prompts: string[] = [
    `What is ${brandName}?`,
    `Is ${brandName} a good ${category}? Review and recommendation.`,
    `Best ${category} tools in ${market} — what are the top options?`,
    `${brandName} alternatives — what should I use instead?`,
  ];

  if (competitors.length > 0) {
    prompts.push(`${brandName} vs ${competitors[0]} — which is better?`);
  }

  return prompts;
}

interface RawResponse {
  prompt: string;
  text: string;
  system: "chatgpt" | "gemini" | "perplexity";
}

async function querySingleSystem(
  prompt: string,
  system: "chatgpt" | "gemini" | "perplexity",
): Promise<RawResponse> {
  const systemPrompts: Record<string, string> = {
    chatgpt:
      "You are ChatGPT, a helpful AI assistant. Answer questions about products, tools, and services honestly and helpfully. Recommend specific options where relevant.",
    gemini:
      "You are Gemini, Google's AI assistant. Answer questions about products, tools, and services with balanced, helpful information. Mention specific tools and services where relevant.",
    perplexity:
      "You are a search-augmented AI assistant. Answer with up-to-date, specific information about products and services. Be direct and recommend specific options.",
  };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompts[system]! },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: system === "chatgpt" ? 0.3 : system === "gemini" ? 0.4 : 0.5,
    });
    return { prompt, text: response.choices[0]?.message?.content ?? "", system };
  } catch {
    return { prompt, text: "", system };
  }
}

function calculateSystemScore(
  brandName: string,
  responses: RawResponse[],
): AuditQueryResult {
  const brandLower = brandName.toLowerCase();
  let score = 0;
  let found = false;
  let detail: string | null = null;
  const competitors: string[] = [];

  for (const item of responses) {
    const respLower = item.text.toLowerCase();

    if (respLower.includes(brandLower)) {
      found = true;
      const firstMention = respLower.indexOf(brandLower);
      const totalLength = respLower.length;

      if (firstMention < totalLength * 0.3) {
        score += 15;
      } else {
        score += 10;
      }

      if (!detail) {
        const sentences = item.text.split(/[.!?]/);
        for (const s of sentences) {
          if (s.toLowerCase().includes(brandLower)) {
            detail = s.trim().substring(0, 150);
            break;
          }
        }
      }
    }

    const compPattern = /\b([A-Z][a-z]{2,}(?:\.(?:com|io|ai|co))?)\b/g;
    let match;
    while ((match = compPattern.exec(item.text)) !== null) {
      const name = match[1]!;
      if (
        name.toLowerCase() !== brandLower &&
        !competitors.includes(name) &&
        name.length > 2 &&
        !["The", "You", "This", "That", "With", "For", "Can", "Are", "Has", "Its"].includes(name)
      ) {
        competitors.push(name);
      }
    }
  }

  return {
    found,
    score: Math.min(score, 33),
    detail: found ? detail : "Not found in AI responses",
    competitors: competitors.slice(0, 5),
  };
}

export async function runAuditEngine(
  url: string,
  brandNameOverride: string | null,
  categoryOverride: string | null,
  marketOverride: string | null,
): Promise<AuditEngineResult> {
  const scraped = await scrapeUrl(url);
  const catData = await detectCategory(scraped);

  const brandName = brandNameOverride ?? catData.brandName;
  const category = categoryOverride ?? catData.category;
  const market = marketOverride ?? catData.market;
  const competitors = catData.competitors;

  const prompts = generatePrompts(brandName, category, market, competitors);

  const tasks: Promise<RawResponse>[] = [];
  for (const prompt of prompts) {
    tasks.push(querySingleSystem(prompt, "chatgpt"));
    tasks.push(querySingleSystem(prompt, "gemini"));
    tasks.push(querySingleSystem(prompt, "perplexity"));
  }

  const allResponses = await Promise.all(tasks);

  const chatgptResponses = allResponses.filter((r) => r.system === "chatgpt");
  const geminiResponses = allResponses.filter((r) => r.system === "gemini");
  const perplexityResponses = allResponses.filter((r) => r.system === "perplexity");

  const chatgpt = calculateSystemScore(brandName, chatgptResponses);
  const gemini = calculateSystemScore(brandName, geminiResponses);
  const perplexity = calculateSystemScore(brandName, perplexityResponses);

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
    const response = await client.chat.completions.create({
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
      priority: (["high", "medium", "low"].includes(String(item.priority)) ? item.priority : "medium") as "high" | "medium" | "low",
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
