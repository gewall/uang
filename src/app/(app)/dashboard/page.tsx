import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BudgetMeter } from "@/components/budget-meter";
import { EntityIcon } from "@/components/entity-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowChart } from "@/features/dashboard/components/cashflow-chart";
import { changeRatio, getDashboard } from "@/features/dashboard/queries";
import { requireUser } from "@/lib/auth/dal";
import { formatMonth, formatTime, formatDayHeader, wibDateKey } from "@/lib/dates";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const pct = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboard(user.id);
  const incomeChange = changeRatio(d.thisMonth.income, d.lastMonth.income);
  const expenseChange = changeRatio(d.thisMonth.expense, d.lastMonth.expense);

  return (
    <div className="grid gap-5">
      <PageHeader title={`Halo, ${user.username}`} description={`Ringkasan keuanganmu · ${formatMonth(d.month)}`} />

      {/* ── stat tiles ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Kekayaan bersih"
          icon={<Landmark className="size-4 text-primary" />}
          value={formatMoney(d.netWorth)}
          compactValue={formatMoney(d.netWorth, "IDR", { compact: true })}
          footer={[
            d.investments > 0
              ? `termasuk investasi ${formatMoney(d.investments, "IDR", { compact: true })}`
              : `${d.wallets.length} dompet aktif`,
            ...d.foreign.map(([c, v]) => `+ ${formatMoney(v, c as Currency)}`),
          ].join(" · ")}
          href="/dompet"
        />
        <StatTile
          label="Pemasukan"
          icon={<ArrowDownLeft className="size-4 text-income" />}
          value={formatMoney(d.thisMonth.income)}
          compactValue={formatMoney(d.thisMonth.income, "IDR", { compact: true })}
          footer={<Delta ratio={incomeChange} upIsGood />}
          href="/transaksi?tipe=income"
        />
        <StatTile
          label="Pengeluaran"
          icon={<ArrowUpRight className="size-4 text-expense" />}
          value={formatMoney(d.thisMonth.expense)}
          compactValue={formatMoney(d.thisMonth.expense, "IDR", { compact: true })}
          footer={<Delta ratio={expenseChange} upIsGood={false} />}
          href="/transaksi?tipe=expense"
        />
        <StatTile
          label={d.budget.totalRemaining < 0 ? "Lewat budget" : "Sisa budget"}
          icon={<PiggyBank className="size-4 text-warning" />}
          value={d.budget.hasBudgets ? formatMoney(Math.abs(d.budget.totalRemaining)) : "—"}
          compactValue={
            d.budget.hasBudgets ? formatMoney(Math.abs(d.budget.totalRemaining), "IDR", { compact: true }) : "—"
          }
          footer={d.budget.hasBudgets ? `${pct.format(d.budget.totalRatio)} terpakai` : "Belum ada budget"}
          href="/budget"
          danger={d.budget.totalRemaining < 0}
        />
      </div>

      {/* ── arus kas + top pengeluaran ─────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Arus kas</CardTitle>
            <CardDescription>Pemasukan vs pengeluaran 6 bulan terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <CashflowChart data={d.cashflow} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pengeluaran terbesar</CardTitle>
            <CardDescription className="tabular-nums">Bulan ini · total {formatMoney(d.totalExpense)}</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
            ) : (
              <ul className="grid gap-3.5">
                {d.topExpenses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/transaksi?kategori=${c.id}&tipe=expense`} className="group grid gap-1.5">
                      <div className="flex items-center gap-2.5">
                        <EntityIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm group-hover:underline">{c.name}</span>
                        <span className="text-sm font-medium tabular-nums">{formatMoney(c.amount)}</span>
                        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                          {pct.format(c.share)}
                        </span>
                      </div>
                      {/* bar proporsi: satu hue (magnitude), track langkah lebih terang */}
                      <div className="ml-9.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-expense"
                          style={{ width: `${Math.max(2, c.share * 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── budget, dompet, transaksi terbaru ──────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Budget</CardTitle>
            <CardDescription>Kategori paling mendekati batas</CardDescription>
            <CardAction>
              <SeeAll href="/budget" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {d.budget.lines.length === 0 ? (
              <EmptyHint text="Belum ada budget bulan ini." href="/budget" cta="Atur budget" />
            ) : (
              <ul className="grid gap-4">
                {d.budget.lines.map((l) => (
                  <li key={l.id} className="grid gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <EntityIcon icon={l.icon} color={l.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(l.spent, "IDR", { compact: true })} /{" "}
                        {formatMoney(l.amount, "IDR", { compact: true })}
                      </span>
                    </div>
                    <BudgetMeter ratio={l.ratio} status={l.status} remaining={l.remaining} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldo dompet</CardTitle>
            <CardAction>
              <SeeAll href="/dompet" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {d.wallets.length === 0 ? (
              <EmptyHint text="Belum ada dompet." href="/dompet" cta="Tambah dompet" />
            ) : (
              <ul className="divide-y">
                {d.wallets.slice(0, 6).map((w) => (
                  <li key={w.id}>
                    <Link href={`/transaksi?dompet=${w.id}`} className="flex items-center gap-3 py-2 hover:underline">
                      <EntityIcon icon={w.icon} color={w.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{w.name}</span>
                      <span className={cn("text-sm font-medium tabular-nums", w.balance < 0 && "text-expense")}>
                        {formatMoney(w.balance, w.currency as Currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Transaksi terbaru</CardTitle>
            <CardAction>
              <SeeAll href="/transaksi" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {d.recent.length === 0 ? (
              <EmptyHint text="Belum ada transaksi bulan ini." href="/transaksi?baru=1" cta="Catat transaksi" />
            ) : (
              <ul className="divide-y">
                {d.recent.map((t) => {
                  const isTransfer = t.type === "transfer";
                  const title = t.note || t.counterparty || (isTransfer ? "Transfer" : t.categoryName) || "—";
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      {isTransfer ? (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ArrowLeftRight className="size-3.5" />
                        </span>
                      ) : (
                        <EntityIcon icon={t.categoryIcon ?? "tag"} color={t.categoryColor ?? "slate"} size="sm" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDayHeader(wibDateKey(t.occurredAt))} · {formatTime(t.occurredAt)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium whitespace-nowrap tabular-nums",
                          t.type === "income" && "text-income",
                          t.type === "expense" && "text-expense",
                          isTransfer && "text-muted-foreground",
                        )}
                      >
                        {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                        {formatMoney(t.amount, t.walletCurrency as Currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  icon,
  value,
  compactValue,
  footer,
  href,
  danger,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  compactValue: string;
  footer: ReactNode;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link href={href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring">
      <Card size="sm" className="h-full transition-colors group-hover:bg-muted/40">
        <CardContent className="grid gap-1">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {icon}
            <span className="truncate">{label}</span>
          </p>
          <p className={cn("text-lg font-semibold tracking-tight tabular-nums sm:text-2xl", danger && "text-expense")}>
            <span className="sm:hidden">{compactValue}</span>
            <span className="hidden sm:inline">{value}</span>
          </p>
          <div className="truncate text-xs text-muted-foreground">{footer}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Perubahan vs bulan lalu: panah + teks (tidak bergantung warna saja). */
function Delta({ ratio, upIsGood }: { ratio: number | null; upIsGood: boolean }) {
  if (ratio === null) return <span>Bulan lalu: —</span>;
  const up = ratio > 0;
  const good = ratio === 0 ? null : up === upIsGood;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn("inline-flex items-center gap-1", good === true && "text-income", good === false && "text-expense")}
    >
      <Icon className="size-3.5" aria-hidden />
      {up ? "naik" : ratio < 0 ? "turun" : "sama"} {pct.format(Math.abs(ratio))} vs bulan lalu
    </span>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Button variant="ghost" size="xs" render={<Link href={href} />} nativeButton={false}>
      Semua <ChevronRight />
    </Button>
  );
}

function EmptyHint({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="grid justify-items-center gap-2 py-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button variant="outline" size="sm" render={<Link href={href} />} nativeButton={false}>
        {cta}
      </Button>
    </div>
  );
}
