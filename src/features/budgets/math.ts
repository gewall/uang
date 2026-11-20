// Perhitungan budget murni (tanpa DB) supaya bisa diunit-test.

export type CategoryRef = { id: string; parentId: string | null };
export type BudgetInput = { id: string; categoryId: string; amount: number };

export type BudgetStatus = "ok" | "warning" | "over";

export type BudgetLine = BudgetInput & {
  spent: number;
  remaining: number;
  /** 0..∞ (1 = 100%) */
  ratio: number;
  status: BudgetStatus;
  /** budget ini berada di bawah induk yang juga punya budget → tidak ikut dijumlah di total */
  nested: boolean;
};

export const WARNING_RATIO = 0.8;

export function statusOf(ratio: number): BudgetStatus {
  if (ratio > 1) return "over";
  if (ratio >= WARNING_RATIO) return "warning";
  return "ok";
}

/**
 * @param spentByCategory pengeluaran per category_id (sen), hanya kategori langsung (bukan rollup)
 */
export function computeBudgets(
  budgets: BudgetInput[],
  categories: CategoryRef[],
  spentByCategory: Map<string, number>,
) {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
  }
  const budgeted = new Set(budgets.map((b) => b.categoryId));

  /** kategori + subkategorinya */
  const scope = (categoryId: string) => [categoryId, ...(childrenOf.get(categoryId) ?? [])];
  const sumSpent = (ids: string[]) => ids.reduce((n, id) => n + (spentByCategory.get(id) ?? 0), 0);

  const lines: BudgetLine[] = budgets.map((b) => {
    const spent = sumSpent(scope(b.categoryId));
    const ratio = b.amount > 0 ? spent / b.amount : 0;
    const parent = parentOf.get(b.categoryId);
    return {
      ...b,
      spent,
      remaining: b.amount - spent,
      ratio,
      status: statusOf(ratio),
      nested: Boolean(parent && budgeted.has(parent)),
    };
  });

  // total: hanya budget "teratas" supaya induk+anak tidak dihitung dua kali
  const top = lines.filter((l) => !l.nested);
  const totalBudget = top.reduce((n, l) => n + l.amount, 0);
  const totalSpent = top.reduce((n, l) => n + l.spent, 0);

  // kategori yang tercakup budget (termasuk subkategori dari induk yang dibudget)
  const covered = new Set(top.flatMap((l) => scope(l.categoryId)));
  const totalExpense = [...spentByCategory.values()].reduce((n, v) => n + v, 0);
  const unbudgetedSpent = totalExpense - [...covered].reduce((n, id) => n + (spentByCategory.get(id) ?? 0), 0);

  // pengeluaran tanpa budget, digulung ke kategori induk
  const unbudgetedByRoot = new Map<string, number>();
  for (const [catId, amount] of spentByCategory) {
    if (covered.has(catId) || amount <= 0) continue;
    const root = parentOf.get(catId) ?? catId;
    // induk tidak dibudget tapi anak tertentu dibudget → anak lain tetap digulung ke induk
    unbudgetedByRoot.set(root, (unbudgetedByRoot.get(root) ?? 0) + amount);
  }

  return {
    lines,
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    totalRatio: totalBudget > 0 ? totalSpent / totalBudget : 0,
    totalExpense,
    unbudgetedSpent,
    unbudgeted: [...unbudgetedByRoot.entries()]
      .map(([categoryId, spent]) => ({ categoryId, spent }))
      .sort((a, b) => b.spent - a.spent),
  };
}

/** Jumlah per kategori digulung ke induknya (untuk "top pengeluaran" & rata-rata). */
export function rollupToRoot(categories: CategoryRef[], byCategory: Map<string, number>): Map<string, number> {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const out = new Map<string, number>();
  for (const [id, v] of byCategory) {
    const root = parentOf.get(id) ?? id;
    out.set(root, (out.get(root) ?? 0) + v);
  }
  return out;
}

/** Sisa budget per hari untuk sisa bulan (termasuk hari ini). null bila bulan sudah lewat / belum mulai. */
export function dailyAllowance(remaining: number, month: string, now: Date, monthEnd: Date, monthStart: Date) {
  if (now < monthStart || now >= monthEnd) return null;
  const msLeft = monthEnd.getTime() - now.getTime();
  const daysLeft = Math.max(1, Math.ceil(msLeft / 86_400_000));
  return { daysLeft, perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0, month };
}
