"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, recurringRules, wallets } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { wibDateKey } from "@/lib/dates";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { getRequestMeta } from "@/lib/request";
import { postDueRecurring } from "./posting";
import { firstOnOrAfter } from "./schedule";
import { recurringFormSchema } from "./schema";

const revalidate = () => ["/berulang", "/transaksi", "/dashboard", "/dompet"].forEach((p) => revalidatePath(p));

/** Pastikan dompet & kategori milik user ini. */
async function ownsRefs(userId: string, walletIds: (string | null)[], categoryId: string | null) {
  const ids = walletIds.filter((x): x is string => Boolean(x));
  const ws = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), inArray(wallets.id, ids)));
  if (ws.length !== new Set(ids).size) return false;
  if (!categoryId) return true;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)));
  return Boolean(c);
}

export async function saveRecurring(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = recurringFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;
  if (!(await ownsRefs(user.id, [data.walletId, data.toWalletId], data.categoryId))) {
    return { message: "Dompet atau kategori tidak ditemukan." };
  }
  const { ip } = await getRequestMeta();
  const today = wibDateKey(new Date());

  if (id) {
    const [before] = await db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));
    if (!before) return { message: "Jadwal tidak ditemukan." };
    const scheduleChanged =
      before.startDate !== data.startDate || before.frequency !== data.frequency || before.interval !== data.interval;
    // jadwal diubah → mulai dari jadwal berikutnya (tidak membuat transaksi mundur)
    const nextDate = scheduleChanged ? firstOnOrAfter(data, today) : before.nextDate;
    await db
      .update(recurringRules)
      .set({ ...data, nextDate })
      .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));
    const diff = changedFields(before, data);
    if (diff) await logActivity({ userId: user.id, action: "update", entity: "recurring", entityId: id, diff, ip });
    revalidate();
    return { ok: true, message: `Jadwal "${data.name}" diperbarui.` };
  }

  // jadwal baru: tanggal mulai di masa lalu ikut dicatat (mis. gaji tgl 25 bulan lalu)
  const [created] = await db
    .insert(recurringRules)
    .values({ ...data, userId: user.id, nextDate: data.startDate })
    .returning({ id: recurringRules.id });
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "recurring",
    entityId: created.id,
    diff: { ...data },
    ip,
  });
  const posted = await postDueRecurring(user.id);
  revalidate();
  return {
    ok: true,
    message: posted > 0 ? `Jadwal disimpan, ${posted} transaksi yang sudah jatuh tempo dicatat.` : "Jadwal disimpan.",
  };
}

export async function setRecurringActive(id: string, active: boolean): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));
  if (!row) return { message: "Jadwal tidak ditemukan." };
  // dilanjutkan → lompati jadwal selama dijeda (tidak menumpuk transaksi lama)
  const nextDate = active ? firstOnOrAfter(row, wibDateKey(new Date())) : row.nextDate;
  if (active && row.endDate && nextDate > row.endDate) return { message: "Jadwal ini sudah melewati tanggal akhir." };
  await db.update(recurringRules).set({ active, nextDate }).where(eq(recurringRules.id, id));
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "recurring", entityId: id, diff: { active }, ip });
  revalidate();
  return { ok: true, message: active ? `"${row.name}" dilanjutkan.` : `"${row.name}" dijeda.` };
}

export async function deleteRecurring(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)))
    .returning({ name: recurringRules.name, amount: recurringRules.amount });
  if (!row) return { message: "Jadwal tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "recurring", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: `"${row.name}" dihapus. Transaksi yang sudah tercatat tetap ada.` };
}
