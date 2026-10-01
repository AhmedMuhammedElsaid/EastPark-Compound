'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Container } from '@/components/Container';
import { formatCurrency } from '@/components/app/ProductMenu';
import { useTranslation } from '@/lib/i18n';

export function CheckoutConfirmation() {
  const params = useSearchParams();
  const { lang, t } = useTranslation();
  const orderId = params.get('orderId') ?? '';
  const total = Number(params.get('total'));

  return (
    <Container className="py-16 sm:py-24">
      <section className="mx-auto max-w-xl text-center" aria-labelledby="confirmation-title">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-14 text-success" />
        <h1 id="confirmation-title" className="mt-6 text-[length:var(--text-h1)] font-bold">{t('checkout.order_placed')}</h1>
        <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('checkout.order_placed_subtitle')}</p>
        {orderId && <p className="mt-6 break-all text-[length:var(--text-label)]"><span className="text-muted-foreground">{t('checkout.order_number')}: </span><strong dir="ltr">{orderId}</strong></p>}
        {Number.isFinite(total) && total >= 0 && <p className="mt-2 text-[length:var(--text-body-lg)] font-bold text-primary">{formatCurrency(total, lang)}</p>}
        <Link href="/home" className="mt-8 inline-flex min-h-12 items-center rounded-md bg-primary px-6 font-bold text-primary-foreground">{t('common.done')}</Link>
      </section>
    </Container>
  );
}