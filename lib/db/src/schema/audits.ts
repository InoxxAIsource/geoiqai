import { pgTable, text, uuid, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditsTable = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  brandName: text("brand_name"),
  category: text("category"),
  market: text("market"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  scoreTotal: integer("score_total").notNull().default(0),
  scoreChatgpt: integer("score_chatgpt").notNull().default(0),
  scoreGemini: integer("score_gemini").notNull().default(0),
  scorePerplexity: integer("score_perplexity").notNull().default(0),
  chatgptFound: boolean("chatgpt_found").notNull().default(false),
  geminiFound: boolean("gemini_found").notNull().default(false),
  perplexityFound: boolean("perplexity_found").notNull().default(false),
  chatgptDetail: text("chatgpt_detail"),
  geminiDetail: text("gemini_detail"),
  perplexityDetail: text("perplexity_detail"),
  competitorsFound: jsonb("competitors_found").$type<string[]>().notNull().default([]),
  keywordsUsed: jsonb("keywords_used").$type<string[]>().notNull().default([]),
  recommendations: jsonb("recommendations").$type<Record<string, unknown>[]>().notNull().default([]),
  rawResults: jsonb("raw_results").$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text("ip_address"),
  isPaid: boolean("is_paid").notNull().default(false),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true });
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
