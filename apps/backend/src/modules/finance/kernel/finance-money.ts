import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Plan 3.5: `0.01 <= amount <= 9,999,999.99`, at most 2 decimals. */
export const FINANCE_AMOUNT_MIN = new Prisma.Decimal('0.01');
export const FINANCE_AMOUNT_MAX = new Prisma.Decimal('9999999.99');

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Parses a request amount into a Decimal without float arithmetic. Clients
 * must send amounts as decimal strings (`"450.25"`), the canonical form: a
 * JSON number is accepted through its shortest decimal string, but
 * `JSON.parse` has already rounded numbers beyond ~15 significant digits.
 * Extra precision is rejected, never rounded (400 `finance.error.amountPrecision`).
 */
export function parseFinanceAmount(value: unknown): Prisma.Decimal {
    const text =
        typeof value === 'number' && Number.isFinite(value)
            ? String(value)
            : typeof value === 'string'
              ? value.trim()
              : '';
    if (!NUMERIC.test(text))
        throw new BadRequestException('finance.error.invalidAmount');
    const amount = new Prisma.Decimal(text);
    if (amount.decimalPlaces() > 2)
        throw new BadRequestException('finance.error.amountPrecision');
    if (amount.lt(FINANCE_AMOUNT_MIN) || amount.gt(FINANCE_AMOUNT_MAX))
        throw new BadRequestException('finance.error.amountOutOfRange');
    return amount;
}

/** Decimal to the 2-dp string written into audit meta (never a float). */
export function moneyString(value: Prisma.Decimal): string {
    return value.toFixed(2);
}
