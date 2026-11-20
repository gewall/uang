"use client";

import { Copy, MoreVertical, Pencil, PiggyBank, Plus, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { BudgetMeter } from "@/components/budget-meter";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
import type { CategoryOption } from "@/components/entity-select";
import { PageHeader } from "@/components/page-header";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormState } from "@/lib/form";
import { formatMoney } from "@/lib/money";
import { copyPreviousBudgets, deleteBudget } from "../actions";
import type { BudgetLineView, BudgetOverview } from "../queries";
import { type BudgetDraft, BudgetForm } from "./budget-form";

export function BudgetsView({
  month,
  overview,
  categories,
  summary,
}: {
  month: string;
  overview: BudgetOverview;
  categories: CategoryOption[];
  summary: React.ReactNode;
}) {
  const [draft, setDraft] = useState<BudgetDraft | null>(null);
  const [toDelete, setToDelete] = useState<BudgetLineView | null>(null);
  const [pending, startTransition] = useTransition();

  const averages = Object.fromEntries(overview.expenseCategories.map((c) => [c.id, c.average]));
  const budgetedIds = overview.lines.map((l) => l.categoryId);
  const hasBudgets = overview.lines.length > 0;

  const closeDialog = useCallback((message?: string) => {
    setDraft(null);
    if (message) toast.success(message);
  }, []);

  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message ?? "Gagal memproses.");
      after?.();
    });

  const copyButton = overview.previousMonthHasBudgets && (
    <Button variant="outline" disabled={pending} onClick={() => run(() => copyPreviousBudgets(month))}>
      <Copy /> Salin dari bulan lalu
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Budget"
        description="Batas pengeluaran per kategori setiap bulan."
        actions={
          <>
            {hasBudgets && copyButton}
            <Button onClick={() => setDraft({})}>
              <Plus /> Tambah budget
            </Button>
          </>
        }
      />

      {summary}

      {!hasBudgets ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <PiggyBank className="size-6" />
            </span>
            <p className="font-medium">Belum ada budget di bulan ini</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tentukan batas pengeluaran per kategori supaya tahu kapan harus mengerem.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {copyButton}
              <Button onClick={() => setDraft({})}>
                <Plus /> Tambah budget
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {overview.lines.map((l) => (
            <Card key={l.id} size="sm">
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <EntityIcon icon={l.icon} color={l.color} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                    onClick={() => setDraft({ categoryId: l.categoryId, amount: l.amount, locked: true })}
                  >
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {l.name}
                      {l.nested && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          bagian dari {l.parentName}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      <span className="font-medium text-foreground">{formatMoney(l.spent)}</span> dari{" "}
                      {formatMoney(l.amount)}
                    </p>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk budget ${l.name}`} />}
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        render={<Link href={`/transaksi?kategori=${l.categoryId}&bulan=${month}&tipe=expense`} />}
                      >
                        <ReceiptText /> Lihat transaksi
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDraft({ categoryId: l.categoryId, amount: l.amount, locked: true })}
                      >
                        <Pencil /> Ubah batas
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setToDelete(l)}>
                        <Trash2 /> Hapus budget
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <BudgetMeter ratio={l.ratio} status={l.status} remaining={l.remaining} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {overview.unbudgeted.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Pengeluaran tanpa budget</CardTitle>
            <CardDescription className="tabular-nums">
              {formatMoney(overview.unbudgetedSpent)} di bulan ini belum masuk budget mana pun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overview.unbudgeted.slice(0, 6).map((u) => (
                <li key={u.categoryId} className="flex items-center gap-3 py-2">
                  <EntityIcon icon={u.icon} color={u.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                  <span className="text-sm tabular-nums">{formatMoney(u.spent)}</span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        categoryId: u.categoryId,
                        // saran: maksimal antara pengeluaran bulan ini & rata-rata, dibulatkan ke ribuan
                        amount: Math.ceil(Math.max(u.spent, u.average) / 100_000) * 100_000,
                      })
                    }
                  >
                    <Plus /> Budget
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ResponsiveDialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.locked ? "Ubah budget" : "Tambah budget"}
      >
        {draft && (
          <BudgetForm
            key={draft.categoryId ?? "new"}
            month={month}
            draft={draft}
            categories={categories}
            averages={averages}
            budgetedIds={budgetedIds}
            onDone={closeDialog}
          />
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus budget "${toDelete?.name}"?`}
        description="Hanya budget bulan ini yang dihapus. Transaksi tidak terpengaruh."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteBudget(toDelete.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}
