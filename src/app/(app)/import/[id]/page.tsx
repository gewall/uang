import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { listCategoryTree } from "@/features/categories/queries";
import { ImportReview } from "@/features/import/components/import-review";
import { getBatch, getPlanContext, suggestMappings } from "@/features/import/queries";
import { listWallets } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";
import type { PocketMapping } from "@/lib/import/plan";

export const metadata: Metadata = { title: "Tinjau import" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImportReviewPage({ params }: PageProps<"/import/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const batch = await getBatch(user.id, id);
  if (!batch) notFound();
  if (batch.status !== "draft") redirect(`/import?hasil=${batch.id}`);

  const [ctx, wallets, categories] = await Promise.all([
    getPlanContext(user.id, batch.source),
    listWallets(user.id),
    listCategoryTree(user.id),
  ]);

  let initialMappings: Record<string, PocketMapping>;
  if (batch.statement) {
    initialMappings = await suggestMappings(user.id, batch.statement);
  } else {
    // CSV/Excel: satu "kantong" → dompet aktif pertama (IDR) bila ada, selain itu dompet baru
    const first = wallets.find((w) => !w.archivedAt && w.currency === "IDR");
    initialMappings = {
      file: first
        ? { mode: "existing", walletId: first.id }
        : { mode: "new", name: batch.filename.replace(/\.\w+$/, "") },
    };
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Tinjau import"
        description={`${batch.filename}${batch.period ? ` · ${batch.period}` : ""} — belum ada yang disimpan sampai kamu menekan Import.`}
      />
      <ImportReview
        batch={{ id: batch.id, source: batch.source, filename: batch.filename }}
        statement={batch.statement}
        rawTable={batch.rawTable}
        ctx={ctx}
        initialMappings={initialMappings}
        wallets={wallets.map((w) => ({
          id: w.id,
          name: w.name,
          currency: w.currency,
          balance: w.balance,
          archivedAt: w.archivedAt,
        }))}
        categories={categories}
      />
    </div>
  );
}
