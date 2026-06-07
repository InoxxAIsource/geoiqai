import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";

export const apiCostLogTable = pgTable("api_cost_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("system"),
  endpoint: text("endpoint").notNull(),
  costUsd: real("cost_usd").notNull(),
  domain: text("domain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
