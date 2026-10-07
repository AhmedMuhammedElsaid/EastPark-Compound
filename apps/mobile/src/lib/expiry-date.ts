import { z } from "zod";

/**
 * Poll / election expiry helpers.
 *
 * The admin picks a date and a time on the device. A `Date` built from those
 * local components is already an absolute instant, so `toISOString()` sends the
 * correct UTC value whatever the offset (Cairo is +02:00 or +03:00 with DST).
 */

/** The calendar day of `date` with the hour and minute of `time` (seconds and ms zeroed). */
export function combineDateAndTime(date: Date, time: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  );
}

/** Where the picker opens: the current value, else tomorrow at the next whole hour. */
export function initialPickerValue(current: Date | undefined, now: number = Date.now()): Date {
  if (current && Number.isFinite(current.getTime()))
    return current;
  const next = new Date(now + 24 * 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export function isFutureExpiry(value: Date, now: number = Date.now()): boolean {
  const ts = value.getTime();
  return Number.isFinite(ts) && ts > now;
}

export function toExpiryIso(value: Date): string {
  return value.toISOString();
}

/** Date and time with locale digits: Arabic-Indic for Arabic, Latin otherwise. */
export function formatExpiry(value: Date, language: string): string {
  return value.toLocaleString(language === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Zod field for a required, future expiry. Messages are translation keys. */
export const expirySchema = z
  .date({ error: "validation.required" })
  .refine(value => isFutureExpiry(value), "validation.expiry_future");
