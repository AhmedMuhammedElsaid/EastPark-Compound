/**
 * Exact decimal-string money (spec rule 3). The API sends money as decimal STRINGS; every total, comparison and
 * percentage is computed here in whole piasters (BigInt), never in floating point. Numbers are for geometry only.
 */

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d*))?$/;

/** Divides `n / d` rounding half away from zero (`d` must be positive). */
function divRound(n: bigint, d: bigint): bigint {
  const abs = n < ZERO ? -n : n;
  const q = (abs * TWO + d) / (TWO * d);
  return n < ZERO ? -q : q;
}

/** A decimal string (or a plain number from a test) as whole piasters, half away from zero. Junk is 0. */
export function toPiasters(value: string | number | null | undefined): bigint {
  const text = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(2) : "") : (value ?? "").trim();
  const match = DECIMAL_RE.exec(text);
  if (!match)
    return ZERO;
  const fraction = match[3] ?? "";
  let cents = BigInt(match[2]) * HUNDRED + BigInt(fraction.slice(0, 2).padEnd(2, "0"));
  if (fraction.length > 2 && fraction.charCodeAt(2) >= 53)
    cents += ONE;
  return match[1] === "-" ? -cents : cents;
}

/** Whole piasters as a canonical 2-dp decimal string (`-1250` -> `"-12.50"`, never `-0.00`). */
export function piastersToDecimal(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const frac = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

export function sumPiasters(values: ReadonlyArray<string | null | undefined>): bigint {
  return values.reduce<bigint>((s, v) => s + toPiasters(v), ZERO);
}

/** The exact sum of decimal strings, as a 2-dp decimal string. */
export function sumMoney(values: ReadonlyArray<string | null | undefined>): string {
  return piastersToDecimal(sumPiasters(values));
}

export function compareMoney(a: string | null | undefined, b: string | null | undefined): number {
  const x = toPiasters(a);
  const y = toPiasters(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isPositiveMoney(value: string | null | undefined): boolean {
  return toPiasters(value) > ZERO;
}

export function isZeroMoney(value: string | null | undefined): boolean {
  return toPiasters(value) === ZERO;
}

/** `part / whole` as a whole-number percentage string, half up; null when `whole` is not positive. */
export function percentInt(part: string | null | undefined, whole: string | null | undefined): string | null {
  const w = toPiasters(whole);
  if (w <= ZERO)
    return null;
  return divRound(toPiasters(part) * HUNDRED, w).toString();
}

/** `part / whole` as a one-decimal percentage string ("26.7"), half up; null when `whole` is not positive. */
export function percentTenths(part: string | null | undefined, whole: string | null | undefined): string | null {
  const w = toPiasters(whole);
  if (w <= ZERO)
    return null;
  const tenths = divRound(toPiasters(part) * HUNDRED * TEN, w);
  const negative = tenths < ZERO;
  const abs = negative ? -tenths : tenths;
  return `${negative ? "-" : ""}${(abs / TEN).toString()}.${(abs % TEN).toString()}`;
}

/** Whether `a.amount / a.flats` is larger than `b.amount / b.flats` (cross-multiplied, exact; flats must be positive). */
export function ratioGreater(a: { amount: string; flats: number }, b: { amount: string; flats: number }): boolean {
  return toPiasters(a.amount) * BigInt(b.flats) > toPiasters(b.amount) * BigInt(a.flats);
}

/**
 * "12.5K" style split of a money amount: the one-decimal compact digits and the unit, computed exactly.
 * `unit` is "" below 1,000, "K" from 1,000 and "M" from 1,000,000 (by absolute value).
 */
export function compactParts(value: string | number | null | undefined): { negative: boolean; whole: string; tenth: string; unit: "" | "K" | "M" } {
  const cents = toPiasters(value);
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const pounds = divRound(abs, HUNDRED);
  const scale = (divisor: bigint) => {
    const tenths = divRound(abs * TEN, HUNDRED * divisor);
    return { whole: (tenths / TEN).toString(), tenth: (tenths % TEN).toString() };
  };
  if (abs >= HUNDRED * BigInt(1_000_000))
    return { negative, ...scale(BigInt(1_000_000)), unit: "M" };
  if (abs >= HUNDRED * BigInt(1_000))
    return { negative, ...scale(BigInt(1_000)), unit: "K" };
  return { negative, whole: pounds.toString(), tenth: "0", unit: "" };
}
