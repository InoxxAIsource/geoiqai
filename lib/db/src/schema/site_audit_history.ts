import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const siteAuditHistoryTable = pgTable("site_audit_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  domain: text("domain").notNull(),
  siteHealthScore: integer("site_health_score").notNull(),
  aiHealthScore: integer("ai_health_score").notNull(),
  errorsCount: integer("errors_count").notNull().default(0),
  warningsCount: integer("warnings_count").notNull().default(0),
  results: jsonb("results"),
  auditedAt: timestamp("audited_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteAuditHistory = typeof siteAuditHistoryTable.$inferSelect;
