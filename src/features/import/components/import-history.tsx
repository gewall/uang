"use client";

import { FileSpreadsheet, FileText, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { discardDraft, undoImport } from "../actions";

export type BatchRow = {
  id: string;
  source: "jago_pdf" | "csv" | "xlsx";
  filename: string;
  status: "draft" | "committed" | "undone";
  period: string | null;
  rowsImported: number;
  rowsSkipped: number;
  createdAt: Date;
  committedAt: Date | null;
};

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function ImportHistory({ batches, highlight }: { batches: BatchRow[]; highlight?: string }) {
  const [toUndo, setToUndo] = useState<BatchRow | null>(null);
  const [pending, startTransition] = useTransition();

  if (batches.length === 0) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Riwayat import</CardTitle>
        <CardDescription>Import yang salah bisa dibatalkan — semua transaksinya dihapus lagi.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {batches.map((b) => {
            const Icon = b.source === "jago_pdf" ? FileText : FileSpreadsheet;
            return (
              <li
                key={b.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 py-3",
                  b.id === highlight && "rounded-lg bg-accent/60 px-2",
                )}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{b.filename}</span>
                    {b.status === "draft" && <Badge variant="outline">draft</Badge>}
                    {b.status === "undone" && <Badge variant="secondary">dibatalkan</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {b.period ? `${b.period} · ` : ""}
                    {b.status === "committed"
                      ? `${b.rowsImported} transaksi diimport${b.rowsSkipped ? `, ${b.rowsSkipped} dilewati` : ""} · ${fmt.format(b.committedAt ?? b.createdAt)}`
                      : fmt.format(b.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {b.status === "draft" && (
                    <>
                      <Button size="sm" render={<Link href={`/import/${b.id}`} />} nativeButton={false}>
                        Lanjutkan
                      </Button>
                      <form action={discardDraft.bind(null, b.id)}>
                        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Hapus draft">
                          <Trash2 />
                        </Button>
                      </form>
                    </>
                  )}
                  {b.status === "committed" && (
                    <Button size="sm" variant="outline" onClick={() => setToUndo(b)}>
                      <RotateCcw /> Batalkan
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={toUndo !== null}
        onOpenChange={(o) => !o && setToUndo(null)}
        title={`Batalkan import "${toUndo?.filename}"?`}
        description={`${toUndo?.rowsImported ?? 0} transaksi dari import ini akan dihapus. Dompet yang dibuat oleh import ini ikut dihapus bila sudah kosong.`}
        confirmLabel="Batalkan import"
        pending={pending}
        onConfirm={() =>
          toUndo &&
          startTransition(async () => {
            const res = await undoImport(toUndo.id);
            if (res.ok) toast.success(res.message);
            else toast.error(res.message);
            setToUndo(null);
          })
        }
      />
    </Card>
  );
}
