import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIdAmount, parseJagoStatement } from "@/lib/import/jago";

// Fixture SINTETIS (nama/nomor/nominal rekaan) dengan struktur persis seperti hasil ekstraksi PDF Jago.
const text = readFileSync(new URL("./fixtures/jago/statement-sintetis.txt", import.meta.url), "utf8");

describe("parseIdAmount", () => {
  it("format Indonesia → sen", () => {
    expect(parseIdAmount("1.157.130,73")).toBe(115_713_073);
    expect(parseIdAmount("+12,34")).toBe(1234);
    expect(parseIdAmount("-0,00")).toBe(-0);
    expect(parseIdAmount("-25.000,00")).toBe(-2_500_000);
  });
});

describe("parseJagoStatement", () => {
  const s = parseJagoStatement(text);
  const [utama, tabungan, dolar, rdn] = s.pockets;

  it("metadata & kantong", () => {
    expect(s.accountHolder).toBe("PENGGUNA CONTOH");
    expect(s.period).toBe("Oktober 2026");
    expect(s.pockets.map((p) => [p.name, p.pocketId, p.currency, p.rows.length])).toEqual([
      ["Kantong Utama", "100000000001", "IDR", 7],
      ["Tabungan", "100000000003", "IDR", 2],
      ["Dolar AS", "840000000000001", "USD", 0],
      ["RDN Sekuritas", "100000000004", "IDR", 3],
    ]);
    expect(s.warnings).toEqual([]);
  });

  it("ringkasan & rantai saldo konsisten", () => {
    expect(utama.opening).toBe(10_000_000);
    expect(utama.closing).toBe(41_000_987);
    expect(utama.totalIn).toBe(55_001_234);
    expect(utama.totalOut).toBe(24_000_247);
    expect(s.pockets.every((p) => p.consistent)).toBe(true);
    expect(dolar.consistent).toBe(true);
  });

  it("baris QRIS: tanggal WIB, pihak lawan & akun", () => {
    const r = utama.rows[0];
    expect(r.externalId).toBe("261001-AAAA-000001");
    expect(r.occurredAt.toISOString()).toBe("2026-10-01T01:15:00.000Z");
    expect(r.kind).toBe("qris");
    expect(r.counterparty).toBe("TOKO SATU");
    expect(r.counterpartyAccount).toBe("DANA 9360000000000000001");
    expect(r.amount).toBe(-2_500_000);
    expect(r.balance).toBe(7_500_000);
    expect(r.note).toBeNull();
  });

  it("catatan multi-baris + prefix di baris jumlah", () => {
    expect(utama.rows[1].kind).toBe("transfer_in");
    expect(utama.rows[1].note).toBe("titipan dari uang makan");
    expect(utama.rows[1].counterpartyAccount).toBe("Jago 100000000002");
  });

  it("jenis dua baris & page break di tengah section", () => {
    expect(utama.rows[2]).toMatchObject({ kind: "pocket_move", counterparty: "Tabungan", amount: -20_000_000 });
    expect(utama.rows[2].kindLabel).toBe("Pindah uang antar Kantong · Tambah Uang Kantong");
    expect(utama.rows[3]).toMatchObject({ kind: "jago_pay", counterparty: "WARUNG DUA" });
    expect(utama.rows[4]).toMatchObject({
      kind: "ewallet_withdrawal",
      counterparty: "PENGGUNA CONTOH",
      amount: 5_000_000,
    });
    expect(utama.rows[5]).toMatchObject({ kind: "interest", amount: 1234 });
    expect(utama.rows[6]).toMatchObject({ kind: "interest_tax", amount: -247 });
  });

  it("section RDN: ID angka, jenis berulang, catatan receipt & prefix", () => {
    expect(rdn.rows[0]).toMatchObject({ externalId: "4900000001", kind: "pocket_move", counterparty: "Tabungan" });
    expect(rdn.rows[1]).toMatchObject({ kind: "stock_buy", kindLabel: "Pembelian Saham" });
    expect(rdn.rows[1].note).toBe("{botd} R-00000001 Receipt from: pengguna contoh");
    expect(rdn.rows[2]).toMatchObject({ kind: "rdn_withdrawal", note: "PI00000000ABCDE", amount: -1_000_000 });
    expect(tabungan.rows[1]).toMatchObject({ counterparty: "RDN Sekuritas", amount: -15_000_000 });
  });

  it("saldo yang tidak nyambung terdeteksi", () => {
    const broken = parseJagoStatement(text.replace("-25.000,00 75.000,00", "-25.000,00 76.000,00"));
    expect(broken.pockets[0].rows[0].balanceOk).toBe(false);
    expect(broken.pockets[0].consistent).toBe(false);
    expect(broken.warnings.some((w) => w.includes("Kantong Utama"))).toBe(true);
  });

  it("file bukan laporan Jago", () => {
    const r = parseJagoStatement("dokumen lain\ntanpa kantong");
    expect(r.pockets).toEqual([]);
    expect(r.warnings[0]).toMatch(/Tidak ada Kantong/);
  });
});
