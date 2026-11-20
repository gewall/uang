import { Download } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Export" };

export default function Page() {
  return <ComingSoon title="Export" description="Unduh data ke CSV, Excel, atau backup JSON." phase={8} icon={Download} />;
}
