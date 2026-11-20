"use client";

import type { ReactNode } from "react";
import { EntityIcon } from "@/components/entity-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CategoryOption = {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: "income" | "expense";
  archivedAt: Date | null;
  children: Omit<CategoryOption, "children">[];
};

export type WalletOptionItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  currency: string;
  archivedAt: Date | null;
};

const label = (o: { name: string; icon: string; color: string }, sub?: string): ReactNode => (
  <span className="flex min-w-0 items-center gap-2">
    <EntityIcon icon={o.icon} color={o.color} size="sm" />
    <span className="truncate">{o.name}</span>
    {sub && <span className="ml-auto pl-2 text-xs text-muted-foreground">{sub}</span>}
  </span>
);

/** Pilih kategori: induk lalu subkategori (menjorok). Kategori arsip disembunyikan kecuali sedang terpilih. */
export function CategorySelect({
  name,
  value,
  onValueChange,
  options,
  placeholder = "Pilih kategori",
  invalid,
  allowAll,
  className,
}: {
  name?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: CategoryOption[];
  placeholder?: string;
  invalid?: boolean;
  /** tambahkan pilihan "Semua kategori" (value "") untuk filter */
  allowAll?: boolean;
  className?: string;
}) {
  const visible = options
    .filter((c) => !c.archivedAt || c.id === value || c.children.some((k) => k.id === value))
    .map((c) => ({ ...c, children: c.children.filter((k) => !k.archivedAt || k.id === value) }));

  const items: Record<string, ReactNode> = {};
  if (allowAll) items[""] = "Semua kategori";
  for (const c of visible) {
    items[c.id] = label(c);
    for (const k of c.children) items[k.id] = label(k, c.name);
  }

  return (
    <Select
      name={name}
      items={items}
      value={allowAll ? value : value || null}
      onValueChange={(v) => onValueChange((v as string) ?? "")}
    >
      <SelectTrigger className={cn("w-full", className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={allowAll ? "Semua kategori" : placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {allowAll && <SelectItem value="">Semua kategori</SelectItem>}
        {visible.map((c) => (
          <SelectGroup key={c.id}>
            <SelectItem value={c.id}>{label(c)}</SelectItem>
            {c.children.map((k) => (
              <SelectItem key={k.id} value={k.id} className="pl-7">
                {label(k)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {visible.length === 0 && <SelectLabel>Belum ada kategori</SelectLabel>}
      </SelectContent>
    </Select>
  );
}

export function WalletSelect({
  name,
  value,
  onValueChange,
  options,
  placeholder = "Pilih dompet",
  invalid,
  allowAll,
  exclude,
  className,
}: {
  name?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: WalletOptionItem[];
  placeholder?: string;
  invalid?: boolean;
  allowAll?: boolean;
  /** sembunyikan dompet ini (mis. dompet asal saat memilih tujuan transfer) */
  exclude?: string;
  className?: string;
}) {
  const visible = options.filter((w) => (!w.archivedAt || w.id === value) && w.id !== exclude);
  const items: Record<string, ReactNode> = {};
  if (allowAll) items[""] = "Semua dompet";
  for (const w of visible) items[w.id] = label(w, w.currency !== "IDR" ? w.currency : undefined);

  return (
    <Select
      name={name}
      items={items}
      value={allowAll ? value : value || null}
      onValueChange={(v) => onValueChange((v as string) ?? "")}
    >
      <SelectTrigger className={cn("w-full", className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={allowAll ? "Semua dompet" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="">Semua dompet</SelectItem>}
        {visible.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {items[w.id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
