"use client";

import { ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { type CategoryOption, CategorySelect, type WalletOptionItem, WalletSelect } from "@/components/entity-select";
import { Field } from "@/components/form-fields";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentMonth, formatMonth, shiftMonth } from "@/lib/dates";
import { activeFilterCount, filtersToSearch, type TransactionFilters } from "../filters";

const typeItems = { "": "Semua jenis", expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" };

export function TransactionFilterBar({
  filters,
  categories,
  wallets,
  tags,
}: {
  filters: TransactionFilters;
  categories: CategoryOption[];
  wallets: WalletOptionItem[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // filter berubah → reset limit paginasi
  const go = (patch: Partial<TransactionFilters>) =>
    startTransition(() =>
      router.replace(`${pathname}${filtersToSearch({ ...patch, limit: undefined }, filters)}`, { scroll: false }),
    );

  // sinkronkan input pencarian bila URL berubah dari luar (mis. tombol back)
  const [prevQ, setPrevQ] = useState(filters.q);
  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    setQ(filters.q ?? "");
  }
  useEffect(() => () => clearTimeout(debounce.current), []);

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => go({ q: value.trim() || undefined }), 350);
  };

  const count = activeFilterCount(filters);
  const isCurrent = filters.month === currentMonth();

  const typeSelect = (
    <Select
      items={typeItems}
      value={filters.type ?? ""}
      onValueChange={(v) => go({ type: (v as TransactionFilters["type"]) || undefined })}
    >
      <SelectTrigger className="w-full md:w-40" aria-label="Jenis">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(typeItems).map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const walletSelect = (
    <WalletSelect
      allowAll
      value={filters.walletId ?? ""}
      onValueChange={(v) => go({ walletId: v || undefined })}
      options={wallets}
      className="md:w-44"
    />
  );
  const categorySelect = (
    <CategorySelect
      allowAll
      value={filters.categoryId ?? ""}
      onValueChange={(v) => go({ categoryId: v || undefined })}
      options={categories}
      className="md:w-48"
    />
  );

  return (
    <div className="grid gap-3">
      {/* mobile: baris 1 = navigasi bulan (penuh), baris 2 = cari + tombol filter */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="flex w-full items-center justify-between rounded-lg border bg-card sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan sebelumnya"
            onClick={() => go({ month: shiftMonth(filters.month, -1) })}
          >
            <ChevronLeft />
          </Button>
          <button
            type="button"
            className="min-w-32 flex-1 px-1 text-center text-sm font-medium tabular-nums sm:flex-none"
            onClick={() => !isCurrent && go({ month: currentMonth() })}
            title={isCurrent ? undefined : "Kembali ke bulan ini"}
          >
            {formatMonth(filters.month)}
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan berikutnya"
            onClick={() => go({ month: shiftMonth(filters.month, 1) })}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Cari catatan, kategori, nominal…"
            className="pl-8"
            aria-label="Cari transaksi"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button variant="outline" className="md:hidden" onClick={() => setSheetOpen(true)} aria-label="Filter">
          <SlidersHorizontal />
          {count > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px]">{count}</Badge>}
        </Button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {typeSelect}
        {walletSelect}
        {categorySelect}
        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go({ type: undefined, walletId: undefined, categoryId: undefined, tag: undefined })}
          >
            <X /> Reset filter
          </Button>
        )}
      </div>

      {(filters.tag || tags.length > 0) && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {tags.slice(0, 15).map((tag) => {
            const active = filters.tag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => go({ tag: active ? undefined : tag })}
                className={
                  active
                    ? "shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                    : "shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                }
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      <ResponsiveDialog open={sheetOpen} onOpenChange={setSheetOpen} title="Filter transaksi">
        <div className="grid gap-4">
          <Field label="Jenis">{typeSelect}</Field>
          <Field label="Dompet">{walletSelect}</Field>
          <Field label="Kategori">{categorySelect}</Field>
          <div className="flex gap-2 *:flex-1">
            <Button
              variant="outline"
              onClick={() => go({ type: undefined, walletId: undefined, categoryId: undefined, tag: undefined })}
            >
              Reset
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Selesai</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
