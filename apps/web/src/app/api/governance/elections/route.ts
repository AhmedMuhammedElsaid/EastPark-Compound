import { NextRequest, NextResponse } from 'next/server';

import { getElections } from '@/lib/api/governance.server';

export async function GET(request: NextRequest) {
  try {
    const page = await getElections(request.nextUrl.searchParams.get('cursor') ?? undefined, true);
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Elections proxy failed', error);
    return NextResponse.json({ error: 'Elections are temporarily unavailable.' }, { status: 502 });
  }
}