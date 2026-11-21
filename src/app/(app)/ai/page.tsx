import type { UIMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { ChevronDown, KeyRound, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { AiChat } from "@/features/ai/components/ai-chat";
import { BudgetRecommendation } from "@/features/ai/components/budget-recommendation";
import { DeleteConversationButton } from "@/features/ai/components/delete-conversation-button";
import { getAiPublicSettings } from "@/features/ai/config";
import { buildFinanceContext } from "@/features/ai/context";
import { PRESETS } from "@/features/ai/prompts";
import { requireUser } from "@/lib/auth/dal";
import { formatMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rekomendasi AI" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export default async function AiPage({ searchParams }: PageProps<"/ai">) {
  const user = await requireUser();
  const { c } = await searchParams;
  const settings = await getAiPublicSettings(user.id);

  if (!settings.hasKey) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Rekomendasi AI" description="Saran budget, pengeluaran, dan tabungan dari datamu sendiri." />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <KeyRound className="size-6" />
            </span>
            <p className="font-medium">Isi API key DeepSeek dulu</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Fitur ini memakai akun AI milikmu sendiri. API key disimpan terenkripsi di server.
            </p>
            <Button render={<Link href="/settings#ai" />} nativeButton={false}>
              Buka pengaturan AI
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [ctx, conversations] = await Promise.all([
    buildFinanceContext(user.id),
    db
      .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
      .from(aiConversations)
      .where(eq(aiConversations.userId, user.id))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(30),
  ]);
  const selectedId = typeof c === "string" && UUID.test(c) ? c : null;
  const [selected] = selectedId
    ? await db
        .select({ messages: aiConversations.messages })
        .from(aiConversations)
        .where(and(eq(aiConversations.id, selectedId), eq(aiConversations.userId, user.id)))
    : [];
  // ID dari URL dipakai walau belum tersimpan (pesan pertama baru saja dikirim) supaya chat tidak ter-reset saat refresh
  const conversationId = selectedId ?? crypto.randomUUID();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Rekomendasi AI"
        description={`Model ${settings.model} · saran berdasarkan ringkasan datamu sendiri.`}
        actions={
          <Button variant="outline" render={<Link href="/ai" />} nativeButton={false}>
            <Plus /> Percakapan baru
          </Button>
        }
      />

      <BudgetRecommendation nextMonthLabel={formatMonth(ctx.nextMonth)} avgIncome={ctx.avgIncome} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <AiChat
          key={conversationId}
          conversationId={conversationId}
          initialMessages={(selected?.messages ?? []) as UIMessage[]}
          presets={PRESETS}
        />

        <Card size="sm" className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="size-4" /> Riwayat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada percakapan.</p>
            ) : (
              <ul className="grid gap-1">
                {conversations.map((cv) => (
                  <li key={cv.id} className="group flex items-center gap-1">
                    <Link
                      href={`/ai?c=${cv.id}`}
                      className={cn(
                        "min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                        cv.id === selectedId && "bg-muted font-medium",
                      )}
                    >
                      <span className="block truncate">{cv.title}</span>
                      <span className="text-xs text-muted-foreground">{fmt.format(cv.updatedAt)}</span>
                    </Link>
                    <DeleteConversationButton id={cv.id} active={cv.id === selectedId} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-(--card-spacing) text-sm [&::-webkit-details-marker]:hidden">
            <ShieldCheck className="size-4 text-income" />
            <span className="flex-1">
              <span className="font-medium">Data yang dikirim ke AI</span>
              <span className="block text-xs text-muted-foreground">
                Hanya ringkasan per bulan/kategori/dompet — tanpa catatan, nama pihak lawan, atau nomor rekening.
              </span>
            </span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <CardDescription className="px-(--card-spacing) pt-3">
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{ctx.text}</pre>
          </CardDescription>
        </details>
      </Card>
    </div>
  );
}
