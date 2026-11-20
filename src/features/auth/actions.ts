"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, revokeAllSessions } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request";
import { setThemeCookies } from "@/lib/theme-server";
import { isLoginLocked, LOGIN_LOCK_MINUTES } from "./rate-limit";
import { changePasswordSchema, type FormState, loginSchema } from "./schema";

const INVALID_LOGIN = "Username atau password salah.";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { username: String(formData.get("username") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { message: INVALID_LOGIN, values: { username: raw.username } };
  }
  const { username, password } = parsed.data;
  const meta = await getRequestMeta();

  if (await isLoginLocked(username, meta.ip)) {
    return {
      message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${LOGIN_LOCK_MINUTES} menit.`,
      values: { username },
    };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, palette: users.palette, themeMode: users.themeMode })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const ok = user ? await verifyPassword(user.passwordHash, password) : (await burnPasswordCheck(password), false);

  if (!user || !ok) {
    await logActivity({
      userId: user?.id ?? null,
      action: "login_failed",
      entity: "auth",
      diff: { username },
      ip: meta.ip,
    });
    return { message: INVALID_LOGIN, values: { username } };
  }

  await createSession(user.id, meta);
  await setThemeCookies(user.palette, user.themeMode); // device baru langsung pakai tema akun
  await logActivity({
    userId: user.id,
    action: "login",
    entity: "auth",
    ip: meta.ip,
    diff: { userAgent: meta.userAgent },
  });

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout(): Promise<void> {
  const meta = await getRequestMeta();
  const userId = await destroyCurrentSession();
  if (userId) await logActivity({ userId, action: "logout", entity: "auth", ip: meta.ip });
  redirect("/login");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    return { fieldErrors: { currentPassword: ["Password lama salah"] } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id));
  // Ganti password → keluarkan semua device lain.
  await revokeAllSessions(user.id, user.sessionId);

  const meta = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "password", ip: meta.ip });
  revalidatePath("/settings");
  return { ok: true, message: "Password berhasil diganti. Sesi di device lain sudah dikeluarkan." };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  if (sessionId === user.sessionId) return; // pakai tombol Keluar untuk sesi sendiri
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  const meta = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "session", entityId: sessionId, ip: meta.ip });
  revalidatePath("/settings");
}

export async function revokeOtherSessions(): Promise<void> {
  const user = await requireUser();
  await revokeAllSessions(user.id, user.sessionId);
  const meta = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "session", diff: { scope: "others" }, ip: meta.ip });
  revalidatePath("/settings");
}
