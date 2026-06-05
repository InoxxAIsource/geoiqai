import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const promptTrackingTable = pgTable("prompt_tracking", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  prompt: text("prompt").notNull(),
  platform: text("platform").notNull().default("google"),
  topic: text("topic"),
  yourDomain: text("your_domain"),
  competitorDomain: text("competitor_domain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PromptTracking = typeof promptTrackingTable.$inferSelect;
