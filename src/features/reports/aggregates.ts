import "server-only";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions, wallets } from "@/db/schema";
import { monthRange, shiftMonth, TZ } from "@/lib/dates";

// Catatan: semua agregat hanya menghitung dompet IDR (dompet USD ditampilkan terpisah, tanpa kurs)
// dan mengabaikan transaksi exclude_from_stats (mis. beli/jual investasi).

/** Pengeluaran per category_id (sen) dalam rentang [start, end). */
export async function expenseByCategory(userId: string, start: Date, end: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`sum(${transactions.amount})`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        eq(wallets.currency, "IDR"),
        eq(transactions.excludeFromStats, false),
        isNotNull(transactions.categoryId),
        gte(transactions.occurredAt, start),
        lt(transactions.occurredAt, end),
      ),
    )
    .groupBy(transactions.categoryId);
  return new Map(rows.map((r) => [r.categoryId!, r.total]));
}

/** Rata-rata pengeluaran per kategori dalam N bulan sebelum `month` (tidak termasuk bulan itu). */
export async function averageExpenseByCategory(userId: string, month: string, months = 3) {
  const start = monthRange(shiftMonth(month, -months)).start;
  const end = monthRange(month).start;
  const totals = await expenseByCategory(userId, start, end);
  return new Map([...totals].map(([id, v]) => [id, Math.round(v / months)]));
}

/** Pemasukan & pengeluaran per bulan WIB untuk `count` bulan terakhir s.d. `month` (urut lama → baru). */
export async function monthlyCashflow(userId: string, month: string, count = 6) {
  const first = shiftMonth(month, -(count - 1));
  const start = monthRange(first).start;
  const end = monthRange(month).end;
  // TZ ditulis literal (bukan parameter) supaya ekspresi di SELECT & GROUP BY identik bagi Postgres
  const monthExpr = sql<string>`to_char(${transactions.occurredAt} at time zone ${sql.raw(`'${TZ}'`)}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
      income:
        sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
          Number,
        ),
      expense:
        sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
          Number,
        ),
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(wallets.currency, "IDR"),
        eq(transactions.excludeFromStats, false),
        gte(transactions.occurredAt, start),
        lt(transactions.occurredAt, end),
      ),
    )
    .groupBy(monthExpr);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: count }, (_, i) => {
    const m = shiftMonth(first, i);
    const r = byMonth.get(m);
    return { month: m, income: r?.income ?? 0, expense: r?.expense ?? 0 };
  });
}

/** Daftar kategori ringkas (id, parent, tampilan) untuk menggulung & menampilkan agregat. */
export async function categoryRefs(userId: string) {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      kind: categories.kind,
      archivedAt: categories.archivedAt,
    })
    .from(categories)
    .where(eq(categories.userId, userId));
}

export type CategoryRefRow = Awaited<ReturnType<typeof categoryRefs>>[number];
