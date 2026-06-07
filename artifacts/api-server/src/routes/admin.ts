import { Router, type IRouter } from "express";
import { db, usersTable, apiCostLogTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { requireAuth, hashPassword, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

const ADMIN_EMAILS = ["inoxxprotocol@gmail.com"];

function requireAdmin(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]): void {
  const user = (req as AuthRequest).user;
  if (!ADMIN_EMAILS.includes(user.email)) {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  next();
}

router.post("/admin/verify", async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  const gatePassword = process.env["ADMIN_GATE_PASSWORD"];
  if (!gatePassword) {
    res.status(503).json({ error: "Admin gate not configured." });
    return;
  }

  if (password !== gatePassword) {
    res.status(401).json({ error: "Wrong password." });
    return;
  }

  res.json({ ok: true });
});

router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      plan: usersTable.plan,
      subscriptionStatus: usersTable.subscriptionStatus,
      auditCount: usersTable.auditCount,
      agentMessagesUsed: usersTable.agentMessagesUsed,
      emailVerified: usersTable.emailVerified,
      blocked: usersTable.blocked,
      createdAt: usersTable.createdAt,
      lastLogin: usersTable.lastLogin,
      planStartedAt: usersTable.planStartedAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  res.json({ users });
});

router.post("/admin/users/:id/block", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  const admin = (req as AuthRequest).user;

  if (id === admin.id) {
    res.status(400).json({ error: "Cannot block your own account." });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  await db.update(usersTable).set({ blocked: true }).where(eq(usersTable.id, id));
  res.json({ success: true, blocked: true });
});

router.post("/admin/users/:id/unblock", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  await db.update(usersTable).set({ blocked: false }).where(eq(usersTable.id, id));
  res.json({ success: true, blocked: false });
});

router.post("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { email, plan, password } = req.body as { email?: string; plan?: string; password?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const validPlans = ["free", "starter", "agency"];
  const userPlan = validPlans.includes(plan ?? "") ? (plan as "free" | "starter" | "agency") : "free";

  const cleanEmail = email.toLowerCase().trim();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = password && password.length >= 8 ? hashPassword(password) : null;

  const [created] = await db.insert(usersTable).values({
    email: cleanEmail,
    passwordHash,
    emailVerified: true,
    plan: userPlan,
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    plan: usersTable.plan,
    subscriptionStatus: usersTable.subscriptionStatus,
    auditCount: usersTable.auditCount,
    agentMessagesUsed: usersTable.agentMessagesUsed,
    emailVerified: usersTable.emailVerified,
    blocked: usersTable.blocked,
    createdAt: usersTable.createdAt,
    lastLogin: usersTable.lastLogin,
    planStartedAt: usersTable.planStartedAt,
  });

  res.status(201).json({ success: true, user: created });
});

router.post("/admin/users/:id/set-password", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  const { password } = req.body as { password?: string };

  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const passwordHash = hashPassword(password);
  await db.update(usersTable).set({ passwordHash, emailVerified: true }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// ─── API Cost View ─────────────────────────────────────────────────────────────

router.get("/admin/api-costs", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayRow] = await db
    .select({ total: sql<number>`coalesce(sum(${apiCostLogTable.costUsd}), 0)` })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, todayStart));

  const [monthRow] = await db
    .select({ total: sql<number>`coalesce(sum(${apiCostLogTable.costUsd}), 0)` })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, monthStart));

  const byEndpoint = await db
    .select({
      endpoint: apiCostLogTable.endpoint,
      total: sql<number>`coalesce(sum(${apiCostLogTable.costUsd}), 0)`,
      calls: sql<number>`count(*)`,
    })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, monthStart))
    .groupBy(apiCostLogTable.endpoint)
    .orderBy(desc(sql`sum(${apiCostLogTable.costUsd})`));

  const topUsers = await db
    .select({
      userId: apiCostLogTable.userId,
      total: sql<number>`coalesce(sum(${apiCostLogTable.costUsd}), 0)`,
      calls: sql<number>`count(*)`,
    })
    .from(apiCostLogTable)
    .where(gte(apiCostLogTable.createdAt, monthStart))
    .groupBy(apiCostLogTable.userId)
    .orderBy(desc(sql`sum(${apiCostLogTable.costUsd})`))
    .limit(10);

  const recent = await db
    .select()
    .from(apiCostLogTable)
    .orderBy(desc(apiCostLogTable.createdAt))
    .limit(20);

  res.json({
    spendToday: Number(todayRow?.total ?? 0),
    spendThisMonth: Number(monthRow?.total ?? 0),
    byEndpoint,
    topUsers,
    recent,
  });
});

export default router;
