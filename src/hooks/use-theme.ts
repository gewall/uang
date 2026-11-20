"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  isMode,
  isPalette,
  MODE_COOKIE,
  type Mode,
  PALETTE_COOKIE,
  type Palette,
  THEME_COOKIE_MAX_AGE,
} from "@/lib/theme";

export type ThemeState = {
  palette: Palette;
  mode: Mode;
  /** mode yang benar-benar dipakai (system sudah di-resolve) */
  resolved: "light" | "dark";
};

// Store kecil di level modul. Sumber kebenaran = cookie (dibaca juga oleh inline script di <head>).
const SERVER_SNAPSHOT: ThemeState = { palette: DEFAULT_PALETTE, mode: DEFAULT_MODE, resolved: "light" };
const listeners = new Set<() => void>();
let snapshot: ThemeState | null = null;
let media: MediaQueryList | null = null;

function readCookie(name: string): string | undefined {
  return document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
}

function systemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function compute(palette: Palette, mode: Mode): ThemeState {
  const resolved = mode === "dark" || (mode === "system" && systemDark()) ? "dark" : "light";
  return { palette, mode, resolved };
}

function getSnapshot(): ThemeState {
  if (!snapshot) {
    const p = readCookie(PALETTE_COOKIE);
    const m = readCookie(MODE_COOKIE);
    snapshot = compute(isPalette(p) ? p : DEFAULT_PALETTE, isMode(m) ? m : DEFAULT_MODE);
  }
  return snapshot;
}

function applyToDocument(state: ThemeState, animate: boolean) {
  const root = document.documentElement;
  if (animate) root.classList.add("theme-transition");
  root.setAttribute("data-palette", state.palette);
  root.classList.toggle("dark", state.resolved === "dark");
  root.style.colorScheme = state.resolved;
  // warna address bar di mobile mengikuti background tema
  const bg = getComputedStyle(document.body).backgroundColor;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = bg;
  if (animate) window.setTimeout(() => root.classList.remove("theme-transition"), 250);
}

function emit() {
  for (const l of listeners) l();
}

function onSystemChange() {
  const s = getSnapshot();
  if (s.mode !== "system") return;
  snapshot = compute(s.palette, s.mode);
  applyToDocument(snapshot, true);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!media) {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onSystemChange);
    applyToDocument(getSnapshot(), false); // sinkronkan meta theme-color saat pertama mount
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && media) {
      media.removeEventListener("change", onSystemChange);
      media = null;
    }
  };
}

export function setTheme(next: Partial<Pick<ThemeState, "palette" | "mode">>) {
  const current = getSnapshot();
  snapshot = compute(next.palette ?? current.palette, next.mode ?? current.mode);
  const attrs = `; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = `${PALETTE_COOKIE}=${snapshot.palette}${attrs}`;
  document.cookie = `${MODE_COOKIE}=${snapshot.mode}${attrs}`;
  applyToDocument(snapshot, true);
  emit();
}

/** Baca & ubah tema. Saat SSR/hydration mengembalikan default, lalu sinkron ke nilai cookie. */
export function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  return { ...state, setTheme };
}
