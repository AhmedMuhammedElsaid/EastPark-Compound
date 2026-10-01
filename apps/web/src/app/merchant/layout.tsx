import type { Metadata } from 'next';

import { ShieldX, WifiOff } from 'lucide-react';
import { redirect } from 'next/navigation';

import { MerchantShell } from '@/components/merchant/MerchantShell';
import { getMerchantSession } from '@/lib/auth/merchant.server';

export const metadata: Metadata = { title: 'Merchant tools', robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getMerchantSession();
  if (session.status === 'unauthenticated') redirect('/login?next=%2Fmerchant');

  if (session.status !== 'authenticated') {
    const unavailable = session.status === 'unavailable';
    const Icon = unavailable ? WifiOff : ShieldX;
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
        <section className="max-w-lg text-center" aria-labelledby="merchant-access-title">
          <Icon aria-hidden="true" className="mx-auto size-10 text-primary" />
          <h1 id="merchant-access-title" className="mt-5 text-[length:var(--text-h1)] font-bold">
            {unavailable ? 'Merchant service unavailable' : 'Merchant access required'}
          </h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {unavailable
              ? 'تعذر التحقق من صلاحيات التاجر الآن. يرجى المحاولة مرة أخرى.'
              : 'هذه المساحة مخصصة لحسابات تجار إيست بارك فقط.'}
          </p>
        </section>
      </main>
    );
  }

  return <MerchantShell>{children}</MerchantShell>;
}
