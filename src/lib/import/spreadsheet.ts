import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_TABLE_ROWS = 5000;

/** CSV (deteksi pemisah otomatis: koma / titik koma / tab) → tabel string. */
export function csvToTable(text: string): string[][] {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return res.data.slice(0, MAX_TABLE_ROWS + 1).map((row) => row.map((c) => String(c ?? "").trim()));
}

/** Sheet pertama Excel (.xlsx) → tabel string. Tanggal Excel → ISO, angka → teks tanpa format ribuan. */
export async function xlsxToTable(data: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (out.length > MAX_TABLE_ROWS) return;
    const cells: string[] = [];
    const n = row.cellCount;
    for (let i = 1; i <= n; i++) {
      const v = row.getCell(i).value;
      cells.push(cellToString(v));
    }
    out.push(cells);
  });
  return out;
}

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // Excel menyimpan tanggal tanpa zona; exceljs membacanya sebagai UTC → tulis sebagai waktu lokal WIB
    const iso = v.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellToString(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v).trim();
}
