import type { MetadataRoute } from "next";

/** PWA: bisa di-install ke layar utama HP ("Tambahkan ke Layar Utama"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "uang — keuangan pribadi",
    short_name: "uang",
    description: "Catatan keuangan pribadi",
    lang: "id",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FBF6EF",
    theme_color: "#C75B34",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tambah transaksi", url: "/transaksi?baru=1" },
      { name: "Budget", url: "/budget" },
    ],
  };
}
