import { Router, type IRouter } from "express";
import { db, monitoredBrandsTable, dailyScoresTable, auditsTable, keywordCacheTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { AddMonitoredBrandBody, RemoveMonitoredBrandParams } from "@workspace/api-zod";
import { requirePaidAuth, type AuthRequest } from "../lib/auth";
import { runAuditEngine, generateRecommendations, detectBrandSubcategory } from "../lib/audit-engine";
import { getDomainKeywords, isGenericAiOnly, getLocationCode } from "../lib/dataforseo";

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
      subcategory: brand.subcategory,
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

  const brandLimit = user.plan === "agency" ? 999 : user.plan === "starter" ? 1 : 0;
  const [{ value: brandCount }] = await db.select({ value: count() }).from(monitoredBrandsTable).where(eq(monitoredBrandsTable.userId, user.id));
  if (brandCount >= brandLimit) {
    res.status(403).json({ error: `Your ${user.plan} plan allows ${brandLimit} brand${brandLimit === 1 ? "" : "s"}. Upgrade to Agency to monitor more brands.` });
    return;
  }

  const raw = parsed.data;
  const domain = raw.domain.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]!.toLowerCase();
  const { brandName, category, market, keywords, competitors } = raw;

  const competitorLimit = user.plan === "agency" ? 999 : user.plan === "starter" ? 3 : 0;
  if (competitors && competitors.length > competitorLimit) {
    res.status(403).json({ error: `Your ${user.plan} plan allows tracking ${competitorLimit} competitors. ${user.plan === "starter" ? "Upgrade to Agency for more." : "Contact us for more."}` });
    return;
  }

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

    const url = `https://${brand.domain}`;
    const engineResult = await runAuditEngine(url, brand.brandName, brand.category, brand.market);

    if (engineResult.unreachable) {
      res.status(422).json({ error: "We could not reach this domain. Check the URL and try again.", reachable: false });
      return;
    }

    const {
      brandName, subcategory, category, market,
      chatgpt, gemini, perplexity, claude, grok,
      keywordsUsed, keywordsFromDataforseo, keywordsFilteredOut,
      rawChatgptResponse, rawGeminiResponse, rawPerplexityResponse, rawClaudeResponse, rawGrokResponse,
      technicalAudit,
    } = engineResult;

    // AI visibility is based on the 3 primary engines (ChatGPT, Gemini, Perplexity).
    // Claude and Grok are supplemental - omitting them from the denominator prevents
    // simulated/absent engines from dragging the score down.
    const rawAiTotal = chatgpt.score + gemini.score + perplexity.score;
    const aiVisibilityScore = Math.min(Math.round(rawAiTotal * 100 / (3 * 33)), 100);
    const scoreTechnical = technicalAudit.overallScore;
    const scoreTotal = Math.round(aiVisibilityScore * 0.6 + scoreTechnical * 0.4);

    const allCompetitors = [...new Set([
      ...chatgpt.competitors, ...gemini.competitors, ...perplexity.competitors,
      ...claude.competitors, ...grok.competitors,
    ])];

    const { recommendations, eeatScore } = await generateRecommendations(
      brandName, brand.domain, category, market, chatgpt, gemini, perplexity, technicalAudit,
    );

    // Save to audits table (so GEO Agent can access the latest data)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    await db.insert(auditsTable).values({
      url, domain: brand.domain, brandName, category, market, scoreTotal,
      scoreChatgpt: chatgpt.score, scoreGemini: gemini.score, scorePerplexity: perplexity.score,
      chatgptFound: chatgpt.found, geminiFound: gemini.found, perplexityFound: perplexity.found,
      chatgptDetail: chatgpt.detail, geminiDetail: gemini.detail, perplexityDetail: perplexity.detail,
      competitorsFound: allCompetitors, keywordsUsed,
      rawResults: {
        keywordsFromDataforseo, keywordsFilteredOut,
        scoreAiVisibility: aiVisibilityScore, scoreTechnical,
        scoreClaude: claude.score, scoreGrok: grok.score,
        claudeFound: claude.found, grokFound: grok.found,
        claudeDetail: claude.detail, grokDetail: grok.detail,
        chatgptRawResponse: rawChatgptResponse, geminiRawResponse: rawGeminiResponse,
        perplexityRawResponse: rawPerplexityResponse, claudeRawResponse: rawClaudeResponse,
        grokRawResponse: rawGrokResponse, technicalAudit, eeatScore,
      },
      recommendations: recommendations as unknown as Record<string, unknown>[],
      ipAddress: ip,
    });

    // Update daily score
    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await db
      .select({ id: dailyScoresTable.id })
      .from(dailyScoresTable)
      .where(and(eq(dailyScoresTable.brandId, brand.id), eq(dailyScoresTable.date, today)))
      .limit(1);

    if (existing) {
      await db.update(dailyScoresTable)
        .set({ scoreTotal, scoreChatgpt: chatgpt.score, scoreGemini: gemini.score, scorePerplexity: perplexity.score, scoreClaude: claude.score, scoreGrok: grok.score })
        .where(eq(dailyScoresTable.id, existing.id));
    } else {
      await db.insert(dailyScoresTable).values({
        brandId: brand.id, date: today, scoreTotal,
        scoreChatgpt: chatgpt.score, scoreGemini: gemini.score, scorePerplexity: perplexity.score,
        scoreClaude: claude.score, scoreGrok: grok.score,
      });
    }

    await db.update(monitoredBrandsTable)
      .set({ lastChecked: new Date(), subcategory: subcategory || null })
      .where(eq(monitoredBrandsTable.id, brand.id));

    req.log.info({ domain: brand.domain, scoreTotal, aiVisibilityScore, scoreTechnical }, "Brand scan complete");

    res.json({
      domain: brand.domain,
      brandName,
      category,
      market,
      scoreTotal,
      scoreAiVisibility: aiVisibilityScore,
      scoreTechnical,
      scoreChatgpt: chatgpt.score,
      scoreGemini: gemini.score,
      scorePerplexity: perplexity.score,
      scoreClaude: claude.score,
      scoreGrok: grok.score,
      chatgptFound: chatgpt.found,
      geminiFound: gemini.found,
      perplexityFound: perplexity.found,
      claudeFound: claude.found,
      grokFound: grok.found,
      chatgptDetail: chatgpt.detail,
      geminiDetail: gemini.detail,
      perplexityDetail: perplexity.detail,
      claudeDetail: claude.detail,
      grokDetail: grok.detail,
      rawChatgptResponse,
      rawGeminiResponse,
      rawPerplexityResponse,
      rawClaudeResponse,
      rawGrokResponse,
      technicalAudit,
      eeatScore,
      recommendations,
      keywordsUsed,
      competitors: allCompetitors,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err, domain: brand.domain }, "Brand scan failed");
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

router.patch("/dashboard/brands/:id", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!rawId) { res.status(400).json({ error: "Invalid brand ID" }); return; }

  const [brand] = await db.select().from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, rawId), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const { brandName, category, market } = req.body as { brandName?: string; category?: string; market?: string };
  const [updated] = await db.update(monitoredBrandsTable)
    .set({
      ...(brandName !== undefined ? { brandName: brandName.trim() || null } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(market !== undefined ? { market } : {}),
    })
    .where(eq(monitoredBrandsTable.id, rawId))
    .returning();

  res.json({ id: updated!.id, brandName: updated!.brandName, category: updated!.category, market: updated!.market });
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

router.get("/dashboard/brands/:id/technical-checks", requirePaidAuth, async (req, res): Promise<void> => {
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

  const [latestAudit] = await db.select()
    .from(auditsTable)
    .where(eq(auditsTable.domain, brand.domain))
    .orderBy(desc(auditsTable.createdAt))
    .limit(1);

  if (!latestAudit) {
    res.json({ checks: [], overallScore: 0 });
    return;
  }

  const raw = (latestAudit.rawResults ?? {}) as Record<string, unknown>;
  const techAudit = raw.technicalAudit as {
    checks?: { name: string; score: number; status: string; detail: string }[];
    overallScore?: number;
  } | null;

  res.json({
    checks: techAudit?.checks ?? [],
    overallScore: techAudit?.overallScore ?? 0,
    auditDate: latestAudit.createdAt,
  });
});

router.patch("/dashboard/brands/:id/competitors", requirePaidAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { competitors } = req.body as { competitors?: string[] };

  if (!Array.isArray(competitors)) {
    res.status(400).json({ error: "competitors must be an array" });
    return;
  }

  const [brand] = await db
    .select()
    .from(monitoredBrandsTable)
    .where(and(eq(monitoredBrandsTable.id, rawId!), eq(monitoredBrandsTable.userId, user.id)))
    .limit(1);

  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const clean = competitors.map(c => c.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!.trim()).filter(Boolean);

  await db.update(monitoredBrandsTable).set({ competitors: clean }).where(eq(monitoredBrandsTable.id, brand.id));
  res.json({ competitors: clean });
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

  // Check cache — filter out generic AI terms before deciding if it's usable
  const [cache] = await db.select().from(keywordCacheTable).where(eq(keywordCacheTable.domain, brand.domain)).limit(1);
  const now = new Date();
  const cacheValid = cache && cache.expiresAt > now;
  const cachedGoodKeywords = cacheValid
    ? cache.keywords.filter(k => !isGenericAiOnly(k.keyword))
    : [];

  if (cachedGoodKeywords.length >= 3) {
    res.json(cachedGoodKeywords.slice(0, 15).map((kw) => ({
      keyword: kw.keyword,
      volume: kw.volume,
      competition: kw.competition,
      chatgptVisible,
      geminiVisible,
      perplexityVisible,
    })));
    return;
  }

  // Determine the specific product niche for keyword_suggestions seed.
  // brand.subcategory is set by regenerate-prompts (e.g. "AI visibility tracking").
  // If not yet set, detect it now by crawling the site — one-time cost, saved for future loads.
  let niche = brand.subcategory ?? undefined;
  if (!niche) {
    try {
      const { subcategory } = await detectBrandSubcategory(
        `https://${brand.domain}`,
        brand.brandName,
        brand.category,
        brand.market,
      );
      if (subcategory) {
        niche = subcategory;
        // Save for future loads so we don't re-crawl on every keyword refresh
        await db.update(monitoredBrandsTable)
          .set({ subcategory })
          .where(eq(monitoredBrandsTable.id, brand.id))
          .catch(() => {});
        req.log.info({ domain: brand.domain, subcategory }, "keywords: detected subcategory");
      }
    } catch {
      // Non-fatal — falls back to category or no niche
    }
    // Last resort seed: use the broad category if subcategory detection failed
    niche = niche ?? brand.category ?? undefined;
  }

  // Cache is empty, expired, or had only generic AI terms — fetch fresh keywords.
  // getDomainKeywords: ranked_keywords -> keyword_suggestions(niche) -> keywords_for_site
  const freshKeywords = await getDomainKeywords(brand.domain, niche);

  if (freshKeywords.length >= 1) {
    // Update cache with the clean keywords so future loads are fast
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const locationCode = getLocationCode(brand.domain);
    await db
      .insert(keywordCacheTable)
      .values({ domain: brand.domain, keywords: freshKeywords, locationCode, cachedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: keywordCacheTable.domain,
        set: { keywords: freshKeywords, cachedAt: now, expiresAt },
      })
      .catch(() => {});

    req.log.info({ domain: brand.domain, count: freshKeywords.length, niche }, "keywords: refreshed cache");

    res.json(freshKeywords.slice(0, 15).map((kw) => ({
      keyword: kw.keyword,
      volume: kw.volume,
      competition: kw.competition ?? 0,
      chatgptVisible,
      geminiVisible,
      perplexityVisible,
    })));
    return;
  }

  // Final fallback: use prompts from the most recent audit
  const [latestAudit] = await db
    .select({ keywordsUsed: auditsTable.keywordsUsed })
    .from(auditsTable)
    .where(eq(auditsTable.domain, brand.domain))
    .orderBy(desc(auditsTable.createdAt))
    .limit(1);

  if (!latestAudit?.keywordsUsed?.length) {
    res.json([]);
    return;
  }

  res.json(latestAudit.keywordsUsed.map((kw) => ({
    keyword: kw,
    volume: 0,
    competition: null,
    chatgptVisible,
    geminiVisible,
    perplexityVisible,
  })));
});

router.post("/dashboard/brands/:id/regenerate-prompts", requirePaidAuth, async (req, res): Promise<void> => {
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
    const { subcategory, prompts } = await detectBrandSubcategory(
      `https://${brand.domain}`,
      brand.brandName,
      brand.category,
      brand.market,
    );

    // Persist subcategory on the brand
    await db.update(monitoredBrandsTable)
      .set({ subcategory: subcategory || null })
      .where(eq(monitoredBrandsTable.id, brand.id));

    // Persist the new prompts into keyword_cache so the /keywords endpoint
    // returns them immediately on the next load (replaces stale DataForSEO cache).
    const promptKeywords = prompts.map((p) => ({ keyword: p, volume: 0, competition: 0 }));
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db
      .insert(keywordCacheTable)
      .values({ domain: brand.domain, keywords: promptKeywords, locationCode: 2356, cachedAt: new Date(), expiresAt })
      .onConflictDoUpdate({
        target: keywordCacheTable.domain,
        set: { keywords: promptKeywords, cachedAt: new Date(), expiresAt },
      });

    req.log.info({ domain: brand.domain, subcategory, promptCount: prompts.length }, "Prompts regenerated and cached");
    res.json({ subcategory, prompts });
  } catch (err) {
    req.log.error({ err, domain: brand.domain }, "Failed to regenerate prompts");
    res.status(500).json({ error: "Failed to regenerate prompts. Please try again." });
  }
});

export default router;
