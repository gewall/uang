// Parser teks "Laporan Keuangan Bulanan" Bank Jago (hasil ekstraksi PDF berurutan, lihat ./pdf.ts).
// Murni (tanpa I/O) → diunit-test dengan fixture sintetis di tests/fixtures/jago/.
//
// Struktur per Kantong:
//   <Nama Kantong>
//   ID Kantong <nomor>
//   Akun Aktif, mulai … Mata Uang Dalam IDR.
//   Saldo Sebelumnya / Total Pemasukan / Total Pengeluaran / Saldo Akhir
//   Tanggal & WaktuSumber/Tujuan Rincian Transaksi Catatan Jumlah Saldo
//   [baris transaksi…]
// Per transaksi:
//   04 Okt 2026 · 13.53 · <pihak lawan…> · <jenis> [· sub-jenis] · #ID xxx · [catatan…] · [catatan] ±jumlah saldo

import type { ImportStatement } from "./types";

export type JagoKind =
  | "qris"
  | "transfer_in"
  | "transfer_out"
  | "pocket_move"
  | "jago_pay"
  | "ewallet_withdrawal"
  | "ewallet_topup"
  | "card"
  | "interest"
  | "interest_tax"
  | "rdn_withdrawal"
  | "stock_buy"
  | "fund_buy"
  | "autodebit"
  | "other";

export type JagoRow = {
  externalId: string;
  occurredAt: Date;
  /** nama pihak lawan, mis. "TOKO VIRGO" atau nama Kantong lawan untuk pindah kantong */
  counterparty: string;
  /** bank/e-wallet + nomor pihak lawan, mis. "DANA 9360…" */
  counterpartyAccount: string | null;
  kind: JagoKind;
  /** teks jenis asli, mis. "Pembayaran QRIS" / "Pindah uang antar Kantong · Tarik Uang Kantong" */
  kindLabel: string;
  note: string | null;
  /** sen, bertanda: + masuk, − keluar */
  amount: number;
  /** saldo setelah transaksi (sen) */
  balance: number;
  /** false bila saldo sebelumnya + jumlah ≠ saldo */
  balanceOk: boolean;
};

export type JagoPocket = {
  pocketId: string;
  name: string;
  currency: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  rows: JagoRow[];
  /** semua baris konsisten & total cocok dengan ringkasan */
  consistent: boolean;
};

export type JagoStatement = {
  accountHolder: string | null;
  /** "Oktober 2026" */
  period: string | null;
  pockets: JagoPocket[];
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  des: 12,
};

const DATE_RE = /^(\d{2}) ([A-Za-z]{3}) (\d{4})$/;
const TIME_RE = /^(\d{2})[.:](\d{2})$/;
const ID_RE = /^#ID\s+(\S+)$/;
/** "[catatan ]±1.234,56 7.890,12" — jumlah bertanda lalu saldo (saldo bisa negatif) */
const AMOUNT_RE = /^(?:(.*?)\s+)?([+-]\d{1,3}(?:\.\d{3})*,\d{2})\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;

const NOISE = [
  /^Laporan Keuangan Bulanan - /,
  /^PT Bank Jago Tbk berizin/,
  /^peserta penjaminan Lembaga Penjamin Simpanan/,
  /^Tanggal & Waktu ?Sumber\/Tujuan/,
  /^===== PAGE \d+ =====$/,
];

/** "1.234,56" / "+1.234,56" / "-0,00" → sen */
export function parseIdAmount(s: string): number {
  const t = s.trim();
  const neg = t.startsWith("-");
  const digits = t.replace(/^[+-]/, "").replace(/\./g, "").replace(",", ".");
  const v = Math.round(Number(digits) * 100);
  return neg ? -v : v;
}

function parseDateTime(date: string, time: string): Date | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const month = MONTHS[d[2].toLowerCase()];
  if (!month) return null;
  return new Date(`${d[3]}-${String(month).padStart(2, "0")}-${d[1]}T${t[1]}:${t[2]}:00+07:00`);
}

/** "Penarikan Dana RDN Penarikan Dana RDN" → "Penarikan Dana RDN" */
function dedupeRepeated(line: string): string {
  const words = line.split(" ");
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(" ");
    if (a === words.slice(half).join(" ")) return a;
  }
  return line;
}

const TWO_LINE_KINDS = new Set(["Pindah uang antar Kantong", "Pembayaran dengan", "Pencairan Dana dari"]);

function classify(kindLine: string, detail: string | null): JagoKind {
  const k = kindLine.toLowerCase();
  if (k === "pindah uang antar kantong") return "pocket_move";
  if (k === "pembayaran dengan") return "jago_pay";
  if (k === "pencairan dana dari") return "ewallet_withdrawal";
  if (k.includes("qris")) return "qris";
  if (k === "transfer masuk") return "transfer_in";
  if (k === "transfer keluar") return "transfer_out";
  if (k.startsWith("isi saldo")) return "ewallet_topup";
  if (k.includes("pos") || k.includes("kartu")) return "card";
  if (k === "pajak bunga") return "interest_tax";
  if (k === "bunga") return "interest";
  if (k.includes("penarikan dana rdn")) return "rdn_withdrawal";
  if (k.includes("pembelian saham")) return "stock_buy";
  if (k.includes("reksa dana")) return "fund_buy";
  if (k.includes("autodebit")) return "autodebit";
  void detail;
  return "other";
}

/** Baris pihak lawan → nama + akun. Akun = mulai baris yang memuat nomor panjang, atau label bank sebelum baris angka. */
function splitCounterparty(lines: string[]): { name: string; account: string | null } {
  let accountStart = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const hasNumber = /\d{6,}/.test(lines[i]);
    const nextIsNumber = i + 1 < lines.length && /^\d{6,}$/.test(lines[i + 1]);
    if (i > 0 && (hasNumber || nextIsNumber)) {
      accountStart = i;
      break;
    }
  }
  const name = lines.slice(0, accountStart).join(" ").trim();
  const account = lines.slice(accountStart).join(" ").trim();
  return { name, account: account || null };
}

export function parseJagoStatement(text: string): JagoStatement {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !NOISE.some((re) => re.test(l)));

  const accountHolder = /^(.+?) \/ \d{6,}$/.exec(lines[0] ?? "")?.[1] ?? null;
  const period = /Laporan Keuangan Bulanan - (.+?)(?: Halaman|$)/.exec(text)?.[1]?.trim() ?? null;

  const pockets: JagoPocket[] = [];
  let i = 0;
  const findLine = (re: RegExp, from: number, to: number) => {
    for (let k = from; k < Math.min(to, lines.length); k++) if (re.test(lines[k])) return k;
    return -1;
  };

  while (i < lines.length) {
    const idLine = /^ID Kantong (\d+)$/.exec(lines[i]);
    if (!idLine) {
      i++;
      continue;
    }
    const name = lines[i - 1] ?? "Kantong";
    const currency = /Mata Uang Dalam ([A-Z]{3})/.exec(lines[i + 1] ?? "")?.[1] ?? "IDR";
    const val = (label: string) => {
      const k = findLine(new RegExp(`^${label} ([+-]?[\\d.]+,\\d{2})$`), i, i + 8);
      return k >= 0 ? parseIdAmount(lines[k].slice(label.length + 1)) : 0;
    };
    const pocket: JagoPocket = {
      pocketId: idLine[1],
      name,
      currency,
      opening: val("Saldo Sebelumnya"),
      totalIn: val("Total Pemasukan"),
      totalOut: Math.abs(val("Total Pengeluaran")),
      closing: val("Saldo Akhir"),
      rows: [],
      consistent: true,
    };
    // lompat ke setelah "Saldo Akhir"
    const endHeader = findLine(/^Saldo Akhir /, i, i + 8);
    i = endHeader >= 0 ? endHeader + 1 : i + 1;

    let running = pocket.opening;
    while (i < lines.length) {
      if (/^ID Kantong \d+$/.test(lines[i + 1] ?? "") || /^(NILAI TUKAR MATA UANG|INFO PENTING)/.test(lines[i])) break;
      if (!DATE_RE.test(lines[i]) || !TIME_RE.test(lines[i + 1] ?? "")) {
        i++;
        continue;
      }
      const occurredAt = parseDateTime(lines[i], lines[i + 1]);
      const idIdx = findLine(ID_RE, i + 2, i + 14);
      if (!occurredAt || idIdx < 0) {
        warnings.push(`Baris tidak dikenali di ${name}: "${lines[i]} ${lines[i + 1]}"`);
        i += 2;
        continue;
      }
      const body = lines.slice(i + 2, idIdx);
      let kindLine: string;
      let detail: string | null = null;
      let cpLines: string[];
      if (body.length >= 2 && TWO_LINE_KINDS.has(body[body.length - 2])) {
        kindLine = body[body.length - 2];
        detail = body[body.length - 1];
        cpLines = body.slice(0, -2);
      } else {
        kindLine = dedupeRepeated(body[body.length - 1] ?? "");
        cpLines = body.slice(0, -1);
      }

      // catatan: baris setelah #ID sampai baris jumlah (+ prefix di baris jumlah)
      let amtIdx = -1;
      for (let k = idIdx + 1; k < Math.min(idIdx + 8, lines.length); k++) {
        if (AMOUNT_RE.test(lines[k])) {
          amtIdx = k;
          break;
        }
      }
      if (amtIdx < 0) {
        warnings.push(`Nominal tidak ditemukan untuk #ID ${ID_RE.exec(lines[idIdx])?.[1]}`);
        i = idIdx + 1;
        continue;
      }
      const m = AMOUNT_RE.exec(lines[amtIdx])!;
      const noteParts = [...lines.slice(idIdx + 1, amtIdx), m[1]].filter(Boolean) as string[];
      const amount = parseIdAmount(m[2]);
      const balance = parseIdAmount(m[3]);
      const balanceOk = running + amount === balance;
      running = balance;

      const cp = splitCounterparty(cpLines);
      pocket.rows.push({
        externalId: ID_RE.exec(lines[idIdx])![1],
        occurredAt,
        counterparty: cp.name || (detail ?? kindLine),
        counterpartyAccount: cp.account,
        kind: classify(kindLine, detail),
        kindLabel: detail ? `${kindLine} · ${detail}` : kindLine,
        note: noteParts.length ? noteParts.join(" ") : null,
        amount,
        balance,
        balanceOk,
      });
      i = amtIdx + 1;
    }

    const sumIn = pocket.rows.filter((r) => r.amount > 0).reduce((n, r) => n + r.amount, 0);
    const sumOut = pocket.rows.filter((r) => r.amount < 0).reduce((n, r) => n - r.amount, 0);
    const lastBalance = pocket.rows.at(-1)?.balance ?? pocket.opening;
    pocket.consistent =
      pocket.rows.every((r) => r.balanceOk) &&
      sumIn === pocket.totalIn &&
      sumOut === pocket.totalOut &&
      lastBalance === pocket.closing;
    if (!pocket.consistent) {
      warnings.push(
        `Kantong "${name}": saldo/total tidak cocok dengan ringkasan (dibaca masuk ${sumIn / 100}, keluar ${sumOut / 100}).`,
      );
    }
    pockets.push(pocket);
  }

  if (pockets.length === 0)
    warnings.push("Tidak ada Kantong yang terbaca — pastikan file adalah Laporan Keuangan Bulanan Jago.");
  return { accountHolder, period, pockets, warnings };
}

/** Bentuk umum (serializable JSON) untuk pipeline import. */
export function jagoToImportStatement(s: JagoStatement): ImportStatement {
  return {
    source: "jago_pdf",
    accountHolder: s.accountHolder,
    period: s.period,
    warnings: s.warnings,
    pockets: s.pockets.map((p) => ({
      pocketId: p.pocketId,
      name: p.name,
      currency: p.currency,
      opening: p.opening,
      closing: p.closing,
      consistent: p.consistent,
      rows: p.rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() })),
    })),
  };
}
