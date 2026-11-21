import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { wibDateKey } from "@/lib/dates";
import { listWallets } from "../wallets/queries";
import { goalProgress } from "./math";

/** Target + progres. Target yang tertaut dompet memakai saldo dompet itu (IDR). */
export async function listGoals(userId: string, now = new Date()) {
  const [rows, ws] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.targetDate), asc(goals.createdAt)),
    listWallets(userId),
  ]);
  const wallet = new Map(ws.map((w) => [w.id, w]));
  const today = wibDateKey(now);
  return rows.map((g) => {
    const w = g.walletId ? wallet.get(g.walletId) : undefined;
    const saved = w ? w.balance : g.savedAmount;
    return {
      ...g,
      walletName: w?.name ?? null,
      progress: goalProgress({ saved, target: g.targetAmount, targetDate: g.targetDate }, today),
    };
  });
}

export type GoalItem = Awaited<ReturnType<typeof listGoals>>[number];
