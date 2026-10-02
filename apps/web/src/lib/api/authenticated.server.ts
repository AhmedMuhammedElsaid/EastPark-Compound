import 'server-only';

import { sessionFetch, type SessionOptions } from '@/lib/auth/server';

export type { SessionOptions } from '@/lib/auth/server';

/** Route handlers: refresh and rotate session cookies when needed. */
export const ROUTE_SESSION: SessionOptions = { mutateCookies: true };
/** Server Components: read-only; an expired session surfaces as `refreshRequired`. */
export const RENDER_SESSION: SessionOptions = { mutateCookies: false };

export class AuthenticatedRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Only in read-only (RSC) mode: redirect through `sessionRefreshPath()` instead of login. */
    readonly refreshRequired = false,
  ) {
    super(message);
    this.name = 'AuthenticatedRequestError';
  }
}

export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit,
  session: SessionOptions,
): Promise<Response> {
  const result = await sessionFetch(path, init, session);
  if (result.status === 'ok') {
    if (result.response.status === 401) throw new AuthenticatedRequestError('Authentication required', 401);
    return result.response;
  }
  throw new AuthenticatedRequestError(
    'Authentication required',
    401,
    result.status === 'refresh-required',
  );
}
