// Jumlah unit (saham, gram emas, koin kripto) — boleh pecahan sampai 8 desimal, format Indonesia.

export const MAX_UNIT_DECIMALS = 8;

/**
 * "1.000" → 1000, "2,5" → 2.5, "0,00123456" → 0.00123456, "1.234,5" → 1234.5, "0.5" → 0.5.
 * Titik tunggal diikuti tepat 3 digit dianggap pemisah ribuan (gaya Indonesia).
 */
export function parseQuantity(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  let normalized: string;
  if (s.includes(",")) {
    if (s.indexOf(",") !== s.lastIndexOf(",")) return null;
    const [int, frac] = s.split(",");
    if (int.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(int)) return null;
    normalized = `${int.replace(/\./g, "") || "0"}.${frac}`;
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      normalized = s.replace(/\./g, "");
    } else {
      normalized = parts[1].length === 3 && parts[0] !== "0" && parts[0] !== "" ? s.replace(".", "") : s;
    }
  } else {
    normalized = s;
  }

  const frac = normalized.split(".")[1] ?? "";
  if (frac.length > MAX_UNIT_DECIMALS) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const qtyFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: MAX_UNIT_DECIMALS });

/** 1234.5 → "1.234,5" */
export function formatQuantity(n: number): string {
  return qtyFmt.format(n);
}

/** Bulatkan ke 8 desimal (hindari 0.30000000000000004 saat menjumlah). */
export function roundUnits(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
