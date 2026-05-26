import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const dataforseoCacheTable = pgTable("dataforseo_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  costUsd: text("cost_usd"),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type DataforseoCache = typeof dataforseoCacheTable.$inferSelect;
