import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, hashPassword, verifyPassword, type AuthRequest } from "../lib/auth";

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

  const [admin] = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAILS[0]!))
    .limit(1);

  if (!admin || !admin.passwordHash || !verifyPassword(password, admin.passwordHash)) {
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

export default router;
