import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Halo, {user.username}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Ringkasan keuangan akan tampil di sini (Fase 5).</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
