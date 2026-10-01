import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/admin.server';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!('response' in auth)) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (auth.response.status === 401) {
    return NextResponse.redirect(new URL('/login?next=%2Fadmin', request.url));
  }

  return auth.response;
}