import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ensureDefaultCategories, type SystemCategoryKey } from "./defaults";

/** ID kategori sistem milik user (dibuat dari default bila belum ada). */
export async function getSystemCategoryId(userId: string, key: SystemCategoryKey): Promise<string> {
  const find = () =>
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.systemKey, key)));
  let [row] = await find();
  if (!row) {
    await ensureDefaultCategories(db, userId);
    [row] = await find();
  }
  if (!row) throw new Error(`Kategori sistem "${key}" tidak ditemukan`);
  return row.id;
}
