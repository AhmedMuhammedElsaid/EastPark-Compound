'use client';

import type { CSSProperties } from 'react';

import { Check, Lock } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

type PhaseStatus = 'live' | 'preparing' | 'next';
type Phase = { key: 'phase1' | 'phase2' | 'phase3'; status: PhaseStatus };

const PHASES: Phase[] = [
  { key: 'phase1', status: 'live' },
  { key: 'phase2', status: 'preparing' },
  { key: 'phase3', status: 'next' },
];

/** Order of the staged entrance (CSS `home-stage`, 140ms apart; disabled under reduced motion). */
function stage(step: number): CSSProperties {
  return { '--stage': step } as CSSProperties;
}

/**
 * Cinematic resident hero: ambient gold glow and grain, a breathing EastPark mark, a staged
 * line-by-line entrance, and an "unlocking" rollout timeline whose current phase pulses. Phases are
 * labels only — never dates or progress numbers.
 */
export function HomeHero({ greeting }: { greeting: string | null }) {
  const { t, lang } = useTranslation();

  return (
    <section
      aria-labelledby="resident-home-title"
      className="home-hero relative isolate overflow-hidden rounded-lg border border-border"
    >
      <div aria-hidden="true" className="home-hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden="true" className="home-hero-mark pointer-events-none absolute -z-10">
        <div className="hero-logo-art absolute inset-0" />
      </div>
      <div aria-hidden="true" className="home-hero-grain pointer-events-none absolute inset-0 -z-10" />

      <div className="px-5 py-9 sm:px-10 sm:py-14">
        <p
          className="home-stage home-hero-eyebrow text-[length:var(--text-overline)] font-semibold uppercase tracking-[1px]"
          style={stage(0)}
        >
          {greeting ?? t('nav.brand')}
        </p>
        <h1
          id="resident-home-title"
          className={`home-hero-title mt-3 max-w-[18ch] text-balance text-[32px] font-bold leading-[1.15] sm:text-[48px] ${
            lang === 'en' ? 'font-[family-name:var(--font-family-display)]' : ''
          }`}
        >
          <span className="home-stage block" style={stage(1)}>
            {t('home.teaser.hero_title_lead')}
          </span>{' '}
          <span className="home-stage home-hero-accent block" style={stage(2)}>
            {t('home.teaser.hero_title_accent')}
          </span>
        </h1>
        <p
          className="home-stage home-hero-lede mt-4 max-w-[52ch] text-[length:var(--text-body-lg)] leading-[1.7]"
          style={stage(3)}
        >
          {t('home.teaser.hero_lede')}
        </p>

        <div className="home-stage mt-9 sm:mt-11" style={stage(4)}>
          <p className="home-hero-eyebrow text-[length:var(--text-overline)] font-semibold uppercase tracking-[1px]">
            {t('home.teaser.timeline_title')}
          </p>
          <ol aria-label={t('home.teaser.phases_label')} className="mt-4 grid sm:grid-cols-3 sm:gap-4">
            {PHASES.map(({ key, status }) => (
              <li
                key={key}
                data-status={status}
                aria-current={status === 'preparing' ? 'step' : undefined}
                className="home-timeline-step relative flex min-w-0 gap-4 pb-7 last:pb-0 sm:flex-col sm:gap-3 sm:pb-0"
              >
                <span className="home-timeline-node relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full">
                  {status === 'live' ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : status === 'preparing' ? (
                    <span aria-hidden="true" className="home-timeline-pulse block size-2.5 rounded-full" />
                  ) : (
                    <Lock aria-hidden="true" className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 pt-1 sm:pt-0">
                  <span className="home-timeline-status block text-[length:var(--text-caption)] font-semibold">
                    {t(`home.teaser.status_${status}`)}
                  </span>
                  <span className="home-hero-title mt-0.5 block text-[length:var(--text-body)] font-bold leading-5">
                    {t(`home.teaser.${key}`)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
