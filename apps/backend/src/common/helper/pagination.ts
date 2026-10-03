/**
 * Cursor pagination shared by every list endpoint.
 *
 * Services fetch `limit + 1` rows with `cursorArgs(query.cursor)` (Prisma's
 * `cursor` + `skip: 1`, i.e. "start AFTER the cursor row"). The extra row
 * only signals that another page exists. `nextCursor` must therefore be the
 * LAST RETURNED row: pointing it at the extra row would make the next page
 * skip that row, silently dropping one item at every page boundary.
 *
 * Order lists by a unique key as the final tie-breaker (e.g.
 * `[{ createdAt: 'desc' }, { id: 'desc' }]`) so rows sharing a timestamp
 * are neither repeated nor skipped across pages.
 */
export interface CursorPage<T> {
    items: T[];
    nextCursor?: string;
}

/** Prisma `findMany` args that resume after `cursor` (by `id`). */
export function cursorArgs(
    cursor: string | undefined
): { skip: number; cursor: { id: string } } | Record<string, never> {
    return cursor ? { skip: 1, cursor: { id: cursor } } : {};
}

/**
 * Trim a `limit + 1` fetch to one page. `cursorOf` defaults to the row id;
 * pass it for lists keyed by something else (e.g. saved shops by shopId).
 */
export function toCursorPage<T extends { id: string }>(
    rows: T[],
    limit: number
): CursorPage<T>;
export function toCursorPage<T>(
    rows: T[],
    limit: number,
    cursorOf: (row: T) => string
): CursorPage<T>;
export function toCursorPage<T>(
    rows: T[],
    limit: number,
    cursorOf: (row: T) => string = row => (row as { id: string }).id
): CursorPage<T> {
    if (rows.length <= limit) return { items: rows };
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: last ? cursorOf(last) : undefined };
}
