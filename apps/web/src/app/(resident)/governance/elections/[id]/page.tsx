import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ElectionDetail, GovernanceUnavailable } from '@/components/app/GovernanceDetail';
import { getElection, GovernanceRequestError } from '@/lib/api/governance.server';

export const metadata: Metadata = { title: 'Election' };
type ElectionPageProps = { params: Promise<{ id: string }> };

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;
  let election;
  try {
    election = await getElection(id, true);
  } catch (error) {
    if (error instanceof GovernanceRequestError && error.status === 404) notFound();
    console.error('Election page failed', error);
    return <GovernanceUnavailable kind="election" />;
  }
  return <ElectionDetail initialElection={election} />;
}