'use client';

import { ShieldX, WifiOff } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

/** Localized "access required / service unavailable" notice for the admin and merchant areas. */
export function AccessNotice({
  area,
  unavailable,
}: {
  area: 'admin' | 'merchant';
  unavailable: boolean;
}) {
  const { t } = useTranslation();
  const Icon = unavailable ? WifiOff : ShieldX;
  const kind = unavailable ? 'unavailable' : 'denied';
  const titleId = `${area}-access-title`;
  return (
    <section className="max-w-lg text-center" aria-labelledby={titleId}>
      <Icon aria-hidden="true" className="mx-auto size-10 text-primary" />
      <h1 id={titleId} className="mt-5 text-[length:var(--text-h1)] font-bold">
        {t(`access.${area}_${kind}_title`)}
      </h1>
      <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
        {t(`access.${area}_${kind}_body`)}
      </p>
    </section>
  );
}
