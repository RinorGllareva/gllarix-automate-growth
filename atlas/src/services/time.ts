/**
 * Timezone maths without a library: everything is UTC instants + IANA zones, converted with Intl.
 * DST-safe because offsets are read for the actual instant.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (tz: string) => {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
};

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const zonedParts = (instant: Date | number, tz: string): ZonedParts => {
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
};

/** Offset of `tz` from UTC at `instant`, in ms. */
const offsetMs = (instant: number, tz: string) => {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
};

/** "YYYY-MM-DD" of the instant in `tz`. */
export const localDateKey = (instant: Date | number, tz: string) => {
  const p = zonedParts(instant, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** "HH:MM" of the instant in `tz`. */
export const localHHMM = (instant: Date | number, tz: string) => {
  const p = zonedParts(instant, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/** The UTC instant of wall-clock `hhmm` on `dateKey` in `tz`. */
export const zonedToUtc = (dateKey: string, hhmm: string, tz: string): number => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(guess, tz);
  // Re-read the offset at the result so DST transitions land correctly.
  return guess - offsetMs(first, tz);
};

const shiftDateKey = (dateKey: string, days: number) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};

export const weekdayOf = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const isBusinessDay = (dateKey: string) => {
  const w = weekdayOf(dateKey);
  return w !== 0 && w !== 6;
};

/** Add n business days (Mon–Fri). n = 0 rolls a weekend forward to Monday. */
export const addBusinessDays = (dateKey: string, n: number) => {
  let key = dateKey;
  while (!isBusinessDay(key)) key = shiftDateKey(key, 1);
  let left = n;
  while (left > 0) {
    key = shiftDateKey(key, 1);
    if (isBusinessDay(key)) left -= 1;
  }
  return key;
};

/** Business days from a to b (a < b → positive). */
export const businessDaysBetween = (a: string, b: string) => {
  const sign = a <= b ? 1 : -1;
  const [lo, hi] = sign > 0 ? [a, b] : [b, a];
  let n = 0;
  for (let key = lo; key < hi; ) {
    key = shiftDateKey(key, 1);
    if (isBusinessDay(key)) n += 1;
  }
  return n * sign;
};

export { shiftDateKey };

/** Parse "07:00-09:00" into [start, end]. */
export const parseWindow = (w: string): [string, string] => {
  const [a, b] = w.split("-");
  return [a.trim(), b.trim()];
};

/** Short zone label for people: ET, CT, MT, PT, VET, UK, CET, GST… */
export const zoneAbbr = (tz: string) => {
  const map: Record<string, string> = {
    "America/New_York": "ET",
    "America/Chicago": "CT",
    "America/Denver": "MT",
    "America/Boise": "MT",
    "America/Phoenix": "MST",
    "America/Los_Angeles": "PT",
    "America/Caracas": "VET",
    "America/Bogota": "COT",
    "Europe/London": "UK",
    "Europe/Zurich": "CH",
    "Europe/Belgrade": "CET",
    "Asia/Dubai": "GST",
  };
  return map[tz] ?? tz.split("/").pop()!.replace(/_/g, " ");
};

const US_STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago", CA: "America/Los_Angeles",
  CO: "America/Denver", CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise", IL: "America/Chicago", IN: "America/New_York",
  IA: "America/Chicago", KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago", NV: "America/Los_Angeles", NH: "America/New_York",
  NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago",
  OH: "America/New_York", OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver",
  VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York", WI: "America/Chicago",
  WY: "America/Denver",
};

const COUNTRY_TZ: Record<string, string> = {
  GB: "Europe/London", IE: "Europe/Dublin", CH: "Europe/Zurich", DE: "Europe/Berlin", AT: "Europe/Vienna",
  AE: "Asia/Dubai", XK: "Europe/Belgrade", AL: "Europe/Tirane", NO: "Europe/Oslo", SE: "Europe/Stockholm",
  DK: "Europe/Copenhagen", AU: "Australia/Sydney",
};

/**
 * Best-guess IANA zone for an imported company. Multi-zone states use their main zone;
 * wrong guesses only shift calling windows, never the hard calling-hours check, which also uses this zone.
 */
export const inferTimezone = (country: string | null, region: string | null): string | null => {
  if (country === "US") return (region && US_STATE_TZ[region.trim().toUpperCase()]) || null;
  return country ? (COUNTRY_TZ[country] ?? null) : null;
};

/** ISO week key for a date: "2026-W40". */
export const isoWeekKey = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // Thursday decides the ISO year
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

/** Monday and Sunday (YYYY-MM-DD) of an ISO week key. */
export const isoWeekRange = (weekKey: string) => {
  const [y, w] = weekKey.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000 + (w - 1) * 7 * 86_400_000);
  const start = monday.toISOString().slice(0, 10);
  return { start, end: shiftDateKey(start, 6) };
};

export const shiftWeek = (weekKey: string, n: number) => isoWeekKey(shiftDateKey(isoWeekRange(weekKey).start, n * 7));

/** First and last day (YYYY-MM-DD) of a month key "YYYY-MM". */
export const monthRange = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(last).padStart(2, "0")}` };
};

/** "30 Nov – 4 Dec" */
export const rangeLabel = (start: string, end: string) => {
  const f = (k: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));
  return `${f(start)} – ${f(end)}`;
};
