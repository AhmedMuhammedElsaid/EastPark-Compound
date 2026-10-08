'use client';

import { ExternalLink, Plus, Search, SearchX, Store, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { LeadToasts, useToasts } from '@/components/admin/residents/LeadToasts';
import { errorKeyOf, fetchMerchants, type AdminMerchantItem } from '@/lib/api/admin-shops';
import { useTranslation } from '@/lib/i18n';

import { EmptyState, ErrorState, FOCUS, initialOf, LoadMoreButton, PanelHeader, RowsSkeleton } from '../team/panel-parts';
import { CreateShopForm, type CreatedShop } from './CreateShopForm';

const SEARCH_DEBOUNCE_MS = 350;

const PRIMARY_ACTION = `inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 ${FOCUS}`;
const ROW_ACTION = `inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:border-primary/60 hover:bg-muted ${FOCUS}`;

/**
 * ADMIN / SUPER_ADMIN: every live merchant account with the shop it runs, and "Create shop" for a
 * merchant. Every live shop has a live MERCHANT owner (role change and account delete 409 while a
 * shop is owned), so this list covers every live shop.
 */
export function ShopsPanel() {
  const { t, lang } = useTranslation();
  const { toasts, push, dismiss } = useToasts();

  const [view, setView] = React.useState<{ mode: 'list' } | { mode: 'create'; merchant: AdminMerchantItem | null }>({ mode: 'list' });
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [rows, setRows] = React.useState<AdminMerchantItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [listState, setListState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const listSeq = React.useRef(0);
  const debouncedRef = React.useRef('');
  const titleId = React.useId();
  const searchId = React.useId();

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      if (next === debouncedRef.current) return;
      debouncedRef.current = next;
      setListState('loading');
      setDebouncedQuery(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    const seq = ++listSeq.current;
    void (async () => {
      try {
        const page = await fetchMerchants({ q: debouncedQuery || undefined });
        if (seq !== listSeq.current) return;
        setRows(page.items);
        setNextCursor(page.nextCursor);
        setListState('ready');
      } catch {
        if (seq === listSeq.current) setListState('error');
      }
    })();
  }, [debouncedQuery, reloadKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const seq = listSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchMerchants({ q: debouncedQuery || undefined, cursor: nextCursor });
      if (seq !== listSeq.current) return;
      setRows((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      push('error', t(`admin_shops.errors.${errorKeyOf(error)}`));
    } finally {
      setLoadingMore(false);
    }
  }

  const shopName = (shop: { name: string; nameAr: string }) => (lang === 'ar' ? shop.nameAr || shop.name : shop.name || shop.nameAr);

  function created(merchant: AdminMerchantItem, shop: CreatedShop, photoAttached: boolean) {
    const name = merchant.name || merchant.email;
    const label = shopName(shop);
    const owned = { ...merchant, shop };
    // Show the new shop on its merchant's row (adding the row when it was not loaded).
    setRows((current) => (current.some((item) => item.id === merchant.id) ? current.map((item) => (item.id === merchant.id ? owned : item)) : [owned, ...current]));
    push('success', t('admin_shops.success', { shop: label, name }));
    if (!photoAttached) push('error', t('admin_shops.photo_failed', { shop: label }));
    setView({ mode: 'list' });
  }

  if (view.mode === 'create') {
    return (
      <>
        <CreateShopForm initialMerchant={view.merchant} onCancel={() => setView({ mode: 'list' })} onCreated={created} />
        <LeadToasts toasts={toasts} onDismiss={dismiss} />
      </>
    );
  }

  return (
    <section aria-labelledby={titleId} className="border-t border-border pt-8">
      <PanelHeader
        titleId={titleId}
        icon={Store}
        title={t('admin_shops.title')}
        intro={t('admin_shops.intro')}
        action={
          <button type="button" onClick={() => setView({ mode: 'create', merchant: null })} className={PRIMARY_ACTION}>
            <Plus aria-hidden="true" className="size-4.5" />
            {t('admin_shops.create')}
          </button>
        }
      />

      <div>
        <label htmlFor={searchId} className="mb-1.5 block text-[length:var(--text-label)] font-semibold text-muted-foreground">
          {t('admin_shops.search_label')}
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('admin_shops.search_placeholder')}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            className={`min-h-12 w-full rounded-md border border-input bg-background ps-11 pe-12 text-[length:var(--text-body)] placeholder:text-muted-foreground focus:border-primary ${FOCUS} [&::-webkit-search-cancel-button]:hidden`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('admin_leads.clear_search')}
              className={`absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5" aria-busy={listState === 'loading' || undefined}>
        {listState === 'loading' && <RowsSkeleton />}
        {listState === 'error' && (
          <ErrorState
            message={t('admin_shops.load_error')}
            retryLabel={t('admin_shops.retry')}
            onRetry={() => {
              setListState('loading');
              setReloadKey((key) => key + 1);
            }}
          />
        )}
        {listState === 'ready' && rows.length === 0 && (
          <EmptyState message={debouncedQuery ? t('admin_shops.empty') : t('admin_shops.empty_all')} icon={debouncedQuery ? SearchX : Store} />
        )}
        {listState === 'ready' && rows.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((merchant) => {
              const name = merchant.name || merchant.email;
              return (
                <li key={merchant.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-primary">
                      {initialOf(name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[length:var(--text-body-lg)] font-bold">
                        <bdi>{name}</bdi>
                      </p>
                      <p className="truncate text-[length:var(--text-body)] text-muted-foreground">
                        <bdi>{merchant.email}</bdi>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[length:var(--text-body)]">
                        <Store aria-hidden="true" className="size-4 shrink-0 text-primary" />
                        {merchant.shop ? (
                          <bdi className="truncate font-semibold">{shopName(merchant.shop)}</bdi>
                        ) : (
                          <span className="text-muted-foreground">{t('admin_shops.no_shop')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 ps-13 sm:ps-0">
                    {merchant.shop ? (
                      <Link
                        href={`/directory/${encodeURIComponent(merchant.shop.id)}`}
                        aria-label={t('admin_shops.view_shop_for', { shop: shopName(merchant.shop) })}
                        className={ROW_ACTION}
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                        {t('admin_shops.view_shop')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setView({ mode: 'create', merchant })}
                        aria-label={t('admin_shops.create_for', { name })}
                        className={ROW_ACTION}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        {t('admin_shops.create')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {listState === 'ready' && nextCursor && (
          <LoadMoreButton label={t('admin_shops.load_more')} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </div>

      <LeadToasts toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
