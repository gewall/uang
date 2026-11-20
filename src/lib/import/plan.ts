// Rencana import: dari laporan ter-parse + pemetaan kantong + koreksi user → daftar transaksi yang akan dibuat.
// Murni & deterministik: dipakai di browser (preview live) DAN di server saat commit (hasil identik).
import type { ImportPocket, ImportRow, ImportStatement } from "./types";

/** Ke mana sebuah kantong dipetakan. */
export type PocketMapping = { mode: "new"; name: string } | { mode: "existing"; walletId: string } | { mode: "skip" };

/** Referensi dompet di rencana: kantong dari laporan, atau dompet yang sudah ada. */
export type WalletRef = `pocket:${string}` | `wallet:${string}`;

export type CategoryRef = { id: string; kind: "income" | "expense"; name: string };

export type PlanContext = {
  /** kategori sistem by key */
  system: { interest: string; tax: string; investment: string; investmentReturn: string };
  /** kategori "Lainnya" per jenis (fallback) */
  fallback: { income: string; expense: string };
  /** aturan kategori: pola (huruf kecil) di nama pihak lawan → kategori */
  rules: { pattern: string; kind: "income" | "expense"; categoryId: string }[];
  /** externalId yang sudah ada di DB (deteksi duplikat) */
  existingExternalIds: Set<string>;
};

/** Koreksi user per baris rencana (key = PlannedRow.key). */
export type RowOverride = {
  include?: boolean;
  categoryId?: string;
  /** ubah jadi transfer ke dompet ini */
  toWallet?: WalletRef;
  excludeFromStats?: boolean;
};

export type PlannedRow = {
  key: string;
  /** kunci anti-duplikat yang disimpan di transactions.external_id */
  externalId: string;
  sourceIds: string[];
  occurredAt: string;
  type: "income" | "expense" | "transfer";
  from: WalletRef;
  to: WalletRef | null;
  /** sen, > 0 */
  amount: number;
  categoryId: string | null;
  excludeFromStats: boolean;
  counterparty: string;
  kindLabel: string;
  note: string | null;
  pocketName: string;
  toPocketName: string | null;
  status: "new" | "duplicate";
  include: boolean;
  /** alasan saran kategori / peringatan, untuk ditampilkan */
  hints: string[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const minuteKey = (iso: string) => iso.slice(0, 16);

/** Kunci anti-duplikat. Pasangan transfer antar kantong: gabungan dua ID (terurut) supaya stabil. */
export function externalKey(source: ImportStatement["source"], ids: string[]): string {
  const prefix = source === "jago_pdf" ? "jago" : source;
  return `${prefix}:${[...ids].sort().join("+")}`;
}

type Leg = { pocket: ImportPocket; row: ImportRow };

/** Pasangkan "Pindah uang antar Kantong": keluar dari A (nama lawan = B) ↔ masuk ke B (nama lawan = A), menit & nominal sama. */
function pairPocketMoves(pockets: ImportPocket[]) {
  const byName = new Map(pockets.map((p) => [norm(p.name), p]));
  const legs: Leg[] = pockets.flatMap((p) =>
    p.rows.filter((r) => r.kind === "pocket_move").map((row) => ({ pocket: p, row })),
  );
  const used = new Set<string>();
  const pairs: { out: Leg; in: Leg }[] = [];
  for (const out of legs) {
    if (out.row.amount >= 0 || used.has(out.row.externalId)) continue;
    const target = byName.get(norm(out.row.counterparty));
    if (!target) continue;
    const match = legs.find(
      (l) =>
        l.pocket === target &&
        !used.has(l.row.externalId) &&
        l.row.amount === -out.row.amount &&
        norm(l.row.counterparty) === norm(out.pocket.name) &&
        minuteKey(l.row.occurredAt) === minuteKey(out.row.occurredAt),
    );
    if (match) {
      used.add(out.row.externalId);
      used.add(match.row.externalId);
      pairs.push({ out, in: match });
    }
  }
  return { pairs, used };
}

function ruleCategory(ctx: PlanContext, counterparty: string, kind: "income" | "expense") {
  const cp = norm(counterparty);
  // pola terpanjang menang (lebih spesifik)
  const hit = ctx.rules
    .filter((r) => r.kind === kind && r.pattern && cp.includes(r.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
  return hit?.categoryId ?? null;
}

export function buildImportPlan(
  statement: ImportStatement,
  mappings: Record<string, PocketMapping>,
  ctx: PlanContext,
  overrides: Record<string, RowOverride> = {},
): PlannedRow[] {
  const active = statement.pockets.filter((p) => (mappings[p.pocketId]?.mode ?? "skip") !== "skip");
  const { pairs, used } = pairPocketMoves(active);
  const holder = statement.accountHolder ? norm(statement.accountHolder) : null;
  const rows: PlannedRow[] = [];

  for (const { out, in: inc } of pairs) {
    const externalId = externalKey(statement.source, [out.row.externalId, inc.row.externalId]);
    rows.push({
      key: externalId,
      externalId,
      sourceIds: [out.row.externalId, inc.row.externalId],
      occurredAt: out.row.occurredAt,
      type: "transfer",
      from: `pocket:${out.pocket.pocketId}`,
      to: `pocket:${inc.pocket.pocketId}`,
      amount: -out.row.amount,
      categoryId: null,
      excludeFromStats: false,
      counterparty: `${out.pocket.name} → ${inc.pocket.name}`,
      kindLabel: "Pindah uang antar Kantong",
      note: out.row.note ?? inc.row.note,
      pocketName: out.pocket.name,
      toPocketName: inc.pocket.name,
      status: "new",
      include: true,
      hints: ["dipasangkan sebagai transfer antar kantong"],
    });
  }

  for (const pocket of active) {
    for (const r of pocket.rows) {
      if (used.has(r.externalId) || r.amount === 0) continue;
      const isIn = r.amount > 0;
      const kind = isIn ? "income" : "expense";
      const hints: string[] = [];
      let categoryId: string | null = null;
      let excludeFromStats = false;

      switch (r.kind) {
        case "interest":
          categoryId = ctx.system.interest;
          hints.push("bunga");
          break;
        case "interest_tax":
          categoryId = ctx.system.tax;
          hints.push("pajak bunga");
          break;
        case "stock_buy":
        case "fund_buy":
        case "rdn_withdrawal":
          categoryId = isIn ? ctx.system.investmentReturn : ctx.system.investment;
          excludeFromStats = true;
          hints.push("investasi — tidak dihitung sebagai pengeluaran");
          break;
        case "pocket_move":
          excludeFromStats = true;
          hints.push("pindah kantong tanpa pasangan (kantong lawan dilewati/tidak ada)");
          break;
        default: {
          if (holder && norm(r.counterparty) === holder) {
            excludeFromStats = true;
            hints.push("ke/dari rekening sendiri — pilih 'transfer ke dompet' bila dompetnya kamu catat");
          }
        }
      }
      if (!categoryId) {
        const ruled = ruleCategory(ctx, r.counterparty, kind);
        if (ruled) hints.push("aturan kategori");
        categoryId = ruled ?? ctx.fallback[kind];
      }

      const externalId = externalKey(statement.source, [r.externalId]);
      rows.push({
        key: externalId,
        externalId,
        sourceIds: [r.externalId],
        occurredAt: r.occurredAt,
        type: kind,
        from: `pocket:${pocket.pocketId}`,
        to: null,
        amount: Math.abs(r.amount),
        categoryId,
        excludeFromStats,
        counterparty: r.counterparty,
        kindLabel: r.kindLabel,
        note: r.note,
        pocketName: pocket.name,
        toPocketName: null,
        status: "new",
        include: true,
        hints,
      });
    }
  }

  // duplikat & koreksi user
  for (const row of rows) {
    if (
      ctx.existingExternalIds.has(row.externalId) ||
      row.sourceIds.some((id) => ctx.existingExternalIds.has(externalKey(statement.source, [id])))
    ) {
      row.status = "duplicate";
      row.include = false;
    }
    const o = overrides[row.key];
    if (!o) continue;
    if (o.toWallet && row.type !== "transfer") {
      // jadikan transfer: keluar → dari kantong ke dompet tujuan; masuk → dari dompet sumber ke kantong
      const pocketRef = row.from;
      row.type = "transfer";
      row.categoryId = null;
      row.excludeFromStats = false;
      if (row.amount > 0 && rowIsIncoming(statement, row)) {
        row.from = o.toWallet;
        row.to = pocketRef;
      } else {
        row.to = o.toWallet;
      }
    } else if (o.categoryId && row.type !== "transfer") {
      row.categoryId = o.categoryId;
    }
    if (o.excludeFromStats !== undefined && row.type !== "transfer") row.excludeFromStats = o.excludeFromStats;
    if (o.include !== undefined && row.status !== "duplicate") row.include = o.include;
  }

  return rows.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.key.localeCompare(b.key));
}

function rowIsIncoming(statement: ImportStatement, row: PlannedRow): boolean {
  const src = statement.pockets.flatMap((p) => p.rows).find((r) => r.externalId === row.sourceIds[0]);
  return (src?.amount ?? 0) > 0;
}

/** Ringkasan untuk tampilan & validasi. */
export function summarizePlan(rows: PlannedRow[]) {
  return {
    total: rows.length,
    toImport: rows.filter((r) => r.include).length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    transfers: rows.filter((r) => r.include && r.type === "transfer").length,
    excluded: rows.filter((r) => r.include && r.excludeFromStats).length,
  };
}

/** Saldo awal untuk dompet baru = saldo sebelum transaksi pertama di laporan. */
export function openingFor(pocket: ImportPocket): number {
  return pocket.opening;
}
