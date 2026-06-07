import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, answerMonitoringPromptsTable, answerMonitoringResultsTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray, type SQL } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const PLAN_LIMITS: Record<string, number> = { free: 5, starter: 50, agency: 150 };
const ALL_LLMS = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"];

function extractBrandName(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? domain;
}

function parseJSON<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch { return null; }
}

// ─── List prompts with latest results ────────────────────────────────────────
router.get("/answer-monitoring/prompts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const domain = (req.query.domain as string | undefined)?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";

  const conditions: SQL[] = [
    eq(answerMonitoringPromptsTable.userId, user.id),
    eq(answerMonitoringPromptsTable.active, true),
  ];
  if (domain) conditions.push(eq(answerMonitoringPromptsTable.domain, domain));

  const prompts = await db
    .select()
    .from(answerMonitoringPromptsTable)
    .where(and(...conditions))
    .orderBy(desc(answerMonitoringPromptsTable.createdAt));

  if (prompts.length === 0) {
    res.json({ prompts: [], limit: PLAN_LIMITS[user.plan ?? "free"] ?? 5 });
    return;
  }

  const promptIds = prompts.map(p => p.id);
  const allResults = await db
    .select()
    .from(answerMonitoringResultsTable)
    .where(inArray(answerMonitoringResultsTable.promptId, promptIds))
    .orderBy(desc(answerMonitoringResultsTable.checkedAt));

  const latestByPromptLlm = new Map<string, typeof allResults[0]>();
  for (const r of allResults) {
    const key = `${r.promptId}:${r.llm}`;
    if (!latestByPromptLlm.has(key)) latestByPromptLlm.set(key, r);
  }

  const prevByPromptLlm = new Map<string, typeof allResults[0]>();
  for (const r of allResults) {
    const key = `${r.promptId}:${r.llm}`;
    if (latestByPromptLlm.get(key)?.id !== r.id && !prevByPromptLlm.has(key)) {
      prevByPromptLlm.set(key, r);
    }
  }

  const enriched = prompts.map(p => {
    const llms = p.llms.split(",").map(l => l.trim()).filter(Boolean);
    const results = llms.map(llm => {
      const key = `${p.id}:${llm}`;
      const latest = latestByPromptLlm.get(key) ?? null;
      const prev = prevByPromptLlm.get(key) ?? null;
      let trend: "up" | "down" | "flat" = "flat";
      if (latest && prev) {
        if (!prev.mentioned && latest.mentioned) trend = "up";
        else if (prev.mentioned && !latest.mentioned) trend = "down";
        else if (latest.mentioned && prev.mentioned && latest.position !== null && prev.position !== null) {
          if (latest.position < prev.position) trend = "up";
          else if (latest.position > prev.position) trend = "down";
        }
      }
      return { llm, result: latest, trend };
    });
    return { ...p, llmsArray: llms, results };
  });

  res.json({ prompts: enriched, limit: PLAN_LIMITS[user.plan ?? "free"] ?? 5 });
});

// ─── Add prompt ───────────────────────────────────────────────────────────────
router.post("/answer-monitoring/prompts", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const { domain, prompt, llms } = req.body as { domain?: string; prompt?: string; llms?: string[] };

  if (!domain || !prompt?.trim()) {
    res.status(400).json({ error: "domain and prompt are required" });
    return;
  }

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const cleanLlms = Array.isArray(llms) && llms.length > 0
    ? llms.filter(l => ALL_LLMS.includes(l))
    : ["ChatGPT"];

  const limit = PLAN_LIMITS[user.plan ?? "free"] ?? 5;
  const existing = await db
    .select({ id: answerMonitoringPromptsTable.id })
    .from(answerMonitoringPromptsTable)
    .where(and(eq(answerMonitoringPromptsTable.userId, user.id), eq(answerMonitoringPromptsTable.active, true)));

  if (existing.length >= limit) {
    res.status(403).json({ error: `Plan limit reached. Your ${user.plan ?? "free"} plan allows ${limit} tracked prompts.`, limitReached: true });
    return;
  }

  const [inserted] = await db
    .insert(answerMonitoringPromptsTable)
    .values({ userId: user.id, domain: cleanDomain, prompt: prompt.trim(), llms: cleanLlms.join(",") })
    .returning();

  res.json({ prompt: inserted });
});

// ─── Delete prompt ────────────────────────────────────────────────────────────
router.delete("/answer-monitoring/prompts/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const promptId = String(req.params.id ?? "");
  await db
    .update(answerMonitoringPromptsTable)
    .set({ active: false })
    .where(and(eq(answerMonitoringPromptsTable.id, promptId), eq(answerMonitoringPromptsTable.userId, user.id)));
  res.json({ ok: true });
});

// ─── Check one prompt (all its LLMs) ─────────────────────────────────────────
router.post("/answer-monitoring/check/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const promptId = String(req.params.id ?? "");
  const [tracked] = await db
    .select()
    .from(answerMonitoringPromptsTable)
    .where(and(eq(answerMonitoringPromptsTable.id, promptId), eq(answerMonitoringPromptsTable.userId, user.id)))
    .limit(1);

  if (!tracked) { res.status(404).json({ error: "Prompt not found" }); return; }

  const llms = tracked.llms.split(",").map(l => l.trim()).filter(Boolean);
  const brandName = extractBrandName(tracked.domain);

  logger.info({ promptId: tracked.id, llms, domain: tracked.domain }, "answer-monitoring: checking prompt");

  const checkOne = async (llm: string) => {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `Simulate how ${llm} would answer this query, then analyze the response for brand visibility.

Query: "${tracked.prompt}"
Brand to check: ${brandName} (domain: ${tracked.domain})

Instructions:
1. Write a realistic ${llm} response to the query (2-4 sentences). Mention ${brandName} if it genuinely belongs in the answer.
2. Analyze the response.

Return ONLY this JSON, no markdown:
{
  "fullResponse": "the simulated AI response",
  "mentioned": true or false,
  "position": 2,
  "brandContext": "exact sentence mentioning the brand, or null",
  "sentiment": "positive",
  "urlCited": false
}

position = which number the brand is mentioned among all brands/tools (1 = first). null if not mentioned.
sentiment = positive, neutral, or negative (about the brand). null if not mentioned.
urlCited = true if ${tracked.domain} URL is included in the response.`,
        }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      type CheckResult = { fullResponse: string; mentioned: boolean; position: number | null; brandContext: string | null; sentiment: string; urlCited: boolean };
      const parsed = parseJSON<CheckResult>(text);
      if (!parsed) return null;

      const [saved] = await db
        .insert(answerMonitoringResultsTable)
        .values({
          promptId: tracked.id,
          userId: user.id,
          domain: tracked.domain,
          llm,
          mentioned: parsed.mentioned ?? false,
          position: parsed.position ?? null,
          fullResponse: parsed.fullResponse ?? null,
          brandContext: parsed.brandContext ?? null,
          sentiment: parsed.sentiment ?? "neutral",
          urlCited: parsed.urlCited ?? false,
        })
        .returning();

      return { llm, result: saved };
    } catch (err) {
      logger.error({ err, llm, promptId: tracked.id }, "answer-monitoring: check failed for LLM");
      return null;
    }
  };

  const results = await Promise.all(llms.map(checkOne));
  logger.info({ promptId: tracked.id, checked: results.filter(Boolean).length }, "answer-monitoring: check complete");

  res.json({ results: results.filter(Boolean) });
});

// ─── Suggest prompts for domain ───────────────────────────────────────────────
router.get("/answer-monitoring/suggest", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const domain = ((req.query.domain as string) ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

  const brandName = extractBrandName(domain);

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Generate 5 buyer prompts someone would type into ChatGPT, Gemini, or Perplexity when looking for a product like ${brandName} (${domain}).

These should be queries where ${brandName} could realistically appear in AI responses.
Mix: comparison queries, use-case queries, category-level queries.

Return ONLY a JSON array of 5 strings. No markdown. No backticks.`,
      }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const suggestions = parseJSON<string[]>(text) ?? [];
    res.json({ suggestions: suggestions.slice(0, 5) });
  } catch (err) {
    logger.error({ err, domain }, "answer-monitoring: suggest failed");
    res.json({ suggestions: [] });
  }
});

export { router as answerMonitoringRouter };

// ─── Daily check function (called by scheduler) ───────────────────────────────
export async function runDailyPromptChecks(): Promise<Map<string, { improved: { prompt: string; llm: string; from: string; to: string }[]; dropped: { prompt: string; llm: string }[]; unchanged: { prompt: string; llm: string; position: number | null }[] }>> {
  const userChanges = new Map<string, { improved: { prompt: string; llm: string; from: string; to: string }[]; dropped: { prompt: string; llm: string }[]; unchanged: { prompt: string; llm: string; position: number | null }[] }>();

  const allPrompts = await db
    .select()
    .from(answerMonitoringPromptsTable)
    .where(eq(answerMonitoringPromptsTable.active, true));

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map(u => [u.id, u]));

  for (const tracked of allPrompts) {
    const llms = tracked.llms.split(",").map(l => l.trim()).filter(Boolean);
    const brandName = extractBrandName(tracked.domain);
    const user = userMap.get(tracked.userId);
    if (!user) continue;

    if (!userChanges.has(user.id)) {
      userChanges.set(user.id, { improved: [], dropped: [], unchanged: [] });
    }
    const changes = userChanges.get(user.id)!;

    for (const llm of llms) {
      try {
        const [prev] = await db
          .select()
          .from(answerMonitoringResultsTable)
          .where(and(
            eq(answerMonitoringResultsTable.promptId, tracked.id),
            eq(answerMonitoringResultsTable.llm, llm),
          ))
          .orderBy(desc(answerMonitoringResultsTable.checkedAt))
          .limit(1);

        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Simulate how ${llm} would answer: "${tracked.prompt}"
Brand: ${brandName} (${tracked.domain})
Return ONLY JSON: {"fullResponse":"...","mentioned":true,"position":2,"brandContext":"...","sentiment":"positive","urlCited":false}`,
          }],
        });

        const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
        type CheckResult = { fullResponse: string; mentioned: boolean; position: number | null; brandContext: string | null; sentiment: string; urlCited: boolean };
        const parsed = parseJSON<CheckResult>(text);
        if (!parsed) continue;

        await db.insert(answerMonitoringResultsTable).values({
          promptId: tracked.id,
          userId: tracked.userId,
          domain: tracked.domain,
          llm,
          mentioned: parsed.mentioned ?? false,
          position: parsed.position ?? null,
          fullResponse: parsed.fullResponse ?? null,
          brandContext: parsed.brandContext ?? null,
          sentiment: parsed.sentiment ?? "neutral",
          urlCited: parsed.urlCited ?? false,
        });

        const label = tracked.prompt.length > 55 ? tracked.prompt.slice(0, 52) + "..." : tracked.prompt;

        if (!prev) {
          if (parsed.mentioned) changes.unchanged.push({ prompt: label, llm, position: parsed.position ?? null });
        } else if (!prev.mentioned && parsed.mentioned) {
          changes.improved.push({ prompt: label, llm, from: "Not mentioned", to: `Position ${parsed.position ?? "?"}` });
        } else if (prev.mentioned && !parsed.mentioned) {
          changes.dropped.push({ prompt: label, llm });
        } else if (prev.mentioned && parsed.mentioned) {
          const prevPos = prev.position ?? 99;
          const newPos = parsed.position ?? 99;
          if (newPos < prevPos) {
            changes.improved.push({ prompt: label, llm, from: `Position ${prevPos}`, to: `Position ${newPos}` });
          } else if (newPos > prevPos) {
            changes.dropped.push({ prompt: label, llm });
          } else {
            changes.unchanged.push({ prompt: label, llm, position: parsed.position ?? null });
          }
        } else {
          changes.unchanged.push({ prompt: label, llm, position: null });
        }

        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        logger.error({ err, promptId: tracked.id, llm }, "answer-monitoring: daily check failed");
      }
    }
  }

  return userChanges;
}

export default router;
