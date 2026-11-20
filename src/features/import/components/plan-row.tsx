"use client";

import { ArrowLeftRight } from "lucide-react";
import { memo, type ReactNode } from "react";
import { EntityIcon } from "@/components/entity-icon";
import type { CategoryOption } from "@/components/entity-select";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime } from "@/lib/dates";
import type { PlannedRow, RowOverride, WalletRef } from "@/lib/import/plan";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TransferTarget = { ref: WalletRef; name: string };

const dayFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/** Satu baris rencana import + kontrol koreksi. memo: daftar bisa ratusan baris. */
export const PlanRowItem = memo(function PlanRowItem({
  row,
  categories,
  transferTargets,
  originalType,
  onOverride,
}: {
  row: PlannedRow;
  categories: CategoryOption[];
  transferTargets: TransferTarget[];
  /** jenis baris sebelum dikoreksi user (untuk menentukan pilihan kategori) */
  originalType: PlannedRow["type"];
  onOverride: (key: string, patch: RowOverride | null) => void;
}) {
  const date = new Date(row.occurredAt);
  const isPair = originalType === "transfer";
  const kind = row.type === "transfer" ? originalType : row.type;
  const dup = row.status === "duplicate";

  const label = (icon: string, color: string, name: string): ReactNode => (
    <span className="flex min-w-0 items-center gap-2">
      <EntityIcon icon={icon} color={color} size="sm" />
      <span className="truncate">{name}</span>
    </span>
  );
  const items: Record<string, ReactNode> = {};
  const cats = categories.filter((c) => c.kind === kind && !c.archivedAt);
  for (const c of cats) {
    items[`c:${c.id}`] = label(c.icon, c.color, c.name);
    for (const k of c.children) if (!k.archivedAt) items[`c:${k.id}`] = label(k.icon, k.color, `${c.name} › ${k.name}`);
  }
  const targets = transferTargets.filter((t) => t.ref !== row.from && t.ref !== row.to);
  for (const t of targets)
    items[`t:${t.ref}`] = (
      <span className="flex items-center gap-2">
        <ArrowLeftRight className="size-3.5" /> {kind === "income" ? "Dari" : "Ke"} {t.name}
      </span>
    );
  const value =
    row.type === "transfer" && !isPair ? `t:${kind === "income" ? row.from : row.to}` : `c:${row.categoryId}`;

  return (
    <li
      className={cn(
        // minmax(0,1fr): kolom boleh menyempit walau ada teks truncate (whitespace-nowrap)
        "grid grid-cols-[minmax(0,1fr)] gap-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3",
        (!row.include || dup) && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3 sm:contents">
        <input
          type="checkbox"
          checked={row.include}
          disabled={dup}
          onChange={(e) => onOverride(row.key, { include: e.target.checked })}
          className="mt-1 size-4 shrink-0 accent-primary sm:mt-0"
          aria-label={`Ikutkan ${row.counterparty}`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium">{row.counterparty}</span>
            {dup && <Badge variant="secondary">sudah ada</Badge>}
            {row.include && row.excludeFromStats && row.type !== "transfer" && (
              <Badge variant="outline" className="text-[10px]">
                tidak dihitung statistik
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {dayFmt.format(date)} {formatTime(date)} · {row.kindLabel} · {row.pocketName}
            {row.toPocketName ? ` → ${row.toPocketName}` : ""}
            {row.note ? ` · ${row.note}` : ""}
          </p>
          {row.hints.length > 0 && <p className="text-[11px] text-muted-foreground/80">{row.hints.join(" · ")}</p>}
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums sm:order-last",
            row.type === "income" && "text-income",
            row.type === "expense" && "text-expense",
            row.type === "transfer" && "text-muted-foreground",
          )}
        >
          {row.type === "income" ? "+" : row.type === "expense" ? "−" : ""}
          {formatMoney(row.amount, "IDR", { precision: "exact" })}
        </span>
      </div>

      {!isPair && !dup && (
        <div className="flex flex-wrap items-center gap-2 pl-7 sm:col-span-3 sm:pl-7">
          <Select
            items={items}
            value={value}
            onValueChange={(v) => {
              if (!v) return;
              const s = String(v);
              if (s.startsWith("t:")) onOverride(row.key, { toWallet: s.slice(2) as WalletRef, categoryId: undefined });
              else onOverride(row.key, { categoryId: s.slice(2), toWallet: undefined });
            }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-72" aria-label={`Kategori untuk ${row.counterparty}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectGroup>
                <SelectLabel>Kategori {kind === "income" ? "pemasukan" : "pengeluaran"}</SelectLabel>
                {cats.flatMap((c) => [
                  <SelectItem key={c.id} value={`c:${c.id}`}>
                    {items[`c:${c.id}`]}
                  </SelectItem>,
                  ...c.children
                    .filter((k) => !k.archivedAt)
                    .map((k) => (
                      <SelectItem key={k.id} value={`c:${k.id}`} className="pl-7">
                        {label(k.icon, k.color, k.name)}
                      </SelectItem>
                    )),
                ])}
              </SelectGroup>
              {targets.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Sebenarnya transfer {kind === "income" ? "dari" : "ke"} dompet</SelectLabel>
                  {targets.map((t) => (
                    <SelectItem key={t.ref} value={`t:${t.ref}`}>
                      {items[`t:${t.ref}`]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {row.type !== "transfer" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={!row.excludeFromStats}
                onChange={(e) => onOverride(row.key, { excludeFromStats: !e.target.checked })}
                className="size-3.5 accent-primary"
              />
              hitung di statistik
            </label>
          )}
        </div>
      )}
    </li>
  );
});
