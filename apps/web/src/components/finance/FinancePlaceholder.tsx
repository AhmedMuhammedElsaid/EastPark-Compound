'use client';

import { Landmark } from 'lucide-react';

import { Container } from '@/components/Container';
import { useTranslation } from '@/lib/i18n';

/** Temporary finance landing so an accountant has somewhere to land; replaced by the finance desk. */
export function FinancePlaceholder() {
  const { t } = useTranslation();
  return (
    <Container className="flex min-h-[55vh] items-center justify-center py-16">
      <section className="max-w-lg text-center" aria-labelledby="finance-placeholder-title">
        <Landmark aria-hidden="true" className="mx-auto size-10 text-primary" />
        <h1 id="finance-placeholder-title" className="mt-5 text-[length:var(--text-h1)] font-bold">
          {t('finance.title')}
        </h1>
        <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('finance.placeholder_body')}</p>
      </section>
    </Container>
  );
}
