import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum di-set");

// Production (Vercel) konek ke Postgres VPS lewat internet: TLS wajib, sertifikat server diverifikasi
// terhadap CA sendiri (DATABASE_CA, PEM; "\n" literal diperbolehkan). Lokal (tunnel SSH) tanpa TLS.
const ca = process.env.DATABASE_CA?.replace(/\n/g, "\n");
const serverless = Boolean(process.env.VERCEL);

// Satu pool per proses; di dev, simpan di globalThis supaya HMR tidak membuka koneksi baru terus.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.pg ??
  postgres(url, {
    // shared Postgres (max_connections 100): tiap instance serverless cukup sedikit koneksi
    max: serverless ? 3 : 5,
    idle_timeout: serverless ? 10 : 30,
    connect_timeout: 15,
    ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type DB = typeof db;
