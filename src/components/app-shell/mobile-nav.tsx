"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { isActivePath, MOBILE_NAV } from "./nav-config";

const itemClass =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95 data-[active=true]:text-primary";

/** Bottom navigation khusus layar < md. Tombol + di tengah untuk tambah transaksi cepat. */
export function MobileNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [first, second, third] = MOBILE_NAV;

  const link = (item: (typeof MOBILE_NAV)[number]) => (
    <Link
      key={item.href}
      href={item.href}
      className={itemClass}
      data-active={isActivePath(pathname, item.href)}
      aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
    >
      <item.icon className="size-5" />
      <span className="truncate">{item.title}</span>
    </Link>
  );

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-safe backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {link(first)}
        {link(second)}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/transaksi?baru=1"
            aria-label="Tambah transaksi"
            className={cn(
              "flex size-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95",
            )}
          >
            <Plus className="size-6" />
          </Link>
        </div>
        {link(third)}
        <button type="button" className={itemClass} onClick={() => setOpenMobile(true)}>
          <Menu className="size-5" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
