"use client";

import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  Minus,
  MoreVertical,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type WalletOptionItem, WalletSelect } from "@/components/entity-select";
import { EntityIcon } from "@/components/entity-icon";
import { ColorPicker, Field, IconPicker, MoneyInput } from "@/components/form-fields";
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
import type { FormState } from "@/lib/form";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatDateKey } from "../../recurring/schedule";
import { addGoalDeposit, deleteGoal, saveGoal, setGoalArchived } from "../actions";
import type { GoalItem } from "../queries";

export function GoalsView({ goals, wallets }: { goals: GoalItem[]; wallets: WalletOptionItem[] }) {
  const [dialog, setDialog] = useState<{ goal?: GoalItem } | null>(null);
  const [deposit, setDeposit] = useState<{ goal: GoalItem; withdraw: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<GoalItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
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
      if (res.ok) after?.();
    });

  const active = goals.filter((g) => !g.archivedAt);
  const archived = goals.filter((g) => g.archivedAt);
  const totalTarget = active.reduce((n, g) => n + g.targetAmount, 0);
  const totalSaved = active.reduce((n, g) => n + Math.min(g.progress.saved, g.targetAmount), 0);

  const card = (g: GoalItem) => (
    <GoalCard
      key={g.id}
      goal={g}
      onEdit={() => setDialog({ goal: g })}
      onDeposit={(withdraw) => setDeposit({ goal: g, withdraw })}
      onArchive={() => run(() => setGoalArchived(g.id, !g.archivedAt))}
      onDelete={() => setToDelete(g)}
    />
  );

  return (
    <>
      <PageHeader
        title="Target tabungan"
        description="Dana darurat, liburan, gadget — pantau progresnya."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> Tambah target
          </Button>
        }
      />

      {active.length > 0 && (
        <Card size="sm" className="bg-primary text-primary-foreground ring-0">
          <CardContent className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm opacity-80">Terkumpul · {active.length} target aktif</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(totalSaved)}</p>
            </div>
            <p className="text-sm tabular-nums opacity-90">dari {formatMoney(totalTarget)}</p>
          </CardContent>
        </Card>
      )}

      {active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <PiggyBank className="size-6" />
            </span>
            <p className="font-medium">Belum ada target</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Buat target dan tautkan ke dompet tabungan (mis. kantong Jago) supaya progresnya mengikuti saldo, atau
              catat setoran manual.
            </p>
            <Button onClick={() => setDialog({})}>
              <Plus /> Buat target pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{active.map(card)}</div>
      )}

      {archived.length > 0 && (
        <section className="grid gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
          >
            <Archive /> Diarsipkan ({archived.length}) {showArchived ? "— sembunyikan" : "— tampilkan"}
          </Button>
          {showArchived && (
            <div className="grid gap-3 opacity-75 sm:grid-cols-2 xl:grid-cols-3">{archived.map(card)}</div>
          )}
        </section>
      )}

      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.goal ? "Edit target" : "Tambah target tabungan"}
      >
        {dialog && <GoalForm key={dialog.goal?.id ?? "new"} goal={dialog.goal} wallets={wallets} onDone={close} />}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={deposit !== null}
        onOpenChange={(o) => !o && setDeposit(null)}
        title={deposit?.withdraw ? "Tarik dari target" : "Tambah setoran"}
        description={deposit?.goal.name}
      >
        {deposit && (
          <form
            className="grid gap-4"
            action={(fd) =>
              run(
                () => addGoalDeposit(deposit.goal.id, String(fd.get("amount") ?? ""), deposit.withdraw),
                () => setDeposit(null),
              )
            }
          >
            <Field label="Nominal" htmlFor="goal-dep">
              <MoneyInput id="goal-dep" name="amount" autoFocus />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeposit(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : deposit.withdraw ? "Tarik" : "Setor"}
              </Button>
            </div>
          </form>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus "${toDelete?.name}"?`}
        description="Target dihapus permanen. Saldo dompet tidak berubah."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteGoal(toDelete.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}

function GoalCard({
  goal: g,
  onEdit,
  onDeposit,
  onArchive,
  onDelete,
}: {
  goal: GoalItem;
  onEdit: () => void;
  onDeposit: (withdraw: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const p = g.progress;
  const pct = Math.min(100, Math.round(p.ratio * 100));
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex items-start gap-3">
          <EntityIcon icon={g.icon} color={g.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{g.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {g.walletName ? `Saldo ${g.walletName}` : "Setoran manual"}
              {g.targetDate ? ` · target ${formatDateKey(g.targetDate)}` : ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${g.name}`} className="-mt-1 -mr-1" />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!g.walletId && (
                <DropdownMenuItem onClick={() => onDeposit(true)}>
                  <Minus /> Tarik dana
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {g.archivedAt ? (
                  <>
                    <ArchiveRestore /> Aktifkan lagi
                  </>
                ) : (
                  <>
                    <Archive /> Arsipkan
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <p className="font-semibold tracking-tight sm:text-lg">{formatMoney(p.saved)}</p>
            <p className="text-xs text-muted-foreground">dari {formatMoney(g.targetAmount)}</p>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct}% terkumpul`}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full", p.done ? "bg-income" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {p.done ? (
              <>
                <CircleCheck className="size-3.5 text-income" /> Tercapai!
              </>
            ) : p.overdue ? (
              <>
                <TriangleAlert className="size-3.5 text-warning" /> Lewat tanggal target · kurang{" "}
                {formatMoney(p.remaining)}
              </>
            ) : p.perMonth ? (
              <>
                {pct}% · perlu {formatMoney(p.perMonth)}/bulan ({p.monthsLeft} bln lagi)
              </>
            ) : (
              <>
                {pct}% · kurang {formatMoney(p.remaining)}
              </>
            )}
          </p>
        </div>

        {!g.walletId && !g.archivedAt && !p.done && (
          <Button variant="outline" size="sm" onClick={() => onDeposit(false)}>
            <Plus /> Tambah setoran
          </Button>
        )}
        {g.archivedAt && <Badge variant="secondary">diarsipkan</Badge>}
      </CardContent>
    </Card>
  );
}

function GoalForm({
  goal,
  wallets,
  onDone,
}: {
  goal?: GoalItem;
  wallets: WalletOptionItem[];
  onDone: (message?: string) => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveGoal, {});
  const [walletId, setWalletId] = useState(goal?.walletId ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "piggy-bank");
  const [color, setColor] = useState(goal?.color ?? "emerald");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const idrWallets = wallets.filter((w) => w.currency === "IDR");

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
      {goal && <input type="hidden" name="id" value={goal.id} />}
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <Field label="Nama" htmlFor="goal-name" error={err("name")}>
        <Input
          id="goal-name"
          name="name"
          defaultValue={goal?.name}
          maxLength={60}
          required
          placeholder="mis. Dana darurat"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target" htmlFor="goal-target" error={err("targetAmount")}>
          <MoneyInput
            id="goal-target"
            name="targetAmount"
            defaultMinor={goal?.targetAmount}
            invalid={Boolean(err("targetAmount"))}
          />
        </Field>
        <Field label="Tanggal target (opsional)" htmlFor="goal-date" error={err("targetDate")}>
          <Input id="goal-date" name="targetDate" type="date" defaultValue={goal?.targetDate ?? ""} />
        </Field>
      </div>
      <Field
        label="Progres dari"
        error={err("walletId")}
        hint={walletId ? "Progres = saldo dompet ini (otomatis)." : "Tanpa dompet: catat setoran manual."}
      >
        <div className="flex gap-2">
          <WalletSelect
            name="walletId"
            value={walletId}
            onValueChange={setWalletId}
            options={idrWallets}
            placeholder="Setoran manual"
          />
          {walletId && (
            <Button type="button" variant="outline" onClick={() => setWalletId("")}>
              Manual
            </Button>
          )}
        </div>
      </Field>
      {!walletId && (
        <Field label="Sudah terkumpul" htmlFor="goal-saved" error={err("savedAmount")}>
          <MoneyInput id="goal-saved" name="savedAmount" defaultMinor={goal?.savedAmount || undefined} />
        </Field>
      )}
      <Field label="Warna">
        <ColorPicker name="color" value={color} onChange={setColor} />
      </Field>
      <Field label="Ikon">
        <IconPicker name="icon" value={icon} color={color} onChange={setIcon} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : goal ? "Simpan perubahan" : "Buat target"}
        </Button>
      </div>
    </form>
  );
}
