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
