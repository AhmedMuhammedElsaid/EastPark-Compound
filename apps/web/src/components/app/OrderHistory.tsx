'use client';

import { ArrowRight, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useState } from 'react';

import { Container } from '@/components/Container';
import type { Order, OrderPage, OrderStatus } from '@/lib/api/orders';
import { parseOrderPage } from '@/lib/api/orders';
import { useTranslation } from '@/lib/i18n';

const statusStyle: Record<OrderStatus, string> = {
  PLACED: 'bg-info/15 text-info',
  CONFIRMED: 'bg-info/15 text-info',
  PREPARING: 'bg-warning/15 text-warning',
  READY: 'bg-warning/15 text-warning',
  ON_THE_WAY: 'bg-primary/15 text-primary',
  DELIVERED: 'bg-success/15 text-success',
  CANCELLED: 'bg-error/15 text-error',
};

export function OrderHistory() {
  const router = useRouter();
  const { lang, t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const fetchPage = useCallback(async (cursor?: string): Promise<OrderPage> => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/api/orders${params.size ? `?${params}` : ''}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) {
      router.replace(`/login?next=${encodeURIComponent('/orders')}`);
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Request failed');
    return parseOrderPage(await response.json());
  }, [router]);

  useEffect(() => {
    let active = true;
    void fetchPage()
      .then((page) => {
        if (!active) return;
        setOrders(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [fetchPage]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(false);
    try {
      const page = await fetchPage(nextCursor);
      startTransition(() => {
        setOrders((current) => {
          const ids = new Set(current.map((order) => order.id));
          return [...current, ...page.items.filter((order) => !ids.has(order.id))];
        });
        setNextCursor(page.nextCursor);
      });
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="orders-heading" className="mx-auto max-w-4xl">
        <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('nav.brand')}</p>
        <h1 id="orders-heading" className="mt-2 text-[length:var(--text-h1)] font-bold">{t('orders.title')}</h1>
        <p className="mt-3 max-w-2xl text-[length:var(--text-body)] text-muted-foreground">{t('orders.history_subtitle')}</p>

        {isLoading ? (
          <div className="mt-8 space-y-4" aria-busy="true" aria-label={t('common.loading')}>
            {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-md border border-border bg-card motion-reduce:animate-none" />)}
          </div>
        ) : orders.length === 0 && !error ? (
          <div className="mt-8 border-y border-border py-14 text-center">
            <PackageOpen aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-[length:var(--text-h2)] font-bold">{t('orders.empty')}</h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('orders.empty_subtitle')}</p>
            <Link href="/directory" className="mt-6 inline-flex min-h-12 items-center rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
              {t('orders.browse_directory')}
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${encodeURIComponent(order.id)}`} className="group grid min-h-32 gap-4 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-[length:var(--text-caption)] font-bold ${statusStyle[order.status]}`}>{t(`orders.${order.status}`)}</span>
                    <span className="text-[length:var(--text-caption)] text-muted-foreground">{formatDate(order.createdAt, lang)}</span>
                  </div>
                  <h2 className="mt-3 text-[length:var(--text-body-lg)] font-bold">{t('orders.order_number', { id: shortId(order.id) })}</h2>
                  <p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">{t('orders.item_count', { count: order.items.reduce((sum, item) => sum + item.quantity, 0) })} · {t('orders.delivery_unit', { unit: order.deliveryUnit })}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <strong className="text-[length:var(--text-body-lg)]">{formatMoney(order.totalAmount, lang)}</strong>
                  <ArrowRight aria-hidden="true" className="size-5 text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 motion-reduce:transition-none" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {error && <p role="alert" className="mt-5 rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{t('errors.server')}</p>}
        {nextCursor && (
          <div className="mt-8 text-center">
            <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="min-h-12 rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
              {isLoadingMore ? t('common.loading') : t('common.load_more')}
            </button>
          </div>
        )}
      </section>
    </Container>
  );
}

export function shortId(id: string): string { return id.slice(-6).toUpperCase(); }
export function formatMoney(value: number, lang: 'ar' | 'en'): string { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value); }
export function formatDate(value: string, lang: 'ar' | 'en'): string { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }