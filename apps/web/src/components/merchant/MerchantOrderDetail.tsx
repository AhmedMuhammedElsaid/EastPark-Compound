'use client';

import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Container } from '@/components/Container';
import { Status } from '@/components/merchant/MerchantOrders';
import { merchantApi } from '@/lib/api/merchant';
import { useTranslation } from '@/lib/i18n';
import type { MerchantOrder, OrderStatus } from '@/lib/schemas/merchant';

const NEXT_STATUS: Partial<Record<OrderStatus, Exclude<OrderStatus, 'PLACED'>>> = {
  PLACED: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'ON_THE_WAY',
  ON_THE_WAY: 'DELIVERED',
};

export function MerchantOrderDetail({ orderId }: { orderId: string }) {
  const { lang, t } = useTranslation(); const [order, setOrder] = React.useState<MerchantOrder | null>(null); const [busy, setBusy] = React.useState(true); const [error, setError] = React.useState('');
  const load = React.useCallback(async () => { try { setOrder(await merchantApi.order(orderId)); } catch { setError(t('merchant.error_load')); } finally { setBusy(false); } }, [orderId, t]);
  React.useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => void load(), 10_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(poll);
    };
  }, [load]);
  async function update(status: Exclude<OrderStatus, 'PLACED'>) { setBusy(true); setError(''); try { setOrder(await merchantApi.updateOrderStatus(orderId, status)); } catch { setError(t('merchant.error_save')); } finally { setBusy(false); } }
  if (!order && busy) return <Container className="py-12"><p role="status">{t('common.loading')}</p></Container>;
  if (!order) return <Container className="py-12"><p role="alert" className="text-error">{error || t('merchant.error_load')}</p></Container>;
  const next = NEXT_STATUS[order.status];
  return <Container className="py-8 sm:py-12"><Link href="/merchant/orders" className="inline-flex min-h-11 items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4.5 rtl:-scale-x-100" />{t('merchant.back_orders')}</Link><header className="mt-5 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('merchant.order')}</p><h1 className="mt-2 text-[length:var(--text-h1)] font-bold">#{order.id.slice(-6).toUpperCase()}</h1><p className="mt-2 text-muted-foreground">{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(order.createdAt))}</p></div><Status status={order.status} /></header>{error && <p role="alert" className="mt-5 bg-error/12 px-4 py-3 text-error">{error}</p>}<div className="grid gap-8 py-8 lg:grid-cols-[1fr_320px]"><section aria-labelledby="items-heading"><h2 id="items-heading" className="text-[length:var(--text-h2)] font-bold">{t('merchant.order_items')}</h2><div className="mt-5 border-y border-border">{order.items.map((item) => <div key={item.id} className="flex items-center gap-4 border-b border-border px-2 py-4 last:border-0"><strong className="w-10 text-primary">{item.quantity}×</strong><span className="flex-1">{lang === 'ar' ? item.productNameArSnapshot : item.productNameSnapshot}</span><span className="font-semibold">{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(item.unitPrice * item.quantity)}</span></div>)}</div><div className="mt-4 flex justify-between text-[length:var(--text-body-lg)] font-bold"><span>{t('merchant.total')}</span><span className="text-primary">{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(order.totalAmount)}</span></div></section><aside className="space-y-5 border-t border-border pt-6 lg:border-s lg:border-t-0 lg:ps-7 lg:pt-0"><Meta label={t('merchant.unit')} value={order.deliveryUnit} /><Meta label={t('merchant.payment')} value={order.paymentMethod === 'CASH' ? t('merchant.cash') : t('merchant.card')} /><Meta label={t('merchant.payment_status')} value={order.isPaid ? t('merchant.paid') : t('merchant.unpaid')} />{order.notes && <Meta label={t('merchant.notes')} value={order.notes} />}</aside></div>{order.status === 'PLACED' || next ? <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">{order.status === 'PLACED' && <button type="button" disabled={busy} onClick={() => void update('CANCELLED')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-error px-5 font-bold text-error"><X className="size-5" />{t('merchant.reject')}</button>}{next && <button type="button" disabled={busy} onClick={() => void update(next)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-success px-5 font-bold text-success-foreground"><Check className="size-5" />{order.status === 'PLACED' ? t('merchant.accept') : t('merchant.advance_status')}</button>}</div> : null}</Container>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-[length:var(--text-label)] text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
