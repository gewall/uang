import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { revokeOtherSessions, revokeSession } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { listActiveSessions } from "@/features/auth/queries";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Pengaturan" };

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default async function SettingsPage() {
  const user = await requireUser();
  const activeSessions = await listActiveSessions(user.id);

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ganti password</CardTitle>
          <CardDescription>Setelah diganti, semua device lain otomatis dikeluarkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Sesi aktif</CardTitle>
            <CardDescription>Device yang sedang login ke akunmu.</CardDescription>
          </div>
          {activeSessions.length > 1 && (
            <form action={revokeOtherSessions}>
              <Button type="submit" variant="destructive" size="sm">
                Keluarkan device lain
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Login</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-64 truncate" title={s.userAgent ?? undefined}>
                    {describeUserAgent(s.userAgent)}
                    {s.id === user.sessionId && (
                      <Badge variant="secondary" className="ml-2">
                        sesi ini
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{s.ip ?? "-"}</TableCell>
                  <TableCell>{dateFmt.format(s.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {s.id !== user.sessionId && (
                      <form action={revokeSession.bind(null, s.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Keluarkan
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return "Tidak diketahui";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}
