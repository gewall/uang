import "server-only";
import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
import { listWallets } from "../wallets/queries";

const toWallets = alias(wallets, "to_wallets");
const parents = alias(categories, "parent_categories");

export type ExportRange = { from?: Date; to?: Date };

/** Transaksi lengkap dengan nama dompet/kategori untuk CSV & Excel. */
export async function exportTransactions(userId: string, range: ExportRange) {
  const conds: SQL[] = [eq(transactions.userId, userId)];
  if (range.from) conds.push(gte(transactions.occurredAt, range.from));
  if (range.to) conds.push(lt(transactions.occurredAt, range.to));
  return db
    .select({
      id: transactions.id,
      occurredAt: transactions.occurredAt,
      type: transactions.type,
      amount: transactions.amount,
      toAmount: transactions.toAmount,
      fee: transactions.fee,
      note: transactions.note,
      counterparty: transactions.counterparty,
      tags: transactions.tags,
      source: transactions.source,
      excludeFromStats: transactions.excludeFromStats,
      wallet: wallets.name,
      currency: wallets.currency,
      toWallet: toWallets.name,
      category: categories.name,
      parentCategory: parents.name,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(toWallets, eq(toWallets.id, transactions.toWalletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parents, eq(parents.id, categories.parentId))
    .where(and(...conds))
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt));
}

export type ExportTxn = Awaited<ReturnType<typeof exportTransactions>>[number];

export async function exportSheets(userId: string) {
  const [walletRows, categoryRows, budgetRows, assets, invTxns] = await Promise.all([
    listWallets(userId),
    db
      .select({ name: categories.name, kind: categories.kind, parent: parents.name, archivedAt: categories.archivedAt })
      .from(categories)
      .leftJoin(parents, eq(parents.id, categories.parentId))
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.kind), asc(categories.sortOrder)),
    db
      .select({ month: budgets.month, amount: budgets.amount, category: categories.name })
      .from(budgets)
      .innerJoin(categories, eq(categories.id, budgets.categoryId))
      .where(eq(budgets.userId, userId))
      .orderBy(asc(budgets.month), asc(categories.name)),
    db.select().from(investmentAssets).where(eq(investmentAssets.userId, userId)).orderBy(asc(investmentAssets.name)),
    db
      .select({
        asset: investmentAssets.name,
        type: investmentTxns.type,
        occurredAt: investmentTxns.occurredAt,
        units: investmentTxns.units,
        price: investmentTxns.price,
        fee: investmentTxns.fee,
        amount: investmentTxns.amount,
        note: investmentTxns.note,
      })
      .from(investmentTxns)
      .innerJoin(investmentAssets, eq(investmentAssets.id, investmentTxns.assetId))
      .where(eq(investmentTxns.userId, userId))
      .orderBy(asc(investmentTxns.occurredAt)),
  ]);
  return { walletRows, categoryRows, budgetRows, assets, invTxns };
}

/** Backup lengkap: baris mentah semua tabel milik user (tanpa user_id), untuk restore. */
export async function exportBackup(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- userId sengaja dibuang dari backup
  const strip = <T extends { userId: string }>(rows: T[]) => rows.map(({ userId: _u, ...r }) => r);
  const [w, c, t, b, a, i, r, rr, g, d, dp] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(investmentAssets).where(eq(investmentAssets.userId, userId)),
    db.select().from(investmentTxns).where(eq(investmentTxns.userId, userId)),
    db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(debts).where(eq(debts.userId, userId)),
    db.select().from(debtPayments).where(eq(debtPayments.userId, userId)),
  ]);
  return {
    app: "uang",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      wallets: strip(w),
      categories: strip(c),
      // import batch tidak ikut di-backup → putuskan referensinya
      transactions: strip(t).map((x) => ({ ...x, importBatchId: null })),
      budgets: strip(b),
      investmentAssets: strip(a),
      investmentTxns: strip(i),
      categorizationRules: strip(r),
      recurringRules: strip(rr),
      goals: strip(g),
      debts: strip(d),
      debtPayments: strip(dp),
    },
  };
}
