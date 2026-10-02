'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Reveal } from '@/components/Reveal';
import { GatedLink } from '@/lib/access/ComingSoon';
import { useTranslation } from '@/lib/i18n';

const STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'] as const;
const STATIC_STEP = 2; // step 3 lit under reduced motion
const STEP_MS = 2000;

export function OrderTrackingPreview() {
  const { t } = useTranslation();
  const [active, setActive] = useState(STATIC_STEP);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setActive((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Reveal className="h-full" delayMs={80}>
      <GatedLink
        href="/orders"
        className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
      >
        <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('home.teaser.track_title')}</h2>
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
                  className={`mt-2 px-0.5 text-[length:var(--text-caption)] leading-4 ${
                    current ? 'font-bold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {t(`orders.${step}`)}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-[length:var(--text-body)] text-muted-foreground">{t('home.teaser.track_caption')}</p>
      </GatedLink>
    </Reveal>
  );
}
