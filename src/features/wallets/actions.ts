"use server";

import { and, eq, isNotNull, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { wallets } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { type FormState, fieldErrorsOf, isForeignKeyViolation, isUniqueViolation } from "@/lib/form";
import { getRequestMeta } from "@/lib/request";
import { walletFormSchema } from "./schema";

const PATHS = ["/dompet", "/dashboard", "/transaksi"];
const revalidate = () => PATHS.forEach((p) => revalidatePath(p));

export async function saveWallet(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = walletFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;
  const { ip } = await getRequestMeta();

  try {
    if (id) {
      const [before] = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)));
      if (!before) return { message: "Dompet tidak ditemukan." };
      await db
        .update(wallets)
        .set(data)
        .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)));
      const diff = changedFields(before, data);
      if (diff) await logActivity({ userId: user.id, action: "update", entity: "wallet", entityId: id, diff, ip });
      revalidate();
      return { ok: true, message: `Dompet "${data.name}" diperbarui.` };
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: max(wallets.sortOrder) })
      .from(wallets)
      .where(eq(wallets.userId, user.id));
    const [created] = await db
      .insert(wallets)
      .values({ ...data, userId: user.id, sortOrder: (maxOrder ?? -1) + 1 })
      .returning({ id: wallets.id });
    await logActivity({
      userId: user.id,
      action: "create",
      entity: "wallet",
      entityId: created.id,
      diff: { ...data },
      ip,
    });
    revalidate();
    return { ok: true, message: `Dompet "${data.name}" ditambahkan.` };
  } catch (err) {
    if (isUniqueViolation(err, "wallets_user_name_uq")) {
      return { fieldErrors: { name: ["Sudah ada dompet dengan nama ini"] } };
    }
    throw err;
  }
}

export async function setWalletArchived(id: string, archived: boolean): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .update(wallets)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        eq(wallets.id, id),
        eq(wallets.userId, user.id),
        archived ? isNull(wallets.archivedAt) : isNotNull(wallets.archivedAt),
      ),
    )
    .returning({ name: wallets.name });
  if (!row) return { message: "Dompet tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "wallet", entityId: id, diff: { archived }, ip });
  revalidate();
  return { ok: true, message: archived ? `"${row.name}" diarsipkan.` : `"${row.name}" diaktifkan lagi.` };
}

export async function deleteWallet(id: string): Promise<FormState> {
  const user = await requireUser();
  let row: { name: string; initialBalance: number } | undefined;
  try {
    [row] = await db
      .delete(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
      .returning({ name: wallets.name, initialBalance: wallets.initialBalance });
  } catch (err) {
    // transaksi mereferensikan dompet (FK restrict) → sarankan arsip
    if (isForeignKeyViolation(err)) return { message: "Dompet ini masih punya transaksi. Arsipkan saja." };
    throw err;
  }
  if (!row) return { message: "Dompet tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "wallet", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: `"${row.name}" dihapus.` };
}
