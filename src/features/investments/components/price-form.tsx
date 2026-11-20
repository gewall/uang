"use client";

import { useActionState, useEffect } from "react";
import { Field, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import type { Currency } from "@/lib/money";
import { updateAssetPrice } from "../actions";
import type { AssetRef } from "./investment-txn-form";

export function PriceForm({ asset, onDone }: { asset: AssetRef; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateAssetPrice, {});
  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="assetId" value={asset.id} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}
      <Field label={`Harga per ${asset.unitLabel}`} htmlFor="price-input" error={state.fieldErrors?.price?.[0]}>
        <MoneyInput
          id="price-input"
          name="price"
          size="lg"
          currency={asset.currency as Currency}
          defaultMinor={asset.currentPrice ?? undefined}
          autoFocus
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan harga"}
        </Button>
      </div>
    </form>
  );
}
