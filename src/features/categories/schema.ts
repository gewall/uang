import { z } from "zod";
import { categoryKindEnum } from "@/db/schema";
import { COLOR_KEYS, ICON_KEYS } from "@/lib/appearance-options";

export const categoryFormSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(categoryKindEnum.enumValues),
  name: z.string().trim().min(1, "Nama wajib diisi").max(40, "Maksimal 40 karakter"),
  parentId: z
    .union([z.uuid(), z.literal(""), z.literal("none")])
    .optional()
    .transform((v) => (v && v !== "none" ? v : null)),
  icon: z.enum(ICON_KEYS as [string, ...string[]]),
  color: z.enum(COLOR_KEYS as [string, ...string[]]),
});

export const CATEGORY_KIND_LABEL = { expense: "Pengeluaran", income: "Pemasukan" } as const;
