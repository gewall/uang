import { z } from "zod";
import { walletTypeEnum } from "@/db/schema";
import { COLOR_KEYS, ICON_KEYS } from "@/lib/appearance-options";
import { CURRENCIES, parseMoneyInput } from "@/lib/money";

export const walletFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nama wajib diisi").max(50, "Maksimal 50 karakter"),
  type: z.enum(walletTypeEnum.enumValues, { error: "Pilih jenis dompet" }),
  currency: z.enum(CURRENCIES),
  initialBalance: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return 0;
      const minor = parseMoneyInput(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: "Format nominal tidak dikenali" });
        return z.NEVER;
      }
      return minor;
    }),
  icon: z.enum(ICON_KEYS as [string, ...string[]]),
  color: z.enum(COLOR_KEYS as [string, ...string[]]),
  note: z
    .string()
    .trim()
    .max(200, "Maksimal 200 karakter")
    .optional()
    .transform((v) => v || null),
});

export type WalletFormInput = z.input<typeof walletFormSchema>;
