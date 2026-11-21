// Perhitungan jadwal transaksi berulang. Semua tanggal berupa "YYYY-MM-DD" (kalender WIB), tanpa jam.
import type { RecurrenceFreq } from "@/db/schema";

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (key: string) => key.split("-").map(Number) as [number, number, number];
const fromUtc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const FREQ_LABEL: Record<RecurrenceFreq, { unit: string; every: string }> = {
  daily: { unit: "hari", every: "Tiap hari" },
  weekly: { unit: "minggu", every: "Tiap minggu" },
  monthly: { unit: "bulan", every: "Tiap bulan" },
  yearly: { unit: "tahun", every: "Tiap tahun" },
};

export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = parts(v);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/**
 * Jadwal sesudah `key`. Bulanan/tahunan memakai `anchorDay` (tanggal dari startDate) dan dipotong ke akhir bulan
 * bila bulan itu lebih pendek — mis. tiap tgl 31 → 28/29 Feb → 31 Mar.
 */
export function addPeriod(key: string, freq: RecurrenceFreq, interval: number, anchorDay: number): string {
  const [y, m, d] = parts(key);
  if (freq === "daily" || freq === "weekly") {
    const days = freq === "daily" ? interval : interval * 7;
    return fromUtc(new Date(Date.UTC(y, m - 1, d + days)));
  }
  const months = freq === "monthly" ? interval : interval * 12;
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, daysInMonth(ny, nm)))}`;
}

export type Schedule = { frequency: RecurrenceFreq; interval: number; startDate: string; endDate?: string | null };

/** Semua jadwal yang sudah jatuh tempo (≤ today, ≤ endDate) mulai dari nextDate, plus jadwal berikutnya. */
export function dueDates(
  s: Schedule & { nextDate: string },
  today: string,
  limit = 60,
): { dates: string[]; next: string } {
  const anchor = parts(s.startDate)[2];
  const dates: string[] = [];
  let d = s.nextDate;
  while (d <= today && (!s.endDate || d <= s.endDate) && dates.length < limit) {
    dates.push(d);
    d = addPeriod(d, s.frequency, s.interval, anchor);
  }
  return { dates, next: d };
}

/** Jadwal pertama yang ≥ `from` (dipakai saat jadwal diubah supaya tidak membuat transaksi mundur). */
export function firstOnOrAfter(s: Schedule, from: string): string {
  const anchor = parts(s.startDate)[2];
  let d = s.startDate;
  for (let i = 0; d < from && i < 5000; i++) d = addPeriod(d, s.frequency, s.interval, anchor);
  return d;
}

/** N jadwal mendatang mulai dari nextDate (untuk pratinjau). */
export function upcoming(s: Schedule & { nextDate: string }, count: number): string[] {
  const anchor = parts(s.startDate)[2];
  const out: string[] = [];
  let d = s.nextDate;
  while (out.length < count && (!s.endDate || d <= s.endDate)) {
    out.push(d);
    d = addPeriod(d, s.frequency, s.interval, anchor);
  }
  return out;
}

const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "UTC" });
const utc = (key: string) => {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "Tiap bulan tgl 25", "Tiap 2 minggu (Senin)", "Tiap tahun 17 Agustus". */
export function describeSchedule(s: Pick<Schedule, "frequency" | "interval" | "startDate">): string {
  const base = s.interval === 1 ? FREQ_LABEL[s.frequency].every : `Tiap ${s.interval} ${FREQ_LABEL[s.frequency].unit}`;
  if (s.frequency === "weekly") return `${base} (${weekday.format(utc(s.startDate))})`;
  if (s.frequency === "monthly") return `${base} tgl ${parts(s.startDate)[2]}`;
  if (s.frequency === "yearly") return `${base} ${dayMonth.format(utc(s.startDate))}`;
  return base;
}

const shortFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function formatDateKey(key: string): string {
  return shortFmt.format(utc(key));
}

/** Selisih hari kalender b − a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}
