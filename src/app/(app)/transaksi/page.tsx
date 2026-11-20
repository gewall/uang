import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Transaksi" };

export default function Page() {
  return <ComingSoon title="Transaksi" description="Catat pemasukan, pengeluaran, dan transfer antar dompet." phase={4} icon={ArrowLeftRight} />;
}
