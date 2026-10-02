import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { electionVoteSchema } from '@/lib/api/governance';
import { GovernanceVoteError, voteElection } from '@/lib/api/governance.server';

export const maxDuration = 30;

type ElectionVoteRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: ElectionVoteRouteContext) {
  try {
    const { id } = await params;
    const { candidateId } = electionVoteSchema.parse(await request.json());
    return NextResponse.json({ data: await voteElection(id, candidateId) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    if (error instanceof GovernanceVoteError) {
      return NextResponse.json({ error: 'vote_rejected' }, { status: error.status });
    }
    console.error('Election vote proxy failed', error);
    return NextResponse.json({ error: 'server' }, { status: 502 });
  }
}