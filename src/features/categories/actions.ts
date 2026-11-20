"use server";

import { and, count, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { type FormState, fieldErrorsOf, isForeignKeyViolation, isUniqueViolation } from "@/lib/form";
import { getRequestMeta } from "@/lib/request";
import { ensureDefaultCategories } from "./defaults";
import { categoryFormSchema } from "./schema";

const revalidate = () => revalidatePath("/kategori");

async function ownCategory(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return row;
}

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = categoryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;

  // validasi induk: milik user, jenis sama, bukan subkategori, bukan dirinya sendiri
  if (data.parentId) {
    const parent = await ownCategory(user.id, data.parentId);
    if (!parent || parent.kind !== data.kind || parent.parentId || parent.id === id) {
      return { fieldErrors: { parentId: ["Induk tidak valid"] } };
    }
    if (id) {
      const [{ n }] = await db.select({ n: count() }).from(categories).where(eq(categories.parentId, id));
      if (n > 0) return { fieldErrors: { parentId: ["Kategori ini punya subkategori, jadi tidak bisa dijadikan subkategori"] } };
    }
  }

  const { ip } = await getRequestMeta();
  try {
    if (id) {
      const before = await ownCategory(user.id, id);
      if (!before) return { message: "Kategori tidak ditemukan." };
      // jenis kategori tidak bisa diubah setelah dibuat (transaksi bergantung padanya)
      const update = { name: data.name, parentId: data.parentId, icon: data.icon, color: data.color };
      await db.update(categories).set(update).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
      const diff = changedFields(before, update);
      if (diff) await logActivity({ userId: user.id, action: "update", entity: "category", entityId: id, diff, ip });
      revalidate();
      return { ok: true, message: `Kategori "${data.name}" diperbarui.` };
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: max(categories.sortOrder) })
      .from(categories)
      .where(and(eq(categories.userId, user.id), eq(categories.kind, data.kind)));
    const [created] = await db
      .insert(categories)
      .values({ ...data, userId: user.id, sortOrder: (maxOrder ?? -1) + 1 })
      .returning({ id: categories.id });
    await logActivity({ userId: user.id, action: "create", entity: "category", entityId: created.id, diff: { ...data }, ip });
    revalidate();
    return { ok: true, message: `Kategori "${data.name}" ditambahkan.` };
  } catch (err) {
    if (isUniqueViolation(err, "categories_user_kind_name_uq")) {
      return { fieldErrors: { name: ["Nama ini sudah dipakai kategori lain"] } };
    }
    throw err;
  }
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<FormState> {
  const user = await requireUser();
  const cat = await ownCategory(user.id, id);
  if (!cat) return { message: "Kategori tidak ditemukan." };
  if (cat.isSystem) return { message: "Kategori bawaan sistem tidak bisa diarsipkan." };
  await db
    .update(categories)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "category", entityId: id, diff: { archived }, ip });
  revalidate();
  return { ok: true, message: archived ? `"${cat.name}" diarsipkan.` : `"${cat.name}" diaktifkan lagi.` };
}

export async function deleteCategory(id: string): Promise<FormState> {
  const user = await requireUser();
  const cat = await ownCategory(user.id, id);
  if (!cat) return { message: "Kategori tidak ditemukan." };
  if (cat.isSystem) return { message: "Kategori bawaan sistem tidak bisa dihapus." };
  try {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  } catch (err) {
    // Fase 4: transaksi mereferensikan kategori (FK restrict)
    if (isForeignKeyViolation(err)) return { message: `"${cat.name}" masih dipakai transaksi. Arsipkan saja.` };
    throw err;
  }
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "delete",
    entity: "category",
    entityId: id,
    diff: { name: cat.name, kind: cat.kind },
    ip,
  });
  revalidate();
  return { ok: true, message: `"${cat.name}" dihapus.` };
}

export async function addDefaultCategories(): Promise<FormState> {
  const user = await requireUser();
  const n = await ensureDefaultCategories(db, user.id);
  const { ip } = await getRequestMeta();
  if (n > 0) {
    await logActivity({ userId: user.id, action: "create", entity: "category", diff: { defaults: n }, ip });
  }
  revalidate();
  return { ok: true, message: n > 0 ? `${n} kategori default ditambahkan.` : "Semua kategori default sudah ada." };
}
