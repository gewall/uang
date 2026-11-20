"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActivePath, NAV_GROUPS } from "./nav-config";

export function AppSidebar({ footer }: { footer: ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar();
  // di mobile sidebar berupa sheet: tutup setelah memilih menu
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" onClick={closeOnMobile} />} tooltip="uang">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Coins className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="font-semibold">uang</span>
                <span className="text-xs text-sidebar-foreground/70">keuangan pribadi</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* usePathname di route dinamis (mis. /investasi/[id]) baru diketahui saat request →
            batas Suspense supaya sisa layout tetap di-prerender; fallback = menu tanpa status aktif */}
        <Suspense fallback={<SidebarNav pathname={null} />}>
          <ActiveSidebarNav />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActiveSidebarNav() {
  return <SidebarNav pathname={usePathname()} />;
}

function SidebarNav({ pathname }: { pathname: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => isMobile && setOpenMobile(false);
  return NAV_GROUPS.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname ? isActivePath(pathname, item.href) : false}
                tooltip={item.title}
                render={<Link href={item.href} onClick={closeOnMobile} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
