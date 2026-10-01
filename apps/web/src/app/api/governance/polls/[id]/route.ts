import { NextResponse } from 'next/server';

import { getPoll, GovernanceRequestError } from '@/lib/api/governance.server';

type PollRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: PollRouteContext) {
  const { id } = await params;
  try {
    return NextResponse.json({ data: await getPoll(id, true) });
  } catch (error) {
    if (error instanceof GovernanceRequestError && error.status === 404) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 });
    }
    console.error('Poll detail proxy failed', error);
    return NextResponse.json({ error: 'Poll is temporarily unavailable.' }, { status: 502 });
  }
}