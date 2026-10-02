import type { AuthUser } from "@/store/slices/auth-slice";

import { client, requestTokenRefresh } from "./client";

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

  // Bearer ACCESS token (attached by the request interceptor) + the refresh
  // token to revoke in the body.
  logout: (refreshToken: string) =>
    client.post<{ data: { message: string } }>("/auth/logout", { refreshToken }),

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
