// Kategori bawaan untuk user baru. Dipakai oleh script seed-user & tombol "Tambahkan kategori default".
// Tanpa "server-only" supaya bisa diimpor dari scripts/.
import { and, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { categories, type CategoryKind } from "@/db/schema";
import type { ColorKey, IconKey } from "@/lib/appearance-options";

type DefaultCategory = {
  name: string;
  icon: IconKey;
  color: ColorKey;
  isSystem?: boolean;
  children?: Omit<DefaultCategory, "children">[];
};

export const DEFAULT_CATEGORIES: Record<CategoryKind, DefaultCategory[]> = {
  expense: [
    { name: "Makan & Minum", icon: "utensils", color: "amber", children: [
      { name: "Jajan & Kopi", icon: "coffee", color: "amber" },
    ] },
    { name: "Belanja", icon: "shopping-bag", color: "rose", children: [
      { name: "Kebutuhan Rumah", icon: "shopping-cart", color: "rose" },
      { name: "Pakaian", icon: "shirt", color: "rose" },
    ] },
    { name: "Transportasi", icon: "bus", color: "sky", children: [
      { name: "Bensin", icon: "fuel", color: "sky" },
    ] },
    { name: "Tagihan", icon: "receipt", color: "slate", children: [
      { name: "Listrik", icon: "zap", color: "slate" },
      { name: "Internet & Pulsa", icon: "wifi", color: "slate" },
    ] },
    { name: "Langganan", icon: "repeat", color: "indigo" },
    { name: "Rumah", icon: "house", color: "stone" },
    { name: "Kesehatan", icon: "heart-pulse", color: "emerald" },
    { name: "Pendidikan", icon: "graduation-cap", color: "blue" },
    { name: "Hiburan", icon: "gamepad", color: "violet" },
    { name: "Keluarga", icon: "users", color: "terracotta" },
    { name: "Hadiah & Donasi", icon: "gift", color: "rose" },
    { name: "Biaya Admin", icon: "landmark", color: "slate", isSystem: true },
    { name: "Pajak", icon: "badge-percent", color: "stone", isSystem: true },
    { name: "Investasi", icon: "trending-up", color: "teal", isSystem: true },
    { name: "Lainnya", icon: "tag", color: "slate" },
  ],
  income: [
    { name: "Gaji", icon: "briefcase", color: "emerald" },
    { name: "Bonus", icon: "sparkles", color: "amber" },
    { name: "Usaha & Freelance", icon: "laptop", color: "blue" },
    { name: "Pemberian", icon: "hand-heart", color: "rose" },
    { name: "Penjualan", icon: "store", color: "terracotta" },
    { name: "Bunga", icon: "percent", color: "teal", isSystem: true },
    { name: "Hasil Investasi", icon: "trending-up", color: "teal", isSystem: true },
    { name: "Lainnya", icon: "tag", color: "slate" },
  ],
};

// Terima instance drizzle apa pun (app atau script) — tanpa bergantung pada schema generic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

/**
 * Tambahkan kategori default yang belum ada (idempotent; nama yang sudah ada dilewati).
 * Mengembalikan jumlah kategori yang baru dibuat.
 */
export async function ensureDefaultCategories(db: AnyDb, userId: string): Promise<number> {
  let created = 0;
  for (const kind of ["expense", "income"] as const) {
    for (const [i, parent] of DEFAULT_CATEGORIES[kind].entries()) {
      const { children, ...p } = parent;
      const inserted = await db
        .insert(categories)
        .values({ userId, kind, sortOrder: i, ...p })
        .onConflictDoNothing()
        .returning({ id: categories.id });
      created += inserted.length;

      let parentId = inserted[0]?.id;
      if (!parentId) {
        const [existing] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.userId, userId), eq(categories.kind, kind), eq(categories.name, p.name), isNull(categories.parentId)));
        parentId = existing?.id;
      }
      if (!parentId || !children?.length) continue;

      const kids = await db
        .insert(categories)
        .values(children.map((c, j) => ({ userId, kind, parentId, sortOrder: j, ...c })))
        .onConflictDoNothing()
        .returning({ id: categories.id });
      created += kids.length;
    }
  }
  return created;
}
