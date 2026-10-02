import type { BookingSlot } from "@/data/emailTypes";
import type { Meeting } from "@/data/queueTypes";
import { addBusinessDays, localDateKey, parseWindow, shiftDateKey, zonedToUtc } from "./time";

export const SLOT_MINUTES = 30;
export const BOOKING_DAYS = 5;
/** Earliest bookable slot: this long from now. */
export const MIN_NOTICE_MS = 2 * 3_600_000;

/**
 * Open 30-minute slots for the next 5 business days inside the owner's shift (their timezone),
 * minus anything within 30 minutes of an existing meeting.
 */
export const openSlots = (opts: { tz: string; shift: string; now: number; meetings: Meeting[] }): BookingSlot[] => {
  const [from, to] = parseWindow(opts.shift);
  const taken = opts.meetings.map((m) => new Date(m.scheduledAt).getTime());
  const slots: BookingSlot[] = [];
  let day = addBusinessDays(localDateKey(opts.now, opts.tz), 0);
  for (let d = 0; d < BOOKING_DAYS; d += 1) {
    const start = zonedToUtc(day, from, opts.tz);
    const end = zonedToUtc(day, to, opts.tz);
    for (let t = start; t + SLOT_MINUTES * 60_000 <= end; t += SLOT_MINUTES * 60_000) {
      if (t < opts.now + MIN_NOTICE_MS) continue;
      if (taken.some((m) => Math.abs(m - t) < SLOT_MINUTES * 60_000)) continue;
      slots.push({ start: new Date(t).toISOString(), end: new Date(t + SLOT_MINUTES * 60_000).toISOString() });
    }
    day = addBusinessDays(shiftDateKey(day, 1), 0);
  }
  return slots;
};

/** Booking page slug for a user: first name, lower case, ASCII. */
export const slugFor = (name: string) =>
  name
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
