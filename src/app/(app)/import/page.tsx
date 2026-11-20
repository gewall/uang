import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ImportHistory } from "@/features/import/components/import-history";
import { UploadCard } from "@/features/import/components/upload-card";
import { listBatches } from "@/features/import/queries";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const user = await requireUser();
  const { hasil } = await searchParams;
  const batches = await listBatches(user.id);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Import"
        description="Masukkan mutasi dari PDF Bank Jago atau file CSV/Excel. Kamu tinjau dulu sebelum disimpan."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <UploadCard kind="jago" />
        <UploadCard kind="table" />
      </div>
      <ImportHistory batches={batches} highlight={typeof hasil === "string" ? hasil : undefined} />
    </div>
  );
}
