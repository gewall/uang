import { z } from "zod";
import { assetTypeEnum, investmentTxnTypeEnum } from "@/db/schema";
import { parseWibInput } from "@/lib/dates";
import { CURRENCIES, parseMoneyInput } from "@/lib/money";
import { parseQuantity } from "@/lib/number";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => v || null);

/** nominal opsional (boleh 0) → sen | null */
const optionalMoney = z
  .string()
  .optional()
  .transform((v, ctx): number | null => {
    if (!v || !v.trim()) return null;
    const m = parseMoneyInput(v);
    if (m === null || m < 0) {
      ctx.addIssue({ code: "custom", message: "Format nominal tidak dikenali" });
      return z.NEVER;
    }
    return m;
  });

export const assetFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nama wajib diisi").max(50, "Maksimal 50 karakter"),
  type: z.enum(assetTypeEnum.enumValues),
  ticker: z
    .string()
    .trim()
    .max(15, "Maksimal 15 karakter")
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  currency: z.enum(CURRENCIES),
  unitLabel: z.string().trim().min(1, "Wajib diisi").max(15, "Maksimal 15 karakter"),
  currentPrice: optionalMoney,
  note: optionalText(200),
});

export const priceSchema = z.object({
  assetId: z.uuid(),
  price: optionalMoney.refine((v) => v !== null, "Harga wajib diisi"),
});

export const investmentTxnSchema = z
  .object({
    id: z.uuid().optional(),
    assetId: z.uuid(),
    type: z.enum(investmentTxnTypeEnum.enumValues),
    occurredAt: z.string().transform((v, ctx) => {
      const d = parseWibInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Tanggal & jam tidak valid" });
        return z.NEVER;
      }
      return d;
    }),
    units: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? parseQuantity(v) : null)),
    price: optionalMoney,
    fee: optionalMoney.transform((v) => v ?? 0),
    /** nominal dividen/bunga */
    amount: optionalMoney,
    walletId: z
      .union([z.uuid(), z.literal(""), z.literal("none")])
      .optional()
      .transform((v) => (v && v !== "none" ? v : null)),
    note: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (v.type === "dividend") {
      if (!v.amount) ctx.addIssue({ code: "custom", path: ["amount"], message: "Nominal wajib diisi" });
    } else {
      if (!v.units || v.units <= 0)
        ctx.addIssue({ code: "custom", path: ["units"], message: "Jumlah unit harus > 0 (maks. 8 desimal)" });
      if (v.price === null) ctx.addIssue({ code: "custom", path: ["price"], message: "Harga per unit wajib diisi" });
    }
  });

export type InvestmentTxnValues = z.output<typeof investmentTxnSchema>;
