"use client";

import { useActionState, useEffect, useState } from "react";
import { EntityIcon } from "@/components/entity-icon";
import { type CategoryOption, CategorySelect } from "@/components/entity-select";
import { Field, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import { formatMoney } from "@/lib/money";
import { saveBudget } from "../actions";

export type BudgetDraft = { categoryId?: string; amount?: number; locked?: boolean };

export function BudgetForm({
  month,
  draft,
  categories,
  averages,
  budgetedIds,
  onDone,
}: {
  month: string;
  draft: BudgetDraft;
  categories: CategoryOption[];
  /** rata-rata pengeluaran 3 bulan per kategori (sen) */
  averages: Record<string, number>;
  /** kategori yang sudah punya budget bulan ini (disembunyikan dari pilihan saat menambah) */
  budgetedIds: string[];
  onDone: (message?: string) => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBudget, {});
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? "");
  const [amount, setAmount] = useState<number | undefined>(draft.amount);
  const [amountKey, setAmountKey] = useState(0);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const average = categoryId ? (averages[categoryId] ?? 0) : 0;

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  // saat menambah: sembunyikan kategori yang sudah dibudget (kecuali yang sedang dipilih)
  const hide = new Set(budgetedIds.filter((id) => id !== draft.categoryId));
  const options = categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ ...c, children: c.children.filter((k) => !hide.has(k.id)) }))
    .filter((c) => !hide.has(c.id) || c.children.length > 0);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="month" value={month} />
      {draft.locked && <input type="hidden" name="categoryId" value={categoryId} />}
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      {draft.locked ? (
        <LockedCategory categories={categories} id={categoryId} />
      ) : (
        <Field
          label="Kategori"
          error={err("categoryId")}
          hint="Budget kategori induk otomatis mencakup subkategorinya."
        >
          <CategorySelect
            name="categoryId"
            value={categoryId}
            onValueChange={setCategoryId}
            options={options}
            invalid={Boolean(err("categoryId"))}
          />
        </Field>
      )}

      <Field label="Batas pengeluaran per bulan" htmlFor="budget-amount" error={err("amount")}>
        <MoneyInput
          key={amountKey}
          id="budget-amount"
          name="amount"
          size="lg"
          defaultMinor={amount}
          autoFocus={Boolean(draft.categoryId)}
          invalid={Boolean(err("amount"))}
        />
      </Field>

      {average > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Rata-rata 3 bulan terakhir:{" "}
            <span className="font-medium text-foreground tabular-nums">{formatMoney(average)}</span>
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              // bulatkan ke atas ke ribuan terdekat
              setAmount(Math.ceil(average / 100_000) * 100_000);
              setAmountKey((k) => k + 1);
            }}
          >
            Pakai
          </Button>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan budget"}
        </Button>
      </div>
    </form>
  );
}

function LockedCategory({ categories, id }: { categories: CategoryOption[]; id: string }) {
  const all = categories.flatMap((c) => [c, ...c.children.map((k) => ({ ...k, parent: c.name }))]);
  const c = all.find((x) => x.id === id);
  if (!c) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <EntityIcon icon={c.icon} color={c.color} />
      <div className="min-w-0">
        <p className="truncate font-medium">{c.name}</p>
        {"parent" in c && <p className="text-xs text-muted-foreground">Subkategori dari {c.parent}</p>}
      </div>
    </div>
  );
}
