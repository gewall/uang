"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PocketMapping } from "@/lib/import/plan";
import type { ImportPocket } from "@/lib/import/types";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type MappingWallet = { id: string; name: string; currency: string; balance: number; archivedAt: Date | null };

/** Satu kantong: pilih dompet tujuan + proyeksi saldo setelah import. */
export function PocketMappingRow({
  pocket,
  mapping,
  onChange,
  wallets,
  effect,
  showStatementBalance,
}: {
  pocket: ImportPocket;
  mapping: PocketMapping;
  onChange: (m: PocketMapping) => void;
  wallets: MappingWallet[];
  /** perubahan saldo dari transaksi yang akan diimport ke kantong ini (sen) */
  effect: number;
  showStatementBalance: boolean;
}) {
  const cur = pocket.currency as Currency;
  const same = wallets.filter((w) => w.currency === pocket.currency && !w.archivedAt);
  const value = mapping.mode === "existing" ? `w:${mapping.walletId}` : mapping.mode;
  const items: Record<string, string> = { new: "Buat dompet baru", skip: "Lewati kantong ini" };
  for (const w of same) items[`w:${w.id}`] = w.name;

  // proyeksi saldo: dompet baru mulai dari saldo awal laporan; dompet lama dari saldonya sekarang
  const existing = mapping.mode === "existing" ? wallets.find((w) => w.id === mapping.walletId) : undefined;
  const start = mapping.mode === "new" ? (showStatementBalance ? pocket.opening : 0) : (existing?.balance ?? 0);
  const projected = start + effect;
  const matches = pocket.closing !== null && projected === pocket.closing;

  return (
    <div className={cn("grid gap-3 rounded-lg border p-3", mapping.mode === "skip" && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {pocket.name}
            {pocket.currency !== "IDR" && <Badge variant="outline">{pocket.currency}</Badge>}
            {!pocket.consistent && (
              <Badge variant="destructive" className="gap-1">
                <CircleAlert className="size-3" /> saldo tidak cocok
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {pocket.rows.length} baris
            {showStatementBalance &&
              ` · saldo ${formatMoney(pocket.opening, cur, { precision: "exact" })} → ${formatMoney(pocket.closing ?? 0, cur, { precision: "exact" })}`}
          </p>
        </div>
        <Select
          items={items}
          value={value}
          onValueChange={(v) => {
            if (!v) return;
            if (v === "new") onChange({ mode: "new", name: pocket.name });
            else if (v === "skip") onChange({ mode: "skip" });
            else onChange({ mode: "existing", walletId: String(v).slice(2) });
          }}
        >
          <SelectTrigger className="w-full sm:w-60" aria-label={`Dompet untuk ${pocket.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Buat dompet baru</SelectItem>
            {same.length > 0 && (
              <SelectGroup>
                <SelectLabel>Dompet yang sudah ada</SelectLabel>
                {same.map((w) => (
                  <SelectItem key={w.id} value={`w:${w.id}`}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectItem value="skip">Lewati kantong ini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mapping.mode === "new" && (
        <Input
          value={mapping.name}
          onChange={(e) => onChange({ mode: "new", name: e.target.value })}
          maxLength={50}
          aria-label={`Nama dompet baru untuk ${pocket.name}`}
          className="sm:w-80"
        />
      )}

      {mapping.mode !== "skip" && pocket.rows.length > 0 && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs tabular-nums",
            matches ? "text-income" : "text-muted-foreground",
          )}
        >
          {matches ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
          Saldo setelah import: {formatMoney(projected, cur, { precision: "exact" })}
          {showStatementBalance &&
            (matches
              ? " — sama dengan saldo akhir laporan"
              : mapping.mode === "existing"
                ? " (dompet lama: saldo sekarang + transaksi baru)"
                : "")}
        </p>
      )}
    </div>
  );
}
