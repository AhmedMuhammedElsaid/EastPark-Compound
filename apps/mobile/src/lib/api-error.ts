/** Helpers for classifying axios-style errors without importing axios. */

export function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null | undefined)?.response?.status;
}

/** A dotted message key such as `user.error.accountDeleted` (not prose). */
const MESSAGE_KEY = /^[a-z][a-z0-9]*(?:\.\w+)+$/i;

/**
 * The backend's stable error code (the untranslated message key, e.g.
 * `user.error.accountDeleted`). Older backends sent the raw key only in
 * `message`, so a dotted key there is accepted too; prose never is.
 */
export function getErrorCode(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { code?: unknown; message?: unknown } } } | null | undefined)?.response?.data;
  for (const value of [data?.code, data?.message]) {
    if (typeof value === "string" && MESSAGE_KEY.test(value))
      return value;
  }
  return undefined;
}

export const ACCOUNT_DELETED_CODE = "user.error.accountDeleted";

/** 409 for an email that belongs to a soft-deleted account. */
export function isAccountDeletedError(error: unknown): boolean {
  return getErrorStatus(error) === 409 && getErrorCode(error) === ACCOUNT_DELETED_CODE;
}

/** 409 when an invited flat is already owned by another account. */
export const UNIT_ALREADY_OWNED_CODE = "unit.error.alreadyOwned";

/**
 * Toast copy for a failed accept-invitation. The backend's 409s:
 * - `user.error.accountDeleted`: the email belongs to a deleted account.
 * - `unit.error.alreadyOwned`: the invited flat belongs to another account.
 * - no code (prose message): the email already has an account and the
 *   password field must hold its CURRENT password.
 * Only the last one may show the "enter your current password" hint: no
 * password helps with the other two.
 */
export function acceptInvitationErrorKey(error: unknown): string {
  if (getErrorStatus(error) !== 409)
    return "common.error";
  const code = getErrorCode(error);
  if (code === ACCOUNT_DELETED_CODE)
    return "auth.errors.invitation_account_deleted";
  if (code === UNIT_ALREADY_OWNED_CODE)
    return "auth.errors.invitation_unit_owned";
  return code === undefined ? "auth.errors.invitation_existing_account" : "common.error";
}

/** Toast copy for a failed admin invitation send. */
export function sendInvitationErrorKey(error: unknown): string {
  if (isAccountDeletedError(error))
    return "admin.invite_account_deleted";
  return getErrorStatus(error) === 403 ? "admin.invite_forbidden" : "common.error";
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
