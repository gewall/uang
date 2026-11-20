import "server-only";
import { cookies } from "next/headers";
import { MODE_COOKIE, type Mode, PALETTE_COOKIE, type Palette, THEME_COOKIE_MAX_AGE } from "./theme";

/** Set cookie tema (dibaca inline script di <head>). Hanya dari Server Action / Route Handler. */
export async function setThemeCookies(palette: Palette, mode: Mode) {
  const store = await cookies();
  // tidak httpOnly: client (useTheme) juga menulis cookie ini
  const opts = { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" as const, httpOnly: false };
  store.set(PALETTE_COOKIE, palette, opts);
  store.set(MODE_COOKIE, mode, opts);
}
