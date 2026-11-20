"use client";

import { ArrowLeft, Coins, MoreVertical, Pencil, RefreshCw, ShoppingCart, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EntityIcon } from "@/components/entity-icon";
import type { WalletOptionItem } from "@/components/entity-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssetType } from "@/db/schema";
import { formatDayHeader, formatTime, wibDateKey } from "@/lib/dates";
import { type Currency, formatMoney } from "@/lib/money";
import { formatQuantity } from "@/lib/number";
import { cn } from "@/lib/utils";
import { ASSET_TYPES, INVESTMENT_TXN_LABEL } from "../constants";
import type { AssetDetail, AssetTxnRow } from "../queries";
import { type AssetDialogState, AssetDialogs, toAssetRef } from "./asset-dialogs";
import { priceAge } from "./investments-view";
import { PnL } from "./pnl";

export function AssetDetailView({ detail, wallets }: { detail: AssetDetail; wallets: WalletOptionItem[] }) {
  const [dialog, setDialog] = useState<AssetDialogState>(null);
  const { asset, txns } = detail;
  const t = ASSET_TYPES[asset.type as AssetType];
  const v = asset.valuation;
  const cur = asset.currency as Currency;
  const ref = toAssetRef(asset);
  const record = (type: "buy" | "sell" | "dividend") => setDialog({ kind: "txn", asset: ref, draft: { type } });

  const editTxn = (x: AssetTxnRow) =>
    setDialog({
      kind: "txn",
      asset: ref,
      draft: {
        id: x.id,
        type: x.type,
        occurredAt: x.occurredAt,
        units: x.units,
        price: x.price,
        fee: x.fee,
        amount: x.amount,
        walletId: x.walletId,
        note: x.note,
      },
    });

  const stats = [
    { label: "Jumlah", value: `${formatQuantity(v.units)} ${asset.unitLabel}` },
    { label: "Modal", value: formatMoney(v.costBasis, cur) },
    { label: "Modal rata-rata", value: v.units > 0 ? formatMoney(v.avgCost, cur, { precision: "exact" }) : "—" },
    {
      label: "Harga terkini",
      value: asset.currentPrice !== null ? formatMoney(asset.currentPrice, cur, { precision: "exact" }) : "—",
      sub: asset.currentPrice !== null ? priceAge(asset.priceUpdatedAt) : "belum diisi",
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/investasi" />}
          nativeButton={false}
          aria-label="Kembali"
        >
          <ArrowLeft />
        </Button>
        <EntityIcon icon={t.icon} color={t.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {asset.name}
            {asset.ticker && <Badge variant="secondary">{asset.ticker}</Badge>}
            {asset.archivedAt && <Badge variant="outline">diarsipkan</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.label}
            {asset.note ? ` · ${asset.note}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Aksi aset" />}>
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setDialog({ kind: "asset", asset })}>
              <Pencil /> Edit aset
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                setDialog({ kind: "deleteAsset", asset: { id: asset.id, name: asset.name }, redirectTo: "/investasi" })
              }
            >
              <Trash2 /> Hapus aset
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card size="sm">
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Nilai pasar</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(v.marketValue, cur)}</p>
              {v.units > 0 && v.priced && (
                <p className="text-sm">
                  <PnL value={v.unrealized} ratio={v.unrealizedRatio} currency={cur} />{" "}
                  <span className="text-xs text-muted-foreground">belum terealisasi</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 *:max-sm:flex-1 sm:flex">
              <Button onClick={() => record("buy")}>
                <ShoppingCart /> Beli
              </Button>
              <Button variant="outline" onClick={() => record("sell")} disabled={v.units <= 0}>
                <Tag /> Jual
              </Button>
              <Button variant="outline" onClick={() => record("dividend")}>
                <Coins /> Dividen
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="truncate font-medium tabular-nums">{s.value}</dd>
                {s.sub && (
                  <dd className="text-xs text-muted-foreground">
                    {s.sub}{" "}
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                      onClick={() => setDialog({ kind: "price", asset: ref })}
                    >
                      <RefreshCw className="size-3" /> update
                    </button>
                  </dd>
                )}
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Untung terealisasi</p>
              <PnL value={v.realized} currency={cur} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dividen</p>
              <p className="tabular-nums">{formatMoney(v.dividends, cur)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total hasil</p>
              <PnL value={v.totalReturn} currency={cur} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Riwayat transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada transaksi. Mulai dengan mencatat pembelian.
            </p>
          ) : (
            <ul className="divide-y">
              {txns.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => editTxn(x)}
                    className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted"
                  >
                    <Badge
                      variant={x.type === "buy" ? "default" : x.type === "sell" ? "secondary" : "outline"}
                      className="w-16 justify-center"
                    >
                      {x.type === "dividend" ? "Dividen" : INVESTMENT_TXN_LABEL[x.type]}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm tabular-nums">
                        {x.type === "dividend"
                          ? x.note || "Dividen / bunga"
                          : `${formatQuantity(x.units ?? 0)} ${asset.unitLabel} × ${formatMoney(x.price ?? 0, cur, { precision: "exact" })}`}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDayHeader(wibDateKey(x.occurredAt))} · {formatTime(x.occurredAt)}
                        {x.walletName ? ` · ${x.walletName}` : " · tidak dicatat di dompet"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap tabular-nums",
                        x.type === "buy" ? "text-foreground" : "text-income",
                      )}
                    >
                      {x.type === "buy" ? "−" : "+"}
                      {formatMoney(x.amount, cur)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AssetDialogs state={dialog} setState={setDialog} wallets={wallets} />
    </div>
  );
}
