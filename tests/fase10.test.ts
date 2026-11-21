import { describe, expect, it } from "vitest";
import { debtSummary } from "@/features/debts/math";
import { goalProgress } from "@/features/goals/math";
import {
  addPeriod,
  describeSchedule,
  dueDates,
  firstOnOrAfter,
  isDateKey,
  upcoming,
} from "@/features/recurring/schedule";

describe("jadwal berulang", () => {
  it("bulanan tgl 31 dipotong ke akhir bulan lalu kembali ke 31", () => {
    expect(addPeriod("2026-01-31", "monthly", 1, 31)).toBe("2026-02-28");
    expect(addPeriod("2026-02-28", "monthly", 1, 31)).toBe("2026-03-31");
    expect(addPeriod("2028-01-31", "monthly", 1, 31)).toBe("2028-02-29"); // kabisat
  });

  it("harian, mingguan, tahunan, interval", () => {
    expect(addPeriod("2026-12-31", "daily", 1, 31)).toBe("2027-01-01");
    expect(addPeriod("2026-11-25", "weekly", 2, 25)).toBe("2026-12-09");
    expect(addPeriod("2026-11-25", "monthly", 3, 25)).toBe("2027-02-25");
    expect(addPeriod("2028-02-29", "yearly", 1, 29)).toBe("2029-02-28");
  });

  it("dueDates mengejar jadwal yang terlewat dan berhenti di endDate", () => {
    const s = { frequency: "monthly" as const, interval: 1, startDate: "2026-09-25", nextDate: "2026-09-25" };
    expect(dueDates(s, "2026-11-21")).toEqual({ dates: ["2026-09-25", "2026-10-25"], next: "2026-11-25" });
    expect(dueDates({ ...s, endDate: "2026-10-01" }, "2026-11-21").dates).toEqual(["2026-09-25"]);
    expect(dueDates({ ...s, nextDate: "2026-11-25" }, "2026-11-21").dates).toEqual([]);
  });

  it("dueDates dibatasi supaya tidak membuat ribuan transaksi", () => {
    const s = { frequency: "daily" as const, interval: 1, startDate: "2020-01-01", nextDate: "2020-01-01" };
    expect(dueDates(s, "2026-11-21", 60).dates).toHaveLength(60);
  });

  it("firstOnOrAfter & upcoming", () => {
    const s = { frequency: "monthly" as const, interval: 1, startDate: "2026-01-10" };
    expect(firstOnOrAfter(s, "2026-11-21")).toBe("2026-12-10");
    expect(firstOnOrAfter(s, "2026-11-10")).toBe("2026-11-10");
    expect(upcoming({ ...s, nextDate: "2026-12-10", endDate: "2027-01-31" }, 5)).toEqual(["2026-12-10", "2027-01-10"]);
  });

  it("deskripsi & validasi tanggal", () => {
    expect(describeSchedule({ frequency: "monthly", interval: 1, startDate: "2026-11-25" })).toBe("Tiap bulan tgl 25");
    expect(describeSchedule({ frequency: "weekly", interval: 2, startDate: "2026-11-23" })).toBe(
      "Tiap 2 minggu (Senin)",
    );
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-02-28")).toBe(true);
  });
});

describe("target tabungan", () => {
  it("setoran per bulan dibulatkan ke atas Rp1.000", () => {
    const p = goalProgress({ saved: 100_000_000, target: 1_000_000_000, targetDate: "2027-05-01" }, "2026-11-21");
    expect(p.monthsLeft).toBe(6);
    expect(p.perMonth).toBe(150_000_000); // Rp9 jt / 6 = Rp1,5 jt
    expect(p.ratio).toBeCloseTo(0.1);
  });

  it("tercapai, terlewat, tanpa tanggal", () => {
    expect(goalProgress({ saved: 200, target: 100, targetDate: null }, "2026-11-21").done).toBe(true);
    const late = goalProgress({ saved: 0, target: 500_000, targetDate: "2026-10-01" }, "2026-11-21");
    expect(late.overdue).toBe(true);
    expect(late.perMonth).toBe(500_000);
    expect(goalProgress({ saved: 0, target: 100, targetDate: null }, "2026-11-21").perMonth).toBeNull();
  });
});

describe("hutang/piutang", () => {
  const base = { amount: 1_000_000, dueDate: "2026-11-25", settledAt: null };
  it("status & sisa", () => {
    expect(debtSummary(base, 400_000, "2026-11-21")).toMatchObject({ remaining: 600_000, status: "due-soon" });
    expect(debtSummary(base, 0, "2026-12-01").status).toBe("overdue");
    expect(debtSummary(base, 1_000_000, "2026-12-01")).toMatchObject({ remaining: 0, status: "settled" });
    expect(debtSummary({ ...base, dueDate: null }, 0, "2026-12-01").status).toBe("open");
    expect(debtSummary({ ...base, settledAt: new Date() }, 100, "2026-12-01").remaining).toBe(0);
  });
});
