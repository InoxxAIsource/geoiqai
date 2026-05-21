import { pgTable, text, uuid, date, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rateLimitsTable = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  ipAddress: text("ip_address").notNull(),
  auditCount: integer("audit_count").notNull().default(1),
  date: date("date").notNull().defaultNow(),
}, (t) => [
  unique().on(t.ipAddress, t.date),
]);

export const insertRateLimitSchema = createInsertSchema(rateLimitsTable).omit({ id: true });
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type RateLimit = typeof rateLimitsTable.$inferSelect;
