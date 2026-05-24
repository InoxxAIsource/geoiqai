import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { db, usersTable, magicTokensTable, passwordResetTokensTable, emailVerificationTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, createToken, generateMagicToken, requireAuth, type AuthRequest } from "../lib/auth";
import { sendMagicLinkEmail, sendEmailVerification, sendPasswordResetEmail, sendNewSignupAlert } from "../lib/email";

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
    res.json({ sent: true, message: "If a paid account exists for this email, you will receive a login link." });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "Your account has been blocked. Contact support.", blocked: true });
    return;
  }

  const token = generateMagicToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(magicTokensTable).values({ userId: user.id, token, expiresAt });

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

  await db.update(magicTokensTable).set({ usedAt: now }).where(eq(magicTokensTable.id, magicRow.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, magicRow.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "Your account has been blocked. Contact support.", blocked: true });
    return;
  }

  await db.update(usersTable).set({ lastLogin: now }).where(eq(usersTable.id, user.id));

  const bearerToken = createToken(user.id);
  res.json({
    token: bearerToken,
    user: { id: user.id, email: user.email, plan: user.plan, createdAt: user.createdAt.toISOString() },
  });
});

// Sign up with email + password (sends verification email, free plan)
router.post("/auth/signup", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists. Sign in instead.", alreadyExists: true });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email: cleanEmail,
    passwordHash,
    emailVerified: false,
    plan: "free",
  }).returning();

  const verifyToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokensTable).values({ userId: user!.id, token: verifyToken, expiresAt });

  const verifyUrl = `${APP_URL}/auth/verify-email?token=${verifyToken}`;
  void sendEmailVerification(cleanEmail, verifyUrl);
  void sendNewSignupAlert(cleanEmail, "free");

  res.status(201).json({ sent: true, message: "Account created. Check your email to verify your account." });
});

// Email + password sign in
router.post("/auth/login-password", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "Your account has been blocked. Contact support.", blocked: true });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({ error: "Please verify your email before signing in.", emailNotVerified: true, email: user.email });
    return;
  }

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  const token = createToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, plan: user.plan, createdAt: user.createdAt.toISOString() },
  });
});

// Verify email address via token
router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const now = new Date();
  const [row] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(and(eq(emailVerificationTokensTable.token, token), gt(emailVerificationTokensTable.expiresAt, now)))
    .limit(1);

  if (!row) {
    res.status(400).json({ error: "This verification link has expired. Request a new one.", expired: true });
    return;
  }
  if (row.usedAt) {
    res.status(400).json({ error: "This link has already been used.", alreadyUsed: true });
    return;
  }

  await db.update(emailVerificationTokensTable).set({ usedAt: now }).where(eq(emailVerificationTokensTable.id, row.id));
  await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, row.userId));

  res.json({ verified: true, message: "Email verified. You can now sign in." });
});

// Resend verification email
router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (user && !user.emailVerified) {
    const verifyToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(emailVerificationTokensTable).values({ userId: user.id, token: verifyToken, expiresAt });
    const verifyUrl = `${APP_URL}/auth/verify-email?token=${verifyToken}`;
    void sendEmailVerification(user.email, verifyUrl);
  }
  res.json({ sent: true });
});

// Forgot password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

  if (user) {
    const resetToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({ userId: user.id, token: resetToken, expiresAt });
    const resetUrl = `${APP_URL}/auth/reset-password?token=${resetToken}`;
    void sendPasswordResetEmail(user.email, resetUrl);
  }

  res.json({ sent: true, message: "If an account exists for this email, you will receive a reset link." });
});

// Reset password via token
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const now = new Date();
  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(and(eq(passwordResetTokensTable.token, token), gt(passwordResetTokensTable.expiresAt, now)))
    .limit(1);

  if (!row) {
    res.status(400).json({ error: "This reset link has expired. Request a new one.", expired: true });
    return;
  }
  if (row.usedAt) {
    res.status(400).json({ error: "This reset link has already been used.", alreadyUsed: true });
    return;
  }

  const passwordHash = hashPassword(password);
  await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, row.id));
  await db.update(usersTable).set({ passwordHash, emailVerified: true }).where(eq(usersTable.id, row.userId));

  res.json({ reset: true, message: "Password reset successfully. You can now sign in." });
});

// Set password for a logged-in user (post-payment banner)
router.post("/auth/set-password", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const passwordHash = hashPassword(password);
  await db.update(usersTable).set({ passwordHash, emailVerified: true }).where(eq(usersTable.id, user.id));

  res.json({ success: true, message: "Password set. You can now sign in with your email and password." });
});

// Legacy register
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
  const [user] = await db.insert(usersTable).values({ email, passwordHash, emailVerified: true }).returning();

  void sendNewSignupAlert(user!.email, user!.plan ?? "free");

  const token = createToken(user!.id);
  res.status(201).json({
    token,
    user: { id: user!.id, email: user!.email, plan: user!.plan, auditCount: user!.auditCount, createdAt: user!.createdAt.toISOString() },
  });
});

// Legacy login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "Your account has been blocked. Contact support.", blocked: true });
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
    hasPassword: user.passwordHash !== null && user.passwordHash !== undefined,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
