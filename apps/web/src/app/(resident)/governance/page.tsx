import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { GovernanceHub } from '@/components/app/GovernanceHub';
import { getElections, getPolls, SessionRefreshRequiredError } from '@/lib/api/governance.server';
import { sessionRefreshPath } from '@/lib/auth/return-path';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'الحوكمة' };

const REFRESH_REQUIRED = Symbol('refresh-required');

function recover(label: string) {
  return (error: unknown): null | typeof REFRESH_REQUIRED => {
    if (error instanceof SessionRefreshRequiredError) return REFRESH_REQUIRED;
    console.error(`${label} page failed`, error);
    return null;
  };
}

export default async function GovernancePage() {
  const session = { session: { mutateCookies: false } };
  const [polls, elections] = await Promise.all([
    getPolls(undefined, session).catch(recover('Polls')),
    getElections(undefined, session).catch(recover('Elections')),
  ]);
  if (polls === REFRESH_REQUIRED || elections === REFRESH_REQUIRED) {
    redirect(sessionRefreshPath('/governance', { optional: true }));
  }
  return <GovernanceHub initialPolls={polls} initialElections={elections} />;
}
