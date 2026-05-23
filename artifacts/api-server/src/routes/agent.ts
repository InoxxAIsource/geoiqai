import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { db, usersTable, monitoredBrandsTable, dailyScoresTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

const XAI_BASE = "https://api.x.ai/v1";
const XAI_KEY = process.env.XAI_API_KEY ?? "";
const AI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "";
const AI_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";

const STARTER_LIMIT = 50;

async function callAI(messages: { role: string; content: string }[], maxTokens = 1500): Promise<string> {
  const useXAI = !!XAI_KEY;
  const baseUrl = useXAI ? XAI_BASE : AI_BASE;
  const apiKey = useXAI ? XAI_KEY : AI_KEY;
  const model = useXAI ? "grok-3-fast-beta" : "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI call failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

interface BrandScores {
  scoreTotal: number;
  scoreChatgpt: number;
  scoreGemini: number;
  scorePerplexity: number;
}

function buildBrandContext(
  brand: { domain: string; brandName: string | null; category: string | null },
  scores: BrandScores | null
): string {
  const score = scores?.scoreTotal ?? 0;
  const chatgpt = scores?.scoreChatgpt ?? 0;
  const gemini = scores?.scoreGemini ?? 0;
  const perplexity = scores?.scorePerplexity ?? 0;

  const chatgptStatus = chatgpt === 0 ? "Invisible" : chatgpt < 12 ? "Low" : chatgpt < 24 ? "Moderate" : "Strong";
  const geminiStatus = gemini === 0 ? "Invisible" : gemini < 12 ? "Low" : gemini < 24 ? "Moderate" : "Strong";
  const perplexityStatus = perplexity === 0 ? "Invisible" : perplexity < 12 ? "Low" : perplexity < 24 ? "Moderate" : "Strong";

  return `Brand: ${brand.brandName ?? brand.domain}
Domain: ${brand.domain}
Category: ${brand.category ?? "General"}
GEO IQ Score: ${score}/100
ChatGPT: ${chatgpt}/33 (${chatgptStatus})
Gemini: ${gemini}/33 (${geminiStatus})
Perplexity: ${perplexity}/33 (${perplexityStatus})`;
}

async function getBrandScores(brandId: string): Promise<BrandScores | null> {
  const [row] = await db
    .select()
    .from(dailyScoresTable)
    .where(eq(dailyScoresTable.brandId, brandId))
    .orderBy(desc(dailyScoresTable.date))
    .limit(1);
  return row ?? null;
}

router.post("/agent/chat", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);

  const resetDate = user.agentMessagesReset;
  const needsReset = !resetDate || resetDate.slice(0, 7) !== thisMonth;

  if (needsReset) {
    await db
      .update(usersTable)
      .set({ agentMessagesUsed: 0, agentMessagesReset: now.toISOString().slice(0, 10) })
      .where(eq(usersTable.id, user.id));
    user.agentMessagesUsed = 0;
  }

  if (user.plan === "starter" && user.agentMessagesUsed >= STARTER_LIMIT) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    res.status(429).json({
      error: "limit_reached",
      message: `You have used your ${STARTER_LIMIT} GeoIQ Agent messages this month. Resets on ${nextMonth.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. Upgrade to Agency for unlimited.`,
      resetsOn: nextMonth.toISOString().slice(0, 10),
    });
    return;
  }

  const { message, history, brandId } = req.body as {
    message: string;
    history: { role: string; content: string }[];
    brandId: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const scores = await getBrandScores(brandId);
  const ctx = buildBrandContext(brand, scores);

  const systemPrompt = `You are a GEO (Generative Engine Optimization) expert and personal advisor for ${brand.brandName ?? brand.domain}.

${ctx}

Your job: help this founder improve their AI visibility in ChatGPT, Gemini, and Perplexity. You can generate content (tweets, blog posts, FAQs, pitch emails), explain scores, suggest tactics, and create action plans.

Rules:
- Write like a smart founder talking to another founder. Direct, no filler.
- Reference actual numbers from the brand context above.
- No em dashes. No "leverage" or "seamlessly". 
- Keep responses focused and actionable.
- When generating content, make it specific to ${brand.brandName ?? brand.domain} and the ${brand.category ?? "startup"} space.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...((history ?? []).slice(-10) as { role: string; content: string }[]),
    { role: "user", content: message },
  ];

  const reply = await callAI(messages, 1200);

  await db
    .update(usersTable)
    .set({ agentMessagesUsed: (user.agentMessagesUsed ?? 0) + 1 })
    .where(eq(usersTable.id, user.id));

  const remaining =
    user.plan === "starter" ? Math.max(0, STARTER_LIMIT - (user.agentMessagesUsed ?? 0) - 1) : null;

  res.json({ reply, remaining, plan: user.plan });
});

router.post("/agent/briefing", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { brandId } = req.body as { brandId: string };

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const scores = await getBrandScores(brandId);
  const ctx = buildBrandContext(brand, scores);

  const prompt = `${ctx}

Generate a 3-paragraph daily briefing:
Paragraph 1: Current score status - mention actual numbers, be direct about what it means.
Paragraph 2: One specific insight from the data - what stands out, what's the gap.
Paragraph 3: The single most important action they should take today and why.

Keep it conversational. Reference actual numbers. No bullet points - write in flowing paragraphs. Be specific about ${brand.brandName ?? brand.domain}, not generic startup advice.`;

  const reply = await callAI([{ role: "user", content: prompt }], 600);
  res.json({ briefing: reply });
});

router.post("/agent/generate", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { type, brandId, params } = req.body as {
    type: "tweet" | "blog" | "faq" | "pitch";
    brandId: string;
    params: Record<string, string>;
  };

  if (!type || !brandId) {
    res.status(400).json({ error: "type and brandId are required" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const scores = await getBrandScores(brandId);
  const brandCtx = buildBrandContext(brand, scores);
  const brandN = brand.brandName ?? brand.domain;
  const cat = brand.category ?? "startup";

  let prompt = "";
  let maxTok = 1200;

  if (type === "tweet") {
    const tone = params?.tone ?? "Professional";
    prompt = `${brandCtx}

Write 3 tweets about ${brandN}. Tone: ${tone}.

Rules:
- Each tweet max 280 characters
- No hashtag spam (1 max per tweet if needed)
- Make them specific to ${brandN} and the ${cat} space
- Reference real problems the audience has
- No filler phrases

Format exactly like this:
TWEET 1 [angle label]
[tweet text]
CHARACTER COUNT: [number]

TWEET 2 [angle label]
[tweet text]
CHARACTER COUNT: [number]

TWEET 3 [angle label]
[tweet text]
CHARACTER COUNT: [number]`;
    maxTok = 600;
  } else if (type === "blog") {
    const angle = params?.angle ?? "How";
    const keyword = params?.keyword ?? brandN;
    const wordCount = params?.wordCount ?? "1000";
    prompt = `${brandCtx}

Write a ${wordCount}-word blog post for ${brandN}.
Angle: ${angle}
Target keyword: ${keyword}
Category: ${cat}

Rules:
- Start with the title as H1
- Use H2 subheadings
- First sentence must hook the reader immediately
- Be specific - use real numbers, real problems
- No fluff, no "in today's digital world" openers
- Write like a founder who built this product

After the article, add:
EEAT SCORE
Experience: [X/25] - [one sentence note]
Expertise: [X/25] - [one sentence note]
Authority: [X/25] - [one sentence note]
Trust: [X/25] - [one sentence note]
Total: [X/100]`;
    maxTok = 2000;
  } else if (type === "faq") {
    prompt = `${brandCtx}

Generate 20 FAQ pairs for ${brandN} in the ${cat} space.

Rules:
- Questions must be in natural language people actually type into AI systems
- Answers must be 2-4 sentences, factual, quotable by AI
- Include questions about: what is it, how does it work, pricing, alternatives, who uses it, problems it solves
- Make answers specific to ${brandN}

Format:
Q: [question]
A: [answer]

[repeat for all 20]`;
    maxTok = 1800;
  } else if (type === "pitch") {
    const publication = params?.publication ?? "a tech newsletter";
    prompt = `${brandCtx}

Write a pitch email to ${publication} for ${brandN}.

Rules:
- Subject line first, then body
- Body max 3 sentences
- Mention what ${brandN} does, why readers care, one proof point (metric, customer, launch)
- No attachments mentioned
- End with a clear ask

Format:
SUBJECT: [subject line]

[email body]`;
    maxTok = 400;
  }

  if (!prompt) {
    res.status(400).json({ error: "Unknown generate type" });
    return;
  }

  const result = await callAI([{ role: "user", content: prompt }], maxTok);
  res.json({ result, type });
});

export default router;
