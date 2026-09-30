import type { AuthUser } from "@/store/slices/auth-slice";

import axios from "axios";
import Env from "env";

import { client } from "./client";

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

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
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

  logout: (refreshToken: string) =>
    client.post<{ data: { success: boolean } }>("/auth/logout", { refreshToken }),

  forgotPassword: (email: string) =>
    client.post<{ data: { message: string } }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    client.post<{ data: { message: string } }>("/auth/reset-password", { token, password }),

  acceptInvitation: (token: string, name: string, password: string) =>
    client.post<{ data: AuthResponse }>("/auth/accept-invitation", { token, name, password }),

  updatePushToken: (pushToken: string) =>
    client.patch<{ data: { success: boolean } }>("/auth/push-token", { pushToken }),

  // Raw axios refresh — bypasses the 401 interceptor (used by biometric login flow).
  refresh: (refreshToken: string) =>
    axios.post<{ data: AuthTokens }>(
      `${Env.EXPO_PUBLIC_API_URL}/v1/auth/refresh`,
      { refreshToken },
    ),
};
