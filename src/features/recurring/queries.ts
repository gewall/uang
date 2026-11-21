import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, recurringRules, wallets } from "@/db/schema";

const toWallet = alias(wallets, "to_wallet");

export async function listRecurring(userId: string) {
  return db
    .select({
      rule: recurringRules,
      wallet: { name: wallets.name, currency: wallets.currency },
      toWalletName: toWallet.name,
      category: { name: categories.name, icon: categories.icon, color: categories.color },
    })
    .from(recurringRules)
    .innerJoin(wallets, eq(wallets.id, recurringRules.walletId))
    .leftJoin(toWallet, eq(toWallet.id, recurringRules.toWalletId))
    .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
    .where(eq(recurringRules.userId, userId))
    .orderBy(desc(recurringRules.active), asc(recurringRules.nextDate));
}

export type RecurringItem = Awaited<ReturnType<typeof listRecurring>>[number];
