// Tanda tangan & verifikasi JWT session. Dipakai di proxy.ts (cek optimistik) dan DAL,
// jadi sengaja tanpa "server-only" / akses DB.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "uang_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari

export type SessionClaims = {
  /** id baris di tabel sessions */
  sid: string;
  /** id user */
  sub: string;
};

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET belum di-set atau kurang dari 32 karakter");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(claims: SessionClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

/** Mengembalikan claims bila token valid & belum kedaluwarsa, selain itu null. */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string") return null;
    return { sid: payload.sid, sub: payload.sub };
  } catch {
    return null;
  }
}
