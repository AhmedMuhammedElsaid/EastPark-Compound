'use client';

import * as React from 'react';

import { Container } from '@/components/Container';
import { Reveal } from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';

function StorefrontIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9V6.5L4.5 3h15L21 6.5V9M3 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 12 10.5a2.5 2.5 0 0 0 4.5 0A2.5 2.5 0 0 0 21 9M4.5 11.5V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8.5M4 8.5 12 4l8 4.5M4 8.5h16M9.5 13.5l1.8 1.8 3.7-3.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="mt-1 shrink-0"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Pillar({
  icon,
  title,
  body,
  points,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-card p-7">
      <div className="flex size-11 items-center justify-center rounded-md bg-primary/15 text-primary">
        {icon}
      </div>
      <h3 className="mt-5 text-[length:var(--text-h2)] font-semibold text-card-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[length:var(--text-body)] leading-[1.6] text-muted-foreground">
        {body}
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-3 text-[length:var(--text-body)] text-card-foreground"
          >
            <span className="text-primary">
              <CheckIcon />
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Pillars() {
  const { t } = useTranslation();

  return (
    <section className="py-16 sm:py-20" aria-labelledby="pillars-title">
      <Container>
        <Reveal>
          <h2
            id="pillars-title"
            className="text-center text-[length:var(--text-h1)] font-bold text-foreground"
          >
            {t('landing.pillars_title')}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal>
            <Pillar
              icon={<BallotIcon />}
              title={t('landing.pillar_governance_title')}
              body={t('landing.pillar_governance_body')}
              points={[
                t('landing.pillar_governance_point_1'),
                t('landing.pillar_governance_point_2'),
                t('landing.pillar_governance_point_3'),
              ]}
            />
          </Reveal>
          <Reveal delayMs={80}>
            <Pillar
              icon={<StorefrontIcon />}
              title={t('landing.pillar_market_title')}
              body={t('landing.pillar_market_body')}
              points={[
                t('landing.pillar_market_point_1'),
                t('landing.pillar_market_point_2'),
                t('landing.pillar_market_point_3'),
              ]}
            />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
