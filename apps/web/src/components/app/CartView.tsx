'use client';

import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { formatCurrency } from '@/components/app/ProductMenu';
import { cartTotal } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { useTranslation } from '@/lib/i18n';

export function CartView() {
  const { state, dispatch, isHydrated } = useCart();
  const { lang, t } = useTranslation();

  if (!isHydrated) {
    return <Container className="py-10"><div className="h-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" /></Container>;
  }

  if (state.items.length === 0) {
    return (
      <Container className="py-16 sm:py-24">
        <section className="mx-auto max-w-xl text-center" aria-labelledby="empty-cart-title">
          <ShoppingBag aria-hidden="true" className="mx-auto size-12 text-muted-foreground" />
          <h1 id="empty-cart-title" className="mt-5 text-[length:var(--text-h1)] font-bold text-foreground">{t('cart.empty')}</h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('cart.empty_subtitle')}</p>
          <ButtonLink href="/directory" className="mt-7">{t('directory.title')}</ButtonLink>
        </section>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/directory" className="inline-flex min-h-11 items-center gap-2 font-bold text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-gold-500">
          <ArrowLeft aria-hidden="true" className={`size-4.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          {t('common.back')}
        </Link>
        <header className="mt-5 border-b border-border pb-6">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{state.shopName}</p>
          <h1 className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">{t('cart.title')}</h1>
        </header>

        <div className="grid gap-10 py-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <div className="divide-y divide-border border-y border-border">
            {state.items.map((item) => {
              const name = lang === 'ar' ? item.nameAr : item.name;
              return (
                <article key={item.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5">
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground">{name}</h2>
                    <p className="mt-1 text-[length:var(--text-body)] text-primary">{formatCurrency(item.price, lang)}</p>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'remove', productId: item.productId })}
                      className="mt-2 inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-error focus-visible:outline-2 focus-visible:outline-gold-500"
                    >
                      <Trash2 aria-hidden="true" className="size-4" /> {t('common.delete')}
                    </button>
                  </div>
                  <div className="grid grid-cols-[44px_3ch_44px] items-center rounded-md border border-border" aria-label={`${name}: ${item.quantity}`}>
                    <button type="button" onClick={() => dispatch({ type: 'set-quantity', productId: item.productId, quantity: item.quantity - 1 })} aria-label={`${t('cart.decrease')} ${name}`} className="inline-flex min-h-11 items-center justify-center hover:bg-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold-500">
                      <Minus aria-hidden="true" className="size-4" />
                    </button>
                    <span className="text-center font-bold" aria-live="polite">{item.quantity}</span>
                    <button type="button" onClick={() => dispatch({ type: 'set-quantity', productId: item.productId, quantity: item.quantity + 1 })} aria-label={`${t('cart.increase')} ${name}`} className="inline-flex min-h-11 items-center justify-center hover:bg-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold-500">
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside aria-labelledby="cart-summary-title" className="border-t border-border pt-6 lg:border-s lg:border-t-0 lg:ps-7 lg:pt-0">
            <h2 id="cart-summary-title" className="text-[length:var(--text-h2)] font-bold">{t('cart.summary')}</h2>
            <div className="mt-5 flex items-center justify-between gap-4 border-y border-border py-4">
              <span className="text-muted-foreground">{t('cart.estimated_total')}</span>
              <strong>{formatCurrency(cartTotal(state), lang)}</strong>
            </div>
            <p className="mt-3 text-[length:var(--text-caption)] leading-5 text-muted-foreground">{t('cart.server_total_note')}</p>
            <ButtonLink href="/checkout" fullWidth className="mt-6">{t('cart.checkout')}</ButtonLink>
            <button type="button" onClick={() => dispatch({ type: 'clear' })} className="mt-3 min-h-11 w-full font-bold text-muted-foreground hover:text-error focus-visible:outline-2 focus-visible:outline-gold-500">
              {t('common.clear')}
            </button>
          </aside>
        </div>
      </div>
    </Container>
  );
}