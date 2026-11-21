"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { type CategoryOption, CategorySelect, type WalletOptionItem, WalletSelect } from "@/components/entity-select";
import { Field, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TransactionType } from "@/db/schema";
import { toWibInput } from "@/lib/dates";
import type { Currency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveTransaction, type TransactionFormState } from "../actions";
import { TYPE_LABEL } from "../schema";

/** Nilai awal form: dari transaksi yang diedit, duplikat, atau sisa input sebelumnya ("simpan & tambah lagi"). */
export type TransactionDraft = {
  id?: string;
  type: TransactionType;
  amount?: number;
  walletId?: string;
  toWalletId?: string | null;
  categoryId?: string | null;
  fee?: number;
  toAmount?: number | null;
  occurredAt?: Date;
  note?: string | null;
  tags?: string[];
  source?: "manual" | "import" | "recurring";
};

const TYPES: { value: TransactionType; icon: typeof ArrowUpRight; active: string }[] = [
  { value: "expense", icon: ArrowUpRight, active: "bg-expense text-white" },
  { value: "income", icon: ArrowDownLeft, active: "bg-income text-white" },
  { value: "transfer", icon: ArrowLeftRight, active: "bg-primary text-primary-foreground" },
];

export function TransactionForm({
  draft,
  categories,
  wallets,
  onDone,
  onAgain,
  onDuplicate,
  onDelete,
}: {
  draft: TransactionDraft;
  categories: CategoryOption[];
  wallets: WalletOptionItem[];
  onDone: (message?: string) => void;
  /** dipanggil setelah "Simpan & tambah lagi" sukses, membawa nilai untuk form berikutnya */
  onAgain: (next: TransactionDraft, message?: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [state, action, pending] = useActionState<TransactionFormState, FormData>(saveTransaction, {});
  const activeWallets = wallets.filter((w) => !w.archivedAt);
  const [type, setType] = useState<TransactionType>(draft.type);
  const [walletId, setWalletId] = useState(draft.walletId ?? activeWallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(draft.toWalletId ?? "");
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? "");
  const [showFee, setShowFee] = useState(Boolean(draft.fee));
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const isEdit = Boolean(draft.id);

  const fromCurrency = (wallets.find((w) => w.id === walletId)?.currency ?? "IDR") as Currency;
  const toCurrency = (wallets.find((w) => w.id === toWalletId)?.currency ?? fromCurrency) as Currency;
  const crossCurrency = type === "transfer" && toWalletId !== "" && fromCurrency !== toCurrency;

  useEffect(() => {
    if (!state.ok) return;
    if (state.again) {
      const fd = new FormData(formRef.current ?? undefined);
      onAgain(
        {
          type,
          walletId,
          toWalletId: toWalletId || null,
          categoryId: categoryId || null,
          occurredAt: new Date(),
          tags: String(fd.get("tags") ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
        state.message,
      );
    } else {
      onDone(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya bereaksi pada hasil action
  }, [state]);

  if (activeWallets.length === 0 && !isEdit) {
    return (
      <div className="grid gap-3 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          Kamu belum punya dompet. Buat dompet dulu untuk mencatat transaksi.
        </p>
        <Button render={<Link href="/dompet" />} nativeButton={false}>
          <Plus /> Buat dompet
        </Button>
      </div>
    );
  }

  const changeType = (t: TransactionType) => {
    setType(t);
    // kategori pemasukan ≠ pengeluaran → reset pilihan kategori
    if (t !== type) setCategoryId("");
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="type" value={type} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <div role="radiogroup" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => changeType(t.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              type === t.value && `${t.active} shadow-sm`,
            )}
          >
            <t.icon className="hidden size-4 shrink-0 min-[400px]:block" />
            <span className="truncate">{TYPE_LABEL[t.value]}</span>
          </button>
        ))}
      </div>

      <Field
        label={crossCurrency ? `Nominal dikirim (${fromCurrency})` : "Nominal"}
        htmlFor="tx-amount"
        error={err("amount")}
      >
        <MoneyInput
          id="tx-amount"
          name="amount"
          size="lg"
          inputRef={amountRef}
          currency={fromCurrency}
          defaultMinor={draft.amount}
          autoFocus
          invalid={Boolean(err("amount"))}
        />
      </Field>

      {type === "transfer" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dari" error={err("walletId")}>
              <WalletSelect
                name="walletId"
                value={walletId}
                onValueChange={setWalletId}
                options={wallets}
                invalid={Boolean(err("walletId"))}
              />
            </Field>
            <Field label="Ke" error={err("toWalletId")}>
              <WalletSelect
                name="toWalletId"
                value={toWalletId}
                onValueChange={setToWalletId}
                options={wallets}
                exclude={walletId}
                placeholder="Pilih dompet tujuan"
                invalid={Boolean(err("toWalletId"))}
              />
            </Field>
          </div>
          {crossCurrency && (
            <Field label={`Nominal diterima (${toCurrency})`} htmlFor="tx-to-amount" error={err("toAmount")}>
              <MoneyInput
                id="tx-to-amount"
                name="toAmount"
                currency={toCurrency}
                defaultMinor={draft.toAmount ?? undefined}
                invalid={Boolean(err("toAmount"))}
              />
            </Field>
          )}
          {showFee ? (
            <Field label="Biaya admin" htmlFor="tx-fee" error={err("fee")} hint="Dipotong dari dompet asal.">
              <MoneyInput id="tx-fee" name="fee" currency={fromCurrency} defaultMinor={draft.fee || undefined} />
            </Field>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => setShowFee(true)}
            >
              <Plus /> Tambah biaya admin
            </Button>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori" error={err("categoryId")}>
            <CategorySelect
              name="categoryId"
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.filter((c) => c.kind === type)}
              invalid={Boolean(err("categoryId"))}
            />
          </Field>
          <Field label="Dompet" error={err("walletId")}>
            <WalletSelect
              name="walletId"
              value={walletId}
              onValueChange={setWalletId}
              options={wallets}
              invalid={Boolean(err("walletId"))}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <Field label="Tanggal & jam" htmlFor="tx-date" error={err("occurredAt")}>
          <Input
            id="tx-date"
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={toWibInput(draft.occurredAt ?? new Date())}
            className="sm:w-52"
          />
        </Field>
        <Field label="Catatan" htmlFor="tx-note" error={err("note")}>
          <Input
            id="tx-note"
            name="note"
            maxLength={200}
            defaultValue={draft.note ?? ""}
            placeholder={
              type === "income" ? "mis. Gaji November" : type === "transfer" ? "mis. Isi saldo" : "mis. Makan siang"
            }
          />
        </Field>
      </div>

      <Field label="Tag" htmlFor="tx-tags" hint="Opsional, pisahkan dengan koma. mis. liburan, kantor">
        <Input id="tx-tags" name="tags" defaultValue={draft.tags?.join(", ") ?? ""} autoComplete="off" />
      </Field>

      {draft.source === "import" && <p className="text-xs text-muted-foreground">Transaksi ini berasal dari import.</p>}
      {draft.source === "recurring" && (
        <p className="text-xs text-muted-foreground">Dicatat otomatis dari transaksi berulang.</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {isEdit && (
          <div className="flex gap-2 sm:mr-auto *:max-sm:flex-1">
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 /> Hapus
            </Button>
            <Button type="button" variant="ghost" onClick={onDuplicate}>
              <Copy /> Duplikat
            </Button>
          </div>
        )}
        {!isEdit && (
          <Button type="submit" name="intent" value="again" variant="outline" disabled={pending} className="sm:ml-auto">
            Simpan &amp; tambah lagi
          </Button>
        )}
        <Button type="submit" name="intent" value="save" disabled={pending}>
          {pending ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

/** Nilai awal untuk menduplikat transaksi: semua sama kecuali id & tanggal (sekarang). */
export function duplicateDraft(d: TransactionDraft): TransactionDraft {
  return { ...d, id: undefined, source: "manual", occurredAt: new Date() };
}
