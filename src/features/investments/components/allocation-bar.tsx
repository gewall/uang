import { formatMoney } from "@/lib/money";
import type { AllocationPart } from "../queries";

const pct = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 });

/**
 * Segmented bar tipis (8px, ujung bulat, celah 2px warna surface) — satu keseluruhan dibagi per jenis aset.
 * Legend di bawahnya menyebut nama, nilai, dan persen (sekaligus berfungsi sebagai tampilan tabel).
 */
export function AllocationBar({ parts }: { parts: AllocationPart[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total <= 0) return null;
  const sorted = [...parts].sort((a, b) => a.slot - b.slot); // urutan warna tetap
  const label = sorted.map((p) => `${p.label} ${pct.format(p.value / total)}`).join(", ");

  return (
    <div className="grid gap-3">
      <div role="img" aria-label={`Alokasi portofolio: ${label}`} className="flex h-2 w-full gap-0.5">
        {sorted.map((p) => (
          <div
            key={p.type}
            title={`${p.label}: ${formatMoney(p.value)} (${pct.format(p.value / total)})`}
            className="h-full rounded-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(p.value / total) * 100}%`, background: `var(--cat-${p.slot})`, minWidth: 4 }}
          />
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {sorted.map((p) => (
          <li key={p.type} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: `var(--cat-${p.slot})` }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="tabular-nums">{formatMoney(p.value)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {pct.format(p.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
