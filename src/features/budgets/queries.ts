import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { monthRange, shiftMonth } from "@/lib/dates";
import { averageExpenseByCategory, categoryRefs, expenseByCategory } from "../reports/aggregates";
import { computeBudgets, dailyAllowance } from "./math";

export const monthDate = (month: string) => `${month}-01`;

export async function getBudgetOverview(userId: string, month: string, now = new Date()) {
  const { start, end } = monthRange(month);
  const [rows, cats, spent, avg, prevCount] = await Promise.all([
    db
      .select({ id: budgets.id, categoryId: budgets.categoryId, amount: budgets.amount })
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.month, monthDate(month)))),
    categoryRefs(userId),
    expenseByCategory(userId, start, end),
    averageExpenseByCategory(userId, month, 3),
    db.$count(budgets, and(eq(budgets.userId, userId), eq(budgets.month, monthDate(shiftMonth(month, -1))))),
  ]);

  const result = computeBudgets(rows, cats, spent);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const childrenOf = new Map<string, string[]>();
  for (const c of cats) if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
  // rata-rata 3 bulan, digulung untuk kategori induk
  const averageOf = (categoryId: string) =>
    [categoryId, ...(childrenOf.get(categoryId) ?? [])].reduce((n, id) => n + (avg.get(id) ?? 0), 0);

  const withCategory = <T extends { categoryId: string }>(x: T) => {
    const c = catById.get(x.categoryId);
    const parent = c?.parentId ? catById.get(c.parentId) : undefined;
    return {
      ...x,
      name: c?.name ?? "(kategori terhapus)",
      parentName: parent?.name ?? null,
      icon: c?.icon ?? "tag",
      color: c?.color ?? "slate",
      average: averageOf(x.categoryId),
    };
  };

  return {
    ...result,
    lines: result.lines.map(withCategory).sort((a, b) => b.ratio - a.ratio),
    unbudgeted: result.unbudgeted.map(withCategory),
    daily: dailyAllowance(result.totalRemaining, month, now, end, start),
    previousMonthHasBudgets: prevCount > 0,
    /** kategori pengeluaran aktif untuk pilihan di form, dengan rata-rata 3 bulan */
    expenseCategories: cats.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, average: averageOf(c.id) })),
  };
}

export type BudgetOverview = Awaited<ReturnType<typeof getBudgetOverview>>;
export type BudgetLineView = BudgetOverview["lines"][number];
