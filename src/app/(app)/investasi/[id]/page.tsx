import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetDetailView } from "@/features/investments/components/asset-detail-view";
import { getAssetDetail } from "@/features/investments/queries";
import { listWalletOptions } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Detail aset" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssetPage({ params }: PageProps<"/investasi/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [detail, wallets] = await Promise.all([getAssetDetail(user.id, id), listWalletOptions(user.id)]);
  if (!detail) notFound();
  return <AssetDetailView detail={detail} wallets={wallets} />;
}
