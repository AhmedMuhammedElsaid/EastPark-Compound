'use client';

import { Search, Star, Store, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useEffect, useState } from 'react';

import { Container } from '@/components/Container';
import type { Shop, ShopCategory, ShopPage } from '@/lib/api/shops';
import { shopCategories } from '@/lib/api/shops';
import { useTranslation } from '@/lib/i18n';

type DirectoryShopListProps = {
  category?: ShopCategory;
  initialPage: ShopPage | null;
  initialSearch: string;
};

const categoryTranslationKeys = {
  CAFE_AND_FOOD: 'directory.cafe_food',
  GROCERY: 'directory.grocery',
  BUTCHER: 'directory.butcher',
  SERVICES: 'directory.services',
  OTHER: 'directory.other',
} satisfies Record<ShopCategory, string>;

export function DirectoryShopList({ category, initialPage, initialSearch }: DirectoryShopListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useTranslation();
  const [search, setSearch] = useState(initialSearch);
  const [items, setItems] = useState(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (search.trim() === initialSearch) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ''}`));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [category, initialSearch, pathname, router, search]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(false);

    const params = new URLSearchParams({ cursor: nextCursor });
    if (category) params.set('category', category);
    if (initialSearch) params.set('search', initialSearch);

    try {
      const response = await fetch(`/api/shops?${params.toString()}`);
      if (!response.ok) throw new Error('Request failed');
      const payload = (await response.json()) as { data: ShopPage };
      startTransition(() => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...payload.data.items.filter((item) => !known.has(item.id))];
        });
        setNextCursor(payload.data.nextCursor);
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="directory-title" className="mx-auto max-w-6xl">
        <div className="max-w-[42rem]">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
            {t('nav.brand')}
          </p>
          <h1 id="directory-title" className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">
            {t('directory.title')}
          </h1>
        </div>

        <div className="mt-7 flex min-h-12 items-center gap-3 rounded-full border border-border bg-card px-4 focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <label htmlFor="shop-search" className="sr-only">{t('directory.search_placeholder')}</label>
          <input
            id="shop-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('directory.search_placeholder')}
            className="min-w-0 flex-1 bg-transparent text-[length:var(--text-body-lg)] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('common.clear')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <X aria-hidden="true" className="size-4.5" />
            </button>
          )}
        </div>

        <nav aria-label={t('common.filter')} className="announcement-filters mt-4 flex gap-2 overflow-x-auto pb-2">
          <CategoryLink active={!category} href={directoryHref(undefined, initialSearch)} label={t('directory.all_categories')} />
          {shopCategories.map((value) => (
            <CategoryLink
              key={value}
              active={category === value}
              href={directoryHref(value, initialSearch)}
              label={t(categoryTranslationKeys[value])}
            />
          ))}
        </nav>

        {initialPage === null ? (
          <div role="alert" className="mt-8 border-y border-border py-10">
            <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('common.error')}</h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('errors.server')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 border-y border-border py-14 text-center">
            <Store aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-[length:var(--text-h2)] font-bold text-foreground">
              {initialSearch ? t('common.no_results') : t('directory.no_shops')}
            </h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('directory.no_shops_subtitle')}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((shop) => <ShopCard key={shop.id} shop={shop} lang={lang} />)}
          </div>
        )}

        {nextCursor && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60 motion-reduce:transition-none"
            >
              {isLoadingMore ? t('common.loading') : t('common.load_more')}
            </button>
            {loadError && <p role="alert" className="text-[length:var(--text-label)] text-error">{t('errors.server')}</p>}
          </div>
        )}
      </section>
    </Container>
  );
}

function directoryHref(category: ShopCategory | undefined, search: string): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  return `/directory${params.size ? `?${params}` : ''}`;
}

function CategoryLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function ShopCard({ shop, lang }: { shop: Shop; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const coverPhoto = shop.photos.find((photo) => photo.isPrimary) ?? shop.photos[0];
  const name = lang === 'ar' ? shop.nameAr : shop.name;

  return (
    <article className="overflow-hidden rounded-md border border-border bg-card shadow-gold">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {coverPhoto ? (
          <div
            role="img"
            aria-label={name}
            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{ backgroundImage: `url(${JSON.stringify(coverPhoto.url)})` }}
          />
        ) : (
          <Store aria-hidden="true" className="absolute start-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground rtl:translate-x-1/2" />
        )}
        <span className={`absolute end-3 top-3 inline-flex min-h-8 items-center rounded-full px-3 text-[length:var(--text-caption)] font-bold ${
          shop.isOpen ? 'bg-success text-success-foreground' : 'border border-border bg-muted text-foreground'
        }`}>
          {shop.isOpen ? t('common.open') : t('common.closed')}
        </span>
      </div>
      <div className="p-4">
        <h2 className="truncate text-[length:var(--text-body-lg)] font-bold text-foreground">{name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--text-label)] text-muted-foreground">
          <span>{t(categoryTranslationKeys[shop.category])}</span>
          {shop.averageRating !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star aria-hidden="true" className="size-3.5 fill-primary text-primary" />
                <span>{shop.averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({shop.reviewCount})</span>
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}