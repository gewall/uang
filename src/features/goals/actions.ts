"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { goals, wallets } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { COLOR_KEYS, ICON_KEYS } from "@/lib/appearance-options";
import { requireUser } from "@/lib/auth/dal";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { parseMoneyInput } from "@/lib/money";
import { getRequestMeta } from "@/lib/request";
import { isDateKey } from "../recurring/schedule";

const revalidate = () => ["/target", "/dashboard"].forEach((p) => revalidatePath(p));

const money = (label: string, { allowZero = false } = {}) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim())
        return allowZero ? 0 : (ctx.addIssue({ code: "custom", message: `${label} wajib diisi` }), z.NEVER);
      const minor = parseMoneyInput(v);
      if (minor === null || minor < 0 || (!allowZero && minor === 0)) {
        ctx.addIssue({ code: "custom", message: `${label} harus lebih dari 0` });
        return z.NEVER;
      }
      return minor;
    });

const goalSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nama wajib diisi").max(60, "Maksimal 60 karakter"),
  targetAmount: money("Target"),
  savedAmount: money("Terkumpul", { allowZero: true }),
  walletId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  targetDate: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isDateKey(v), "Tanggal tidak valid"),
  icon: z.enum(ICON_KEYS as [string, ...string[]]),
  color: z.enum(COLOR_KEYS as [string, ...string[]]),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
});

export async function saveGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;
  if (data.walletId) {
    const [w] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.id, data.walletId), eq(wallets.userId, user.id)));
    if (!w) return { fieldErrors: { walletId: ["Dompet tidak ditemukan"] } };
  }
  const { ip } = await getRequestMeta();

  if (id) {
    const [before] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
    if (!before) return { message: "Target tidak ditemukan." };
    await db.update(goals).set(data).where(eq(goals.id, id));
    const diff = changedFields(before, data);
    if (diff) await logActivity({ userId: user.id, action: "update", entity: "goal", entityId: id, diff, ip });
    revalidate();
    return { ok: true, message: `Target "${data.name}" diperbarui.` };
  }
  const [created] = await db
    .insert(goals)
    .values({ ...data, userId: user.id })
    .returning({ id: goals.id });
  await logActivity({ userId: user.id, action: "create", entity: "goal", entityId: created.id, diff: { ...data }, ip });
  revalidate();
  return { ok: true, message: `Target "${data.name}" dibuat.` };
}

/** Tambah/kurangi setoran manual (target tanpa dompet tertaut). */
export async function addGoalDeposit(id: string, raw: string, withdraw = false): Promise<FormState> {
  const user = await requireUser();
  const minor = parseMoneyInput(raw);
  if (minor === null || minor <= 0) return { message: "Nominal harus lebih dari 0." };
  const [g] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  if (!g) return { message: "Target tidak ditemukan." };
  if (g.walletId) return { message: "Progres target ini mengikuti saldo dompet." };
  const savedAmount = Math.max(0, g.savedAmount + (withdraw ? -minor : minor));
  await db.update(goals).set({ savedAmount }).where(eq(goals.id, id));
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "update",
    entity: "goal",
    entityId: id,
    diff: { savedAmount: { from: g.savedAmount, to: savedAmount } },
    ip,
  });
  revalidate();
  return { ok: true, message: withdraw ? "Penarikan dicatat." : "Setoran dicatat." };
}

export async function setGoalArchived(id: string, archived: boolean): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .update(goals)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, user.id),
        archived ? isNull(goals.archivedAt) : isNotNull(goals.archivedAt),
      ),
    )
    .returning({ name: goals.name });
  if (!row) return { message: "Target tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "goal", entityId: id, diff: { archived }, ip });
  revalidate();
  return { ok: true, message: archived ? `"${row.name}" diarsipkan.` : `"${row.name}" diaktifkan lagi.` };
}

export async function deleteGoal(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
    .returning({ name: goals.name, targetAmount: goals.targetAmount });
  if (!row) return { message: "Target tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "goal", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: `"${row.name}" dihapus.` };
}
