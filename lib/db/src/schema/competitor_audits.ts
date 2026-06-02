import { pgTable, uuid, text, integer, boolean, jsonb, date, timestamp } from "drizzle-orm/pg-core";
import { monitoredBrandsTable } from "./monitored_brands";

export const competitorAuditsTable = pgTable("competitor_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => monitoredBrandsTable.id, { onDelete: "cascade" }),
  competitorDomain: text("competitor_domain").notNull(),
  date: date("date").notNull(),
  scoreChatgpt: integer("score_chatgpt").notNull().default(0),
  scoreGemini: integer("score_gemini").notNull().default(0),
  scorePerplexity: integer("score_perplexity").notNull().default(0),
  scoreClaude: integer("score_claude").notNull().default(0),
  scoreGrok: integer("score_grok").notNull().default(0),
  scoreTotal: integer("score_total").notNull().default(0),
  chatgptFound: boolean("chatgpt_found").notNull().default(false),
  geminiFound: boolean("gemini_found").notNull().default(false),
  perplexityFound: boolean("perplexity_found").notNull().default(false),
  claudeFound: boolean("claude_found").notNull().default(false),
  grokFound: boolean("grok_found").notNull().default(false),
  keywordsUsed: jsonb("keywords_used").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompetitorAudit = typeof competitorAuditsTable.$inferSelect;
