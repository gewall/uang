import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { BudgetStatus } from "@/features/budgets/math";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS = {
  // hijau → amber → merah (bukan primary: di palet Warm primary-nya amber, bentrok dengan warning)
  ok: { label: "Aman", icon: CircleCheck, fill: "bg-income", text: "text-muted-foreground" },
  warning: { label: "Hampir habis", icon: TriangleAlert, fill: "bg-warning", text: "text-foreground" },
  over: { label: "Lewat budget", icon: CircleAlert, fill: "bg-expense", text: "text-expense" },
} satisfies Record<BudgetStatus, unknown>;

/**
 * Meter budget: isi menunjukkan tingkat (aman → hampir habis → lewat), track = langkah lebih terang.
 * Status selalu disertai ikon + teks (tidak bergantung warna saja).
 */
export function BudgetMeter({
  ratio,
  status,
  remaining,
  compact,
}: {
  ratio: number;
  status: BudgetStatus;
  remaining: number;
  compact?: boolean;
}) {
  const s = STATUS[status];
  const pct = Math.round(ratio * 100);
  return (
    <div className="grid gap-1.5">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-valuetext={`${pct}% terpakai, ${s.label}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", s.fill)}
          style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 2 : 0, pct))}%` }}
        />
      </div>
      {!compact && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn("flex items-center gap-1", s.text)}>
            <s.icon className="size-3.5 shrink-0" aria-hidden />
            {s.label} · {pct}%
          </span>
          <span className={cn("tabular-nums", remaining < 0 ? "text-expense" : "text-muted-foreground")}>
            {remaining < 0 ? `lewat ${formatMoney(-remaining)}` : `sisa ${formatMoney(remaining)}`}
          </span>
        </div>
      )}
    </div>
  );
}
