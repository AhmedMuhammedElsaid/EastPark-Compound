'use client';

import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';

import { Container } from '@/components/Container';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

import { AlsoOnTheWay } from './home/AlsoOnTheWay';
import { GovernancePreview } from './home/GovernancePreview';
import { HomeHero } from './home/HomeHero';
import { MarketplacePreview } from './home/MarketplacePreview';
import { OrderTrackingPreview } from './home/OrderTrackingPreview';

function subscribeToClock(onStoreChange: () => void) {
  const interval = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(interval);
}

function getLocalHour() {
  return new Date().getHours();
}

function getServerHour() {
  return 0;
}

export function ResidentHome({ latestSlot }: { latestSlot: ReactNode }) {
  const { isLoading, logout, user } = useAuth();
  const { t } = useTranslation();
  const localHour = useSyncExternalStore(subscribeToClock, getLocalHour, getServerHour);
  const greeting = user
    ? `${t(localHour >= 17 ? 'home.greeting_evening' : 'home.greeting_morning')}، ${user.name}`
    : null;

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8 sm:space-y-10">
        <HomeHero greeting={greeting} />

        <div className="grid items-stretch gap-6 lg:grid-cols-2">
      <div id="account" className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6">
        {isLoading ? (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
            <span className="sr-only">{t('common.loading')}</span>
            <div className="h-5 w-36 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-full max-w-md animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
          </div>
        ) : user ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <ShieldCheck aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[length:var(--text-body-lg)] font-bold text-foreground">{user.name}</h2>
                <p className="mt-1 break-all text-[length:var(--text-body)] text-muted-foreground">{user.email}</p>
                {user.unitNumber && (
                  <p className="mt-1 text-[length:var(--text-label)] font-semibold text-primary">
                    {t('checkout.unit', { number: user.unitNumber })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-fit rounded-full border border-border bg-card px-3 py-2 text-[length:var(--text-caption)] font-bold text-muted-foreground">
                {user.role}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-label)] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:hidden"
              >
                <LogOut aria-hidden="true" className="size-4.5" />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">
                {t('profile.guest_prompt')}
              </h2>
              <p className="mt-2 max-w-prose text-[length:var(--text-body)] text-muted-foreground">
                {t('profile.guest_subtitle')}
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <LogIn aria-hidden="true" className="size-4.5" />
              {t('auth.login')}
            </Link>
          </div>
        )}
      </div>
          {latestSlot}
        </div>

        <MarketplacePreview />

        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <GovernancePreview />
          <OrderTrackingPreview />
        </div>

        <AlsoOnTheWay role={user?.role} />
      </div>
    </Container>
  );
}
