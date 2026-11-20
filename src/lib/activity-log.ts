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

/** Field yang berubah: { field: { from, to } }. Mengembalikan null bila tidak ada perubahan. */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> | null {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    const same = from instanceof Date && to instanceof Date ? from.getTime() === to.getTime() : from === to;
    if (!same) out[key] = { from, to };
  }
  return Object.keys(out).length ? out : null;
}

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
