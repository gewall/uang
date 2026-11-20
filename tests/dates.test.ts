import { describe, expect, it } from "vitest";
import {
  currentMonth,
  formatDayHeader,
  formatMonth,
  monthRange,
  parseWibInput,
  shiftMonth,
  toWibInput,
  wibDateKey,
} from "@/lib/dates";

describe("WIB input", () => {
  it("round-trip toWibInput ↔ parseWibInput", () => {
    const d = new Date("2026-10-04T06:53:00Z"); // 13:53 WIB
    expect(toWibInput(d)).toBe("2026-10-04T13:53");
    expect(parseWibInput("2026-10-04T13:53")?.toISOString()).toBe("2026-10-04T06:53:00.000Z");
  });

  it("lewat tengah malam UTC tetap tanggal WIB yang benar", () => {
    const d = new Date("2026-10-31T18:30:00Z"); // 1 Nov 01:30 WIB
    expect(wibDateKey(d)).toBe("2026-11-01");
    expect(currentMonth(d)).toBe("2026-11");
  });

  it("menolak format salah", () => {
    expect(parseWibInput("04/10/2026 13:53")).toBeNull();
    expect(parseWibInput("2026-13-40T99:99")).toBeNull();
  });
});

describe("bulan", () => {
  it("monthRange dalam WIB", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("desember → januari", () => {
    expect(monthRange("2026-12").end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", -13)).toBe("2025-10");
  });

  it("formatMonth", () => {
    expect(formatMonth("2026-10")).toBe("Oktober 2026");
  });
});

describe("formatDayHeader", () => {
  const now = new Date("2026-11-20T05:00:00Z"); // 20 Nov 12:00 WIB
  it("hari ini / kemarin / tanggal", () => {
    expect(formatDayHeader("2026-11-20", now)).toBe("Hari ini");
    expect(formatDayHeader("2026-11-19", now)).toBe("Kemarin");
    expect(formatDayHeader("2026-11-04", now)).toBe("Rabu, 4 November");
    expect(formatDayHeader("2025-11-04", now)).toBe("Selasa, 4 November 2025");
  });
});
