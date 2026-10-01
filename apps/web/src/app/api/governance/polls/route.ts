import { NextRequest, NextResponse } from 'next/server';

import { getPolls } from '@/lib/api/governance.server';

export async function GET(request: NextRequest) {
  try {
    const page = await getPolls(request.nextUrl.searchParams.get('cursor') ?? undefined, true);
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Polls proxy failed', error);
    return NextResponse.json({ error: 'Polls are temporarily unavailable.' }, { status: 502 });
  }
}