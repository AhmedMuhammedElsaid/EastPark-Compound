import { NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getPoll } from '@/lib/api/governance.server';

export const maxDuration = 30;

type PollRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: PollRouteContext) {
  const { id } = await params;
  try {
    return NextResponse.json({ data: await getPoll(id, { session: { mutateCookies: true } }) });
  } catch (error) {
    return bffErrorResponse(error, 'Poll detail proxy failed');
  }
}
