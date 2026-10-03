import { NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getElection } from '@/lib/api/governance.server';

export const maxDuration = 30;

type ElectionRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: ElectionRouteContext) {
  const { id } = await params;
  try {
    return NextResponse.json({ data: await getElection(id, { session: { mutateCookies: true } }) });
  } catch (error) {
    return bffErrorResponse(error, 'Election detail proxy failed');
  }
}
