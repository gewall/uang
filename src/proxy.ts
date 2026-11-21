import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

// Cek optimistik: hanya verifikasi tanda tangan JWT di cookie (tanpa DB).
// Pemeriksaan sebenarnya (session dicabut/kedaluwarsa) ada di requireUser() / getCurrentUser().
// Sengaja TIDAK me-redirect /login → /dashboard di sini: kalau session sudah dicabut tapi JWT
// masih valid, itu akan membuat loop. Halaman login sendiri yang mengecek ke DB.
export async function proxy(request: NextRequest) {
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) return NextResponse.next();

  // API: jawab 401 (jangan redirect ke halaman login)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Semua halaman kecuali login, health check, asset statis, dan file metadata.
  matcher: [
    "/((?!login|api/health|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
