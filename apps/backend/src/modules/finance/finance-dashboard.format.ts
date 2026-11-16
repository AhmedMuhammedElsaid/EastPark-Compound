import { Prisma } from '@prisma/client';

/*
 * The dashboard's one Decimal → string adapter (slice 9 rule 3). Money stays
 * Decimal until here; nothing is converted through a JS number.
 */

const HUNDRED = new Prisma.Decimal(100);

/** 2-dp money string. A zero (including −0) is `"0.00"`. */
export function moneyText(value: Prisma.Decimal): string {
    const fixed = value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return fixed.isZero() ? '0.00' : fixed.toFixed(2);
}

/** 1-dp percentage string, rounded half up (away from zero); `"-0.0"` becomes `"0.0"`. */
export function percentText(value: Prisma.Decimal): string {
    const fixed = value.toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP);
    return fixed.isZero() ? '0.0' : fixed.toFixed(1);
}

/** `part ÷ whole` as a percentage, or `null` when `whole` is 0. */
export function ratePercent(
    part: Prisma.Decimal,
    whole: Prisma.Decimal
): Prisma.Decimal | null {
    return whole.isZero() ? null : part.div(whole).mul(HUNDRED);
}

/**
 * Relative change `(x − x′) ÷ |x′|` as a 1-dp percentage string, `null` on a
 * zero baseline. The denominator is |x′| so a negative baseline (a month of
 * net reversals) still reads "up" when the figure rose.
 */
export function deltaText(
    current: Prisma.Decimal,
    previous: Prisma.Decimal
): string | null {
    if (previous.isZero()) return null;
    return percentText(current.sub(previous).div(previous.abs()).mul(HUNDRED));
}

/** Difference of two rates in percentage points, `null` when either is null. */
export function pointsDeltaText(
    current: Prisma.Decimal | null,
    previous: Prisma.Decimal | null
): string | null {
    if (current === null || previous === null) return null;
    return percentText(current.sub(previous));
}
