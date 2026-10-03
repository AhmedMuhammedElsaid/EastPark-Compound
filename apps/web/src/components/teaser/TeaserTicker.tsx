'use client';

import { useTranslation } from '@/lib/i18n';

const ITEMS = ['ticker_1', 'ticker_2', 'ticker_3', 'ticker_4', 'ticker_5', 'ticker_6'] as const;

/**
 * Slow marquee of what unlocks next. The moving track is decorative (duplicated for a seamless
 * loop) and hidden from assistive tech; the visible label plus one plain list carry the content.
 * Under reduced motion the track stops and wraps instead of scrolling.
 */
export function TeaserTicker() {
  const { t } = useTranslation();
  const labels = ITEMS.map((key) => t(`home.teaser.${key}`));

  return (
    <section
      aria-label={t('home.teaser.ticker_label')}
      className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-border bg-card"
    >
      <p aria-hidden="true" className="flex shrink-0 items-center border-e border-border bg-muted px-3 text-[length:var(--text-caption)] font-bold text-primary sm:px-4">
        {t('home.teaser.ticker_label')}
      </p>
      <ul className="sr-only">
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="home-ticker min-w-0 flex-1 overflow-hidden py-3">
        <div className="home-ticker-track flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center">
              {labels.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-3 whitespace-nowrap px-4 text-[length:var(--text-label)] font-semibold text-muted-foreground"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
                  {label}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
