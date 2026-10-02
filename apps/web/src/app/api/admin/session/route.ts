import { NextResponse } from 'next/server';

import { sessionRefreshPath } from '@/lib/auth/return-path';

/** Kept for existing links; the generic session bounce handles refresh and the return path. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL(sessionRefreshPath('/admin'), request.url));
}
