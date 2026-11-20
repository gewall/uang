"use client";

import { AlertTriangle, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { CategoryOption } from "@/components/entity-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildImportPlan,
  type PocketMapping,
  type RowOverride,
  summarizePlan,
  type WalletRef,
} from "@/lib/import/plan";
import { type ColumnMapping, guessMapping, tableToStatement } from "@/lib/import/table";
import type { ImportStatement } from "@/lib/import/types";
import { commitImport, discardDraft } from "../actions";
import { type PlanContextData, toPlanContext } from "../plan-context";
import { ColumnMappingCard } from "./column-mapping-card";
import { PlanRowItem, type TransferTarget } from "./plan-row";
import { type MappingWallet, PocketMappingRow } from "./pocket-mapping";

type Props = {
  batch: { id: string; source: "jago_pdf" | "csv" | "xlsx"; filename: string };
  statement: ImportStatement | null;
  rawTable: string[][] | null;
  ctx: PlanContextData;
  initialMappings: Record<string, PocketMapping>;
  wallets: MappingWallet[];
  categories: CategoryOption[];
};

type Filter = "all" | "include" | "duplicate" | "excluded";

export function ImportReview({
  batch,
  statement: parsedStatement,
  rawTable,
  ctx: ctxData,
  initialMappings,
  wallets,
  categories,
}: Props) {
  const router = useRouter();
  const ctx = useMemo(() => toPlanContext(ctxData), [ctxData]);
  const isTable = batch.source !== "jago_pdf";

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(() => guessMapping(rawTable ?? []));
  const tableResult = useMemo(
    () =>
      isTable && rawTable
        ? tableToStatement(rawTable, columnMapping, {
            source: batch.source as "csv" | "xlsx",
            filename: batch.filename,
          })
        : null,
    [isTable, rawTable, columnMapping, batch.source, batch.filename],
  );
  const statement = (tableResult?.statement ?? parsedStatement)!;

  const [mappings, setMappings] = useState<Record<string, PocketMapping>>(initialMappings);
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [learnRules, setLearnRules] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const basePlan = useMemo(() => buildImportPlan(statement, mappings, ctx), [statement, mappings, ctx]);
  const plan = useMemo(
    () => buildImportPlan(statement, mappings, ctx, overrides),
    [statement, mappings, ctx, overrides],
  );
  const originalType = useMemo(() => new Map(basePlan.map((r) => [r.key, r.type])), [basePlan]);
  const summary = summarizePlan(plan);

  const onOverride = useCallback((key: string, patch: RowOverride | null) => {
    setOverrides((prev) => {
      const merged: RowOverride = { ...prev[key], ...patch };
      for (const k of Object.keys(merged) as (keyof RowOverride)[]) if (merged[k] === undefined) delete merged[k];
      return { ...prev, [key]: merged };
    });
  }, []);

  // efek saldo per kantong dari baris yang akan diimport
  const effectByPocket = useMemo(() => {
    const out = new Map<string, number>();
    const add = (ref: string | null, v: number) => {
      if (ref?.startsWith("pocket:")) out.set(ref.slice(7), (out.get(ref.slice(7)) ?? 0) + v);
    };
    for (const r of plan) {
      if (!r.include || r.status === "duplicate") continue;
      if (r.type === "income") add(r.from, r.amount);
      else if (r.type === "expense") add(r.from, -r.amount);
      else {
        add(r.from, -r.amount);
        add(r.to, r.amount);
      }
    }
    return out;
  }, [plan]);

  const transferTargets: TransferTarget[] = useMemo(
    () => [
      ...statement.pockets
        .filter((p) => (mappings[p.pocketId]?.mode ?? "skip") !== "skip")
        .map((p) => ({ ref: `pocket:${p.pocketId}` as WalletRef, name: p.name })),
      ...wallets
        .filter(
          (w) => !w.archivedAt && !Object.values(mappings).some((m) => m.mode === "existing" && m.walletId === w.id),
        )
        .map((w) => ({ ref: `wallet:${w.id}` as WalletRef, name: w.name })),
    ],
    [statement.pockets, mappings, wallets],
  );

  const q = query.trim().toLowerCase();
  const visible = plan.filter(
    (r) =>
      (filter === "all" ||
        (filter === "include" && r.include) ||
        (filter === "duplicate" && r.status === "duplicate") ||
        (filter === "excluded" && r.include && r.excludeFromStats)) &&
      (!q || `${r.counterparty} ${r.note ?? ""} ${r.kindLabel}`.toLowerCase().includes(q)),
  );

  const invalidNames = Object.values(mappings).some((m) => m.mode === "new" && !m.name.trim());
  const allSkipped = statement.pockets.every((p) => (mappings[p.pocketId]?.mode ?? "skip") === "skip");

  const commit = () =>
    startTransition(async () => {
      const res = await commitImport(batch.id, {
        mappings,
        overrides,
        columnMapping: isTable ? columnMapping : undefined,
        learnRules,
      });
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      router.push(`/import?hasil=${batch.id}`);
    });

  return (
    <div className="grid gap-5 pb-40 md:pb-24">
      {statement.warnings.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            {statement.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {isTable && rawTable && tableResult && (
        <ColumnMappingCard
          table={rawTable}
          mapping={columnMapping}
          onChange={setColumnMapping}
          skipped={tableResult.skipped}
        />
      )}

      <Card size="sm">
        <CardHeader>
          <CardTitle>{isTable ? "2." : "1."} Dompet tujuan</CardTitle>
          <CardDescription>
            {isTable
              ? "Transaksi dari file ini masuk ke dompet mana?"
              : "Setiap Kantong Jago menjadi satu dompet. Kantong yang sudah pernah diimport terpetakan otomatis."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {statement.pockets.map((p) => (
            <PocketMappingRow
              key={p.pocketId}
              pocket={p}
              mapping={mappings[p.pocketId] ?? { mode: "skip" }}
              onChange={(m) => setMappings((prev) => ({ ...prev, [p.pocketId]: m }))}
              wallets={wallets}
              effect={effectByPocket.get(p.pocketId) ?? 0}
              showStatementBalance={!isTable}
            />
          ))}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{isTable ? "3." : "2."} Tinjau transaksi</CardTitle>
          <CardDescription>
            Kategori diisi otomatis (bunga, pajak, investasi, aturan dari koreksi sebelumnya). Ubah yang kurang tepat.
          </CardDescription>
        </CardHeader>
        {/* minmax(0,1fr): lebar alami tab (nowrap) tidak boleh melebarkan kolom grid melewati kartu */}
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="min-w-0 max-w-full">
              <TabsList className="w-full max-w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-auto">
                <TabsTrigger value="all">Semua {summary.total}</TabsTrigger>
                <TabsTrigger value="include">Diimport {summary.toImport}</TabsTrigger>
                <TabsTrigger value="duplicate">Sudah ada {summary.duplicates}</TabsTrigger>
                <TabsTrigger value="excluded">Non-statistik {summary.excluded}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari…"
                className="pl-8"
                aria-label="Cari baris"
              />
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada baris.</p>
          ) : (
            <ul className="-mx-3 divide-y border-y">
              {visible.map((r) => (
                <PlanRowItem
                  key={r.key}
                  row={r}
                  categories={categories}
                  transferTargets={transferTargets}
                  originalType={originalType.get(r.key) ?? r.type}
                  onOverride={onOverride}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* bar aksi menempel di bawah (di atas bottom nav mobile) */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 pb-safe backdrop-blur md:bottom-0 md:left-(--sidebar-width) md:peer-data-[state=collapsed]:left-(--sidebar-width-icon)">
        {/* mobile: 2 baris ringkas (ringkasan · tombol); sm+: satu baris */}
        <div className="mx-auto grid max-w-6xl gap-2 px-4 py-2.5 sm:flex sm:items-center sm:gap-3 sm:py-3 md:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3 text-sm sm:block sm:flex-1">
            <p className="truncate font-medium tabular-nums">
              {summary.toImport} transaksi akan diimport
              {summary.transfers ? ` · ${summary.transfers} transfer` : ""}
            </p>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={learnRules}
                onChange={(e) => setLearnRules(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              <span className="sm:hidden">Ingat koreksi</span>
              <span className="hidden sm:inline">Ingat kategori yang kuubah untuk import berikutnya</span>
            </label>
          </div>
          <div className="flex gap-2">
            <form action={discardDraft.bind(null, batch.id)}>
              <Button type="submit" variant="ghost" disabled={pending}>
                Buang
              </Button>
            </form>
            <Button
              className="flex-1 sm:flex-none"
              onClick={commit}
              disabled={pending || summary.toImport === 0 || invalidNames || allSkipped}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Mengimport…
                </>
              ) : (
                `Import ${summary.toImport} transaksi`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
