import type { ApiEnvelope, AuthTokens } from '@/lib/api/contracts';

import { cookies } from 'next/headers';

const ACCESS_COOKIE = 'eastpark_access';
const REFRESH_COOKIE = 'eastpark_refresh';
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
const API_TIMEOUT_MS = 10_000;

function apiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/+$/, '');
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase()}/v1${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

export async function authCookies(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

export async function setAuthCookies(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };

  store.set(ACCESS_COOKIE, tokens.accessToken, { ...shared, maxAge: ACCESS_MAX_AGE });
  store.set(REFRESH_COOKIE, tokens.refreshToken, { ...shared, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokens | null> {
  const response = await backendFetch('/auth/refresh', {
    method: 'POST',
    headers: { ...bearer(refreshToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as ApiEnvelope<AuthTokens>;
  await setAuthCookies(payload.data);
  return payload.data;
}

export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const tokens = await authCookies();

  if (tokens.accessToken) {
    const response = await backendFetch(path, {
      ...init,
      headers: { ...init.headers, ...bearer(tokens.accessToken) },
    });
    if (response.status !== 401) return response;
  }

  if (tokens.refreshToken) {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    if (refreshed) {
      return backendFetch(path, {
        ...init,
        headers: { ...init.headers, ...bearer(refreshed.accessToken) },
      });
    }
  }

  await clearAuthCookies();
  return null;
}

export function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function authenticatedBackendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const tokens = await authCookies();
  let accessToken = tokens.accessToken;

  if (!accessToken && tokens.refreshToken) {
    accessToken = (await refreshAuthTokens(tokens.refreshToken))?.accessToken;
  }
  if (!accessToken) return null;

  const request = (token: string) =>
    backendFetch(path, {
      ...init,
      headers: { ...init?.headers, ...bearer(token) },
    });

  let response = await request(accessToken);
  if (response.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    if (refreshed) response = await request(refreshed.accessToken);
  }

  if (response.status === 401) await clearAuthCookies();
  return response;
}
