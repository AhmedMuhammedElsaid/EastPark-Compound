import type { Metadata } from 'next';

import { ShieldX, WifiOff } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app/AppShell';
import { Container } from '@/components/Container';
import { getAdminSession } from '@/lib/auth/admin.server';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (session.status === 'unauthenticated') redirect('/login?next=%2Fadmin');
  if (session.status === 'refresh-required') redirect('/api/admin/session');

  if (session.status !== 'authenticated') {
    const unavailable = session.status === 'unavailable';
    const Icon = unavailable ? WifiOff : ShieldX;
    return (
      <AppShell>
        <Container className="flex min-h-[65vh] items-center justify-center py-16">
          <section className="max-w-lg text-center" aria-labelledby="admin-access-title">
            <Icon aria-hidden="true" className="mx-auto size-10 text-primary" />
            <h1 id="admin-access-title" className="mt-5 text-[length:var(--text-h1)] font-bold">
              {unavailable ? 'Admin service unavailable' : 'Administrator access required'}
            </h1>
            <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
              {unavailable
                ? 'تعذر التحقق من صلاحيات المشرف الآن. يرجى المحاولة مرة أخرى.'
                : 'هذه المساحة مخصصة لحسابات إدارة إيست بارك فقط.'}
            </p>
          </section>
        </Container>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}