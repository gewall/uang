import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  type AssetType,
  type InvestmentAsset,
  investmentAssets,
  investmentTxns,
  transactions,
  wallets,
} from "@/db/schema";
import { ASSET_TYPES, ASSET_TYPE_KEYS } from "./constants";
import { computeHolding, type TxnInput, type Valuation, valueHolding } from "./math";

export type AssetWithValuation = InvestmentAsset & { valuation: Valuation; txnCount: number; error: string | null };

function valuate(asset: InvestmentAsset, txns: TxnInput[]): AssetWithValuation {
  try {
    return {
      ...asset,
      valuation: valueHolding(computeHolding(txns), asset.currentPrice),
      txnCount: txns.length,
      error: null,
    };
  } catch {
    // data tidak konsisten (mis. jual > unit) — tampilkan apa adanya dengan peringatan
    const empty = valueHolding(computeHolding([]), asset.currentPrice);
    return { ...asset, valuation: empty, txnCount: txns.length, error: "Riwayat transaksi tidak konsisten" };
  }
}

/** Semua aset + valuasi, ringkasan portofolio (IDR), dan alokasi per jenis. */
export async function listPortfolio(userId: string) {
  const [assets, txns] = await Promise.all([
    db.select().from(investmentAssets).where(eq(investmentAssets.userId, userId)).orderBy(asc(investmentAssets.name)),
    db
      .select({
        id: investmentTxns.id,
        assetId: investmentTxns.assetId,
        type: investmentTxns.type,
        occurredAt: investmentTxns.occurredAt,
        units: investmentTxns.units,
        amount: investmentTxns.amount,
      })
      .from(investmentTxns)
      .where(eq(investmentTxns.userId, userId)),
  ]);

  const byAsset = new Map<string, TxnInput[]>();
  for (const t of txns) byAsset.set(t.assetId, [...(byAsset.get(t.assetId) ?? []), t]);

  const items = assets
    .map((a) => valuate(a, byAsset.get(a.id) ?? []))
    .sort((a, b) => b.valuation.marketValue - a.valuation.marketValue);

  const idr = items.filter((a) => a.currency === "IDR" && !a.archivedAt);
  const sum = (f: (v: Valuation) => number) => idr.reduce((n, a) => n + f(a.valuation), 0);
  const summary = {
    marketValue: sum((v) => v.marketValue),
    costBasis: sum((v) => v.costBasis),
    unrealized: sum((v) => v.unrealized),
    realized: sum((v) => v.realized),
    dividends: sum((v) => v.dividends),
    unpriced: idr.filter((a) => !a.valuation.priced && a.valuation.units > 0).length,
  };

  const allocation = ASSET_TYPE_KEYS.map((type) => ({
    type,
    label: ASSET_TYPES[type].label,
    slot: ASSET_TYPES[type].slot,
    value: idr.filter((a) => a.type === type).reduce((n, a) => n + a.valuation.marketValue, 0),
  })).filter((x) => x.value > 0);

  return { items, summary, allocation };
}

/** Nilai portofolio IDR (untuk kekayaan bersih di dashboard). */
export async function portfolioValue(userId: string): Promise<number> {
  return (await listPortfolio(userId)).summary.marketValue;
}

export async function getAssetDetail(userId: string, assetId: string) {
  const [asset] = await db
    .select()
    .from(investmentAssets)
    .where(and(eq(investmentAssets.id, assetId), eq(investmentAssets.userId, userId)));
  if (!asset) return null;

  const txns = await db
    .select({
      id: investmentTxns.id,
      type: investmentTxns.type,
      occurredAt: investmentTxns.occurredAt,
      units: investmentTxns.units,
      price: investmentTxns.price,
      fee: investmentTxns.fee,
      amount: investmentTxns.amount,
      note: investmentTxns.note,
      transactionId: investmentTxns.transactionId,
      walletId: transactions.walletId,
      walletName: wallets.name,
    })
    .from(investmentTxns)
    .leftJoin(transactions, eq(transactions.id, investmentTxns.transactionId))
    .leftJoin(wallets, eq(wallets.id, transactions.walletId))
    .where(eq(investmentTxns.assetId, assetId))
    .orderBy(desc(investmentTxns.occurredAt), desc(investmentTxns.createdAt));

  return { asset: valuate(asset, txns), txns };
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>;
export type AssetTxnRow = AssetDetail["txns"][number];
export type AllocationPart = Awaited<ReturnType<typeof listPortfolio>>["allocation"][number];
export type { AssetType };
