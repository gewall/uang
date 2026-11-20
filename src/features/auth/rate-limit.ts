import "server-only";
import { and, count, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

/** true bila username ATAU ip sudah gagal login >= 5x dalam 15 menit terakhir. */
export async function isLoginLocked(username: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LOCK_MINUTES * 60_000);
  const byUsername = sql`${activityLogs.diff}->>'username' = ${username}`;
  const [row] = await db
    .select({ n: count() })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.action, "login_failed"),
        gt(activityLogs.createdAt, since),
        ip ? or(byUsername, eq(activityLogs.ip, ip)) : byUsername,
      ),
    );
  return (row?.n ?? 0) >= LOGIN_MAX_FAILURES;
}
