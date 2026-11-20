"use client";

import { DatabaseBackup, Download, FileJson, FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { Field } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/form";
import { cn } from "@/lib/utils";
import { restoreBackup } from "../restore";

type Format = "xlsx" | "csv" | "json";
type Range = "all" | "month" | "year" | "custom";

const FORMATS: { value: Format; title: string; desc: string; icon: typeof FileText }[] = [
  {
    value: "xlsx",
    title: "Excel lengkap",
    desc: "Transaksi, dompet, kategori, budget, investasi — satu sheet per data.",
    icon: FileSpreadsheet,
  },
  {
    value: "csv",
    title: "CSV transaksi",
    desc: "Satu tabel transaksi. Bisa diimport ulang lewat menu Import.",
    icon: FileText,
  },
  { value: "json", title: "Backup JSON", desc: "Seluruh data untuk dipulihkan nanti (restore).", icon: FileJson },
];

const pad = (n: number) => String(n).padStart(2, "0");
const wibToday = () => new Date(Date.now() + 7 * 3600e3);

export function ExportView({ accountEmpty }: { accountEmpty: boolean }) {
  const [format, setFormat] = useState<Format>("xlsx");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(restoreBackup, {});

  const today = wibToday();
  const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const bounds: Record<Exclude<Range, "custom">, [string, string] | null> = {
    all: null,
    month: [`${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-01`, ymd(today)],
    year: [`${today.getUTCFullYear()}-01-01`, ymd(today)],
  };
  const [f, t] = range === "custom" ? [from, to] : (bounds[range] ?? ["", ""]);
  const params = new URLSearchParams({ format });
  if (format !== "json") {
    if (f) params.set("from", f);
    if (t) params.set("to", t);
  }
  const href = `/api/export?${params}`;

  return (
    <div className="grid gap-5">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4.5 text-primary" /> Unduh data
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-3">
            {FORMATS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={format === o.value}
                onClick={() => setFormat(o.value)}
                className={cn(
                  "grid gap-1 rounded-xl border p-3 text-left transition-all outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring",
                  format === o.value && "border-primary ring-2 ring-primary/30",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <o.icon className="size-4 text-primary" /> {o.title}
                </span>
                <span className="text-xs text-muted-foreground">{o.desc}</span>
              </button>
            ))}
          </div>

          {format !== "json" && (
            <div className="grid gap-3">
              <p className="text-sm font-medium">Rentang transaksi</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "Semua"],
                    ["month", "Bulan ini"],
                    ["year", "Tahun ini"],
                    ["custom", "Pilih tanggal"],
                  ] as [Range, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRange(v)}
                    aria-pressed={range === v}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm",
                      range === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {range === "custom" && (
                <div className="grid grid-cols-2 gap-3 sm:w-96">
                  <Field label="Dari" htmlFor="exp-from">
                    <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="Sampai" htmlFor="exp-to">
                    <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}

          <Button render={<a href={href} download />} nativeButton={false} className="justify-self-start max-sm:w-full">
            <Download /> Unduh {FORMATS.find((o) => o.value === format)?.title}
          </Button>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="size-4.5 text-primary" /> Pulihkan dari backup
          </CardTitle>
          <CardDescription>
            Memasukkan seluruh isi file Backup JSON. Hanya bisa ke akun yang masih kosong, supaya tidak ada data yang
            tertimpa atau dobel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountEmpty ? (
            <form action={action} className="grid gap-3 sm:flex sm:items-end">
              <Field label="File backup (.json)" htmlFor="restore-file" className="sm:flex-1">
                <Input id="restore-file" name="file" type="file" accept=".json,application/json" required />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Upload />} Pulihkan
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Akun ini sudah berisi data, jadi restore dinonaktifkan. Gunakan menu Import untuk menambah transaksi.
            </p>
          )}
          {state.message && (
            <p className={cn("mt-3 text-sm", state.ok ? "text-income" : "text-destructive")}>{state.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
