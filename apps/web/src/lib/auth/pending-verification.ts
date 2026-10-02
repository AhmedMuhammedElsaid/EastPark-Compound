/**
 * Hands the just-registered email to `/verify-otp` without putting it in the URL (history, logs,
 * referrers). sessionStorage can be unavailable (privacy modes) — callers fall back gracefully.
 */
const STORAGE_KEY = 'eastpark.pendingVerificationEmail';

export function rememberPendingVerification(email: string): boolean {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, email);
    return true;
  } catch {
    return false;
  }
}

export function readPendingVerification(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingVerification(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
