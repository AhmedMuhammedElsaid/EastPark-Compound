import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { dateOnlyString } from 'src/common/finance/cairo-date';

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

/**
 * JSON with object keys sorted and `undefined` members dropped (stable hash
 * input). Money (`Prisma.Decimal`) becomes its 2-dp string and a `Date` its
 * `YYYY-MM-DD` (finance request dates are DATE values), so `450`, `"450"`
 * and `"450.00"` hash alike once parsed.
 */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (value instanceof Prisma.Decimal) return value.toFixed(2);
    if (value instanceof Date) return dateOnlyString(value);
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) {
            const member = (value as Record<string, unknown>)[key];
            if (member !== undefined) out[key] = sortKeys(member);
        }
        return out;
    }
    return value;
}

/**
 * sha256 (hex) of the actor plus the NORMALISED request (parsed amounts and
 * dates, not the raw body): the stored `requestHash`. Including the actor
 * makes another user's reuse of a key an `idempotencyConflict`, never a
 * replay of someone else's posting (review L5).
 */
export function requestHashOf(actorId: string, request: unknown): string {
    return createHash('sha256')
        .update(canonicalJson({ actorId, request }))
        .digest('hex');
}

/**
 * Thrown inside a posting transaction when its request key already exists
 * (review M1). `runIdempotent` turns it into the normal replay path.
 */
export class RequestKeyTaken extends Error {
    constructor() {
        super('idempotency: request key already used');
        this.name = 'RequestKeyTaken';
    }
}

/**
 * Same-key race guard (review M1). Call INSIDE the posting transaction right
 * after the lock that serialises the posting (the flat row). A concurrent
 * same-key winner has committed by then (READ COMMITTED), so the loser sees
 * its row here and aborts with `RequestKeyTaken` BEFORE any business check
 * (duplicate reference, allocation caps, attachment in use) can answer with a
 * misleading 409. `runIdempotent` then replays the winner (or reports
 * `idempotencyConflict` for another body). Races the lock does not serialise
 * still end in the unique-index P2002, handled the same way.
 */
export async function assertRequestKeyFree(
    findByKey: () => Promise<unknown>
): Promise<void> {
    if ((await findByKey()) != null) throw new RequestKeyTaken();
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
 *     P2002, or meets the winner's row through `assertRequestKeyFree` inside
 *     its transaction (`RequestKeyTaken`): its transaction has rolled back, so
 *     re-read and apply (1). The
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
        if (
            !(error instanceof RequestKeyTaken) &&
            !isPrismaError(error, PRISMA_UNIQUE_VIOLATION)
        )
            throw error;
        const winner = await args.find();
        if (!winner) throw error;
        return replay(winner);
    }
}
