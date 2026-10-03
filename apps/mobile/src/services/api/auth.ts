import type { AuthUser } from "@/store/slices/auth-slice";

import { getSecureItem } from "@/lib/secure-storage";

import { client, requestTokenRefresh } from "./client";
import { SECURE_KEY_REFRESH } from "./secure-keys";

export type { AuthTokens } from "./client";

export type RegisterPayload = {
  name: string;
  email: string;
  phone: string;
  unitNumber: string;
  password: string;
};

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
  register: (payload: RegisterPayload) =>
    client.post<{ data: { message: string } }>("/auth/register", payload),

  verifyOtp: (email: string, otp: string) =>
    client.post<{ data: AuthResponse }>("/auth/verify-otp", { email, otp }),

  resendOtp: (email: string) =>
    client.post<{ data: { message: string } }>("/auth/resend-otp", { email }),

  login: (payload: LoginPayload) =>
    client.post<{ data: AuthResponse }>("/auth/login", payload),

  // Bearer ACCESS token (attached by the request interceptor unless given
  // explicitly) + the refresh token to revoke in the body.
  logout: (refreshToken: string, accessToken?: string) =>
    client.post<{ data: { message: string } }>(
      "/auth/logout",
      { refreshToken },
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
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

/**
 * Best-effort server-side revocation of the stored refresh token before a
 * local logout. `POST /auth/logout` needs a valid ACCESS token, which expires
 * after 15 minutes, and logout is exempt from the 401 refresh interceptor.
 * Without this, a user idle for 15+ minutes "logs out" while the refresh
 * token stays valid for 7 days. On 401 we rotate once (raw call: no global
 * session-expiry side effects) and revoke the NEW refresh token, because the
 * rotation already spent the old one. Never throws; the caller tears down
 * the local session regardless.
 */
export async function revokeRefreshToken(): Promise<void> {
  const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
  if (!refreshToken)
    return;
  try {
    await authApi.logout(refreshToken);
    return;
  }
  catch (err) {
    if (httpStatus(err) !== 401)
      return;
  }
  try {
    const { data } = await requestTokenRefresh(refreshToken);
    const { accessToken, refreshToken: rotated } = data.data;
    await authApi.logout(rotated, accessToken);
  }
  catch {
    // Refresh token already expired/revoked or offline: nothing more to do.
  }
}
