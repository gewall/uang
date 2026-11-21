"use client";

import { ArrowLeftRight, MoreVertical, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type CategoryOption, CategorySelect, type WalletOptionItem, WalletSelect } from "@/components/entity-select";
import { EntityIcon } from "@/components/entity-icon";
import { Field, MoneyInput } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecurrenceFreq, TransactionType } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteRecurring, saveRecurring, setRecurringActive } from "../actions";
import type { RecurringItem } from "../queries";
import { daysBetween, describeSchedule, FREQ_LABEL, formatDateKey } from "../schedule";

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};
const freqItems = (Object.keys(FREQ_LABEL) as RecurrenceFreq[]).map((f) => ({ value: f, label: FREQ_LABEL[f].unit }));

type Props = { items: RecurringItem[]; categories: CategoryOption[]; wallets: WalletOptionItem[]; today: string };

export function RecurringView({ items, categories, wallets, today }: Props) {
  const [dialog, setDialog] = useState<{ item?: RecurringItem } | null>(null);
  const [toDelete, setToDelete] = useState<RecurringItem | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback((message?: string) => {
    setDialog(null);
    if (message) toast.success(message);
  }, []);
  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message ?? "Gagal memproses.");
      after?.();
    });

  const monthly = items
    .filter((i) => i.rule.active && i.rule.type !== "transfer")
    .reduce(
      (acc, { rule: r }) => {
        // perkiraan per bulan
        const perMonth =
          r.frequency === "daily"
            ? (30 / r.interval) * r.amount
            : r.frequency === "weekly"
              ? (52 / 12 / r.interval) * r.amount
              : r.frequency === "monthly"
                ? r.amount / r.interval
                : r.amount / (12 * r.interval);
        acc[r.type as "income" | "expense"] += Math.round(perMonth);
        return acc;
      },
      { income: 0, expense: 0 },
    );

  return (
    <>
      <PageHeader
        title="Transaksi berulang"
        description="Gaji, tagihan, langganan — dicatat otomatis saat jatuh tempo."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> Tambah jadwal
          </Button>
        }
      />

      {items.length > 0 && (
        <Card size="sm">
          <CardContent className="grid grid-cols-2 divide-x text-center">
            <div className="px-1">
              <p className="text-xs text-muted-foreground">Perkiraan pemasukan/bulan</p>
              <p className="font-semibold text-income tabular-nums sm:text-lg">{formatMoney(monthly.income)}</p>
            </div>
            <div className="px-1">
              <p className="text-xs text-muted-foreground">Perkiraan tagihan/bulan</p>
              <p className="font-semibold text-expense tabular-nums sm:text-lg">{formatMoney(monthly.expense)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Repeat className="size-6" />
            </span>
            <p className="font-medium">Belum ada transaksi berulang</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Catat sekali untuk gaji bulanan, listrik, internet, atau langganan — transaksinya dibuat otomatis tiap
              jatuh tempo.
            </p>
            <Button onClick={() => setDialog({})}>
              <Plus /> Tambah jadwal pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const { rule: r } = item;
            const days = daysBetween(today, r.nextDate);
            const when = days === 0 ? "hari ini" : days === 1 ? "besok" : `${days} hari lagi`;
            return (
              <Card key={r.id} size="sm" className={cn(!r.active && "opacity-60")}>
                <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3">
                  {item.category ? (
                    <EntityIcon
                      icon={item.category.icon}
                      color={item.category.color}
                      size="lg"
                      className="max-sm:size-10"
                    />
                  ) : (
                    <span className="flex size-11 items-center justify-center rounded-xl bg-muted max-sm:size-10">
                      <ArrowLeftRight className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {describeSchedule(r)} · {item.wallet.name}
                      {item.toWalletName ? ` → ${item.toWalletName}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs">
                      {r.active ? (
                        <span className={cn(days <= 3 ? "text-foreground" : "text-muted-foreground")}>
                          Berikutnya {formatDateKey(r.nextDate)} ({when})
                        </span>
                      ) : (
                        <Badge variant="secondary">{r.endDate && r.nextDate > r.endDate ? "selesai" : "dijeda"}</Badge>
                      )}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-right font-semibold whitespace-nowrap tabular-nums",
                      r.type === "income" ? "text-income" : r.type === "expense" ? "text-expense" : "",
                    )}
                  >
                    {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}
                    {formatMoney(r.amount, item.wallet.currency as Currency)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${r.name}`} className="-mr-1" />
                      }
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setDialog({ item })}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => run(() => setRecurringActive(r.id, !r.active))}>
                        {r.active ? (
                          <>
                            <Pause /> Jeda
                          </>
                        ) : (
                          <>
                            <Play /> Lanjutkan
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setToDelete(item)}>
                        <Trash2 /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.item ? "Edit jadwal" : "Tambah transaksi berulang"}
        description={dialog?.item ? undefined : "Transaksi dibuat otomatis pukul 08.00 WIB di tanggal jadwal."}
      >
        {dialog && (
          <RecurringForm
            key={dialog.item?.rule.id ?? "new"}
            item={dialog.item}
            categories={categories}
            wallets={wallets}
            today={today}
            onDone={close}
          />
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus "${toDelete?.rule.name}"?`}
        description="Jadwal dihapus; transaksi yang sudah tercatat tidak ikut terhapus. Kalau hanya ingin berhenti sementara, pakai Jeda."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteRecurring(toDelete.rule.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}

function RecurringForm({
  item,
  categories,
  wallets,
  today,
  onDone,
}: {
  item?: RecurringItem;
  categories: CategoryOption[];
  wallets: WalletOptionItem[];
  today: string;
  onDone: (message?: string) => void;
}) {
  const r = item?.rule;
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecurring, {});
  const active = wallets.filter((w) => !w.archivedAt);
  const [type, setType] = useState<TransactionType>(r?.type ?? "expense");
  const [walletId, setWalletId] = useState(r?.walletId ?? active[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(r?.toWalletId ?? "");
  const [categoryId, setCategoryId] = useState(r?.categoryId ?? "");
  const [frequency, setFrequency] = useState<RecurrenceFreq>(r?.frequency ?? "monthly");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const currency = (wallets.find((w) => w.id === walletId)?.currency ?? "IDR") as Currency;

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <input type="hidden" name="type" value={type} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <div role="radiogroup" aria-label="Jenis" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(["expense", "income", "transfer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => {
              if (t !== type) setCategoryId("");
              setType(t);
            }}
            className={cn(
              "rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              type === t &&
                (t === "expense"
                  ? "bg-expense text-white shadow-sm"
                  : t === "income"
                    ? "bg-income text-white shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm"),
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <Field label="Nama" htmlFor="rec-name" error={err("name")}>
        <Input
          id="rec-name"
          name="name"
          defaultValue={r?.name}
          maxLength={60}
          required
          placeholder={type === "income" ? "mis. Gaji" : type === "transfer" ? "mis. Nabung bulanan" : "mis. Internet"}
        />
      </Field>

      <Field label="Nominal" htmlFor="rec-amount" error={err("amount")}>
        <MoneyInput
          id="rec-amount"
          name="amount"
          currency={currency}
          defaultMinor={r?.amount}
          invalid={Boolean(err("amount"))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "transfer" ? "Dari" : "Dompet"} error={err("walletId")}>
          <WalletSelect name="walletId" value={walletId} onValueChange={setWalletId} options={wallets} />
        </Field>
        {type === "transfer" ? (
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
        ) : (
          <Field label="Kategori" error={err("categoryId")}>
            <CategorySelect
              name="categoryId"
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.filter((c) => c.kind === type)}
              invalid={Boolean(err("categoryId"))}
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
        <Field label="Tiap" htmlFor="rec-interval" error={err("interval")}>
          <Input id="rec-interval" name="interval" type="number" min={1} max={365} defaultValue={r?.interval ?? 1} />
        </Field>
        <Field label="Periode">
          <Select
            name="frequency"
            items={freqItems}
            value={frequency}
            onValueChange={(v) => v && setFrequency(v as RecurrenceFreq)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {freqItems.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Mulai"
          htmlFor="rec-start"
          error={err("startDate")}
          hint={
            frequency === "monthly" || frequency === "yearly"
              ? "Tanggalnya jadi patokan (tgl 31 → akhir bulan)."
              : !r
                ? "Tanggal lewat ikut dicatat."
                : undefined
          }
        >
          <Input id="rec-start" name="startDate" type="date" defaultValue={r?.startDate ?? today} required />
        </Field>
        <Field label="Berakhir (opsional)" htmlFor="rec-end" error={err("endDate")}>
          <Input id="rec-end" name="endDate" type="date" defaultValue={r?.endDate ?? ""} />
        </Field>
      </div>

      <Field label="Catatan (opsional)" htmlFor="rec-note" error={err("note")}>
        <Input id="rec-note" name="note" defaultValue={r?.note ?? ""} maxLength={200} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : r ? "Simpan perubahan" : "Simpan jadwal"}
        </Button>
      </div>
    </form>
  );
}
