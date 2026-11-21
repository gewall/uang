import type { Metadata } from "next";
import { listCategoryTree } from "@/features/categories/queries";
import { RecurringView } from "@/features/recurring/components/recurring-view";
import { postDueRecurring } from "@/features/recurring/posting";
import { listRecurring } from "@/features/recurring/queries";
import { listWalletOptions } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";
import { wibDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Transaksi berulang" };

export default async function RecurringPage() {
  const user = await requireUser();
  await postDueRecurring(user.id);
  const [items, categories, wallets] = await Promise.all([
    listRecurring(user.id),
    listCategoryTree(user.id),
    listWalletOptions(user.id),
  ]);
  return (
    <div className="grid gap-5">
      <RecurringView items={items} categories={categories} wallets={wallets} today={wibDateKey(new Date())} />
    </div>
  );
}
