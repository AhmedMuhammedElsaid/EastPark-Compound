import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GovernanceUnavailable, PollDetail } from '@/components/app/GovernanceDetail';
import { getPoll, GovernanceRequestError } from '@/lib/api/governance.server';

export const metadata: Metadata = { title: 'Poll' };
type PollPageProps = { params: Promise<{ id: string }> };

export default async function PollPage({ params }: PollPageProps) {
  const { id } = await params;
  let poll;
  try {
    poll = await getPoll(id, true);
  } catch (error) {
    if (error instanceof GovernanceRequestError && error.status === 404) notFound();
    console.error('Poll page failed', error);
    return <GovernanceUnavailable kind="poll" />;
  }
  return <PollDetail initialPoll={poll} />;
}