"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AssetType, InvestmentAsset } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { CURRENCIES, type Currency } from "@/lib/money";
import { saveAsset } from "../actions";
import { ASSET_TYPE_KEYS, ASSET_TYPES } from "../constants";

const typeItems = Object.fromEntries(ASSET_TYPE_KEYS.map((k) => [k, ASSET_TYPES[k].label]));
const currencyItems = Object.fromEntries(CURRENCIES.map((c) => [c, c === "IDR" ? "IDR — Rupiah" : "USD — Dolar AS"]));

export function AssetForm({ asset, onDone }: { asset?: InvestmentAsset; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAsset, {});
  const [type, setType] = useState<AssetType>((asset?.type as AssetType) ?? "saham");
  const [currency, setCurrency] = useState<Currency>((asset?.currency as Currency) ?? "IDR");
  const [unitLabel, setUnitLabel] = useState(asset?.unitLabel ?? ASSET_TYPES.saham.unit);
  const [unitTouched, setUnitTouched] = useState(Boolean(asset));
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
      {asset && <input type="hidden" name="id" value={asset.id} />}
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <Field label="Nama aset" htmlFor="asset-name" error={err("name")}>
        <Input
          id="asset-name"
          name="name"
          defaultValue={asset?.name}
          placeholder="mis. Bank Central Asia, Sucorinvest Money Market, Emas Antam"
          maxLength={50}
          required
          autoFocus={!asset}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jenis" error={err("type")}>
          <Select
            name="type"
            items={typeItems}
            value={type}
            onValueChange={(v) => {
              if (!v) return;
              setType(v as AssetType);
              if (!unitTouched) setUnitLabel(ASSET_TYPES[v as AssetType].unit);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPE_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {ASSET_TYPES[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Kode / ticker (opsional)" htmlFor="asset-ticker" error={err("ticker")}>
          <Input
            id="asset-ticker"
            name="ticker"
            defaultValue={asset?.ticker ?? ""}
            placeholder="mis. BBCA, BTC"
            maxLength={15}
            className="uppercase"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mata uang">
          <Select
            name="currency"
            items={currencyItems}
            value={currency}
            onValueChange={(v) => v && setCurrency(v as Currency)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {currencyItems[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Satuan unit" htmlFor="asset-unit" error={err("unitLabel")} hint="lembar, unit, gram, koin…">
          <Input
            id="asset-unit"
            name="unitLabel"
            value={unitLabel}
            onChange={(e) => {
              setUnitLabel(e.target.value);
              setUnitTouched(true);
            }}
            maxLength={15}
            required
          />
        </Field>
      </div>

      <Field
        label={`Harga terkini per ${unitLabel || "unit"} (opsional)`}
        htmlFor="asset-price"
        error={err("currentPrice")}
        hint="Dipakai untuk menghitung nilai pasar & untung/rugi. Bisa diupdate kapan saja."
      >
        <MoneyInput
          id="asset-price"
          name="currentPrice"
          currency={currency}
          defaultMinor={asset?.currentPrice ?? undefined}
        />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="asset-note" error={err("note")}>
        <Textarea id="asset-note" name="note" rows={2} maxLength={200} defaultValue={asset?.note ?? ""} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : asset ? "Simpan perubahan" : "Tambah aset"}
        </Button>
      </div>
    </form>
  );
}
