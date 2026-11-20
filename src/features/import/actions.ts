"use server";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, categorizationRules, importBatches, transactions, wallets } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import type { FormState } from "@/lib/form";
import { jagoToImportStatement, parseJagoStatement } from "@/lib/import/jago";
import { pdfToText } from "@/lib/import/pdf";
import { buildImportPlan, type PocketMapping, type RowOverride } from "@/lib/import/plan";
import { csvToTable, xlsxToTable } from "@/lib/import/spreadsheet";
import { type ColumnMapping, tableToStatement } from "@/lib/import/table";
import type { ImportStatement } from "@/lib/import/types";
import { getRequestMeta } from "@/lib/request";
import { getBatch, getPlanContext, purgeStaleDrafts, toPlanContext, walletsByIds } from "./queries";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const revalidate = () => {
  for (const p of ["/import", "/transaksi", "/dompet", "/dashboard", "/budget", "/log"]) revalidatePath(p);
};

// ── Upload ───────────────────────────────────────────────────────────

export async function uploadImportFile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Pilih file terlebih dahulu." };
  if (file.size > MAX_FILE_BYTES) return { message: "File terlalu besar (maks. 10 MB)." };
  const name = file.name.slice(0, 120);
  const ext = name.toLowerCase().split(".").pop();

  let values: typeof importBatches.$inferInsert;
  try {
    if (ext === "pdf") {
      const text = await pdfToText(new Uint8Array(await file.arrayBuffer()));
      const parsed = parseJagoStatement(text);
      if (parsed.pockets.length === 0) {
        return { message: "PDF tidak dikenali sebagai Laporan Keuangan Bulanan Bank Jago." };
      }
      const statement = jagoToImportStatement(parsed);
      values = { userId: user.id, source: "jago_pdf", filename: name, statement, period: statement.period };
    } else if (ext === "csv" || ext === "xlsx") {
      const table = ext === "csv" ? csvToTable(await file.text()) : await xlsxToTable(await file.arrayBuffer());
      if (table.length === 0) return { message: "File kosong atau tidak terbaca." };
      values = { userId: user.id, source: ext, filename: name, rawTable: table };
    } else {
      return { message: "Format tidak didukung. Gunakan PDF Jago, CSV, atau Excel (.xlsx)." };
    }
  } catch {
    return { message: "File gagal dibaca. Pastikan file tidak rusak / tidak terkunci password." };
  }

  await purgeStaleDrafts(user.id);
  const [batch] = await db.insert(importBatches).values(values).returning({ id: importBatches.id });
  redirect(`/import/${batch.id}`);
}

// ── Commit ───────────────────────────────────────────────────────────

const walletRef = z.string().regex(/^(pocket|wallet):[\w-]+$/) as z.ZodType<`pocket:${string}` | `wallet:${string}`>;

const commitSchema = z.object({
  mappings: z.record(
    z.string(),
    z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("new"), name: z.string().trim().min(1).max(50) }),
      z.object({ mode: z.literal("existing"), walletId: z.uuid() }),
      z.object({ mode: z.literal("skip") }),
    ]),
  ),
  overrides: z.record(
    z.string(),
    z.object({
      include: z.boolean().optional(),
      categoryId: z.uuid().optional(),
      toWallet: walletRef.optional(),
      excludeFromStats: z.boolean().optional(),
    }),
  ),
  columnMapping: z
    .object({
      hasHeader: z.boolean(),
      dateCol: z.number().int().min(0),
      amountMode: z.enum(["single", "split"]),
      amountCol: z.number().int().min(0).optional(),
      debitCol: z.number().int().min(0).optional(),
      creditCol: z.number().int().min(0).optional(),
      descCol: z.number().int().min(0),
      noteCol: z.number().int().min(0).optional(),
      dateOrder: z.enum(["dmy", "mdy", "ymd"]),
      invertSign: z.boolean().optional(),
    })
    .optional(),
  learnRules: z.boolean(),
});

export type CommitInput = z.input<typeof commitSchema>;
export type CommitResult = FormState & { batchId?: string; imported?: number };

const normPattern = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function commitImport(batchId: string, input: CommitInput): Promise<CommitResult> {
  const user = await requireUser();
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return { message: "Data import tidak valid." };
  const { mappings, overrides, columnMapping, learnRules } = parsed.data as {
    mappings: Record<string, PocketMapping>;
    overrides: Record<string, RowOverride>;
    columnMapping?: ColumnMapping;
    learnRules: boolean;
  };

  const batch = await getBatch(user.id, batchId);
  if (!batch || batch.status !== "draft") return { message: "Draft import tidak ditemukan atau sudah diproses." };

  let statement: ImportStatement;
  if (batch.statement) statement = batch.statement;
  else if (batch.rawTable && columnMapping && (batch.source === "csv" || batch.source === "xlsx")) {
    statement = tableToStatement(batch.rawTable, columnMapping, {
      source: batch.source,
      filename: batch.filename,
    }).statement;
  } else return { message: "Pilih kolom tanggal, nominal, dan keterangan terlebih dahulu." };

  // validasi pemetaan kantong
  const existingIds = Object.values(mappings).flatMap((m) => (m.mode === "existing" ? [m.walletId] : []));
  const overrideWalletIds = Object.values(overrides).flatMap((o) =>
    o.toWallet?.startsWith("wallet:") ? [o.toWallet.slice(7)] : [],
  );
  const owned = await walletsByIds(user.id, [...new Set([...existingIds, ...overrideWalletIds])]);
  const ownedById = new Map(owned.map((w) => [w.id, w]));
  for (const p of statement.pockets) {
    const m = mappings[p.pocketId];
    if (!m) return { message: `Pemetaan untuk "${p.name}" belum dipilih.` };
    if (m.mode === "existing") {
      const w = ownedById.get(m.walletId);
      if (!w) return { message: `Dompet untuk "${p.name}" tidak ditemukan.` };
      if (w.currency !== p.currency)
        return { message: `Mata uang dompet "${w.name}" berbeda dengan "${p.name}" (${p.currency}).` };
    }
  }
  if (overrideWalletIds.some((id) => !ownedById.has(id))) return { message: "Dompet tujuan transfer tidak ditemukan." };

  // validasi kategori koreksi
  const overrideCats = [...new Set(Object.values(overrides).flatMap((o) => (o.categoryId ? [o.categoryId] : [])))];
  if (overrideCats.length) {
    const found = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, user.id), inArray(categories.id, overrideCats)));
    if (found.length !== overrideCats.length) return { message: "Ada kategori yang tidak valid." };
  }

  const ctxData = await getPlanContext(user.id, statement.source);
  const plan = buildImportPlan(statement, mappings, toPlanContext(ctxData), overrides);
  const toInsert = plan.filter((r) => r.include && r.status === "new");
  const duplicates = plan.filter((r) => r.status === "duplicate").length;

  const { ip } = await getRequestMeta();
  const result = await db.transaction(async (tx) => {
    // 1. dompet baru
    const walletFor = new Map<string, string>(); // pocketId → walletId
    const createdWalletIds: string[] = [];
    const takenNames = new Set(
      (await tx.select({ name: wallets.name }).from(wallets).where(eq(wallets.userId, user.id))).map((w) =>
        w.name.toLowerCase(),
      ),
    );
    for (const p of statement.pockets) {
      const m = mappings[p.pocketId];
      if (m.mode === "existing") {
        walletFor.set(p.pocketId, m.walletId);
        // ingat ID kantong supaya import berikutnya terpetakan otomatis
        if (statement.source === "jago_pdf" && !ownedById.get(m.walletId)?.externalRef) {
          const taken = await tx.$count(wallets, and(eq(wallets.userId, user.id), eq(wallets.externalRef, p.pocketId)));
          if (!taken) await tx.update(wallets).set({ externalRef: p.pocketId }).where(eq(wallets.id, m.walletId));
        }
      } else if (m.mode === "new") {
        let name = m.name;
        for (let n = 2; takenNames.has(name.toLowerCase()); n++) name = `${m.name} (${n})`;
        takenNames.add(name.toLowerCase());
        const [w] = await tx
          .insert(wallets)
          .values({
            userId: user.id,
            name,
            type: /rdn|sekuritas/i.test(p.name) ? "investment" : "bank",
            currency: p.currency,
            initialBalance: statement.source === "jago_pdf" ? p.opening : 0,
            icon: /rdn|sekuritas/i.test(p.name) ? "trending-up" : "landmark",
            color: "blue",
            externalRef: statement.source === "jago_pdf" ? p.pocketId : null,
          })
          .returning({ id: wallets.id });
        walletFor.set(p.pocketId, w.id);
        createdWalletIds.push(w.id);
      }
    }
    const resolve = (ref: string | null): string | null => {
      if (!ref) return null;
      return ref.startsWith("pocket:") ? (walletFor.get(ref.slice(7)) ?? null) : ref.slice(7);
    };

    // 2. transaksi (duplikat yang lolos cek dilewati oleh unique index)
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200).flatMap((r) => {
        const walletId = resolve(r.from);
        const toWalletId = resolve(r.to);
        if (!walletId || (r.type === "transfer" && (!toWalletId || toWalletId === walletId))) return [];
        return [
          {
            userId: user.id,
            type: r.type,
            walletId,
            toWalletId: r.type === "transfer" ? toWalletId : null,
            categoryId: r.type === "transfer" ? null : r.categoryId,
            amount: r.amount,
            occurredAt: new Date(r.occurredAt),
            note: r.note,
            counterparty: r.counterparty,
            source: "import" as const,
            importBatchId: batch.id,
            externalId: r.externalId,
            excludeFromStats: r.type === "transfer" ? false : r.excludeFromStats,
          },
        ];
      });
      if (!chunk.length) continue;
      const ins = await tx.insert(transactions).values(chunk).onConflictDoNothing().returning({ id: transactions.id });
      imported += ins.length;
    }

    // 3. pelajari aturan kategori dari koreksi user
    if (learnRules) {
      for (const r of plan) {
        const o = overrides[r.key];
        if (!o?.categoryId || r.type === "transfer" || !r.include) continue;
        const pattern = normPattern(r.counterparty);
        if (pattern.length < 3) continue;
        await tx
          .insert(categorizationRules)
          .values({ userId: user.id, kind: r.type, pattern, categoryId: o.categoryId, hits: 1 })
          .onConflictDoUpdate({
            target: [categorizationRules.userId, categorizationRules.kind, categorizationRules.pattern],
            set: { categoryId: o.categoryId, hits: sql`${categorizationRules.hits} + 1`, updatedAt: new Date() },
          });
      }
    }

    await tx
      .update(importBatches)
      .set({
        status: "committed",
        committedAt: new Date(),
        rowsImported: imported,
        rowsSkipped: plan.length - imported,
        createdWalletIds,
        period: statement.period,
        // tabel mentah CSV tidak diperlukan lagi
        rawTable: null,
        statement: batch.statement ?? statement,
      })
      .where(eq(importBatches.id, batch.id));
    return { imported, createdWallets: createdWalletIds.length };
  });

  await logActivity({
    userId: user.id,
    action: "import",
    entity: "import",
    entityId: batch.id,
    diff: {
      source: statement.source,
      filename: batch.filename,
      imported: result.imported,
      duplicates,
      createdWallets: result.createdWallets,
    },
    ip,
  });
  revalidate();
  return { ok: true, message: `${result.imported} transaksi diimport.`, batchId: batch.id, imported: result.imported };
}

// ── Undo & hapus draft ───────────────────────────────────────────────

export async function undoImport(batchId: string): Promise<FormState> {
  const user = await requireUser();
  const batch = await getBatch(user.id, batchId);
  if (!batch || batch.status !== "committed") return { message: "Import tidak ditemukan." };

  const removed = await db.transaction(async (tx) => {
    const del = await tx
      .delete(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.importBatchId, batch.id)))
      .returning({ id: transactions.id });
    // dompet buatan import ini dihapus bila sudah tidak dipakai transaksi lain
    let walletsRemoved = 0;
    for (const id of batch.createdWalletIds) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(transactions)
        .where(sql`${transactions.walletId} = ${id} or ${transactions.toWalletId} = ${id}`);
      if (n === 0) {
        await tx.delete(wallets).where(and(eq(wallets.id, id), eq(wallets.userId, user.id)));
        walletsRemoved++;
      }
    }
    await tx.update(importBatches).set({ status: "undone" }).where(eq(importBatches.id, batch.id));
    return { transactions: del.length, wallets: walletsRemoved };
  });

  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "delete",
    entity: "import",
    entityId: batch.id,
    diff: { undo: true, ...removed, filename: batch.filename },
    ip,
  });
  revalidate();
  return { ok: true, message: `Import dibatalkan: ${removed.transactions} transaksi dihapus.` };
}

export async function discardDraft(batchId: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, user.id), eq(importBatches.status, "draft")));
  revalidatePath("/import");
  redirect("/import");
}
