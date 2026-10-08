/**
 * Session lifecycle helpers shared by every login and logout path, so token
 * storage, cache reset, socket teardown, push registration and post-login
 * routing behave identically everywhere.
 */

import type { Href } from "expo-router";
import type { AuthUser } from "@/store/slices/auth-slice";
import { router } from "expo-router";

import {
  clearBiometricPreference,
  forgetKeptBiometricSession,
  isBiometricBoundTo,
  reconcileBiometricForLogin,
} from "@/lib/biometric-binding";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage";
import { authApi, revokeRefreshToken } from "@/services/api/auth";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/secure-keys";
import { usersApi } from "@/services/api/users";
import { clearRegisteredPushToken, registerPushToken } from "@/services/push";
import { queryClient } from "@/services/query/client";
import { disconnectSocket } from "@/services/socket/client";
import { store } from "@/store";
import { clearPendingRedirect, login, logout } from "@/store/slices/auth-slice";

export const DEFAULT_HOME_ROUTE = "/(tabs)";

const ROLE_HOME_ROUTE: Record<AuthUser["role"], string> = {
  RESIDENT: DEFAULT_HOME_ROUTE,
  MERCHANT: "/(merchant)/dashboard",
  ADMIN: "/(admin)",
  SUPER_ADMIN: "/(admin)",
};

/**
 * Where to go after a successful login: the route the guest was trying to
 * reach (auth-wall replay) wins; otherwise the role's home.
 * Auth routes are never valid replay targets.
 */
export function getPostLoginRoute(role: AuthUser["role"] | undefined, pendingRedirect: string | null | undefined): string {
  if (pendingRedirect && !pendingRedirect.startsWith("/(auth)"))
    return pendingRedirect;
  return (role && ROLE_HOME_ROUTE[role]) || DEFAULT_HOME_ROUTE;
}

export async function completeLogin({ user, accessToken, refreshToken }: {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  // Biometric sign-in belongs to one account: a login by another account
  // forgets it (and the refresh token kept for it) BEFORE the new tokens land.
  await reconcileBiometricForLogin(user.email);
  await setSecureItem(SECURE_KEY_ACCESS, accessToken);
  await setSecureItem(SECURE_KEY_REFRESH, refreshToken);
  // A socket opened by a previous session must not keep the old identity.
  disconnectSocket();
  queryClient.clear();
  const pendingRedirect = store.getState().auth.pendingRedirect;
  store.dispatch(login({ user, accessToken, refreshToken }));
  store.dispatch(clearPendingRedirect());
  await registerPushToken();
  router.replace(getPostLoginRoute(user.role, pendingRedirect) as Href);
}

/**
 * Ends the local session. `keepRefreshToken` supports biometric sign-in,
 * which re-uses the stored refresh token after a local-only logout.
 * Never touches the network. The store is signed out and the login screen
 * shown even if a SecureStore delete throws.
 */
export async function teardownSession({ keepRefreshToken = false, redirectToLogin = true }: {
  keepRefreshToken?: boolean;
  redirectToLogin?: boolean;
} = {}): Promise<void> {
  try {
    disconnectSocket();
    await deleteSecureItem(SECURE_KEY_ACCESS);
    if (!keepRefreshToken)
      await deleteSecureItem(SECURE_KEY_REFRESH);
    await clearRegisteredPushToken();
  }
  finally {
    store.dispatch(logout());
    queryClient.clear();
    if (redirectToLogin)
      router.replace("/(auth)/login");
  }
}

async function readSecureOrNull(key: string): Promise<string | null> {
  try {
    return await getSecureItem(key);
  }
  catch {
    return null;
  }
}

/**
 * User-initiated sign-out. Only when biometric sign-in is on for THIS account
 * is the refresh token kept (and not revoked) for the one-tap sign-in;
 * otherwise a preference left over for another account is dropped, the
 * session is torn down locally, and only THEN is the captured refresh token
 * revoked server-side in the background, so a slow or dead network (or an
 * app kill) can never leave the device signed in.
 */
export async function signOut(userEmail: string | null | undefined): Promise<void> {
  const keepForBiometric = await isBiometricBoundTo(userEmail).catch(() => false);
  if (keepForBiometric) {
    await teardownSession({ keepRefreshToken: true });
    return;
  }
  const [accessToken, refreshToken] = await Promise.all([
    readSecureOrNull(SECURE_KEY_ACCESS),
    readSecureOrNull(SECURE_KEY_REFRESH),
  ]);
  try {
    await clearBiometricPreference();
  }
  catch {
    // A stale preference without a refresh token only shows "session expired".
  }
  finally {
    await teardownSession();
  }
  // Revokes server-side even when the access token has expired. Never awaited.
  Promise.resolve()
    .then(() => revokeRefreshToken(refreshToken, accessToken))
    .catch(() => {});
}

/**
 * After `DELETE /user` succeeded: the server already invalidated every
 * token, so only the local session and the biometric preference go.
 */
export async function endDeletedAccountSession(): Promise<void> {
  try {
    await clearBiometricPreference();
  }
  catch {
    // Teardown below removes the refresh token either way.
  }
  finally {
    await teardownSession();
  }
}

export type BiometricSignInResult
  = | "signed_in"
    /** No kept refresh token: the biometric session is gone. */
    | "no_kept_session"
    /** The kept refresh token (or the access token it produced) was rejected. */
    | "expired"
    /** The kept token belongs to another account than the one biometric is bound to. */
    | "account_mismatch"
    /** Another sign-in finished first; nothing was stored. */
    | "aborted"
    /** Offline / timeout / 5xx: the (rotated) refresh token is kept for a retry. */
    | "unreachable";

/** Upper bound for the best-effort revocation of a token this device dropped. */
export const DROPPED_TOKEN_REVOKE_TIMEOUT_MS = 15_000;

function isSignedIn(): boolean {
  return store.getState().auth.isAuthenticated === true;
}

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } } | null)?.response?.status;
}

/** Fire-and-forget, bounded server-side revocation of a token pair this device no longer keeps. */
function revokeDroppedTokens(refreshToken: string, accessToken: string): void {
  Promise.resolve()
    .then(() => authApi.logout(refreshToken, accessToken, DROPPED_TOKEN_REVOKE_TIMEOUT_MS))
    .catch(() => {});
}

/**
 * Signed-out only: the kept biometric session is dead. Never runs once
 * another sign-in owns the stored tokens.
 */
async function forgetDeadKeptSession(): Promise<void> {
  if (isSignedIn())
    return;
  await deleteSecureItem(SECURE_KEY_ACCESS);
  await forgetKeptBiometricSession();
}

/**
 * One-tap biometric sign-in with the refresh token kept after sign-out
 * (the caller has already passed the device biometric prompt).
 *
 * The access token is written ONLY by `completeLogin`, after the profile it
 * belongs to is confirmed to be the account biometric is bound to. Until
 * then the rotated refresh token is the only thing stored (the old one is
 * spent), so an interrupted flow never leaves a session a relaunch could
 * restore. Every write or delete first checks that no other sign-in (the
 * password form) has taken over the stored tokens meanwhile.
 */
export async function signInWithKeptBiometricSession(): Promise<BiometricSignInResult> {
  if (isSignedIn())
    return "aborted";
  const keptRefresh = await getSecureItem(SECURE_KEY_REFRESH);
  if (!keptRefresh) {
    await forgetDeadKeptSession();
    return "no_kept_session";
  }

  let accessToken: string;
  let rotatedRefresh: string;
  try {
    const { data } = await authApi.refresh(keptRefresh);
    accessToken = data.data.accessToken;
    rotatedRefresh = data.data.refreshToken;
  }
  catch (err) {
    const status = httpStatus(err);
    if (status === 401 || status === 403) {
      await forgetDeadKeptSession();
      return "expired";
    }
    return "unreachable";
  }

  // The password form signed in (or replaced the kept token) while the
  // refresh was in flight: its tokens win, this pair is dropped.
  if (isSignedIn() || await getSecureItem(SECURE_KEY_REFRESH) !== keptRefresh) {
    revokeDroppedTokens(rotatedRefresh, accessToken);
    return "aborted";
  }
  // The kept token is spent: keep the rotated one in its place, and nothing else.
  await setSecureItem(SECURE_KEY_REFRESH, rotatedRefresh);

  let user: AuthUser;
  try {
    // Explicit Bearer: the access token is not stored, and a signed-out 401
    // never triggers the refresh interceptor.
    const { data } = await usersApi.getProfile(accessToken);
    user = data.data;
  }
  catch (err) {
    if (isSignedIn()) {
      revokeDroppedTokens(rotatedRefresh, accessToken);
      return "aborted";
    }
    const status = httpStatus(err);
    if (status === 401 || status === 403) {
      await forgetDeadKeptSession();
      revokeDroppedTokens(rotatedRefresh, accessToken);
      return "expired";
    }
    return "unreachable";
  }

  if (isSignedIn()) {
    revokeDroppedTokens(rotatedRefresh, accessToken);
    return "aborted";
  }

  // Read the binding fresh: the screen's state predates this sign-in.
  if (!await isBiometricBoundTo(user.email)) {
    // Local first, so an app kill here can never leave the other account's
    // session behind; the server revocation is best effort afterwards.
    await forgetDeadKeptSession();
    revokeDroppedTokens(rotatedRefresh, accessToken);
    return "account_mismatch";
  }

  await completeLogin({ user, accessToken, refreshToken: rotatedRefresh });
  return "signed_in";
}
