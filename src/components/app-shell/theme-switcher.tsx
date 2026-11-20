"use client";

import { Moon, Palette as PaletteIcon, Sun, SunMoon } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveAppearance } from "@/features/settings/actions";
import { useTheme } from "@/hooks/use-theme";
import { isMode, isPalette, type Mode, type Palette } from "@/lib/theme";

export const PALETTE_OPTIONS: { value: Palette; label: string; swatch: string }[] = [
  { value: "warm", label: "Warm", swatch: "bg-[oklch(0.6_0.15_42)]" },
  { value: "cold", label: "Cold", swatch: "bg-[oklch(0.53_0.15_250)]" },
];

export const MODE_OPTIONS: { value: Mode; label: string; short: string; icon: typeof Sun }[] = [
  { value: "light", label: "Terang", short: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", short: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti sistem", short: "Sistem", icon: SunMoon },
];

/** Ubah tema seketika (cookie + DOM), lalu simpan ke akun di background. */
export function useAppearance() {
  const theme = useTheme();
  const [, startTransition] = useTransition();
  const update = (next: { palette?: Palette; mode?: Mode }) => {
    theme.setTheme(next);
    const palette = next.palette ?? theme.palette;
    const mode = next.mode ?? theme.mode;
    startTransition(() => saveAppearance({ palette, mode }).catch(() => {}));
  };
  return { ...theme, update };
}

export function ThemeSwitcher() {
  const { palette, mode, resolved, update } = useAppearance();
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Ganti tema" />}>
        <Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <PaletteIcon className="size-3.5" /> Palet
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={palette} onValueChange={(v) => isPalette(v) && update({ palette: v })}>
            {PALETTE_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                <span className={`size-3 rounded-full ${o.swatch}`} aria-hidden />
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(v) => isMode(v) && update({ mode: v })}>
            {MODE_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                <o.icon />
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
