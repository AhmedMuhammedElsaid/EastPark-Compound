import { NextRequest, NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getPolls } from '@/lib/api/governance.server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const page = await getPolls(request.nextUrl.searchParams.get('cursor') ?? undefined, { session: { mutateCookies: true } });
    return NextResponse.json({ data: page });
  } catch (error) {
    return bffErrorResponse(error, 'Polls proxy failed');
  }
}
