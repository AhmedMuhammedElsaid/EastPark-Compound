/**
 * Request URL as written to logs. Finance routes carry sensitive query values
 * (`?path=` of a private attachment, `?q=` searching receipt numbers or bank
 * references), so their query string is replaced by `?[redacted]` (accounting
 * plan 9 "Logging"). Other URLs pass through unchanged.
 */
export function redactUrlForLog(url: string | undefined): string {
    const value = url ?? '';
    const q = value.indexOf('?');
    if (q < 0) return value;
    const path = value.slice(0, q);
    return /(^|\/)finance(\/|$)/i.test(path) ? `${path}?[redacted]` : value;
}
