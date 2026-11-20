import "server-only";
import { and, eq, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import type { RequestMeta } from "@/lib/request";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSessionToken, verifySessionToken } from "./jwt";

function cookieSecure() {
  return process.env.COOKIE_SECURE !== "false";
}

/** Buat baris session + set cookie JWT. Hanya boleh dipanggil dari Server Action / Route Handler. */
export async function createSession(userId: string, meta: RequestMeta): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const [row] = await db
    .insert(sessions)
    .values({ userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent })
    .returning({ id: sessions.id });

  const token = await signSessionToken({ sid: row.id, sub: userId }, expiresAt);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Cabut session aktif (dari cookie) dan hapus cookie-nya. */
export async function destroyCurrentSession(): Promise<string | null> {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  if (!claims) return null;
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, claims.sid), isNull(sessions.revokedAt)));
  return claims.sub;
}

/** Cabut semua session user, opsional kecuali satu (session yang sedang dipakai). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    );
}
