import { z } from "zod";

export const SYSTEM_PROMPT = `Kamu adalah asisten keuangan pribadi untuk pengguna di Indonesia.
Jawab dalam Bahasa Indonesia yang santai tapi jelas. Gunakan Rupiah (Rp) dan angka konkret dari data.
Aturan:
- Pakai HANYA data yang diberikan di bawah. Jangan mengarang angka; kalau data kurang, katakan apa yang kurang.
- Beri saran yang bisa langsung dilakukan (langkah, nominal, kategori), bukan teori umum.
- Singkat: pakai poin-poin dan tabel kecil bila membantu. Hindari paragraf panjang.
- Untuk investasi: beri pertimbangan umum (diversifikasi, dana darurat, risiko), jangan rekomendasi membeli saham/produk tertentu.
- Ingatkan bahwa ini bukan nasihat keuangan profesional hanya bila topiknya investasi berisiko.`;

export const PRESETS = [
  {
    id: "pengeluaran",
    title: "Analisis pengeluaran",
    prompt:
      "Analisis pola pengeluaranku 3 bulan terakhir dan bulan ini. Kategori mana yang paling boros atau naik, dan berapa yang realistis bisa dihemat per bulan?",
  },
  {
    id: "tabungan",
    title: "Strategi menabung",
    prompt:
      "Dengan pemasukan dan pengeluaranku sekarang, susun strategi menabung yang realistis: target dana darurat, berapa persen ditabung tiap bulan, dan langkah-langkahnya.",
  },
  {
    id: "pemasukan",
    title: "Tambah pemasukan",
    prompt: "Lihat pola pemasukanku. Apa yang bisa kulakukan untuk membuat pemasukan lebih stabil atau bertambah?",
  },
  {
    id: "portofolio",
    title: "Review portofolio",
    prompt:
      "Tinjau alokasi investasiku dibanding kondisi kas dan pengeluaranku. Apakah sudah seimbang? Apa yang perlu diperhatikan?",
  },
] as const;

/** Skema keluaran rekomendasi pembagian budget (nominal dalam Rupiah utuh). */
export const budgetRecommendationSchema = z.object({
  ringkasan: z.string().describe("Penjelasan singkat strategi pembagian (2-3 kalimat)"),
  targetTabungan: z.number().describe("Nominal yang disarankan ditabung per bulan, Rupiah"),
  alokasi: z
    .array(
      z.object({
        kategori: z.string().describe("Nama kategori PERSIS dari daftar yang diberikan"),
        batas: z.number().describe("Batas pengeluaran per bulan, Rupiah utuh"),
        alasan: z.string().describe("Alasan singkat"),
      }),
    )
    .describe("Batas per kategori pengeluaran"),
  tips: z.array(z.string()).describe("2-4 tips praktis"),
});

export type BudgetRecommendation = z.infer<typeof budgetRecommendationSchema>;

export function budgetPrompt(categoryNames: string[], monthLabel: string) {
  return `Buat rekomendasi pembagian budget untuk ${monthLabel} berdasarkan data di atas.
- Gunakan HANYA kategori dari daftar ini (tulis namanya persis): ${categoryNames.join(", ")}.
- Total batas + target tabungan tidak boleh melebihi rata-rata pemasukan per bulan.
- Sisakan target tabungan minimal 10-20% bila memungkinkan; sesuaikan dengan kondisi nyata.
- Kategori yang hampir tidak pernah dipakai boleh dilewati.
- Nominal dalam Rupiah utuh (tanpa sen), dibulatkan ke ribuan.
Balas dalam format JSON sesuai skema.`;
}
