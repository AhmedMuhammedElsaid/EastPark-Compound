import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { pollVoteSchema } from '@/lib/api/governance';
import { GovernanceVoteError, votePoll } from '@/lib/api/governance.server';

export const maxDuration = 30;

type PollVoteRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: PollVoteRouteContext) {
  try {
    const { id } = await params;
    const { optionId } = pollVoteSchema.parse(await request.json());
    return NextResponse.json({ data: await votePoll(id, optionId) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    if (error instanceof GovernanceVoteError) {
      return NextResponse.json({ error: 'vote_rejected' }, { status: error.status });
    }
    console.error('Poll vote proxy failed', error);
    return NextResponse.json({ error: 'server' }, { status: 502 });
  }
}