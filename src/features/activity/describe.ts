// Menerjemahkan baris activity_logs menjadi kalimat yang mudah dibaca. Murni (tanpa DB) → diunit-test.
import { formatMoney } from "@/lib/money";
import { formatQuantity } from "@/lib/number";

export type ActivityInput = {
  action: string;
  entity: string;
  diff: Record<string, unknown> | null;
  /** nama entitas saat ini (dari lookup), bila masih ada */
  entityName?: string | null;
};

export type DescribedActivity = {
  title: string;
  /** daftar perubahan field: "Nama: A → B" */
  changes: { label: string; from?: string; to: string }[];
  tone: "default" | "positive" | "danger" | "warning";
  icon:
    | "plus"
    | "pencil"
    | "trash"
    | "login"
    | "logout"
    | "shield"
    | "archive"
    | "key"
    | "copy"
    | "upload"
    | "download"
    | "sparkles";
};

export const ENTITY_GROUPS = {
  transaksi: { label: "Transaksi", entities: ["transaction"] },
  dompet: { label: "Dompet", entities: ["wallet"] },
  kategori: { label: "Kategori", entities: ["category"] },
  budget: { label: "Budget", entities: ["budget"] },
  investasi: { label: "Investasi", entities: ["investment_asset", "investment_txn"] },
  data: { label: "Import/Export", entities: ["import", "export", "backup"] },
  ai: { label: "AI", entities: ["ai_chat", "ai_budget", "ai_settings"] },
  keamanan: { label: "Keamanan", entities: ["auth", "password", "session"] },
} as const;
export type EntityGroup = keyof typeof ENTITY_GROUPS;

const ENTITY_LABEL: Record<string, string> = {
  transaction: "transaksi",
  wallet: "dompet",
  category: "kategori",
  budget: "budget",
  investment_asset: "aset",
  investment_txn: "transaksi investasi",
  session: "sesi",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nama",
  type: "Jenis",
  currency: "Mata uang",
  initialBalance: "Saldo awal",
  icon: "Ikon",
  color: "Warna",
  note: "Catatan",
  parentId: "Induk",
  amount: "Nominal",
  toAmount: "Nominal diterima",
  fee: "Biaya",
  walletId: "Dompet",
  toWalletId: "Dompet tujuan",
  categoryId: "Kategori",
  occurredAt: "Tanggal",
  tags: "Tag",
  ticker: "Kode",
  unitLabel: "Satuan",
  currentPrice: "Harga",
  units: "Jumlah unit",
  price: "Harga per unit",
};

/** field bernilai uang (sen) */
const MONEY_FIELDS = new Set(["initialBalance", "amount", "toAmount", "fee", "currentPrice", "price"]);
/** field id/teknis — cukup disebut "diubah" tanpa nilai mentah */
const OPAQUE_FIELDS = new Set(["walletId", "toWalletId", "categoryId", "parentId", "icon", "color"]);

const TYPE_LABEL: Record<string, string> = {
  income: "pemasukan",
  expense: "pengeluaran",
  transfer: "transfer",
  buy: "beli",
  sell: "jual",
  dividend: "dividen",
  bank: "rekening bank",
  ewallet: "e-wallet",
  cash: "tunai",
  credit: "kartu kredit",
  investment: "rekening investasi",
  other: "lainnya",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatMoney(value, "IDR", { precision: "exact" });
  if (field === "units" && typeof value === "number") return formatQuantity(value);
  if (field === "type" && typeof value === "string") return TYPE_LABEL[value] ?? value;
  if (field === "tags" && Array.isArray(value)) return value.length ? value.map((t) => `#${t}`).join(" ") : "—";
  if (value instanceof Date) return dateFmt.format(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return dateFmt.format(d);
  }
  if (typeof value === "boolean") return value ? "ya" : "tidak";
  return String(value);
}

/** diff bentuk { field: { from, to } } (hasil changedFields) → daftar perubahan */
function changeList(diff: Record<string, unknown> | null): DescribedActivity["changes"] {
  if (!diff) return [];
  const out: DescribedActivity["changes"] = [];
  for (const [field, raw] of Object.entries(diff)) {
    if (!raw || typeof raw !== "object" || !("to" in raw)) continue;
    const { from, to } = raw as { from: unknown; to: unknown };
    const label = FIELD_LABEL[field] ?? field;
    if (OPAQUE_FIELDS.has(field)) out.push({ label, to: "diubah" });
    else out.push({ label, from: formatValue(field, from), to: formatValue(field, to) });
  }
  return out;
}

const q = (s: unknown) => (s ? `"${s}"` : "");
const money = (v: unknown) => (typeof v === "number" ? formatMoney(v, "IDR", { precision: "exact" }) : "");

export function describeActivity(a: ActivityInput): DescribedActivity {
  const d = a.diff ?? {};
  const label = ENTITY_LABEL[a.entity] ?? a.entity;
  // nama saat kejadian (tercatat di diff saat tambah/hapus) lebih akurat untuk riwayat; nama terkini sebagai fallback
  const name = (typeof d.name === "string" ? d.name : null) ?? a.entityName ?? null;

  // ── keamanan ──
  if (a.entity === "auth") {
    if (a.action === "login") return { title: "Masuk ke akun", changes: [], tone: "default", icon: "login" };
    if (a.action === "logout") return { title: "Keluar dari akun", changes: [], tone: "default", icon: "logout" };
    if (a.action === "login_failed")
      return { title: "Percobaan masuk gagal (password salah)", changes: [], tone: "warning", icon: "shield" };
  }
  if (a.entity === "password") return { title: "Mengganti password", changes: [], tone: "warning", icon: "key" };
  if (a.entity === "session") {
    return {
      title: d.scope === "others" ? "Mengeluarkan semua device lain" : "Mengeluarkan satu device",
      changes: [],
      tone: "warning",
      icon: "logout",
    };
  }

  // ── import / export / backup ──
  if (a.entity === "import") {
    if (a.action === "delete")
      return {
        title: `Membatalkan import ${q(d.filename)} (${d.transactions ?? 0} transaksi dihapus)`.replace(/\s+/g, " "),
        changes: [],
        tone: "danger",
        icon: "trash",
      };
    return {
      title: `Mengimport ${d.imported ?? 0} transaksi dari ${q(d.filename)}`.trim(),
      changes: [],
      tone: "positive",
      icon: "upload",
    };
  }
  if (a.entity === "export") {
    const fmt = { csv: "CSV", xlsx: "Excel", json: "backup JSON" }[String(d.format)] ?? String(d.format ?? "");
    return {
      title: `Mengunduh ${fmt} (${d.transactions ?? 0} transaksi)`,
      changes: [],
      tone: "default",
      icon: "download",
    };
  }
  if (a.entity === "backup") {
    return {
      title: `Memulihkan backup (${d.transactions ?? 0} transaksi)`,
      changes: [],
      tone: "warning",
      icon: "upload",
    };
  }

  // ── AI ──
  if (a.entity === "ai_chat")
    return { title: "Bertanya ke Rekomendasi AI", changes: [], tone: "default", icon: "sparkles" };
  if (a.entity === "ai_budget")
    return { title: "Meminta rekomendasi pembagian budget dari AI", changes: [], tone: "default", icon: "sparkles" };
  if (a.entity === "ai_settings") {
    if (d.apiKeyRemoved) return { title: "Menghapus API key AI", changes: [], tone: "warning", icon: "key" };
    return {
      title: d.apiKeyChanged ? "Mengganti API key & pengaturan AI" : "Mengubah pengaturan AI",
      changes: [],
      tone: d.apiKeyChanged ? "warning" : "default",
      icon: "key",
    };
  }
  if (a.entity === "budget" && d.fromAi) {
    return {
      title: `Menerapkan ${d.count} budget dari rekomendasi AI`,
      changes: [],
      tone: "positive",
      icon: "sparkles",
    };
  }

  // ── arsip (diff: { archived: boolean }) ──
  if (a.action === "update" && typeof d.archived === "boolean") {
    return {
      title: `${d.archived ? "Mengarsipkan" : "Mengaktifkan lagi"} ${label} ${q(name)}`.trim(),
      changes: [],
      tone: "default",
      icon: "archive",
    };
  }

  // ── transaksi ──
  if (a.entity === "transaction") {
    const kind = TYPE_LABEL[String(d.type)] ?? "";
    if (a.action === "create")
      return {
        title: `Menambah transaksi ${kind} ${money(d.amount)}`.replace(/\s+/g, " ").trim(),
        changes: [],
        tone: "positive",
        icon: "plus",
      };
    if (a.action === "delete")
      return {
        title: `Menghapus transaksi ${kind} ${money(d.amount)}`.replace(/\s+/g, " ").trim(),
        changes: [],
        tone: "danger",
        icon: "trash",
      };
    return { title: "Mengubah transaksi", changes: changeList(a.diff), tone: "default", icon: "pencil" };
  }

  // ── budget ──
  if (a.entity === "budget") {
    if (a.action === "create" && d.copiedFrom)
      return { title: `Menyalin ${d.count} budget dari bulan lalu`, changes: [], tone: "positive", icon: "copy" };
    if (a.action === "delete")
      return { title: `Menghapus budget ${money(d.amount)}`.trim(), changes: [], tone: "danger", icon: "trash" };
    return {
      title: `Mengatur budget ${q(name)} ${money(d.amount)}`.replace(/\s+/g, " ").trim(),
      changes: [],
      tone: "default",
      icon: "pencil",
    };
  }

  // ── transaksi investasi ──
  if (a.entity === "investment_txn") {
    const kind = TYPE_LABEL[String(d.type)] ?? "";
    const asset = d.asset ? ` ${q(d.asset)}` : "";
    const verb = a.action === "create" ? "Mencatat" : a.action === "delete" ? "Menghapus" : "Mengubah";
    return {
      title: `${verb} ${kind}${asset} ${money(d.amount)}`.replace(/\s+/g, " ").trim(),
      changes: [],
      tone: a.action === "delete" ? "danger" : a.action === "create" ? "positive" : "default",
      icon: a.action === "delete" ? "trash" : a.action === "create" ? "plus" : "pencil",
    };
  }

  // ── kategori default sekaligus ──
  if (a.entity === "category" && a.action === "create" && typeof d.defaults === "number") {
    return { title: `Menambahkan ${d.defaults} kategori default`, changes: [], tone: "positive", icon: "plus" };
  }

  // ── umum: dompet, kategori, aset ──
  if (a.action === "create")
    return { title: `Menambah ${label} ${q(name)}`.trim(), changes: [], tone: "positive", icon: "plus" };
  if (a.action === "delete")
    return { title: `Menghapus ${label} ${q(name)}`.trim(), changes: [], tone: "danger", icon: "trash" };
  return { title: `Mengubah ${label} ${q(name)}`.trim(), changes: changeList(a.diff), tone: "default", icon: "pencil" };
}
