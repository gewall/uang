import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Investasi" };

export default function Page() {
  return <ComingSoon title="Investasi" description="Saham, reksa dana, emas, dan aset lain beserta untung/ruginya." phase={6} icon={TrendingUp} />;
}
