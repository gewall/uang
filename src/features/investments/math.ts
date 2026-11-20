// Perhitungan portofolio murni (tanpa DB) — metode biaya rata-rata (average cost).
import { roundUnits } from "@/lib/number";

export type TxnInput = {
  id: string;
  type: "buy" | "sell" | "dividend";
  occurredAt: Date;
  units: number | null;
  /** sen: beli = units×price + fee; jual = units×price − fee; dividen = nominal */
  amount: number;
};

export type Holding = {
  units: number;
  /** modal tersisa untuk unit yang masih dipegang (sen) */
  costBasis: number;
  /** biaya rata-rata per unit (sen), 0 bila tidak memegang unit */
  avgCost: number;
  /** untung/rugi dari penjualan (sen) */
  realized: number;
  /** total dividen/bunga diterima (sen) */
  dividends: number;
  /** total uang yang pernah dimasukkan lewat pembelian (sen) */
  invested: number;
};

export class InsufficientUnitsError extends Error {
  constructor(
    public readonly txnId: string,
    public readonly held: number,
    public readonly requested: number,
  ) {
    super(`Unit tidak cukup: dimiliki ${held}, dijual ${requested}`);
  }
}

/** Urut kronologis; transaksi di waktu sama: beli dulu, lalu dividen, lalu jual. */
function sortTxns(txns: TxnInput[]): TxnInput[] {
  const order = { buy: 0, dividend: 1, sell: 2 };
  return [...txns].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || order[a.type] - order[b.type]);
}

/** Hitung posisi dari seluruh transaksi. Melempar InsufficientUnitsError bila menjual melebihi unit. */
export function computeHolding(txns: TxnInput[]): Holding {
  let units = 0;
  let cost = 0;
  let realized = 0;
  let dividends = 0;
  let invested = 0;

  for (const t of sortTxns(txns)) {
    if (t.type === "buy") {
      units = roundUnits(units + (t.units ?? 0));
      cost += t.amount;
      invested += t.amount;
    } else if (t.type === "sell") {
      const sold = t.units ?? 0;
      if (sold > units + 1e-9) throw new InsufficientUnitsError(t.id, units, sold);
      const costOfSold = units > 0 ? Math.round((cost * sold) / units) : 0;
      realized += t.amount - costOfSold;
      cost -= costOfSold;
      units = roundUnits(units - sold);
      if (units === 0) cost = 0; // habis terjual: buang sisa pembulatan
    } else {
      dividends += t.amount;
    }
  }

  return {
    units,
    costBasis: cost,
    avgCost: units > 0 ? Math.round(cost / units) : 0,
    realized,
    dividends,
    invested,
  };
}

export type Valuation = Holding & {
  /** nilai pasar (sen); bila harga belum diisi → pakai modal */
  marketValue: number;
  priced: boolean;
  unrealized: number;
  /** null bila modal 0 */
  unrealizedRatio: number | null;
  /** unrealized + realized + dividen */
  totalReturn: number;
};

export function valueHolding(h: Holding, currentPrice: number | null): Valuation {
  const priced = currentPrice !== null;
  const marketValue = priced ? Math.round(h.units * currentPrice) : h.costBasis;
  const unrealized = marketValue - h.costBasis;
  return {
    ...h,
    marketValue,
    priced,
    unrealized,
    unrealizedRatio: h.costBasis > 0 ? unrealized / h.costBasis : null,
    totalReturn: unrealized + h.realized + h.dividends,
  };
}

/** Nominal uang untuk transaksi beli/jual dari unit, harga per unit, dan biaya (semua sen kecuali unit). */
export function tradeAmount(type: "buy" | "sell", units: number, price: number, fee: number): number {
  const gross = Math.round(units * price);
  return type === "buy" ? gross + fee : gross - fee;
}
