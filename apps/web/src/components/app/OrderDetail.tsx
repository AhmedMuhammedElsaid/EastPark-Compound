'use client';

import { ArrowLeft, Check, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Container } from '@/components/Container';
import type { Order, OrderStatus } from '@/lib/api/orders';
import { isTerminalOrderStatus, parseOrder } from '@/lib/api/orders';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatMoney, shortId } from './OrderHistory';

const steps: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'];

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { lang, t } = useTranslation();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollCount = useRef(0);
  const failures = useRef(0);

  const readOrder = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store', signal });
    if (response.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Request failed');
    const next = parseOrder(await response.json());
    setOrder(next);
    setLastUpdated(new Date());
    setError(false);
    failures.current = 0;
    return next;
  }, [orderId, router]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      void readOrder(controller.signal).catch(() => setError(true)).finally(() => setIsLoading(false));
    });
    return () => controller.abort();
  }, [readOrder]);

  const orderStatus = order?.status;

  useEffect(() => {
    if (!orderStatus || isTerminalOrderStatus(orderStatus)) return;
    let timer: number | undefined;
    let stopped = false;
    const controller = new AbortController();

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      if (stopped || document.hidden) return;
      clearTimer();
      const baseDelay = pollCount.current >= 20 ? 10_000 : pollCount.current >= 10 ? 5_000 : 3_000;
      const delay = Math.min(30_000, baseDelay * 2 ** Math.min(failures.current, 3));
      timer = window.setTimeout(async () => {
        timer = undefined;
        try {
          const next = await readOrder(controller.signal);
          pollCount.current += 1;
          if (!isTerminalOrderStatus(next.status)) schedule();
        } catch (requestError) {
          if ((requestError as Error).name !== 'AbortError') {
            failures.current += 1;
            setError(true);
            schedule();
          }
        }
      }, delay);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        void readOrder(controller.signal).then((next) => {
          if (!isTerminalOrderStatus(next.status)) schedule();
        }).catch(() => { failures.current += 1; schedule(); });
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      clearTimer();
      controller.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [orderStatus, readOrder]);

  async function refresh() {
    setIsRefreshing(true);
    try { await readOrder(AbortSignal.timeout(10_000)); } catch { setError(true); } finally { setIsRefreshing(false); }
  }

  async function cancelOrder() {
    if (!order || order.status !== 'PLACED' || !window.confirm(t('orders.cancel_confirm'))) return;
    setIsCancelling(true);
    setError(false);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, { method: 'PATCH', signal: AbortSignal.timeout(10_000) });
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/orders/${order.id}`)}`);
        return;
      }
      if (!response.ok) throw new Error('Cancel failed');
      setOrder(parseOrder(await response.json()));
      setLastUpdated(new Date());
    } catch { setError(true); } finally { setIsCancelling(false); }
  }

  if (isLoading) return <OrderDetailSkeleton label={t('common.loading')} />;
  if (!order) return <OrderDetailFailure message={t('orders.not_found')} />;

  const currentIndex = steps.indexOf(order.status);
  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto max-w-4xl">
        <Link href="/orders" className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-gold-500">
          <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" /> {t('orders.back_to_orders')}
        </Link>
        <header className="mt-5 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('orders.order_number', { id: shortId(order.id) })}</p>
            <h1 className="mt-2 text-[length:var(--text-h1)] font-bold">{t(`orders.${order.status}`)}</h1>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('orders.placed_on', { date: formatDate(order.createdAt, lang) })}</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-label)] font-bold hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
            <RefreshCw aria-hidden="true" className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /> {t('orders.refresh')}
          </button>
        </header>

        <section aria-labelledby="tracking-heading" className="py-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="tracking-heading" className="text-[length:var(--text-h2)] font-bold">{t('orders.tracking')}</h2>
            <p aria-live="polite" className="text-[length:var(--text-caption)] text-muted-foreground">{lastUpdated ? t('orders.last_updated', { time: lastUpdated.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-EG', { hour: '2-digit', minute: '2-digit' }) }) : ''}</p>
          </div>
          {order.status === 'CANCELLED' ? (
            <div className="mt-6 flex min-h-20 items-center gap-4 rounded-md bg-error/12 px-5 text-error"><span className="flex size-9 items-center justify-center rounded-full bg-error text-error-foreground"><X aria-hidden="true" className="size-5" /></span><strong>{t('orders.cancelled_message')}</strong></div>
          ) : (
            <ol className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-6" aria-label={t('orders.tracking')}>
              {steps.map((status, index) => {
                const complete = index <= currentIndex;
                return <li key={status} className="relative flex min-w-0 flex-col items-center text-center"><span className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 ${complete ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>{index < currentIndex ? <Check aria-hidden="true" className="size-4" /> : index + 1}</span><span className={`mt-2 text-[length:var(--text-caption)] font-semibold ${complete ? 'text-primary' : 'text-muted-foreground'}`}>{t(`orders.${status}`)}</span></li>;
              })}
            </ol>
          )}
        </section>

        <div className="grid gap-8 border-t border-border py-8 lg:grid-cols-[1.35fr_.65fr]">
          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="text-[length:var(--text-h2)] font-bold">{t('orders.items')}</h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {order.items.map((item) => <li key={item.id} className="flex min-h-20 items-center justify-between gap-4 py-4"><div><h3 className="font-semibold">{lang === 'ar' ? item.productNameArSnapshot : item.productNameSnapshot}</h3><p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">{t('orders.quantity', { count: item.quantity })}</p></div><span className="shrink-0 font-semibold">{formatMoney(item.unitPrice * item.quantity, lang)}</span></li>)}
            </ul>
          </section>
          <aside aria-label={t('orders.summary')} className="self-start rounded-md border border-border bg-card p-5">
            <h2 className="text-[length:var(--text-h2)] font-bold">{t('orders.summary')}</h2>
            <dl className="mt-5 space-y-4 text-[length:var(--text-body)]">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('orders.delivery_unit_label')}</dt><dd className="font-semibold">{order.deliveryUnit}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('orders.payment')}</dt><dd className="font-semibold">{order.paymentMethod === 'CASH' ? t('orders.cash_on_delivery') : 'Paymob'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t('orders.payment_status')}</dt><dd className="font-semibold">{t(order.isPaid ? 'orders.paid' : 'orders.unpaid')}</dd></div>
              <div className="flex justify-between gap-4 border-t border-border pt-4 text-[length:var(--text-body-lg)]"><dt className="font-bold">{t('orders.total')}</dt><dd className="font-bold text-primary">{formatMoney(order.totalAmount, lang)}</dd></div>
            </dl>
            {order.notes && <div className="mt-5 border-t border-border pt-4"><h3 className="text-[length:var(--text-label)] font-bold">{t('orders.notes')}</h3><p className="mt-2 whitespace-pre-wrap text-[length:var(--text-body)] text-muted-foreground">{order.notes}</p></div>}
          </aside>
        </div>

        {error && <p role="alert" className="mb-5 rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{t('orders.update_error')}</p>}
        {order.status === 'PLACED' && <div className="border-t border-border pt-6"><button type="button" onClick={() => void cancelOrder()} disabled={isCancelling} className="inline-flex min-h-12 items-center justify-center rounded-md border border-error px-5 text-[length:var(--text-button)] font-bold text-error hover:bg-error hover:text-error-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error disabled:opacity-60">{isCancelling ? t('common.loading') : t('orders.cancel_order')}</button></div>}
      </article>
    </Container>
  );
}

function OrderDetailSkeleton({ label }: { label: string }) { return <Container className="py-10" ><div className="mx-auto max-w-4xl" aria-busy="true" aria-label={label}><div className="h-8 w-48 animate-pulse bg-muted motion-reduce:animate-none" /><div className="mt-8 h-56 animate-pulse rounded-md border border-border bg-card motion-reduce:animate-none" /></div></Container>; }
function OrderDetailFailure({ message }: { message: string }) { return <Container className="py-14"><div role="alert" className="mx-auto max-w-4xl border-y border-border py-12 text-center"><h1 className="text-[length:var(--text-h2)] font-bold">{message}</h1><Link href="/orders" className="mt-5 inline-flex min-h-11 items-center text-primary">{message}</Link></div></Container>; }