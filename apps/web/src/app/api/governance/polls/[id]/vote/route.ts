import { NextResponse } from 'next/server';

import { pollVoteSchema } from '@/lib/api/governance';
import { votePoll, voteErrorResponse } from '@/lib/api/governance.server';

export const maxDuration = 30;

type PollVoteRouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: PollVoteRouteContext) {
  const { id } = await params;
  // Malformed JSON and invalid bodies are client errors (400), not an outage.
  const body = pollVoteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    return NextResponse.json({ data: await votePoll(id, body.data.optionId) });
  } catch (error) {
    return voteErrorResponse(error, 'Poll vote proxy failed');
  }
}
