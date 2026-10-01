import 'server-only';

import { authenticatedBackendFetch as fetchWithAuth } from '@/lib/auth/server';

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
  const response = await fetchWithAuth(path, init);
  if (!response || response.status === 401) {
    throw new AuthenticatedRequestError('Authentication required', 401);
  }
  return response;
}