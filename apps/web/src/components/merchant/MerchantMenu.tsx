'use client';

import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Container } from '@/components/Container';
import { merchantApi } from '@/lib/api/merchant';
import { useTranslation } from '@/lib/i18n';
import type { MerchantProduct, ProductInput } from '@/lib/schemas/merchant';

export function MerchantMenu() {
  const { lang, t } = useTranslation();
  const [items, setItems] = React.useState<MerchantProduct[]>([]);
  const [cursor, setCursor] = React.useState<string | null>();
  const [search, setSearch] = React.useState('');
  const [editing, setEditing] = React.useState<MerchantProduct | 'new' | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async (next?: string, append = false) => {
    setBusy(true); setError('');
    try { const page = await merchantApi.products({ cursor: next, limit: 20, search: search || undefined }); setItems((old) => append ? [...old, ...page.items] : page.items); setCursor(page.nextCursor ?? null); }
    catch { setError(t('merchant.error_load')); } finally { setBusy(false); }
  }, [search, t]);

  React.useEffect(() => { const timer = window.setTimeout(() => void load(), 300); return () => window.clearTimeout(timer); }, [load]);

  async function remove(product: MerchantProduct) {
    if (!window.confirm(t('merchant.confirm_delete'))) return;
    try { await merchantApi.deleteProduct(product.id); setItems((old) => old.filter((item) => item.id !== product.id)); }
    catch { setError(t('merchant.error_save')); }
  }

  async function toggle(product: MerchantProduct) {
    try { const updated = await merchantApi.updateProduct(product.id, { isAvailable: !product.isAvailable }); setItems((old) => old.map((item) => item.id === updated.id ? updated : item)); }
    catch { setError(t('merchant.error_save')); }
  }

  return <Container className="py-8 sm:py-12">
    <header className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('merchant.workspace')}</p><h1 className="mt-2 text-[length:var(--text-h1)] font-bold">{t('merchant.menu')}</h1><p className="mt-2 text-muted-foreground">{t('merchant.menu_subtitle')}</p></div><button type="button" onClick={() => setEditing('new')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"><Plus className="size-5" />{t('merchant.new_product')}</button></header>
    <label className="relative mt-6 block max-w-md"><span className="sr-only">{t('merchant.search_products')}</span><Search className="pointer-events-none absolute start-3 top-3.5 size-5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('merchant.search_products')} className="min-h-12 w-full rounded-md border border-input bg-background ps-11 pe-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" /></label>
    {error && <p role="alert" className="mt-5 bg-error/12 px-4 py-3 text-error">{error}</p>}
    <div className="mt-6 overflow-x-auto border-y border-border"><table className="w-full min-w-[720px] border-collapse text-start"><thead><tr className="text-[length:var(--text-label)] text-muted-foreground"><th className="px-3 py-4 text-start">{t('merchant.product')}</th><th className="px-3 py-4 text-start">{t('merchant.price')}</th><th className="px-3 py-4 text-start">{t('merchant.availability')}</th><th className="px-3 py-4 text-end">{t('merchant.actions')}</th></tr></thead><tbody>{items.map((product) => <tr key={product.id} className="border-t border-border"><td className="px-3 py-4"><strong>{lang === 'ar' ? product.nameAr : product.name}</strong><small className="mt-1 block text-muted-foreground">{lang === 'ar' ? product.name : product.nameAr}</small></td><td className="px-3 py-4 font-semibold">{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(product.price)}</td><td className="px-3 py-4"><button type="button" role="switch" aria-checked={product.isAvailable} onClick={() => void toggle(product)} className={`min-h-11 rounded-full border px-4 text-[length:var(--text-label)] font-bold ${product.isAvailable ? 'border-success text-success' : 'border-border text-muted-foreground'}`}>{product.isAvailable ? t('merchant.available') : t('merchant.unavailable')}</button></td><td className="px-3 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => setEditing(product)} aria-label={`${t('merchant.edit')} ${product.name}`} className="grid size-11 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-gold-500"><Pencil className="size-4.5" /></button><button type="button" onClick={() => void remove(product)} aria-label={`${t('merchant.delete')} ${product.name}`} className="grid size-11 place-items-center rounded-md text-error hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-error"><Trash2 className="size-4.5" /></button></div></td></tr>)}</tbody></table></div>
    {!busy && items.length === 0 && <p className="py-12 text-center text-muted-foreground">{t('merchant.empty_products')}</p>}{busy && <p role="status" className="py-6 text-muted-foreground">{t('common.loading')}</p>}{cursor && !busy && <button type="button" onClick={() => void load(cursor, true)} className="mt-6 min-h-12 rounded-md border border-border px-5 font-bold hover:bg-muted">{t('merchant.load_more')}</button>}
    {editing && <ProductDialog product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(saved) => { setItems((old) => editing === 'new' ? [saved, ...old] : old.map((item) => item.id === saved.id ? saved : item)); setEditing(null); }} />}
  </Container>;
}

function ProductDialog({ product, onClose, onSaved }: { product: MerchantProduct | null; onClose: () => void; onSaved: (product: MerchantProduct) => void }) {
  const { t } = useTranslation(); const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const input: ProductInput = { name: String(data.get('name')), nameAr: String(data.get('nameAr')), description: String(data.get('description')), descriptionAr: String(data.get('descriptionAr')), price: Number(data.get('price')), imageUrl: String(data.get('imageUrl')) }; setBusy(true); try { onSaved(product ? await merchantApi.updateProduct(product.id, input) : await merchantApi.createProduct(input)); } catch { setError(t('merchant.error_save')); setBusy(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-end bg-dark-bg/75 p-0 sm:place-items-center sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-card p-5 sm:max-w-2xl sm:rounded-lg sm:p-7"><div className="flex items-center justify-between gap-4"><h2 id="product-dialog-title" className="text-[length:var(--text-h2)] font-bold">{product ? t('merchant.edit_product') : t('merchant.new_product')}</h2><button type="button" onClick={onClose} className="min-h-11 px-3 text-muted-foreground">{t('common.cancel')}</button></div><form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">{(['name','nameAr','description','descriptionAr','price','imageUrl'] as const).map((name) => <label key={name} className="text-[length:var(--text-label)] font-semibold">{t(`merchant.field_${name}`)}<input name={name} defaultValue={product?.[name] ?? ''} required={name === 'name' || name === 'nameAr' || name === 'price'} type={name === 'price' ? 'number' : name === 'imageUrl' ? 'url' : 'text'} step={name === 'price' ? '0.01' : undefined} min={name === 'price' ? 0 : undefined} dir={name.endsWith('Ar') ? 'rtl' : undefined} className="mt-2 min-h-12 w-full rounded-md border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" /></label>)}{error && <p role="alert" className="text-error sm:col-span-2">{error}</p>}<button type="submit" disabled={busy} className="min-h-12 rounded-md bg-primary px-5 font-bold text-primary-foreground sm:col-span-2">{busy ? t('common.loading') : t('merchant.save')}</button></form></section></div>;
}
