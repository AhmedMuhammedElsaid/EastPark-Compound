import { Transform } from 'class-transformer';

/** Canonical form of an email address: trimmed and lower-cased. */
export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * DTO property decorator that normalizes an email before validation, so every
 * lookup, Redis key and stored row uses the same canonical form.
 */
export function NormalizeEmail(): PropertyDecorator {
    return Transform(({ value }) =>
        typeof value === 'string' ? normalizeEmail(value) : value
    );
}
