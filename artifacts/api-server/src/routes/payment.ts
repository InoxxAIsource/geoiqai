import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { db, usersTable, magicTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createToken, generateMagicToken } from "../lib/auth";
import { sendMagicLinkEmail } from "../lib/email";

const router: IRouter = Router();

const PLAN_PRICES: Record<string, number> = {
  starter: 399900,  // Rs 3,999 in paise
  agency:  999900,  // Rs 9,999 in paise
};

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const APP_URL = process.env.APP_URL ?? "https://geoscore.app";

// Create a Razorpay order - no auth required
router.post("/payment/create-order", async (req, res): Promise<void> => {
  const { plan, email } = req.body as { plan?: string; email?: string };

  if (!plan || !PLAN_PRICES[plan]) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  try {
    const { default: Razorpay } = await import("razorpay");
    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    const order = await razorpay.orders.create({
      amount: PLAN_PRICES[plan]!,
      currency: "INR",
      receipt: `geoiq_${Date.now()}`,
      notes: { email: email ?? "", plan },
    });

    res.json({ orderId: order.id, amount: PLAN_PRICES[plan], currency: "INR", keyId: RAZORPAY_KEY_ID });
  } catch (err) {
    req.log.error({ err }, "Failed to create Razorpay order");
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// Verify payment - creates or upgrades user account, sends magic link
router.post("/payment/verify", async (req, res): Promise<void> => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, email } =
    req.body as { razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string; plan?: string; email?: string };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !plan || !email) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!RAZORPAY_KEY_SECRET) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  const expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSig !== razorpaySignature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  // Upsert user - create if not exists, upgrade plan if exists
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

  let userId: string;
  if (existing) {
    await db.update(usersTable).set({ plan, razorpaySubscriptionId: razorpayPaymentId }).where(eq(usersTable.id, existing.id));
    userId = existing.id;
  } else {
    // Create account with a random password hash (magic link only - no password login)
    const { randomBytes } = await import("crypto");
    const randomPwd = randomBytes(32).toString("hex");
    const [newUser] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      passwordHash: `nologin:${randomPwd}`,
      plan,
      razorpaySubscriptionId: razorpayPaymentId,
    }).returning();
    userId = newUser!.id;
  }

  // Generate magic link so they can log in immediately
  const magicToken = generateMagicToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h for post-payment link
  await db.insert(magicTokensTable).values({ userId, token: magicToken, expiresAt });

  const magicUrl = `${APP_URL}/auth/magic?token=${magicToken}`;
  void sendMagicLinkEmail(email, magicUrl);

  res.json({ success: true, message: "Payment verified. Check your email for your dashboard login link." });
});

export default router;
