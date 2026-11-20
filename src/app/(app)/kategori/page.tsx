import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CategoriesView } from "@/features/categories/components/categories-view";
import { listCategoryTree } from "@/features/categories/queries";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Kategori" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const tree = await listCategoryTree(user.id);

  return (
    <div className="grid gap-6">
      <PageHeader title="Kategori" description="Kelompokkan pemasukan dan pengeluaran, termasuk subkategori." />
      <CategoriesView tree={tree} />
    </div>
  );
}
