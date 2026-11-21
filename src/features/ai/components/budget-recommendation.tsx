"use client";

import { Check, Loader2, PiggyBank, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMonth } from "@/lib/dates";
import { formatMoney, MINOR_PER_UNIT } from "@/lib/money";
import { applyBudgetRecommendation, type BudgetRecommendationResult, recommendBudget } from "../actions";

type Success = Extract<BudgetRecommendationResult, { ok: true }>;

export function BudgetRecommendation({ nextMonthLabel, avgIncome }: { nextMonthLabel: string; avgIncome: number }) {
  const [result, setResult] = useState<Success | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoad] = useTransition();
  const [applying, startApply] = useTransition();
  const [applied, setApplied] = useState(false);

  const run = () =>
    startLoad(async () => {
      setApplied(false);
      const res = await recommendBudget();
      if (!res.ok) return void toast.error(res.message);
      setResult(res);
      setSelected(new Set(res.matched.map((m) => m.categoryId)));
    });

  const total = result?.matched.filter((m) => selected.has(m.categoryId)).reduce((n, m) => n + m.amount, 0) ?? 0;
  const saving = result ? Math.round(result.recommendation.targetTabungan) * MINOR_PER_UNIT : 0;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="size-4.5 text-primary" /> Rekomendasi pembagian budget
        </CardTitle>
        <CardDescription className="tabular-nums">
          AI menyusun batas per kategori untuk {nextMonthLabel} dari rata-rata pemasukan {formatMoney(avgIncome)}/bulan
          dan pola pengeluaranmu.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!result ? (
          <Button onClick={run} disabled={loading} className="justify-self-start max-sm:w-full">
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Menyusun rekomendasi…" : "Buat rekomendasi"}
          </Button>
        ) : (
          <>
            <p className="text-sm text-pretty">{result.recommendation.ringkasan}</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 font-medium">Kategori</th>
                    <th className="px-2 py-2 text-right font-medium">Batas/bulan</th>
                    <th className="hidden px-2 py-2 font-medium sm:table-cell">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matched.map((m) => (
                    <tr key={m.categoryId} className="border-b last:border-0 align-top">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Pakai ${m.name}`}
                          className="size-4 accent-primary"
                          checked={selected.has(m.categoryId)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(m.categoryId);
                            else next.delete(m.categoryId);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{m.reason}</p>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(m.amount)}</td>
                      <td className="hidden px-2 py-2 text-xs text-muted-foreground sm:table-cell">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm tabular-nums">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Total budget terpilih</span> <b>{formatMoney(total)}</b>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Target tabungan</span> <b>{formatMoney(saving)}</b>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Sisa dari rata-rata pemasukan</span>
                <b className={avgIncome - total - saving < 0 ? "text-expense" : ""}>
                  {formatMoney(avgIncome - total - saving)}
                </b>
              </p>
            </div>
            {result.recommendation.tips.length > 0 && (
              <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                {result.recommendation.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {result.unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dilewati (kategori tidak dikenal): {result.unmatched.join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 *:max-sm:flex-1">
              {applied ? (
                <Button render={<Link href={`/budget?bulan=${result.month}`} />} nativeButton={false}>
                  <Check /> Lihat budget {formatMonth(result.month)}
                </Button>
              ) : (
                <Button
                  disabled={applying || selected.size === 0}
                  onClick={() =>
                    startApply(async () => {
                      const res = await applyBudgetRecommendation({
                        month: result.month,
                        items: result.matched
                          .filter((m) => selected.has(m.categoryId))
                          .map((m) => ({ categoryId: m.categoryId, amount: m.amount })),
                      });
                      if (res.ok) {
                        toast.success(res.message);
                        setApplied(true);
                      } else toast.error(res.message);
                    })
                  }
                >
                  {applying ? <Loader2 className="animate-spin" /> : <Check />} Terapkan ke budget{" "}
                  {formatMonth(result.month)}
                </Button>
              )}
              <Button variant="outline" onClick={run} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Buat ulang
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
