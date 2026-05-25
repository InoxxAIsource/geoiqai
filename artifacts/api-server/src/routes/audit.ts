import { Router, type IRouter } from "express";
import { db, auditsTable, rateLimitsTable, emailSubscribersTable, usersTable } from "@workspace/db";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import {
  RunAuditBody,
  GetAuditParams,
} from "@workspace/api-zod";
import { runAuditEngine, generateRecommendations, extractDomain, type TechnicalAuditResult, type EeatScore } from "../lib/audit-engine";
import { verifyToken } from "../lib/auth";

const FREE_IP_AUDITS_PER_DAY = 2;
const FREE_EMAIL_AUDITS_PER_MONTH = 5;

const router: IRouter = Router();

function serializeAudit(
  audit: typeof auditsTable.$inferSelect,
  extra?: { fromCache: boolean; cachedHoursAgo?: number },
) {
  const raw = (audit.rawResults ?? {}) as Record<string, unknown>;
  const aiVisibilityScore = typeof raw.scoreAiVisibility === "number" ? raw.scoreAiVisibility : Math.min(audit.scoreChatgpt + audit.scoreGemini + audit.scorePerplexity, 100);
  const scoreTechnical = typeof raw.scoreTechnical === "number" ? raw.scoreTechnical : 0;
  const eeatScore = (raw.eeatScore ?? null) as EeatScore | null;
  return {
    id: audit.id,
    url: audit.url,
    domain: audit.domain,
    brandName: audit.brandName,
    category: audit.category,
    market: audit.market,
    scoreTotal: audit.scoreTotal,
    scoreAiVisibility: aiVisibilityScore,
    scoreTechnical,
    scoreChatgpt: audit.scoreChatgpt,
    scoreGemini: audit.scoreGemini,
    scorePerplexity: audit.scorePerplexity,
    scoreClaude: typeof raw.scoreClaude === "number" ? raw.scoreClaude : 0,
    scoreGrok: typeof raw.scoreGrok === "number" ? raw.scoreGrok : 0,
    chatgptFound: audit.chatgptFound,
    geminiFound: audit.geminiFound,
    perplexityFound: audit.perplexityFound,
    claudeFound: typeof raw.claudeFound === "boolean" ? raw.claudeFound : false,
    grokFound: typeof raw.grokFound === "boolean" ? raw.grokFound : false,
    chatgptDetail: audit.chatgptDetail,
    geminiDetail: audit.geminiDetail,
    perplexityDetail: audit.perplexityDetail,
    claudeDetail: typeof raw.claudeDetail === "string" ? raw.claudeDetail : null,
    grokDetail: typeof raw.grokDetail === "string" ? raw.grokDetail : null,
    chatgptRawResponse: typeof raw.chatgptRawResponse === "string" ? raw.chatgptRawResponse : null,
    geminiRawResponse: typeof raw.geminiRawResponse === "string" ? raw.geminiRawResponse : null,
    perplexityRawResponse: typeof raw.perplexityRawResponse === "string" ? raw.perplexityRawResponse : null,
    claudeRawResponse: typeof raw.claudeRawResponse === "string" ? raw.claudeRawResponse : null,
    grokRawResponse: typeof raw.grokRawResponse === "string" ? raw.grokRawResponse : null,
    technicalAudit: (raw.technicalAudit ?? null) as TechnicalAuditResult | null,
    competitorsFound: audit.competitorsFound,
    keywordsUsed: audit.keywordsUsed,
    keywordsFromDataforseo: typeof raw.keywordsFromDataforseo === "number" ? raw.keywordsFromDataforseo : 0,
    keywordsFilteredOut: typeof raw.keywordsFilteredOut === "number" ? raw.keywordsFilteredOut : 0,
    recommendations: audit.recommendations,
    eeatScore,
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

  const { url, brandName: brandNameOverride, category: categoryOverride, market: marketOverride, force } = parsed.data;
  const domain = extractDomain(url);
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  const subscriberEmail = (req.headers["x-subscriber-email"] as string)?.trim() ?? "";

  try {
    // Layer 0: Cache check - 24h, never counts against rate limit (skipped when force=true)
    if (!force) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [cachedAudit] = await db
        .select()
        .from(auditsTable)
        .where(and(eq(auditsTable.domain, domain), gt(auditsTable.createdAt, cutoff)))
        .orderBy(desc(auditsTable.createdAt))
        .limit(1);

      if (cachedAudit) {
        const hoursAgo = Math.floor((Date.now() - cachedAudit.createdAt.getTime()) / (60 * 60 * 1000));
        req.log.info({ domain, hoursAgo }, `${domain} - returning cached audit`);
        res.json(serializeAudit(cachedAudit, { fromCache: true, cachedHoursAgo: hoursAgo }));
        return;
      }
    } else {
      req.log.info({ domain }, `${domain} - force refresh requested, skipping cache`);
    }

    // Layer 1: Check for paid user via optional bearer token - skip all limits
    let isPaidUser = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const userId = verifyToken(authHeader.substring(7));
      if (userId) {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (user && user.plan !== "free") {
          isPaidUser = true;
        }
      }
    }

    if (!isPaidUser) {
      // Layer 2: IP rate limit (2 fresh audits per IP per day)
      const today = new Date().toISOString().slice(0, 10);
      const [rateRow] = await db
        .select()
        .from(rateLimitsTable)
        .where(and(eq(rateLimitsTable.ipAddress, ip), eq(rateLimitsTable.date, today)))
        .limit(1);

      const ipCount = rateRow?.auditCount ?? 0;

      if (ipCount >= FREE_IP_AUDITS_PER_DAY) {
        if (!subscriberEmail) {
          // No email - prompt for email capture
          res.status(429).json({
            error: `You have used your ${FREE_IP_AUDITS_PER_DAY} free audits today. Enter your email for ${FREE_EMAIL_AUDITS_PER_MONTH} audits per month free.`,
            rateLimitType: "ip",
            emailRequired: true,
          });
          return;
        }

        // Layer 3: Email subscriber monthly limit (5/month)
        const [subscriber] = await db
          .select()
          .from(emailSubscribersTable)
          .where(eq(emailSubscribersTable.email, subscriberEmail))
          .limit(1);

        if (subscriber) {
          const nowDate = new Date().toISOString().slice(0, 10);
          if (subscriber.auditCountMonth >= FREE_EMAIL_AUDITS_PER_MONTH && subscriber.monthResetDate > nowDate) {
            const resetFormatted = new Date(subscriber.monthResetDate).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
            res.status(429).json({
              error: `You have used all ${FREE_EMAIL_AUDITS_PER_MONTH} free audits this month. Resets on ${resetFormatted}. Upgrade for unlimited.`,
              rateLimitType: "email",
              upgradeRequired: true,
              resetsAt: subscriber.monthResetDate,
            });
            return;
          }
        }
      }
    }

    // Run fresh audit with a hard 90s ceiling - prevents hung AI calls from
    // tying up a server slot indefinitely (individual calls have 25s timeouts,
    // but in rare cases several can stack up sequentially)
    const AUDIT_TIMEOUT_MS = 90_000;
    const engineResult = await Promise.race([
      runAuditEngine(url, brandNameOverride ?? null, categoryOverride ?? null, marketOverride ?? null),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Audit timed out after 90 seconds")), AUDIT_TIMEOUT_MS)
      ),
    ]);

    // Domain was unreachable - return error without saving to DB or counting rate limit
    if (engineResult.unreachable) {
      res.status(422).json({
        error: "We could not reach this domain. Check the URL and try again.",
        reachable: false,
        domain: engineResult.brandName,
      });
      return;
    }

    const {
      brandName, category, market,
      chatgpt, gemini, perplexity, claude, grok,
      keywordsUsed, keywordsFromDataforseo, keywordsFilteredOut,
      rawChatgptResponse, rawGeminiResponse, rawPerplexityResponse, rawClaudeResponse, rawGrokResponse,
      technicalAudit,
    } = engineResult;

    const rawAiTotal = chatgpt.score + gemini.score + perplexity.score + claude.score + grok.score;
    const aiVisibilityScore = Math.min(Math.round(rawAiTotal * 100 / (5 * 33)), 100);
    const scoreTechnical = technicalAudit.overallScore;
    const scoreTotal = Math.round(aiVisibilityScore * 0.6 + scoreTechnical * 0.4);
    const allCompetitors = [...new Set([...chatgpt.competitors, ...gemini.competitors, ...perplexity.competitors, ...claude.competitors, ...grok.competitors])];

    const { recommendations, eeatScore } = await generateRecommendations(brandName, domain, category, market, chatgpt, gemini, perplexity, technicalAudit);

    const [audit] = await db.insert(auditsTable).values({
      url, domain, brandName, category, market, scoreTotal,
      scoreChatgpt: chatgpt.score, scoreGemini: gemini.score, scorePerplexity: perplexity.score,
      chatgptFound: chatgpt.found, geminiFound: gemini.found, perplexityFound: perplexity.found,
      chatgptDetail: chatgpt.detail, geminiDetail: gemini.detail, perplexityDetail: perplexity.detail,
      competitorsFound: allCompetitors, keywordsUsed,
      rawResults: {
        keywordsFromDataforseo, keywordsFilteredOut,
        keywordsReason: keywordsFilteredOut > 0 ? "branded/informational/navigational" : "none filtered",
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
    }).returning();

    // Increment rate counters (only for non-paid users)
    if (!isPaidUser) {
      const today = new Date().toISOString().slice(0, 10);
      const [rateRow] = await db
        .select()
        .from(rateLimitsTable)
        .where(and(eq(rateLimitsTable.ipAddress, ip), eq(rateLimitsTable.date, today)))
        .limit(1);
      const ipCount = rateRow?.auditCount ?? 0;

      if (ipCount >= FREE_IP_AUDITS_PER_DAY && subscriberEmail) {
        // Consumed from email allowance
        await db
          .update(emailSubscribersTable)
          .set({ auditCountMonth: sql`${emailSubscribersTable.auditCountMonth} + 1`, auditId: audit!.id })
          .where(eq(emailSubscribersTable.email, subscriberEmail));
      } else {
        // Consumed from IP allowance
        await db
          .insert(rateLimitsTable)
          .values({ ipAddress: ip, auditCount: 1, date: today })
          .onConflictDoUpdate({
            target: [rateLimitsTable.ipAddress, rateLimitsTable.date],
            set: { auditCount: sql`${rateLimitsTable.auditCount} + 1` },
          });
      }
    }

    res.json({ ...serializeAudit(audit!), recommendations, eeatScore, fromCache: false });
  } catch (err) {
    req.log.error({ err }, "Audit failed");
    res.status(500).json({ error: "Audit failed" });
  }
});

router.get("/audit/recent", async (req, res): Promise<void> => {
  try {
    const audits = await db.select({
      id: auditsTable.id, domain: auditsTable.domain, brandName: auditsTable.brandName,
      scoreTotal: auditsTable.scoreTotal, scoreChatgpt: auditsTable.scoreChatgpt,
      scoreGemini: auditsTable.scoreGemini, scorePerplexity: auditsTable.scorePerplexity,
      chatgptFound: auditsTable.chatgptFound, geminiFound: auditsTable.geminiFound,
      perplexityFound: auditsTable.perplexityFound, createdAt: auditsTable.createdAt,
    }).from(auditsTable).orderBy(desc(auditsTable.createdAt)).limit(10);
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
