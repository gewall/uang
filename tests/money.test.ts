import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/lib/money";

// Intl memakai spasi tak-putus (U+00A0) setelah "Rp"
const norm = (s: string) => s.replace(/ /g, " ");

describe("parseMoneyInput", () => {
  it.each([
    ["1500000", 150_000_000],
    ["1.500.000", 150_000_000],
    ["1.500.000,50", 150_000_050],
    ["1.157.130,73", 115_713_073],
    ["Rp 25.000", 2_500_000],
    ["rp25.000", 2_500_000],
    ["50rb", 5_000_000],
    ["50 ribu", 5_000_000],
    ["50k", 5_000_000],
    ["1,5jt", 150_000_000],
    ["1.5jt", 150_000_000],
    ["2 juta", 200_000_000],
    ["1m", 100_000_000_000],
    ["-200.000", -20_000_000],
    ["+10.000", 1_000_000],
    ["12.5", 1250],
    ["12,05", 1205],
    ["0", 0],
    ["$281,25", 28125],
  ])("%s → %d", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "abc", "1.50.000", "1,2,3", "10xx", "--5", ",", "Rp"])("menolak %j", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("IDR dibulatkan tanpa desimal secara default", () => {
    expect(norm(formatMoney(150_000_000))).toBe("Rp 1.500.000");
    expect(norm(formatMoney(115_713_073))).toBe("Rp 1.157.131");
  });

  it("IDR exact menampilkan sen bila ada", () => {
    expect(norm(formatMoney(115_713_073, "IDR", { precision: "exact" }))).toBe("Rp 1.157.130,73");
    expect(norm(formatMoney(150_000_000, "IDR", { precision: "exact" }))).toBe("Rp 1.500.000");
  });

  it("negatif & signed", () => {
    expect(norm(formatMoney(-20_000_000))).toBe("-Rp 200.000");
    expect(norm(formatMoney(1_000_000, "IDR", { signed: true }))).toBe("+Rp 10.000");
  });

  it("USD 2 desimal", () => {
    expect(norm(formatMoney(28125, "USD"))).toBe("US$281,25");
  });

  it("compact", () => {
    expect(norm(formatMoney(150_000_000, "IDR", { compact: true }))).toMatch(/1,5\s?jt/);
  });
});

describe("formatMoneyInput round-trip", () => {
  it.each([150_000_000, 150_000_050, 0, -20_000_000, 1205])("%d", (minor) => {
    expect(parseMoneyInput(formatMoneyInput(minor))).toBe(minor);
  });
});
