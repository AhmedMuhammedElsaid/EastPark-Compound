/**
 * Biometric sign-in is bound to ONE account: the email stored next to the
 * preference. The refresh token kept for it after sign-out must belong to
 * that account, otherwise the labelled "Sign in as <email>" button would
 * restore somebody else's session.
 *
 * SecureStore-only helpers (no native biometric or i18n imports) so the
 * session lifecycle can use and test them.
 */
import {
  deleteSecureItem,
  getSecureItem,
} from "@/lib/secure-storage";
import {
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/secure-keys";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isSameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a);
  return left.length > 0 && left === normalizeEmail(b);
}

/** Turns biometric sign-in off. The session's refresh token is left alone. */
export async function clearBiometricPreference(): Promise<void> {
  await Promise.all([
    deleteSecureItem(SECURE_KEY_BIOMETRIC_ENABLED),
    deleteSecureItem(SECURE_KEY_BIOMETRIC_EMAIL),
  ]);
}

/**
 * Signed-out only: the refresh token kept for biometric sign-in is dead
 * (rejected, missing or not the labelled account's), so drop it together
 * with the preference.
 */
export async function forgetKeptBiometricSession(): Promise<void> {
  await Promise.all([
    clearBiometricPreference(),
    deleteSecureItem(SECURE_KEY_REFRESH),
  ]);
}

/** True only when biometric sign-in is on AND bound to this account. */
export async function isBiometricBoundTo(email: string | null | undefined): Promise<boolean> {
  const [enabled, boundEmail] = await Promise.all([
    getSecureItem(SECURE_KEY_BIOMETRIC_ENABLED),
    getSecureItem(SECURE_KEY_BIOMETRIC_EMAIL),
  ]);
  return enabled === "1" && isSameEmail(boundEmail, email);
}

/**
 * Called on every successful login BEFORE the new tokens are stored. When
 * biometric sign-in belongs to a different account (or is half-configured),
 * the preference and the refresh token kept for it are forgotten, so the new
 * account starts with biometric off. The same account keeps it.
 */
export async function reconcileBiometricForLogin(email: string): Promise<void> {
  const [enabled, boundEmail] = await Promise.all([
    getSecureItem(SECURE_KEY_BIOMETRIC_ENABLED),
    getSecureItem(SECURE_KEY_BIOMETRIC_EMAIL),
  ]);
  if (enabled === null && boundEmail === null)
    return;
  if (enabled === "1" && isSameEmail(boundEmail, email))
    return;
  await forgetKeptBiometricSession();
}
