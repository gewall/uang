import { type CSSProperties, createElement } from "react";
import { getColor, getIcon } from "@/lib/appearance-options";
import { cn } from "@/lib/utils";

/** Bubble ikon berwarna untuk dompet/kategori. Latar = warna 15% transparan, ikon = warna penuh. */
export function EntityIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ "--c": getColor(color) } as CSSProperties}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--c)_16%,transparent)] text-(--c)",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-4.5",
        size === "lg" && "size-11 rounded-xl [&_svg]:size-5.5",
        className,
      )}
    >
      {/* lookup komponen statis dari map, bukan komponen baru per render */}
      {createElement(getIcon(icon))}
    </span>
  );
}
