import { z } from "zod";
import { recurrenceFreqEnum, transactionTypeEnum } from "@/db/schema";
import { parseMoneyInput } from "@/lib/money";
import { isDateKey } from "./schedule";

const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => v || null);

export const recurringFormSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Nama wajib diisi").max(60, "Maksimal 60 karakter"),
    type: z.enum(transactionTypeEnum.enumValues),
    amount: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const minor = v ? parseMoneyInput(v) : null;
        if (minor === null || minor <= 0) {
          ctx.addIssue({ code: "custom", message: "Nominal harus lebih dari 0" });
          return z.NEVER;
        }
        return minor;
      }),
    walletId: z.uuid({ error: "Pilih dompet" }),
    toWalletId: optionalUuid,
    categoryId: optionalUuid,
    frequency: z.enum(recurrenceFreqEnum.enumValues),
    interval: z.coerce.number().int().min(1, "Minimal 1").max(365, "Maksimal 365"),
    startDate: z.string().refine(isDateKey, "Tanggal tidak valid"),
    endDate: z
      .string()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || isDateKey(v), "Tanggal tidak valid"),
    note: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.toWalletId) ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Pilih dompet tujuan" });
      else if (v.toWalletId === v.walletId)
        ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Dompet tujuan harus berbeda" });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pilih kategori" });
    }
    if (v.endDate && v.endDate < v.startDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Harus setelah tanggal mulai" });
  })
  .transform((v) => ({
    ...v,
    toWalletId: v.type === "transfer" ? v.toWalletId : null,
    categoryId: v.type === "transfer" ? null : v.categoryId,
  }));
