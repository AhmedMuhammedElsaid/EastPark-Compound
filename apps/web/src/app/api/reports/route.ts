import { NextRequest, NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getReports } from '@/lib/api/reports.server';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor')?.trim() || undefined;

  try {
    const page = await getReports(cursor, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: page });
  } catch (error) {
    return bffErrorResponse(error, 'Reports proxy failed');
  }
}