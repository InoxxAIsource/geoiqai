import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreatePaymentOrderBody, VerifyPaymentBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

const PLAN_PRICES: Record<string, number> = {
  starter: 399900, // ₹3,999 in paise
  agency: 1199900, // ₹11,999 in paise
};

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

router.post("/payment/create-order", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePaymentOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { plan } = parsed.data;
  const amount = PLAN_PRICES[plan];
  if (!amount) {
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
      amount,
      currency: "INR",
      receipt: `geoscore_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create Razorpay order");
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = VerifyPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan } = parsed.data;

  const expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSig !== razorpaySignature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ plan })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({
    id: updated!.id,
    email: updated!.email,
    plan: updated!.plan,
    createdAt: updated!.createdAt.toISOString(),
  });
});

export default router;
