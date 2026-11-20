"use client";

import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
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
import type { WalletType } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { type Currency, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteWallet, setWalletArchived } from "../actions";
import { WALLET_TYPES } from "../constants";
import type { WalletWithBalance } from "../queries";
import { WalletForm } from "./wallet-form";

type DialogState = { mode: "create" } | { mode: "edit"; wallet: WalletWithBalance } | null;

export function WalletsView({ wallets, summary }: { wallets: WalletWithBalance[]; summary?: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<WalletWithBalance | null>(null);
  const [pending, startTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(false);

  const active = wallets.filter((w) => !w.archivedAt);
  const archived = wallets.filter((w) => w.archivedAt);

  const closeDialog = useCallback((message?: string) => {
    setDialog(null);
    if (message) toast.success(message);
  }, []);

  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message ?? "Gagal memproses.");
      after?.();
    });

  const card = (w: WalletWithBalance) => (
    <WalletCard
      key={w.id}
      wallet={w}
      onEdit={() => setDialog({ mode: "edit", wallet: w })}
      onToggleArchive={() => run(() => setWalletArchived(w.id, !w.archivedAt))}
      onDelete={() => setToDelete(w)}
    />
  );

  return (
    <>
      <PageHeader
        title="Dompet"
        description="Rekening bank, e-wallet, uang tunai, dan kartu kredit."
        actions={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus /> Tambah dompet
          </Button>
        }
      />
      {summary}

      {active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <WalletIcon className="size-6" />
            </span>
            <p className="font-medium">Belum ada dompet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tambahkan rekening bank, e-wallet, atau uang tunai untuk mulai mencatat.
            </p>
            <Button onClick={() => setDialog({ mode: "create" })}>
              <Plus /> Tambah dompet pertama
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
        title={dialog?.mode === "edit" ? "Edit dompet" : "Tambah dompet"}
        description={dialog?.mode === "edit" ? undefined : "Rekening, e-wallet, uang tunai, atau kartu kredit."}
      >
        {dialog && (
          <WalletForm
            key={dialog.mode === "edit" ? dialog.wallet.id : "new"}
            wallet={dialog.mode === "edit" ? dialog.wallet : undefined}
            onDone={closeDialog}
          />
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus "${toDelete?.name}"?`}
        description="Dompet akan dihapus permanen. Kalau hanya tidak dipakai lagi, lebih baik diarsipkan."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteWallet(toDelete.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}

function WalletCard({
  wallet,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  wallet: WalletWithBalance;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const negative = wallet.balance < 0;
  // mobile: 1 baris ringkas [ikon | nama | saldo | menu]; sm+: kartu dengan saldo di baris kedua
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-y-4">
        <EntityIcon icon={wallet.icon} color={wallet.color} size="lg" className="max-sm:size-10" />
        <div className="min-w-0">
          <p className="truncate font-medium" title={wallet.name}>
            {wallet.name}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{WALLET_TYPES[wallet.type as WalletType]?.label}</span>
            {wallet.currency !== "IDR" && <Badge variant="outline">{wallet.currency}</Badge>}
            {wallet.archivedAt && <Badge variant="secondary">diarsipkan</Badge>}
          </p>
        </div>
        <div className="text-right sm:col-span-3 sm:row-start-2 sm:text-left">
          <p className="hidden text-xs text-muted-foreground sm:block">Saldo</p>
          <p
            className={cn(
              "font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-xl",
              negative && "text-expense",
            )}
          >
            {formatMoney(wallet.balance, wallet.currency as Currency)}
          </p>
          {wallet.note && (
            <p className="mt-1 line-clamp-2 hidden text-xs text-muted-foreground sm:block">{wallet.note}</p>
          )}
        </div>
        <div className="sm:col-start-3 sm:row-start-1 sm:self-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${wallet.name}`} className="-mr-1" />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href={`/transaksi?dompet=${wallet.id}`} />}>
                <ReceiptText /> Lihat transaksi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>
                {wallet.archivedAt ? (
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
      </CardContent>
    </Card>
  );
}
