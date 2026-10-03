'use client';

import { Bell, Building2, ChevronRight, FileText, MessageSquareText, Store, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { GatedLink } from '@/lib/access/ComingSoon';
import { useTranslation } from '@/lib/i18n';

import { SoonPill } from '@/components/teaser/SoonPill';

// `live` tiles lead to a section the viewer can already open, so they carry no "Soon" pill.
type Tile = { href: string; icon: LucideIcon; label: string; promise?: string; live?: boolean };

export function AlsoOnTheWay({ role }: { role: string | undefined }) {
  const { t } = useTranslation();
  const canSubmitFeedback = role === 'RESIDENT' || role === 'MERCHANT';

  const candidates: Array<Tile | null> = [
    canSubmitFeedback
      ? { href: '/feedback', icon: MessageSquareText, label: t('home.feedback'), promise: t('home.teaser.promise_feedback') }
      : !role
        ? { href: '/register-unit', icon: Building2, label: t('nav.register') }
        : null,
    { href: '/notifications', icon: Bell, label: t('notifications.title'), promise: t('home.teaser.promise_notifications') },
    { href: '/reports', icon: FileText, label: t('home.reports'), promise: t('home.teaser.promise_reports') },
    { href: '/profile', icon: UserRound, label: t('profile.title'), promise: t('home.teaser.promise_profile'), live: true },
    role === 'MERCHANT'
      ? { href: '/merchant', icon: Store, label: t('merchant.dashboard'), promise: t('home.teaser.promise_merchant'), live: true }
      : null,
  ];
  const tiles = candidates.filter((tile): tile is Tile => tile !== null);

  return (
    <Reveal>
      <section aria-labelledby="also-title">
        <h2 id="also-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
          {t('home.teaser.more_title')}
        </h2>
        {/* Phones: compact rows (icon, text, pill/chevron). From 480px: cards with the pill pinned top-end. */}
        <ul className="mt-4 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 min-[480px]:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] lg:gap-4">
          {tiles.map(({ href, icon: Icon, label, promise, live }) => (
            <li key={href} className="min-w-0">
              <GatedLink
                href={href}
                className="group relative flex h-full w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-foreground transition-colors hover:border-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none min-[480px]:min-h-28 min-[480px]:flex-col min-[480px]:items-stretch min-[480px]:gap-2 min-[480px]:p-4"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary group-hover:bg-card">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 min-[480px]:gap-2">
                  <span className="text-[length:var(--text-label)] font-bold leading-5">{label}</span>
                  {promise && (
                    <span className="text-[length:var(--text-caption)] leading-5 text-muted-foreground">{promise}</span>
                  )}
                </span>
                {promise && !live ? (
                  <SoonPill
                    label={t('home.teaser.soon')}
                    className="shrink-0 min-[480px]:absolute min-[480px]:end-4 min-[480px]:top-6"
                  />
                ) : (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground rtl:rotate-180 min-[480px]:hidden"
                  />
                )}
              </GatedLink>
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}
