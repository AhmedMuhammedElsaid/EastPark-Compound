'use client';

import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { SealedVault } from '@/components/teaser/SealedVault';
import { TeaserHero } from '@/components/teaser/TeaserHero';
import { TeaserTicker } from '@/components/teaser/TeaserTicker';
import { useTranslation } from '@/lib/i18n';

import { ClosingCta } from './ClosingCta';
import { HowItWorks } from './HowItWorks';

/**
 * The public landing page as the logged-out version of the resident home teaser. It shares the hero,
 * rollout timeline, "Unlocking soon" ticker and sealed vault with `/home` (components/teaser), adds
 * the register / sign-in calls to action and the join flow, and carries the marketplace and
 * community copy inside the sealed cards. No session or live data, so `/` stays static.
 */
export function LandingTeaser() {
  const { t } = useTranslation();

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8 sm:space-y-10">
        <TeaserHero
          titleId="hero-title"
          eyebrow={t('landing.eyebrow')}
          lede={t('landing.teaser_lede')}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/register-unit">{t('landing.hero_cta')}</ButtonLink>
              <ButtonLink href="/login" variant="outline">
                {t('landing.sign_in_cta')}
              </ButtonLink>
            </div>
          }
        />

        <TeaserTicker />

        <HowItWorks />

        <SealedVault
          interactive={false}
          marketOpen
          market={{
            body: t('landing.pillar_market_open_body'),
            points: [
              t('landing.pillar_market_open_point_1'),
              t('landing.pillar_market_open_point_2'),
              t('landing.pillar_market_open_point_3'),
            ],
          }}
          governance={{
            body: t('landing.pillar_governance_body'),
            points: [
              t('landing.pillar_governance_point_1'),
              t('landing.pillar_governance_point_2'),
              t('landing.pillar_governance_point_3'),
            ],
          }}
        />

        <ClosingCta />
      </div>
    </Container>
  );
}
