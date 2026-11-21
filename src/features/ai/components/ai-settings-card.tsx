"use client";

import { KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/form";
import { clearAiKey, saveAiSettings, testAiConnection } from "../actions";

export type AiSettingsView = {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  hasKey: boolean;
  apiKeyLast4: string | null;
};

export function AiSettingsCard({
  settings,
  modelSuggestions,
}: {
  settings: AiSettingsView;
  modelSuggestions: string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAiSettings, {});
  const [testing, startTest] = useTransition();
  const [clearing, startClear] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      // kosongkan input key setelah disimpan (key tidak pernah ditampilkan lagi)
      const keyInput = formRef.current?.elements.namedItem("apiKey") as HTMLInputElement | null;
      if (keyInput) keyInput.value = "";
    }
  }, [state]);

  return (
    <Card id="ai">
      <CardHeader>
        <CardTitle>Rekomendasi AI</CardTitle>
        <CardDescription>
          Pakai API key DeepSeek milikmu (atau penyedia lain yang kompatibel OpenAI). Key disimpan terenkripsi dan tidak
          pernah ditampilkan lagi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="grid gap-4">
          <Field
            label="API key"
            htmlFor="ai-key"
            error={err("apiKey")}
            hint={
              settings.hasKey
                ? `Tersimpan: ••••${settings.apiKeyLast4}. Kosongkan bila tidak ingin mengganti.`
                : "Dapatkan di platform.deepseek.com → API keys."
            }
          >
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ai-key"
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder={settings.hasKey ? `••••••••${settings.apiKeyLast4}` : "sk-…"}
                className="pl-8"
              />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Model"
              htmlFor="ai-model"
              error={err("model")}
              hint="deepseek-chat (cepat) atau deepseek-reasoner (lebih teliti)"
            >
              <Input id="ai-model" name="model" list="ai-models" defaultValue={settings.model} required />
              <datalist id="ai-models">
                {modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Base URL" htmlFor="ai-url" error={err("baseUrl")}>
              <Input id="ai-url" name="baseUrl" type="url" defaultValue={settings.baseUrl} required />
            </Field>
            <Field label="Temperature" htmlFor="ai-temp" error={err("temperature")} hint="0 = konsisten, 1 = kreatif">
              <Input
                id="ai-temp"
                name="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                defaultValue={settings.temperature}
              />
            </Field>
            <Field label="Maks. token jawaban" htmlFor="ai-max" error={err("maxTokens")}>
              <Input
                id="ai-max"
                name="maxTokens"
                type="number"
                step="100"
                min="100"
                max="16000"
                defaultValue={settings.maxTokens}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 *:max-sm:flex-1">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !settings.hasKey}
              onClick={() =>
                startTest(async () => {
                  const res = await testAiConnection();
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                })
              }
            >
              {testing ? <Loader2 className="animate-spin" /> : <PlugZap />} Tes koneksi
            </Button>
            {settings.hasKey && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={clearing}
                onClick={() =>
                  startClear(async () => {
                    const res = await clearAiKey();
                    toast.success(res.message);
                  })
                }
              >
                <Trash2 /> Hapus key
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
