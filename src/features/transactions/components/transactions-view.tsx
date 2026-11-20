"use client";

import { ArrowLeftRight, Plus, ReceiptText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
import type { CategoryOption, WalletOptionItem } from "@/components/entity-select";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayHeader, formatTime, wibDateKey } from "@/lib/dates";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteTransaction } from "../actions";
import type { TransactionRow } from "../queries";
import { NEW_TRANSACTION_EVENT } from "./new-transaction-button";
import { duplicateDraft, type TransactionDraft, TransactionForm } from "./transaction-form";

type Props = {
  items: TransactionRow[];
  hasMore: boolean;
  moreHref: string;
  categories: CategoryOption[];
  wallets: WalletOptionItem[];
  /** ?baru=1 → buka form tambah (dari tombol + di bottom nav) */
  openNew: boolean;
  filtered: boolean;
};

const toDraft = (t: TransactionRow): TransactionDraft => ({
  id: t.id,
  type: t.type,
  amount: t.amount,
  walletId: t.walletId,
  toWalletId: t.toWalletId,
  categoryId: t.categoryId,
  fee: t.fee,
  toAmount: t.toAmount,
  occurredAt: t.occurredAt,
  note: t.note,
  tags: t.tags,
  source: t.source,
});

export function TransactionsView({ items, hasMore, moreHref, categories, wallets, openNew, filtered }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<TransactionDraft | null>(openNew ? { type: "expense" } : null);
  const [formKey, setFormKey] = useState(0);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [linked, setLinked] = useState<TransactionRow | null>(null);
  const [pending, startTransition] = useTransition();

  // buka form saat ?baru=1 muncul (juga saat sudah berada di halaman ini)
  const [prevOpenNew, setPrevOpenNew] = useState(openNew);
  if (openNew !== prevOpenNew) {
    setPrevOpenNew(openNew);
    if (openNew) setDraft({ type: "expense" });
  }
  // lalu bersihkan ?baru=1 dari URL supaya refresh/back tidak membuka form lagi
  useEffect(() => {
    if (!openNew) return;
    const p = new URLSearchParams(searchParams);
    p.delete("baru");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [openNew, pathname, router, searchParams]);

  // shortcut "n" = transaksi baru
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      setDraft({ type: "expense" });
    };
    const onNew = () => setDraft({ type: "expense" });
    window.addEventListener("keydown", onKey);
    window.addEventListener(NEW_TRANSACTION_EVENT, onNew);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(NEW_TRANSACTION_EVENT, onNew);
    };
  }, []);

  const closeForm = useCallback((message?: string) => {
    setDraft(null);
    if (message) toast.success(message);
  }, []);
  const again = useCallback((next: TransactionDraft, message?: string) => {
    if (message) toast.success(message);
    setDraft(next);
    setFormKey((k) => k + 1); // remount form kosong dengan pilihan sebelumnya
  }, []);

  // kelompokkan per hari (WIB)
  const groups = new Map<string, TransactionRow[]>();
  for (const t of items) {
    const key = wibDateKey(t.occurredAt);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return (
    <>
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ReceiptText className="size-6" />
            </span>
            <p className="font-medium">
              {filtered ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi di bulan ini"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filtered
                ? "Coba ubah filter atau kata kunci."
                : "Catat pemasukan, pengeluaran, atau transfer pertamamu."}
            </p>
            {!filtered && (
              <Button onClick={() => setDraft({ type: "expense" })}>
                <Plus /> Tambah transaksi
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {[...groups.entries()].map(([day, rows]) => {
            const net = rows.reduce(
              (n, t) =>
                t.walletCurrency !== "IDR" || t.excludeFromStats
                  ? n
                  : t.type === "income"
                    ? n + t.amount
                    : t.type === "expense"
                      ? n - t.amount
                      : n,
              0,
            );
            return (
              <section key={day} aria-label={formatDayHeader(day)}>
                <div className="flex items-baseline justify-between px-1 pb-1.5">
                  <h2 className="text-sm font-medium text-muted-foreground">{formatDayHeader(day)}</h2>
                  {net !== 0 && (
                    <span className={cn("text-xs tabular-nums", net > 0 ? "text-income" : "text-muted-foreground")}>
                      {formatMoney(net, "IDR", { signed: true })}
                    </span>
                  )}
                </div>
                <Card size="sm" className="py-1">
                  <ul className="divide-y">
                    {rows.map((t) => (
                      <li key={t.id}>
                        <TransactionRowItem
                          t={t}
                          onClick={() => (t.investmentAssetId ? setLinked(t) : setDraft(toDraft(t)))}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
          {hasMore && (
            <Button
              variant="outline"
              className="justify-self-center"
              render={<Link href={moreHref} scroll={false} />}
              nativeButton={false}
            >
              Muat lebih banyak
            </Button>
          )}
        </div>
      )}

      <ResponsiveDialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit transaksi" : "Tambah transaksi"}
      >
        {draft && (
          <TransactionForm
            key={`${draft.id ?? "new"}-${formKey}`}
            draft={draft}
            categories={categories}
            wallets={wallets}
            onDone={closeForm}
            onAgain={again}
            onDuplicate={() => {
              setDraft(duplicateDraft(draft));
              setFormKey((k) => k + 1);
              toast.info("Duplikat dibuat — ubah lalu simpan.");
            }}
            onDelete={() => draft.id && setToDelete(draft.id)}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={linked !== null}
        onOpenChange={(o) => !o && setLinked(null)}
        title="Transaksi investasi"
        description="Transaksi ini dibuat dari pencatatan investasi, jadi diubah atau dihapus dari halaman asetnya supaya riwayat aset tetap konsisten."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setLinked(null)}>
            Tutup
          </Button>
          {linked?.investmentAssetId && (
            <Button render={<Link href={`/investasi/${linked.investmentAssetId}`} />} nativeButton={false}>
              <TrendingUp /> Buka halaman aset
            </Button>
          )}
        </div>
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Hapus transaksi ini?"
        description="Saldo dompet akan dihitung ulang. Tindakan ini tidak bisa dibatalkan."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          startTransition(async () => {
            const res = await deleteTransaction(toDelete);
            if (res.ok) {
              toast.success(res.message);
              setDraft(null);
            } else toast.error(res.message);
            setToDelete(null);
          })
        }
      />
    </>
  );
}

function TransactionRowItem({ t, onClick }: { t: TransactionRow; onClick: () => void }) {
  const isTransfer = t.type === "transfer";
  const title = t.note || t.counterparty || (isTransfer ? "Transfer" : t.categoryName) || "Tanpa kategori";
  const categoryLabel = t.parentCategoryName ? `${t.parentCategoryName} › ${t.categoryName}` : t.categoryName;
  const sub = isTransfer
    ? `${t.walletName} → ${t.toWalletName}`
    : [title !== t.categoryName ? categoryLabel : null, t.walletName].filter(Boolean).join(" · ");
  const currency = t.walletCurrency as Currency;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted"
    >
      {isTransfer ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ArrowLeftRight className="size-4.5" />
        </span>
      ) : (
        <EntityIcon icon={t.categoryIcon ?? "tag"} color={t.categoryColor ?? "slate"} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{sub}</span>
          {t.investmentAssetId && (
            <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
              investasi
            </Badge>
          )}
          {t.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="hidden h-4 px-1.5 text-[10px] sm:inline-flex">
              #{tag}
            </Badge>
          ))}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block text-sm font-semibold whitespace-nowrap tabular-nums",
            t.type === "income" && "text-income",
            t.type === "expense" && "text-expense",
            isTransfer && "text-muted-foreground",
          )}
        >
          {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
          {formatMoney(t.amount, currency)}
        </span>
        <span className="block text-[11px] text-muted-foreground tabular-nums">
          {t.fee > 0 ? `biaya ${formatMoney(t.fee, currency)} · ` : ""}
          {formatTime(t.occurredAt)}
        </span>
      </span>
    </button>
  );
}
