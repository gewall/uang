import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Dompet" };

export default function Page() {
  return <ComingSoon title="Dompet" description="Rekening bank, e-wallet, dan uang tunai beserta saldonya." phase={3} icon={Wallet} />;
}
