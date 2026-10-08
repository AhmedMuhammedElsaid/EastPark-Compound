import type { AuthUser } from "@/store/slices/auth-slice";

import { client, requestTokenRefresh } from "./client";

export type { AuthTokens } from "./client";

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export const authApi = {
  login: (payload: LoginPayload) =>
    client.post<{ data: AuthResponse }>("/auth/login", payload),

  // Bearer ACCESS token (attached by the request interceptor unless given
  // explicitly) + the refresh token to revoke in the body.
  logout: (refreshToken: string, accessToken?: string, timeout?: number) =>
    client.post<{ data: { message: string } }>(
      "/auth/logout",
      { refreshToken },
      {
        ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
        ...(timeout ? { timeout } : {}),
      },
    ),

  forgotPassword: (email: string) =>
    client.post<{ data: { message: string } }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    client.post<{ data: { message: string } }>("/auth/reset-password", { token, password }),

  acceptInvitation: (token: string, name: string, password: string) =>
    client.post<{ data: AuthResponse }>("/auth/accept-invitation", { token, name, password }),

  updatePushToken: (pushToken: string) =>
    client.patch<{ data: { success: boolean } }>("/auth/push-token", { pushToken }),

  // Bearer refresh token, bypassing the 401 interceptor (biometric login).
  // Refresh tokens are single-use: callers must persist the rotated token.
  refresh: (refreshToken: string) => requestTokenRefresh(refreshToken),
};

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } } | null)?.response?.status;
}

/** Upper bound for each logout call made by a background revocation. */
export const REVOKE_TIMEOUT_MS = 15_000;

/**
 * Best-effort server-side revocation of a refresh token the device has
 * ALREADY dropped locally (callers capture the tokens, tear down, then call
 * this). `POST /auth/logout` needs a valid ACCESS token, which expires after
 * 15 minutes, and logout is exempt from the 401 refresh interceptor. The
 * access token is always sent explicitly: after teardown the stored one may
 * belong to a newer session. Without an access token, or on 401, it rotates
 * once (raw call: no global session-expiry side effects) and revokes the NEW
 * refresh token, because the rotation already spent the old one. Never throws.
 */
export async function revokeRefreshToken(
  refreshToken: string | null | undefined,
  accessToken?: string | null,
): Promise<void> {
  if (!refreshToken)
    return;
  if (accessToken) {
    try {
      await authApi.logout(refreshToken, accessToken, REVOKE_TIMEOUT_MS);
      return;
    }
    catch (err) {
      if (httpStatus(err) !== 401)
        return;
    }
  }
  try {
    const { data } = await requestTokenRefresh(refreshToken);
    const { accessToken: freshAccess, refreshToken: rotated } = data.data;
    await authApi.logout(rotated, freshAccess, REVOKE_TIMEOUT_MS);
  }
  catch {
    // Refresh token already expired/revoked or offline: nothing more to do.
  }
}
