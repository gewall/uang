import { PiggyBank } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Budget" };

export default function Page() {
  return <ComingSoon title="Budget" description="Atur batas pengeluaran per kategori setiap bulan." phase={5} icon={PiggyBank} />;
}
