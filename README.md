<div align="center">

<img src="public/icon-192.png" width="72" height="72" alt="Logo uang" />

# uang

**Aplikasi keuangan pribadi yang open source** — catat pemasukan & pengeluaran, atur budget, pantau investasi,
hutang/piutang dan target tabungan, import mutasi bank Jago, dan minta rekomendasi dari AI pakai API key milikmu sendiri.

[![License: MIT](https://img.shields.io/badge/license-MIT-c75b34.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791)

Dibuat oleh **[gewall](https://github.com/gewall)**

</div>

---

## Fitur

| | |
|---|---|
| **Dompet** | Rekening bank, e-wallet, tunai, kartu kredit; multi mata uang (IDR/USD); saldo dihitung dari transaksi |
| **Transaksi** | Pemasukan, pengeluaran, transfer antar dompet (biaya admin, beda mata uang), tag, filter & pencarian |
| **Transaksi berulang** | Gaji, tagihan, langganan — dicatat otomatis saat jatuh tempo (harian/mingguan/bulanan/tahunan) |
| **Budget** | Batas per kategori per bulan, status aman/hampir habis/lewat, salin dari bulan lalu |
| **Target tabungan** | Progres dari saldo dompet atau setoran manual, hitung setoran yang perlu per bulan |
| **Hutang & piutang** | Catat pinjaman, cicilan, jatuh tempo, tandai lunas |
| **Investasi** | Saham, reksa dana, emas, kripto, dll.; harga rata-rata, untung/rugi, alokasi |
| **Dashboard** | Kekayaan bersih, arus kas 6 bulan, kategori terbesar, pengingat jatuh tempo |
| **Import** | Laporan bulanan **PDF Bank Jago** (validasi saldo, pasangan transfer antar kantong), CSV & Excel |
| **Export** | CSV/Excel per data, dan backup JSON lengkap yang bisa di-restore |
| **Rekomendasi AI** | Chat & rekomendasi pembagian budget dengan DeepSeek (atau API kompatibel OpenAI) |
| **Log aktivitas** | Riwayat setiap perubahan data, login, import, dan penggunaan AI |
| **Tampilan** | Tema Warm / Cold × terang / gelap, responsif, bisa di-install di HP (PWA) |

### Privasi

- **API key AI kamu sendiri**, diisi dari halaman Pengaturan (bukan file env), disimpan terenkripsi AES-256-GCM dan
  tidak pernah dikirim balik ke browser.
- Yang dikirim ke AI **hanya ringkasan agregat** (total per bulan/kategori/dompet) — tanpa catatan transaksi,
  nama pihak lawan, atau nomor rekening. Isinya bisa dilihat langsung di halaman AI.
- File PDF mutasi bank diproses di server lalu dibuang; tidak disimpan.
- Login username + password (argon2id), sesi bisa dicabut, pembatasan percobaan login.

## Teknologi

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) ·
Drizzle ORM · PostgreSQL · jose (JWT) · Vercel AI SDK · Recharts · Vitest

## Menjalankan secara lokal

Butuh Node.js 22+ dan PostgreSQL.

```bash
git clone https://github.com/gewall/uang.git
cd uang
npm install
cp .env.example .env        # lalu isi nilainya (lihat tabel di bawah)
npm run db:migrate          # buat tabel
npm run seed:user -- namamu # buat akun (password diketik)
npm run dev                 # http://localhost:3000
```

### Variabel lingkungan

| Nama | Keterangan |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL, mis. `postgres://user:pass@localhost:5432/uang` |
| `DATABASE_CA` | *(opsional)* sertifikat CA (PEM) untuk koneksi TLS terverifikasi ke database |
| `JWT_SECRET` | String acak ≥ 32 karakter untuk menandatangani sesi |
| `APP_ENCRYPTION_KEY` | 32 byte base64 untuk mengenkripsi API key AI — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `APP_URL` | URL publik aplikasi |
| `COOKIE_SECURE` | `true` di production (HTTPS) |

API key, model, dan base URL AI **tidak** diatur lewat env — semuanya diisi dari halaman **Pengaturan → Rekomendasi AI**.

### Perintah

```bash
npm run dev          # server pengembangan
npm run build        # build production
npm test             # unit test (vitest)
npm run typecheck    # cek tipe TypeScript
npm run lint         # ESLint
npm run db:generate  # buat migrasi dari perubahan src/db/schema.ts
npm run db:migrate   # jalankan migrasi
```

## Deploy

Aplikasi ini berjalan di platform Node mana pun yang mendukung Next.js. Contoh yang dipakai creator:
**Vercel** untuk web + **PostgreSQL** sendiri (koneksi TLS dengan `DATABASE_CA`). Jalankan `npm run db:migrate`
ke database production sebelum men-deploy perubahan skema.

## Lisensi & atribusi

Proyek ini **open source** di bawah [MIT License](LICENSE). Kamu bebas memakai, mempelajari, mengubah,
dan mendistribusikan ulang — termasuk untuk keperluan komersial — **dengan syarat tetap mencantumkan copyright creator**:

- Sertakan file [`LICENSE`](LICENSE) (berisi copyright di bawah) di setiap salinan atau turunan, termasuk bila hanya
  sebagian kode yang dipakai.
- Akan sangat dihargai bila kamu juga menautkan ke repo asli: <https://github.com/gewall/uang>.

```
MIT License — Copyright (c) 2026 gewall (https://github.com/gewall)
```

Kontribusi berupa issue maupun pull request dipersilakan.
