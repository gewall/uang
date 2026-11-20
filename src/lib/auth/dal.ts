import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "./jwt";

export type CurrentUser = {
  id: string;
  username: string;
  palette: "warm" | "cold";
  sessionId: string;
};

/**
 * Data Access Layer: satu-satunya jalan membaca user yang login.
 * Verifikasi JWT lalu cek baris session di DB (belum dicabut & belum kedaluwarsa).
 * Di-memo per request dengan React `cache` (bukan "use cache: private", supaya session
 * yang dicabut langsung tidak berlaku). Membaca cookie → pemanggil harus di dalam <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const [row] = await db
    .select({ id: users.id, username: users.username, palette: users.palette })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, claims.sid),
        eq(sessions.userId, claims.sub),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ? { ...row, sessionId: claims.sid } : null;
});

/** Seperti getCurrentUser, tapi redirect ke /login bila belum login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
