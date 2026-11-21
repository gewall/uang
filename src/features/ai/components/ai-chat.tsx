"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Loader2, Square, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Preset = { id: string; title: string; prompt: string };

export function AiChat({
  conversationId,
  initialMessages,
  presets,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  presets: readonly Preset[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
    onFinish: () => router.refresh(), // perbarui daftar riwayat
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    // percakapan baru: kunci ID di URL supaya refresh/back membuka percakapan yang sama
    if (messages.length === 0) router.replace(`/ai?c=${conversationId}`, { scroll: false });
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <Card size="sm" className="min-h-[24rem]">
      <CardContent className="grid gap-4">
        {messages.length === 0 ? (
          <div className="grid gap-3 py-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" /> Pilih topik atau tanyakan apa saja tentang keuanganmu.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => send(p.prompt)}
                  disabled={busy}
                  className="grid gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{p.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4" aria-live="polite">
            {messages.map((m) => {
              const text = m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              return (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl px-3.5 py-2.5 sm:max-w-[80%]",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{text}</p>
                    ) : (
                      <Markdown>{text || "…"}</Markdown>
                    )}
                  </div>
                </div>
              );
            })}
            {status === "submitted" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Menganalisis datamu…
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error.message.startsWith("{")
                  ? (JSON.parse(error.message).error ?? "Permintaan AI gagal.")
                  : error.message}
              </p>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Tanya tentang budget, pengeluaran, tabungan…"
            className="max-h-40 min-h-10 resize-none"
            aria-label="Pesan untuk AI"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Hentikan">
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Kirim">
              <ArrowUp />
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
