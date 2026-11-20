import "server-only";
import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** IP & user-agent klien. Di prod, nginx mengisi X-Real-IP / X-Forwarded-For. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = h.get("x-real-ip") ?? forwarded ?? null;
  return {
    ip: ip && isIp(ip) ? ip : null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

function isIp(v: string) {
  return /^[\d.]+$/.test(v) || /^[0-9a-f:]+$/i.test(v);
}
