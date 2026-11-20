import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantity, roundUnits } from "@/lib/number";

describe("parseQuantity", () => {
  it.each([
    ["100", 100],
    ["1.000", 1000],
    ["1.000.000", 1_000_000],
    ["2,5", 2.5],
    ["0,00123456", 0.00123456],
    ["1.234,5", 1234.5],
    ["0.5", 0.5],
    ["12.5", 12.5],
    ["0.123", 0.123],
    [",5", 0.5],
  ])("%s → %d", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "1.23.4", "0,123456789", "-5"])("menolak %j", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe("format & round", () => {
  it("formatQuantity", () => {
    expect(formatQuantity(1234.5)).toBe("1.234,5");
    expect(formatQuantity(0.00123456)).toBe("0,00123456");
  });
  it("roundUnits", () => {
    expect(roundUnits(0.1 + 0.2)).toBe(0.3);
  });
});
