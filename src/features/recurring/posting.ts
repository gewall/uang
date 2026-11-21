import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { recurringRules, transactions } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { wibDateKey } from "@/lib/dates";
import { dueDates } from "./schedule";

/** Jam pencatatan transaksi berulang (WIB). */
const POST_TIME = "T08:00:00+07:00";

/**
 * Buat transaksi untuk semua jadwal berulang yang sudah jatuh tempo. Dipanggil saat halaman dibuka
 * (dashboard, transaksi, berulang) — tanpa cron. Aman dipanggil bersamaan: externalId `rec:<rule>:<tanggal>`
 * unik per user, jadi jadwal yang sama tidak pernah tercatat dua kali.
 */
export async function postDueRecurring(userId: string, now = new Date()): Promise<number> {
  const today = wibDateKey(now);
  const rules = await db
    .select()
    .from(recurringRules)
    .where(
      and(eq(recurringRules.userId, userId), eq(recurringRules.active, true), lte(recurringRules.nextDate, today)),
    );
  if (rules.length === 0) return 0;

  let created = 0;
  for (const r of rules) {
    const { dates, next } = dueDates(r, today);
    const finished = Boolean(r.endDate && next > r.endDate);
    await db.transaction(async (tx) => {
      if (dates.length > 0) {
        const inserted = await tx
          .insert(transactions)
          .values(
            dates.map((d) => ({
              userId,
              type: r.type,
              walletId: r.walletId,
              toWalletId: r.type === "transfer" ? r.toWalletId : null,
              categoryId: r.type === "transfer" ? null : r.categoryId,
              amount: r.amount,
              occurredAt: new Date(`${d}${POST_TIME}`),
              note: r.note ? `${r.name} · ${r.note}` : r.name,
              source: "recurring" as const,
              externalId: `rec:${r.id}:${d}`,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: transactions.id });
        created += inserted.length;
      }
      // hanya maju kalau belum dimajukan request lain
      await tx
        .update(recurringRules)
        .set({ nextDate: next, ...(finished ? { active: false } : {}) })
        .where(and(eq(recurringRules.id, r.id), eq(recurringRules.nextDate, r.nextDate)));
    });
  }
  if (created > 0) {
    await logActivity({ userId, action: "create", entity: "recurring_post", diff: { count: created } });
  }
  return created;
}
