import type { AuthUser } from '@/lib/api/contracts';

/**
 * Tri-state result of `GET /api/auth/session`. Only `signed_out` (a 200 with `user: null`) may log
 * the browser out; a throttled (429), unavailable (503) or unreachable backend is `unknown` and must
 * never be treated as a sign-out.
 */
export type SessionCheck =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'signed_out' }
  | { status: 'unknown' };

export async function readSessionCheck(response: Response): Promise<SessionCheck> {
  if (!response.ok) return { status: 'unknown' };
  const payload = (await response.json().catch(() => null)) as { data?: { user?: AuthUser | null } } | null;
  if (!payload?.data || !('user' in payload.data)) return { status: 'unknown' };
  return payload.data.user ? { status: 'authenticated', user: payload.data.user } : { status: 'signed_out' };
}

/**
 * Collapses concurrent callers onto one in-flight check, so N parallel 401s cost a single
 * `/api/auth/session` request.
 */
export function shareInFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= task().finally(() => {
      pending = null;
    });
    return pending;
  };
}
