"use client";

import { Check } from "lucide-react";
import { MODE_OPTIONS, useAppearance } from "@/components/app-shell/theme-switcher";
import type { Palette } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Preview statis tiap palet (light & dark) — warna literal supaya tidak ikut tema yang sedang aktif.
const PREVIEWS: Record<Palette, { label: string; desc: string; light: string[]; dark: string[] }> = {
  warm: {
    label: "Warm",
    desc: "Krem, terakota, amber",
    light: ["oklch(0.982 0.012 82)", "oklch(0.6 0.15 42)", "oklch(0.76 0.14 74)", "oklch(0.895 0.025 72)"],
    dark: ["oklch(0.195 0.014 52)", "oklch(0.76 0.14 66)", "oklch(0.66 0.15 40)", "oklch(0.33 0.02 52)"],
  },
  cold: {
    label: "Cold",
    desc: "Slate, biru, teal",
    light: ["oklch(0.982 0.006 240)", "oklch(0.53 0.15 250)", "oklch(0.65 0.11 190)", "oklch(0.9 0.015 242)"],
    dark: ["oklch(0.185 0.025 258)", "oklch(0.76 0.12 218)", "oklch(0.72 0.11 180)", "oklch(0.325 0.03 258)"],
  },
};

function MiniPreview({ colors }: { colors: string[] }) {
  const [bg, primary, secondary, border] = colors;
  return (
    <div
      className="flex h-16 flex-1 flex-col gap-1.5 rounded-md p-2"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="h-2 w-1/2 rounded-full" style={{ background: primary }} />
      <div className="flex flex-1 items-end gap-1">
        {[60, 85, 45, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${h}%`, background: i % 2 ? secondary : primary, opacity: 0.85 }}
          />
        ))}
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { palette, mode, update } = useAppearance();

  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">Palet warna</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PREVIEWS) as Palette[]).map((p) => {
            const preview = PREVIEWS[p];
            const selected = palette === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ palette: p })}
                className={cn(
                  "relative grid gap-3 rounded-xl border bg-card p-3 text-left transition-all outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring",
                  selected && "border-primary ring-2 ring-primary/30",
                )}
              >
                <div className="flex gap-2">
                  <MiniPreview colors={preview.light} />
                  <MiniPreview colors={preview.dark} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{preview.label}</p>
                    <p className="text-xs text-muted-foreground">{preview.desc}</p>
                  </div>
                  {selected && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Mode</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto">
          {MODE_OPTIONS.map((o) => {
            const selected = mode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ mode: o.value })}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  selected && "bg-background text-foreground shadow-sm",
                )}
              >
                <o.icon className="size-4 shrink-0" />
                <span className="sm:hidden">{o.short}</span>
                <span className="hidden sm:inline">{o.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
