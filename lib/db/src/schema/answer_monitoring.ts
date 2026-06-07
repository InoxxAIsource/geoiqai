import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const answerMonitoringPromptsTable = pgTable("answer_monitoring_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  domain: text("domain").notNull(),
  prompt: text("prompt").notNull(),
  llms: text("llms").notNull().default("ChatGPT"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const answerMonitoringResultsTable = pgTable("answer_monitoring_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: uuid("prompt_id").notNull(),
  userId: uuid("user_id").notNull(),
  domain: text("domain").notNull(),
  llm: text("llm").notNull(),
  mentioned: boolean("mentioned").notNull().default(false),
  position: integer("position"),
  fullResponse: text("full_response"),
  brandContext: text("brand_context"),
  sentiment: text("sentiment").notNull().default("neutral"),
  urlCited: boolean("url_cited").notNull().default(false),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export type AnswerMonitoringPrompt = typeof answerMonitoringPromptsTable.$inferSelect;
export type AnswerMonitoringResult = typeof answerMonitoringResultsTable.$inferSelect;
