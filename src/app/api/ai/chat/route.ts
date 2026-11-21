import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { friendlyAiError, getAiModel } from "@/features/ai/config";
import { buildFinanceContext } from "@/features/ai/context";
import { SYSTEM_PROMPT } from "@/features/ai/prompts";
import { logActivity } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth/dal";
import { getRequestMeta } from "@/lib/request";

export const maxDuration = 120;

const bodySchema = z.object({
  id: z.uuid(),
  messages: z.array(z.any()).min(1).max(100),
});

/** Chat rekomendasi AI (streaming). Konteks keuangan agregat ditambahkan di instruksi sistem. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  const { id } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];

  let ai: Awaited<ReturnType<typeof getAiModel>>;
  try {
    ai = await getAiModel(user.id);
  } catch (err) {
    return Response.json({ error: friendlyAiError(err) }, { status: 400 });
  }
  const ctx = await buildFinanceContext(user.id);

  const result = streamText({
    model: ai.model,
    temperature: ai.temperature,
    maxOutputTokens: ai.maxOutputTokens,
    instructions: `${SYSTEM_PROMPT}\n\n${ctx.text}`,
    messages: await convertToModelMessages(messages),
  });

  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "ai",
    entity: "ai_chat",
    entityId: id,
    diff: { model: ai.modelName },
    ip,
  });

  const firstUserText = (() => {
    const m = messages.find((x) => x.role === "user");
    const part = m?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
    return (part?.text ?? "Percakapan").replace(/\s+/g, " ").slice(0, 80);
  })();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onError: (err) => friendlyAiError(err),
      onEnd: async ({ messages: all }) => {
        // simpan riwayat (milik user ini saja)
        const [existing] = await db
          .select({ id: aiConversations.id })
          .from(aiConversations)
          .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)));
        if (existing) {
          await db.update(aiConversations).set({ messages: all }).where(eq(aiConversations.id, id));
        } else {
          await db
            .insert(aiConversations)
            .values({ id, userId: user.id, title: firstUserText, messages: all })
            .onConflictDoNothing();
        }
      },
    }),
  });
}
