"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { budgets, categories } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { isMonth, shiftMonth } from "@/lib/dates";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { parseMoneyInput } from "@/lib/money";
import { getRequestMeta } from "@/lib/request";
import { monthDate } from "./queries";

const revalidate = () => ["/budget", "/dashboard"].forEach((p) => revalidatePath(p));

const budgetSchema = z.object({
  month: z.string().refine(isMonth, "Bulan tidak valid"),
  categoryId: z.uuid({ error: "Pilih kategori" }),
  amount: z.string().transform((v, ctx) => {
    const minor = parseMoneyInput(v);
    if (minor === null || minor <= 0) {
      ctx.addIssue({
        code: "custom",
        message: minor === null ? "Format nominal tidak dikenali" : "Harus lebih dari 0",
      });
      return z.NEVER;
    }
    return minor;
  }),
});

/** Buat atau ubah budget satu kategori di satu bulan (upsert). */
export async function saveBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { month, categoryId, amount } = parsed.data;

  const [cat] = await db
    .select({ name: categories.name, kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)));
  if (!cat || cat.kind !== "expense") return { fieldErrors: { categoryId: ["Pilih kategori pengeluaran"] } };

  const [row] = await db
    .insert(budgets)
    .values({ userId: user.id, categoryId, month: monthDate(month), amount })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: { amount, updatedAt: new Date() },
    })
    .returning({ id: budgets.id });

  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "update",
    entity: "budget",
    entityId: row.id,
    diff: { month, categoryId, amount },
    ip,
  });
  revalidate();
  return { ok: true, message: `Budget "${cat.name}" disimpan.` };
}

export async function deleteBudget(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
    .returning({ month: budgets.month, amount: budgets.amount, categoryId: budgets.categoryId });
  if (!row) return { message: "Budget tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "budget", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: "Budget dihapus." };
}

/** Salin budget bulan sebelumnya ke `month` (kategori yang sudah punya budget dilewati). */
export async function copyPreviousBudgets(month: string): Promise<FormState> {
  const user = await requireUser();
  if (!isMonth(month)) return { message: "Bulan tidak valid." };
  const prev = monthDate(shiftMonth(month, -1));
  const inserted = await db.execute<{ id: string }>(sql`
    insert into ${budgets} (user_id, category_id, month, amount)
    select b.user_id, b.category_id, ${monthDate(month)}::date, b.amount
    from ${budgets} b
    join ${categories} c on c.id = b.category_id and c.archived_at is null
    where b.user_id = ${user.id} and b.month = ${prev}::date
    on conflict (user_id, category_id, month) do nothing
    returning id`);
  const n = inserted.length;
  const { ip } = await getRequestMeta();
  if (n > 0)
    await logActivity({
      userId: user.id,
      action: "create",
      entity: "budget",
      diff: { copiedFrom: prev, month, count: n },
      ip,
    });
  revalidate();
  return n > 0
    ? { ok: true, message: `${n} budget disalin dari bulan lalu.` }
    : { ok: true, message: "Tidak ada budget baru untuk disalin." };
}
