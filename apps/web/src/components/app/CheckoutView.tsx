'use client';

import { Banknote, CreditCard, LockKeyhole, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/Button';
import { Container } from '@/components/Container';
import { formatCurrency } from '@/components/app/ProductMenu';
import { cardPaymentsEnabled, residentOrderingEnabled } from '@/config/features';
import { initiatePaymob, OrderRequestError, placeOrder, type PaymentMethod } from '@/lib/api/orders';
import type { AuthUser } from '@/lib/api/contracts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cartTotal } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { useTranslation } from '@/lib/i18n';
import { defaultUnitChoice, unitChoices } from '@/lib/units';

export function CheckoutView() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { state, isHydrated } = useCart();
  const { t } = useTranslation();

  React.useEffect(() => {
    if (!isLoading && !user) router.replace('/login?next=%2Fcheckout');
  }, [isLoading, router, user]);

  if (isLoading || !isHydrated || !user) {
    return <Container className="py-12"><div className="h-80 animate-pulse rounded-md bg-muted motion-reduce:animate-none" aria-label={t('common.loading')} /></Container>;
  }

  if (state.items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <ShoppingBag aria-hidden="true" className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-5 text-[length:var(--text-h1)] font-bold">{t('cart.empty')}</h1>
        <Link href="/directory" className="mt-6 inline-flex min-h-12 items-center rounded-md bg-primary px-6 font-bold text-primary-foreground">{t('directory.title')}</Link>
      </Container>
    );
  }

  return <CheckoutForm user={user} />;
}

function CheckoutForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const { state, dispatch } = useCart();
  const { lang, t } = useTranslation();
  const { refreshUser } = useAuth();
  // Delivery goes to one of the account's flats (labels), or the legacy single unit number.
  const flatChoices = unitChoices(user);
  const [pickedUnit, setPickedUnit] = React.useState(() => defaultUnitChoice(user));
  // The flats can change underneath (profile refresh): never send a value that is no longer offered.
  const deliveryUnit = flatChoices.includes(pickedUnit) ? pickedUnit : defaultUnitChoice(user);
  const [notes, setNotes] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('CASH');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = React.useState<{ id: string; totalAmount: number } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!residentOrderingEnabled) return;
    if (!deliveryUnit.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const order = createdOrder ?? await placeOrder({
        items: state.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        deliveryUnit: deliveryUnit.trim(),
        paymentMethod,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      if (paymentMethod === 'PAYMOB') {
        setCreatedOrder({ id: order.id, totalAmount: order.totalAmount });
        let payment;
        try {
          payment = await initiatePaymob(order.id);
          if (!payment.iframeUrl.startsWith('https://accept.paymob.com/')) throw new Error('Invalid payment URL');
        } catch {
          setError(t('checkout.payment_retry_error'));
          return;
        }
        dispatch({ type: 'clear' });
        window.location.assign(payment.iframeUrl);
        return;
      }

      dispatch({ type: 'clear' });
      router.replace(`/checkout/confirmation?orderId=${encodeURIComponent(order.id)}&total=${encodeURIComponent(order.totalAmount)}`);
    } catch (reason) {
      if (reason instanceof OrderRequestError && reason.status === 401) {
        router.replace('/login?next=%2Fcheckout');
        return;
      }
      if (reason instanceof OrderRequestError && reason.message === 'delivery_unit_invalid') {
        // The chosen flat is no longer the caller's: reload the flats so the picker is current.
        setError(t('checkout.delivery_unit_invalid'));
        void refreshUser();
        return;
      }
      setError(t('checkout.order_error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div>
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{state.shopName}</p>
          <h1 className="mt-2 text-[length:var(--text-h1)] font-bold">{t('checkout.title')}</h1>

          <fieldset disabled={Boolean(createdOrder) || !residentOrderingEnabled} className="mt-8 space-y-7 disabled:opacity-65">
            <DeliveryFlat choices={flatChoices} value={deliveryUnit} onChange={setPickedUnit} />
            <div>
              <label htmlFor="delivery-notes" className="mb-2 block font-bold">{t('checkout.notes')} <span className="font-normal text-muted-foreground">({t('common.optional')})</span></label>
              <textarea id="delivery-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={4} placeholder={t('checkout.notes_placeholder')} className="w-full rounded-md border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
            </div>
            <fieldset>
              <legend className="mb-3 font-bold">{t('checkout.payment')}</legend>
              <div className={cardPaymentsEnabled ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
                <PaymentOption selected={paymentMethod === 'CASH'} onSelect={() => setPaymentMethod('CASH')} label={t('checkout.cash')} icon={<Banknote aria-hidden="true" className="size-5" />} />
                {cardPaymentsEnabled && <PaymentOption selected={paymentMethod === 'PAYMOB'} onSelect={() => setPaymentMethod('PAYMOB')} label={t('checkout.card')} icon={<CreditCard aria-hidden="true" className="size-5" />} />}
              </div>
            </fieldset>
          </fieldset>
        </div>

        <aside aria-labelledby="checkout-summary" className="border-t border-border pt-7 lg:border-s lg:border-t-0 lg:ps-8 lg:pt-0">
          <h2 id="checkout-summary" className="text-[length:var(--text-h2)] font-bold">{t('cart.summary')}</h2>
          <ul className="mt-5 divide-y divide-border border-y border-border">
            {state.items.map((item) => <li key={item.productId} className="flex justify-between gap-4 py-3 text-[length:var(--text-body)]"><span>{item.quantity} × {lang === 'ar' ? item.nameAr : item.name}</span><span>{formatCurrency(item.price * item.quantity, lang)}</span></li>)}
          </ul>
          <div className="mt-4 flex justify-between gap-4 font-bold"><span>{t('cart.estimated_total')}</span><span>{formatCurrency(cartTotal(state), lang)}</span></div>
          <p className="mt-2 text-[length:var(--text-caption)] leading-5 text-muted-foreground">{t('cart.server_total_note')}</p>
          {!residentOrderingEnabled && <p role="status" className="mt-4 rounded-sm bg-warning/12 p-3 text-[length:var(--text-body)] font-semibold text-foreground">{t('orders.ordering_paused')}</p>}
          {error && <p role="alert" className="mt-4 rounded-sm bg-error/12 p-3 text-[length:var(--text-body)] text-error">{error}</p>}
          {createdOrder && <p className="mt-4 rounded-sm bg-info/12 p-3 text-[length:var(--text-body)] text-foreground">{t('checkout.order_created_payment_pending')}</p>}
          <Button type="submit" fullWidth disabled={!residentOrderingEnabled || isSubmitting || !deliveryUnit.trim()} aria-busy={isSubmitting} className="mt-6">
            <LockKeyhole aria-hidden="true" className="size-4.5" />
            {!residentOrderingEnabled ? t('orders.ordering_paused') : isSubmitting ? t('common.loading') : createdOrder ? t('checkout.retry_payment') : t('checkout.place_order')}
          </Button>
        </aside>
      </form>
    </Container>
  );
}

function DeliveryFlat({ choices, value, onChange }: { choices: string[]; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  if (choices.length === 0) {
    return (
      <div>
        <p className="mb-2 font-bold">{t('checkout.delivery_flat')}</p>
        <p role="status" className="rounded-sm bg-warning/12 p-3 text-[length:var(--text-body)] font-semibold text-foreground">{t('checkout.no_flat')}</p>
      </div>
    );
  }
  if (choices.length === 1) {
    return (
      <div>
        <p className="mb-2 font-bold">{t('checkout.delivery_flat')}</p>
        <p className="flex min-h-12 items-center rounded-md border border-border bg-muted/35 px-4 font-semibold text-foreground">
          <bdi dir="ltr">{choices[0]}</bdi>
        </p>
        <p className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">{t('checkout.delivery_flat_single')}</p>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="delivery-unit" className="mb-2 block font-bold">{t('checkout.delivery_flat')}</label>
      <select id="delivery-unit" value={value} onChange={(event) => onChange(event.target.value)} required dir="ltr" aria-describedby="delivery-unit-hint" className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25">
        {choices.map((label) => <option key={label} value={label}>{label}</option>)}
      </select>
      <p id="delivery-unit-hint" className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">{t('checkout.delivery_flat_hint')}</p>
    </div>
  );
}

function PaymentOption({ selected, onSelect, label, icon }: { selected: boolean; onSelect: () => void; label: string; icon: React.ReactNode }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 font-bold ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
      <input type="radio" name="paymentMethod" checked={selected} onChange={onSelect} className="size-4 accent-primary" />
      {icon}<span>{label}</span>
    </label>
  );
}