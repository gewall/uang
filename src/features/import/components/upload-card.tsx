"use client";

import { FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormState } from "@/lib/form";
import { cn } from "@/lib/utils";
import { uploadImportFile } from "../actions";

export function UploadCard({ kind }: { kind: "jago" | "table" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadImportFile, {});
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isJago = kind === "jago";
  const Icon = isJago ? FileText : FileSpreadsheet;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4.5 text-primary" />
          {isJago ? "PDF mutasi Bank Jago" : "CSV / Excel"}
        </CardTitle>
        <CardDescription>
          {isJago
            ? "Laporan Keuangan Bulanan dari aplikasi Jago. Semua Kantong terbaca, saldo dicocokkan otomatis."
            : "Mutasi dari bank/e-wallet lain. Kamu pilih kolom tanggal, nominal, dan keterangan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f && inputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(f);
                inputRef.current.files = dt.files;
                setFileName(f.name);
              }
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors hover:border-primary/50 hover:bg-muted/40",
              dragOver && "border-primary bg-muted/60",
            )}
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="font-medium">{fileName ?? "Pilih file atau tarik ke sini"}</span>
            <span className="text-xs text-muted-foreground">{isJago ? ".pdf" : ".csv atau .xlsx"} · maks. 10 MB</span>
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept={isJago ? ".pdf,application/pdf" : ".csv,.xlsx,text/csv"}
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              required
            />
          </label>
          {state.message && <p className="text-sm text-destructive">{state.message}</p>}
          <Button type="submit" disabled={pending || !fileName}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Membaca file…
              </>
            ) : (
              "Baca & tinjau"
            )}
          </Button>
          {isJago && (
            <p className="text-xs text-muted-foreground">
              Diproses di server milikmu sendiri. File PDF tidak disimpan — hanya transaksi yang kamu setujui.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
