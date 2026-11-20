"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { investmentAssets, investmentTxns, transactions, wallets } from "@/db/schema";
import { changedFields, logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/auth/dal";
import { type FormState, fieldErrorsOf, isUniqueViolation } from "@/lib/form";
import { formatQuantity } from "@/lib/number";
import { getRequestMeta } from "@/lib/request";
import { getSystemCategoryId } from "../categories/system";
import { INVESTMENT_TXN_LABEL } from "./constants";
import { computeHolding, InsufficientUnitsError, tradeAmount } from "./math";
import { assetFormSchema, investmentTxnSchema, priceSchema } from "./schema";

const revalidate = (assetId?: string) => {
  for (const p of ["/investasi", "/dashboard", "/dompet", "/transaksi"]) revalidatePath(p);
  if (assetId) revalidatePath(`/investasi/${assetId}`);
};

async function ownAsset(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(investmentAssets)
    .where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, userId)));
  return row;
}

// ── Aset ─────────────────────────────────────────────────────────────

export async function saveAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = assetFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { id, ...data } = parsed.data;
  const { ip } = await getRequestMeta();
  const values = { ...data, priceUpdatedAt: data.currentPrice !== null ? new Date() : null };

  try {
    if (id) {
      const before = await ownAsset(user.id, id);
      if (!before) return { message: "Aset tidak ditemukan." };
      // harga tidak berubah → pertahankan tanggal update harga lama
      const update =
        before.currentPrice === data.currentPrice ? { ...data } : { ...data, priceUpdatedAt: values.priceUpdatedAt };
      await db
        .update(investmentAssets)
        .set(update)
        .where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, user.id)));
      const diff = changedFields(before, data);
      if (diff)
        await logActivity({ userId: user.id, action: "update", entity: "investment_asset", entityId: id, diff, ip });
      revalidate(id);
      return { ok: true, message: `Aset "${data.name}" diperbarui.` };
    }
    const [created] = await db
      .insert(investmentAssets)
      .values({ ...values, userId: user.id })
      .returning({ id: investmentAssets.id });
    await logActivity({
      userId: user.id,
      action: "create",
      entity: "investment_asset",
      entityId: created.id,
      diff: { ...data },
      ip,
    });
    revalidate();
    return { ok: true, message: `Aset "${data.name}" ditambahkan.` };
  } catch (err) {
    if (isUniqueViolation(err, "investment_assets_user_name_uq")) {
      return { fieldErrors: { name: ["Sudah ada aset dengan nama ini"] } };
    }
    throw err;
  }
}

export async function updateAssetPrice(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = priceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const asset = await ownAsset(user.id, parsed.data.assetId);
  if (!asset) return { message: "Aset tidak ditemukan." };
  await db
    .update(investmentAssets)
    .set({ currentPrice: parsed.data.price, priceUpdatedAt: new Date() })
    .where(eq(investmentAssets.id, asset.id));
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "update",
    entity: "investment_asset",
    entityId: asset.id,
    diff: { currentPrice: { from: asset.currentPrice, to: parsed.data.price } },
    ip,
  });
  revalidate(asset.id);
  return { ok: true, message: `Harga "${asset.name}" diperbarui.` };
}

export async function setAssetArchived(id: string, archived: boolean): Promise<FormState> {
  const user = await requireUser();
  const asset = await ownAsset(user.id, id);
  if (!asset) return { message: "Aset tidak ditemukan." };
  await db
    .update(investmentAssets)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(investmentAssets.id, id));
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "update",
    entity: "investment_asset",
    entityId: id,
    diff: { archived },
    ip,
  });
  revalidate(id);
  return { ok: true, message: archived ? `"${asset.name}" diarsipkan.` : `"${asset.name}" diaktifkan lagi.` };
}

/** Hapus aset + seluruh riwayatnya, termasuk transaksi dompet tertaut (saldo dompet ikut kembali). */
export async function deleteAsset(id: string): Promise<FormState> {
  const user = await requireUser();
  const asset = await ownAsset(user.id, id);
  if (!asset) return { message: "Aset tidak ditemukan." };
  const linked = await db
    .select({ transactionId: investmentTxns.transactionId })
    .from(investmentTxns)
    .where(eq(investmentTxns.assetId, id));
  const txIds = linked.map((l) => l.transactionId).filter((x): x is string => Boolean(x));
  await db.transaction(async (tx) => {
    await tx.delete(investmentAssets).where(eq(investmentAssets.id, id)); // investment_txns ikut (cascade)
    if (txIds.length)
      await tx.delete(transactions).where(and(eq(transactions.userId, user.id), inArray(transactions.id, txIds)));
  });
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "delete",
    entity: "investment_asset",
    entityId: id,
    diff: { name: asset.name, linkedTransactions: txIds.length },
    ip,
  });
  revalidate();
  return { ok: true, message: `"${asset.name}" dihapus.` };
}

// ── Transaksi investasi ──────────────────────────────────────────────

export async function saveInvestmentTxn(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = investmentTxnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const v = parsed.data;

  const asset = await ownAsset(user.id, v.assetId);
  if (!asset) return { message: "Aset tidak ditemukan." };

  const isTrade = v.type !== "dividend";
  const units = isTrade ? v.units! : null;
  const price = isTrade ? v.price! : null;
  const fee = isTrade ? v.fee : 0;
  const amount = isTrade ? tradeAmount(v.type as "buy" | "sell", units!, price!, fee) : v.amount!;
  if (amount < 0) return { fieldErrors: { fee: ["Biaya lebih besar dari nilai penjualan"] } };

  // dompet tertaut: milik user & mata uang sama dengan aset
  if (v.walletId) {
    const [w] = await db
      .select({ currency: wallets.currency })
      .from(wallets)
      .where(and(eq(wallets.id, v.walletId), eq(wallets.userId, user.id)));
    if (!w) return { fieldErrors: { walletId: ["Dompet tidak ditemukan"] } };
    if (w.currency !== asset.currency) {
      return { fieldErrors: { walletId: [`Pilih dompet ${asset.currency} (sama dengan mata uang aset)`] } };
    }
  }

  // validasi unit: seluruh riwayat aset + transaksi ini tidak boleh menjual melebihi unit
  const others = await db
    .select({
      id: investmentTxns.id,
      type: investmentTxns.type,
      occurredAt: investmentTxns.occurredAt,
      units: investmentTxns.units,
      amount: investmentTxns.amount,
    })
    .from(investmentTxns)
    .where(and(eq(investmentTxns.assetId, asset.id), v.id ? ne(investmentTxns.id, v.id) : undefined));
  try {
    computeHolding([...others, { id: v.id ?? "new", type: v.type, occurredAt: v.occurredAt, units, amount }]);
  } catch (err) {
    if (err instanceof InsufficientUnitsError) {
      return {
        fieldErrors: {
          units: [`Unit tidak cukup: saat itu kamu memegang ${formatQuantity(err.held)} ${asset.unitLabel}`],
        },
      };
    }
    throw err;
  }

  const label = `${INVESTMENT_TXN_LABEL[v.type]} ${asset.ticker ?? asset.name}`;
  const cashTx =
    v.walletId && amount > 0
      ? {
          type: v.type === "buy" ? ("expense" as const) : ("income" as const),
          walletId: v.walletId,
          categoryId: await getSystemCategoryId(user.id, v.type === "buy" ? "investment" : "investment_return"),
          amount,
          occurredAt: v.occurredAt,
          note: v.note ? `${label} · ${v.note}` : label,
          // beli/jual hanya memindahkan uang ↔ aset; dividen = pemasukan sungguhan
          excludeFromStats: v.type !== "dividend",
        }
      : null;

  const values = { type: v.type, occurredAt: v.occurredAt, units, price, fee, amount, note: v.note };
  const { ip } = await getRequestMeta();

  const savedId = await db.transaction(async (tx) => {
    if (v.id) {
      const [before] = await tx
        .select({ transactionId: investmentTxns.transactionId })
        .from(investmentTxns)
        .where(and(eq(investmentTxns.id, v.id), eq(investmentTxns.userId, user.id)));
      if (!before) throw new Error("Transaksi investasi tidak ditemukan");
      let transactionId = before.transactionId;
      if (transactionId && cashTx) {
        await tx.update(transactions).set(cashTx).where(eq(transactions.id, transactionId));
      } else if (transactionId && !cashTx) {
        await tx.update(investmentTxns).set({ transactionId: null }).where(eq(investmentTxns.id, v.id));
        await tx.delete(transactions).where(eq(transactions.id, transactionId));
        transactionId = null;
      } else if (!transactionId && cashTx) {
        [{ id: transactionId }] = await tx
          .insert(transactions)
          .values({ ...cashTx, userId: user.id })
          .returning({ id: transactions.id });
      }
      await tx
        .update(investmentTxns)
        .set({ ...values, transactionId })
        .where(eq(investmentTxns.id, v.id));
      return v.id;
    }
    let transactionId: string | null = null;
    if (cashTx) {
      [{ id: transactionId }] = await tx
        .insert(transactions)
        .values({ ...cashTx, userId: user.id })
        .returning({ id: transactions.id });
    }
    const [row] = await tx
      .insert(investmentTxns)
      .values({ ...values, assetId: asset.id, userId: user.id, transactionId })
      .returning({ id: investmentTxns.id });
    return row.id;
  });

  await logActivity({
    userId: user.id,
    action: v.id ? "update" : "create",
    entity: "investment_txn",
    entityId: savedId,
    diff: { asset: asset.name, type: v.type, units, price, amount, walletId: v.walletId },
    ip,
  });
  revalidate(asset.id);
  return { ok: true, message: `${INVESTMENT_TXN_LABEL[v.type]} ${asset.name} disimpan.` };
}

export async function deleteInvestmentTxn(id: string): Promise<FormState> {
  const user = await requireUser();
  const [row] = await db
    .select({
      assetId: investmentTxns.assetId,
      transactionId: investmentTxns.transactionId,
      type: investmentTxns.type,
      amount: investmentTxns.amount,
    })
    .from(investmentTxns)
    .where(and(eq(investmentTxns.id, id), eq(investmentTxns.userId, user.id)));
  if (!row) return { message: "Transaksi tidak ditemukan." };

  // menghapus pembelian bisa membuat penjualan setelahnya jadi tidak valid
  const rest = await db
    .select({
      id: investmentTxns.id,
      type: investmentTxns.type,
      occurredAt: investmentTxns.occurredAt,
      units: investmentTxns.units,
      amount: investmentTxns.amount,
    })
    .from(investmentTxns)
    .where(and(eq(investmentTxns.assetId, row.assetId), ne(investmentTxns.id, id)));
  try {
    computeHolding(rest);
  } catch (err) {
    if (err instanceof InsufficientUnitsError) {
      return { message: "Tidak bisa dihapus: ada penjualan setelahnya yang membutuhkan unit dari pembelian ini." };
    }
    throw err;
  }

  await db.transaction(async (tx) => {
    await tx.delete(investmentTxns).where(eq(investmentTxns.id, id));
    if (row.transactionId) await tx.delete(transactions).where(eq(transactions.id, row.transactionId));
  });
  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "delete",
    entity: "investment_txn",
    entityId: id,
    diff: { ...row },
    ip,
  });
  revalidate(row.assetId);
  return { ok: true, message: "Transaksi investasi dihapus." };
}
