'use client';

import { ChevronRight, Coffee, Lock, ShoppingBasket, Store, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/Reveal';
import { GatedLink } from '@/lib/access/ComingSoon';
import { useTranslation } from '@/lib/i18n';

import { TeaserPoints } from './SoonPill';

// Static illustrative cards. Swap for real shop data later: same shape (icon, label key, tint).
const CARDS: Array<{ key: string; icon: LucideIcon; label: string; tint: string }> = [
  { key: 'cafe', icon: Coffee, label: 'directory.cafe_food', tint: 'bg-gold-500/20' },
  { key: 'grocery', icon: ShoppingBasket, label: 'directory.grocery', tint: 'bg-success/20' },
  { key: 'butcher', icon: Store, label: 'directory.butcher', tint: 'bg-error/15' },
  { key: 'services', icon: Wrench, label: 'home.teaser.market_services', tint: 'bg-info/20' },
];

/**
 * `href={null}` (public landing) renders the overlay as plain content instead of a link; `body` and
 * `points` replace/extend the default sub-copy. `open` turns the sealed overlay into a real
 * "Browse shops" link to the (already browsable) directory: no lock, blur, sweep or "Soon" label.
 */
export function MarketplacePreview({
  href = '/directory',
  body,
  points,
  open = false,
}: {
  href?: string | null;
  body?: string;
  points?: string[];
  open?: boolean;
}) {
  const { t } = useTranslation();
  if (open) {
    return (
      <Reveal>
        <section aria-labelledby="market-preview-title">
          <h3 id="market-preview-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
            {t('home.teaser.market_title')}
          </h3>
          <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">
            {body ?? t('home.teaser.market_open_sub')}
          </p>
          {points && <TeaserPoints points={points} className="mt-3" />}

          <Link
            href="/directory"
            className="group mt-4 block overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <div aria-hidden="true" className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-4">
              {CARDS.map(({ key, icon: Icon, label, tint }) => (
                <div key={key} className="w-[42%] shrink-0 rounded-md border border-border bg-background sm:w-auto">
                  <div className={`flex h-24 items-center justify-center rounded-t-md ${tint}`}>
                    <Icon className="size-8 text-foreground/70" />
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="text-[length:var(--text-label)] font-bold text-foreground">{t(label)}</p>
                    <div className="h-2 w-3/4 rounded-sm bg-muted" />
                    <div className="h-2 w-1/2 rounded-sm bg-muted" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3">
              <span className="min-w-0">
                <span className="block text-[length:var(--text-body)] font-bold text-primary">
                  {t('home.teaser.market_open_cta')}
                </span>
                <span className="block text-[length:var(--text-label)] leading-5 text-muted-foreground">
                  {t('home.teaser.market_open_note')}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              />
            </div>
          </Link>
        </section>
      </Reveal>
    );
  }
  const overlayClass =
    'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 px-6 text-center backdrop-blur-md dark:bg-background/40';
  const overlay = (
    <>
      <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary bg-card px-5 text-[length:var(--text-label)] font-bold text-primary">
        <Lock aria-hidden="true" className="size-4" />
        {t('home.teaser.market_soon')}
      </span>
      <span className="sealed-hint max-w-[36ch] text-[length:var(--text-label)] font-semibold leading-5 text-foreground">
        {t('home.teaser.hint_market')}
      </span>
    </>
  );

  return (
    <Reveal>
      <section aria-labelledby="market-preview-title">
        <h3 id="market-preview-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
          {t('home.teaser.market_title')}
        </h3>
        <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">{body ?? t('home.teaser.market_sub')}</p>
        {points && <TeaserPoints points={points} className="mt-3" />}

        <div className={`sealed-card ${href ? '' : 'sealed-card--static '}relative mt-4 overflow-hidden rounded-lg border border-border bg-card p-4`}>
          <div aria-hidden="true" inert className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-4">
            {CARDS.map(({ key, icon: Icon, label, tint }) => (
              <div key={key} className="w-[42%] shrink-0 rounded-md border border-border bg-background sm:w-auto">
                <div className={`flex h-24 items-center justify-center rounded-t-md ${tint}`}>
                  <Icon className="size-8 text-foreground/70" />
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-[length:var(--text-label)] font-bold text-foreground">{t(label)}</p>
                  <div className="h-2 w-3/4 rounded-sm bg-muted" />
                  <div className="h-2 w-1/2 rounded-sm bg-muted" />
                </div>
              </div>
            ))}
          </div>

          {href ? (
            <GatedLink
              href={href}
              aria-label={t('home.teaser.market_cta')}
              className={`${overlayClass} focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold-500`}
            >
              {overlay}
            </GatedLink>
          ) : (
            <div className={overlayClass}>{overlay}</div>
          )}
          <span aria-hidden="true" className="sealed-sweep pointer-events-none absolute inset-0" />
        </div>
      </section>
    </Reveal>
  );
}
