import { beforeAll, describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-yang-panjangnya-lebih-dari-32-karakter";
});

describe("JWT session", () => {
  const claims = { sid: "11111111-1111-1111-1111-111111111111", sub: "22222222-2222-2222-2222-222222222222" };

  it("round-trip sign → verify", async () => {
    const token = await signSessionToken(claims, new Date(Date.now() + 60_000));
    expect(await verifySessionToken(token)).toEqual(claims);
  });

  it("menolak token kedaluwarsa", async () => {
    const token = await signSessionToken(claims, new Date(Date.now() - 1_000));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("menolak token yang diubah", async () => {
    const token = await signSessionToken(claims, new Date(Date.now() + 60_000));
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sid: "x", sub: "y", exp: 9999999999 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s}x`)).toBeNull();
  });

  it("menolak token yang ditandatangani secret lain", async () => {
    const token = await signSessionToken(claims, new Date(Date.now() + 60_000));
    process.env.JWT_SECRET = "secret-lain-yang-juga-panjangnya-lebih-dari-32";
    try {
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      process.env.JWT_SECRET = "test-secret-yang-panjangnya-lebih-dari-32-karakter";
    }
  });

  it("undefined / sampah → null", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("bukan.jwt")).toBeNull();
  });
});

describe("password argon2id", () => {
  it("hash bisa diverifikasi, password salah ditolak", async () => {
    const h = await hashPassword("rahasia-123");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "rahasia-123")).toBe(true);
    expect(await verifyPassword(h, "rahasia-124")).toBe(false);
  });

  it("hash rusak tidak melempar error", async () => {
    expect(await verifyPassword("bukan-hash", "apa saja")).toBe(false);
  });
});
