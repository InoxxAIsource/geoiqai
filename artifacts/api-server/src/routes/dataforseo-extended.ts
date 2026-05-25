import { Router } from "express";
import { requireAuth, type AuthRequest } from "../lib/auth";
import {
  getGoogleAiOverview,
  getBacklinksSummary,
  getBacklinkDomainGaps,
  runOnPageAudit,
  getDomainKeywords,
  getLocationCode,
} from "../lib/dataforseo";
import { db, citationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── Public Google AI check (used by free audit - rate-limited by IP) ──────────

const publicAiCheckCount = new Map<string, { count: number; resetAt: number }>();

router.post("/audit/google-ai-check", async (req, res): Promise<void> => {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const entry = publicAiCheckCount.get(ip);
  if (entry && entry.resetAt > now && entry.count >= 5) {
    res.status(429).json({ error: "Rate limit: max 5 Google AI checks per day per IP." });
    return;
  }
  if (!entry || entry.resetAt <= now) {
    publicAiCheckCount.set(ip, { count: 1, resetAt: now + dayMs });
  } else {
    entry.count++;
  }

  const { domain, keywords } = req.body as { domain?: string; keywords?: string[] };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  const result = await getGoogleAiOverview(kws, domain, locationCode);
  res.json(result);
});

// ─── Auth-gated endpoints (paid plans only) ────────────────────────────────────

function requirePaid(req: AuthRequest, res: Parameters<Parameters<typeof router.post>[1]>[1], next: () => void) {
  if (req.user.plan === "free") {
    res.status(403).json({ error: "This feature requires a paid plan. Upgrade to Starter or Agency." });
    return;
  }
  next();
}

// Google AI Overview - paid dashboard
router.post("/dataforseo/google-ai-overview", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Google AI Overview requires a paid plan." });
    return;
  }

  const { domain, keywords, brandId } = req.body as {
    domain?: string;
    keywords?: string[];
    brandId?: string;
  };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const kws: string[] = Array.isArray(keywords) && keywords.length > 0
    ? keywords.slice(0, 5)
    : (await getDomainKeywords(domain)).slice(0, 5).map(k => k.keyword);

  const locationCode = getLocationCode(domain);
  req.log.info({ domain, kws: kws.length }, "google-ai-overview request");

  const result = await getGoogleAiOverview(kws, domain, locationCode);

  // Persist brand_entities to citations table if we have a brandId and entities
  if (brandId && result.brandEntities.length > 0) {
    const bareDomain = domain.replace(/^www\./, "").toLowerCase();

    try {
      // Clear old brand-entity citations for this brand so we get a fresh snapshot
      await db
        .delete(citationsTable)
        .where(
          and(
            eq(citationsTable.brandId, brandId),
            eq(citationsTable.aiSystem, "google_ai_overview"),
          ),
        );

      // Insert fresh entities
      const rows = result.brandEntities.map(ent => {
        const entUrl = ent.url.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
        const isOwnBrand =
          entUrl.includes(bareDomain) ||
          bareDomain.includes(entUrl.split("/")[0] ?? "") ||
          ent.name.toLowerCase().replace(/\s+/g, "").includes(bareDomain.split(".")[0] ?? "");

        return {
          brandId,
          aiSystem: "google_ai_overview",
          prompt: kws.join(", "),
          citedUrl: ent.url,
          citedDomain: ent.url,
          brandName: ent.name,
          citationType: isOwnBrand ? "brand" : "competitor",
          timesCited: ent.mentionCount,
        };
      });

      await db.insert(citationsTable).values(rows);
      req.log.info({ brandId, count: rows.length }, "brand_entities saved to citations");
    } catch (err) {
      req.log.warn({ err }, "Failed to save brand_entities to citations - non-fatal");
    }
  }

  res.json(result);
});

// Brand entity citations - returns saved brand_entities for a brand
router.get("/citations/brand-entities", requireAuth, async (req, res): Promise<void> => {
  const brandId = String(req.query["brandId"] ?? "");
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(citationsTable)
      .where(
        and(
          eq(citationsTable.brandId, brandId),
          eq(citationsTable.aiSystem, "google_ai_overview"),
        ),
      );

    res.json({ citations: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch brand entity citations");
    res.status(500).json({ error: "Failed to fetch citations" });
  }
});

// Backlinks summary
router.post("/backlinks/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Backlinks data requires a paid plan." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  req.log.info({ domain }, "backlinks summary request");
  const result = await getBacklinksSummary(domain);
  if (!result) {
    res.status(502).json({ error: "Could not fetch backlink data. Check DataForSEO credentials." });
    return;
  }
  res.json(result);
});

// Backlinks competitor gap
router.post("/backlinks/competitors", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Backlink gap analysis requires a paid plan." });
    return;
  }

  const { myDomain, competitorDomains } = req.body as { myDomain?: string; competitorDomains?: string[] };
  if (!myDomain || !Array.isArray(competitorDomains) || competitorDomains.length === 0) {
    res.status(400).json({ error: "myDomain and competitorDomains[] are required" });
    return;
  }

  req.log.info({ myDomain, competitors: competitorDomains.length }, "backlinks competitor gap request");
  const result = await getBacklinkDomainGaps(myDomain, competitorDomains);
  res.json(result);
});

// OnPage full audit
router.post("/onpage/audit", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "OnPage audit requires a paid plan." });
    return;
  }

  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  req.log.info({ domain }, "onpage audit request");
  const result = await runOnPageAudit(domain);

  if (result.status === "error") {
    res.status(502).json({ error: "OnPage audit failed. Check DataForSEO credentials or try again." });
    return;
  }

  res.json(result);
});

void requirePaid;

export default router;
