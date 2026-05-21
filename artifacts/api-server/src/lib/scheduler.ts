import { db, monitoredBrandsTable, usersTable, dailyScoresTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { runAuditEngine, generateRecommendations } from "./audit-engine";
import { sendWeeklyDigest } from "./email-service";
import { logger } from "./logger";

let lastDailyRunDate: string | null = null;

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRunTime(): boolean {
  const now = new Date();
  return now.getUTCHours() === 2 && now.getUTCMinutes() < 30;
}

function isMonday(): boolean {
  return new Date().getUTCDay() === 1;
}

async function runDailyMonitoringJob(): Promise<void> {
  const today = getTodayUtcDate();
  if (lastDailyRunDate === today) return;
  lastDailyRunDate = today;

  logger.info("Starting daily monitoring job");

  let paidUsers: typeof usersTable.$inferSelect[] = [];
  try {
    paidUsers = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.plan, "starter")));

    const agencyUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.plan, "agency"));

    paidUsers = [...paidUsers, ...agencyUsers];
  } catch (err) {
    logger.error({ err }, "Failed to fetch paid users for monitoring");
    return;
  }

  for (const user of paidUsers) {
    let brands: typeof monitoredBrandsTable.$inferSelect[] = [];
    try {
      brands = await db
        .select()
        .from(monitoredBrandsTable)
        .where(eq(monitoredBrandsTable.userId, user.id));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to fetch brands for user");
      continue;
    }

    for (const brand of brands) {
      try {
        const engineResult = await runAuditEngine(
          `https://${brand.domain}`,
          brand.brandName,
          brand.category,
          brand.market,
        );

        const { chatgpt, gemini, perplexity } = engineResult;
        const scoreTotal = Math.min(chatgpt.score + gemini.score + perplexity.score, 100);

        const yesterdayDate = new Date();
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

        const [yesterdayScore] = await db
          .select({ scoreTotal: dailyScoresTable.scoreTotal })
          .from(dailyScoresTable)
          .where(
            and(
              eq(dailyScoresTable.brandId, brand.id),
              gte(dailyScoresTable.date, yesterdayStr),
            ),
          )
          .limit(1);

        await db.insert(dailyScoresTable).values({
          brandId: brand.id,
          date: today,
          scoreTotal,
          scoreChatgpt: chatgpt.score,
          scoreGemini: gemini.score,
          scorePerplexity: perplexity.score,
        }).onConflictDoNothing();

        await db
          .update(monitoredBrandsTable)
          .set({ lastChecked: new Date() })
          .where(eq(monitoredBrandsTable.id, brand.id));

        if (isMonday()) {
          const recs = await generateRecommendations(
            brand.brandName ?? brand.domain,
            brand.domain,
            brand.category ?? "saas tool",
            brand.market ?? "India",
            chatgpt,
            gemini,
            perplexity,
          );

          await sendWeeklyDigest(
            user.email,
            brand.domain,
            scoreTotal,
            yesterdayScore?.scoreTotal ?? scoreTotal,
            { chatgpt: chatgpt.found, gemini: gemini.found, perplexity: perplexity.found },
            recs,
          );
        }

        logger.info({ domain: brand.domain, scoreTotal }, "Daily monitoring complete");
      } catch (err) {
        logger.error({ err, domain: brand.domain }, "Failed to monitor brand");
      }
    }
  }

  logger.info("Daily monitoring job complete");
}

export function startScheduler(): void {
  setInterval(() => {
    if (isRunTime()) {
      runDailyMonitoringJob().catch((err) => {
        logger.error({ err }, "Scheduler error");
      });
    }
  }, 15 * 60 * 1000);

  logger.info("Scheduler started (checks every 15 minutes)");
}
