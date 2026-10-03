'use client';

import { Reveal } from '@/components/Reveal';
import { TeaserTimeline, type TimelineItem } from '@/components/teaser/TeaserTimeline';
import { useTranslation } from '@/lib/i18n';

const STEPS = [1, 2, 3, 4] as const;

/**
 * The join flow, told with the same timeline as the rollout phases: register the unit → the compound
 * office approves it → an invitation email arrives → the resident signs in. `#how-it-works` is kept
 * as the anchor (shared links and the old hero button point at it).
 */
export function HowItWorks() {
  const { t } = useTranslation();
  const steps: TimelineItem[] = STEPS.map((step) => ({
    key: `step-${step}`,
    status: 'step',
    label: t(`landing.how_step_${step}_title`),
    caption: t(`landing.how_step_${step}_body`),
  }));

  return (
    <Reveal>
      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="home-hero scroll-mt-24 rounded-lg border border-border px-5 py-8 sm:px-10 sm:py-10"
      >
        <p className="home-hero-eyebrow text-[length:var(--text-overline)] font-semibold uppercase tracking-[1px]">
          {t('landing.how_eyebrow')}
        </p>
        <h2 id="how-title" className="home-hero-title mt-2 text-[length:var(--text-h1)] font-bold leading-tight">
          {t('landing.how_title')}
        </h2>
        <p className="home-hero-lede mt-2 max-w-[60ch] text-[length:var(--text-body)] leading-6">
          {t('landing.how_sub')}
        </p>
        <div className="mt-4">
          <TeaserTimeline items={steps} label={t('landing.how_steps_label')} wideFrom="lg" />
        </div>
      </section>
    </Reveal>
  );
}
