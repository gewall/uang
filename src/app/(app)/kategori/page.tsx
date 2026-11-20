import { Tags } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Kategori" };

export default function Page() {
  return <ComingSoon title="Kategori" description="Kelompokkan pemasukan dan pengeluaran." phase={3} icon={Tags} />;
}
