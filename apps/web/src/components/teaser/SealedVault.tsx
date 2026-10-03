'use client';

import { useTranslation } from '@/lib/i18n';

import { GovernancePreview } from './GovernancePreview';
import { MarketplacePreview } from './MarketplacePreview';
import { OrderTrackingPreview } from './OrderTrackingPreview';

type FeatureCopy = { body?: string; points?: string[] };

/**
 * "Sealed until launch": the marketplace, governance and order-tracking previews under one heading.
 * Signed-in pages keep the cards as Coming-soon links; the public landing passes `interactive={false}`
 * (visitors have nowhere to go yet) and adds each feature's longer copy.
 */
export function SealedVault({
  interactive = true,
  market,
  governance,
}: {
  interactive?: boolean;
  market?: FeatureCopy;
  governance?: FeatureCopy;
}) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="vault-title" className="space-y-6">
      <div>
        <p className="text-[length:var(--text-overline)] font-bold uppercase tracking-[1px] text-primary">
          {t('home.teaser.sealed')}
        </p>
        <h2 id="vault-title" className="mt-1 text-[length:var(--text-h1)] font-bold leading-tight text-foreground">
          {t('home.teaser.vault_title')}
        </h2>
        <p className="mt-2 max-w-[60ch] text-[length:var(--text-body)] leading-6 text-muted-foreground">
          {t('home.teaser.vault_sub')}
        </p>
      </div>

      <MarketplacePreview href={interactive ? undefined : null} {...market} />

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <GovernancePreview href={interactive ? undefined : null} {...governance} />
        <OrderTrackingPreview href={interactive ? undefined : null} />
      </div>
    </section>
  );
}
