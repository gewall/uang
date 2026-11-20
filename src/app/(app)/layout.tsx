import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/dal";

// Shell sementara (Fase 1). Sidebar + tema Warm/Cold menyusul di Fase 2.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-4 border-b px-4">
        <Link href="/dashboard" className="font-semibold">
          uang
        </Link>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            Pengaturan
          </Link>
        </nav>
        <div className="ml-auto">
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{user.username}</span>
      <Button type="submit" variant="outline" size="sm">
        Keluar
      </Button>
    </form>
  );
}
