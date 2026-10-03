import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import {
  ACCESS_COOKIE_NAME,
  HOME_PATH,
  REFRESH_COOKIE_NAME,
  RESIDENT_HOME_ONLY,
  isBlockedApiPath,
  isBlockedPagePath,
  isRestrictedRole,
  roleFromToken,
} from '@/config/access-policy';

export function proxy(request: NextRequest) {
  if (!RESIDENT_HOME_ONLY) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isApi = isBlockedApiPath(pathname);
  if (!isApi && !isBlockedPagePath(pathname)) return NextResponse.next();

  const role =
    roleFromToken(request.cookies.get(ACCESS_COOKIE_NAME)?.value) ??
    roleFromToken(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
  if (!isRestrictedRole(role)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.redirect(new URL(HOME_PATH, request.url));
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/announcements/:path*',
    '/cart/:path*',
    '/checkout/:path*',
    '/feedback/:path*',
    '/governance/:path*',
    '/merchant/:path*',
    '/notifications/:path*',
    '/orders/:path*',
    '/reports/:path*',
    '/api/:path*',
  ],
};
