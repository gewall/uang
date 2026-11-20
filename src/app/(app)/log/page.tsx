import { History } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Log aktivitas" };

export default function Page() {
  return (
    <ComingSoon
      title="Log aktivitas"
      description="Riwayat semua perubahan dan aktivitas akun."
      phase={7}
      icon={History}
    />
  );
}
