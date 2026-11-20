@AGENTS.md

# uang

App money management pribadi. Next.js 16 (App Router, `cacheComponents`) + shadcn/ui (base-nova) + Tailwind v4 +
Drizzle ORM + PostgreSQL 18 (shared DB di VPS). Plan lengkap: `C:\Users\USER\.claude\plans\eager-wondering-bird.md`.

## Aturan

- Uang = integer **satuan sen (×100)**: `bigint` di DB (`mode: "number"`), `number` integer di JS. Jangan pernah float.
  Alasan: mutasi Jago punya sen (bunga) & ada Kantong USD. Pakai `src/lib/money.ts` (`formatMoney`, `parseMoneyInput`,
  `MoneyInput`); tampilan IDR dibulatkan ke rupiah, `precision: "exact"` untuk sen. Unit investasi = `numeric(24,8)`.
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
- `npm run format` / `npm run format:check` — Prettier (printWidth 120) untuk `src/`, `tests/`, `scripts/`
  (kecuali `src/components/ui` milik shadcn).

## Environment

- Dev: `.env` (tidak di-commit), DB `uang_dev`. Template: `.env.example`.
- Prod: DB `uang` (kredensial di VPS `~/infra/postgres/credentials`), app di `~/apps/uang/`, port `127.0.0.1:8093`,
  domain `uang.gewall.my.id`, image `ghcr.io/gewall/uang`.
- Git lokal repo ini: user `gewall` / `alginugraha21@gmail.com` (config `--local`, bukan global).

## Progres

- [x] Fase 0 — setup: Next.js, shadcn, Drizzle, vitest, DB `uang` & `uang_dev` di VPS
- [~] Fase 1 — auth selesai (login + rate limit, logout, proxy, DAL, ganti password, sesi aktif, `seed:user`);
      deploy (Dockerfile, GHCR, VPS) ditunda sampai repo GitHub dibuat
- Auth: `proxy.ts` hanya cek tanda tangan JWT; validasi session sebenarnya di `getCurrentUser()` (`src/lib/auth/dal.ts`).
  Dengan `cacheComponents`, komponen yang memanggil `requireUser()`/membaca cookie harus di dalam `<Suspense>`
  (`(app)/loading.tsx` sudah jadi boundary untuk semua halaman app).
- [x] Fase 2 — layout & tema Warm/Cold: sidebar shadcn (collapsible ikon di desktop, sheet di mobile) + bottom nav mobile,
      4 kombinasi tema, preferensi disimpan di cookie + `users.palette/theme_mode`
- Tema: JANGAN baca `cookies()` di root layout. `THEME_INIT_SCRIPT` (`src/lib/theme.ts`) di `<head>` memasang
  `data-palette` + class `dark` sebelum paint; client pakai `useTheme()` (`src/hooks/use-theme.ts`, useSyncExternalStore).
  Warna: pakai token (`bg-primary`, `text-income`, `text-expense`, `text-warning`, `chart-1..5`), jangan hardcode.
- Responsif: halaman memakai `PageHeader`; konten di mobile diberi ruang bottom nav (sudah di layout, `pb-28`).
  Tabel lebar → sediakan versi kartu `md:hidden` (contoh: sesi aktif di settings).
- Komponen Base UI: `render={<Link/>}` bukan `asChild`; `DropdownMenuLabel` wajib di dalam `DropdownMenuGroup`;
  jangan pakai `Math.random()`/`Date.now()` di komponen yang di-prerender (cacheComponents).
- [x] Fase 3 — dompet & kategori (CRUD, arsip, kategori default + subkategori, `seed:user` ikut membuat kategori default)
- Komponen form bersama: `ResponsiveDialog` (dialog desktop / bottom sheet mobile), `Field`, `MoneyInput`, `IconPicker`,
  `ColorPicker` (`src/components/form-fields.tsx`), `ConfirmDialog`, `EntityIcon`. Ikon & warna disimpan sebagai key
  (`src/lib/appearance-options.ts`). Helper form: `src/lib/form.ts` (`fieldErrorsOf`, `isUniqueViolation`, …).
- Pola view client: halaman server mengambil data → `<XxxView>` client memegang state dialog + memanggil Server Action
  via `useTransition`, hasil ditampilkan dengan toast. Lihat `features/wallets/components/wallets-view.tsx`.
- [x] Fase 4 — transaksi: income/expense/transfer (biaya admin, transfer beda mata uang via `to_amount`), filter URL,
      pencarian (teks/kategori/tag/nominal), grup per hari WIB, simpan & tambah lagi, duplikat, shortcut `N`
- Saldo dompet: SELALU lewat `walletBalanceSql()` / `walletDeltaSql()` (`src/features/wallets/balance.ts`), jangan
  hitung ulang manual. Bentuk transaksi dijaga CHECK `transactions_shape` di DB; FK dompet/kategori `restrict`.
- Postgres `ON DELETE RESTRICT` melempar kode **23001** (bukan 23503) → pakai `isForeignKeyViolation()` (cek keduanya).
- Tanggal: simpan `timestamptz`, input/tampilan selalu WIB via `src/lib/dates.ts` (`toWibInput`, `parseWibInput`,
  `monthRange`), jangan bergantung TZ server/browser.
- Drizzle: untuk join tabel yang sama dua kali pakai `alias()` dari `drizzle-orm/pg-core`, BUKAN `aliasedTable()`
  (tipe hasil select jadi `never`).
- Filter halaman memakai search param berbahasa Indonesia (`bulan`, `dompet`, `kategori`, `tipe`, `tag`, `q`, `limit`,
  `baru=1` membuka form tambah). Lihat `features/transactions/filters.ts`.
- [x] Fase 5 — budget + dashboard: budget per kategori/bulan (induk mencakup subkategori, tanpa hitung dobel),
      saran rata-rata 3 bulan, salin dari bulan lalu, pengeluaran tanpa budget, sisa per hari; dashboard: kekayaan
      bersih, pemasukan/pengeluaran + delta, grafik arus kas 6 bulan (Recharts) + tabel, top pengeluaran, budget,
      saldo dompet, transaksi terbaru
- Logika budget murni ada di `features/budgets/math.ts` (diunit-test); agregat SQL bersama di
  `features/reports/aggregates.ts` (hanya dompet IDR). Saat GROUP BY ekspresi dengan zona waktu, tulis TZ sebagai
  literal (`sql.raw`), bukan parameter.
- Grafik: ikuti skill dataviz. Seri pemasukan/pengeluaran memakai `--chart-income` / `--chart-expense` (dibedakan
  lightness, lolos validator CVD di 4 tema) — jangan pakai `--income/--expense` (token teks) untuk mark grafik.
  Sediakan tampilan tabel + legend urutan tetap. Status meter: hijau (`income`) → `warning` → `expense` + ikon & teks.
- [ ] Fase 6 — investasi
- [ ] Fase 7 — activity log
- [ ] Fase 8 — import (Jago PDF, CSV/XLSX) / export
- [ ] Fase 9 — AI rekomendasi
- [ ] Fase 10 — polishing
