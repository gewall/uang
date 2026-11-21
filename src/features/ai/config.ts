import "server-only";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

export const DEFAULT_AI = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  temperature: 0.4,
  maxTokens: 2000,
};

export const MODEL_SUGGESTIONS = ["deepseek-chat", "deepseek-reasoner"];

/** Pengaturan AI tanpa API key (aman dikirim ke browser). */
export async function getAiPublicSettings(userId: string) {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId));
  return {
    baseUrl: row?.baseUrl ?? DEFAULT_AI.baseUrl,
    model: row?.model ?? DEFAULT_AI.model,
    temperature: row?.temperature ?? DEFAULT_AI.temperature,
    maxTokens: row?.maxTokens ?? DEFAULT_AI.maxTokens,
    hasKey: Boolean(row?.apiKeyEnc),
    apiKeyLast4: row?.apiKeyLast4 ?? null,
  };
}

export type AiPublicSettings = Awaited<ReturnType<typeof getAiPublicSettings>>;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("API key AI belum diisi. Atur di Pengaturan → Rekomendasi AI.");
  }
}

/** Model siap pakai dari pengaturan user. Melempar AiNotConfiguredError bila key belum ada. */
export async function getAiModel(userId: string) {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId));
  if (!row?.apiKeyEnc) throw new AiNotConfiguredError();
  const provider = createDeepSeek({ apiKey: decryptSecret(row.apiKeyEnc), baseURL: row.baseUrl });
  return {
    model: provider(row.model),
    temperature: row.temperature,
    maxOutputTokens: row.maxTokens,
    modelName: row.model,
  };
}

/** Pesan error provider yang ramah untuk ditampilkan (tanpa membocorkan key). */
export function friendlyAiError(err: unknown): string {
  if (err instanceof AiNotConfiguredError) return err.message;
  const e = err as { statusCode?: number; message?: string; cause?: { code?: string } };
  if (e?.statusCode === 401 || e?.statusCode === 403)
    return "API key ditolak oleh penyedia AI. Periksa kembali key-nya.";
  if (e?.statusCode === 402) return "Saldo/kuota akun AI habis.";
  if (e?.statusCode === 429) return "Terlalu banyak permintaan ke AI. Coba lagi sebentar.";
  if (e?.statusCode === 404) return "Model atau base URL tidak ditemukan. Periksa pengaturan model.";
  if (e?.cause?.code === "ENOTFOUND" || e?.cause?.code === "ECONNREFUSED")
    return "Tidak bisa terhubung ke base URL AI.";
  return `Permintaan AI gagal${e?.statusCode ? ` (HTTP ${e.statusCode})` : ""}. ${String(e?.message ?? "").slice(0, 160)}`;
}
