"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { WalletOptionItem } from "@/components/entity-select";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import type { InvestmentAsset } from "@/db/schema";
import { deleteAsset, deleteInvestmentTxn } from "../actions";
import { INVESTMENT_TXN_LABEL } from "../constants";
import { AssetForm } from "./asset-form";
import { type AssetRef, type InvestmentTxnDraft, InvestmentTxnForm } from "./investment-txn-form";
import { PriceForm } from "./price-form";

export type AssetDialogState =
  | { kind: "asset"; asset?: InvestmentAsset }
  | { kind: "txn"; asset: AssetRef; draft: InvestmentTxnDraft }
  | { kind: "price"; asset: AssetRef }
  | { kind: "deleteAsset"; asset: { id: string; name: string }; redirectTo?: string }
  | { kind: "deleteTxn"; txnId: string }
  | null;

export function AssetDialogs({
  state,
  setState,
  wallets,
}: {
  state: AssetDialogState;
  setState: (s: AssetDialogState) => void;
  wallets: WalletOptionItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const close = useCallback(
    (message?: string) => {
      setState(null);
      if (message) toast.success(message);
    },
    [setState],
  );

  const open = (kind: NonNullable<AssetDialogState>["kind"]) => state?.kind === kind;

  return (
    <>
      <ResponsiveDialog
        open={open("asset")}
        onOpenChange={(o) => !o && close()}
        title={state?.kind === "asset" && state.asset ? "Edit aset" : "Tambah aset investasi"}
      >
        {state?.kind === "asset" && <AssetForm key={state.asset?.id ?? "new"} asset={state.asset} onDone={close} />}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={open("txn")}
        onOpenChange={(o) => !o && close()}
        title={
          state?.kind === "txn"
            ? `${state.draft.id ? "Edit" : "Catat"} transaksi · ${state.asset.name}`
            : "Transaksi investasi"
        }
      >
        {state?.kind === "txn" && (
          <InvestmentTxnForm
            key={state.draft.id ?? `new-${state.draft.type}`}
            asset={state.asset}
            draft={state.draft}
            wallets={wallets}
            onDone={close}
            onDelete={state.draft.id ? () => setState({ kind: "deleteTxn", txnId: state.draft.id! }) : undefined}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={open("price")}
        onOpenChange={(o) => !o && close()}
        title={state?.kind === "price" ? `Update harga · ${state.asset.name}` : "Update harga"}
      >
        {state?.kind === "price" && <PriceForm asset={state.asset} onDone={close} />}
      </ResponsiveDialog>

      <ConfirmDialog
        open={open("deleteAsset")}
        onOpenChange={(o) => !o && close()}
        title={state?.kind === "deleteAsset" ? `Hapus "${state.asset.name}"?` : "Hapus aset?"}
        description="Seluruh riwayat aset ini dihapus, termasuk transaksi dompet yang tertaut (saldo dompet ikut kembali). Kalau sudah tidak dipegang, lebih baik diarsipkan."
        pending={pending}
        onConfirm={() =>
          state?.kind === "deleteAsset" &&
          startTransition(async () => {
            const res = await deleteAsset(state.asset.id);
            if (!res.ok) return void toast.error(res.message);
            close(res.message);
            if (state.redirectTo) router.push(state.redirectTo);
          })
        }
      />

      <ConfirmDialog
        open={open("deleteTxn")}
        onOpenChange={(o) => !o && close()}
        title="Hapus transaksi investasi?"
        description={`Transaksi dompet tertaut ikut dihapus. ${INVESTMENT_TXN_LABEL.buy}/${INVESTMENT_TXN_LABEL.sell.toLowerCase()} setelahnya dihitung ulang.`}
        pending={pending}
        onConfirm={() =>
          state?.kind === "deleteTxn" &&
          startTransition(async () => {
            const res = await deleteInvestmentTxn(state.txnId);
            if (!res.ok) return void toast.error(res.message);
            close(res.message);
          })
        }
      />
    </>
  );
}

/** Ringkas aset → AssetRef untuk form transaksi/harga. */
export function toAssetRef(a: {
  id: string;
  name: string;
  unitLabel: string;
  currency: string;
  currentPrice: number | null;
  valuation: { units: number };
}): AssetRef {
  return {
    id: a.id,
    name: a.name,
    unitLabel: a.unitLabel,
    currency: a.currency,
    currentPrice: a.currentPrice,
    units: a.valuation.units,
  };
}
