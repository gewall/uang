import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { revokeOtherSessions, revokeSession } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { listActiveSessions } from "@/features/auth/queries";
import { AppearanceSettings } from "@/features/settings/components/appearance-settings";
import { requireUser } from "@/lib/auth/dal";
import { describeUserAgent } from "@/lib/user-agent";
import { AiSettingsCard } from "@/features/ai/components/ai-settings-card";
import { getAiPublicSettings, MODEL_SUGGESTIONS } from "@/features/ai/config";

export const metadata: Metadata = { title: "Pengaturan" };

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default async function SettingsPage() {
  const user = await requireUser();
  const [activeSessions, ai] = await Promise.all([listActiveSessions(user.id), getAiPublicSettings(user.id)]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Pengaturan" description="Tampilan, keamanan akun, dan sesi login." />

      <Card>
        <CardHeader>
          <CardTitle>Tampilan</CardTitle>
          <CardDescription>Tersimpan di akunmu, jadi ikut ke device lain saat login.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearanceSettings />
        </CardContent>
      </Card>

      <AiSettingsCard settings={ai} modelSuggestions={MODEL_SUGGESTIONS} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
          <CardHeader>
            <CardTitle>Sesi aktif</CardTitle>
            <CardDescription>Device yang sedang login ke akunmu.</CardDescription>
            {activeSessions.length > 1 && (
              <CardAction>
                <form action={revokeOtherSessions}>
                  <Button type="submit" variant="destructive" size="sm">
                    Keluarkan lainnya
                  </Button>
                </form>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {/* mobile: daftar kartu */}
            <ul className="grid gap-2 md:hidden">
              {activeSessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {describeUserAgent(s.userAgent)}
                      {s.id === user.sessionId && <Badge variant="secondary">sesi ini</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ip ?? "IP tidak diketahui"} · {dateFmt.format(s.createdAt)}
                    </p>
                  </div>
                  {s.id !== user.sessionId && <RevokeButton id={s.id} />}
                </li>
              ))}
            </ul>

            {/* desktop: tabel */}
            <Table className="hidden md:table">
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
                    <TableCell className="max-w-56 truncate" title={s.userAgent ?? undefined}>
                      {describeUserAgent(s.userAgent)}
                      {s.id === user.sessionId && (
                        <Badge variant="secondary" className="ml-2">
                          sesi ini
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{s.ip ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{dateFmt.format(s.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {s.id !== user.sessionId && <RevokeButton id={s.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeSession.bind(null, id)}>
      <Button type="submit" variant="ghost" size="sm">
        Keluarkan
      </Button>
    </form>
  );
}
