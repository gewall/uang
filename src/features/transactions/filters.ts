import { currentMonth, isMonth } from "@/lib/dates";

export const PAGE_SIZE = 50;
const MAX_LIMIT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TransactionFilters = {
  month: string;
  q?: string;
  walletId?: string;
  categoryId?: string;
  type?: "income" | "expense" | "transfer";
  tag?: string;
  limit: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** searchParams → filter tervalidasi (nilai tidak valid diabaikan). Nama param berbahasa Indonesia. */
export function parseFilters(params: Params): TransactionFilters {
  const month = one(params.bulan);
  const q = one(params.q)?.trim().slice(0, 100);
  const walletId = one(params.dompet);
  const categoryId = one(params.kategori);
  const type = one(params.tipe);
  const tag = one(params.tag)?.trim().toLowerCase().slice(0, 24);
  const limit = Number(one(params.limit));
  return {
    month: isMonth(month) ? month : currentMonth(),
    q: q || undefined,
    walletId: walletId && UUID.test(walletId) ? walletId : undefined,
    categoryId: categoryId && UUID.test(categoryId) ? categoryId : undefined,
    type: type === "income" || type === "expense" || type === "transfer" ? type : undefined,
    tag: tag || undefined,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : PAGE_SIZE,
  };
}

/** Filter → query string (hanya nilai yang bukan default). */
export function filtersToSearch(f: Partial<TransactionFilters>, base: Partial<TransactionFilters> = {}): string {
  const merged = { ...base, ...f };
  const p = new URLSearchParams();
  if (merged.month && merged.month !== currentMonth()) p.set("bulan", merged.month);
  if (merged.q) p.set("q", merged.q);
  if (merged.walletId) p.set("dompet", merged.walletId);
  if (merged.categoryId) p.set("kategori", merged.categoryId);
  if (merged.type) p.set("tipe", merged.type);
  if (merged.tag) p.set("tag", merged.tag);
  if (merged.limit && merged.limit !== PAGE_SIZE) p.set("limit", String(merged.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: TransactionFilters): number {
  return [f.walletId, f.categoryId, f.type, f.tag].filter(Boolean).length;
}
