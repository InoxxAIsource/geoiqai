import { Router, type IRouter } from "express";
import { db, emailSubscribersTable } from "@workspace/db";
import { EmailSubscribeBody } from "@workspace/api-zod";

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

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to subscribe email");
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

export default router;
