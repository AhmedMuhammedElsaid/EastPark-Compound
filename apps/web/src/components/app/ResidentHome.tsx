'use client';

import { Building2, LogIn, LogOut, MessageSquareText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/Container';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

export function ResidentHome() {
  const { isLoading, logout, user } = useAuth();
  const { t } = useTranslation();
  const canSubmitFeedback = user?.role === 'RESIDENT' || user?.role === 'MERCHANT';

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="resident-home-title" className="mx-auto max-w-5xl">
        <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
          {t('nav.brand')}
        </p>
        <h1 id="resident-home-title" className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">
          {user ? `${t('home.greeting_morning')}، ${user.name}` : t('home.tab_label')}
        </h1>

        <div id="account" className="mt-8 border-y border-border py-6 sm:py-8">
          {isLoading ? (
            <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
              <span className="sr-only">{t('common.loading')}</span>
              <div className="h-5 w-36 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
              <div className="h-4 w-full max-w-md animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            </div>
          ) : user ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                  <ShieldCheck aria-hidden="true" className="size-6" />
                </span>
                <div>
                  <h2 className="text-[length:var(--text-body-lg)] font-bold text-foreground">{user.name}</h2>
                  <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">{user.email}</p>
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

        <section aria-labelledby="start-title" className="py-8">
          <h2 id="start-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
            {t('home.quick_actions')}
          </h2>
          <Link
            href={canSubmitFeedback ? '/feedback' : '/register-unit'}
            className="mt-5 flex min-h-14 max-w-md items-center gap-4 rounded-md border border-border bg-card px-5 py-4 text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              {canSubmitFeedback ? <MessageSquareText aria-hidden="true" className="size-5" /> : <Building2 aria-hidden="true" className="size-5" />}
            </span>
            <span className="font-bold">{canSubmitFeedback ? t('feedback.title') : t('nav.register')}</span>
          </Link>
        </section>
      </section>
    </Container>
  );
}