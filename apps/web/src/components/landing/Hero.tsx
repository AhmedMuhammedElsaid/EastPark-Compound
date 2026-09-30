'use client';

import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

export function Hero() {
  const { t, lang } = useTranslation();

  return (
    <section className="home-hero relative overflow-hidden" aria-labelledby="hero-title">
      <div aria-hidden="true" className="hero-logo-track pointer-events-none absolute inset-0">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="hero-logo-motion absolute"
            style={{ animationDelay: `${index * -4.25}s` }}
          >
            <div
              className={`hero-logo-art hero-logo-art--${index % 2 === 0 ? 'pulse' : 'shimmer'} absolute inset-0`}
              style={{ animationDelay: `${index * -0.8}s` }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="home-hero-veil pointer-events-none absolute inset-0" />

      <Container className="relative py-16 text-center sm:py-24">
        <Reveal>
          <p className="home-hero-eyebrow text-[length:var(--text-overline)] font-medium uppercase tracking-[1px]">
            {t('landing.eyebrow')}
          </p>
        </Reveal>

        <Reveal delayMs={60}>
          <h1
            id="hero-title"
            // Cormorant Garamond is allowed HERE AND NOWHERE ELSE, and only in
            // English — Arabic always renders in Cairo.
            className={`home-hero-title mt-4 text-[length:var(--text-display)] leading-[1.15] sm:text-[56px] ${
              lang === 'en'
                ? 'font-[family-name:var(--font-family-display)] font-bold'
                : 'font-bold'
            }`}
          >
            {t('landing.hero_title')}
          </h1>
        </Reveal>

        <Reveal delayMs={120}>
          <p className="home-hero-lede mx-auto mt-5 max-w-[56ch] text-balance text-[length:var(--text-body-lg)] leading-[1.6]">
            {t('landing.hero_lede')}
          </p>
        </Reveal>

        <Reveal delayMs={180}>
          <div className="mt-9 flex flex-row items-center justify-center gap-3">
            <ButtonLink
              href="/register-unit"
              className="whitespace-nowrap px-4 text-[length:var(--text-label)] sm:px-6 sm:text-[length:var(--text-body-lg)]"
            >
              {t('landing.hero_cta')}
            </ButtonLink>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-md border-[1.5px] border-primary px-4 text-[length:var(--text-label)] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none sm:px-6 sm:text-[length:var(--text-body-lg)]"
            >
              {t('landing.hero_cta_secondary')}
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
