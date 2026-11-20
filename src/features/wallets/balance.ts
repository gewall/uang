import "server-only";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { transactions, wallets } from "@/db/schema";

/**
 * Perubahan saldo sebuah dompet dari semua transaksinya (sen), opsional sampai waktu tertentu:
 *   + income ke dompet ini
 *   − expense dari dompet ini
 *   − transfer keluar (amount + fee)
 *   + transfer masuk (to_amount, atau amount bila sama mata uang)
 */
export function walletDeltaSql(walletId: AnyPgColumn, until?: Date): SQL<number> {
  const upTo = until ? sql`and t.occurred_at < ${until}` : sql``;
  return sql<number>`(
    coalesce((
      select sum(case
        when t.type = 'income' then t.amount
        when t.type = 'expense' then -t.amount
        else -(t.amount + t.fee)
      end)
      from ${transactions} t
      where t.wallet_id = ${walletId} ${upTo}
    ), 0)
    + coalesce((
      select sum(coalesce(t.to_amount, t.amount))
      from ${transactions} t
      where t.to_wallet_id = ${walletId} and t.type = 'transfer' ${upTo}
    ), 0)
  )`;
}

/** Saldo dompet = initial_balance + delta transaksi. */
export function walletBalanceSql(until?: Date): SQL<number> {
  return sql<number>`(${wallets.initialBalance} + ${walletDeltaSql(wallets.id, until)})`.mapWith(Number);
}
