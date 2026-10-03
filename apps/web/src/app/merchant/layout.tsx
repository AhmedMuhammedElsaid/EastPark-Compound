import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { AccessNotice } from '@/components/AccessNotice';
import { MerchantShell } from '@/components/merchant/MerchantShell';
import { getMerchantSession } from '@/lib/auth/merchant.server';
import { loginPath, sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = { title: 'أدوات التاجر', robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getMerchantSession();
  if (session.status === 'unauthenticated') redirect(loginPath('/merchant'));
  if (session.status === 'refresh-required') redirect(sessionRefreshPath('/merchant'));

  if (session.status !== 'authenticated') {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
        <AccessNotice area="merchant" unavailable={session.status === 'unavailable' || session.status === 'rate_limited'} />
      </main>
    );
  }

  return <MerchantShell>{children}</MerchantShell>;
}
