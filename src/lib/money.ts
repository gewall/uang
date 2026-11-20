// Uang disimpan sebagai integer satuan terkecil (sen, ×100) — bigint di DB, number di JS.
// Number.MAX_SAFE_INTEGER sen ≈ 90 triliun rupiah, jauh di atas kebutuhan.

export const CURRENCIES = ["IDR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MINOR_PER_UNIT = 100;

const LOCALE = "id-ID";

type FormatOptions = {
  /** "auto": IDR tanpa desimal, USD 2 desimal. "exact": tampilkan sen bila ada. */
  precision?: "auto" | "exact";
  /** tampilkan tanda + untuk nilai positif */
  signed?: boolean;
  /** 1,2 jt / 350 rb */
  compact?: boolean;
};

export function toMinor(units: number): number {
  return Math.round(units * MINOR_PER_UNIT);
}

export function fromMinor(minor: number): number {
  return minor / MINOR_PER_UNIT;
}

export function formatMoney(minor: number, currency: Currency = "IDR", opts: FormatOptions = {}): string {
  const units = fromMinor(minor);
  const signDisplay = opts.signed ? "exceptZero" : "auto";

  if (opts.compact) {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
      signDisplay,
    }).format(units);
  }

  const hasFraction = minor % MINOR_PER_UNIT !== 0;
  const decimals = currency === "IDR" ? (opts.precision === "exact" && hasFraction ? 2 : 0) : 2;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay,
  }).format(units);
}

/** Angka tanpa simbol mata uang, untuk mengisi ulang input (mis. 1.500.000 atau 1.500.000,50). */
export function formatMoneyInput(minor: number): string {
  const hasFraction = minor % MINOR_PER_UNIT !== 0;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}

const SUFFIX: Record<string, number> = {
  rb: 1e3,
  ribu: 1e3,
  k: 1e3,
  jt: 1e6,
  juta: 1e6,
  m: 1e9,
  miliar: 1e9,
  milyar: 1e9,
};

/**
 * Parse input uang gaya Indonesia → satuan sen. Mengembalikan null bila tidak valid.
 * Contoh: "1.500.000" → 150000000, "1.500.000,50" → 150000050, "50rb" → 5000000,
 * "1,5jt" → 150000000, "Rp 25.000" → 2500000, "-200.000" → -20000000, "12.5" → 1250.
 */
export function parseMoneyInput(raw: string): number | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  s = s.replace(/^rp\.?/, "").replace(/^(us)?\$/, "");

  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  let multiplier = 1;
  const suffix = /([a-z]+)$/.exec(s)?.[1];
  if (suffix) {
    if (!(suffix in SUFFIX)) return null;
    multiplier = SUFFIX[suffix];
    s = s.slice(0, -suffix.length);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  let normalized: string;
  if (s.includes(",")) {
    // koma = desimal, titik = pemisah ribuan
    if (s.indexOf(",") !== s.lastIndexOf(",")) return null;
    const [intPart, frac] = s.split(",");
    if (!validThousands(intPart)) return null;
    normalized = `${intPart.replace(/\./g, "")}.${frac}`;
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length > 0 && last.length <= 2 && !suffix) {
      normalized = s; // "12.5" → desimal
    } else if (parts.length === 2 && suffix) {
      normalized = s; // "1.5jt"
    } else {
      if (!validThousands(s)) return null;
      normalized = s.replace(/\./g, "");
    }
  } else {
    normalized = s;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const minor = Math.round(value * multiplier * MINOR_PER_UNIT) * sign;
  return Number.isSafeInteger(minor) ? minor : null;
}

function validThousands(s: string): boolean {
  if (!s.includes(".")) return /^\d*$/.test(s);
  return /^\d{1,3}(\.\d{3})+$/.test(s);
}
