import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { BudgetMeter } from "@/components/budget-meter";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetsView } from "@/features/budgets/components/budgets-view";
import { statusOf } from "@/features/budgets/math";
import { getBudgetOverview } from "@/features/budgets/queries";
import { listCategoryTree } from "@/features/categories/queries";
import { requireUser } from "@/lib/auth/dal";
import { currentMonth, isMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const user = await requireUser();
  const { bulan } = await searchParams;
  const month = isMonth(bulan) ? bulan : currentMonth();
  const [overview, tree] = await Promise.all([getBudgetOverview(user.id, month), listCategoryTree(user.id)]);
  const hasBudgets = overview.lines.length > 0;

  const summary = (
    <div className="grid gap-3">
      <MonthNav month={month} basePath="/budget" className="sm:w-80" />
      {hasBudgets && (
        <Card size="sm">
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
              {[
                { label: "Total budget", value: overview.totalBudget },
                { label: "Terpakai", value: overview.totalSpent },
                { label: overview.totalRemaining < 0 ? "Lewat" : "Sisa", value: Math.abs(overview.totalRemaining) },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="truncate text-base font-semibold tabular-nums sm:text-2xl">
                    <span className="sm:hidden">{formatMoney(s.value, "IDR", { compact: true })}</span>
                    <span className="hidden sm:inline">{formatMoney(s.value)}</span>
                  </p>
                </div>
              ))}
            </div>
            <BudgetMeter
              ratio={overview.totalRatio}
              status={statusOf(overview.totalRatio)}
              remaining={overview.totalRemaining}
            />
            {overview.daily && (
              <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {overview.daily.perDay > 0 ? (
                    <>
                      Bisa belanja <b className="tabular-nums">{formatMoney(overview.daily.perDay)}</b>/hari untuk{" "}
                      {overview.daily.daysLeft} hari tersisa.
                    </>
                  ) : (
                    <>Budget bulan ini sudah habis — {overview.daily.daysLeft} hari lagi sampai bulan baru.</>
                  )}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="grid gap-5">
      <BudgetsView
        month={month}
        overview={overview}
        categories={tree.filter((c) => c.kind === "expense")}
        summary={summary}
      />
    </div>
  );
}
