import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jagoToImportStatement, parseJagoStatement } from "@/lib/import/jago";
import { buildImportPlan, externalKey, type PlanContext, type PocketMapping, summarizePlan } from "@/lib/import/plan";

const text = readFileSync(new URL("./fixtures/jago/statement-sintetis.txt", import.meta.url), "utf8");
const statement = jagoToImportStatement(parseJagoStatement(text));

const ctx = (extra: Partial<PlanContext> = {}): PlanContext => ({
  system: { interest: "cat-bunga", tax: "cat-pajak", investment: "cat-inv", investmentReturn: "cat-inv-ret" },
  fallback: { income: "cat-lain-in", expense: "cat-lain-out" },
  rules: [],
  existingExternalIds: new Set(),
  ...extra,
});

const allNew: Record<string, PocketMapping> = {
  "100000000001": { mode: "new", name: "Kantong Utama" },
  "100000000003": { mode: "new", name: "Tabungan" },
  "840000000000001": { mode: "skip" },
  "100000000004": { mode: "new", name: "RDN Sekuritas" },
};

describe("buildImportPlan", () => {
  it("pindah kantong dipasangkan jadi transfer (12 baris → 10 rencana)", () => {
    const rows = buildImportPlan(statement, allNew, ctx());
    // 12 baris sumber, 2 pasangan (4 baris) → 2 transfer + 8 baris biasa
    expect(rows).toHaveLength(10);
    const transfers = rows.filter((r) => r.type === "transfer");
    expect(transfers.map((t) => [t.from, t.to, t.amount])).toEqual([
      ["pocket:100000000001", "pocket:100000000003", 20_000_000],
      ["pocket:100000000003", "pocket:100000000004", 15_000_000],
    ]);
    expect(transfers[0].externalId).toBe("jago:261003-AAAA-000003+261003-BBBB-000001");
  });

  it("kategori sistem & investasi tidak dihitung statistik", () => {
    const rows = buildImportPlan(statement, allNew, ctx());
    const by = (label: string) => rows.find((r) => r.kindLabel === label)!;
    expect(by("Bunga")).toMatchObject({ type: "income", categoryId: "cat-bunga", excludeFromStats: false });
    expect(by("Pajak Bunga")).toMatchObject({ type: "expense", categoryId: "cat-pajak" });
    expect(by("Pembelian Saham")).toMatchObject({ categoryId: "cat-inv", excludeFromStats: true });
    expect(by("Penarikan Dana RDN")).toMatchObject({ categoryId: "cat-inv", excludeFromStats: true });
  });

  it("rekening sendiri → tidak dihitung statistik + petunjuk", () => {
    const own = buildImportPlan(statement, allNew, ctx()).find((r) => r.counterparty === "PENGGUNA CONTOH")!;
    expect(own.type).toBe("income");
    expect(own.excludeFromStats).toBe(true);
    expect(own.hints.join()).toMatch(/rekening sendiri/);
  });

  it("aturan kategori: pola terpanjang menang", () => {
    const rows = buildImportPlan(
      statement,
      allNew,
      ctx({
        rules: [
          { pattern: "toko", kind: "expense", categoryId: "cat-belanja" },
          { pattern: "toko satu", kind: "expense", categoryId: "cat-makan" },
          { pattern: "warung", kind: "income", categoryId: "salah-jenis" },
        ],
      }),
    );
    expect(rows.find((r) => r.counterparty === "TOKO SATU")?.categoryId).toBe("cat-makan");
    expect(rows.find((r) => r.counterparty === "WARUNG DUA")?.categoryId).toBe("cat-lain-out");
  });

  it("kantong lawan dilewati → kaki pindah kantong jadi baris biasa tanpa pasangan", () => {
    const rows = buildImportPlan(statement, { ...allNew, "100000000003": { mode: "skip" } }, ctx());
    expect(rows.filter((r) => r.type === "transfer")).toHaveLength(0);
    const leg = rows.find((r) => r.sourceIds[0] === "261003-AAAA-000003")!;
    expect(leg).toMatchObject({ type: "expense", excludeFromStats: true, categoryId: "cat-lain-out" });
    expect(rows.some((r) => r.pocketName === "Tabungan")).toBe(false);
  });

  it("duplikat (sudah pernah diimport) tidak ikut", () => {
    const existing = new Set([
      externalKey("jago_pdf", ["261001-AAAA-000001"]),
      "jago:261003-AAAA-000003+261003-BBBB-000001",
    ]);
    const rows = buildImportPlan(statement, allNew, ctx({ existingExternalIds: existing }));
    expect(
      rows
        .filter((r) => r.status === "duplicate")
        .map((r) => r.sourceIds[0])
        .sort(),
    ).toEqual(["261001-AAAA-000001", "261003-AAAA-000003"]);
    expect(summarizePlan(rows)).toMatchObject({ total: 10, duplicates: 2, toImport: 8 });
  });

  it("koreksi user: kategori, transfer ke dompet, exclude, include", () => {
    const base = buildImportPlan(statement, allNew, ctx());
    const qris = base.find((r) => r.counterparty === "TOKO SATU")!;
    const own = base.find((r) => r.counterparty === "PENGGUNA CONTOH")!;
    const warung = base.find((r) => r.counterparty === "WARUNG DUA")!;
    const rows = buildImportPlan(statement, allNew, ctx(), {
      [qris.key]: { categoryId: "cat-makan", excludeFromStats: true },
      // pencairan dari GoPay (uang masuk) → transfer dari dompet GoPay ke kantong
      [own.key]: { toWallet: "wallet:gopay-id" },
      [warung.key]: { include: false },
    });
    expect(rows.find((r) => r.key === qris.key)).toMatchObject({ categoryId: "cat-makan", excludeFromStats: true });
    expect(rows.find((r) => r.key === own.key)).toMatchObject({
      type: "transfer",
      from: "wallet:gopay-id",
      to: "pocket:100000000001",
      categoryId: null,
      excludeFromStats: false,
    });
    expect(rows.find((r) => r.key === warung.key)?.include).toBe(false);
  });

  it("deterministik: urut waktu", () => {
    const a = buildImportPlan(statement, allNew, ctx());
    const b = buildImportPlan(statement, allNew, ctx());
    expect(a).toEqual(b);
    expect(a.map((r) => r.occurredAt)).toEqual([...a.map((r) => r.occurredAt)].sort());
  });
});
