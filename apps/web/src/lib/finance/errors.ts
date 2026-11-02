/**
 * Finance error vocabulary shared by the BFF and the desk UI. The backend sends a stable `code`
 * (`finance.error.<key>`); the BFF forwards only `finance.<key>` for keys on this list, never the
 * backend's prose, stack or validation internals. Each key has `finance.errors.<key>` copy in
 * `translations/{en,ar}.json` (pinned by `finance-errors.test.ts`).
 */
export const FINANCE_ERROR_KEYS = [
  'flatNotFound',
  'flatInactive',
  'chargeNotFound',
  'replacesNotVoid',
  'alreadyReplaced',
  'voidRunInstead',
  'invalidCursor',
  'periodOutOfRange',
  'alreadyVoid',
  'hasAllocations',
  'voidNotAllowed',
  'reasonRequired',
  'periodClosed',
  'invalidPeriod',
  'invalidPeriodRange',
  'invalidAmount',
  'amountPrecision',
  'amountOutOfRange',
  'idempotencyKeyRequired',
  'idempotencyConflict',
  'paymentNotFound',
  'futureDate',
  'receivedOutOfRange',
  'allocationExceedsPayment',
  'allocationExceedsCharge',
  'allocationChargeNotOpen',
  'duplicateAllocation',
  'duplicateReference',
  'voidImportInstead',
  'notACheque',
  'alreadyFinal',
  'dateBeforeReceived',
  'insufficientCredit',
  'nothingToAllocate',
  'creditSourceConflict',
  'noFile',
  'attachmentType',
  'attachmentTooLarge',
  'attachmentInvalid',
  'attachmentExpired',
  'attachmentInUse',
  'attachmentNotFound',
  'attachmentQueryInvalid',
  'attachmentMissing',
  'dateBeforeAllocation',
  'creditChanged',
  'concurrentChange',
] as const;

export type FinanceErrorKey = (typeof FINANCE_ERROR_KEYS)[number];

const KEY_SET: ReadonlySet<string> = new Set(FINANCE_ERROR_KEYS);
const BACKEND_PREFIX = 'finance.error.';
export const FINANCE_CODE_PREFIX = 'finance.';

/** `finance.error.periodClosed` → `finance.periodClosed`; anything not allowlisted → undefined. */
export function financeCodeFromBackend(code: unknown): string | undefined {
  if (typeof code !== 'string' || !code.startsWith(BACKEND_PREFIX)) return undefined;
  const key = code.slice(BACKEND_PREFIX.length);
  return KEY_SET.has(key) ? `${FINANCE_CODE_PREFIX}${key}` : undefined;
}

/** The finance key of a BFF error code (`finance.periodClosed` → `periodClosed`), if it is one. */
export function financeKeyOf(code: string): FinanceErrorKey | undefined {
  if (!code.startsWith(FINANCE_CODE_PREFIX)) return undefined;
  const key = code.slice(FINANCE_CODE_PREFIX.length);
  return KEY_SET.has(key) ? (key as FinanceErrorKey) : undefined;
}
