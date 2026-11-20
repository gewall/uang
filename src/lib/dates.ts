// Semua tanggal ditampilkan & diinput dalam WIB (Asia/Jakarta, UTC+7, tanpa DST),
// tidak bergantung pada timezone server/browser.

export const TZ = "Asia/Jakarta";
const OFFSET = "+07:00";
const OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DDTHH:mm" (WIB), untuk <input type="datetime-local">. */
export function toWibInput(date: Date): string {
  const d = new Date(date.getTime() + OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (WIB) → Date. null bila format salah. */
export function parseWibInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = new Date(`${withSeconds}${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" (tanggal WIB), dipakai untuk mengelompokkan per hari. */
export function wibDateKey(date: Date): string {
  return toWibInput(date).slice(0, 10);
}

/** Bulan WIB saat ini → "YYYY-MM". */
export function currentMonth(now = new Date()): string {
  return toWibInput(now).slice(0, 7);
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Rentang [start, end) satu bulan dalam WIB. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${y}-${pad(m)}-01T00:00:00${OFFSET}`);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = new Date(`${ny}-${pad(nm)}-01T00:00:00${OFFSET}`);
  return { start, end };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: TZ });
export function formatMonth(month: string): string {
  return monthFmt.format(monthRange(month).start);
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const dayFmtYear = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});

/** Header grup harian: "Hari ini", "Kemarin", atau "Senin, 4 November". */
export function formatDayHeader(dateKey: string, now = new Date()): string {
  const today = wibDateKey(now);
  const yesterday = wibDateKey(new Date(now.getTime() - 86_400_000));
  if (dateKey === today) return "Hari ini";
  if (dateKey === yesterday) return "Kemarin";
  const d = new Date(`${dateKey}T12:00:00${OFFSET}`);
  return (dateKey.slice(0, 4) === today.slice(0, 4) ? dayFmt : dayFmtYear).format(d);
}

const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export function formatTime(date: Date): string {
  return timeFmt.format(date);
}
