import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { AccessNotice } from '@/components/AccessNotice';
import { AppShell } from '@/components/app/AppShell';
import { Container } from '@/components/Container';
import { getAdminSession } from '@/lib/auth/admin.server';
import { loginPath, sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = {
  title: 'الإدارة',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (session.status === 'unauthenticated') redirect(loginPath('/admin'));
  if (session.status === 'refresh-required') redirect(sessionRefreshPath('/admin'));

  if (session.status !== 'authenticated') {
    return (
      <AppShell>
        <Container className="flex min-h-[65vh] items-center justify-center py-16">
          <AccessNotice area="admin" unavailable={session.status === 'unavailable' || session.status === 'rate_limited'} />
        </Container>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}