import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { AccessNotice } from '@/components/AccessNotice';
import { AppShell } from '@/components/app/AppShell';
import { Container } from '@/components/Container';
import { FinanceFrame } from '@/components/finance/FinanceFrame';
import { getFinanceSession } from '@/lib/auth/finance.server';
import { loginPath, sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = {
  title: 'المالية',
  robots: { index: false, follow: false },
};

// Money screens are per request, never prerendered or cached; the desk fetches with `no-store`.
export const dynamic = 'force-dynamic';

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getFinanceSession();
  if (session.status === 'unauthenticated') redirect(loginPath('/finance'));
  if (session.status === 'refresh-required') redirect(sessionRefreshPath('/finance'));

  if (session.status !== 'authenticated') {
    return (
      <AppShell>
        <Container className="flex min-h-[65vh] items-center justify-center py-16">
          <AccessNotice area="finance" unavailable={session.status === 'unavailable' || session.status === 'rate_limited'} />
        </Container>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <FinanceFrame>{children}</FinanceFrame>
    </AppShell>
  );
}
