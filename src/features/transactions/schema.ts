import { z } from "zod";
import { transactionTypeEnum } from "@/db/schema";
import { parseWibInput } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";

function checkMoney(v: string, label: string, allowZero: boolean, ctx: z.RefinementCtx): number {
  const minor = parseMoneyInput(v);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: "Format nominal tidak dikenali" });
    return z.NEVER;
  }
  if (minor < 0 || (!allowZero && minor === 0)) {
    ctx.addIssue({ code: "custom", message: `${label} harus lebih dari 0` });
    return z.NEVER;
  }
  return minor;
}

/** Nominal wajib (> 0) → sen. */
const money = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx): number => {
      if (!v || !v.trim()) {
        ctx.addIssue({ code: "custom", message: `${label} wajib diisi` });
        return z.NEVER;
      }
      return checkMoney(v, label, false, ctx);
    });

/** Nominal opsional → sen atau null. */
const optionalMoney = (label: string, { allowZero = false } = {}) =>
  z
    .string()
    .optional()
    .transform((v, ctx): number | null => (!v || !v.trim() ? null : checkMoney(v, label, allowZero, ctx)));

const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);

/** "Makan, kantor ,  Makan" → ["makan", "kantor"] */
export function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const tags = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .map((t) => t.slice(0, 24));
  return [...new Set(tags)].slice(0, 10);
}

export const transactionFormSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(transactionTypeEnum.enumValues),
    amount: money("Nominal"),
    walletId: z.uuid({ error: "Pilih dompet" }),
    toWalletId: optionalUuid,
    categoryId: optionalUuid,
    fee: optionalMoney("Biaya", { allowZero: true }),
    toAmount: optionalMoney("Nominal diterima"),
    occurredAt: z.string().transform((v, ctx) => {
      const d = parseWibInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Tanggal & jam tidak valid" });
        return z.NEVER;
      }
      return d;
    }),
    note: z
      .string()
      .trim()
      .max(200, "Maksimal 200 karakter")
      .optional()
      .transform((v) => v || null),
    tags: z.string().max(300).optional().transform(parseTags),
    intent: z.enum(["save", "again"]).optional().default("save"),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.toWalletId) ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Pilih dompet tujuan" });
      else if (v.toWalletId === v.walletId)
        ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Dompet tujuan harus berbeda" });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pilih kategori" });
    }
  })
  .transform((v) => ({
    ...v,
    // rapikan field yang tidak relevan untuk tipe ini
    toWalletId: v.type === "transfer" ? v.toWalletId : null,
    toAmount: v.type === "transfer" ? v.toAmount : null,
    categoryId: v.type === "transfer" ? null : v.categoryId,
    fee: v.type === "transfer" ? (v.fee ?? 0) : 0,
  }));

export type TransactionFormValues = z.output<typeof transactionFormSchema>;

export const TYPE_LABEL = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer" } as const;
