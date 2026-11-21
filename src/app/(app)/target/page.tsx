import type { Metadata } from "next";
import { GoalsView } from "@/features/goals/components/goals-view";
import { listGoals } from "@/features/goals/queries";
import { listWalletOptions } from "@/features/wallets/queries";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Target tabungan" };

export default async function GoalsPage() {
  const user = await requireUser();
  const [goals, wallets] = await Promise.all([listGoals(user.id), listWalletOptions(user.id)]);
  return (
    <div className="grid gap-5">
      <GoalsView goals={goals} wallets={wallets} />
    </div>
  );
}
