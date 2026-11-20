"use client";

import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { EntityIcon } from "@/components/entity-icon";
import type { WalletOptionItem } from "@/components/entity-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssetType } from "@/db/schema";
import { type Currency, formatMoney } from "@/lib/money";
import { formatQuantity } from "@/lib/number";
import { setAssetArchived } from "../actions";
import { ASSET_TYPES } from "../constants";
import type { AssetWithValuation } from "../queries";
import { type AssetDialogState, AssetDialogs, toAssetRef } from "./asset-dialogs";
import { PnL } from "./pnl";

const rel = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
export function priceAge(d: Date | null): string {
  if (!d) return "";
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  return days === 0 ? "hari ini" : rel.format(days, "day");
}

export function InvestmentsView({
  items,
  wallets,
  summary,
}: {
  items: AssetWithValuation[];
  wallets: WalletOptionItem[];
  summary: ReactNode;
}) {
  const [dialog, setDialog] = useState<AssetDialogState>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();
  const active = items.filter((a) => !a.archivedAt);
  const archived = items.filter((a) => a.archivedAt);

  const toggleArchive = (a: AssetWithValuation) =>
    startTransition(async () => {
      const res = await setAssetArchived(a.id, !a.archivedAt);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  const card = (a: AssetWithValuation) => {
    const t = ASSET_TYPES[a.type as AssetType];
    const v = a.valuation;
    const cur = a.currency as Currency;
    return (
      <Card key={a.id} size="sm" className={a.archivedAt ? "opacity-70" : undefined}>
        <CardContent className="grid gap-3">
          <div className="flex items-start gap-3">
            <EntityIcon icon={t.icon} color={t.color} size="lg" className="max-sm:size-10" />
            <Link
              href={`/investasi/${a.id}`}
              className="min-w-0 flex-1 outline-none hover:underline focus-visible:underline"
            >
              <p className="flex items-center gap-1.5 truncate font-medium">
                <span className="truncate">{a.name}</span>
                {a.ticker && (
                  <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                    {a.ticker}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t.label} · {formatQuantity(v.units)} {a.unitLabel}
              </p>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${a.name}`} className="-mr-1" />}
              >
                <MoreVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setDialog({ kind: "txn", asset: toAssetRef(a), draft: { type: "buy" } })}
                >
                  <ShoppingCart /> Catat transaksi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog({ kind: "price", asset: toAssetRef(a) })}>
                  <RefreshCw /> Update harga
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialog({ kind: "asset", asset: a })}>
                  <Pencil /> Edit aset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleArchive(a)}>
                  {a.archivedAt ? (
                    <>
                      <ArchiveRestore /> Aktifkan lagi
                    </>
                  ) : (
                    <>
                      <Archive /> Arsipkan
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDialog({ kind: "deleteAsset", asset: { id: a.id, name: a.name } })}
                >
                  <Trash2 /> Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Nilai</p>
              <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
                {formatMoney(v.marketValue, cur)}
              </p>
            </div>
            {v.units > 0 && v.priced && (
              <PnL value={v.unrealized} ratio={v.unrealizedRatio} currency={cur} className="text-sm" />
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {a.error ? (
              <span className="flex items-center gap-1 text-destructive">
                <CircleAlert className="size-3.5" /> {a.error}
              </span>
            ) : a.currentPrice !== null ? (
              <span className="tabular-nums">
                Harga {formatMoney(a.currentPrice, cur, { precision: "exact" })}/{a.unitLabel} ·{" "}
                {priceAge(a.priceUpdatedAt)}
              </span>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-foreground underline underline-offset-2"
                onClick={() => setDialog({ kind: "price", asset: toAssetRef(a) })}
              >
                <CircleAlert className="size-3.5 text-warning" /> Harga belum diisi — nilai memakai modal
              </button>
            )}
            {v.units > 0 && (
              <span className="tabular-nums">
                · modal rata-rata {formatMoney(v.avgCost, cur, { precision: "exact" })}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Investasi"
        description="Saham, reksa dana, emas, kripto, dan aset lain."
        actions={
          <Button onClick={() => setDialog({ kind: "asset" })}>
            <Plus /> Tambah aset
          </Button>
        }
      />
      {summary}

      {active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <TrendingUp className="size-6" />
            </span>
            <p className="font-medium">Belum ada aset investasi</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tambahkan aset, lalu catat pembelian, penjualan, dan dividennya untuk melihat untung/rugi.
            </p>
            <Button onClick={() => setDialog({ kind: "asset" })}>
              <Plus /> Tambah aset pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{active.map(card)}</div>
      )}

      {archived.length > 0 && (
        <section className="grid gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
          >
            <Archive /> Diarsipkan ({archived.length}) {showArchived ? "— sembunyikan" : "— tampilkan"}
          </Button>
          {showArchived && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{archived.map(card)}</div>}
        </section>
      )}

      <AssetDialogs state={dialog} setState={setDialog} wallets={wallets} />
    </>
  );
}
