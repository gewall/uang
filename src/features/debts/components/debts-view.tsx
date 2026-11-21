"use client";

import { Check, ChevronDown, HandCoins, MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import type { DebtDirection } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDateKey } from "../../recurring/schedule";
import { addDebtPayment, deleteDebt, deleteDebtPayment, saveDebt, settleDebt } from "../actions";
import { DEBT_DIRECTION } from "../math";
import type { DebtItem } from "../queries";

type Totals = { payable: number; receivable: number; overdue: number };
type Tab = DebtDirection | "settled";

export function DebtsView({ items, totals, today }: { items: DebtItem[]; totals: Totals; today: string }) {
  const [tab, setTab] = useState<Tab>("payable");
  const [dialog, setDialog] = useState<{ debt?: DebtItem; direction: DebtDirection } | null>(null);
  const [paying, setPaying] = useState<DebtItem | null>(null);
  const [toDelete, setToDelete] = useState<DebtItem | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback((message?: string) => {
    setDialog(null);
    setPaying(null);
    if (message) toast.success(message);
  }, []);
  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message ?? "Gagal memproses.");
      after?.();
    });

  const shown = items.filter((i) =>
    tab === "settled" ? i.status === "settled" : i.status !== "settled" && i.direction === tab,
  );
  const settledCount = items.filter((i) => i.status === "settled").length;
  const newDirection: DebtDirection = tab === "receivable" ? "receivable" : "payable";

  return (
    <>
      <PageHeader
        title="Hutang & piutang"
        description="Pinjaman ke/dari orang lain dan cicilannya."
        actions={
          <Button onClick={() => setDialog({ direction: newDirection })}>
            <Plus /> Catat {DEBT_DIRECTION[newDirection].label.toLowerCase()}
          </Button>
        }
      />

      <Card size="sm">
        <CardContent className="grid grid-cols-2 divide-x text-center">
          <div className="px-1">
            <p className="text-xs text-muted-foreground">Hutangku (sisa)</p>
            <p className="font-semibold text-expense tabular-nums sm:text-lg">{formatMoney(totals.payable)}</p>
          </div>
          <div className="px-1">
            <p className="text-xs text-muted-foreground">Piutang (belum kembali)</p>
            <p className="font-semibold text-income tabular-nums sm:text-lg">{formatMoney(totals.receivable)}</p>
          </div>
        </CardContent>
      </Card>

      <div role="tablist" aria-label="Jenis" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["payable", "Hutang"],
            ["receivable", "Piutang"],
            ["settled", `Lunas${settledCount ? ` (${settledCount})` : ""}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              tab === k && "bg-background text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <HandCoins className="size-6" />
            </span>
            <p className="font-medium">
              {tab === "settled"
                ? "Belum ada yang lunas"
                : tab === "payable"
                  ? "Tidak ada hutang"
                  : "Tidak ada piutang"}
            </p>
            {tab !== "settled" && (
              <Button variant="outline" onClick={() => setDialog({ direction: tab })}>
                <Plus /> Catat {DEBT_DIRECTION[tab].label.toLowerCase()}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onPay={() => setPaying(d)}
              onEdit={() => setDialog({ debt: d, direction: d.direction })}
              onSettle={() => run(() => settleDebt(d.id))}
              onDelete={() => setToDelete(d)}
              onDeletePayment={(id) => run(() => deleteDebtPayment(id))}
            />
          ))}
        </div>
      )}

      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={
          dialog?.debt ? "Edit catatan" : `Catat ${dialog ? DEBT_DIRECTION[dialog.direction].label.toLowerCase() : ""}`
        }
        description={dialog ? DEBT_DIRECTION[dialog.direction].short : undefined}
      >
        {dialog && <DebtForm key={dialog.debt?.id ?? dialog.direction} {...dialog} today={today} onDone={close} />}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
        title={paying?.direction === "receivable" ? "Catat pengembalian" : "Catat pembayaran"}
        description={paying ? `${paying.person} · sisa ${formatMoney(paying.remaining)}` : undefined}
      >
        {paying && <PaymentForm key={paying.id} debt={paying} today={today} onDone={close} />}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus catatan ${toDelete?.person}?`}
        description="Catatan dan riwayat pembayarannya dihapus permanen."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteDebt(toDelete.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}

const STATUS_BADGE = {
  overdue: { label: "Lewat jatuh tempo", cls: "bg-expense/15 text-expense" },
  "due-soon": { label: "Segera jatuh tempo", cls: "bg-warning/20 text-foreground" },
  settled: { label: "Lunas", cls: "bg-income/15 text-income" },
  open: null,
} as const;

function DebtCard({
  debt: d,
  onPay,
  onEdit,
  onSettle,
  onDelete,
  onDeletePayment,
}: {
  debt: DebtItem;
  onPay: () => void;
  onEdit: () => void;
  onSettle: () => void;
  onDelete: () => void;
  onDeletePayment: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const badge = STATUS_BADGE[d.status];
  const pct = Math.round(d.ratio * 100);
  const due =
    d.dueDate && d.status !== "settled"
      ? d.daysLeft === 0
        ? "jatuh tempo hari ini"
        : d.daysLeft! < 0
          ? `telat ${-d.daysLeft!} hari`
          : `jatuh tempo ${formatDateKey(d.dueDate)}`
      : null;
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{d.person}</p>
            <p className="truncate text-xs text-muted-foreground">
              {DEBT_DIRECTION[d.direction].label} · sejak {formatDateKey(d.startDate)}
              {due ? ` · ${due}` : ""}
            </p>
            {d.note && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.note}</p>}
          </div>
          {badge && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>
              {badge.label}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${d.person}`} className="-mt-1 -mr-1" />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              {d.status !== "settled" && (
                <DropdownMenuItem onClick={onSettle}>
                  <Check /> Tandai lunas
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <p className={cn("font-semibold sm:text-lg", d.direction === "payable" ? "text-expense" : "text-income")}>
              {d.status === "settled" ? formatMoney(d.amount) : formatMoney(d.remaining)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {d.status === "settled" ? "" : "sisa"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">dari {formatMoney(d.amount)}</p>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct}% dibayar`}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-income" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {d.status !== "settled" && (
            <Button size="sm" onClick={onPay} className="max-sm:flex-1">
              <Plus /> {d.direction === "receivable" ? "Catat pengembalian" : "Catat bayar"}
            </Button>
          )}
          {d.payments.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {d.payments.length} pembayaran{" "}
              <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
            </Button>
          )}
        </div>
        {open && (
          <ul className="grid gap-1 border-t pt-2 text-sm">
            {d.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="text-muted-foreground tabular-nums">{formatDateKey(p.paidDate)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{p.note}</span>
                <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Hapus pembayaran"
                  onClick={() => onDeletePayment(p.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DebtForm({
  debt,
  direction,
  today,
  onDone,
}: {
  debt?: DebtItem;
  direction: DebtDirection;
  today: string;
  onDone: (message?: string) => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDebt, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-4">
      {debt && <input type="hidden" name="id" value={debt.id} />}
      <input type="hidden" name="direction" value={direction} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <Field label={DEBT_DIRECTION[direction].personLabel} htmlFor="debt-person" error={err("person")}>
        <Input
          id="debt-person"
          name="person"
          defaultValue={debt?.person}
          maxLength={60}
          required
          placeholder="Nama orang"
        />
      </Field>
      <Field label="Nominal" htmlFor="debt-amount" error={err("amount")}>
        <MoneyInput id="debt-amount" name="amount" defaultMinor={debt?.amount} invalid={Boolean(err("amount"))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal pinjam" htmlFor="debt-start" error={err("startDate")}>
          <Input id="debt-start" name="startDate" type="date" defaultValue={debt?.startDate ?? today} required />
        </Field>
        <Field label="Jatuh tempo (opsional)" htmlFor="debt-due" error={err("dueDate")}>
          <Input id="debt-due" name="dueDate" type="date" defaultValue={debt?.dueDate ?? ""} />
        </Field>
      </div>
      <Field label="Catatan (opsional)" htmlFor="debt-note" error={err("note")}>
        <Input id="debt-note" name="note" defaultValue={debt?.note ?? ""} maxLength={200} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : debt ? "Simpan perubahan" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function PaymentForm({ debt, today, onDone }: { debt: DebtItem; today: string; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addDebtPayment, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="debtId" value={debt.id} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <Field label="Nominal" htmlFor="pay-amount" error={err("amount")}>
        <MoneyInput
          id="pay-amount"
          name="amount"
          defaultMinor={debt.remaining}
          autoFocus
          invalid={Boolean(err("amount"))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal" htmlFor="pay-date" error={err("paidDate")}>
          <Input id="pay-date" name="paidDate" type="date" defaultValue={today} required />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="pay-note">
          <Input id="pay-note" name="note" maxLength={200} placeholder="mis. Cicilan ke-2" />
        </Field>
      </div>
      <Badge variant="outline" className="justify-self-start">
        Tidak mengubah saldo dompet — catat transaksinya terpisah bila perlu.
      </Badge>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
