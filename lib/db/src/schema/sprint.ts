import { pgTable, uuid, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const sprintSessionsTable = pgTable("sprint_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  domain: text("domain").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  targetScore: integer("target_score").default(30).notNull(),
  currentScore: integer("current_score").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const sprintProgressTable = pgTable("sprint_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  domain: text("domain").notNull(),
  stepId: text("step_id").notNull(),
  phase: integer("phase").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  scoreBefore: integer("score_before").default(0),
  scoreAfter: integer("score_after").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqUserDomainStep: unique("sprint_progress_user_domain_step").on(t.userId, t.domain, t.stepId),
}));

export type SprintSession = typeof sprintSessionsTable.$inferSelect;
export type SprintProgress = typeof sprintProgressTable.$inferSelect;
