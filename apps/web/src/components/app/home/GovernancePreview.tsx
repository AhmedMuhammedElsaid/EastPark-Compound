'use client';

import { Landmark, Lock } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { GatedLink } from '@/lib/access/ComingSoon';
import { useTranslation } from '@/lib/i18n';

// Static illustrative bars; widths are decorative and never represent real votes.
const BARS = ['w-4/5', 'w-3/5', 'w-2/5'];

export function GovernancePreview() {
  const { t } = useTranslation();

  return (
    <Reveal className="h-full">
      <GatedLink
        href="/governance"
        className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-primary">
          <Landmark aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 text-[length:var(--text-h2)] font-bold text-foreground">{t('home.teaser.gov_title')}</h2>
        <p className="mt-2 text-[length:var(--text-body)] leading-6 text-muted-foreground">
          {t('home.teaser.gov_body')}
        </p>
        <ul aria-hidden="true" className="mt-5 space-y-3">
          {BARS.map((width, index) => (
            <li key={width} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[length:var(--text-caption)] text-muted-foreground">
                {t('home.teaser.gov_option')} {index + 1}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <span className={`block h-3 rounded-full bg-muted-foreground/40 blur-[3px] ${width}`} />
              </span>
            </li>
          ))}
        </ul>
        <span className="mt-4 inline-flex items-center gap-2 text-[length:var(--text-label)] font-bold text-primary">
          <Lock aria-hidden="true" className="size-4" />
          {t('home.teaser.gov_sealed')}
        </span>
      </GatedLink>
    </Reveal>
  );
}
