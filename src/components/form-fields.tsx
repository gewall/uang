"use client";

import { Check } from "lucide-react";
import type * as React from "react";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_KEYS, COLORS, getIcon, ICON_KEYS } from "@/lib/appearance-options";
import { type Currency, formatMoney, formatMoneyInput, parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Label + kontrol + pesan error/hint. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Input nominal bebas format (1.500.000 / 50rb / 1,5jt) dengan pratinjau hasil parse. */
export function MoneyInput({
  id,
  name,
  defaultMinor,
  currency = "IDR",
  allowNegative = false,
  invalid,
  autoFocus,
  size = "default",
  inputRef,
  onValueChange,
}: {
  id?: string;
  name: string;
  defaultMinor?: number;
  currency?: Currency;
  allowNegative?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  size?: "default" | "lg";
  inputRef?: React.Ref<HTMLInputElement>;
  /** dipanggil setiap input berubah dengan hasil parse (sen) atau null */
  onValueChange?: (minor: number | null) => void;
}) {
  const [value, setValue] = useState(defaultMinor !== undefined ? formatMoneyInput(defaultMinor) : "");
  const parsed = value ? parseMoneyInput(value) : null;
  const bad = value !== "" && (parsed === null || (!allowNegative && parsed < 0));

  return (
    <div className="grid gap-1">
      <div className="relative">
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground",
            size === "lg" ? "left-3 text-lg" : "text-sm",
          )}
        >
          {currency === "IDR" ? "Rp" : "$"}
        </span>
        <Input
          ref={inputRef}
          id={id}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(e.target.value ? parseMoneyInput(e.target.value) : null);
          }}
          aria-invalid={invalid || bad || undefined}
          className={cn(
            "tabular-nums",
            size === "lg"
              ? "h-14 pl-12 text-3xl font-semibold tracking-tight md:text-3xl"
              : "pl-9 text-base md:text-sm",
          )}
        />
      </div>
      <p className={cn("text-xs tabular-nums", bad ? "text-destructive" : "text-muted-foreground")}>
        {bad
          ? "Format tidak dikenali"
          : parsed !== null && value && value !== formatMoneyInput(parsed)
            ? `= ${formatMoney(parsed, currency, { precision: "exact" })}`
            : "Bisa ketik 1.500.000, 50rb, atau 1,5jt"}
      </p>
    </div>
  );
}

/** Grid ikon berbasis radio input (ikut terkirim di FormData). Controlled. */
export function IconPicker({
  name,
  value,
  onChange,
  color,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  color: string;
}) {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-9"
      style={{ "--c": COLORS[color as keyof typeof COLORS] ?? COLORS.slate } as CSSProperties}
    >
      {ICON_KEYS.map((key) => {
        const Icon = getIcon(key);
        const id = `${groupId}-${key}`;
        return (
          <label
            key={key}
            htmlFor={id}
            title={key}
            className="flex aspect-square cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted has-checked:bg-[color-mix(in_oklch,var(--c)_18%,transparent)] has-checked:text-(--c) has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={key}
              checked={key === value}
              onChange={() => onChange(key)}
              className="sr-only"
            />
            <Icon className="size-4.5" />
          </label>
        );
      })}
    </div>
  );
}

/** Swatch warna berbasis radio input. Controlled. */
export function ColorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const groupId = useId();
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => {
        const id = `${groupId}-${key}`;
        return (
          <label
            key={key}
            htmlFor={id}
            title={key}
            className="group relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform active:scale-90 has-checked:ring-2 has-checked:ring-(--c) has-focus-visible:ring-2 has-focus-visible:ring-ring"
            style={{ "--c": COLORS[key], background: COLORS[key] } as CSSProperties}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={key}
              checked={key === value}
              onChange={() => onChange(key)}
              className="sr-only"
            />
            <Check className="hidden size-4 text-white group-has-checked:block" />
          </label>
        );
      })}
    </div>
  );
}
