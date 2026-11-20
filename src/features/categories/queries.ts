import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { type Category, categories } from "@/db/schema";

export type CategoryNode = Category & { children: Category[] };

/** Kategori user sebagai pohon 1 level: induk (urut sortOrder) beserta subkategorinya. */
export async function listCategoryTree(userId: string): Promise<CategoryNode[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const byId = new Map<string, CategoryNode>();
  for (const r of rows) if (!r.parentId) byId.set(r.id, { ...r, children: [] });
  const roots = [...byId.values()];
  for (const r of rows) {
    if (!r.parentId) continue;
    const parent = byId.get(r.parentId);
    // induk sudah tidak ada / ternyata subkategori → tampilkan sebagai kategori utama
    if (parent) parent.children.push(r);
    else roots.push({ ...r, children: [] });
  }
  return roots;
}
