'use client';

import type { CSSProperties, ReactNode } from 'react';

import { useTranslation } from '@/lib/i18n';

import { TeaserTimeline, type TimelineItem, type TimelineStatus } from './TeaserTimeline';

const PHASES: Array<{ key: 'phase1' | 'phase2' | 'phase3'; status: Exclude<TimelineStatus, 'step'> }> = [
  { key: 'phase1', status: 'live' },
  { key: 'phase2', status: 'preparing' },
  { key: 'phase3', status: 'next' },
];

/** Order of the staged entrance (CSS `home-stage`, 140ms apart; disabled under reduced motion). */
export function stage(step: number): CSSProperties {
  return { '--stage': step } as CSSProperties;
}

/**
 * Cinematic coming-soon hero shared by the resident home and the public landing page: ambient gold
 * glow and grain, a breathing EastPark mark, a staged line-by-line entrance, optional actions, and
 * the "what unlocks next" rollout timeline whose current phase pulses. Phases are labels only —
 * never dates or progress numbers.
 */
export function TeaserHero({
  titleId,
  eyebrow,
  lede,
  actions,
}: {
  titleId: string;
  eyebrow: string;
  lede: string;
  /** Calls to action rendered under the lede (the landing page's register / sign-in buttons). */
  actions?: ReactNode;
}) {
  const { t, lang } = useTranslation();
  const phases: TimelineItem[] = PHASES.map(({ key, status }) => ({
    key,
    status,
    label: t(`home.teaser.${key}`),
    kicker: t(`home.teaser.status_${status}`),
  }));

  return (
    <section
      aria-labelledby={titleId}
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
          {eyebrow}
        </p>
        <h1
          id={titleId}
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
          {lede}
        </p>

        {actions && (
          <div className="home-stage mt-7" style={stage(4)}>
            {actions}
          </div>
        )}

        <div className="home-stage mt-9 sm:mt-11" style={stage(actions ? 5 : 4)}>
          <p className="home-hero-eyebrow text-[length:var(--text-overline)] font-semibold uppercase tracking-[1px]">
            {t('home.teaser.timeline_title')}
          </p>
          <TeaserTimeline items={phases} label={t('home.teaser.phases_label')} />
        </div>
      </div>
    </section>
  );
}
