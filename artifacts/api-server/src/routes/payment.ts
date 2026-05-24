import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { db, usersTable, magicTokensTable, monitoredBrandsTable } from "@workspace/db";
import { extractDomain } from "../lib/audit-engine";
import { eq } from "drizzle-orm";
import { generateMagicToken } from "../lib/auth";
import { sendMagicLinkEmail, sendPaymentWelcomeEmail, sendSubscriptionCancelledEmail } from "../lib/email";

const router: IRouter = Router();

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
const STARTER_PLAN_ID     = (process.env.RAZORPAY_STARTER_PLAN_ID ?? "").trim();
const AGENCY_PLAN_ID      = (process.env.RAZORPAY_AGENCY_PLAN_ID  ?? "").trim();
const APP_URL             = process.env.APP_URL ?? "https://geoiqai.com";

const PLAN_PRICES: Record<string, number> = {
  starter: 399900,
  agency:  1199900,
};
const PLAN_NAMES: Record<string, string> = {
  starter: "GeoIQ Starter",
  agency:  "GeoIQ Agency",
};

function getRazorpay() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RazorpayCtor = require("razorpay") as new (opts: { key_id: string; key_secret: string }) => RazorpayInstance;
  return new RazorpayCtor({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

interface RazorpayInstance {
  customers: {
    create(data: Record<string, unknown>): Promise<{ id: string }>;
    all(params: Record<string, unknown>): Promise<{ items: Array<{ id: string; email: string }> }>;
  };
  subscriptions: { create(data: Record<string, unknown>): Promise<{ id: string }> };
}

// GET /api/payment/config-check  - diagnostic endpoint to verify Razorpay config
router.get("/payment/config-check", (_req, res: Response): void => {
  const keyId = RAZORPAY_KEY_ID;
  const keyMode = keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : "unknown";
  const resendKey = process.env.RESEND_API_KEY ?? "";
  res.json({
    configured: !!(keyId && RAZORPAY_KEY_SECRET),
    keyMode,
    keyPrefix: keyId ? `${keyId.slice(0, 12)}...` : "(not set)",
    starterPlanSet: !!STARTER_PLAN_ID,
    agencyPlanSet: !!AGENCY_PLAN_ID,
    starterPlanId: STARTER_PLAN_ID ? `${STARTER_PLAN_ID.slice(0, 8)}...` : "(not set)",
    agencyPlanId: AGENCY_PLAN_ID ? `${AGENCY_PLAN_ID.slice(0, 8)}...` : "(not set)",
    resendConfigured: !!resendKey,
    resendKeyPrefix: resendKey ? `${resendKey.slice(0, 6)}...` : "(not set)",
  });
});

// POST /api/payment/test-email  - dev-only endpoint to verify Resend is working
router.post("/payment/test-email", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const { sendMagicLinkEmail } = await import("../lib/email");
  try {
    await sendMagicLinkEmail(email, "https://geoiqai.com/dashboard");
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ sent: false, error: String(err) });
  }
});

// POST /api/payment/create-subscription
router.post("/payment/create-subscription", async (req: Request, res: Response): Promise<void> => {
  const { plan, email, domain } = req.body as { plan?: string; email?: string; domain?: string };

  if (!plan || !PLAN_PRICES[plan]) {
    res.status(400).json({ error: "Invalid plan. Must be 'starter' or 'agency'." });
    return;
  }
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required." });
    return;
  }

  const rzp = getRazorpay();
  if (!rzp) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  const planId = plan === "starter" ? STARTER_PLAN_ID : AGENCY_PLAN_ID;
  if (!planId) {
    res.status(503).json({ error: "Subscription plans not configured" });
    return;
  }

  try {
    // Create customer, or look up existing one if already registered
    let customer: { id: string };
    try {
      customer = await rzp.customers.create({
        name: email.split("@")[0],
        email: email.toLowerCase().trim(),
        notify: { email: true },
      });
    } catch (custErr: unknown) {
      const ce = custErr as { error?: { description?: string } };
      if (ce?.error?.description?.toLowerCase().includes("already exists")) {
        // Customer already exists - fetch them by email
        const existing = await rzp.customers.all({ email: email.toLowerCase().trim(), count: 1 });
        const found = existing?.items?.[0];
        if (!found) throw custErr;
        customer = found;
        req.log.info({ email, customerId: customer.id }, "Using existing Razorpay customer");
      } else {
        throw custErr;
      }
    }

    const subscription = await rzp.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: {
        email: email.toLowerCase().trim(),
        domain: domain ?? "",
        plan,
        customer_id: customer.id,
      },
    });

    req.log.info({ email, plan, subscriptionId: subscription.id }, "Razorpay subscription created");

    res.json({
      subscription_id: subscription.id,
      razorpay_key: RAZORPAY_KEY_ID,
      customer_id: customer.id,
      amount: PLAN_PRICES[plan],
      plan_name: PLAN_NAMES[plan] ?? plan,
    });
  } catch (err: unknown) {
    // Extract the actual Razorpay error so it's visible in logs and returned to frontend
    const rzpErr = err as { error?: { description?: string; code?: string; reason?: string }; message?: string };
    const detail = rzpErr?.error?.description ?? rzpErr?.error?.reason ?? rzpErr?.message ?? "Unknown error";
    const code = rzpErr?.error?.code ?? "unknown";
    req.log.error({ err, razorpayCode: code, razorpayDetail: detail, planId, keyPrefix: RAZORPAY_KEY_ID.slice(0, 12) }, "Failed to create Razorpay subscription");
    res.status(500).json({ error: `Razorpay error: ${detail}` });
  }
});

// POST /api/payment/verify  (called by frontend after Razorpay payment handler fires)
router.post("/payment/verify", async (req: Request, res: Response): Promise<void> => {
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    email,
    domain,
    plan,
  } = req.body as {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
    email?: string;
    domain?: string;
    plan?: string;
  };

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !email || !plan) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (!RAZORPAY_KEY_SECRET) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  // Subscription payment signature: payment_id|subscription_id
  const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
  const expected = createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
  if (expected !== razorpay_signature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

  let userId: string;
  if (existing) {
    await db.update(usersTable).set({
      plan,
      razorpaySubscriptionId: razorpay_subscription_id,
      subscriptionStatus: "active",
      planStartedAt: new Date(),
    }).where(eq(usersTable.id, existing.id));
    userId = existing.id;
  } else {
    const { randomBytes } = await import("crypto");
    const randomPwd = randomBytes(32).toString("hex");
    const [newUser] = await db.insert(usersTable).values({
      email: cleanEmail,
      passwordHash: `nologin:${randomPwd}`,
      emailVerified: true,
      plan,
      razorpaySubscriptionId: razorpay_subscription_id,
      subscriptionStatus: "active",
      planStartedAt: new Date(),
    }).returning();
    userId = newUser!.id;

  }

  // Generate 24h magic link for immediate dashboard access
  const magicToken = generateMagicToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(magicTokensTable).values({ userId, token: magicToken, expiresAt });

  // Auto-create monitored brand if domain was passed from the audit page
  if (domain && domain.trim().length > 0) {
    const cleanDomain = extractDomain(domain.trim());
    const existing = await db.select({ id: monitoredBrandsTable.id })
      .from(monitoredBrandsTable)
      .where(eq(monitoredBrandsTable.userId, userId))
      .limit(1);
    if (existing.length === 0) {
      const brandName = cleanDomain.split(".")[0] ?? cleanDomain;
      const prettyName = brandName.charAt(0).toUpperCase() + brandName.slice(1);
      await db.insert(monitoredBrandsTable).values({
        userId,
        domain: cleanDomain,
        brandName: prettyName,
        category: "other",
        market: "India",
        keywords: [],
        competitors: [],
      });
      req.log.info({ userId, domain: cleanDomain }, "Auto-created monitored brand after payment");
    }
  }

  const magicUrl = `${APP_URL}/auth/magic?token=${magicToken}`;
  void sendPaymentWelcomeEmail(cleanEmail, magicUrl, plan, domain ?? "");

  req.log.info({ email: cleanEmail, plan, subscriptionId: razorpay_subscription_id }, "Payment verified, user created/updated");
  res.json({ success: true, magicUrl, message: "Payment verified. Redirecting to your dashboard." });
});

// POST /api/payment/webhook  (raw body - signature verified against RAZORPAY_WEBHOOK_SECRET)
router.post("/payment/webhook", async (req: Request, res: Response): Promise<void> => {
  // Always return 200 to Razorpay to prevent retries
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!RAZORPAY_WEBHOOK_SECRET) {
    req.log.warn("RAZORPAY_WEBHOOK_SECRET not set - skipping webhook signature check");
    res.status(200).json({ received: true });
    return;
  }

  // rawBody is set by the express.raw() middleware in app.ts for this route
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !signature) {
    res.status(200).json({ received: true });
    return;
  }

  const expected = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  if (expected !== signature) {
    req.log.warn("Invalid Razorpay webhook signature");
    res.status(200).json({ received: true }); // still 200 to prevent retries
    return;
  }

  let payload: {
    event?: string;
    payload?: {
      subscription?: { entity?: { id?: string; notes?: Record<string, string> } };
      payment?: { entity?: { email?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody.toString()) as typeof payload;
  } catch {
    res.status(200).json({ received: true });
    return;
  }

  const event = payload.event ?? "";
  const subscriptionId = payload.payload?.subscription?.entity?.id;
  const notes = payload.payload?.subscription?.entity?.notes ?? {};
  const email = notes["email"] ?? payload.payload?.payment?.entity?.email ?? "";

  req.log.info({ event, subscriptionId, email }, "Razorpay webhook received");

  try {
    if (event === "subscription.activated" || event === "subscription.charged") {
      if (subscriptionId) {
        const plan = notes["plan"] ?? "starter";
        await db.update(usersTable)
          .set({ subscriptionStatus: "active", plan, planStartedAt: new Date() })
          .where(eq(usersTable.razorpaySubscriptionId, subscriptionId));
      }
    } else if (event === "subscription.cancelled" || event === "subscription.halted") {
      if (email) {
        await db.update(usersTable)
          .set({ plan: "free", subscriptionStatus: "cancelled" })
          .where(eq(usersTable.email, email.toLowerCase().trim()));
        void sendSubscriptionCancelledEmail(email);
      } else if (subscriptionId) {
        await db.update(usersTable)
          .set({ plan: "free", subscriptionStatus: "cancelled" })
          .where(eq(usersTable.razorpaySubscriptionId, subscriptionId));
      }
    } else if (event === "payment.failed") {
      // Log only - keep plan active for grace period, Razorpay retries automatically
      req.log.warn({ email, subscriptionId }, "Payment failed - Razorpay will retry");
    }
  } catch (err) {
    req.log.error({ err, event }, "Error handling webhook event");
  }

  res.status(200).json({ received: true });
});

export default router;
