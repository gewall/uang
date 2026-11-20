import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" });

/** Untung/rugi: panah + nominal bertanda + persen (tidak bergantung warna saja). */
export function PnL({
  value,
  ratio,
  currency = "IDR",
  className,
  compact,
}: {
  value: number;
  ratio?: number | null;
  currency?: Currency;
  className?: string;
  compact?: boolean;
}) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        value > 0 && "text-income",
        value < 0 && "text-expense",
        value === 0 && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>
        {formatMoney(value, currency, { signed: true, compact })}
        {ratio !== null && ratio !== undefined && <span className="opacity-80"> ({pct.format(ratio)})</span>}
      </span>
    </span>
  );
}
