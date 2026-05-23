import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";

export const citationsTable = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id"),
  brandId: uuid("brand_id"),
  aiSystem: text("ai_system").notNull(),
  prompt: text("prompt"),
  citedUrl: text("cited_url"),
  citedDomain: text("cited_domain"),
  citationType: text("citation_type").default("authority"),
  timesCited: integer("times_cited").default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
});

export type Citation = typeof citationsTable.$inferSelect;
