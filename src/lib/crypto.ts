import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Enkripsi rahasia (mis. API key AI) dengan AES-256-GCM. Kunci dari env APP_ENCRYPTION_KEY (32 byte base64).
// Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>"

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY harus 32 byte (base64)");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Format rahasia tidak dikenali");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
