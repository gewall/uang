import "server-only";
import { currentMonth, monthRange } from "@/lib/dates";
import { getBudgetOverview } from "../budgets/queries";
import { rollupToRoot } from "../budgets/math";
import { categoryRefs, expenseByCategory, monthlyCashflow } from "../reports/aggregates";
import { listPortfolio } from "../investments/queries";
import { listTransactions } from "../transactions/queries";
import { listWallets } from "../wallets/queries";

export async function getDashboard(userId: string, now = new Date()) {
  const month = currentMonth(now);
  const { start, end } = monthRange(month);

  const [wallets, cashflow, cats, spent, budget, recent, portfolio] = await Promise.all([
    listWallets(userId),
    monthlyCashflow(userId, month, 6),
    categoryRefs(userId),
    expenseByCategory(userId, start, end),
    getBudgetOverview(userId, month, now),
    listTransactions(userId, { month, limit: 6 }),
    listPortfolio(userId),
  ]);

  const active = wallets.filter((w) => !w.archivedAt);
  const cash = active.filter((w) => w.currency === "IDR").reduce((n, w) => n + w.balance, 0);
  const investments = portfolio.summary.marketValue;
  const netWorth = cash + investments;
  const foreign = new Map<string, number>();
  for (const w of active) if (w.currency !== "IDR") foreign.set(w.currency, (foreign.get(w.currency) ?? 0) + w.balance);

  const thisMonth = cashflow[cashflow.length - 1];
  const lastMonth = cashflow[cashflow.length - 2];

  // top pengeluaran bulan ini, digulung ke kategori induk
  const catById = new Map(cats.map((c) => [c.id, c]));
  const rolled = rollupToRoot(cats, spent);
  const totalExpense = [...rolled.values()].reduce((n, v) => n + v, 0);
  const topExpenses = [...rolled.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => {
      const c = catById.get(id);
      return {
        id,
        amount,
        share: totalExpense ? amount / totalExpense : 0,
        name: c?.name ?? "?",
        icon: c?.icon ?? "tag",
        color: c?.color ?? "slate",
      };
    });

  return {
    month,
    netWorth,
    cash,
    investments,
    foreign: [...foreign.entries()],
    wallets: active,
    cashflow,
    thisMonth,
    lastMonth,
    topExpenses,
    totalExpense,
    budget: {
      hasBudgets: budget.lines.length > 0,
      totalBudget: budget.totalBudget,
      totalSpent: budget.totalSpent,
      totalRemaining: budget.totalRemaining,
      totalRatio: budget.totalRatio,
      daily: budget.daily,
      lines: budget.lines.filter((l) => !l.nested).slice(0, 4),
    },
    recent: recent.items,
  };
}

/** Perubahan relatif terhadap bulan lalu; null bila bulan lalu 0. */
export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
