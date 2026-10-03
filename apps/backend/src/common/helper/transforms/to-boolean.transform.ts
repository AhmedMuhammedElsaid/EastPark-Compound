import { Transform } from 'class-transformer';

/**
 * Query-string boolean. `@Type(() => Boolean)` is wrong for query params:
 * `Boolean('false')` is `true`. Maps 'true'/'1' → true and 'false'/'0' →
 * false; any other value is passed through unchanged so `@IsBoolean()`
 * rejects it with a 400 instead of silently coercing it.
 */
export function ToBoolean(): PropertyDecorator {
    return Transform(
        ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
            const raw = obj[key];
            if (typeof raw === 'boolean') return raw;
            if (typeof raw === 'string') {
                const normalized = raw.trim().toLowerCase();
                if (normalized === 'true' || normalized === '1') return true;
                if (normalized === 'false' || normalized === '0') return false;
            }
            return raw;
        }
    );
}
