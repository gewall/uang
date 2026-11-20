import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { currentMonth, formatMonth, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Navigasi bulan berbasis link (?bulan=YYYY-MM). Bulan berjalan tidak ditulis di URL. */
export function MonthNav({ month, basePath, className }: { month: string; basePath: string; className?: string }) {
  const href = (m: string) => (m === currentMonth() ? basePath : `${basePath}?bulan=${m}`);
  const isCurrent = month === currentMonth();
  return (
    <div className={cn("flex items-center justify-between rounded-lg border bg-card", className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Bulan sebelumnya"
        render={<Link href={href(shiftMonth(month, -1))} scroll={false} />}
        nativeButton={false}
      >
        <ChevronLeft />
      </Button>
      <div className="flex min-w-36 flex-1 flex-col items-center px-1 leading-tight">
        <span className="text-sm font-medium tabular-nums">{formatMonth(month)}</span>
        {!isCurrent && (
          <Link href={basePath} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            ke bulan ini
          </Link>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Bulan berikutnya"
        render={<Link href={href(shiftMonth(month, 1))} scroll={false} />}
        nativeButton={false}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
