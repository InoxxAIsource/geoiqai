import { pgTable, text, uuid, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailSubscribersTable = pgTable("email_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  domain: text("domain"),
  auditId: uuid("audit_id"),
  auditCountMonth: integer("audit_count_month").notNull().default(1),
  monthResetDate: date("month_reset_date").notNull().$default(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString().slice(0, 10);
  }),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribersTable).omit({ id: true, subscribedAt: true });
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;
export type EmailSubscriber = typeof emailSubscribersTable.$inferSelect;
