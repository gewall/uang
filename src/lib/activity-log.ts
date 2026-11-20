import "server-only";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";

type Action = (typeof activityLogs.$inferInsert)["action"];

export type LogInput = {
  userId: string | null;
  action: Action;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
};

/** Catat event ke activity_logs. Jangan masukkan password / API key ke `diff`. */
export async function logActivity(input: LogInput): Promise<void> {
  await db.insert(activityLogs).values({
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    diff: input.diff ?? null,
    ip: input.ip ?? null,
  });
}
