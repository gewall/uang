"use client";

import { useActionState, useEffect, useState } from "react";
import { ColorPicker, Field, IconPicker, MoneyInput } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Wallet, WalletType } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { CURRENCIES, type Currency } from "@/lib/money";
import { saveWallet } from "../actions";
import { WALLET_TYPE_KEYS, WALLET_TYPES } from "../constants";

const typeItems = WALLET_TYPE_KEYS.map((k) => ({ value: k, label: WALLET_TYPES[k].label }));
const currencyItems = CURRENCIES.map((c) => ({ value: c, label: c === "IDR" ? "IDR — Rupiah" : "USD — Dolar AS" }));

export function WalletForm({ wallet, onDone }: { wallet?: Wallet; onDone: (message?: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWallet, {});
  const [type, setType] = useState<WalletType>((wallet?.type as WalletType) ?? "bank");
  const [currency, setCurrency] = useState<Currency>((wallet?.currency as Currency) ?? "IDR");
  const [icon, setIcon] = useState(wallet?.icon ?? WALLET_TYPES.bank.icon);
  const [color, setColor] = useState(wallet?.color ?? WALLET_TYPES.bank.color);
  const [touchedLook, setTouchedLook] = useState(Boolean(wallet));
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  const changeType = (t: WalletType) => {
    setType(t);
    // dompet baru: ikon & warna mengikuti jenis sampai user memilih sendiri
    if (!touchedLook) {
      setIcon(WALLET_TYPES[t].icon);
      setColor(WALLET_TYPES[t].color);
    }
  };

  return (
    <form action={action} className="grid gap-4">
      {wallet && <input type="hidden" name="id" value={wallet.id} />}
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <Field label="Nama" htmlFor="wallet-name" error={err("name")}>
        <Input
          id="wallet-name"
          name="name"
          defaultValue={wallet?.name}
          placeholder="mis. Jago Utama, GoPay, Dompet"
          maxLength={50}
          required
          autoFocus={!wallet}
          aria-invalid={err("name") ? true : undefined}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Jenis" error={err("type")}>
          <Select name="type" items={typeItems} value={type} onValueChange={(v) => v && changeType(v as WalletType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Mata uang">
          <Select
            name="currency"
            items={currencyItems}
            value={currency}
            onValueChange={(v) => v && setCurrency(v as Currency)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label="Saldo awal"
        htmlFor="wallet-initial"
        error={err("initialBalance")}
        hint={type === "credit" ? "Untuk utang kartu kredit, isi negatif (mis. -500rb)." : undefined}
      >
        <MoneyInput
          id="wallet-initial"
          name="initialBalance"
          currency={currency}
          defaultMinor={wallet?.initialBalance}
          allowNegative
          invalid={Boolean(err("initialBalance"))}
        />
      </Field>

      <Field label="Warna">
        <ColorPicker
          name="color"
          value={color}
          onChange={(v) => {
            setColor(v);
            setTouchedLook(true);
          }}
        />
      </Field>

      <Field label="Ikon">
        <IconPicker
          name="icon"
          value={icon}
          color={color}
          onChange={(v) => {
            setIcon(v);
            setTouchedLook(true);
          }}
        />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="wallet-note" error={err("note")}>
        <Textarea id="wallet-note" name="note" rows={2} maxLength={200} defaultValue={wallet?.note ?? ""} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : wallet ? "Simpan perubahan" : "Tambah dompet"}
        </Button>
      </div>
    </form>
  );
}
