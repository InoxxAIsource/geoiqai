import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const integrationsWaitlistTable = pgTable("integrations_waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  integration: text("integration").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationsWaitlistSchema = createInsertSchema(integrationsWaitlistTable).omit({ id: true, createdAt: true });
export type InsertIntegrationsWaitlist = z.infer<typeof insertIntegrationsWaitlistSchema>;
export type IntegrationsWaitlist = typeof integrationsWaitlistTable.$inferSelect;
