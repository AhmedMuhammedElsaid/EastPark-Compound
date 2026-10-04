/**
 * Session lifecycle helpers shared by every login and logout path, so token
 * storage, cache reset, socket teardown, push registration and post-login
 * routing behave identically everywhere.
 */

import type { Href } from "expo-router";
import type { AuthUser } from "@/store/slices/auth-slice";
import { router } from "expo-router";

import { deleteSecureItem, setSecureItem } from "@/lib/secure-storage";
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
