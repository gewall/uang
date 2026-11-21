import {
  Archive,
  ChevronDown,
  Copy,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  type LucideIcon,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  type DescribedActivity,
  describeActivity,
  ENTITY_GROUPS,
  type EntityGroup,
} from "@/features/activity/describe";
import { type ActivityRow, listActivity, securitySummary } from "@/features/activity/queries";
import { requireUser } from "@/lib/auth/dal";
import { formatDayHeader, formatTime, wibDateKey } from "@/lib/dates";
import { describeUserAgent } from "@/lib/user-agent";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Log aktivitas" };

const ICONS: Record<DescribedActivity["icon"], LucideIcon> = {
  plus: Plus,
  pencil: Pencil,
  trash: Trash2,
  login: LogIn,
  logout: LogOut,
  shield: ShieldAlert,
  archive: Archive,
  key: KeyRound,
  copy: Copy,
  upload: Upload,
  download: Download,
  sparkles: Sparkles,
};

const TONE: Record<DescribedActivity["tone"], string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-[color-mix(in_oklch,var(--income)_15%,transparent)] text-income",
  danger: "bg-[color-mix(in_oklch,var(--expense)_15%,transparent)] text-expense",
  warning: "bg-[color-mix(in_oklch,var(--warning)_20%,transparent)] text-foreground",
};

const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function isGroup(v: unknown): v is EntityGroup {
  return typeof v === "string" && v in ENTITY_GROUPS;
}

export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const user = await requireUser();
  const params = await searchParams;
  const group = isGroup(params.jenis) ? params.jenis : undefined;
  const beforeRaw = typeof params.sebelum === "string" ? new Date(params.sebelum) : null;
  const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : undefined;

  const [{ items, nextCursor }, security] = await Promise.all([
    listActivity(user.id, { group, before }),
    securitySummary(user.id),
  ]);

  const href = (g?: EntityGroup, cursor?: Date) => {
    const p = new URLSearchParams();
    if (g) p.set("jenis", g);
    if (cursor) p.set("sebelum", cursor.toISOString());
    const s = p.toString();
    return s ? `/log?${s}` : "/log";
  };

  const groups = new Map<string, ActivityRow[]>();
  for (const r of items) {
    const key = wibDateKey(r.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Log aktivitas" description="Riwayat perubahan data dan aktivitas akunmu." />

      {/* ── ringkasan keamanan ── */}
      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <LogIn className="size-4.5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">Login sebelumnya</p>
              <p className="truncate text-muted-foreground">
                {security.previous
                  ? `${dateTime.format(security.previous.createdAt)}${security.previous.ip ? ` · IP ${security.previous.ip}` : ""}`
                  : "Belum ada riwayat login lain"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                security.failedLast7Days > 0 ? TONE.warning : TONE.positive,
              )}
            >
              {security.failedLast7Days > 0 ? (
                <ShieldAlert className="size-4.5" />
              ) : (
                <ShieldCheck className="size-4.5" />
              )}
            </span>
            <div className="text-sm">
              <p className="font-medium">
                {security.failedLast7Days > 0
                  ? `${security.failedLast7Days} percobaan login gagal`
                  : "Tidak ada percobaan login gagal"}
              </p>
              <p className="text-muted-foreground">
                7 hari terakhir ·{" "}
                <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
                  kelola sesi
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── filter jenis ── */}
      <nav
        aria-label="Filter jenis aktivitas"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {[undefined, ...(Object.keys(ENTITY_GROUPS) as EntityGroup[])].map((g) => {
          const active = g === group;
          return (
            <Link
              key={g ?? "semua"}
              href={href(g)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g ? ENTITY_GROUPS[g].label : "Semua"}
            </Link>
          );
        })}
      </nav>

      {/* ── timeline ── */}
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {before ? "Tidak ada aktivitas yang lebih lama." : "Belum ada aktivitas."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {[...groups.entries()].map(([day, rows]) => (
            <section key={day} aria-label={formatDayHeader(day)}>
              <h2 className="px-1 pb-1.5 text-sm font-medium text-muted-foreground">{formatDayHeader(day)}</h2>
              <Card size="sm" className="py-1">
                <ul className="divide-y">
                  {rows.map((r) => (
                    <ActivityItem key={r.id} row={r} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
          {nextCursor && (
            <Button
              variant="outline"
              className="justify-self-center"
              render={<Link href={href(group, nextCursor)} />}
              nativeButton={false}
            >
              Muat yang lebih lama
            </Button>
          )}
          {before && (
            <Link
              href={href(group)}
              className="justify-self-center text-sm text-muted-foreground underline underline-offset-2"
            >
              Kembali ke yang terbaru
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const d = describeActivity(row);
  const Icon = ICONS[d.icon];
  const userAgent = typeof row.diff?.userAgent === "string" ? row.diff.userAgent : null;
  const meta = [
    formatTime(row.createdAt),
    row.ip ? `IP ${row.ip}` : null,
    userAgent ? describeUserAgent(userAgent, " ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[d.tone])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-pretty">{d.title}</span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">{meta}</span>
      </span>
    </>
  );

  if (d.changes.length === 0) {
    return <li className="flex items-center gap-3 px-3 py-2.5">{body}</li>;
  }
  // detail perubahan bisa dibuka (tanpa JS: <details>)
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          {body}
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {d.changes.length} perubahan
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <dl className="mx-3 mb-3 ml-14 grid gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
          {d.changes.map((c) => (
            <div key={c.label} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{c.label}</dt>
              <dd className="tabular-nums">
                {c.from !== undefined ? (
                  <>
                    <span className="text-muted-foreground line-through">{c.from}</span> → <span>{c.to}</span>
                  </>
                ) : (
                  c.to
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
