import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { investmentAssets, transactions, wallets } from "@/db/schema";
import { ExportView } from "@/features/export/components/export-view";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Export" };

export default async function ExportPage() {
  const user = await requireUser();
  const [w, t, a] = await Promise.all([
    db.$count(wallets, eq(wallets.userId, user.id)),
    db.$count(transactions, eq(transactions.userId, user.id)),
    db.$count(investmentAssets, eq(investmentAssets.userId, user.id)),
  ]);
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Export"
        description="Unduh datamu ke Excel, CSV, atau backup lengkap — dan pulihkan kembali."
      />
      <ExportView accountEmpty={w + t + a === 0} />
    </div>
  );
}
