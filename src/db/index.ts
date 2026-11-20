import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum di-set");

// Satu pool per proses; di dev, simpan di globalThis supaya HMR tidak membuka koneksi baru terus.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.pg ??
  postgres(url, {
    max: 5, // VPS kecil + shared Postgres: jaga jumlah koneksi tetap rendah
    idle_timeout: 30,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type DB = typeof db;
