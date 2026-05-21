import { Router, type IRouter } from "express";
import { db, dailyScoresTable, monitoredBrandsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { GetBrandScoresParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/scores/:brandId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.brandId) ? req.params.brandId[0] : req.params.brandId;
  const params = GetBrandScoresParams.safeParse({ brandId: rawId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid brand ID" });
    return;
  }

  const [brand] = await db.select().from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, params.data.brandId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const scores = await db.select().from(dailyScoresTable)
    .where(eq(dailyScoresTable.brandId, params.data.brandId))
    .orderBy(asc(dailyScoresTable.date))
    .limit(30);

  res.json(scores.map(s => ({
    id: s.id,
    brandId: s.brandId,
    date: s.date,
    scoreTotal: s.scoreTotal,
    scoreChatgpt: s.scoreChatgpt,
    scoreGemini: s.scoreGemini,
    scorePerplexity: s.scorePerplexity,
    recommendations: s.recommendations,
  })));
});

export default router;
