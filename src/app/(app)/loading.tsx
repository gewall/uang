import { Skeleton } from "@/components/ui/skeleton";

// Batas <Suspense> untuk semua halaman app (semuanya membaca session/DB saat request).
export default function Loading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}
