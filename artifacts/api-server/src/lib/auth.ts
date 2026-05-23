import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SECRET = process.env.SESSION_SECRET ?? "geoscore-dev-secret-32-chars-long";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuf, derived);
}

export function createToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    const payload = decoded.substring(0, lastDot);
    const sig = decoded.substring(lastDot + 1);
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    if (sig !== expected) return null;
    const userId = payload.split(".")[0];
    return userId ?? null;
  } catch {
    return null;
  }
}

export function generateMagicToken(): string {
  return randomBytes(32).toString("hex");
}

/** Middleware: requires any valid auth token (used for /auth/me etc.) */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  (req as Request & { user: typeof user }).user = user;
  next();
}

/** Middleware: requires a PAID account (starter or agency plan). Dashboard routes use this. */
export async function requirePaidAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Dashboard is for paid subscribers only. Start for $49/month.", requiresPaid: true });
    return;
  }
  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid token", requiresPaid: true });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found", requiresPaid: true });
    return;
  }
  if (user.plan === "free") {
    res.status(403).json({ error: "Dashboard is for paid subscribers only. Start for $49/month.", requiresPaid: true });
    return;
  }
  (req as Request & { user: typeof user }).user = user;
  next();
}

export type AuthRequest = Request & { user: { id: string; email: string; plan: string; auditCount: number; razorpaySubscriptionId: string | null; createdAt: Date; lastLogin: Date | null; passwordHash: string; agentMessagesUsed: number; agentMessagesReset: string | null } };
