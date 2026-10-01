import type { Metadata } from 'next';

import { GovernanceHub } from '@/components/app/GovernanceHub';
import { getElections, getPolls } from '@/lib/api/governance.server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Governance' };

export default async function GovernancePage() {
  const [initialPolls, initialElections] = await Promise.all([
    getPolls(undefined, true).catch((error) => { console.error('Polls page failed', error); return null; }),
    getElections(undefined, true).catch((error) => { console.error('Elections page failed', error); return null; }),
  ]);
  return <GovernanceHub initialPolls={initialPolls} initialElections={initialElections} />;
}