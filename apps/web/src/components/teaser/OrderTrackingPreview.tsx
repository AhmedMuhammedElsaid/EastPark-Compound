'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

import { SealedSurface } from './SealedSurface';
import { SealedHint, SoonPill } from './SoonPill';

const STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'] as const;
const STATIC_STEP = 2; // step 3 lit under reduced motion
const STEP_MS = 2000;

/** `href={null}` renders a non-interactive card (public landing). */
export function OrderTrackingPreview({ href = '/orders' }: { href?: string | null }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(STATIC_STEP);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setActive((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Reveal className="h-full" delayMs={80}>
      <SealedSurface
        href={href}
        className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
      >
        <span className="flex items-start justify-between gap-3">
          <h3 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('home.teaser.track_title')}</h3>
          <SoonPill label={t('home.teaser.sealed')} className="shrink-0" />
        </span>
        <ol aria-hidden="true" className="mt-6 flex items-start">
          {STEPS.map((step, index) => {
            const reached = index <= active;
            const current = index === active;
            return (
              <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                {index > 0 && (
                  <span
                    className={`absolute top-3 h-0.5 w-full -translate-y-1/2 transition-colors duration-500 motion-reduce:transition-none ltr:right-1/2 rtl:left-1/2 ${
                      reached ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-500 motion-reduce:transition-none ${
                    current
                      ? 'border-gold-500 bg-gold-500 text-dark-bg'
                      : reached
                        ? 'border-primary bg-card text-primary'
                        : 'border-border bg-card text-transparent'
                  }`}
                >
                  <Check className="size-3.5" />
                </span>
                <span
                  className={`mt-2 hidden px-0.5 text-[length:var(--text-caption)] leading-4 sm:block ${
                    current ? 'font-bold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {t(`orders.${step}`)}
                </span>
              </li>
            );
          })}
        </ol>
        <p aria-hidden="true" className="mt-3 text-center text-[length:var(--text-label)] font-bold text-foreground sm:hidden">
          {t(`orders.${STEPS[active]}`)}
        </p>
        <p className="mt-5 text-[length:var(--text-body)] text-muted-foreground">{t('home.teaser.track_caption')}</p>
        <SealedHint hint={t('home.teaser.hint_track')} />
      </SealedSurface>
    </Reveal>
  );
}
