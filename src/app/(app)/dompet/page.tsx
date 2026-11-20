import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { WalletsView } from "@/features/wallets/components/wallets-view";
import { listWallets } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";
import { type Currency, formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dompet" };

export default async function WalletsPage() {
  const user = await requireUser();
  const wallets = await listWallets(user.id);

  // total per mata uang dari dompet aktif
  const totals = new Map<Currency, number>();
  for (const w of wallets) {
    if (w.archivedAt) continue;
    const c = w.currency as Currency;
    totals.set(c, (totals.get(c) ?? 0) + w.balance);
  }
  const activeCount = wallets.filter((w) => !w.archivedAt).length;

  const summary = activeCount > 0 && (
    <Card size="sm" className="bg-primary text-primary-foreground ring-0">
      <CardContent className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="text-sm opacity-80">Total saldo · {activeCount} dompet aktif</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {formatMoney(totals.get("IDR") ?? 0, "IDR")}
          </p>
        </div>
        {[...totals.entries()]
          .filter(([c]) => c !== "IDR")
          .map(([c, v]) => (
            <p key={c} className="text-lg font-medium tabular-nums opacity-90">
              {formatMoney(v, c)}
            </p>
          ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6">
      <WalletsView wallets={wallets} summary={summary} />
    </div>
  );
}
