import { ArrowDownLeft, ArrowUpRight, Landmark, PiggyBank } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

// Kartu ringkasan masih kosong; angka asli diisi di Fase 5.
const STATS = [
  { label: "Kekayaan bersih", icon: Landmark, tone: "text-primary" },
  { label: "Pemasukan", icon: ArrowDownLeft, tone: "text-income" },
  { label: "Pengeluaran", icon: ArrowUpRight, tone: "text-expense" },
  { label: "Sisa budget", icon: PiggyBank, tone: "text-warning" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="grid gap-6">
      <PageHeader title={`Halo, ${user.username}`} description="Ringkasan keuanganmu bulan ini." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {STATS.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="grid gap-1.5">
              <p className="flex items-start gap-1.5 text-sm leading-tight text-muted-foreground">
                <s.icon className={`mt-px size-4 shrink-0 ${s.tone}`} />
                <span>{s.label}</span>
              </p>
              <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">Rp —</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arus kas</CardTitle>
          <CardDescription>Grafik pemasukan vs pengeluaran 6 bulan terakhir tampil di sini (Fase 5).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg border border-dashed bg-muted/40 sm:h-64" />
        </CardContent>
      </Card>
    </div>
  );
}
