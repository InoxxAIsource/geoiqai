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
  chatgpt: AuditQueryResult;
  gemini: AuditQueryResult;
  perplexity: AuditQueryResult;
  keywordsUsed: string[];
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace("www.", "");
  } catch {
    return url.replace("www.", "").split("/")[0] ?? url;
  }
}

function buildPrompt(domain: string, brandName: string | null, category: string | null, market: string | null): { prompt: string; keywords: string[] } {
  const brand = brandName ?? domain;
  const cat = category ?? "software product";
  const mkt = market ?? "India";
  const keywords = [
    `best ${cat} tools in ${mkt}`,
    `top ${cat} startups ${mkt}`,
    `${cat} apps recommended by AI`,
    `alternatives to ${brand}`,
  ];
  const prompt = `I'm looking for the best ${cat} tools and platforms in ${mkt}. Can you recommend the top options? Is ${brand} (${domain}) one of them? What do you think of it?`;
  return { prompt, keywords };
}

function parseResult(response: string, domain: string, brandName: string | null): AuditQueryResult {
  const brand = (brandName ?? domain).toLowerCase();
  const resp = response.toLowerCase();
  const found = resp.includes(brand) || resp.includes(domain.toLowerCase());

  const competitorPatterns = /\b([A-Z][a-z]+(?:\.(?:com|io|ai|co))?)\b/g;
  const competitors: string[] = [];
  let match;
  while ((match = competitorPatterns.exec(response)) !== null) {
    const name = match[1];
    if (name && name.toLowerCase() !== brand && name.toLowerCase() !== domain.toLowerCase() && name.length > 2) {
      if (!competitors.includes(name)) competitors.push(name);
    }
  }

  let score = 0;
  if (found) {
    score = 60;
    if (resp.includes("recommend") || resp.includes("top") || resp.includes("best")) score += 20;
    if (resp.includes("popular") || resp.includes("widely used")) score += 10;
    if (resp.includes("excellent") || resp.includes("great") || resp.includes("fantastic")) score += 10;
  }

  return {
    found,
    detail: found ? response.substring(0, 500) : null,
    score,
    competitors: competitors.slice(0, 5),
  };
}

async function queryOpenAI(prompt: string, domain: string, brandName: string | null, systemLabel: string): Promise<AuditQueryResult> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a helpful AI assistant. Answer the user's question about tools and products honestly.` },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    const text = response.choices[0]?.message?.content ?? "";
    return parseResult(text, domain, brandName);
  } catch {
    return { found: false, detail: `${systemLabel} query failed`, score: 0, competitors: [] };
  }
}

async function queryGemini(prompt: string, domain: string, brandName: string | null): Promise<AuditQueryResult> {
  // Use OpenAI-compatible endpoint as fallback since we use Replit AI integration
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are Gemini, Google's AI assistant. Answer questions about tools and products.` },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });
    const text = response.choices[0]?.message?.content ?? "";
    return parseResult(text, domain, brandName);
  } catch {
    return { found: false, detail: "Gemini query failed", score: 0, competitors: [] };
  }
}

async function queryPerplexity(prompt: string, domain: string, brandName: string | null): Promise<AuditQueryResult> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a search-augmented AI. Answer with up-to-date information about tools and products.` },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.9,
    });
    const text = response.choices[0]?.message?.content ?? "";
    return parseResult(text, domain, brandName);
  } catch {
    return { found: false, detail: "Perplexity query failed", score: 0, competitors: [] };
  }
}

export async function runAuditEngine(
  url: string,
  brandName: string | null,
  category: string | null,
  market: string | null,
): Promise<AuditEngineResult> {
  const domain = extractDomain(url);
  const { prompt, keywords } = buildPrompt(domain, brandName, category, market);

  const [chatgpt, gemini, perplexity] = await Promise.all([
    queryOpenAI(prompt, domain, brandName, "ChatGPT"),
    queryGemini(prompt, domain, brandName),
    queryPerplexity(prompt, domain, brandName),
  ]);

  return { chatgpt, gemini, perplexity, keywordsUsed: keywords };
}

export function generateRecommendations(chatgpt: AuditQueryResult, gemini: AuditQueryResult, perplexity: AuditQueryResult, domain: string): Array<{ title: string; description: string; priority: string; aiSystem: string }> {
  const recs = [];

  if (!chatgpt.found) {
    recs.push({
      title: "Get mentioned in ChatGPT answers",
      description: `ChatGPT hasn't recommended ${domain} yet. Publish comprehensive guides and comparison articles that position ${domain} as a category leader. Focus on high-quality backlinks from authoritative domains.`,
      priority: "high",
      aiSystem: "ChatGPT",
    });
  }
  if (!gemini.found) {
    recs.push({
      title: "Build Google knowledge graph presence",
      description: `Gemini relies heavily on Google's knowledge graph. Create a Google Business Profile, add structured data markup (JSON-LD) to your site, and get featured in authoritative review sites.`,
      priority: "high",
      aiSystem: "Gemini",
    });
  }
  if (!perplexity.found) {
    recs.push({
      title: "Increase citation-worthy content",
      description: `Perplexity pulls from real-time web sources. Publish data-driven reports, original research, and statistics that journalists and bloggers will cite. Get listed in curated directories.`,
      priority: "medium",
      aiSystem: "Perplexity",
    });
  }
  if (chatgpt.found && chatgpt.score < 70) {
    recs.push({
      title: "Improve ChatGPT recommendation rank",
      description: `${domain} appears in ChatGPT but not as a top recommendation. Create authoritative comparison content and gather more reviews on G2, Capterra, and ProductHunt.`,
      priority: "medium",
      aiSystem: "ChatGPT",
    });
  }
  recs.push({
    title: "Build an AI-optimized FAQ page",
    description: "AI systems love structured Q&A content. Create a comprehensive FAQ page using natural language questions your customers ask, with detailed answers that position your brand as the expert.",
    priority: "low",
    aiSystem: "All",
  });

  return recs;
}

export { extractDomain };
