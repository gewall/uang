import type { Metadata } from "next";
import { NewTransactionButton } from "@/features/transactions/components/new-transaction-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listCategoryTree } from "@/features/categories/queries";
import { TransactionFilterBar } from "@/features/transactions/components/transaction-filters";
import { TransactionsView } from "@/features/transactions/components/transactions-view";
import { activeFilterCount, filtersToSearch, PAGE_SIZE, parseFilters } from "@/features/transactions/filters";
import { listTags, listTransactions } from "@/features/transactions/queries";
import { postDueRecurring } from "@/features/recurring/posting";
import { listWalletOptions } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";
import { formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Transaksi" };

export default async function TransactionsPage({ searchParams }: PageProps<"/transaksi">) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseFilters(params);
  await postDueRecurring(user.id); // jadwal berulang yang jatuh tempo dicatat dulu

  const [{ items, hasMore, summary }, categories, wallets, tags] = await Promise.all([
    listTransactions(user.id, filters),
    listCategoryTree(user.id),
    listWalletOptions(user.id),
    listTags(user.id),
  ]);
  const net = summary.income - summary.expense;
  const filtered = Boolean(filters.q) || activeFilterCount(filters) > 0;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Transaksi"
        description="Pemasukan, pengeluaran, dan transfer antar dompet."
        actions={<NewTransactionButton />}
      />

      <TransactionFilterBar filters={filters} categories={categories} wallets={wallets} tags={tags} />

      <Card size="sm">
        <CardContent className="grid grid-cols-3 divide-x text-center">
          {[
            { label: "Pemasukan", value: summary.income, cls: "text-income" },
            { label: "Pengeluaran", value: summary.expense, cls: "text-expense" },
            { label: "Selisih", value: net, cls: net < 0 ? "text-expense" : "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="min-w-0 px-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("truncate text-sm font-semibold tabular-nums sm:text-lg", s.cls)}>
                <span className="sm:hidden">
                  {formatMoney(s.value, "IDR", { compact: true, signed: s.label === "Selisih" })}
                </span>
                <span className="hidden sm:inline">
                  {formatMoney(s.value, "IDR", { signed: s.label === "Selisih" })}
                </span>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        {formatMonth(filters.month)} · {summary.count} transaksi{filtered ? " (terfilter)" : ""}
      </p>

      <TransactionsView
        items={items}
        hasMore={hasMore}
        moreHref={`/transaksi${filtersToSearch({ ...filters, limit: filters.limit + PAGE_SIZE })}`}
        categories={categories}
        wallets={wallets}
        openNew={params.baru === "1"}
        filtered={filtered}
      />
    </div>
  );
}
