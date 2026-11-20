"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { type WalletOptionItem, WalletSelect } from "@/components/entity-select";
import { Field, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvestmentTxnType } from "@/db/schema";
import { toWibInput } from "@/lib/dates";
import type { FormState } from "@/lib/form";
import { type Currency, formatMoney } from "@/lib/money";
import { formatQuantity, parseQuantity } from "@/lib/number";
import { cn } from "@/lib/utils";
import { saveInvestmentTxn } from "../actions";
import { INVESTMENT_TXN_LABEL } from "../constants";
import { tradeAmount } from "../math";

export type InvestmentTxnDraft = {
  id?: string;
  type: InvestmentTxnType;
  occurredAt?: Date;
  units?: number | null;
  price?: number | null;
  fee?: number;
  amount?: number;
  walletId?: string | null;
  note?: string | null;
};

export type AssetRef = {
  id: string;
  name: string;
  unitLabel: string;
  currency: string;
  currentPrice: number | null;
  units: number;
};

export function InvestmentTxnForm({
  asset,
  draft,
  wallets,
  onDone,
  onDelete,
}: {
  asset: AssetRef;
  draft: InvestmentTxnDraft;
  wallets: WalletOptionItem[];
  onDone: (message?: string) => void;
  onDelete?: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveInvestmentTxn, {});
  const currency = asset.currency as Currency;
  const [type, setType] = useState<InvestmentTxnType>(draft.type);
  const [unitsText, setUnitsText] = useState(draft.units ? formatQuantity(draft.units) : "");
  const [price, setPrice] = useState<number | null>(draft.price ?? (draft.id ? null : asset.currentPrice));
  const [fee, setFee] = useState<number | null>(draft.fee ?? null);
  const sameCurrency = wallets.filter((w) => w.currency === asset.currency);
  const [walletId, setWalletId] = useState(
    draft.id ? (draft.walletId ?? "none") : (sameCurrency.find((w) => !w.archivedAt)?.id ?? "none"),
  );
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  const units = unitsText ? parseQuantity(unitsText) : null;
  const isTrade = type !== "dividend";
  const total = isTrade && units && price !== null ? tradeAmount(type, units, price, fee ?? 0) : null;

  return (
    <form action={action} className="grid gap-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="assetId" value={asset.id} />
      <input type="hidden" name="type" value={type} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <div role="radiogroup" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(["buy", "sell", "dividend"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "truncate rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              type === t && "bg-background text-foreground shadow-sm",
            )}
          >
            {t === "dividend" ? "Dividen" : INVESTMENT_TXN_LABEL[t]}
          </button>
        ))}
      </div>

      {isTrade ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Jumlah (${asset.unitLabel})`}
              htmlFor="inv-units"
              error={err("units")}
              hint={
                type === "sell"
                  ? `Dimiliki: ${formatQuantity(asset.units)} ${asset.unitLabel}`
                  : "Boleh pecahan, mis. 2,5"
              }
            >
              <Input
                id="inv-units"
                name="units"
                inputMode="decimal"
                autoComplete="off"
                value={unitsText}
                onChange={(e) => setUnitsText(e.target.value)}
                aria-invalid={err("units") || (unitsText && units === null) ? true : undefined}
                className="tabular-nums"
                autoFocus
              />
            </Field>
            <Field label={`Harga per ${asset.unitLabel}`} htmlFor="inv-price" error={err("price")}>
              <MoneyInput
                id="inv-price"
                name="price"
                currency={currency}
                defaultMinor={price ?? undefined}
                onValueChange={setPrice}
                invalid={Boolean(err("price"))}
              />
            </Field>
          </div>
          <Field label="Biaya / fee broker (opsional)" htmlFor="inv-fee" error={err("fee")}>
            <MoneyInput
              id="inv-fee"
              name="fee"
              currency={currency}
              defaultMinor={draft.fee || undefined}
              onValueChange={setFee}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">{type === "buy" ? "Total dibayar" : "Total diterima"}</span>
            <span className="text-base font-semibold tabular-nums">
              {total !== null ? formatMoney(total, currency, { precision: "exact" }) : "—"}
            </span>
          </div>
        </>
      ) : (
        <Field label="Nominal dividen / bunga" htmlFor="inv-amount" error={err("amount")}>
          <MoneyInput
            id="inv-amount"
            name="amount"
            size="lg"
            currency={currency}
            defaultMinor={draft.amount}
            autoFocus
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={type === "buy" ? "Dibayar dari dompet" : "Diterima ke dompet"}
          error={err("walletId")}
          hint={
            type === "dividend"
              ? "Dicatat sebagai pemasukan."
              : "Saldo dompet ikut berubah, tidak dihitung sebagai pengeluaran/pemasukan."
          }
        >
          <WalletSelect
            name="walletId"
            value={walletId === "none" ? "" : walletId}
            onValueChange={(v) => setWalletId(v || "none")}
            options={sameCurrency}
            placeholder="Tidak dicatat di dompet"
          />
          {walletId !== "none" && (
            <button
              type="button"
              className="justify-self-start text-xs text-muted-foreground underline"
              onClick={() => setWalletId("none")}
            >
              Jangan catat di dompet
            </button>
          )}
        </Field>
        <Field label="Tanggal & jam" htmlFor="inv-date" error={err("occurredAt")}>
          <Input
            id="inv-date"
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={toWibInput(draft.occurredAt ?? new Date())}
          />
        </Field>
      </div>

      <Field label="Catatan (opsional)" htmlFor="inv-note" error={err("note")}>
        <Input id="inv-note" name="note" maxLength={200} defaultValue={draft.note ?? ""} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {draft.id && onDelete && (
          <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={onDelete}>
            <Trash2 /> Hapus
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onDone()} className={draft.id ? "" : "sm:ml-auto"}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
