import { getErrorCode, getErrorStatus } from "./api-error";
import { formatCurrency } from "./format-currency";
import { foldDigits } from "./listings";

/** Backend `finance.error.*` keys the mobile screens can receive; each has `finance.errors.<key>` copy. */
export const FINANCE_ERROR_KEYS = [
  "flatNotFound",
  "flatInactive",
  "chargeNotFound",
  "invalidCursor",
  "periodClosed",
  "invalidAmount",
  "amountPrecision",
  "amountOutOfRange",
  "idempotencyKeyRequired",
  "idempotencyConflict",
  "futureDate",
  "receivedOutOfRange",
  "allocationExceedsPayment",
  "allocationExceedsCharge",
  "allocationChargeNotOpen",
  "duplicateAllocation",
  "duplicateReference",
  "insufficientCredit",
  "nothingToAllocate",
  "creditSourceConflict",
  "noFile",
  "attachmentType",
  "attachmentTooLarge",
  "attachmentInvalid",
  "attachmentExpired",
  "attachmentInUse",
  "attachmentMissing",
  "creditChanged",
  "concurrentChange",
] as const;

export type FinanceErrorKey = (typeof FINANCE_ERROR_KEYS)[number];

export const DUPLICATE_REFERENCE_CODE = "finance.error.duplicateReference";
export const IDEMPOTENCY_CONFLICT_CODE = "finance.error.idempotencyConflict";

/** Translation key for a failed finance request: the backend code first, then the HTTP status. */
export function financeErrorKey(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return "errors.unreachable";
  const code = getErrorCode(error);
  if (code?.startsWith("finance.error.")) {
    const key = code.slice("finance.error.".length);
    if ((FINANCE_ERROR_KEYS as readonly string[]).includes(key))
      return `finance.errors.${key}`;
  }
  if (status === 400)
    return "finance.errors.check_form";
  if (status === 403)
    return "errors.forbidden";
  if (status === 429)
    return "errors.rate_limited";
  if (status === 502 || status === 503)
    return "finance.errors.storage_unavailable";
  if (status >= 500)
    return "errors.server";
  return "common.error";
}

/**
 * A `POST /finance/payments` failure that does not prove the payment was NOT
 * recorded: no response, a timeout (408), a throttle (429) or any 5xx (gateway,
 * cold start). The same body must be re-sent with the same key.
 */
export function isUnconfirmedPaymentError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

/** Today's payments that count as money collected: uncleared and bounced cheques are left out. */
export function isCollectedPayment(payment: { status: string; chequeState: string }): boolean {
  return payment.status === "POSTED" && payment.chequeState !== "PENDING_CLEARANCE" && payment.chequeState !== "BOUNCED";
}

export function isDuplicateReferenceError(error: unknown): boolean {
  return getErrorStatus(error) === 409 && getErrorCode(error) === DUPLICATE_REFERENCE_CODE;
}

export function isIdempotencyConflictError(error: unknown): boolean {
  return getErrorStatus(error) === 409 && getErrorCode(error) === IDEMPOTENCY_CONFLICT_CODE;
}

/**
 * A fresh `Idempotency-Key` (8-100 of `[A-Za-z0-9_-]`, the server's pattern).
 * Hermes has no `crypto.randomUUID`; time + two random parts are unique enough per accountant.
 */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  return `pay-${Date.now().toString(36)}-${random()}${random()}`;
}

/** "Owes 900 EGP" / "In credit 50 EGP" / "Settled" for a flat balance (negative = credit). */
export function balanceLabel(t: (key: string, opts?: Record<string, unknown>) => string, balance: number): string {
  if (balance > 0)
    return t("finance.owes", { amount: formatCurrency(balance) });
  if (balance < 0)
    return t("finance.in_credit", { amount: formatCurrency(-balance) });
  return t("finance.settled");
}

/** Label search as the API matches it: Latin digits, upper-case building ("a1-3" -> "A1-3"). */
export function normalizeFlatQuery(value: string): string {
  return foldDigits(value).trim().toUpperCase().slice(0, 20);
}

const AMOUNT = /^\d{1,7}(?:\.\d{1,2})?$/;
const ARABIC_DECIMAL = /٫/g;
const GROUPING = /[,،٬\s]/g;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A typed amount as the canonical 2-dp decimal STRING the API expects
 * ("1,250.5" or "١٬٢٥٠٫٥" -> "1250.50"), or null when it is not a valid
 * amount between 0.01 and 9,999,999.99. Never goes through a float.
 */
export function toAmountString(value: string): string | null {
  const v = foldDigits(value).replace(ARABIC_DECIMAL, ".").replace(GROUPING, "");
  if (!AMOUNT.test(v))
    return null;
  const [whole, fraction = ""] = v.split(".");
  const normalized = `${String(Number(whole))}.${fraction.padEnd(2, "0")}`;
  return normalized === "0.00" ? null : normalized;
}

/** A JSON-number amount (2 dp) as the decimal string the API compares against. */
export function amountToString(value: number): string {
  return value.toFixed(2);
}

/** Today's date in Cairo as `YYYY-MM-DD` (the finance desk's day), device date as a fallback. */
export function cairoToday(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    if (DATE_ONLY.test(date))
      return date;
  }
  catch {
    // No time zone data on this engine: fall back to the device date.
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A `YYYY-MM-DD` date for display ("2 Nov 2026" / "٢ نوفمبر ٢٠٢٦"); noon avoids any day shift. */
export function formatFinanceDate(date: string, language: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime()))
    return date;
  return value.toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", options);
}

/** Shifts a `YYYY-MM-DD` date by whole days (calendar arithmetic, no time zone). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}
