// Konstanta tema yang dipakai bersama oleh server (inline script, Server Action) dan client (useTheme).

export const PALETTES = ["warm", "cold"] as const;
export const MODES = ["light", "dark", "system"] as const;
export type Palette = (typeof PALETTES)[number];
export type Mode = (typeof MODES)[number];

export const PALETTE_COOKIE = "uang_palette";
export const MODE_COOKIE = "uang_mode";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_PALETTE: Palette = "warm";
export const DEFAULT_MODE: Mode = "system";

export function isPalette(v: unknown): v is Palette {
  return typeof v === "string" && (PALETTES as readonly string[]).includes(v);
}
export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

/**
 * Dijalankan sinkron di <head> sebelum paint: baca cookie → pasang data-palette, class "dark",
 * dan color-scheme di <html>. Root layout tetap statis (tidak membaca cookies() di server),
 * sesuai panduan "preventing flash before hydration" Next.js.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,c=document.cookie;var p=(c.match(/(?:^|; )${PALETTE_COOKIE}=(warm|cold)/)||[])[1]||"${DEFAULT_PALETTE}";var m=(c.match(/(?:^|; )${MODE_COOKIE}=(light|dark|system)/)||[])[1]||"${DEFAULT_MODE}";var k=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);d.setAttribute("data-palette",p);d.classList.toggle("dark",k);d.style.colorScheme=k?"dark":"light"}catch(e){}})()`;
