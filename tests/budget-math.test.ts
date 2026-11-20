import { describe, expect, it } from "vitest";
import { computeBudgets, dailyAllowance, rollupToRoot, statusOf } from "@/features/budgets/math";

// Makan (induk) → Kopi (anak); Transport (induk) → Bensin (anak); Hiburan (tanpa anak)
const cats = [
  { id: "makan", parentId: null },
  { id: "kopi", parentId: "makan" },
  { id: "transport", parentId: null },
  { id: "bensin", parentId: "transport" },
  { id: "hiburan", parentId: null },
];
const spent = new Map([
  ["makan", 600],
  ["kopi", 200],
  ["transport", 100],
  ["bensin", 300],
  ["hiburan", 500],
]);

describe("statusOf", () => {
  it("ambang aman / hampir / lewat", () => {
    expect(statusOf(0.5)).toBe("ok");
    expect(statusOf(0.8)).toBe("warning");
    expect(statusOf(1)).toBe("warning");
    expect(statusOf(1.01)).toBe("over");
  });
});

describe("computeBudgets", () => {
  it("budget induk mencakup subkategori", () => {
    const r = computeBudgets([{ id: "b1", categoryId: "makan", amount: 1000 }], cats, spent);
    expect(r.lines[0].spent).toBe(800);
    expect(r.lines[0].remaining).toBe(200);
    expect(r.lines[0].status).toBe("warning");
  });

  it("induk + anak sama-sama dibudget: total tidak dobel", () => {
    const r = computeBudgets(
      [
        { id: "b1", categoryId: "makan", amount: 1000 },
        { id: "b2", categoryId: "kopi", amount: 150 },
      ],
      cats,
      spent,
    );
    const kopi = r.lines.find((l) => l.id === "b2")!;
    expect(kopi.nested).toBe(true);
    expect(kopi.status).toBe("over");
    expect(r.totalBudget).toBe(1000);
    expect(r.totalSpent).toBe(800);
  });

  it("pengeluaran tanpa budget digulung ke induk", () => {
    const r = computeBudgets([{ id: "b1", categoryId: "makan", amount: 1000 }], cats, spent);
    expect(r.totalExpense).toBe(1700);
    expect(r.unbudgetedSpent).toBe(900); // transport 100 + bensin 300 + hiburan 500
    expect(r.unbudgeted).toEqual([
      { categoryId: "hiburan", spent: 500 },
      { categoryId: "transport", spent: 400 },
    ]);
  });

  it("hanya anak yang dibudget: induk & anak lain tetap 'tanpa budget'", () => {
    const r = computeBudgets([{ id: "b1", categoryId: "bensin", amount: 250 }], cats, spent);
    expect(r.lines[0].spent).toBe(300);
    expect(r.lines[0].nested).toBe(false);
    expect(r.unbudgeted.find((u) => u.categoryId === "transport")?.spent).toBe(100);
  });

  it("tanpa budget sama sekali", () => {
    const r = computeBudgets([], cats, spent);
    expect(r.totalBudget).toBe(0);
    expect(r.totalRatio).toBe(0);
    expect(r.unbudgetedSpent).toBe(1700);
  });
});

describe("rollupToRoot", () => {
  it("menjumlahkan anak ke induk", () => {
    expect(Object.fromEntries(rollupToRoot(cats, spent))).toEqual({ makan: 800, transport: 400, hiburan: 500 });
  });
});

describe("dailyAllowance", () => {
  const start = new Date("2026-10-31T17:00:00Z"); // 1 Nov WIB
  const end = new Date("2026-11-30T17:00:00Z"); // 1 Des WIB
  it("membagi sisa ke hari tersisa", () => {
    const now = new Date("2026-11-20T05:00:00Z"); // 20 Nov siang
    const r = dailyAllowance(1_100_000, "2026-11", now, end, start);
    expect(r?.daysLeft).toBe(11);
    expect(r?.perDay).toBe(100_000);
  });
  it("bulan lain → null, sisa negatif → 0", () => {
    expect(dailyAllowance(100, "2026-11", new Date("2026-12-05T00:00:00Z"), end, start)).toBeNull();
    expect(dailyAllowance(-500, "2026-11", new Date("2026-11-20T05:00:00Z"), end, start)?.perDay).toBe(0);
  });
});
