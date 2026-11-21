import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { debtPayments, debts } from "@/db/schema";
import { wibDateKey } from "@/lib/dates";
import { debtSummary } from "./math";

export async function listDebts(userId: string, now = new Date()) {
  const [rows, pays] = await Promise.all([
    db.select().from(debts).where(eq(debts.userId, userId)).orderBy(asc(debts.dueDate), desc(debts.createdAt)),
    db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.userId, userId))
      .orderBy(desc(debtPayments.paidDate), desc(debtPayments.createdAt)),
  ]);
  const today = wibDateKey(now);
  const byDebt = new Map<string, (typeof pays)[number][]>();
  for (const p of pays) byDebt.set(p.debtId, [...(byDebt.get(p.debtId) ?? []), p]);
  const items = rows.map((d) => {
    const payments = byDebt.get(d.id) ?? [];
    const paid = payments.reduce((n, p) => n + p.amount, 0);
    return { ...d, payments, ...debtSummary(d, paid, today) };
  });
  const open = items.filter((i) => i.status !== "settled");
  return {
    items,
    totals: {
      payable: open.filter((i) => i.direction === "payable").reduce((n, i) => n + i.remaining, 0),
      receivable: open.filter((i) => i.direction === "receivable").reduce((n, i) => n + i.remaining, 0),
      overdue: open.filter((i) => i.status === "overdue").length,
    },
  };
}

export type DebtItem = Awaited<ReturnType<typeof listDebts>>["items"][number];
