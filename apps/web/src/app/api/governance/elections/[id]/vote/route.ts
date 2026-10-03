import { NextResponse } from 'next/server';

import { electionVoteSchema } from '@/lib/api/governance';
import { voteElection, voteErrorResponse } from '@/lib/api/governance.server';

export const maxDuration = 30;

type ElectionVoteRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: ElectionVoteRouteContext) {
  const { id } = await params;
  // Malformed JSON and invalid bodies are client errors (400), not an outage.
  const body = electionVoteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    return NextResponse.json({ data: await voteElection(id, body.data.candidateId) });
  } catch (error) {
    return voteErrorResponse(error, 'Election vote proxy failed');
  }
}
