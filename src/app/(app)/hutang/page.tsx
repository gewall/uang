import type { Metadata } from "next";
import { DebtsView } from "@/features/debts/components/debts-view";
import { listDebts } from "@/features/debts/queries";
import { requireUser } from "@/lib/auth/dal";
import { wibDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Hutang & piutang" };

export default async function DebtsPage() {
  const user = await requireUser();
  const { items, totals } = await listDebts(user.id);
  return (
    <div className="grid gap-5">
      <DebtsView items={items} totals={totals} today={wibDateKey(new Date())} />
    </div>
  );
}
