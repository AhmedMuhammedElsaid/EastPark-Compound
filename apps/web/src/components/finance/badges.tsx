'use client';

import type { Payment } from '@/lib/finance/schemas';

import { useTranslation } from '@/lib/i18n';

import { Badge } from './parts';

/** Posted / void, and the cheque state when it matters. */
export function PaymentStatusBadge({ payment }: { payment: Pick<Payment, 'status' | 'chequeState'> }) {
  const { t } = useTranslation();
  if (payment.status === 'VOID') return <Badge tone="error">{t('finance.status.VOID')}</Badge>;
  if (payment.chequeState === 'PENDING_CLEARANCE') return <Badge tone="warning">{t('finance.cheque.PENDING_CLEARANCE')}</Badge>;
  if (payment.chequeState === 'BOUNCED') return <Badge tone="error">{t('finance.cheque.BOUNCED')}</Badge>;
  if (payment.chequeState === 'CLEARED') return <Badge tone="success">{t('finance.cheque.CLEARED')}</Badge>;
  return <Badge tone="success">{t('finance.status.POSTED')}</Badge>;
}
