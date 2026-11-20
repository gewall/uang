import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { AllocationBar } from "@/features/investments/components/allocation-bar";
import { InvestmentsView } from "@/features/investments/components/investments-view";
import { PnL } from "@/features/investments/components/pnl";
import { listPortfolio } from "@/features/investments/queries";
import { listWalletOptions } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Investasi" };

export default async function InvestmentsPage() {
  const user = await requireUser();
  const [{ items, summary, allocation }, wallets] = await Promise.all([
    listPortfolio(user.id),
    listWalletOptions(user.id),
  ]);
  const hasValue = summary.marketValue > 0 || summary.realized !== 0 || summary.dividends > 0;
  const ratio = summary.costBasis > 0 ? summary.unrealized / summary.costBasis : null;

  const summaryCard = hasValue && (
    <Card size="sm">
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-sm text-muted-foreground">Nilai portofolio</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {formatMoney(summary.marketValue)}
            </p>
            <PnL value={summary.unrealized} ratio={ratio} className="text-sm" />
            <span className="ml-1 text-xs text-muted-foreground">belum terealisasi</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <div>
              <p className="text-xs text-muted-foreground">Modal</p>
              <p className="font-semibold tabular-nums sm:text-lg">{formatMoney(summary.costBasis)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Untung terealisasi + dividen</p>
              <PnL value={summary.realized + summary.dividends} className="font-semibold sm:text-lg" />
            </div>
          </div>
        </div>
        <AllocationBar parts={allocation} />
        {summary.unpriced > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleAlert className="size-3.5 shrink-0 text-warning" />
            {summary.unpriced} aset belum punya harga terkini — nilainya dihitung dari modal.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-5">
      <InvestmentsView items={items} wallets={wallets} summary={summaryCard} />
    </div>
  );
}
