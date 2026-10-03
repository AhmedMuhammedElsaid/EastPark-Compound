'use client';

import { ButtonLink } from '@/components/Button';
import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

/** Closing call to action: reserve a place for launch, or sign in if already invited. */
export function ClosingCta() {
  const { t } = useTranslation();

  return (
    <Reveal>
      <section
        aria-labelledby="cta-title"
        className="rounded-lg border border-border bg-muted px-5 py-10 text-center sm:px-10 sm:py-14"
      >
        <h2 id="cta-title" className="text-[length:var(--text-h1)] font-bold text-foreground">
          {t('landing.closing_title')}
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-balance text-[length:var(--text-body-lg)] leading-[1.6] text-muted-foreground">
          {t('landing.closing_body')}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register-unit">{t('landing.closing_cta')}</ButtonLink>
          <ButtonLink href="/login" variant="outline">
            {t('landing.sign_in_cta')}
          </ButtonLink>
        </div>
      </section>
    </Reveal>
  );
}
