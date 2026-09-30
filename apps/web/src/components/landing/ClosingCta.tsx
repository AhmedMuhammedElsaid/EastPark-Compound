'use client';

import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

/**
 * The one band allowed a background wash — `bg-muted` resolves to the warm
 * dark elevated surface in dark mode and a light warm tint in light mode.
 */
export function ClosingCta() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-border bg-muted py-16 sm:py-20" aria-labelledby="cta-title">
      <Container className="text-center">
        <Reveal>
          <h2 id="cta-title" className="text-[length:var(--text-h1)] font-bold text-foreground">
            {t('landing.closing_title')}
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-balance text-[length:var(--text-body-lg)] leading-[1.6] text-muted-foreground">
            {t('landing.closing_body')}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/register-unit">{t('landing.closing_cta')}</ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
