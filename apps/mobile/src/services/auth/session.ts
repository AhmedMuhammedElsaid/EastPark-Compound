/**
 * Session lifecycle helpers shared by every login and logout path, so token
 * storage, cache reset, socket teardown, push registration and post-login
 * routing behave identically everywhere.
 */

import type { Href } from "expo-router";
import type { AuthUser } from "@/store/slices/auth-slice";
import { router } from "expo-router";

import { clearBiometricPreference, isBiometricBoundTo, reconcileBiometricForLogin } from "@/lib/biometric-binding";
import { deleteSecureItem, setSecureItem } from "@/lib/secure-storage";
import { revokeRefreshToken } from "@/services/api/auth";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/secure-keys";
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
 */
export async function teardownSession({ keepRefreshToken = false, redirectToLogin = true }: {
  keepRefreshToken?: boolean;
  redirectToLogin?: boolean;
} = {}): Promise<void> {
  disconnectSocket();
  await deleteSecureItem(SECURE_KEY_ACCESS);
  if (!keepRefreshToken)
    await deleteSecureItem(SECURE_KEY_REFRESH);
  await clearRegisteredPushToken();
  store.dispatch(logout());
  queryClient.clear();
  if (redirectToLogin)
    router.replace("/(auth)/login");
}

/**
 * User-initiated sign-out. Only when biometric sign-in is on for THIS account
 * is the refresh token kept (and not revoked) for the one-tap sign-in;
 * otherwise it is revoked server-side and deleted, and a preference left over
 * for another account is dropped with it.
 */
export async function signOut(userEmail: string | null | undefined): Promise<void> {
  if (await isBiometricBoundTo(userEmail)) {
    await teardownSession({ keepRefreshToken: true });
    return;
  }
  // Revokes server-side even when the access token has expired.
  await revokeRefreshToken();
  await clearBiometricPreference();
  await teardownSession();
}
