'use client';

import { useTranslation } from '@/lib/i18n';

/** Screen-reader-only, localized loading label for server-rendered loading states. */
export function LoadingLabel() {
  const { t } = useTranslation();
  return <span className="sr-only">{t('common.loading')}</span>;
}
