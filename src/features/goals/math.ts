import { daysBetween } from "../recurring/schedule";

const ROUND = 100_000; // Rp1.000 dalam sen

export type GoalProgress = {
  saved: number;
  ratio: number;
  remaining: number;
  done: boolean;
  /** sisa bulan sampai target (min. 1), null bila tanpa tanggal target */
  monthsLeft: number | null;
  /** setoran yang perlu per bulan (dibulatkan ke atas ke Rp1.000), null bila tanpa tanggal / sudah tercapai */
  perMonth: number | null;
  overdue: boolean;
};

/** Progres target tabungan; `today` = "YYYY-MM-DD" (WIB). */
export function goalProgress(
  g: { saved: number; target: number; targetDate: string | null },
  today: string,
): GoalProgress {
  const saved = Math.max(0, g.saved);
  const remaining = Math.max(0, g.target - saved);
  const done = remaining === 0;
  const ratio = g.target > 0 ? saved / g.target : 0;
  if (!g.targetDate) return { saved, ratio, remaining, done, monthsLeft: null, perMonth: null, overdue: false };

  const overdue = !done && daysBetween(today, g.targetDate) < 0;
  const [ty, tm] = g.targetDate.split("-").map(Number);
  const [cy, cm] = today.split("-").map(Number);
  const monthsLeft = Math.max(1, ty * 12 + tm - (cy * 12 + cm));
  const perMonth = done ? null : Math.ceil(remaining / (overdue ? 1 : monthsLeft) / ROUND) * ROUND;
  return { saved, ratio, remaining, done, monthsLeft: overdue ? 0 : monthsLeft, perMonth, overdue };
}
