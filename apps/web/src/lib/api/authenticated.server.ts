import 'server-only';

import {
  authCookies,
  backendFetch,
  bearer,
  clearAuthCookies,
  refreshAuthTokens,
} from '@/lib/auth/server';

export class AuthenticatedRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthenticatedRequestError';
  }
}

export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const tokens = await authCookies();
  let accessToken = tokens.accessToken;

  if (!accessToken && tokens.refreshToken) {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    accessToken = refreshed?.accessToken;
  }

  if (!accessToken) {
    await clearAuthCookies();
    throw new AuthenticatedRequestError('Authentication required', 401);
  }

  let response = await requestWithToken(path, accessToken, init);
  if (response.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    if (refreshed) {
      response = await requestWithToken(path, refreshed.accessToken, init);
    }
  }

  if (response.status === 401) {
    await clearAuthCookies();
    throw new AuthenticatedRequestError('Authentication required', 401);
  }

  return response;
}

function requestWithToken(path: string, accessToken: string, init: RequestInit): Promise<Response> {
  return backendFetch(path, {
    ...init,
    headers: {
      ...init.headers,
      ...bearer(accessToken),
    },
  });
}