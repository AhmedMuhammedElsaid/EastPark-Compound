import { NextResponse } from 'next/server';

import { getElection, GovernanceRequestError } from '@/lib/api/governance.server';

export const maxDuration = 30;

type ElectionRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: ElectionRouteContext) {
  const { id } = await params;
  try {
    return NextResponse.json({ data: await getElection(id, { session: { mutateCookies: true } }) });
  } catch (error) {
    if (error instanceof GovernanceRequestError && error.status === 404) {
      return NextResponse.json({ error: 'Election not found.' }, { status: 404 });
    }
    console.error('Election detail proxy failed', error);
    return NextResponse.json({ error: 'Election is temporarily unavailable.' }, { status: 502 });
  }
}