import { pgTable, text, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { auditsTable } from "./audits";

export const roadmapTasksTable = pgTable(
  "roadmap_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => auditsTable.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.auditId, t.taskId)],
);

export type RoadmapTask = typeof roadmapTasksTable.$inferSelect;
