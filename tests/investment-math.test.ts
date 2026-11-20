import { describe, expect, it } from "vitest";
import { computeHolding, InsufficientUnitsError, tradeAmount, valueHolding } from "@/features/investments/math";

const d = (s: string) => new Date(`${s}T10:00:00+07:00`);
let n = 0;
const buy = (date: string, units: number, amount: number) => ({
  id: `t${n++}`,
  type: "buy" as const,
  occurredAt: d(date),
  units,
  amount,
});
const sell = (date: string, units: number, amount: number) => ({
  id: `t${n++}`,
  type: "sell" as const,
  occurredAt: d(date),
  units,
  amount,
});
const div = (date: string, amount: number) => ({
  id: `t${n++}`,
  type: "dividend" as const,
  occurredAt: d(date),
  units: null,
  amount,
});

describe("tradeAmount", () => {
  it("beli = gross + fee, jual = gross − fee", () => {
    expect(tradeAmount("buy", 100, 500_000, 15_000)).toBe(50_015_000);
    expect(tradeAmount("sell", 100, 600_000, 25_000)).toBe(59_975_000);
    expect(tradeAmount("buy", 0.0015, 150_000_000_000, 0)).toBe(225_000_000); // 0,0015 BTC @ 1,5 M
  });
});

describe("computeHolding (average cost)", () => {
  it("dua pembelian → biaya rata-rata", () => {
    const h = computeHolding([buy("2026-01-01", 100, 50_000_000), buy("2026-02-01", 100, 70_000_000)]);
    expect(h.units).toBe(200);
    expect(h.costBasis).toBe(120_000_000);
    expect(h.avgCost).toBe(600_000);
    expect(h.invested).toBe(120_000_000);
  });

  it("jual sebagian → realized dihitung dari biaya rata-rata", () => {
    const h = computeHolding([
      buy("2026-01-01", 100, 50_000_000),
      buy("2026-02-01", 100, 70_000_000),
      sell("2026-03-01", 50, 40_000_000), // modal 50 unit = 30.000.000
    ]);
    expect(h.units).toBe(150);
    expect(h.costBasis).toBe(90_000_000);
    expect(h.realized).toBe(10_000_000);
    expect(h.avgCost).toBe(600_000);
  });

  it("jual habis → modal 0", () => {
    const h = computeHolding([buy("2026-01-01", 3, 1_000), sell("2026-01-05", 3, 1_200)]);
    expect(h.units).toBe(0);
    expect(h.costBasis).toBe(0);
    expect(h.realized).toBe(200);
  });

  it("dividen tidak mengubah unit/modal", () => {
    const h = computeHolding([buy("2026-01-01", 100, 50_000_000), div("2026-04-01", 1_500_000)]);
    expect(h.units).toBe(100);
    expect(h.dividends).toBe(1_500_000);
  });

  it("unit pecahan (kripto) tanpa error pembulatan", () => {
    const h = computeHolding([buy("2026-01-01", 0.1, 100), buy("2026-01-02", 0.2, 200), sell("2026-01-03", 0.3, 450)]);
    expect(h.units).toBe(0);
    expect(h.realized).toBe(150);
  });

  it("jual melebihi unit → error", () => {
    expect(() => computeHolding([buy("2026-01-01", 10, 1_000), sell("2026-01-02", 11, 1_500)])).toThrow(
      InsufficientUnitsError,
    );
  });

  it("jual sebelum beli (urutan tanggal) → error, walau total unit cukup", () => {
    expect(() => computeHolding([sell("2026-01-01", 5, 500), buy("2026-01-02", 10, 1_000)])).toThrow(
      InsufficientUnitsError,
    );
  });

  it("beli & jual di waktu yang sama: beli diproses dulu", () => {
    const h = computeHolding([sell("2026-01-01", 5, 600), buy("2026-01-01", 10, 1_000)]);
    expect(h.units).toBe(5);
  });
});

describe("valueHolding", () => {
  it("nilai pasar & untung/rugi", () => {
    const v = valueHolding(computeHolding([buy("2026-01-01", 100, 50_000_000)]), 650_000);
    expect(v.marketValue).toBe(65_000_000);
    expect(v.unrealized).toBe(15_000_000);
    expect(v.unrealizedRatio).toBeCloseTo(0.3);
    expect(v.priced).toBe(true);
  });

  it("tanpa harga → nilai = modal, untung/rugi 0", () => {
    const v = valueHolding(computeHolding([buy("2026-01-01", 100, 50_000_000)]), null);
    expect(v.marketValue).toBe(50_000_000);
    expect(v.unrealized).toBe(0);
    expect(v.priced).toBe(false);
  });

  it("total return = unrealized + realized + dividen", () => {
    const h = computeHolding([
      buy("2026-01-01", 100, 50_000_000),
      sell("2026-02-01", 50, 30_000_000),
      div("2026-03-01", 1_000_000),
    ]);
    const v = valueHolding(h, 400_000); // 50 unit × 400rb = 20jt, modal 25jt
    expect(v.unrealized).toBe(-5_000_000);
    expect(v.totalReturn).toBe(-5_000_000 + 5_000_000 + 1_000_000);
  });
});
