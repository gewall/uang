"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type CashflowPoint = { month: string; income: number; expense: number };

// Warna: token --chart-income / --chart-expense (divalidasi dataviz untuk buta warna di 4 tema).
const config = {
  income: { label: "Pemasukan", color: "var(--chart-income)" },
  expense: { label: "Pengeluaran", color: "var(--chart-expense)" },
} satisfies ChartConfig;

const shortMonth = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" });
const monthLabel = (m: string) => shortMonth.format(new Date(`${m}-15T12:00:00+07:00`));

/** Grouped column: pemasukan vs pengeluaran per bulan. Hover = tooltip per bulan; ada tampilan tabel. */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  // recharts memakai Rupiah (bukan sen); key harus sama dengan key di `config`
  const rows = data.map((d) => ({
    month: d.month,
    label: monthLabel(d.month),
    income: d.income / 100,
    expense: d.expense / 100,
  }));
  const empty = data.every((d) => d.income === 0 && d.expense === 0);

  return (
    <div className="grid gap-2">
      {/* legend statis dengan urutan tetap (sama dengan urutan batang); legend recharts mengurutkan ulang */}
      <div className="flex items-center justify-between gap-2">
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legenda">
          {(["income", "expense"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: config[k].color }} aria-hidden />
              {config[k].label}
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
          aria-pressed={view === "table"}
        >
          {view === "chart" ? <Table2 /> : <BarChart3 />}
          {view === "chart" ? "Lihat tabel" : "Lihat grafik"}
        </Button>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Bulan</th>
                <th className="py-2 text-right font-medium">Pemasukan</th>
                <th className="py-2 text-right font-medium">Pengeluaran</th>
                <th className="py-2 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-b last:border-0">
                  <td className="py-2">{formatMonth(d.month)}</td>
                  <td className="py-2 text-right">{formatMoney(d.income)}</td>
                  <td className="py-2 text-right">{formatMoney(d.expense)}</td>
                  <td className="py-2 text-right">{formatMoney(d.income - d.expense, "IDR", { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : empty ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground sm:h-64">
          Belum ada transaksi dalam 6 bulan terakhir.
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-56 w-full sm:h-64">
          <BarChart data={rows} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            {/* grid: hairline solid, hanya horizontal */}
            <CartesianGrid vertical={false} strokeDasharray="0" strokeOpacity={0.6} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickCount={4}
              tickFormatter={(v: number) =>
                new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(v)
              }
            />
            <ChartTooltip
              cursor={{ fillOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const m = payload?.[0]?.payload?.month as string | undefined;
                    return m ? formatMonth(m) : "";
                  }}
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2.5 rounded-[2px]" style={{ background: `var(--color-${name})` }} />
                        {name === "income" ? "Pemasukan" : "Pengeluaran"}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatMoney(Math.round(Number(value) * 100))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {/* kolom ≤24px, ujung data membulat 4px, rata di baseline */}
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
