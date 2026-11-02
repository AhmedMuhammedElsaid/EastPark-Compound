import type { OpenCharge, PayFor } from './schemas';

/**
 * Money on the finance desk is handled in whole piasters (integers), never float sums, and goes to
 * the backend as a decimal string. Backend limits: 0.01 to 9,999,999.99, at most 2 decimals.
 */
export const MAX_CENTS = 999_999_999;

const DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Arabic-Indic digits and the Arabic decimal mark become ASCII; grouping marks and spaces go. */
export function normalizeAmountInput(input: string): string {
  return input
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGITS[digit] ?? digit)
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '');
}

export type AmountParse = { ok: true; cents: number } | { ok: false; error: 'invalid' | 'precision' | 'range' };

export function parseAmount(input: string): AmountParse {
  const value = normalizeAmountInput(input);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return { ok: false, error: 'invalid' };
  const fraction = match[2] ?? '';
  if (fraction.length > 2) return { ok: false, error: 'precision' };
  const whole = match[1]!.replace(/^0+(?=\d)/, '');
  if (whole.length > 7) return { ok: false, error: 'range' };
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 1 || cents > MAX_CENTS) return { ok: false, error: 'range' };
  return { ok: true, cents };
}

/** A backend 2-dp number as whole piasters. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Piasters as the canonical decimal string (`45000` → `"450.00"`). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** A backend 2-dp number as the decimal string the backend expects back (e.g. `expectedCredit`). */
export function amountToDecimal(amount: number): string {
  return centsToDecimal(toCents(amount));
}

export function formatMoney(amount: number, lang: 'ar' | 'en'): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Today's Cairo date, `YYYY-MM-DD` (finance dates are Cairo calendar days). */
export function cairoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatDate(value: string, lang: 'ar' | 'en'): string {
  // Date-only values are calendar days: format them in UTC so no zone shifts the day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    ...(dateOnly ? { timeZone: 'UTC' } : { timeStyle: 'short', timeZone: 'Africa/Cairo' }),
  }).format(date);
}

export type AllocationPreviewLine = { chargeId: string; cents: number };

/**
 * Mirrors the backend's auto allocation (plan 3.3) for the live preview only; the server's answer
 * is authoritative. Oldest due first; `AUTO` skips MAINTENANCE_DEPOSIT, `DEPOSIT` takes only those.
 */
export function previewAutoAllocation(
  charges: readonly OpenCharge[],
  totalCents: number,
  payFor: PayFor,
): { lines: AllocationPreviewLine[]; creditCents: number } {
  const ordered = charges
    .map((charge, index) => ({ charge, index }))
    .sort((a, b) => a.charge.dueDate.localeCompare(b.charge.dueDate) || a.index - b.index);
  const lines: AllocationPreviewLine[] = [];
  let left = totalCents;
  for (const { charge } of ordered) {
    if (left <= 0) break;
    const isDeposit = charge.kind === 'MAINTENANCE_DEPOSIT';
    if (payFor === 'DEPOSIT' ? !isDeposit : isDeposit) continue;
    const open = toCents(charge.openAmount);
    if (open <= 0) continue;
    const cents = Math.min(left, open);
    lines.push({ chargeId: charge.id, cents });
    left -= cents;
  }
  return { lines, creditCents: Math.max(left, 0) };
}
