import { HandCoins, PiggyBank, Repeat } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtItem } from "@/features/debts/queries";
import type { GoalItem } from "@/features/goals/queries";
import type { RecurringItem } from "@/features/recurring/queries";
import { daysBetween, formatDateKey } from "@/features/recurring/schedule";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const inDays = (n: number) => (n <= 0 ? "hari ini" : n === 1 ? "besok" : `${n} hari lagi`);

/** Pengingat: jadwal berulang 7 hari ke depan, hutang/piutang jatuh tempo, target aktif. Kosong → tidak tampil. */
export function Reminders({
  recurring,
  debts,
  goals,
  today,
}: {
  recurring: RecurringItem[];
  debts: DebtItem[];
  goals: GoalItem[];
  today: string;
}) {
  const soon = recurring.filter((r) => r.rule.active && daysBetween(today, r.rule.nextDate) <= 7).slice(0, 5);
  const dueDebts = debts.filter((d) => d.status === "overdue" || d.status === "due-soon").slice(0, 5);
  const activeGoals = goals.filter((g) => !g.archivedAt && !g.progress.done).slice(0, 3);
  if (soon.length + dueDebts.length + activeGoals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengingat</CardTitle>
        <CardDescription>Jadwal & tenggat terdekat</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {soon.length > 0 && (
          <Section icon={Repeat} title="Transaksi berulang" href="/berulang">
            {soon.map(({ rule: r, wallet }) => (
              <Row
                key={r.id}
                label={r.name}
                sub={`${formatDateKey(r.nextDate)} · ${inDays(daysBetween(today, r.nextDate))}`}
                value={`${r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}${formatMoney(r.amount, wallet.currency as Currency)}`}
                tone={r.type === "income" ? "text-income" : r.type === "expense" ? "text-expense" : ""}
              />
            ))}
          </Section>
        )}
        {dueDebts.length > 0 && (
          <Section icon={HandCoins} title="Hutang & piutang" href="/hutang">
            {dueDebts.map((d) => (
              <Row
                key={d.id}
                label={`${d.direction === "payable" ? "Bayar ke" : "Tagih"} ${d.person}`}
                sub={d.status === "overdue" ? `telat ${-(d.daysLeft ?? 0)} hari` : inDays(d.daysLeft ?? 0)}
                value={formatMoney(d.remaining)}
                tone={d.status === "overdue" ? "text-expense" : ""}
              />
            ))}
          </Section>
        )}
        {activeGoals.length > 0 && (
          <Section icon={PiggyBank} title="Target tabungan" href="/target">
            {activeGoals.map((g) => (
              <Row
                key={g.id}
                label={g.name}
                sub={
                  g.progress.perMonth
                    ? `perlu ${formatMoney(g.progress.perMonth)}/bln`
                    : `kurang ${formatMoney(g.progress.remaining)}`
                }
                value={`${Math.round(g.progress.ratio * 100)}%`}
              />
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: typeof Repeat;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid content-start gap-2">
      <Link href={href} className="flex items-center gap-2 text-sm font-medium hover:underline">
        <Icon className="size-4 text-muted-foreground" /> {title}
      </Link>
      <ul className="grid gap-2">{children}</ul>
    </section>
  );
}

function Row({ label, sub, value, tone }: { label: string; sub: string; value: string; tone?: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <span className={cn("font-medium whitespace-nowrap tabular-nums", tone)}>{value}</span>
    </li>
  );
}
