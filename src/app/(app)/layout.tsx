import { Suspense } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { HeaderTitle } from "@/components/app-shell/header-title";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarMenuSkeleton, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/dal";

// Shell statis (prerender) — hanya bagian yang membaca session yang di-stream di dalam <Suspense>.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          <Suspense fallback={<SidebarMenuSkeleton showIcon />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 md:rounded-t-xl md:px-4">
          {/* di mobile menu dibuka dari bottom nav, jadi trigger header hanya untuk md+ */}
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-1 hidden h-4 data-vertical:self-center md:block" />
          <Suspense fallback={<span className="text-sm font-medium">uang</span>}>
            <HeaderTitle />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <ThemeSwitcher />
          </div>
        </header>
        {/* pb ekstra di mobile supaya konten tidak tertutup bottom nav */}
        <div className="flex-1 p-4 pb-28 md:p-6 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}

async function SidebarUser() {
  const user = await requireUser();
  return <UserMenu username={user.username} />;
}
