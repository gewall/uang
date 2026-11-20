import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  phase,
  icon: Icon,
}: {
  title: string;
  description: string;
  phase: number;
  icon: LucideIcon;
}) {
  return (
    <div className="grid gap-6">
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center sm:py-16">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icon className="size-6" />
          </span>
          <p className="font-medium">Segera hadir</p>
          <p className="max-w-sm text-sm text-muted-foreground">Fitur ini dikerjakan di Fase {phase}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
