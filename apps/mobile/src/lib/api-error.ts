/** Helpers for classifying axios-style errors without importing axios. */

export function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null | undefined)?.response?.status;
}

/** True when the request produced no HTTP response (timeout, offline, DNS). */
export function isNoResponseError(error: unknown): boolean {
  return getErrorStatus(error) === undefined;
}

/**
 * Pick a translation key for a failed mutation from a status -> key map,
 * falling back to `fallbackKey`. Network errors use the `network` entry.
 */
export function pickErrorKey(
  error: unknown,
  map: Partial<Record<number | "network", string>>,
  fallbackKey: string,
): string {
  const status = getErrorStatus(error);
  if (status === undefined)
    return map.network ?? fallbackKey;
  return map[status] ?? fallbackKey;
}

/** Toast copy for mutations, keyed by HTTP status (see backend services). */
export const VOTE_ERROR_KEYS = {
  400: "governance.error_expired", // poll/election.error.expired
  403: "errors.forbidden",
  404: "errors.unknown",
  409: "governance.error_already_voted", // *.error.alreadyVoted
  429: "errors.rate_limited",
  network: "errors.unreachable",
} as const;

export const CANCEL_ORDER_ERROR_KEYS = {
  400: "orders.error_cannot_cancel_started", // cannotCancelAfterConfirmation
  403: "errors.forbidden",
  409: "orders.error_cannot_cancel_paid", // cannotCancelPaidOrder / statusChanged
  429: "errors.rate_limited",
  network: "errors.unreachable",
} as const;

export const COMMENT_ERROR_KEYS = {
  403: "errors.forbidden",
  429: "errors.rate_limited",
  network: "errors.unreachable",
} as const;
