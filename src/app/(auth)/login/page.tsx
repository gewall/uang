import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">uang</CardTitle>
          <CardDescription>Masuk untuk mengelola keuanganmu.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

// Membaca cookie & searchParams → harus di dalam <Suspense> (cacheComponents).
async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const next = typeof params.next === "string" ? params.next : undefined;
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return <LoginForm next={next} />;
}

function FormSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-9" />
    </div>
  );
}
