@AGENTS.md

# uang

App money management pribadi. Next.js 16 (App Router, `cacheComponents`) + shadcn/ui (base-nova) + Tailwind v4 +
Drizzle ORM + PostgreSQL 18 (shared DB di VPS). Plan lengkap: `C:\Users\USER\.claude\plans\eager-wondering-bird.md`.

## Aturan

- Uang = `bigint` rupiah (integer). Jangan pernah pakai float untuk nominal. Unit investasi = `numeric(24,8)`.
- Semua tabel: `id uuid`, `user_id`, `created_at`, `updated_at`. Semua query di-scope `user_id` dari `requireUser()`,
  bukan dari input client.
- Pola modul: `src/features/<modul>/{schema.ts (zod), actions.ts (Server Action), queries.ts, components/}`.
  Server Action: `requireUser()` → validasi zod → query → `logActivity()` → `revalidatePath`.
- Saldo dompet dihitung di SQL (initial + Σ transaksi), tidak di-cache di kolom.
- Konfigurasi AI (API key, model, base URL) diisi dari UI dan disimpan terenkripsi di DB — bukan dari env.
- File mutasi bank (PDF Jago) berisi data pribadi: jangan di-commit (`*.pdf` di-ignore), fixture test harus disamarkan.
- Sebelum menulis kode Next.js, baca guide terkait di `node_modules/next/dist/docs/` (versi ini punya breaking changes).

## Perintah

> **Windows: jalankan semua perintah dari `C:\Algi\uang` (A besar).** Nama folder asli di disk `Algi`; kalau `cd` lewat
> `C:\algi\uang`, Next memuat React dua kali (beda kapitalisasi path) dan build gagal di `/_global-error`
> dengan `Cannot read properties of null (reading 'useContext')`.

- `npm run db:tunnel` — SSH tunnel ke Postgres VPS (localhost:15432 → pg-1:5432). Jalankan di terminal terpisah.
  Kalau failover membuat pg-2 jadi primary, ganti port remote ke 5433 (cek `~/infra/postgres/status.sh` di VPS).
- `npm run db:check` — cek koneksi DB.
- `npm run db:generate` / `npm run db:migrate` / `npm run db:studio` — drizzle-kit.
- `npm run dev` / `npm run build` / `npm run lint` / `npm run typecheck` / `npm test`.

## Environment

- Dev: `.env` (tidak di-commit), DB `uang_dev`. Template: `.env.example`.
- Prod: DB `uang` (kredensial di VPS `~/infra/postgres/credentials`), app di `~/apps/uang/`, port `127.0.0.1:8093`,
  domain `uang.gewall.my.id`, image `ghcr.io/gewall/uang`.
- Git lokal repo ini: user `gewall` / `alginugraha21@gmail.com` (config `--local`, bukan global).

## Progres

- [x] Fase 0 — setup: Next.js, shadcn, Drizzle, vitest, DB `uang` & `uang_dev` di VPS
- [ ] Fase 1 — auth + deploy awal
- [ ] Fase 2 — layout & tema Warm/Cold
- [ ] Fase 3 — dompet & kategori
- [ ] Fase 4 — transaksi
- [ ] Fase 5 — budget + dashboard
- [ ] Fase 6 — investasi
- [ ] Fase 7 — activity log
- [ ] Fase 8 — import (Jago PDF, CSV/XLSX) / export
- [ ] Fase 9 — AI rekomendasi
- [ ] Fase 10 — polishing
