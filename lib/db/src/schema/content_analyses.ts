import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const contentAnalysesTable = pgTable("content_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  domain: text("domain").notNull(),
  sourceUrl: text("source_url"),
  targetTopic: text("target_topic").notNull(),
  score: integer("score").notNull(),
  scoreLabel: text("score_label").notNull(),
  factors: jsonb("factors").notNull().$type<Factor[]>(),
  topFixes: jsonb("top_fixes").notNull().$type<TopFix[]>(),
  missingPrompts: jsonb("missing_prompts").notNull().$type<string[]>(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
});

interface Factor {
  name: string;
  score: number;
  status: string;
  feedback: string;
  fix: string | null;
}

interface TopFix {
  priority: number;
  impact: string;
  title: string;
  description: string;
  timeToFix: string;
  scoreImpact: string;
  fix: string | null;
}

export type ContentAnalysis = typeof contentAnalysesTable.$inferSelect;
