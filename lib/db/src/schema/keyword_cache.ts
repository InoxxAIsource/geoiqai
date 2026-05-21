import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

export interface KeywordData {
  keyword: string;
  volume: number;
  competition: number;
}

export const keywordCacheTable = pgTable("keyword_cache", {
  id: serial("id").primaryKey(),
  domain: text("domain").unique().notNull(),
  keywords: jsonb("keywords").$type<KeywordData[]>().notNull().default([]),
  locationCode: integer("location_code").notNull().default(2840),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type KeywordCache = typeof keywordCacheTable.$inferSelect;
