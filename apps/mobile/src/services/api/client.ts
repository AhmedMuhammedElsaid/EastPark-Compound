/**
 * EastPark Axios client
 * - Attaches Bearer token from SecureStore on every request
 * - Queues 401s while a single token refresh is in-flight
 * - On refresh failure: dispatches logout() and navigates to /login
 */

import type { InternalAxiosRequestConfig } from "axios";

import axios from "axios";
import Env from "env";
import { router } from "expo-router";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage";
import { queryClient } from "@/services/query/client";

import { logout, updateTokens } from "@/store/slices/auth-slice";

// Lazy import to avoid circular deps at module init time
let storeRef: typeof import("@/store").store | null = null;
export function injectStore(store: typeof import("@/store").store) {
  storeRef = store;
}

export const SECURE_KEY_ACCESS = "eastpark_access_token";
export const SECURE_KEY_REFRESH = "eastpark_refresh_token";
export const SECURE_KEY_BIOMETRIC_ENABLED = "eastpark_biometric_enabled";
export const SECURE_KEY_BIOMETRIC_EMAIL = "eastpark_biometric_email";

export const client = axios.create({
  baseURL: `${Env.EXPO_PUBLIC_API_URL}/v1`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getSecureItem(SECURE_KEY_ACCESS);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── 401 refresh queue ────────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    }
    else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request until the refresh resolves
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return client(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
      if (!refreshToken)
        throw new Error("No refresh token");

      const { data } = await axios.post(
        `${Env.EXPO_PUBLIC_API_URL}/v1/auth/refresh`,
        { refreshToken },
      );

      const { accessToken, refreshToken: newRefresh } = data.data;

      // Persist new tokens
      await setSecureItem(SECURE_KEY_ACCESS, accessToken);
      await setSecureItem(SECURE_KEY_REFRESH, newRefresh);

      // Update Redux in-memory copy
      storeRef?.dispatch(updateTokens({ accessToken, refreshToken: newRefresh }));

      processQueue(null, accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return client(originalRequest);
    }
    catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh failed — force logout
      await deleteSecureItem(SECURE_KEY_ACCESS);
      await deleteSecureItem(SECURE_KEY_REFRESH);
      storeRef?.dispatch(logout());
      queryClient.clear();
      router.replace("/(auth)/login");

      return Promise.reject(refreshError);
    }
    finally {
      isRefreshing = false;
    }
  },
);
