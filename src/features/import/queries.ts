import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, like, lt } from "drizzle-orm";
import { db } from "@/db";
import { categories, categorizationRules, importBatches, transactions, wallets } from "@/db/schema";
import type { PocketMapping } from "@/lib/import/plan";
import type { ImportStatement } from "@/lib/import/types";
import { getSystemCategoryId } from "../categories/system";
import type { PlanContextData } from "./plan-context";

export { type PlanContextData, toPlanContext } from "./plan-context";

export async function getPlanContext(userId: string, source: ImportStatement["source"]): Promise<PlanContextData> {
  const prefix = source === "jago_pdf" ? "jago" : source;
  const [interest, tax, investment, investmentReturn, cats, rules, existing] = await Promise.all([
    getSystemCategoryId(userId, "interest"),
    getSystemCategoryId(userId, "tax"),
    getSystemCategoryId(userId, "investment"),
    getSystemCategoryId(userId, "investment_return"),
    db
      .select({ id: categories.id, kind: categories.kind, name: categories.name })
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        pattern: categorizationRules.pattern,
        kind: categorizationRules.kind,
        categoryId: categorizationRules.categoryId,
      })
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId)),
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNotNull(transactions.externalId),
          like(transactions.externalId, `${prefix}:%`),
        ),
      ),
  ]);

  const fallback = (kind: "income" | "expense") =>
    cats.find((c) => c.kind === kind && c.name.toLowerCase() === "lainnya")?.id ??
    cats.find((c) => c.kind === kind)?.id ??
    "";

  // "jago:a+b" juga dicatat sebagai "jago:a" & "jago:b" supaya tiap kaki tetap terdeteksi duplikat
  const ids = new Set<string>();
  for (const { externalId } of existing) {
    if (!externalId) continue;
    ids.add(externalId);
    const parts = externalId.slice(prefix.length + 1).split("+");
    if (parts.length > 1) for (const p of parts) ids.add(`${prefix}:${p}`);
  }

  return {
    system: { interest, tax, investment, investmentReturn },
    fallback: { income: fallback("income"), expense: fallback("expense") },
    rules,
    existingExternalIds: [...ids],
  };
}

/** Pemetaan awal kantong → dompet: external_ref sama → dompet itu; nama sama → dompet itu; ada isi → dompet baru; kosong → lewati. */
export async function suggestMappings(
  userId: string,
  statement: ImportStatement,
): Promise<Record<string, PocketMapping>> {
  const ws = await db
    .select({ id: wallets.id, name: wallets.name, externalRef: wallets.externalRef, currency: wallets.currency })
    .from(wallets)
    .where(eq(wallets.userId, userId));
  const out: Record<string, PocketMapping> = {};
  for (const p of statement.pockets) {
    const byRef = statement.source === "jago_pdf" ? ws.find((w) => w.externalRef === p.pocketId) : undefined;
    const byName = ws.find((w) => w.name.toLowerCase() === p.name.toLowerCase() && w.currency === p.currency);
    if (byRef) out[p.pocketId] = { mode: "existing", walletId: byRef.id };
    else if (byName) out[p.pocketId] = { mode: "existing", walletId: byName.id };
    else if (p.rows.length > 0 || p.opening !== 0 || (p.closing ?? 0) !== 0)
      out[p.pocketId] = { mode: "new", name: p.name };
    else out[p.pocketId] = { mode: "skip" };
  }
  return out;
}

export async function getBatch(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, id), eq(importBatches.userId, userId)));
  return row ?? null;
}

export async function listBatches(userId: string) {
  return db
    .select({
      id: importBatches.id,
      source: importBatches.source,
      filename: importBatches.filename,
      status: importBatches.status,
      period: importBatches.period,
      rowsImported: importBatches.rowsImported,
      rowsSkipped: importBatches.rowsSkipped,
      createdAt: importBatches.createdAt,
      committedAt: importBatches.committedAt,
    })
    .from(importBatches)
    .where(eq(importBatches.userId, userId))
    .orderBy(desc(importBatches.createdAt))
    .limit(30);
}

/** Bersihkan draft yang ditinggal > 2 hari. */
export async function purgeStaleDrafts(userId: string) {
  await db
    .delete(importBatches)
    .where(
      and(
        eq(importBatches.userId, userId),
        eq(importBatches.status, "draft"),
        lt(importBatches.createdAt, new Date(Date.now() - 2 * 86_400_000)),
      ),
    );
}

export async function walletsByIds(userId: string, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select({ id: wallets.id, currency: wallets.currency, name: wallets.name, externalRef: wallets.externalRef })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), inArray(wallets.id, ids)));
}
