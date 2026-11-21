import { describe, expect, it } from "vitest";
import { describeActivity, formatValue } from "@/features/activity/describe";

const norm = (s: string) => s.replace(/ /g, " ");

describe("describeActivity", () => {
  it("keamanan", () => {
    expect(describeActivity({ action: "login", entity: "auth", diff: null }).title).toBe("Masuk ke akun");
    const failed = describeActivity({ action: "login_failed", entity: "auth", diff: { username: "x" } });
    expect(failed.tone).toBe("warning");
    expect(describeActivity({ action: "update", entity: "password", diff: null }).title).toBe("Mengganti password");
    expect(describeActivity({ action: "delete", entity: "session", diff: { scope: "others" } }).title).toBe(
      "Mengeluarkan semua device lain",
    );
  });

  it("transaksi dengan nominal", () => {
    const r = describeActivity({
      action: "create",
      entity: "transaction",
      diff: { type: "expense", amount: 2_500_000 },
    });
    expect(norm(r.title)).toBe("Menambah transaksi pengeluaran Rp 25.000");
    expect(r.tone).toBe("positive");
  });

  it("ubah dompet: daftar perubahan, uang diformat, id disamarkan", () => {
    const r = describeActivity({
      action: "update",
      entity: "wallet",
      entityName: "Jago Utama",
      diff: {
        name: { from: "Jago", to: "Jago Utama" },
        initialBalance: { from: 0, to: 150_000_000 },
        color: { from: "blue", to: "teal" },
      },
    });
    expect(r.title).toBe('Mengubah dompet "Jago Utama"');
    expect(r.changes.map((c) => norm(c.from ? `${c.label}: ${c.from} → ${c.to}` : `${c.label}: ${c.to}`))).toEqual([
      "Nama: Jago → Jago Utama",
      "Saldo awal: Rp 0 → Rp 1.500.000",
      "Warna: diubah",
    ]);
  });

  it("tambah memakai nama saat kejadian, bukan nama terkini", () => {
    const r = describeActivity({
      action: "create",
      entity: "wallet",
      entityName: "Jago Utama",
      diff: { name: "Jago" },
    });
    expect(r.title).toBe('Menambah dompet "Jago"');
  });

  it("arsip", () => {
    expect(
      describeActivity({ action: "update", entity: "category", entityName: "Hiburan", diff: { archived: true } }).title,
    ).toBe('Mengarsipkan kategori "Hiburan"');
  });

  it("hapus memakai nama dari diff bila entitas sudah tidak ada", () => {
    const r = describeActivity({ action: "delete", entity: "wallet", diff: { name: "GoPay", initialBalance: 0 } });
    expect(r.title).toBe('Menghapus dompet "GoPay"');
    expect(r.tone).toBe("danger");
  });

  it("budget & investasi", () => {
    expect(
      describeActivity({ action: "create", entity: "budget", diff: { copiedFrom: "2026-10-01", count: 3 } }).title,
    ).toBe("Menyalin 3 budget dari bulan lalu");
    expect(
      norm(
        describeActivity({
          action: "create",
          entity: "investment_txn",
          diff: { asset: "BBCA", type: "buy", amount: 86_275_000 },
        }).title,
      ),
    ).toBe('Mencatat beli "BBCA" Rp 862.750');
    expect(describeActivity({ action: "create", entity: "category", diff: { defaults: 29 } }).title).toBe(
      "Menambahkan 29 kategori default",
    );
  });
});

describe("import/export", () => {
  it("import, undo, export, backup", () => {
    expect(
      describeActivity({ action: "import", entity: "import", diff: { imported: 184, filename: "jago.pdf" } }).title,
    ).toBe('Mengimport 184 transaksi dari "jago.pdf"');
    expect(
      describeActivity({
        action: "delete",
        entity: "import",
        diff: { undo: true, transactions: 184, filename: "jago.pdf" },
      }).title,
    ).toBe('Membatalkan import "jago.pdf" (184 transaksi dihapus)');
    expect(
      describeActivity({ action: "export", entity: "export", diff: { format: "xlsx", transactions: 10 } }).title,
    ).toBe("Mengunduh Excel (10 transaksi)");
    expect(describeActivity({ action: "import", entity: "backup", diff: { transactions: 5 } }).title).toBe(
      "Memulihkan backup (5 transaksi)",
    );
  });
});

describe("AI", () => {
  it("chat, budget, pengaturan", () => {
    expect(describeActivity({ action: "ai", entity: "ai_chat", diff: { model: "deepseek-chat" } }).title).toBe(
      "Bertanya ke Rekomendasi AI",
    );
    expect(describeActivity({ action: "update", entity: "ai_settings", diff: { apiKeyChanged: true } }).title).toMatch(
      /Mengganti API key/,
    );
    expect(describeActivity({ action: "update", entity: "ai_settings", diff: { apiKeyRemoved: true } }).title).toBe(
      "Menghapus API key AI",
    );
    expect(describeActivity({ action: "create", entity: "budget", diff: { fromAi: true, count: 5 } }).title).toBe(
      "Menerapkan 5 budget dari rekomendasi AI",
    );
  });
});

describe("formatValue", () => {
  it("berbagai tipe", () => {
    expect(norm(formatValue("amount", 115_713_073))).toBe("Rp 1.157.130,73");
    expect(formatValue("type", "ewallet")).toBe("e-wallet");
    expect(formatValue("tags", ["a", "b"])).toBe("#a #b");
    expect(formatValue("note", null)).toBe("—");
    expect(formatValue("units", 2.5)).toBe("2,5");
    expect(formatValue("occurredAt", "2026-11-20T05:30:00.000Z")).toMatch(/20 Nov 2026/);
  });
});
