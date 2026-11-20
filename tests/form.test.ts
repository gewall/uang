import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/form";

// drizzle membungkus error driver postgres di `cause`
const wrap = (code: string, constraint_name?: string) =>
  Object.assign(new Error("Failed query"), { cause: { code, constraint_name } });

describe("deteksi error Postgres", () => {
  it("FK: restrict (23001) dan no action (23503)", () => {
    expect(isForeignKeyViolation(wrap("23001"))).toBe(true);
    expect(isForeignKeyViolation(wrap("23503"))).toBe(true);
    expect(isForeignKeyViolation(wrap("23505"))).toBe(false);
    expect(isForeignKeyViolation(new Error("lain"))).toBe(false);
  });

  it("unique violation dengan nama constraint", () => {
    expect(isUniqueViolation(wrap("23505", "wallets_user_name_uq"), "wallets_user_name_uq")).toBe(true);
    expect(isUniqueViolation(wrap("23505", "lain"), "wallets_user_name_uq")).toBe(false);
    expect(isUniqueViolation(wrap("23505"))).toBe(true);
  });
});
