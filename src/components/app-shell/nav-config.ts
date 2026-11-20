import {
  ArrowLeftRight,
  Download,
  History,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Settings,
  Sparkles,
  Tags,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Keuangan",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Transaksi", href: "/transaksi", icon: ArrowLeftRight },
      { title: "Dompet", href: "/dompet", icon: Wallet },
      { title: "Budget", href: "/budget", icon: PiggyBank },
      { title: "Investasi", href: "/investasi", icon: TrendingUp },
      { title: "Kategori", href: "/kategori", icon: Tags },
    ],
  },
  {
    label: "Alat",
    items: [
      { title: "Rekomendasi AI", href: "/ai", icon: Sparkles },
      { title: "Import", href: "/import", icon: Upload },
      { title: "Export", href: "/export", icon: Download },
    ],
  },
  {
    label: "Sistem",
    items: [
      { title: "Log aktivitas", href: "/log", icon: History },
      { title: "Pengaturan", href: "/settings", icon: Settings },
    ],
  },
];

/** Item di bottom nav mobile (selain tombol + dan Menu). */
export const MOBILE_NAV: NavItem[] = [
  NAV_GROUPS[0].items[0], // Dashboard
  NAV_GROUPS[0].items[1], // Transaksi
  NAV_GROUPS[0].items[3], // Budget
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((g) => g.items).find((i) => isActivePath(pathname, i.href));
}
