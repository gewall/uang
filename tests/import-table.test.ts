import { describe, expect, it } from "vitest";
import { guessMapping, parseAmountText, parseDateText, tableToStatement } from "@/lib/import/table";

describe("parseAmountText", () => {
  it.each([
    ["1.500.000", 150_000_000],
    ["-25.000", -2_500_000],
    ["Rp 25.000", 2_500_000],
    ["(25.000)", -2_500_000],
    ["1,500,000.50", 150_000_050],
    ["1,500,000", 150_000_000],
    ["1.500.000,50", 150_000_050],
    ["25.000 DB", -2_500_000],
    ["25.000 CR", 2_500_000],
    ["12.5", 1250],
  ])("%s → %d", (input, expected) => {
    expect(parseAmountText(input)).toBe(expected);
  });
  it.each(["", "abc", "1.2.3,4,5"])("menolak %j", (input) => {
    expect(parseAmountText(input)).toBeNull();
  });
});

describe("parseDateText", () => {
  it("berbagai format → ISO WIB", () => {
    expect(parseDateText("04/10/2026", "dmy")).toBe("2026-10-04T05:00:00.000Z");
    expect(parseDateText("10/04/2026", "mdy")).toBe("2026-10-04T05:00:00.000Z");
    expect(parseDateText("2026-10-04 13:53", "dmy")).toBe("2026-10-04T06:53:00.000Z");
    expect(parseDateText("04 Okt 2026", "dmy")).toBe("2026-10-04T05:00:00.000Z");
    expect(parseDateText("4-Oct-2026 08.15", "dmy")).toBe("2026-10-04T01:15:00.000Z");
    expect(parseDateText("2026-10-04T06:53:00.000Z", "dmy")).toBe("2026-10-04T06:53:00.000Z");
  });
  it("menolak tanggal tidak valid", () => {
    expect(parseDateText("32/13/2026", "dmy")).toBeNull();
    expect(parseDateText("kemarin", "dmy")).toBeNull();
  });
});

describe("tableToStatement", () => {
  const table = [
    ["Tanggal", "Keterangan", "Debit", "Kredit"],
    ["01/10/2026", "Gaji Oktober", "", "8.000.000"],
    ["02/10/2026", "Warung Makan", "25.000", ""],
    ["02/10/2026", "Warung Makan", "25.000", ""],
    ["tanggal salah", "X", "1.000", ""],
    ["", "", "", ""],
  ];

  it("tebak pemetaan dari header", () => {
    expect(guessMapping(table)).toMatchObject({
      hasHeader: true,
      dateCol: 0,
      amountMode: "split",
      debitCol: 2,
      creditCol: 3,
      descCol: 1,
    });
  });

  it("konversi + ID stabil, baris kembar tetap dua, baris rusak dilewati", () => {
    const { statement, skipped } = tableToStatement(table, guessMapping(table), {
      source: "csv",
      filename: "mutasi.csv",
    });
    const rows = statement.pockets[0].rows;
    expect(rows.map((r) => [r.counterparty, r.amount])).toEqual([
      ["Gaji Oktober", 800_000_000],
      ["Warung Makan", -2_500_000],
      ["Warung Makan", -2_500_000],
    ]);
    expect(rows[1].externalId).not.toBe(rows[2].externalId);
    expect(skipped).toEqual([{ line: 5, reason: "tanggal tidak dikenali" }]);
    // diimport ulang → ID sama
    const again = tableToStatement(table, guessMapping(table), { source: "csv", filename: "mutasi.csv" });
    expect(again.statement.pockets[0].rows.map((r) => r.externalId)).toEqual(rows.map((r) => r.externalId));
  });

  it("kolom tunggal bertanda & balik tanda", () => {
    const t = [["2026-10-01", "Belanja", "150000"]];
    const m = {
      hasHeader: false,
      dateCol: 0,
      amountMode: "single" as const,
      amountCol: 2,
      descCol: 1,
      dateOrder: "ymd" as const,
    };
    expect(tableToStatement(t, m, { source: "csv", filename: "x" }).statement.pockets[0].rows[0].amount).toBe(
      15_000_000,
    );
    expect(
      tableToStatement(t, { ...m, invertSign: true }, { source: "csv", filename: "x" }).statement.pockets[0].rows[0]
        .amount,
    ).toBe(-15_000_000);
  });
});
