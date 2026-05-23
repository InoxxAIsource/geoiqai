import { Router, type IRouter } from "express";
import { db, monitoredBrandsTable, dailyScoresTable, auditsTable, keywordCacheTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { AddMonitoredBrandBody, RemoveMonitoredBrandParams } from "@workspace/api-zod";
import { requirePaidAuth, type AuthRequest } from "../lib/auth";
import { runAuditEngine } from "../lib/audit-engine";

const router: IRouter = Router();

router.get("/dashboard/brands", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const brands = await db.select().from(monitoredBrandsTable)
    .where(eq(monitoredBrandsTable.userId, user.id))
    .orderBy(desc(monitoredBrandsTable.createdAt));

  const brandsWithScores = await Promise.all(brands.map(async (brand) => {
    const [latestScore] = await db.select().from(dailyScoresTable)
      .where(eq(dailyScoresTable.brandId, brand.id))
      .orderBy(desc(dailyScoresTable.date))
      .limit(1);

    return {
      id: brand.id,
      domain: brand.domain,
      brandName: brand.brandName,
      category: brand.category,
      market: brand.market,
      keywords: brand.keywords,
      competitors: brand.competitors,
      latestScore: latestScore?.scoreTotal ?? null,
      latestScoreChatgpt: latestScore?.scoreChatgpt ?? null,
      latestScoreGemini: latestScore?.scoreGemini ?? null,
      latestScorePerplexity: latestScore?.scorePerplexity ?? null,
      lastChecked: brand.lastChecked?.toISOString() ?? null,
      createdAt: brand.createdAt.toISOString(),
    };
  }));

  res.json(brandsWithScores);
});

router.post("/dashboard/brands", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = AddMonitoredBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { domain, brandName, category, market, keywords, competitors } = parsed.data;

  const [brand] = await db.insert(monitoredBrandsTable).values({
    userId: user.id,
    domain,
    brandName: brandName ?? null,
    category: category ?? null,
    market: market ?? null,
    keywords: keywords ?? [],
    competitors: competitors ?? [],
  }).returning();

  res.status(201).json({
    id: brand!.id,
    domain: brand!.domain,
    brandName: brand!.brandName,
    category: brand!.category,
    market: brand!.market,
    keywords: brand!.keywords,
    competitors: brand!.competitors,
    latestScore: null,
    latestScoreChatgpt: null,
    latestScoreGemini: null,
    latestScorePerplexity: null,
    lastChecked: null,
    createdAt: brand!.createdAt.toISOString(),
  });
});

router.post("/dashboard/brands/:id/scan", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, rawId!), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  try {
    req.log.info({ domain: brand.domain }, "Starting brand scan");

    const engineResult = await runAuditEngine(
      `https://${brand.domain}`,
      brand.brandName,
      brand.category,
      brand.market,
    );

    const { chatgpt, gemini, perplexity } = engineResult;
    const scoreTotal = Math.min(chatgpt.score + gemini.score + perplexity.score, 100);
    const today = new Date().toISOString().slice(0, 10);

    const [existing] = await db
      .select({ id: dailyScoresTable.id })
      .from(dailyScoresTable)
      .where(and(eq(dailyScoresTable.brandId, brand.id), eq(dailyScoresTable.date, today)))
      .limit(1);

    if (existing) {
      await db
        .update(dailyScoresTable)
        .set({
          scoreTotal,
          scoreChatgpt: chatgpt.score,
          scoreGemini: gemini.score,
          scorePerplexity: perplexity.score,
        })
        .where(eq(dailyScoresTable.id, existing.id));
    } else {
      await db.insert(dailyScoresTable).values({
        brandId: brand.id,
        date: today,
        scoreTotal,
        scoreChatgpt: chatgpt.score,
        scoreGemini: gemini.score,
        scorePerplexity: perplexity.score,
      });
    }

    await db
      .update(monitoredBrandsTable)
      .set({ lastChecked: new Date() })
      .where(eq(monitoredBrandsTable.id, brand.id));

    const allCompetitors = [...new Set([
      ...chatgpt.competitors,
      ...gemini.competitors,
      ...perplexity.competitors,
    ])];

    req.log.info({ domain: brand.domain, scoreTotal }, "Brand scan complete");

    res.json({
      scoreTotal,
      scoreChatgpt: chatgpt.score,
      scoreGemini: gemini.score,
      scorePerplexity: perplexity.score,
      chatgptFound: chatgpt.found,
      geminiFound: gemini.found,
      perplexityFound: perplexity.found,
      rawChatgptResponse: engineResult.rawChatgptResponse,
      rawGeminiResponse: engineResult.rawGeminiResponse,
      rawPerplexityResponse: engineResult.rawPerplexityResponse,
      keywordsUsed: engineResult.keywordsUsed,
      competitors: allCompetitors,
    });
  } catch (err) {
    req.log.error({ err, domain: brand.domain }, "Brand scan failed");
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

router.delete("/dashboard/brands/:id", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RemoveMonitoredBrandParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid brand ID" });
    return;
  }

  const [brand] = await db.select().from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, params.data.id), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  await db.delete(monitoredBrandsTable).where(eq(monitoredBrandsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/dashboard/summary", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;

  const brands = await db.select().from(monitoredBrandsTable)
    .where(eq(monitoredBrandsTable.userId, user.id));

  const [auditCountResult] = await db.select({ count: count() }).from(auditsTable);
  const totalAuditsRun = auditCountResult?.count ?? 0;

  if (brands.length === 0) {
    res.json({ totalBrands: 0, avgScore: 0, brandsWithImprovement: 0, totalAuditsRun: Number(totalAuditsRun), topBrand: null, topBrandScore: null });
    return;
  }

  let topBrand: string | null = null;
  let topBrandScore: number | null = null;
  let totalScore = 0;
  let brandsWithScore = 0;
  let brandsWithImprovement = 0;

  for (const brand of brands) {
    const scores = await db.select().from(dailyScoresTable)
      .where(eq(dailyScoresTable.brandId, brand.id))
      .orderBy(desc(dailyScoresTable.date))
      .limit(2);

    if (scores.length > 0 && scores[0]) {
      totalScore += scores[0].scoreTotal;
      brandsWithScore++;
      if (topBrandScore === null || scores[0].scoreTotal > topBrandScore) {
        topBrand = brand.brandName ?? brand.domain;
        topBrandScore = scores[0].scoreTotal;
      }
      if (scores.length === 2 && scores[1] && scores[0].scoreTotal > scores[1].scoreTotal) {
        brandsWithImprovement++;
      }
    }
  }

  res.json({
    totalBrands: brands.length,
    avgScore: brandsWithScore > 0 ? Math.round(totalScore / brandsWithScore) : 0,
    brandsWithImprovement,
    totalAuditsRun: Number(totalAuditsRun),
    topBrand,
    topBrandScore,
  });
});

router.get("/dashboard/brands/:id/keywords", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, rawId!), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const [latestScore] = await db.select().from(dailyScoresTable)
    .where(eq(dailyScoresTable.brandId, brand.id))
    .orderBy(desc(dailyScoresTable.date))
    .limit(1);

  const chatgptVisible = (latestScore?.scoreChatgpt ?? 0) > 0;
  const geminiVisible = (latestScore?.scoreGemini ?? 0) > 0;
  const perplexityVisible = (latestScore?.scorePerplexity ?? 0) > 0;

  const [cache] = await db.select().from(keywordCacheTable).where(eq(keywordCacheTable.domain, brand.domain)).limit(1);

  if (!cache || cache.keywords.length === 0) {
    res.json([]);
    return;
  }

  res.json(cache.keywords.map((kw) => ({
    keyword: kw.keyword,
    volume: kw.volume,
    competition: kw.competition,
    chatgptVisible,
    geminiVisible,
    perplexityVisible,
  })));
});

export default router;
