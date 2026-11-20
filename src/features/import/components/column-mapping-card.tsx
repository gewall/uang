"use client";

import { Field } from "@/components/form-fields";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnMapping } from "@/lib/import/table";

const NONE = "-";

export function ColumnMappingCard({
  table,
  mapping,
  onChange,
  skipped,
}: {
  table: string[][];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  skipped: { line: number; reason: string }[];
}) {
  const width = Math.max(...table.slice(0, 20).map((r) => r.length), 1);
  const header = mapping.hasHeader ? table[0] : undefined;
  const colItems: Record<string, string> = {};
  for (let i = 0; i < width; i++) colItems[String(i)] = `Kolom ${i + 1}${header?.[i] ? ` — ${header[i]}` : ""}`;
  const optItems = { [NONE]: "— tidak ada —", ...colItems };
  const preview = table.slice(0, 6);

  const colSelect = (
    label: string,
    value: number | undefined,
    set: (v: number | undefined) => void,
    optional = false,
  ) => (
    <Field label={label}>
      <Select
        items={optional ? optItems : colItems}
        value={value === undefined ? NONE : String(value)}
        onValueChange={(v) => set(v === NONE || v === null ? undefined : Number(v))}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(optional ? optItems : colItems).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>1. Pilih kolom</CardTitle>
        <CardDescription>
          Cocokkan kolom file dengan data transaksi. Pratinjau di bawah berubah langsung.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <tbody>
              {preview.map((row, r) => (
                <tr key={r} className={r === 0 && mapping.hasHeader ? "bg-muted font-medium" : "border-t"}>
                  {Array.from({ length: width }, (_, c) => (
                    <td key={c} className="max-w-40 truncate px-2 py-1.5 whitespace-nowrap">
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mapping.hasHeader}
            onChange={(e) => onChange({ ...mapping, hasHeader: e.target.checked })}
            className="size-4 accent-primary"
          />
          Baris pertama adalah judul kolom
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colSelect("Tanggal", mapping.dateCol, (v) => onChange({ ...mapping, dateCol: v ?? 0 }))}
          <Field label="Format tanggal angka">
            <Select
              items={{
                dmy: "Hari/Bulan/Tahun (04/10/2026)",
                mdy: "Bulan/Hari/Tahun (10/04/2026)",
                ymd: "Tahun-Bulan-Hari",
              }}
              value={mapping.dateOrder}
              onValueChange={(v) => v && onChange({ ...mapping, dateOrder: v as ColumnMapping["dateOrder"] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dmy">Hari/Bulan/Tahun (04/10/2026)</SelectItem>
                <SelectItem value="mdy">Bulan/Hari/Tahun (10/04/2026)</SelectItem>
                <SelectItem value="ymd">Tahun-Bulan-Hari</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {colSelect("Keterangan", mapping.descCol, (v) => onChange({ ...mapping, descCol: v ?? 0 }))}
          <Field label="Nominal">
            <Select
              items={{ single: "Satu kolom (+ masuk, − keluar)", split: "Kolom debit & kredit terpisah" }}
              value={mapping.amountMode}
              onValueChange={(v) => v && onChange({ ...mapping, amountMode: v as ColumnMapping["amountMode"] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Satu kolom (+ masuk, − keluar)</SelectItem>
                <SelectItem value="split">Kolom debit & kredit terpisah</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mapping.amountMode === "single" ? (
            <>
              {colSelect("Kolom nominal", mapping.amountCol, (v) => onChange({ ...mapping, amountCol: v ?? 0 }))}
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(mapping.invertSign)}
                  onChange={(e) => onChange({ ...mapping, invertSign: e.target.checked })}
                  className="size-4 accent-primary"
                />
                Angka positif = pengeluaran
              </label>
            </>
          ) : (
            <>
              {colSelect("Kolom debit (keluar)", mapping.debitCol, (v) => onChange({ ...mapping, debitCol: v }), true)}
              {colSelect(
                "Kolom kredit (masuk)",
                mapping.creditCol,
                (v) => onChange({ ...mapping, creditCol: v }),
                true,
              )}
            </>
          )}
          {colSelect("Catatan (opsional)", mapping.noteCol, (v) => onChange({ ...mapping, noteCol: v }), true)}
        </div>

        {skipped.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {skipped.length} baris dilewati:{" "}
            {skipped
              .slice(0, 5)
              .map((s) => `baris ${s.line} (${s.reason})`)
              .join(", ")}
            {skipped.length > 5 ? ", …" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
