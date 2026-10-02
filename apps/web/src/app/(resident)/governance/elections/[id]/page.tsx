import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ElectionDetail, GovernanceUnavailable } from '@/components/app/GovernanceDetail';
import { getElection, GovernanceRequestError, SessionRefreshRequiredError } from '@/lib/api/governance.server';
import { sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = { title: 'الانتخابات' };
type ElectionPageProps = { params: Promise<{ id: string }> };

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;
  let election;
  try {
    election = await getElection(id, { session: { mutateCookies: false } });
  } catch (error) {
    if (error instanceof SessionRefreshRequiredError) {
      redirect(sessionRefreshPath(`/governance/elections/${encodeURIComponent(id)}`, { optional: true }));
    }
    if (error instanceof GovernanceRequestError && error.status === 404) notFound();
    console.error('Election page failed', error);
    return <GovernanceUnavailable kind="election" />;
  }
  return <ElectionDetail initialElection={election} />;
}