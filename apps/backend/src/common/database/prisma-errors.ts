import { Prisma } from '@prisma/client';

/** Prisma known-request error codes the services translate to HTTP errors. */
export const PRISMA_UNIQUE_VIOLATION = 'P2002';
export const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
export const PRISMA_RECORD_NOT_FOUND = 'P2025';

/**
 * True when `error` is a Prisma known-request error with `code`. Duck-typed
 * on `code` as well, so mocked errors in tests and errors crossing module
 * copies of the Prisma runtime are recognised.
 */
export function isPrismaError(error: unknown, code: string): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === code;
    }
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === code
    );
}
