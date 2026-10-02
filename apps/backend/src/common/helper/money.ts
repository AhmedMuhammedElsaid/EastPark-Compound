import { Prisma } from '@prisma/client';

/**
 * Money is stored as `DECIMAL(10,2)` (Prisma.Decimal). Prisma.Decimal
 * serialises to a JSON *string*, but web/mobile clients expect numbers, so
 * every API boundary converts with `toMoneyNumber`. Arithmetic must stay in
 * Decimal (`toDecimal(...).mul(...)`) — never in JS floats.
 */
export type MoneyInput = Prisma.Decimal | number | string;

export function toDecimal(value: MoneyInput): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function toMoneyNumber(value: MoneyInput): number {
    return toDecimal(value).toDecimalPlaces(2).toNumber();
}

/** Integer minor units (piastres) — e.g. Paymob `amount_cents`. */
export function toMinorUnits(value: MoneyInput): number {
    return toDecimal(value).mul(100).toDecimalPlaces(0).toNumber();
}
