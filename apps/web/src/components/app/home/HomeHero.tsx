'use client';

import { Check, Circle, CircleDot } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

type Phase = { key: 'phase1' | 'phase2' | 'phase3'; status: 'live' | 'preparing' | 'next' };

const PHASES: Phase[] = [
  { key: 'phase1', status: 'live' },
  { key: 'phase2', status: 'preparing' },
  { key: 'phase3', status: 'next' },
];

export function HomeHero({ greeting }: { greeting: string | null }) {
  const { t, lang } = useTranslation();

  return (
    <section
      aria-labelledby="resident-home-title"
      className="home-hero relative overflow-hidden rounded-lg border border-border"
    >
      <div aria-hidden="true" className="hero-logo-track pointer-events-none absolute inset-0">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="hero-logo-motion absolute" style={{ animationDelay: `${index * -4.25}s` }}>
            <div
              className={`hero-logo-art hero-logo-art--${index % 2 === 0 ? 'pulse' : 'shimmer'} absolute inset-0`}
              style={{ animationDelay: `${index * -0.8}s` }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="home-hero-veil pointer-events-none absolute inset-0" />

      <div className="relative px-5 py-8 sm:px-10 sm:py-12">
        <Reveal>
          <p className="home-hero-eyebrow text-[length:var(--text-overline)] font-medium uppercase tracking-[1px]">
            {greeting ?? t('nav.brand')}
          </p>
          <h1
            id="resident-home-title"
            className={`home-hero-title mt-3 max-w-[20ch] text-balance text-[length:var(--text-h1)] leading-[1.2] sm:text-[44px] ${
              lang === 'en' ? 'font-[family-name:var(--font-family-display)] font-bold' : 'font-bold'
            }`}
          >
            {t('home.teaser.hero_title')}
          </h1>
          <p className="home-hero-lede mt-4 max-w-[56ch] text-balance text-[length:var(--text-body-lg)] leading-[1.6]">
            {t('home.teaser.hero_lede')}
          </p>
        </Reveal>

        <ol
          aria-label={t('home.teaser.phases_label')}
          className="mt-7 grid gap-3 sm:grid-cols-3"
        >
          {PHASES.map(({ key, status }, index) => {
            const Icon = status === 'live' ? Check : status === 'preparing' ? CircleDot : Circle;
            const active = status === 'live';
            return (
              <li
                key={key}
                className={`flex min-w-0 items-start gap-3 rounded-md border p-3 ${
                  active ? 'border-gold-500 bg-gold-500/10' : 'border-current/20 bg-current/5'
                } home-hero-lede`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                    active ? 'bg-gold-500 text-dark-bg' : 'border border-current opacity-70'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:var(--text-caption)] font-semibold">
                    {index + 1}. {t(`home.teaser.status_${status}`)}
                  </span>
                  <span className="home-hero-title block text-[length:var(--text-label)] font-bold leading-5">
                    {t(`home.teaser.${key}`)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
