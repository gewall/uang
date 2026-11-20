import { describe, expect, it } from "vitest";
import { parseTags, transactionFormSchema } from "@/features/transactions/schema";

const W1 = "11111111-1111-4111-8111-111111111111";
const W2 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";

describe("parseTags", () => {
  it("normalisasi, dedup, batas", () => {
    expect(parseTags("Makan, kantor ,  Makan, #Liburan Bali")).toEqual(["makan", "kantor", "liburan-bali"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
  });
});

describe("transactionFormSchema", () => {
  const base = { amount: "25.000", walletId: W1, occurredAt: "2026-11-20T12:30" };

  it("pengeluaran valid", () => {
    const r = transactionFormSchema.parse({ ...base, type: "expense", categoryId: C1, tags: "makan" });
    expect(r.amount).toBe(2_500_000);
    expect(r.occurredAt.toISOString()).toBe("2026-11-20T05:30:00.000Z");
    expect(r.toWalletId).toBeNull();
    expect(r.fee).toBe(0);
    expect(r.tags).toEqual(["makan"]);
  });

  it("pengeluaran tanpa kategori ditolak", () => {
    const r = transactionFormSchema.safeParse({ ...base, type: "expense" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["categoryId"]);
  });

  it("transfer: kategori dibuang, fee diparse", () => {
    const r = transactionFormSchema.parse({ ...base, type: "transfer", toWalletId: W2, categoryId: C1, fee: "2.500" });
    expect(r.categoryId).toBeNull();
    expect(r.fee).toBe(250_000);
  });

  it("transfer ke dompet yang sama ditolak", () => {
    const r = transactionFormSchema.safeParse({ ...base, type: "transfer", toWalletId: W1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/berbeda/);
  });

  it("nominal 0 / negatif / kosong ditolak", () => {
    for (const amount of ["0", "-5000", ""]) {
      const r = transactionFormSchema.safeParse({ ...base, amount, type: "income", categoryId: C1 });
      expect(r.success, amount).toBe(false);
    }
  });

  it("toAmount hanya dipakai untuk transfer", () => {
    const r = transactionFormSchema.parse({ ...base, type: "income", categoryId: C1, toAmount: "10" });
    expect(r.toAmount).toBeNull();
  });
});
