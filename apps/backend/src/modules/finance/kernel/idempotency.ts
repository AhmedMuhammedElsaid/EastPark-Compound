import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';

/** Header carrying the client-generated request key (plan 3.3). */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/**
 * The `Idempotency-Key` header value, required on idempotent finance posts:
 * 8 to 100 of `[A-Za-z0-9_-]` (a UUID fits). 400
 * `finance.error.idempotencyKeyRequired` otherwise.
 */
export function requireIdempotencyKey(value: unknown): string {
    const key = Array.isArray(value) ? value[0] : value;
    if (typeof key !== 'string' || !KEY_PATTERN.test(key.trim()))
        throw new BadRequestException('finance.error.idempotencyKeyRequired');
    return key.trim();
}

/** JSON with object keys sorted and `undefined` members dropped (stable hash input). */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) {
            const member = (value as Record<string, unknown>)[key];
            if (member !== undefined) out[key] = sortKeys(member);
        }
        return out;
    }
    return value;
}

/** sha256 (hex) of the canonical request body: the stored `requestHash`. */
export function requestHashOf(body: unknown): string {
    return createHash('sha256').update(canonicalJson(body)).digest('hex');
}

export interface IdempotentOutcome<T> {
    result: T;
    /** true when an earlier request with the same key produced `result`. */
    replayed: boolean;
}

/**
 * Plan 3.3, the lookup order every idempotent create follows:
 * (1) find by `requestKey`: same hash returns the original, another hash is
 *     409 `finance.error.idempotencyConflict`;
 * (2) otherwise run the posting transaction (`create`);
 * (3) a concurrent same-key request loses the unique `requestKey` insert with
 *     P2002: its transaction has rolled back, so re-read and apply (1). The
 *     loser returns the winner's row, never a 500 and never a second posting.
 * The key lives in a unique column on the row, so a Redis flush cannot
 * cause a double posting.
 */
export async function runIdempotent<T>(args: {
    requestHash: string;
    find: () => Promise<(T & { requestHash: string }) | null>;
    create: () => Promise<T>;
}): Promise<IdempotentOutcome<T>> {
    const replay = (row: T & { requestHash: string }): IdempotentOutcome<T> => {
        if (row.requestHash !== args.requestHash)
            throw new ConflictException('finance.error.idempotencyConflict');
        return { result: row, replayed: true };
    };

    const existing = await args.find();
    if (existing) return replay(existing);
    try {
        return { result: await args.create(), replayed: false };
    } catch (error) {
        if (!isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) throw error;
        const winner = await args.find();
        if (!winner) throw error;
        return replay(winner);
    }
}
