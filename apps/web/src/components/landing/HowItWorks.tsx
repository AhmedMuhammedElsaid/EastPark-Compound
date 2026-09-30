'use client';

import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

function Step({ numeral, title, body }: { numeral: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Numerals are functional UI, so Cairo — never the display serif. The
          solid background keeps the connecting rule from crossing the digit. */}
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-background text-[length:var(--text-h1)] font-bold text-primary">
        {numeral}
      </div>
      <h3 className="mt-4 text-[length:var(--text-body-lg)] font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-[34ch] text-[length:var(--text-body)] leading-[1.6] text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { title: t('landing.how_step_1_title'), body: t('landing.how_step_1_body') },
    { title: t('landing.how_step_2_title'), body: t('landing.how_step_2_body') },
    { title: t('landing.how_step_3_title'), body: t('landing.how_step_3_body') },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20" aria-labelledby="how-title">
      <Container>
        <Reveal>
          <h2
            id="how-title"
            className="text-center text-[length:var(--text-h1)] font-bold text-foreground"
          >
            <ButtonLink href="/register-unit">{t('landing.how_title')}</ButtonLink>
          </h2>
        </Reveal>

        <div className="relative mt-12">
          {/* Connecting hairline, desktop only. Inset so it starts and ends at
              the outer circles rather than running off the edge. In RTL the
              steps reverse via flex order; a centered rule needs no mirroring. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[16%] top-7 hidden h-px bg-border md:block"
          />

          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Reveal delayMs={index * 80}>
                  <Step numeral={String(index + 1)} title={step.title} body={step.body} />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
