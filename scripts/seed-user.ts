// Buat / reset user: `npm run seed:user -- <username>`
// Password diketik tersembunyi (atau dari env SEED_PASSWORD untuk non-interaktif).
// Kalau username sudah ada, password-nya di-reset dan semua sesinya dicabut.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { stdin, stdout } from "node:process";
import * as schema from "../src/db/schema";
import { usernameSchema } from "../src/features/auth/schema";
import { ensureDefaultCategories } from "../src/features/categories/defaults";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/lib/auth/password";

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) return reject(new Error("Butuh terminal interaktif, atau set SEED_PASSWORD"));
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const username = usernameSchema.parse(process.argv[2] ?? "");
  let password = process.env.SEED_PASSWORD;
  if (!password) {
    password = await askHidden("Password: ");
    const again = await askHidden("Ulangi password: ");
    if (password !== again) throw new Error("Password tidak sama");
  }
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password minimal ${PASSWORD_MIN_LENGTH} karakter`);

  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  try {
    const passwordHash = await hashPassword(password);
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username));
    if (existing) {
      await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, existing.id));
      await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, existing.id));
      console.log(`Password user "${username}" di-reset, semua sesi dicabut.`);
    } else {
      const [user] = await db
        .insert(schema.users)
        .values({ username, passwordHash })
        .returning({ id: schema.users.id });
      const n = await ensureDefaultCategories(db, user.id);
      console.log(`User "${username}" dibuat (+${n} kategori default).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Gagal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
