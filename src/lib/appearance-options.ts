// Ikon & warna yang bisa dipilih untuk dompet/kategori. Disimpan di DB sebagai key string.
import {
  Baby,
  BadgePercent,
  Banknote,
  Briefcase,
  Bus,
  Car,
  CircleDollarSign,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  Music,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

export const ICONS = {
  wallet: Wallet,
  landmark: Landmark,
  "credit-card": CreditCard,
  smartphone: Smartphone,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  coins: Coins,
  "circle-dollar": CircleDollarSign,
  "hand-coins": HandCoins,
  briefcase: Briefcase,
  sparkles: Sparkles,
  percent: Percent,
  "badge-percent": BadgePercent,
  utensils: Utensils,
  coffee: Coffee,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  store: Store,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  house: House,
  zap: Zap,
  wifi: Wifi,
  receipt: Receipt,
  repeat: Repeat,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  laptop: Laptop,
  gamepad: Gamepad2,
  film: Film,
  music: Music,
  shirt: Shirt,
  gift: Gift,
  "hand-heart": HandHeart,
  users: Users,
  baby: Baby,
  "paw-print": PawPrint,
  wrench: Wrench,
  tag: Tag,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export const ICON_KEYS = Object.keys(ICONS) as IconKey[];

export function getIcon(key: string): LucideIcon {
  return (ICONS as Record<string, LucideIcon>)[key] ?? Tag;
}

/** Warna cukup jenuh supaya terbaca di keempat tema; dipakai sebagai var(--c) + color-mix. */
export const COLORS = {
  terracotta: "oklch(0.62 0.15 42)",
  amber: "oklch(0.75 0.15 72)",
  lime: "oklch(0.7 0.16 128)",
  emerald: "oklch(0.64 0.14 160)",
  teal: "oklch(0.66 0.11 190)",
  sky: "oklch(0.68 0.13 230)",
  blue: "oklch(0.58 0.16 255)",
  indigo: "oklch(0.56 0.17 280)",
  violet: "oklch(0.6 0.18 305)",
  rose: "oklch(0.63 0.18 12)",
  stone: "oklch(0.58 0.04 60)",
  slate: "oklch(0.58 0.03 255)",
} as const;

export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export function getColor(key: string): string {
  return (COLORS as Record<string, string>)[key] ?? COLORS.slate;
}
