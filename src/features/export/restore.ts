"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  budgets,
  categories,
  categorizationRules,
  debtPayments,
  debts,
  goals,
  investmentAssets,
  investmentTxns,
  recurringRules,
  transactions,
  wallets,
} from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import type { FormState } from "@/lib/form";
import { getRequestMeta } from "@/lib/request";

const MAX_BYTES = 50 * 1024 * 1024;
type Row = Record<string, unknown>;

const backupSchema = z.object({
  app: z.literal("uang"),
  version: z.literal(1),
  data: z.object({
    wallets: z.array(z.record(z.string(), z.unknown())),
    categories: z.array(z.record(z.string(), z.unknown())),
    transactions: z.array(z.record(z.string(), z.unknown())),
    budgets: z.array(z.record(z.string(), z.unknown())),
    investmentAssets: z.array(z.record(z.string(), z.unknown())),
    investmentTxns: z.array(z.record(z.string(), z.unknown())),
    categorizationRules: z.array(z.record(z.string(), z.unknown())),
    // fase 10 — opsional supaya backup lama tetap bisa dipulihkan
    recurringRules: z.array(z.record(z.string(), z.unknown())).default([]),
    goals: z.array(z.record(z.string(), z.unknown())).default([]),
    debts: z.array(z.record(z.string(), z.unknown())).default([]),
    debtPayments: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

/** Kolom timestamp tersimpan sebagai string ISO di JSON → Date. */
const DATE_FIELDS = ["createdAt", "updatedAt", "archivedAt", "occurredAt", "priceUpdatedAt", "settledAt"];
function revive(rows: Row[], userId: string): Row[] {
  return rows.map((r) => {
    const out: Row = { ...r, userId };
    for (const f of DATE_FIELDS) if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
    return out;
  });
}

async function insertChunks<T>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  for (let i = 0; i < rows.length; i += 500) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.insert(table).values(rows.slice(i, i + 500) as any);
  }
}

/** Pulihkan backup JSON ke akun yang masih kosong (belum ada dompet/transaksi/aset). */
export async function restoreBackup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Pilih file backup (.json)." };
  if (file.size > MAX_BYTES) return { message: "File terlalu besar." };

  let parsed: z.infer<typeof backupSchema>;
  try {
    parsed = backupSchema.parse(JSON.parse(await file.text()));
  } catch {
    return { message: "File bukan backup uang yang valid." };
  }

  const [w, t, a] = await Promise.all([
    db.$count(wallets, eq(wallets.userId, user.id)),
    db.$count(transactions, eq(transactions.userId, user.id)),
    db.$count(investmentAssets, eq(investmentAssets.userId, user.id)),
  ]);
  if (w + t + a > 0) {
    return { message: "Restore hanya bisa ke akun yang masih kosong (belum ada dompet, transaksi, atau aset)." };
  }

  const d = parsed.data;
  // ID baru untuk setiap baris + petakan ulang semua relasi → restore tetap bisa walau akun asal masih ada di DB ini
  const ids = new Map<string, string>();
  const newId = (old: unknown) => {
    if (typeof old !== "string") return old;
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old)!;
  };
  const ref = (old: unknown) => (typeof old === "string" ? (ids.get(old) ?? null) : null);
  const withId = (rows: Row[]): Row[] => revive(rows, user.id).map((r) => ({ ...r, id: newId(r.id) }));

  // urutan penting: entitas yang direferensikan dibuat ID-nya dulu
  const walletRows = withId(d.wallets);
  const assetRows = withId(d.investmentAssets);
  const catRows = withId(d.categories)
    .map((c) => ({ ...c, parentId: c.parentId ? ref(c.parentId) : null }))
    .sort((x, y) => Number(Boolean(x.parentId)) - Number(Boolean(y.parentId))); // induk dulu
  const recurringRows = withId(d.recurringRules).map((r) => ({
    ...r,
    walletId: ref(r.walletId),
    toWalletId: r.toWalletId ? ref(r.toWalletId) : null,
    categoryId: r.categoryId ? ref(r.categoryId) : null,
  }));
  // externalId transaksi berulang memuat id aturan → ikut dipetakan supaya tidak tercatat ulang
  const remapExternal = (v: unknown) => {
    if (typeof v !== "string" || !v.startsWith("rec:")) return v;
    const [, rule, date] = v.split(":");
    const mapped = ids.get(rule);
    return mapped ? `rec:${mapped}:${date}` : v;
  };
  const txRows = withId(d.transactions).map((x) => ({
    ...x,
    externalId: remapExternal(x.externalId),
    walletId: ref(x.walletId),
    toWalletId: x.toWalletId ? ref(x.toWalletId) : null,
    categoryId: x.categoryId ? ref(x.categoryId) : null,
    importBatchId: null,
  }));
  const budgetRows = withId(d.budgets).map((b) => ({ ...b, categoryId: ref(b.categoryId) }));
  const invRows = withId(d.investmentTxns).map((i) => ({
    ...i,
    assetId: ref(i.assetId),
    transactionId: i.transactionId ? ref(i.transactionId) : null,
  }));
  const ruleRows = withId(d.categorizationRules).map((r) => ({ ...r, categoryId: ref(r.categoryId) }));
  const goalRows = withId(d.goals).map((g) => ({ ...g, walletId: g.walletId ? ref(g.walletId) : null }));
  const debtRows = withId(d.debts);
  const paymentRows = withId(d.debtPayments).map((p) => ({ ...p, debtId: ref(p.debtId) }));

  try {
    await db.transaction(async (tx) => {
      // akun kosong: kategori default boleh diganti seluruhnya dengan isi backup
      await tx.delete(categorizationRules).where(eq(categorizationRules.userId, user.id));
      await tx.delete(budgets).where(eq(budgets.userId, user.id));
      await tx.delete(categories).where(eq(categories.userId, user.id));
      await tx.delete(goals).where(eq(goals.userId, user.id));
      await tx.delete(debts).where(eq(debts.userId, user.id));
      await insertChunks(categories, catRows, tx);
      await insertChunks(wallets, walletRows, tx);
      await insertChunks(transactions, txRows, tx);
      await insertChunks(budgets, budgetRows, tx);
      await insertChunks(investmentAssets, assetRows, tx);
      await insertChunks(investmentTxns, invRows, tx);
      await insertChunks(categorizationRules, ruleRows, tx);
      await insertChunks(recurringRules, recurringRows, tx);
      await insertChunks(goals, goalRows, tx);
      await insertChunks(debts, debtRows, tx);
      await insertChunks(debtPayments, paymentRows, tx);
    });
  } catch {
    return { message: "Restore gagal — data backup tidak konsisten atau ID sudah dipakai. Tidak ada yang diubah." };
  }

  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "import",
    entity: "backup",
    diff: { wallets: d.wallets.length, transactions: d.transactions.length, categories: d.categories.length },
    ip,
  });
  for (const p of ["/dashboard", "/dompet", "/transaksi", "/kategori", "/budget", "/investasi"]) revalidatePath(p);
  return { ok: true, message: `Backup dipulihkan: ${d.wallets.length} dompet, ${d.transactions.length} transaksi.` };
}
