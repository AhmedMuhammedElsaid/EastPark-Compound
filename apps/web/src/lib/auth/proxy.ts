import { authenticatedBackendFetch as sessionBackendFetch } from '@/lib/auth/server';

/**
 * Route-handler shorthand for the shared backend client: refreshes and rotates session cookies when
 * needed. Never import this from a Server Component (use `mutateCookies: false` there).
 */
export function authenticatedBackendFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  return sessionBackendFetch(path, init, { mutateCookies: true });
}
