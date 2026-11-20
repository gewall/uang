// Import generik dari tabel (CSV / sheet Excel) dengan pemetaan kolom. Murni → diunit-test.
import { parseMoneyInput } from "@/lib/money";
import type { ImportRow, ImportStatement } from "./types";

export type ColumnMapping = {
  hasHeader: boolean;
  dateCol: number;
  /** "single" = satu kolom nominal bertanda; "split" = kolom debit (keluar) & kredit (masuk) */
  amountMode: "single" | "split";
  amountCol?: number;
  debitCol?: number;
  creditCol?: number;
  descCol: number;
  noteCol?: number;
  /** urutan tanggal untuk format angka (04/10/2026) */
  dateOrder: "dmy" | "mdy" | "ymd";
  /** nominal positif di kolom tunggal berarti pengeluaran (mis. ekspor kartu kredit) */
  invertSign?: boolean;
};

/** Tebakan awal pemetaan dari nama header. */
export function guessMapping(table: string[][]): ColumnMapping {
  const header = (table[0] ?? []).map((h) => h.toLowerCase());
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const dateCol = find("tanggal", "date", "waktu", "tgl");
  const debitCol = find("debit", "keluar", "pengeluaran", "debet");
  const creditCol = find("kredit", "credit", "masuk", "pemasukan");
  const amountCol = find("jumlah", "nominal", "amount", "mutasi");
  const descCol = find("keterangan", "deskripsi", "description", "uraian", "merchant", "nama", "catatan");
  const hasHeader = dateCol >= 0 || amountCol >= 0 || descCol >= 0;
  const split = debitCol >= 0 && creditCol >= 0;
  const used = new Set([dateCol, amountCol, debitCol, creditCol].filter((i) => i >= 0));
  // kolom pertama yang belum terpakai sebagai cadangan
  const firstFree = (table[0] ?? []).findIndex((_, i) => !used.has(i));
  return {
    hasHeader,
    dateCol: Math.max(0, dateCol),
    amountMode: split ? "split" : "single",
    amountCol: split ? undefined : amountCol >= 0 ? amountCol : Math.max(0, firstFree),
    debitCol: split ? debitCol : undefined,
    creditCol: split ? creditCol : undefined,
    descCol: descCol >= 0 ? descCol : Math.max(0, firstFree),
    dateOrder: "dmy",
  };
}

/**
 * Nominal teks bebas → sen. Mendukung "1.500.000", "1,500,000.50" (gaya Inggris), "-25.000", "(25.000)",
 * "Rp 25.000", "25.000 DB" / "25.000 CR". null bila kosong / tidak dikenali.
 */
export function parseAmountText(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  const suffix = /\s*(DB|D|DR|CR|K|KR)\.?$/i.exec(s);
  if (suffix) {
    if (/^(DB|D|DR)$/i.test(suffix[1])) sign *= -1;
    s = s.slice(0, suffix.index);
  }
  s = s.replace(/rp\.?|idr|\s/gi, "");
  if (s.startsWith("-")) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let indo: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // keduanya ada: pemisah terakhir = desimal
    indo = lastDot > lastComma ? s.replace(/,/g, "").replace(".", ",") : s;
  } else if (lastComma >= 0 && /^\d{1,3}(,\d{3})+$/.test(s)) {
    indo = s.replace(/,/g, "."); // "1,500,000" gaya Inggris tanpa desimal
  } else {
    indo = s;
  }
  const minor = parseMoneyInput(indo);
  return minor === null ? null : minor * sign;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  may: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  aug: 8,
  sep: 9,
  okt: 10,
  oct: 10,
  nov: 11,
  des: 12,
  dec: 12,
};

/** Tanggal teks → ISO (diasumsikan WIB bila tanpa zona). Mendukung ISO, d/m/y, y-m-d, "04 Okt 2026", plus jam opsional. */
export function parseDateText(raw: string, order: ColumnMapping["dateOrder"]): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const time = /(\d{1,2})[:.](\d{2})(?::(\d{2}))?\s*$/.exec(s);
  const datePart = time ? s.slice(0, time.index).trim().replace(/[,T]$/, "").trim() : s;
  let y: number, m: number, d: number;
  const named = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{4})$/.exec(datePart);
  const nums = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/.exec(datePart);
  if (named) {
    d = Number(named[1]);
    m = MONTH_NAMES[named[2].toLowerCase()] ?? 0;
    y = Number(named[3]);
  } else if (nums) {
    const [a, b, c] = [Number(nums[1]), Number(nums[2]), Number(nums[3])];
    if (nums[1].length === 4 || order === "ymd") [y, m, d] = [a, b, c];
    else if (order === "mdy") [m, d, y] = [a, b, c];
    else [d, m, y] = [a, b, c];
    if (y < 100) y += 2000;
  } else return null;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900)) return null;
  const hh = time ? Number(time[1]) : 12;
  const mm = time ? Number(time[2]) : 0;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`;
  const out = new Date(iso);
  return Number.isNaN(out.getTime()) || out.getUTCDate() === undefined ? null : out.toISOString();
}

/** FNV-1a 32-bit → hex (ID stabil untuk deteksi duplikat). */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type TableParseResult = { statement: ImportStatement; skipped: { line: number; reason: string }[] };

export function tableToStatement(
  table: string[][],
  mapping: ColumnMapping,
  meta: { source: "csv" | "xlsx"; filename: string },
): TableParseResult {
  const body = mapping.hasHeader ? table.slice(1) : table;
  const offset = mapping.hasHeader ? 2 : 1;
  const rows: ImportRow[] = [];
  const skipped: TableParseResult["skipped"] = [];
  const seen = new Map<string, number>();

  body.forEach((cells, i) => {
    const line = i + offset;
    if (cells.every((c) => !c?.trim())) return;
    const occurredAt = parseDateText(cells[mapping.dateCol] ?? "", mapping.dateOrder);
    if (!occurredAt) return void skipped.push({ line, reason: "tanggal tidak dikenali" });

    let amount: number | null;
    if (mapping.amountMode === "split") {
      const debit = parseAmountText(cells[mapping.debitCol ?? -1] ?? "");
      const credit = parseAmountText(cells[mapping.creditCol ?? -1] ?? "");
      amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
      if (!debit && !credit) amount = null;
    } else {
      amount = parseAmountText(cells[mapping.amountCol ?? -1] ?? "");
      if (amount !== null && mapping.invertSign) amount = -amount;
    }
    if (amount === null) return void skipped.push({ line, reason: "nominal tidak dikenali" });
    if (amount === 0) return void skipped.push({ line, reason: "nominal 0" });

    const desc = (cells[mapping.descCol] ?? "").trim();
    const note = mapping.noteCol !== undefined ? (cells[mapping.noteCol] ?? "").trim() || null : null;
    // ID stabil: isi baris + urutan kemunculan baris identik (supaya 2 transaksi kembar tetap dua)
    const base = `${occurredAt}|${amount}|${desc}|${note ?? ""}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({
      externalId: `${hash(base)}-${n}`,
      occurredAt,
      counterparty: desc || "(tanpa keterangan)",
      counterpartyAccount: null,
      kind: "generic",
      kindLabel: amount > 0 ? "Pemasukan" : "Pengeluaran",
      note,
      amount,
      balance: null,
      balanceOk: true,
    });
  });

  rows.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const dates = rows.map((r) => r.occurredAt.slice(0, 10));
  return {
    statement: {
      source: meta.source,
      accountHolder: null,
      period: dates.length ? `${dates[0]} s.d. ${dates[dates.length - 1]}` : null,
      warnings: skipped.length ? [`${skipped.length} baris dilewati (tanggal/nominal tidak dikenali)`] : [],
      pockets: [
        {
          pocketId: "file",
          name: meta.filename,
          currency: "IDR",
          opening: 0,
          closing: null,
          consistent: true,
          rows,
        },
      ],
    },
    skipped,
  };
}
