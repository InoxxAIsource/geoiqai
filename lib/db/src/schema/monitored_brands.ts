import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const monitoredBrandsTable = pgTable("monitored_brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  domain: text("domain").notNull(),
  brandName: text("brand_name"),
  category: text("category"),
  market: text("market"),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  competitors: jsonb("competitors").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
});

export const insertMonitoredBrandSchema = createInsertSchema(monitoredBrandsTable).omit({ id: true, createdAt: true });
export type InsertMonitoredBrand = z.infer<typeof insertMonitoredBrandSchema>;
export type MonitoredBrand = typeof monitoredBrandsTable.$inferSelect;
