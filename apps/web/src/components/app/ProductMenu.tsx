'use client';

import { Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import type { Product, ProductPage } from '@/lib/api/products';
import type { Shop } from '@/lib/api/shops';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cartTotal } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { useTranslation } from '@/lib/i18n';

export function ProductMenu({ shop, initialPage }: { shop: Shop; initialPage: ProductPage | null }) {
  const pathname = usePathname();
  const { isLoading: isAuthLoading, user } = useAuth();
  const { state, dispatch, isHydrated } = useCart();
  const { lang, t } = useTranslation();
  const [products, setProducts] = React.useState<Product[]>(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = React.useState(initialPage?.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState(initialPage === null);
  const [showAuthWall, setShowAuthWall] = React.useState(false);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/shops/${encodeURIComponent(shop.id)}/products?cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (!response.ok) throw new Error('products');
      const payload = (await response.json()) as { data: ProductPage };
      React.startTransition(() => {
        setProducts((current) => {
          const known = new Set(current.map((product) => product.id));
          return [...current, ...payload.data.items.filter((product) => !known.has(product.id))];
        });
        setNextCursor(payload.data.nextCursor);
      });
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function add(product: Product) {
    if (!user) {
      setShowAuthWall(true);
      return;
    }
    dispatch({
      type: 'add',
      shopId: shop.id,
      shopName: lang === 'ar' ? shop.nameAr : shop.name,
      item: {
        productId: product.id,
        name: product.name,
        nameAr: product.nameAr,
        price: product.price,
        quantity: 1,
        imageUrl: product.imageUrl,
      },
    });
  }

  return (
    <section aria-labelledby="menu-title" className="border-t border-border py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('directory.menu')}</p>
          <h2 id="menu-title" className="mt-2 text-[length:var(--text-h2)] font-bold text-foreground">
            {t('directory.menu')}
          </h2>
        </div>
        {isHydrated && state.items.length > 0 && (
          <Link
            href="/cart"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary px-4 text-[length:var(--text-label)] font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <ShoppingBag aria-hidden="true" className="size-4.5" />
            {state.items.reduce((count, item) => count + item.quantity, 0)} · {formatCurrency(cartTotal(state), lang)}
          </Link>
        )}
      </div>

      {error && products.length === 0 ? (
        <p role="alert" className="mt-6 border-y border-border py-5 text-muted-foreground">{t('errors.server')}</p>
      ) : products.length === 0 ? (
        <p className="mt-6 border-y border-border py-5 text-muted-foreground">{t('common.no_results')}</p>
      ) : (
        <div className="mt-6 divide-y divide-border border-y border-border">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} lang={lang} onAdd={() => add(product)} />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="min-h-12 rounded-md border border-border px-6 font-bold text-foreground hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
            {isLoadingMore ? t('common.loading') : t('common.load_more')}
          </button>
          {error && <p role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t('errors.server')}</p>}
        </div>
      )}

      {isHydrated && state.pending && (
        <div className="mt-5 rounded-md border border-warning/50 bg-warning/10 p-4" role="alertdialog" aria-labelledby="cart-conflict-title">
          <h3 id="cart-conflict-title" className="font-bold text-foreground">{t('cart.shop_conflict_title')}</h3>
          <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
            {t('cart.shop_conflict_body', { shopName: state.shopName ?? '' })}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => dispatch({ type: 'accept-conflict' })} className="min-h-11 rounded-md bg-primary px-4 font-bold text-primary-foreground">
              {t('cart.clear_and_add')}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'dismiss-conflict' })} className="min-h-11 rounded-md border border-border px-4 font-bold text-foreground">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {showAuthWall && !isAuthLoading && (
        <div className="mt-5 rounded-md border border-border bg-card p-5" role="dialog" aria-labelledby="auth-wall-title">
          <h3 id="auth-wall-title" className="font-bold text-foreground">{t('cart.sign_in_title')}</h3>
          <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('cart.sign_in_body')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-bold text-primary-foreground">
              {t('auth.login')}
            </Link>
            <button type="button" onClick={() => setShowAuthWall(false)} className="min-h-11 rounded-md border border-border px-4 font-bold text-foreground">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductRow({ product, lang, onAdd }: { product: Product; lang: 'ar' | 'en'; onAdd: () => void }) {
  const { t } = useTranslation();
  const name = lang === 'ar' ? product.nameAr : product.name;
  const description = lang === 'ar' ? product.descriptionAr : product.description;
  return (
    <article className="grid min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-5">
      <div className="min-w-0">
        <h3 className="font-bold text-foreground">{name}</h3>
        {description && <p className="mt-1 line-clamp-2 text-[length:var(--text-body)] text-muted-foreground">{description}</p>}
        <p className="mt-2 font-bold text-primary">{formatCurrency(product.price, lang)}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`${t('directory.add_to_cart')}: ${name}`}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
    </article>
  );
}

export function formatCurrency(value: number, lang: 'ar' | 'en'): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(value);
}