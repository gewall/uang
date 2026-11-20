import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Rekomendasi AI" };

export default function Page() {
  return (
    <ComingSoon
      title="Rekomendasi AI"
      description="Minta saran pembagian budget dan analisis keuangan dari AI."
      phase={9}
      icon={Sparkles}
    />
  );
}
