import { Router, type IRouter } from "express";
import { db, auditsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  RunAuditBody,
  GetAuditParams,
} from "@workspace/api-zod";
import { runAuditEngine, generateRecommendations, extractDomain } from "../lib/audit-engine";

const router: IRouter = Router();

router.post("/audit", async (req, res): Promise<void> => {
  const parsed = RunAuditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, brandName: brandNameOverride, category: categoryOverride, market: marketOverride } = parsed.data;
  const domain = extractDomain(url);

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? "unknown";

  try {
    const engineResult = await runAuditEngine(
      url,
      brandNameOverride ?? null,
      categoryOverride ?? null,
      marketOverride ?? null,
    );
    const { brandName, category, market, chatgpt, gemini, perplexity, keywordsUsed } = engineResult;

    const scoreTotal = Math.min(chatgpt.score + gemini.score + perplexity.score, 100);
    const allCompetitors = [...new Set([...chatgpt.competitors, ...gemini.competitors, ...perplexity.competitors])];

    const recommendations = await generateRecommendations(
      brandName,
      domain,
      category,
      market,
      chatgpt,
      gemini,
      perplexity,
    );

    const [audit] = await db.insert(auditsTable).values({
      url,
      domain,
      brandName,
      category,
      market,
      scoreTotal,
      scoreChatgpt: chatgpt.score,
      scoreGemini: gemini.score,
      scorePerplexity: perplexity.score,
      chatgptFound: chatgpt.found,
      geminiFound: gemini.found,
      perplexityFound: perplexity.found,
      chatgptDetail: chatgpt.detail,
      geminiDetail: gemini.detail,
      perplexityDetail: perplexity.detail,
      competitorsFound: allCompetitors,
      keywordsUsed,
      recommendations: recommendations as unknown as Record<string, unknown>[],
      ipAddress: ip,
    }).returning();

    res.json({
      id: audit!.id,
      url: audit!.url,
      domain: audit!.domain,
      brandName: audit!.brandName,
      category: audit!.category,
      market: audit!.market,
      scoreTotal: audit!.scoreTotal,
      scoreChatgpt: audit!.scoreChatgpt,
      scoreGemini: audit!.scoreGemini,
      scorePerplexity: audit!.scorePerplexity,
      chatgptFound: audit!.chatgptFound,
      geminiFound: audit!.geminiFound,
      perplexityFound: audit!.perplexityFound,
      chatgptDetail: audit!.chatgptDetail,
      geminiDetail: audit!.geminiDetail,
      perplexityDetail: audit!.perplexityDetail,
      competitorsFound: audit!.competitorsFound,
      keywordsUsed: audit!.keywordsUsed,
      recommendations,
      createdAt: audit!.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Audit failed");
    res.status(500).json({ error: "Audit failed" });
  }
});

router.get("/audit/recent", async (req, res): Promise<void> => {
  try {
    const audits = await db.select({
      id: auditsTable.id,
      domain: auditsTable.domain,
      brandName: auditsTable.brandName,
      scoreTotal: auditsTable.scoreTotal,
      scoreChatgpt: auditsTable.scoreChatgpt,
      scoreGemini: auditsTable.scoreGemini,
      scorePerplexity: auditsTable.scorePerplexity,
      chatgptFound: auditsTable.chatgptFound,
      geminiFound: auditsTable.geminiFound,
      perplexityFound: auditsTable.perplexityFound,
      createdAt: auditsTable.createdAt,
    }).from(auditsTable)
      .orderBy(desc(auditsTable.createdAt))
      .limit(10);

    res.json(audits.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent audits");
    res.status(500).json({ error: "Failed to fetch recent audits" });
  }
});

router.get("/audit/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAuditParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid audit ID" });
    return;
  }

  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, params.data.id)).limit(1);
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.json({
    id: audit.id,
    url: audit.url,
    domain: audit.domain,
    brandName: audit.brandName,
    category: audit.category,
    market: audit.market,
    scoreTotal: audit.scoreTotal,
    scoreChatgpt: audit.scoreChatgpt,
    scoreGemini: audit.scoreGemini,
    scorePerplexity: audit.scorePerplexity,
    chatgptFound: audit.chatgptFound,
    geminiFound: audit.geminiFound,
    perplexityFound: audit.perplexityFound,
    chatgptDetail: audit.chatgptDetail,
    geminiDetail: audit.geminiDetail,
    perplexityDetail: audit.perplexityDetail,
    competitorsFound: audit.competitorsFound,
    keywordsUsed: audit.keywordsUsed,
    recommendations: audit.recommendations,
    createdAt: audit.createdAt.toISOString(),
  });
});

export default router;
