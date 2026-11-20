import type { WalletType } from "@/db/schema";
import type { ColorKey, IconKey } from "@/lib/appearance-options";

export const WALLET_TYPES: Record<WalletType, { label: string; icon: IconKey; color: ColorKey }> = {
  bank: { label: "Rekening bank", icon: "landmark", color: "blue" },
  ewallet: { label: "E-wallet", icon: "smartphone", color: "sky" },
  cash: { label: "Tunai", icon: "banknote", color: "emerald" },
  credit: { label: "Kartu kredit / paylater", icon: "credit-card", color: "rose" },
  investment: { label: "Rekening investasi", icon: "trending-up", color: "teal" },
  other: { label: "Lainnya", icon: "wallet", color: "slate" },
};

export const WALLET_TYPE_KEYS = Object.keys(WALLET_TYPES) as WalletType[];
