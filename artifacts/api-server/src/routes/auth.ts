import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { db, usersTable, magicTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, createToken, generateMagicToken, requireAuth, type AuthRequest } from "../lib/auth";
import { sendMagicLinkEmail } from "../lib/email";

const APP_URL = process.env.APP_URL ?? "https://geoscore.app";

const router: IRouter = Router();

// Magic link login (primary flow for paid users)
router.post("/auth/magic-link", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

  if (!user || user.plan === "free") {
    // Don't leak whether email exists - give same response
    res.json({ sent: true, message: "If a paid account exists for this email, you will receive a login link." });
    return;
  }

  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicTokensTable).values({
    userId: user.id,
    token,
    expiresAt,
  });

  const magicUrl = `${APP_URL}/auth/magic?token=${token}`;
  void sendMagicLinkEmail(user.email, magicUrl);

  res.json({ sent: true, message: "Check your email for your login link." });
});

// Validate magic token and return bearer token
router.post("/auth/verify-magic", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const now = new Date();
  const [magicRow] = await db
    .select()
    .from(magicTokensTable)
    .where(and(eq(magicTokensTable.token, token), gt(magicTokensTable.expiresAt, now)))
    .limit(1);

  if (!magicRow) {
    res.status(401).json({ error: "This login link has expired. Request a new one.", expired: true });
    return;
  }

  if (magicRow.usedAt) {
    res.status(401).json({ error: "This link has already been used. Request a new login link.", alreadyUsed: true });
    return;
  }

  // Mark token as used
  await db.update(magicTokensTable).set({ usedAt: now }).where(eq(magicTokensTable.id, magicRow.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, magicRow.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.update(usersTable).set({ lastLogin: now }).where(eq(usersTable.id, user.id));

  const bearerToken = createToken(user.id);
  res.json({
    token: bearerToken,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// Legacy email/password register (still functional but not exposed in UI)
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, passwordHash }).returning();

  const token = createToken(user!.id);

  res.status(201).json({
    token,
    user: { id: user!.id, email: user!.email, plan: user!.plan, auditCount: user!.auditCount, createdAt: user!.createdAt.toISOString() },
  });
});

// Legacy email/password login (still functional but not exposed in UI)
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  const token = createToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, plan: user.plan, createdAt: user.createdAt.toISOString() },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
