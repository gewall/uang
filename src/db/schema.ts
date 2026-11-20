// Skema database. Tabel ditambahkan per fase (lihat CLAUDE.md).
// Konvensi: id uuid, user_id, created_at, updated_at; uang = bigint (rupiah, tanpa float).
// Nama kolom ditulis camelCase di TS, jadi snake_case di DB (casing: "snake_case").
import { sql } from "drizzle-orm";
import { index, inet, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
