// Skema database. Tabel ditambahkan per fase (lihat CLAUDE.md).
// Konvensi: id uuid, user_id, created_at, updated_at; uang = bigint satuan sen (×100), tanpa float.
// Nama kolom ditulis camelCase di TS, jadi snake_case di DB (casing: "snake_case").
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const paletteEnum = pgEnum("palette", ["warm", "cold"]);
export const themeModeEnum = pgEnum("theme_mode", ["light", "dark", "system"]);

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  username: text().notNull().unique(),
  passwordHash: text().notNull(),
  palette: paletteEnum().notNull().default("warm"),
  themeMode: themeModeEnum().notNull().default("system"),
  currency: text().notNull().default("IDR"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    userAgent: text(),
    ip: inet(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const activityActionEnum = pgEnum("activity_action", [
  "create",
  "update",
  "delete",
  "login",
  "login_failed",
  "logout",
  "import",
  "export",
  "ai",
]);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    // null untuk login gagal dengan username yang tidak ada
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    action: activityActionEnum().notNull(),
    entity: text().notNull(),
    entityId: uuid(),
    // ringkasan perubahan / detail event (jangan simpan password atau API key)
    diff: jsonb().$type<Record<string, unknown>>(),
    ip: inet(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_logs_user_created_idx").on(t.userId, t.createdAt.desc()),
    // dipakai rate limit login: hitung login_failed per username/ip dalam 15 menit terakhir
    index("activity_logs_login_failed_idx")
      .on(t.createdAt)
      .where(sql`${t.action} = 'login_failed'`),
  ],
);

// ── Dompet ───────────────────────────────────────────────────────────
export const walletTypeEnum = pgEnum("wallet_type", ["bank", "ewallet", "cash", "credit", "investment", "other"]);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: walletTypeEnum().notNull().default("bank"),
    currency: text().notNull().default("IDR"),
    /** saldo sebelum transaksi pertama yang dicatat, dalam sen */
    initialBalance: bigint({ mode: "number" }).notNull().default(0),
    icon: text().notNull().default("wallet"),
    color: text().notNull().default("slate"),
    note: text(),
    /** ID eksternal, mis. "ID Kantong" Bank Jago — untuk mapping otomatis saat import */
    externalRef: text(),
    sortOrder: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("wallets_user_name_uq").on(t.userId, t.name),
    uniqueIndex("wallets_user_external_ref_uq")
      .on(t.userId, t.externalRef)
      .where(sql`${t.externalRef} is not null`),
  ],
);

// ── Kategori ─────────────────────────────────────────────────────────
export const categoryKindEnum = pgEnum("category_kind", ["income", "expense"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: categoryKindEnum().notNull(),
    name: text().notNull(),
    /** satu level subkategori; kalau induk dihapus, anak jadi kategori utama */
    parentId: uuid().references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    icon: text().notNull().default("tag"),
    color: text().notNull().default("slate"),
    /** kategori bawaan yang dipakai fitur lain (Bunga, Pajak, Investasi…): tidak bisa dihapus */
    isSystem: boolean().notNull().default(false),
    /** penanda tetap untuk kategori sistem (tidak berubah walau nama diganti), lihat SYSTEM_CATEGORY */
    systemKey: text(),
    sortOrder: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("categories_user_kind_name_uq").on(t.userId, t.kind, t.name),
    uniqueIndex("categories_user_system_key_uq")
      .on(t.userId, t.systemKey)
      .where(sql`${t.systemKey} is not null`),
    index("categories_parent_idx").on(t.parentId),
  ],
);

// ── Transaksi ────────────────────────────────────────────────────────
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "import"]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionTypeEnum().notNull(),
    /** income: dompet penerima; expense: dompet sumber; transfer: dompet asal */
    walletId: uuid()
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    /** hanya untuk transfer */
    toWalletId: uuid().references(() => wallets.id, { onDelete: "restrict" }),
    /** null untuk transfer */
    categoryId: uuid().references(() => categories.id, { onDelete: "restrict" }),
    /** nominal dalam sen, mata uang dompet asal, selalu > 0 */
    amount: bigint({ mode: "number" }).notNull(),
    /** transfer beda mata uang: nominal yang diterima dompet tujuan (sen). null = sama dengan amount */
    toAmount: bigint({ mode: "number" }),
    /** biaya transfer/admin, dibebankan ke dompet asal (sen) */
    fee: bigint({ mode: "number" }).notNull().default(0),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    note: text(),
    /** pihak lawan, mis. nama merchant / pengirim (dari import) */
    counterparty: text(),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: transactionSourceEnum().notNull().default("manual"),
    importBatchId: uuid().references((): AnyPgColumn => importBatches.id, { onDelete: "set null" }),
    /** tetap mengubah saldo dompet, tapi tidak dihitung sebagai pemasukan/pengeluaran (mis. beli/jual investasi) */
    excludeFromStats: boolean().notNull().default(false),
    /** ID transaksi dari sumber eksternal (mis. #ID Jago) untuk mencegah import ganda */
    externalId: text(),
    ...timestamps,
  },
  (t) => [
    index("transactions_user_occurred_idx").on(t.userId, t.occurredAt.desc()),
    index("transactions_wallet_idx").on(t.walletId),
    index("transactions_to_wallet_idx").on(t.toWalletId),
    index("transactions_category_idx").on(t.categoryId),
    uniqueIndex("transactions_user_external_uq")
      .on(t.userId, t.externalId)
      .where(sql`${t.externalId} is not null`),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check("transactions_fee_nonneg", sql`${t.fee} >= 0`),
    check("transactions_to_amount_positive", sql`${t.toAmount} is null or ${t.toAmount} > 0`),
    check(
      "transactions_shape",
      sql`(${t.type} = 'transfer' and ${t.toWalletId} is not null and ${t.toWalletId} <> ${t.walletId} and ${t.categoryId} is null)
       or (${t.type} <> 'transfer' and ${t.toWalletId} is null and ${t.toAmount} is null)`,
    ),
  ],
);

// ── Budget ───────────────────────────────────────────────────────────
export const budgets = pgTable(
  "budgets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** kategori pengeluaran; budget induk mencakup subkategorinya */
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** tanggal 1 bulan tersebut, "YYYY-MM-01" */
    month: date({ mode: "string" }).notNull(),
    /** batas pengeluaran (sen) */
    amount: bigint({ mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("budgets_user_category_month_uq").on(t.userId, t.categoryId, t.month),
    index("budgets_user_month_idx").on(t.userId, t.month),
    check("budgets_amount_positive", sql`${t.amount} > 0`),
  ],
);

// ── Import ───────────────────────────────────────────────────────────
export const importSourceEnum = pgEnum("import_source", ["jago_pdf", "csv", "xlsx"]);
export const importStatusEnum = pgEnum("import_status", ["draft", "committed", "undone"]);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: importSourceEnum().notNull(),
    filename: text().notNull(),
    status: importStatusEnum().notNull().default("draft"),
    /** hasil parse ter-normalisasi (ImportStatement) — untuk PDF Jago */
    statement: jsonb().$type<import("@/lib/import/types").ImportStatement>(),
    /** tabel mentah (header + baris) — untuk CSV/Excel, dipetakan kolomnya di halaman preview */
    rawTable: jsonb().$type<string[][]>(),
    period: text(),
    rowsImported: integer().notNull().default(0),
    rowsSkipped: integer().notNull().default(0),
    /** dompet yang dibuat oleh import ini (dihapus lagi saat undo bila kosong) */
    createdWalletIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    committedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("import_batches_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Aturan kategori otomatis: nama pihak lawan mengandung `pattern` → kategori. Dipelajari dari koreksi saat import. */
export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: categoryKindEnum().notNull(),
    /** huruf kecil, spasi dinormalisasi */
    pattern: text().notNull(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    hits: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("categorization_rules_user_kind_pattern_uq").on(t.userId, t.kind, t.pattern)],
);

// ── Investasi ────────────────────────────────────────────────────────
export const assetTypeEnum = pgEnum("asset_type", [
  "saham",
  "reksadana",
  "emas",
  "crypto",
  "deposito",
  "obligasi",
  "lainnya",
]);
export const investmentTxnTypeEnum = pgEnum("investment_txn_type", ["buy", "sell", "dividend"]);

export const investmentAssets = pgTable(
  "investment_assets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: assetTypeEnum().notNull(),
    ticker: text(),
    currency: text().notNull().default("IDR"),
    /** satuan unit untuk tampilan: lembar, unit, gram, koin… */
    unitLabel: text().notNull().default("unit"),
    /** harga per 1 unit (sen), diupdate manual */
    currentPrice: bigint({ mode: "number" }),
    priceUpdatedAt: timestamp({ withTimezone: true }),
    note: text(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("investment_assets_user_name_uq").on(t.userId, t.name),
    check("investment_assets_price_nonneg", sql`${t.currentPrice} is null or ${t.currentPrice} >= 0`),
  ],
);

export const investmentTxns = pgTable(
  "investment_txns",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid()
      .notNull()
      .references(() => investmentAssets.id, { onDelete: "cascade" }),
    type: investmentTxnTypeEnum().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    /** jumlah unit (beli/jual); null untuk dividen */
    units: numeric({ precision: 24, scale: 8, mode: "number" }),
    /** harga per unit (sen); null untuk dividen */
    price: bigint({ mode: "number" }),
    fee: bigint({ mode: "number" }).notNull().default(0),
    /** uang yang berpindah (sen): beli = units×price + fee; jual = units×price − fee; dividen = nominal */
    amount: bigint({ mode: "number" }).notNull(),
    /** transaksi dompet tertaut (opsional) */
    transactionId: uuid().references(() => transactions.id, { onDelete: "set null" }),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index("investment_txns_asset_idx").on(t.assetId, t.occurredAt),
    uniqueIndex("investment_txns_transaction_uq")
      .on(t.transactionId)
      .where(sql`${t.transactionId} is not null`),
    check("investment_txns_amount_nonneg", sql`${t.amount} >= 0`),
    check("investment_txns_fee_nonneg", sql`${t.fee} >= 0`),
    check(
      "investment_txns_shape",
      sql`(${t.type} = 'dividend' and ${t.units} is null and ${t.price} is null)
       or (${t.type} <> 'dividend' and ${t.units} > 0 and ${t.price} >= 0)`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type WalletType = (typeof walletTypeEnum.enumValues)[number];
export type CategoryKind = (typeof categoryKindEnum.enumValues)[number];
export type Transaction = typeof transactions.$inferSelect;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type InvestmentAsset = typeof investmentAssets.$inferSelect;
export type InvestmentTxn = typeof investmentTxns.$inferSelect;
export type AssetType = (typeof assetTypeEnum.enumValues)[number];
export type InvestmentTxnType = (typeof investmentTxnTypeEnum.enumValues)[number];
export type ImportBatch = typeof importBatches.$inferSelect;
