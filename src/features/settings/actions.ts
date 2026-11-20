"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { MODES, PALETTES } from "@/lib/theme";
import { setThemeCookies } from "@/lib/theme-server";

const appearanceSchema = z.object({
  palette: z.enum(PALETTES),
  mode: z.enum(MODES),
});

/** Simpan preferensi tampilan ke akun (supaya ikut ke device lain saat login). */
export async function saveAppearance(input: z.input<typeof appearanceSchema>): Promise<void> {
  const user = await requireUser();
  const { palette, mode } = appearanceSchema.parse(input);
  await db.update(users).set({ palette, themeMode: mode }).where(eq(users.id, user.id));
  await setThemeCookies(palette, mode);
}
