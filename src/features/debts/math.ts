import type { DebtDirection } from "@/db/schema";
import { daysBetween } from "../recurring/schedule";

export type DebtStatus = "settled" | "overdue" | "due-soon" | "open";

export const DEBT_DIRECTION: Record<DebtDirection, { label: string; short: string; personLabel: string }> = {
  payable: { label: "Hutang", short: "Aku berutang", personLabel: "Berutang ke" },
  receivable: { label: "Piutang", short: "Orang berutang padaku", personLabel: "Dipinjam oleh" },
};

/** Ringkasan satu hutang/piutang dari total pembayaran. */
export function debtSummary(
  d: { amount: number; dueDate: string | null; settledAt: Date | null },
  paid: number,
  today: string,
) {
  const remaining = Math.max(0, d.amount - paid);
  const settled = Boolean(d.settledAt) || remaining === 0;
  const daysLeft = d.dueDate ? daysBetween(today, d.dueDate) : null;
  let status: DebtStatus = "open";
  if (settled) status = "settled";
  else if (daysLeft !== null && daysLeft < 0) status = "overdue";
  else if (daysLeft !== null && daysLeft <= 7) status = "due-soon";
  return {
    paid,
    remaining: settled ? 0 : remaining,
    ratio: d.amount > 0 ? Math.min(1, paid / d.amount) : 0,
    status,
    daysLeft,
  };
}
