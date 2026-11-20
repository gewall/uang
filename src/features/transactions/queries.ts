import "server-only";
import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, investmentTxns, transactions, wallets } from "@/db/schema";
import { monthRange } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";
import type { TransactionFilters } from "./filters";

const toWallets = alias(wallets, "to_wallets");
const parentCats = alias(categories, "parent_categories");

export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>["items"][number];

async function buildWhere(userId: string, f: TransactionFilters): Promise<SQL> {
  const { start, end } = monthRange(f.month);
  const conds: (SQL | undefined)[] = [
    eq(transactions.userId, userId),
    gte(transactions.occurredAt, start),
    lt(transactions.occurredAt, end),
  ];

  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.walletId) conds.push(or(eq(transactions.walletId, f.walletId), eq(transactions.toWalletId, f.walletId)));
  if (f.tag) conds.push(sql`${f.tag} = any(${transactions.tags})`);

  if (f.categoryId) {
    // kategori induk ikut menyertakan subkategorinya
    const ids = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.userId, userId), or(eq(categories.id, f.categoryId), eq(categories.parentId, f.categoryId))),
      );
    conds.push(
      ids.length
        ? inArray(
            transactions.categoryId,
            ids.map((r) => r.id),
          )
        : sql`false`,
    );
  }

  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const amount = parseMoneyInput(f.q);
    conds.push(
      or(
        ilike(transactions.note, like),
        ilike(transactions.counterparty, like),
        ilike(categories.name, like),
        sql`array_to_string(${transactions.tags}, ' ') ilike ${like}`,
        amount !== null && amount > 0 ? eq(transactions.amount, amount) : undefined,
      ),
    );
  }
  return and(...conds)!;
}

export async function listTransactions(userId: string, f: TransactionFilters) {
  const where = await buildWhere(userId, f);

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      toAmount: transactions.toAmount,
      fee: transactions.fee,
      occurredAt: transactions.occurredAt,
      note: transactions.note,
      counterparty: transactions.counterparty,
      tags: transactions.tags,
      source: transactions.source,
      excludeFromStats: transactions.excludeFromStats,
      investmentAssetId: investmentTxns.assetId,
      walletId: transactions.walletId,
      toWalletId: transactions.toWalletId,
      categoryId: transactions.categoryId,
      walletName: wallets.name,
      walletCurrency: wallets.currency,
      toWalletName: toWallets.name,
      toWalletCurrency: toWallets.currency,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      parentCategoryName: parentCats.name,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(toWallets, eq(toWallets.id, transactions.toWalletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parentCats, eq(parentCats.id, categories.parentId))
    .leftJoin(investmentTxns, eq(investmentTxns.transactionId, transactions.id))
    .where(where)
    .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
    .limit(f.limit + 1);

  // ringkasan periode+filter (hanya dompet IDR; transfer tidak dihitung sebagai pemasukan/pengeluaran)
  const [summary] = await db
    .select({
      income:
        sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
          Number,
        ),
      expense:
        sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
          Number,
        ),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(where, eq(wallets.currency, "IDR"), eq(transactions.excludeFromStats, false)));

  return {
    items: rows.slice(0, f.limit),
    hasMore: rows.length > f.limit,
    summary,
  };
}

/** Tag yang pernah dipakai (untuk saran filter), paling sering dulu. */
export async function listTags(userId: string): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(sql`
    select tag from (
      select unnest(${transactions.tags}) as tag from ${transactions} where ${transactions.userId} = ${userId}
    ) t group by tag order by count(*) desc, tag limit 50`);
  return rows.map((r) => r.tag);
}
