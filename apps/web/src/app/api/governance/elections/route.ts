import { NextRequest, NextResponse } from 'next/server';

import { getElections } from '@/lib/api/governance.server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const page = await getElections(request.nextUrl.searchParams.get('cursor') ?? undefined, { session: { mutateCookies: true } });
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Elections proxy failed', error);
    return NextResponse.json({ error: 'Elections are temporarily unavailable.' }, { status: 502 });
  }
}