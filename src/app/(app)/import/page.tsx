import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Import" };

export default function Page() {
  return (
    <ComingSoon
      title="Import"
      description="Import mutasi dari PDF Bank Jago atau file CSV/Excel."
      phase={8}
      icon={Upload}
    />
  );
}
