'use client';

import { useTranslation } from '@/lib/i18n';

/** First focusable element on the page; visually hidden until focused. */
export function SkipLink() {
  const { t } = useTranslation();

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-primary focus:bg-card focus:px-4 focus:py-3 focus:text-[length:var(--text-body)] focus:text-foreground focus:outline-2 focus:outline-offset-2 focus:outline-gold-500"
    >
      {t('nav.skip_to_content')}
    </a>
  );
}
