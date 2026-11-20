import type { z } from "zod";

/** State standar untuk form yang memakai useActionState + Server Action. */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function fieldErrorsOf(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { fieldErrors };
}

/** Error unique constraint Postgres (23505), opsional untuk constraint tertentu. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = findPgError(err);
  return e?.code === "23505" && (!constraint || e.constraint_name === constraint);
}

/** Error foreign key Postgres (23503) — mis. kategori masih dipakai transaksi. */
export function isForeignKeyViolation(err: unknown): boolean {
  return findPgError(err)?.code === "23503";
}

type PgError = { code?: string; constraint_name?: string };
function findPgError(err: unknown): PgError | undefined {
  // drizzle membungkus error driver di `cause`
  let cur: unknown = err;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    if ("code" in cur && typeof (cur as PgError).code === "string") return cur as PgError;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Ambil string dari FormData (kosong → undefined). */
export function formString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
