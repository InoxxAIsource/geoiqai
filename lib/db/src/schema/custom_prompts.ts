import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const customPromptsTable = pgTable("custom_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  promptText: text("prompt_text").notNull(),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type CustomPrompt = typeof customPromptsTable.$inferSelect;
