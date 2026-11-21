import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trip & IV acak", () => {
    const a = encryptSecret("sk-rahasia-123");
    const b = encryptSecret("sk-rahasia-123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("sk-rahasia");
    expect(decryptSecret(a)).toBe("sk-rahasia-123");
  });

  it("ciphertext diubah → gagal (auth tag)", () => {
    const [v, iv, tag, ct] = encryptSecret("sk-abc").split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });

  it("kunci lain → gagal", () => {
    const enc = encryptSecret("sk-abc");
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptSecret(enc)).toThrow();
  });
});
