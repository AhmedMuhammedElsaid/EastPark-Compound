import type { AuthUser } from '@/lib/api/contracts';

import { isFinanceRole } from '@/lib/auth/roles';
import { getProfile } from '@/lib/auth/server';

export type FinanceSession =
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated' | 'refresh-required' | 'forbidden' | 'unavailable' | 'rate_limited' };

/**
 * Guard for the staff finance desk (mirrors `getAdminSession`). Accepts ACCOUNTANT, ADMIN and
 * SUPER_ADMIN (`isFinanceRole`); a MERCHANT or RESIDENT is `forbidden`. `allowRefresh` must be `true`
 * only in route handlers; the `/finance` layout (a Server Component) redirects through
 * `/api/auth/refresh` on `refresh-required`. The backend stays the authority on every request.
 */
export async function getFinanceSession(allowRefresh = false): Promise<FinanceSession> {
  const profile = await getProfile({ mutateCookies: allowRefresh });
  if (profile.status !== 'authenticated') return { status: profile.status };
  if (!isFinanceRole(profile.user.role)) return { status: 'forbidden' };
  return { status: 'authenticated', token: profile.accessToken, user: profile.user };
}
