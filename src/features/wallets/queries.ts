import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "@/db/schema";

export type WalletWithBalance = typeof wallets.$inferSelect & { balance: number };

/**
 * Semua dompet user + saldo terhitung.
 * Saldo = initial_balance + Σ transaksi (tabel transaksi ditambahkan di Fase 4; sementara = saldo awal).
 */
export async function listWallets(userId: string): Promise<WalletWithBalance[]> {
  const rows = await db
    .select({
      wallet: wallets,
      balance: sql<number>`${wallets.initialBalance}`.mapWith(Number),
    })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(asc(wallets.sortOrder), asc(wallets.createdAt));
  return rows.map((r) => ({ ...r.wallet, balance: r.balance }));
}
