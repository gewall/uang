import type { AssetType } from "@/db/schema";
import type { ColorKey, IconKey } from "@/lib/appearance-options";

/**
 * `slot` = urutan warna kategorikal tetap (--cat-1..7, palet tervalidasi dataviz).
 * Warna mengikuti entitas (jenis aset), bukan peringkat nilainya.
 */
export const ASSET_TYPES: Record<
  AssetType,
  { label: string; icon: IconKey; color: ColorKey; unit: string; slot: number }
> = {
  saham: { label: "Saham", icon: "trending-up", color: "blue", unit: "lembar", slot: 1 },
  reksadana: { label: "Reksa dana", icon: "piggy-bank", color: "terracotta", unit: "unit", slot: 2 },
  emas: { label: "Emas", icon: "coins", color: "amber", unit: "gram", slot: 3 },
  crypto: { label: "Kripto", icon: "circle-dollar", color: "violet", unit: "koin", slot: 4 },
  deposito: { label: "Deposito", icon: "landmark", color: "teal", unit: "unit", slot: 5 },
  obligasi: { label: "Obligasi / SBN", icon: "receipt", color: "emerald", unit: "unit", slot: 6 },
  lainnya: { label: "Lainnya", icon: "briefcase", color: "slate", unit: "unit", slot: 7 },
};

export const ASSET_TYPE_KEYS = Object.keys(ASSET_TYPES) as AssetType[];

export const INVESTMENT_TXN_LABEL = { buy: "Beli", sell: "Jual", dividend: "Dividen / bunga" } as const;
