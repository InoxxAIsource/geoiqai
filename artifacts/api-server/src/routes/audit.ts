import { Router, type IRouter } from "express";
import { db, auditsTable } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import {
  RunAuditBody,
  GetAuditParams,
} from "@workspace/api-zod";
import { runAuditEngine, generateRecommendations, extractDomain } from "../lib/audit-engine";

const router: IRouter = Router();

/** Serialize an audit row to the API response shape. */
function serializeAudit(
  audit: typeof auditsTable.$inferSelect,
  extra?: { fromCache: boolean; cachedHoursAgo?: number },
) {
  const raw = (audit.rawResults ?? {}) as Record<string, unknown>;
  return {
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
    keywordsFromDataforseo: typeof raw.keywordsFromDataforseo === "number" ? raw.keywordsFromDataforseo : 0,
    keywordsFilteredOut: typeof raw.keywordsFilteredOut === "number" ? raw.keywordsFilteredOut : 0,
    recommendations: audit.recommendations,
    createdAt: audit.createdAt.toISOString(),
    fromCache: extra?.fromCache ?? false,
    cachedHoursAgo: extra?.cachedHoursAgo,
  };
}

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
    // --- Cache check: return existing audit if within 24 hours ---
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [cachedAudit] = await db
      .select()
      .from(auditsTable)
      .where(and(eq(auditsTable.domain, domain), gt(auditsTable.createdAt, cutoff)))
      .orderBy(desc(auditsTable.createdAt))
      .limit(1);

    if (cachedAudit) {
      const hoursAgo = Math.floor((Date.now() - cachedAudit.createdAt.getTime()) / (60 * 60 * 1000));
      req.log.info(
        { domain, cachedAuditId: cachedAudit.id, hoursAgo },
        `${domain} — returning cached audit (${hoursAgo}h ago)`,
      );
      console.log(`[Audit cache] ${domain} — returning cached audit (${hoursAgo}h ago) — DataForSEO not called`);
      res.json(serializeAudit(cachedAudit, { fromCache: true, cachedHoursAgo: hoursAgo }));
      return;
    }

    // --- Fresh audit ---
    const engineResult = await runAuditEngine(
      url,
      brandNameOverride ?? null,
      categoryOverride ?? null,
      marketOverride ?? null,
    );
    const {
      brandName,
      category,
      market,
      chatgpt,
      gemini,
      perplexity,
      keywordsUsed,
      keywordsFromDataforseo,
      keywordsFilteredOut,
    } = engineResult;

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
      rawResults: {
        keywordsFromDataforseo,
        keywordsFilteredOut,
        keywordsReason: keywordsFilteredOut > 0 ? "branded/informational/navigational" : "none filtered",
      },
      recommendations: recommendations as unknown as Record<string, unknown>[],
      ipAddress: ip,
    }).returning();

    res.json({
      ...serializeAudit(audit!),
      keywordsFromDataforseo,
      keywordsFilteredOut,
      recommendations,
      fromCache: false,
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

  res.json(serializeAudit(audit));
});

export default router;
