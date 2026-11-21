"use server";

import { and, eq, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { debtDirectionEnum, debtPayments, debts } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { wibDateKey } from "@/lib/dates";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { parseMoneyInput } from "@/lib/money";
import { getRequestMeta } from "@/lib/request";
import { isDateKey } from "../recurring/schedule";

const revalidate = () => ["/hutang", "/dashboard"].forEach((p) => revalidatePath(p));

const amount = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const minor = v ? parseMoneyInput(v) : null;
    if (minor === null || minor <= 0) {
      ctx.addIssue({ code: "custom", message: "Nominal harus lebih dari 0" });
      return z.NEVER;
    }
    return minor;
  });
const note = z
  .string()
  .trim()
  .max(200, "Maksimal 200 karakter")
  .optional()
  .transform((v) => v || null);

const debtSchema = z
  .object({
    id: z.uuid().optional(),
    direction: z.enum(debtDirectionEnum.enumValues),
    person: z.string().trim().min(1, "Nama wajib diisi").max(60, "Maksimal 60 karakter"),
    amount,
    startDate: z.string().refine(isDateKey, "Tanggal tidak valid"),
    dueDate: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || isDateKey(v), "Tanggal tidak valid"),
    note,
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.startDate, {
    path: ["dueDate"],
    message: "Harus setelah tanggal pinjam",
  });

async function paidOf(debtId: string) {
  const [r] = await db
    .select({ total: sum(debtPayments.amount) })
    .from(debtPayments)
    .where(eq(debtPayments.debtId, debtId));
  return Number(r?.total ?? 0);
}

/** Tandai lunas otomatis bila total bayar ≥ nominal (dan sebaliknya bila nominal dinaikkan). */
async function syncSettled(debtId: string, debtAmount: number) {
  const paid = await paidOf(debtId);
  await db
    .update(debts)
    .set({ settledAt: paid >= debtAmount ? new Date() : null })
    .where(eq(debts.id, debtId));
  return paid >= debtAmount;
}

export async function saveDebt(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = debtSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;
  const { ip } = await getRequestMeta();
  const label = data.direction === "payable" ? "Hutang" : "Piutang";

  if (id) {
    const [before] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, user.id)));
    if (!before) return { message: "Data tidak ditemukan." };
    await db.update(debts).set(data).where(eq(debts.id, id));
    await syncSettled(id, data.amount);
    const diff = changedFields(before, data);
    if (diff) await logActivity({ userId: user.id, action: "update", entity: "debt", entityId: id, diff, ip });
    revalidate();
    return { ok: true, message: `${label} ${data.person} diperbarui.` };
  }
  const [created] = await db
    .insert(debts)
    .values({ ...data, userId: user.id })
    .returning({ id: debts.id });
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "debt",
    entityId: created.id,
    diff: { name: data.person, ...data },
    ip,
  });
  revalidate();
  return { ok: true, message: `${label} ${data.person} dicatat.` };
}

const paymentSchema = z.object({
  debtId: z.uuid(),
  amount,
  paidDate: z.string().refine(isDateKey, "Tanggal tidak valid"),
  note,
});

export async function addDebtPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const p = parsed.data;
  const [d] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, p.debtId), eq(debts.userId, user.id)));
  if (!d) return { message: "Data tidak ditemukan." };
  const remaining = d.amount - (await paidOf(d.id));
  if (p.amount > remaining) return { fieldErrors: { amount: ["Melebihi sisa yang belum dibayar"] } };
  await db.insert(debtPayments).values({ ...p, userId: user.id });
  const settled = await syncSettled(d.id, d.amount);
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "debt_payment",
    entityId: d.id,
    diff: { name: d.person, amount: p.amount, settled },
    ip,
  });
  revalidate();
  return { ok: true, message: settled ? `Lunas! ${d.person} sudah selesai.` : "Pembayaran dicatat." };
}

export async function deleteDebtPayment(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(debtPayments)
    .where(and(eq(debtPayments.id, id), eq(debtPayments.userId, user.id)))
    .returning({ debtId: debtPayments.debtId, amount: debtPayments.amount });
  if (!row) return { message: "Pembayaran tidak ditemukan." };
  const [d] = await db.select().from(debts).where(eq(debts.id, row.debtId));
  if (d) await syncSettled(d.id, d.amount);
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "delete",
    entity: "debt_payment",
    entityId: row.debtId,
    diff: { name: d?.person, amount: row.amount },
    ip,
  });
  revalidate();
  return { ok: true, message: "Pembayaran dihapus." };
}

/** Lunasi sekaligus: catat pembayaran sebesar sisa. */
export async function settleDebt(id: string): Promise<FormState> {
  const user = await requireUser();
  const [d] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, user.id)));
  if (!d) return { message: "Data tidak ditemukan." };
  const remaining = d.amount - (await paidOf(d.id));
  if (remaining > 0) {
    await db.insert(debtPayments).values({
      userId: user.id,
      debtId: d.id,
      amount: remaining,
      paidDate: wibDateKey(new Date()),
      note: "Pelunasan",
    });
  }
  await syncSettled(d.id, d.amount);
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "debt_payment",
    entityId: d.id,
    diff: { name: d.person, amount: remaining, settled: true },
    ip,
  });
  revalidate();
  return { ok: true, message: `${d.person} ditandai lunas.` };
}

export async function deleteDebt(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .delete(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, user.id)))
    .returning({ name: debts.person, amount: debts.amount, direction: debts.direction });
  if (!row) return { message: "Data tidak ditemukan." };
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "delete", entity: "debt", entityId: id, diff: { ...row }, ip });
  revalidate();
  return { ok: true, message: `Catatan ${row.name} dihapus.` };
}
