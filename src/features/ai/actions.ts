"use server";

import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiConversations, aiSettings, budgets, categories } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { encryptSecret } from "@/lib/crypto";
import { formatMonth, isMonth } from "@/lib/dates";
import { type FormState, fieldErrorsOf } from "@/lib/form";
import { MINOR_PER_UNIT } from "@/lib/money";
import { getRequestMeta } from "@/lib/request";
import { friendlyAiError, getAiModel } from "./config";
import { buildFinanceContext } from "./context";
import { type BudgetRecommendation, budgetPrompt, budgetRecommendationSchema, SYSTEM_PROMPT } from "./prompts";

const settingsSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("URL tidak valid")
    .refine((u) => /^https?:\/\//.test(u), "Harus http(s)")
    .transform((u) => u.replace(/\/+$/, "")),
  model: z.string().trim().min(1, "Model wajib diisi").max(80),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(100).max(16000),
  apiKey: z.string().trim().max(300).optional(),
});

/** Simpan pengaturan AI. API key kosong = pertahankan key lama. */
export async function saveAiSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { apiKey, ...rest } = parsed.data;
  const keyFields = apiKey ? { apiKeyEnc: encryptSecret(apiKey), apiKeyLast4: apiKey.slice(-4) } : {};

  await db
    .insert(aiSettings)
    .values({ userId: user.id, ...rest, ...keyFields })
    .onConflictDoUpdate({ target: aiSettings.userId, set: { ...rest, ...keyFields, updatedAt: new Date() } });

  const { ip } = await getRequestMeta();
  // jangan pernah mencatat key; cukup tandai bahwa key diganti
  await logActivity({
    userId: user.id,
    action: "update",
    entity: "ai_settings",
    diff: { ...rest, apiKeyChanged: Boolean(apiKey) },
    ip,
  });
  revalidatePath("/settings");
  revalidatePath("/ai");
  return { ok: true, message: apiKey ? "Pengaturan & API key disimpan." : "Pengaturan AI disimpan." };
}

export async function clearAiKey(): Promise<FormState> {
  const user = await requireUser();
  await db.update(aiSettings).set({ apiKeyEnc: null, apiKeyLast4: null }).where(eq(aiSettings.userId, user.id));
  const { ip } = await getRequestMeta();
  await logActivity({ userId: user.id, action: "update", entity: "ai_settings", diff: { apiKeyRemoved: true }, ip });
  revalidatePath("/settings");
  revalidatePath("/ai");
  return { ok: true, message: "API key dihapus." };
}

export async function testAiConnection(): Promise<FormState> {
  const user = await requireUser();
  const started = Date.now();
  try {
    const ai = await getAiModel(user.id);
    const { text } = await generateText({
      model: ai.model,
      prompt: "Balas hanya dengan kata: OK",
      maxOutputTokens: 10,
    });
    return {
      ok: true,
      message: `Terhubung ke ${ai.modelName} (${Date.now() - started} ms). Balasan: "${text.trim().slice(0, 40)}"`,
    };
  } catch (err) {
    return { message: friendlyAiError(err) };
  }
}

export type BudgetRecommendationResult =
  | {
      ok: true;
      month: string;
      recommendation: BudgetRecommendation;
      matched: { categoryId: string; name: string; amount: number; reason: string }[];
      unmatched: string[];
    }
  | { ok: false; message: string };

/** Minta AI menyusun pembagian budget bulan depan (keluaran terstruktur). */
export async function recommendBudget(): Promise<BudgetRecommendationResult> {
  const user = await requireUser();
  try {
    const [ai, ctx] = await Promise.all([getAiModel(user.id), buildFinanceContext(user.id)]);
    if (ctx.avgIncome === 0)
      return { ok: false, message: "Belum ada data pemasukan 3 bulan terakhir untuk dasar pembagian budget." };
    const { output } = await generateText({
      model: ai.model,
      temperature: ai.temperature,
      maxOutputTokens: ai.maxOutputTokens,
      instructions: `${SYSTEM_PROMPT}\n\n${ctx.text}`,
      prompt: budgetPrompt(ctx.expenseCategoryNames, formatMonth(ctx.nextMonth)),
      output: Output.object({ schema: budgetRecommendationSchema }),
    });
    const byName = new Map(ctx.expenseCategories.map((c) => [c.name.toLowerCase(), c]));
    const matched: { categoryId: string; name: string; amount: number; reason: string }[] = [];
    const unmatched: string[] = [];
    for (const a of output.alokasi) {
      const c = byName.get(a.kategori.trim().toLowerCase());
      const amount = Math.round(Math.max(0, a.batas)) * MINOR_PER_UNIT;
      if (c && amount > 0) matched.push({ categoryId: c.id, name: c.name, amount, reason: a.alasan });
      else unmatched.push(a.kategori);
    }
    const { ip } = await getRequestMeta();
    await logActivity({
      userId: user.id,
      action: "ai",
      entity: "ai_budget",
      diff: { month: ctx.nextMonth, categories: matched.length },
      ip,
    });
    return { ok: true, month: ctx.nextMonth, recommendation: output, matched, unmatched };
  } catch (err) {
    return { ok: false, message: friendlyAiError(err) };
  }
}

const applySchema = z.object({
  month: z.string().refine(isMonth),
  items: z
    .array(z.object({ categoryId: z.uuid(), amount: z.number().int().positive() }))
    .min(1)
    .max(100),
});

/** Terapkan rekomendasi ke budget bulan tertentu (upsert per kategori). */
export async function applyBudgetRecommendation(input: z.input<typeof applySchema>): Promise<FormState> {
  const user = await requireUser();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { message: "Data rekomendasi tidak valid." };
  const { month, items } = parsed.data;
  const owned = await db
    .select({ id: categories.id, kind: categories.kind })
    .from(categories)
    .where(eq(categories.userId, user.id));
  const ok = new Set(owned.filter((c) => c.kind === "expense").map((c) => c.id));
  const valid = items.filter((i) => ok.has(i.categoryId));
  await db.transaction(async (tx) => {
    for (const i of valid) {
      await tx
        .insert(budgets)
        .values({ userId: user.id, categoryId: i.categoryId, month: `${month}-01`, amount: i.amount })
        .onConflictDoUpdate({
          target: [budgets.userId, budgets.categoryId, budgets.month],
          set: { amount: i.amount, updatedAt: new Date() },
        });
    }
  });
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "create",
    entity: "budget",
    diff: { fromAi: true, month, count: valid.length },
    ip,
  });
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { ok: true, message: `${valid.length} budget ${formatMonth(month)} disimpan dari rekomendasi AI.` };
}

export async function deleteConversation(id: string): Promise<FormState> {
  const user = await requireUser();
  await db.delete(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)));
  revalidatePath("/ai");
  return { ok: true, message: "Percakapan dihapus." };
}
