"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, transactions, wallets } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { getRequestMeta } from "@/lib/request";
import { transactionFormSchema } from "./schema";

export type TransactionFormState = FormState & { again?: boolean };

const revalidate = () => ["/transaksi", "/dompet", "/dashboard", "/budget"].forEach((p) => revalidatePath(p));

export async function saveTransaction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const user = await requireUser();
  const parsed = transactionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, intent, ...v } = parsed.data;

  // dompet & kategori harus milik user ini
  const walletIds = [v.walletId, v.toWalletId].filter((x): x is string => Boolean(x));
  const owned = await db
    .select({ id: wallets.id, currency: wallets.currency })
    .from(wallets)
    .where(and(eq(wallets.userId, user.id), inArray(wallets.id, walletIds)));
  const from = owned.find((w) => w.id === v.walletId);
  const to = owned.find((w) => w.id === v.toWalletId);
  if (!from) return { fieldErrors: { walletId: ["Dompet tidak ditemukan"] } };
  if (v.type === "transfer") {
    if (!to) return { fieldErrors: { toWalletId: ["Dompet tujuan tidak ditemukan"] } };
    if (from.currency !== to.currency && !v.toAmount) {
      return { fieldErrors: { toAmount: [`Isi nominal yang diterima dalam ${to.currency}`] } };
    }
    if (from.currency === to.currency) v.toAmount = null;
  }
  if (v.categoryId) {
    const [cat] = await db
      .select({ kind: categories.kind })
      .from(categories)
      .where(and(eq(categories.id, v.categoryId), eq(categories.userId, user.id)));
    if (!cat || cat.kind !== v.type)
      return { fieldErrors: { categoryId: ["Kategori tidak cocok dengan jenis transaksi"] } };
  }

  const { ip } = await getRequestMeta();
  const values = {
    type: v.type,
    walletId: v.walletId,
    toWalletId: v.toWalletId,
    categoryId: v.categoryId,
    amount: v.amount,
    toAmount: v.toAmount,
    fee: v.fee,
    occurredAt: v.occurredAt,
    note: v.note,
    tags: v.tags,
  };

  if (id) {
    const [before] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    if (!before) return { message: "Transaksi tidak ditemukan." };
    await db
      .update(transactions)
      .set(values)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    const { tags, ...scalar } = values;
    const diff = changedFields(before, scalar) ?? {};
    if (before.tags.join(",") !== tags.join(",")) diff.tags = { from: before.tags, to: tags };
    if (Object.keys(diff).length)
      await logActivity({ userId: user.id, action: "update", entity: "transaction", entityId: id, diff, ip });
    revalidate();
    return { ok: true, message: "Transaksi diperbarui." };
  }

  const [created] = await db
    .insert(transactions)
    .values({ ...values, userId: user.id })
    .returning({ id: transactions.id });
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "transaction",
    entityId: created.id,
    diff: { type: v.type, amount: v.amount, walletId: v.walletId, categoryId: v.categoryId },
    ip,
  });
  revalidate();
  return { ok: true, message: "Transaksi disimpan.", again: intent === "again" };
}

export async function deleteTransaction(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ type: transactions.type, amount: transactions.amount, occurredAt: transactions.occurredAt });
  if (!row) return { message: "Transaksi tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "transaction", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: "Transaksi dihapus." };
}
