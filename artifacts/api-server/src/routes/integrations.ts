import { Router, type IRouter } from "express";
import { db, integrationsWaitlistTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/integrations/waitlist", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const { integration } = req.body as { integration?: string };

  if (!integration || !["gsc", "bing"].includes(integration)) {
    res.status(400).json({ error: "Invalid integration. Must be 'gsc' or 'bing'." });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(integrationsWaitlistTable)
      .where(
        and(
          eq(integrationsWaitlistTable.email, user.email),
          eq(integrationsWaitlistTable.integration, integration),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(integrationsWaitlistTable).values({
        email: user.email,
        integration,
      });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to join integrations waitlist");
    res.status(500).json({ error: "Failed to save" });
  }
});

export default router;
