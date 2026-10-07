/** Shop schedule helpers. Keys mon..sun, times "HH:mm" 24h (see the merchant shop-profile form). */

export type WorkingHoursDay = { open?: string | null; close?: string | null; closed?: boolean };
export type WorkingHours = Record<string, WorkingHoursDay | undefined>;

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = typeof DAY_KEYS[number];

const JS_DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayKeyFor(date: Date): DayKey {
  return JS_DAY_KEYS[date.getDay()];
}

const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

function toMinutes(time: string | null | undefined): number | null {
  const match = CLOCK_RE.exec(time ?? "");
  if (!match)
    return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when the object holds at least one usable day entry. */
export function hasSchedule(hours: WorkingHours | null | undefined): hours is WorkingHours {
  return !!hours && DAY_KEYS.some(day => hours[day] != null);
}

/**
 * Whether the schedule says "open" at `now`. Overnight ranges (close before
 * open) run into the next morning. Returns null when no schedule is set.
 */
export function isWithinSchedule(hours: WorkingHours | null | undefined, now: Date): boolean | null {
  if (!hasSchedule(hours))
    return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = hours[dayKeyFor(now)];
  const yesterday = hours[dayKeyFor(new Date(now.getTime() - 24 * 60 * 60 * 1000))];

  const range = (day: WorkingHoursDay | undefined) => {
    if (!day || day.closed)
      return null;
    const open = toMinutes(day.open);
    const close = toMinutes(day.close);
    return open === null || close === null ? null : { open, close };
  };

  const t = range(today);
  if (t) {
    if (t.close > t.open ? minutes >= t.open && minutes < t.close : minutes >= t.open)
      return true;
  }
  // Yesterday's overnight range still running past midnight.
  const y = range(yesterday);
  if (y && y.close <= y.open && minutes < y.close)
    return true;
  return false;
}

/**
 * Open right now: the owner's manual switch must be on AND, when a schedule
 * exists, the clock must be inside today's hours.
 */
export function isShopOpenNow(shop: { isOpen: boolean; workingHours?: WorkingHours | null }, now: Date): boolean {
  if (!shop.isOpen)
    return false;
  return isWithinSchedule(shop.workingHours, now) ?? true;
}

/** "HH:mm" -> localized clock text with locale digits (Arabic-Indic for ar). */
export function formatClockTime(time: string | null | undefined, language: string): string {
  const minutes = toMinutes(time);
  if (minutes === null)
    return "";
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });
}
