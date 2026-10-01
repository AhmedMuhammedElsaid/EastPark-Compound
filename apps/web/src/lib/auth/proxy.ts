import { authCookies, backendFetch, refreshAuthTokens } from '@/lib/auth/server';

export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const tokens = await authCookies();
  let accessToken = tokens.accessToken;

  if (!accessToken && tokens.refreshToken) {
    accessToken = (await refreshAuthTokens(tokens.refreshToken))?.accessToken;
  }
  if (!accessToken) return null;

  let response = await backendFetch(path, withBearer(init, accessToken));
  if (response.status !== 401 || !tokens.refreshToken) return response;

  const refreshed = await refreshAuthTokens(tokens.refreshToken);
  if (!refreshed) return response;
  response = await backendFetch(path, withBearer(init, refreshed.accessToken));
  return response;
}

function withBearer(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}