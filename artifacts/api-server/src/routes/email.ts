import { Router, type IRouter } from "express";
import { db, emailSubscribersTable } from "@workspace/db";
import { EmailSubscribeBody } from "@workspace/api-zod";
import { sendSubscribeConfirmation, sendContactEmail } from "../lib/email-service";

const router: IRouter = Router();

router.post("/email/subscribe", async (req, res): Promise<void> => {
  const parsed = EmailSubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, domain, auditId } = parsed.data;

  try {
    await db.insert(emailSubscribersTable).values({
      email,
      domain: domain ?? null,
      auditId: auditId ?? null,
    }).onConflictDoNothing();

    // Send confirmation email in background
    sendSubscribeConfirmation(email, domain ?? undefined).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to subscribe email");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

router.post("/contact", async (req, res): Promise<void> => {
  const { name, email, subject, message } = req.body as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  if (message.length > 5000) {
    res.status(400).json({ error: "Message is too long (max 5000 characters)." });
    return;
  }

  try {
    await sendContactEmail(name.trim(), email.trim(), subject.trim(), message.trim());
    req.log.info({ from: email }, "contact form submitted");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send contact email");
    res.status(500).json({ error: "Could not send your message. Please try again later." });
  }
});

export default router;
