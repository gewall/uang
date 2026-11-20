// Pembentuk file export (CSV & Excel). Server-only karena exceljs.
import "server-only";
import ExcelJS from "exceljs";
import { MINOR_PER_UNIT } from "@/lib/money";
import type { ExportTxn, exportSheets } from "./data";

const TYPE = { income: "Pemasukan", expense: "Pengeluaran", transfer: "Transfer" } as const;

const wib = (d: Date) => {
  const s = new Date(d.getTime() + 7 * 3600e3).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
};
const units = (minor: number) => minor / MINOR_PER_UNIT;

/** Nominal bertanda dari sisi dompet asal (transfer = keluar dari dompet asal). */
function signed(t: ExportTxn) {
  return t.type === "income" ? t.amount : -t.amount;
}

function describe(t: ExportTxn) {
  return t.note || t.counterparty || (t.type === "transfer" ? `Transfer ke ${t.toWallet}` : t.category) || "";
}

export const TXN_COLUMNS = [
  "Tanggal",
  "Jenis",
  "Keterangan",
  "Nominal",
  "Mata uang",
  "Dompet",
  "Dompet tujuan",
  "Kategori",
  "Biaya",
  "Catatan",
  "Pihak lawan",
  "Tag",
  "Tidak dihitung statistik",
  "Sumber",
] as const;

function txnRow(t: ExportTxn): (string | number)[] {
  return [
    wib(t.occurredAt),
    TYPE[t.type],
    describe(t),
    units(signed(t)),
    t.currency,
    t.wallet,
    t.toWallet ?? "",
    t.parentCategory ? `${t.parentCategory} › ${t.category}` : (t.category ?? ""),
    units(t.fee),
    t.note ?? "",
    t.counterparty ?? "",
    t.tags.join(", "),
    t.excludeFromStats ? "ya" : "",
    t.source === "import" ? "import" : "manual",
  ];
}

function csvCell(v: string | number): string {
  const s = typeof v === "number" ? String(v) : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV dengan BOM (Excel membaca UTF-8 dengan benar). Kolom Tanggal/Keterangan/Nominal bisa diimport ulang. */
export function transactionsCsv(rows: ExportTxn[]): string {
  const lines = [TXN_COLUMNS.join(","), ...rows.map((r) => txnRow(r).map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

const MONEY_FMT = "#,##0.00;[Red]-#,##0.00";

export async function workbook(rows: ExportTxn[], sheets: Awaited<ReturnType<typeof exportSheets>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "uang";
  wb.created = new Date();

  const sheet = (
    name: string,
    columns: { header: string; width?: number; money?: boolean }[],
    data: (string | number | null)[][],
  ) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map((c) => ({
      header: c.header,
      width: c.width ?? 16,
      style: c.money ? { numFmt: MONEY_FMT } : {},
    }));
    ws.getRow(1).font = { bold: true };
    for (const r of data) ws.addRow(r);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  };

  sheet(
    "Transaksi",
    TXN_COLUMNS.map((h) => ({
      header: h,
      width: h === "Keterangan" || h === "Catatan" ? 32 : 16,
      money: h === "Nominal" || h === "Biaya",
    })),
    rows.map(txnRow),
  );
  sheet(
    "Dompet",
    [
      { header: "Nama", width: 24 },
      { header: "Jenis" },
      { header: "Mata uang" },
      { header: "Saldo awal", money: true },
      { header: "Saldo sekarang", money: true },
      { header: "Diarsipkan" },
    ],
    sheets.walletRows.map((w) => [
      w.name,
      w.type,
      w.currency,
      units(w.initialBalance),
      units(w.balance),
      w.archivedAt ? "ya" : "",
    ]),
  );
  sheet(
    "Kategori",
    [{ header: "Nama", width: 24 }, { header: "Jenis" }, { header: "Induk", width: 24 }, { header: "Diarsipkan" }],
    sheets.categoryRows.map((c) => [
      c.name,
      c.kind === "income" ? "Pemasukan" : "Pengeluaran",
      c.parent ?? "",
      c.archivedAt ? "ya" : "",
    ]),
  );
  sheet(
    "Budget",
    [{ header: "Bulan" }, { header: "Kategori", width: 24 }, { header: "Batas", money: true }],
    sheets.budgetRows.map((b) => [b.month.slice(0, 7), b.category, units(b.amount)]),
  );
  sheet(
    "Investasi",
    [
      { header: "Aset", width: 28 },
      { header: "Jenis" },
      { header: "Kode" },
      { header: "Satuan" },
      { header: "Harga terkini", money: true },
      { header: "Mata uang" },
    ],
    sheets.assets.map((a) => [
      a.name,
      a.type,
      a.ticker ?? "",
      a.unitLabel,
      a.currentPrice === null ? null : units(a.currentPrice),
      a.currency,
    ]),
  );
  sheet(
    "Transaksi investasi",
    [
      { header: "Tanggal" },
      { header: "Aset", width: 28 },
      { header: "Jenis" },
      { header: "Unit" },
      { header: "Harga/unit", money: true },
      { header: "Biaya", money: true },
      { header: "Total", money: true },
      { header: "Catatan", width: 28 },
    ],
    sheets.invTxns.map((t) => [
      wib(t.occurredAt),
      t.asset,
      t.type === "buy" ? "Beli" : t.type === "sell" ? "Jual" : "Dividen",
      t.units ?? null,
      t.price === null ? null : units(t.price),
      units(t.fee),
      units(t.amount),
      t.note ?? "",
    ]),
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}
