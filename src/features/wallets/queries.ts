import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions, wallets } from "@/db/schema";
import { walletBalanceSql } from "./balance";

export type WalletWithBalance = typeof wallets.$inferSelect & { balance: number; txCount: number };

/** Semua dompet user + saldo terhitung (initial_balance + Σ transaksi) + jumlah transaksi. */
export async function listWallets(userId: string): Promise<WalletWithBalance[]> {
  const rows = await db
    .select({
      wallet: wallets,
      balance: walletBalanceSql(),
      txCount: sql<number>`(
        select count(*) from ${transactions} t
        where t.wallet_id = ${wallets.id} or t.to_wallet_id = ${wallets.id}
      )`.mapWith(Number),
    })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(asc(wallets.sortOrder), asc(wallets.createdAt));
  return rows.map((r) => ({ ...r.wallet, balance: r.balance, txCount: r.txCount }));
}

/** Versi ringkas untuk pilihan di form (tanpa saldo). */
export async function listWalletOptions(userId: string) {
  return db
    .select({
      id: wallets.id,
      name: wallets.name,
      icon: wallets.icon,
      color: wallets.color,
      currency: wallets.currency,
      archivedAt: wallets.archivedAt,
    })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(asc(wallets.sortOrder), asc(wallets.createdAt));
}

export type WalletOption = Awaited<ReturnType<typeof listWalletOptions>>[number];
