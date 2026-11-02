/**
 * Accounting dates are Cairo calendar dates (`@db.Date` columns). A JS `Date`
 * written to a DATE column keeps only its UTC calendar day, so every helper
 * here returns UTC midnight of the Cairo day: `2026-11-02T22:30Z` is already
 * 3 November in Cairo (UTC+2, +3 in summer) and becomes `2026-11-03T00:00Z`.
 */
const CAIRO_DAY = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** `YYYY-MM-DD` of `at` in Cairo. */
export function cairoDateString(at: Date): string {
    return CAIRO_DAY.format(at);
}

/** UTC midnight of `at`'s Cairo calendar day (the value for a DATE column). */
export function cairoDate(at: Date): Date {
    return new Date(`${cairoDateString(at)}T00:00:00.000Z`);
}

/** Today's Cairo date as a DATE-column value. */
export function cairoToday(now: Date = new Date()): Date {
    return cairoDate(now);
}

/** "Owned since before finance go-live" (cut-over backfill sentinel). */
export const OWNERSHIP_SENTINEL_DATE = new Date('1900-01-01T00:00:00.000Z');

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isDateOnly(value: string): boolean {
    const m = DATE_ONLY.exec(value);
    if (!m) return false;
    const d = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** `YYYY-MM-DD` to its DATE-column value (UTC midnight). Throws on bad input. */
export function parseDateOnly(value: string): Date {
    if (!isDateOnly(value)) throw new RangeError(`not a date: ${value}`);
    return new Date(`${value}T00:00:00.000Z`);
}

/** A DATE-column value back to `YYYY-MM-DD` (its UTC calendar day). */
export function dateOnlyString(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** DATE-column value `days` calendar days later (negative: earlier). */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (both DATE-column values). */
export function daysBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** True for a `YYYY-MM` accounting period. */
export function isPeriod(value: string): boolean {
    return PERIOD.test(value);
}

/** `YYYY-MM` accounting period of a DATE-column value. */
export function periodOf(date: Date): string {
    return dateOnlyString(date).slice(0, 7);
}

/** `YYYY-MM` Cairo month of an instant (today's period: `cairoPeriod(new Date())`). */
export function cairoPeriod(at: Date): string {
    return cairoDateString(at).slice(0, 7);
}

/** Months since year 0 of a `YYYY-MM` period (for period arithmetic). */
export function periodIndex(period: string): number {
    return Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
}

/** `YYYY-MM` shifted by `months` (negative: earlier). */
export function shiftPeriod(period: string, months: number): string {
    const index = periodIndex(period) + months;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** True when both instants fall on the same Cairo calendar day. */
export function isSameCairoDay(a: Date, b: Date): boolean {
    return cairoDateString(a) === cairoDateString(b);
}

/**
 * The first instant (UTC) of a Cairo calendar day. Cairo is UTC+2, or UTC+3
 * in summer, and Egypt switches at local midnight, so the day starts at 22:00
 * or 21:00 UTC the evening before. Used to compare a timestamp column with a
 * Cairo date: `cairoDate(voidedAt) > D` ⇔ `voidedAt >= cairoDayStart(D + 1)`.
 */
export function cairoDayStart(day: Date): Date {
    const target = dateOnlyString(day);
    const midnightUtc = day.getTime();
    for (const hours of [3, 2, 1, 0]) {
        const candidate = new Date(midnightUtc - hours * 60 * 60 * 1000);
        if (
            cairoDateString(candidate) === target &&
            cairoDateString(new Date(candidate.getTime() - 1)) !== target
        ) {
            return candidate;
        }
    }
    // Unreachable for Africa/Cairo; keep a defined, conservative answer.
    return new Date(midnightUtc - 2 * 60 * 60 * 1000);
}

/**
 * Fiscal year of an accounting date (plan 3.4). `year` is the calendar year
 * the fiscal year starts in (the `receipt_counters.year` key); `label` is
 * what the number shows: `2026` for a January year, `2627` for FY2026-27.
 */
export function fiscalYearOf(
    date: Date,
    startMonth: number
): { year: number; label: string } {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    if (startMonth <= 1) return { year: y, label: String(y) };
    const start = m >= startMonth ? y : y - 1;
    const yy = (n: number) => String(n % 100).padStart(2, '0');
    return { year: start, label: `${yy(start)}${yy(start + 1)}` };
}
