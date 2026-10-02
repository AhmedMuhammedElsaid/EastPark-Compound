import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { GovernanceUnavailable, PollDetail } from '@/components/app/GovernanceDetail';
import { getPoll, GovernanceRequestError, SessionRefreshRequiredError } from '@/lib/api/governance.server';
import { sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = { title: 'استطلاع' };
type PollPageProps = { params: Promise<{ id: string }> };

export default async function PollPage({ params }: PollPageProps) {
  const { id } = await params;
  let poll;
  try {
    poll = await getPoll(id, { session: { mutateCookies: false } });
  } catch (error) {
    if (error instanceof SessionRefreshRequiredError) {
      redirect(sessionRefreshPath(`/governance/polls/${encodeURIComponent(id)}`, { optional: true }));
    }
    if (error instanceof GovernanceRequestError && error.status === 404) notFound();
    console.error('Poll page failed', error);
    return <GovernanceUnavailable kind="poll" />;
  }
  return <PollDetail initialPoll={poll} />;
}