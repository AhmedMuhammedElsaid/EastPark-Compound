/**
 * EastPark Axios client
 * - Attaches the access token from SecureStore unless the caller already set
 *   an Authorization header (refresh/logout send the refresh token instead).
 * - Queues 401s while a single token refresh is in flight.
 * - Never tries to refresh for public auth endpoints (login, refresh, OTP, ...)
 *   or for requests that were sent without credentials (guests).
 * - Only ends the session when the refresh endpoint itself answers 401/403.
 *   Network errors, timeouts and 5xx keep the tokens so the user can retry.
 * - Always propagates the ORIGINAL request error to the caller.
 */

import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import axios from "axios";
import Env from "env";
import { getSecureItem, setSecureItem } from "@/lib/secure-storage";

import { updateTokens } from "@/store/slices/auth-slice";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "./secure-keys";

export {
  SECURE_KEY_ACCESS,
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "./secure-keys";

// Lazy injection to avoid circular deps at module init time
let storeRef: typeof import("@/store").store | null = null;
export function injectStore(store: typeof import("@/store").store) {
  storeRef = store;
}

// Called when the refresh token is definitively rejected (401/403).
// _layout.tsx injects the full session teardown (socket, cache, redirect).
type SessionExpiredHandler = () => void | Promise<void>;
let sessionExpiredHandler: SessionExpiredHandler | null = null;
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  sessionExpiredHandler = handler;
}

/**
 * Render's free tier cold-starts in 25-50 s. The timeout must outlast a cold
 * start, otherwise the very first request after idle always fails.
 */
export const API_TIMEOUT_MS = 60_000;

export const API_ROOT_URL = Env.EXPO_PUBLIC_API_URL;

export const client = axios.create({
  baseURL: `${API_ROOT_URL}/v1`,
  timeout: API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/**
 * POST /auth/refresh. The backend's JwtRefreshGuard reads the refresh token
 * from the Authorization header (authoritative); the body copy is kept for
 * the DTO. Uses raw axios so it never passes through the 401 interceptor.
 */
export function requestTokenRefresh(refreshToken: string) {
  return axios.post<{ data: AuthTokens }>(
    `${API_ROOT_URL}/v1/auth/refresh`,
    { refreshToken },
    {
      timeout: API_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}`,
      },
    },
  );
}

/**
 * Fire-and-forget wake-up ping for the Render free tier. `/health` is
 * version-neutral, so it lives outside the `/v1` base URL.
 */
export function warmUpServer(): void {
  axios
    .get(`${API_ROOT_URL}/health`, { timeout: API_TIMEOUT_MS })
    .catch(() => {
      // Ignored: this only exists to start the server early.
    });
}

/**
 * Public auth endpoints where a 401 means "bad credentials/token", never
 * "access token expired". `/auth/push-token` is authenticated and is NOT here.
 */
const REFRESH_EXEMPT_PATHS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/accept-invitation",
];

export function isRefreshExemptUrl(url?: string): boolean {
  if (!url)
    return false;
  const path = url.split("?")[0];
  return REFRESH_EXEMPT_PATHS.some(p => path === p || path.endsWith(p));
}

// ─── Request interceptor — attach Bearer token ────────────────────────────────
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!config.headers.Authorization) {
    const token = await getSecureItem(SECURE_KEY_ACCESS);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── 401 refresh (single in-flight promise) ───────────────────────────────────
// Refresh tokens are SINGLE-USE on the backend (rotated; reuse → 401). Every
// concurrent 401 must therefore share ONE refresh call, and the rotated pair
// is persisted to SecureStore before any waiting request is released.
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

function isAuthRejection(err: unknown): boolean {
  const status = (err as AxiosError | undefined)?.response?.status;
  return status === 401 || status === 403;
}

async function runTokenRefresh(): Promise<string> {
  try {
    // Read inside the single-flight so a caller that arrived after another
    // refresh rotated the token never submits the already-spent one.
    const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
    if (!refreshToken)
      throw new Error("No refresh token available");
    const { data } = await requestTokenRefresh(refreshToken);
    const { accessToken, refreshToken: newRefresh } = data.data;
    await setSecureItem(SECURE_KEY_ACCESS, accessToken);
    await setSecureItem(SECURE_KEY_REFRESH, newRefresh);
    storeRef?.dispatch(updateTokens({ accessToken, refreshToken: newRefresh }));
    return accessToken;
  }
  catch (refreshError) {
    // Only a definitive rejection of the refresh token ends the session.
    // Network errors, timeouts (cold start) and 5xx keep the tokens.
    if (isAuthRejection(refreshError)) {
      try {
        await sessionExpiredHandler?.();
      }
      catch {
        // Teardown must never mask the original error.
      }
    }
    throw refreshError;
  }
}

/** Returns a fresh access token, sharing one refresh call across callers. */
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = runTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

client.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (
      !originalRequest
      || error.response?.status !== 401
      || originalRequest._retry
      || isRefreshExemptUrl(originalRequest.url)
      // Guest request (no credentials sent): nothing to refresh.
      || !originalRequest.headers?.Authorization
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Another request already rotated the tokens while this one was in
    // flight: retry with the current access token instead of refreshing again
    // (a second refresh would be wasted work; the old refresh token is spent).
    const sentAuth = String(originalRequest.headers.Authorization);
    const currentAccess = await getSecureItem(SECURE_KEY_ACCESS);
    if (!refreshPromise && currentAccess && sentAuth !== `Bearer ${currentAccess}`) {
      originalRequest.headers.Authorization = `Bearer ${currentAccess}`;
      return client(originalRequest);
    }

    let accessToken: string;
    try {
      if (refreshPromise) {
        accessToken = await refreshPromise;
      }
      else {
        accessToken = await refreshAccessToken();
      }
    }
    catch {
      // Propagate the ORIGINAL request error, never the refresh error.
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
    return client(originalRequest);
  },
);
