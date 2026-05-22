import { Router } from "express";
import { db, auditsTable, roadmapTasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import {
  generateRoadmapAiContent,
  buildRoadmapWeeks,
  type AuditDataForRoadmap,
  type TechnicalAudit,
} from "../lib/roadmap-generator";

const router = Router();

router.get("/roadmap/:auditId", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Upgrade to Starter or Agency to access the execution roadmap" });
    return;
  }

  const auditId = req.params.auditId as string;
  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, auditId)).limit(1);
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  const raw = (audit.rawResults ?? {}) as Record<string, unknown>;
  const techAudit = (raw.technicalAudit ?? null) as TechnicalAudit | null;

  const auditData: AuditDataForRoadmap = {
    auditId: audit.id,
    domain: audit.domain,
    brandName: audit.brandName ?? audit.domain,
    category: audit.category ?? "SaaS",
    market: audit.market ?? "India",
    scoreTotal: audit.scoreTotal,
    competitorsFound: (audit.competitorsFound ?? []) as string[],
    technicalAudit: techAudit,
    keywords: (audit.keywordsUsed ?? []) as string[],
  };

  let roadmapContent = raw.roadmapContent as
    | { generatedAt: string; weeks: ReturnType<typeof buildRoadmapWeeks>; aiContent: object }
    | undefined;

  if (!roadmapContent) {
    req.log.info({ auditId }, "generating roadmap content");
    const aiContent = await generateRoadmapAiContent(auditData);
    const weeks = buildRoadmapWeeks(auditData, aiContent);
    roadmapContent = { generatedAt: new Date().toISOString(), weeks, aiContent };

    await db
      .update(auditsTable)
      .set({ rawResults: { ...raw, roadmapContent } })
      .where(eq(auditsTable.id, auditId));
  }

  const completedRows = await db
    .select()
    .from(roadmapTasksTable)
    .where(and(eq(roadmapTasksTable.userId, user.id), eq(roadmapTasksTable.auditId, auditId)));

  const completedTaskIds = completedRows.map((r) => r.taskId);

  res.json({
    auditId,
    generatedAt: roadmapContent.generatedAt,
    weeks: roadmapContent.weeks,
    completedTaskIds,
  });
});

router.post("/roadmap/:auditId/tasks/:taskId/complete", requireAuth, async (req, res) => {
  const user = (req as AuthRequest).user;
  if (user.plan === "free") {
    res.status(403).json({ error: "Upgrade required" });
    return;
  }

  const auditId = req.params.auditId as string;
  const taskId = req.params.taskId as string;

  const existing = await db
    .select()
    .from(roadmapTasksTable)
    .where(
      and(
        eq(roadmapTasksTable.userId, user.id),
        eq(roadmapTasksTable.auditId, auditId),
        eq(roadmapTasksTable.taskId, taskId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(roadmapTasksTable)
      .where(
        and(
          eq(roadmapTasksTable.userId, user.id),
          eq(roadmapTasksTable.auditId, auditId),
          eq(roadmapTasksTable.taskId, taskId),
        ),
      );
    res.json({ taskId, completed: false });
  } else {
    await db.insert(roadmapTasksTable).values({
      userId: user.id,
      auditId: auditId,
      taskId: taskId,
    });
    res.json({ taskId, completed: true });
  }
});

export default router;
