import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const journalistContactsTable = pgTable(
  "journalist_contacts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    domain: text("domain").notNull(),
    email: text("email"),
    emailConfidence: integer("email_confidence"),
    emailType: text("email_type"),
    emailVerified: boolean("email_verified"),
    emailNote: text("email_note"),
    emailPattern: text("email_pattern"),
    twitter: text("twitter"),
    twitterUrl: text("twitter_url"),
    linkedinUrl: text("linkedin_url"),
    lookedUpAt: timestamp("looked_up_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("journalist_contacts_name_domain").on(t.name, t.domain)]
);

export type JournalistContact = typeof journalistContactsTable.$inferSelect;
export type NewJournalistContact = typeof journalistContactsTable.$inferInsert;
