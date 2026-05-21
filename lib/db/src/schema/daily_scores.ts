import { pgTable, uuid, date, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { monitoredBrandsTable } from "./monitored_brands";

export const dailyScoresTable = pgTable("daily_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => monitoredBrandsTable.id),
  date: date("date").notNull(),
  scoreTotal: integer("score_total").notNull().default(0),
  scoreChatgpt: integer("score_chatgpt").notNull().default(0),
  scoreGemini: integer("score_gemini").notNull().default(0),
  scorePerplexity: integer("score_perplexity").notNull().default(0),
  recommendations: jsonb("recommendations").$type<Record<string, unknown>[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyScoreSchema = createInsertSchema(dailyScoresTable).omit({ id: true, createdAt: true });
export type InsertDailyScore = z.infer<typeof insertDailyScoreSchema>;
export type DailyScore = typeof dailyScoresTable.$inferSelect;
