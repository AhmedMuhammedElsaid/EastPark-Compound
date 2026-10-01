'use client';

import { ClipboardList, Package, Save, Store } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Container } from '@/components/Container';
import { merchantApi } from '@/lib/api/merchant';
import { useTranslation } from '@/lib/i18n';
import type { MerchantShop } from '@/lib/schemas/merchant';

export function MerchantDashboard() {
  const { t } = useTranslation();
  const [shop, setShop] = React.useState<MerchantShop | null>(null);
  const [pending, setPending] = React.useState(0);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    Promise.all([merchantApi.shop(), merchantApi.orders({ status: 'PLACED', limit: 5 })])
      .then(([nextShop, orders]) => { if (active) { setShop(nextShop); setPending(orders.items.length); } })
      .catch(() => { if (active) setError(t('merchant.error_load')); });
    return () => { active = false; };
  }, [t]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const updated = await merchantApi.updateShop({
        name: String(form.get('name') ?? ''), nameAr: String(form.get('nameAr') ?? ''),
        description: String(form.get('description') ?? ''), descriptionAr: String(form.get('descriptionAr') ?? ''),
        phone: String(form.get('phone') ?? ''), whatsapp: String(form.get('whatsapp') ?? ''),
      });
      setShop(updated);
    } catch { setError(t('merchant.error_save')); } finally { setSaving(false); }
  }

  async function toggleOpen() {
    if (!shop) return;
    setSaving(true); setError('');
    try { setShop(await merchantApi.updateShop({ isOpen: !shop.isOpen })); }
    catch { setError(t('merchant.error_save')); } finally { setSaving(false); }
  }

  if (!shop && !error) return <Loading />;

  return (
    <Container className="py-8 sm:py-12">
      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('merchant.workspace')}</p><h1 className="mt-2 text-[length:var(--text-h1)] font-bold">{t('merchant.dashboard')}</h1><p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('merchant.dashboard_subtitle')}</p></div>
        {shop && <button type="button" role="switch" aria-checked={shop.isOpen} onClick={() => void toggleOpen()} disabled={saving} className={`inline-flex min-h-12 items-center gap-3 rounded-md border px-4 font-bold focus-visible:outline-2 focus-visible:outline-gold-500 ${shop.isOpen ? 'border-success text-success' : 'border-border text-muted-foreground'}`}><span className={`size-2.5 rounded-full ${shop.isOpen ? 'bg-success' : 'bg-muted-foreground'}`} />{shop.isOpen ? t('merchant.open') : t('merchant.closed')}</button>}
      </header>

      {error && <p role="alert" className="mt-6 rounded-sm bg-error/12 px-4 py-3 text-error">{error}</p>}
      <section aria-label={t('merchant.quick_actions')} className="grid gap-3 border-b border-border py-6 sm:grid-cols-2">
        <Link href="/merchant/orders" className="flex min-h-20 items-center gap-4 rounded-md bg-muted px-5 focus-visible:outline-2 focus-visible:outline-gold-500"><ClipboardList className="size-6 text-primary" /><span><strong className="block">{t('merchant.orders')}</strong><small className="text-muted-foreground">{t('merchant.pending_count', { count: pending })}</small></span></Link>
        <Link href="/merchant/menu" className="flex min-h-20 items-center gap-4 rounded-md border border-border px-5 focus-visible:outline-2 focus-visible:outline-gold-500"><Package className="size-6 text-primary" /><span><strong className="block">{t('merchant.menu')}</strong><small className="text-muted-foreground">{t('merchant.manage_menu')}</small></span></Link>
      </section>

      {shop && <form onSubmit={save} className="py-8" aria-labelledby="shop-heading">
        <div className="flex items-center gap-3"><Store className="size-5 text-primary" /><h2 id="shop-heading" className="text-[length:var(--text-h2)] font-bold">{t('merchant.shop_profile')}</h2></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField name="name" label={t('merchant.name_en')} defaultValue={shop.name} required />
          <TextField name="nameAr" label={t('merchant.name_ar')} defaultValue={shop.nameAr} required dir="rtl" />
          <TextField name="description" label={t('merchant.description_en')} defaultValue={shop.description ?? ''} area />
          <TextField name="descriptionAr" label={t('merchant.description_ar')} defaultValue={shop.descriptionAr ?? ''} area dir="rtl" />
          <TextField name="phone" label={t('merchant.phone')} defaultValue={shop.phone ?? ''} type="tel" />
          <TextField name="whatsapp" label={t('merchant.whatsapp')} defaultValue={shop.whatsapp ?? ''} type="tel" />
        </div>
        <button type="submit" disabled={saving} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60"><Save className="size-4.5" />{saving ? t('common.loading') : t('merchant.save')}</button>
      </form>}
    </Container>
  );
}

function TextField({ area, dir, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { area?: boolean; label: string }) {
  const classes = 'mt-2 min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-[length:var(--text-body)] outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';
  return <label className="text-[length:var(--text-label)] font-semibold">{label}{area ? <textarea name={props.name} defaultValue={String(props.defaultValue ?? '')} dir={dir} rows={4} className={classes} /> : <input {...props} dir={dir} className={classes} />}</label>;
}

function Loading() { const { t } = useTranslation(); return <Container className="py-12"><div role="status" aria-busy="true" className="space-y-4"><span className="sr-only">{t('common.loading')}</span><div className="h-8 w-48 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" /><div className="h-40 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" /></div></Container>; }
