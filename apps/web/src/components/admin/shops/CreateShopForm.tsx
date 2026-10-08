'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ImagePlus, Store, X } from 'lucide-react';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/Button';
import { CONTROL_CLASS, controlBorder, Field } from '@/components/form/Field';
import {
  addShopPhoto,
  createShop,
  errorKeyOf,
  fetchMerchants,
  uploadShopPhoto,
  type AdminMerchantItem,
} from '@/lib/api/admin-shops';
import { useTranslation } from '@/lib/i18n';
import {
  DELIVERY_MAX_MINUTES,
  DESCRIPTION_MAX,
  emptyShopForm,
  NAME_MAX,
  shopCategories,
  shopFormSchema,
  toShopCreatePayload,
  weekDays,
  type ShopCategory,
  type ShopFormValues,
} from '@/lib/validation/admin-shops';

import { FOCUS, PanelHeader } from '../team/panel-parts';

const CATEGORY_KEYS = {
  CAFE_AND_FOOD: 'directory.cafe_food',
  GROCERY: 'directory.grocery',
  BUTCHER: 'directory.butcher',
  SERVICES: 'directory.services',
  OTHER: 'directory.other',
} satisfies Record<ShopCategory, string>;

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const SEARCH_DEBOUNCE_MS = 350;

export type CreatedShop = { id: string; name: string; nameAr: string };

type Props = {
  /** Preselected merchant (from a row's "Create shop" action). */
  initialMerchant: AdminMerchantItem | null;
  onCancel: () => void;
  onCreated: (merchant: AdminMerchantItem, shop: CreatedShop, photoAttached: boolean) => void;
};

/** Merchant picker: a debounced search feeding a native select; merchants who run a shop are disabled. */
function MerchantPicker({
  selected,
  onChange,
  error,
}: {
  selected: AdminMerchantItem | null;
  onChange: (merchant: AdminMerchantItem | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [items, setItems] = React.useState<AdminMerchantItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const seq = React.useRef(0);
  const searchId = React.useId();

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    const current = ++seq.current;
    void (async () => {
      try {
        const page = await fetchMerchants({ q: debounced || undefined, limit: 50 });
        if (current !== seq.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setState('ready');
      } catch {
        if (current === seq.current) setState('error');
      }
    })();
  }, [debounced]);

  // Keep the selected merchant listed even when the current search no longer matches it.
  const options = selected && !items.some((item) => item.id === selected.id) ? [selected, ...items] : items;

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const current = seq.current;
    setLoadingMore(true);
    try {
      const page = await fetchMerchants({ q: debounced || undefined, cursor: nextCursor, limit: 50 });
      if (current !== seq.current) return;
      setItems((existing) => {
        const seen = new Set(existing.map((item) => item.id));
        return [...existing, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setState('error');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-[length:var(--text-label)] font-medium text-foreground">
          {t('admin_shops.search_label')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('admin_shops.search_placeholder')}
          autoComplete="off"
          maxLength={100}
          className={`${CONTROL_CLASS} ${controlBorder(false)}`}
        />
      </div>
      <Field id="shop-merchant" label={t('admin_shops.merchant')} error={error} required hint={t('admin_shops.merchant_hint')}>
        {(a11y) => (
          <select
            {...a11y}
            value={selected?.id ?? ''}
            onChange={(event) => onChange(options.find((item) => item.id === event.target.value) ?? null)}
            aria-busy={state === 'loading' || undefined}
            className={`${CONTROL_CLASS} ${controlBorder(Boolean(error))}`}
          >
            <option value="">
              {state === 'loading' ? t('admin_shops.merchants_loading') : state === 'error' ? t('admin_shops.merchants_error') : t('admin_shops.merchant_placeholder')}
            </option>
            {options.map((item) => {
              const name = item.name || item.email;
              const label = item.shop
                ? t('admin_shops.merchant_has_shop_option', { name, shop: item.shop.name || item.shop.nameAr })
                : `${name} · ${item.email}`;
              return (
                <option key={item.id} value={item.id} disabled={Boolean(item.shop)}>
                  {label}
                </option>
              );
            })}
          </select>
        )}
      </Field>
      {nextCursor && state === 'ready' && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 font-semibold text-primary hover:bg-muted disabled:cursor-wait lg:col-start-2 lg:justify-self-start ${FOCUS}`}
        >
          {loadingMore ? t('common.loading') : t('admin_shops.merchant_more')}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-[length:var(--text-body-lg)] font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** ADMIN / SUPER_ADMIN: create a shop and assign it to a merchant (`POST /v1/shops`). */
export function CreateShopForm({ initialMerchant, onCancel, onCreated }: Props) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const [merchant, setMerchant] = React.useState<AdminMerchantItem | null>(initialMerchant);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: emptyShopForm(initialMerchant?.id ?? ''),
  });
  const hoursEnabled = useWatch({ control, name: 'hoursEnabled' });
  const hours = useWatch({ control, name: 'hours' });

  React.useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!PHOTO_TYPES.has(file.type) || file.size > PHOTO_MAX_BYTES) {
      setPhotoError(t(PHOTO_TYPES.has(file.type) ? 'admin_shops.photo_size_error' : 'admin_shops.photo_type_error'));
      event.target.value = '';
      return;
    }
    setPhotoError(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setPhotoInputKey((key) => key + 1);
  }

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    if (!merchant || merchant.id !== values.merchantId) {
      setSubmitError(t('admin_shops.errors.merchant_invalid'));
      return;
    }
    try {
      // Upload first: a bad image fails before anything is created.
      const photoUrl = photo ? await uploadShopPhoto(photo) : null;
      const payload = toShopCreatePayload(values);
      const { id } = await createShop(payload);
      let photoAttached = true;
      if (photoUrl) {
        try {
          await addShopPhoto(id, photoUrl);
        } catch {
          // The shop exists: never re-create it, only report the missing photo.
          photoAttached = false;
        }
      }
      onCreated(merchant, { id, name: payload.name, nameAr: payload.nameAr }, photoAttached);
    } catch (error) {
      setSubmitError(t(`admin_shops.errors.${errorKeyOf(error)}`));
    }
  });

  const invalid = t('admin_shops.field_error');
  return (
    <section aria-labelledby={titleId} className="border-t border-border pt-8">
      <PanelHeader
        titleId={titleId}
        icon={Store}
        title={t('admin_shops.form_title')}
        intro={t('admin_shops.form_intro')}
        action={
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
          >
            <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
            {t('admin_shops.back')}
          </button>
        }
      />
      <form onSubmit={submit} className="space-y-8" noValidate>
        <Section title={t('admin_shops.section_owner')}>
          <input type="hidden" {...register('merchantId')} />
          <MerchantPicker
            selected={merchant}
            error={errors.merchantId && invalid}
            onChange={(next) => {
              setMerchant(next);
              setValue('merchantId', next?.id ?? '', { shouldValidate: Boolean(errors.merchantId) });
            }}
          />
        </Section>

        <Section title={t('admin_shops.section_details')}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field id="shop-name-ar" label={t('admin_shops.name_ar')} error={errors.nameAr && invalid} required>
              {(a11y) => <input {...register('nameAr')} {...a11y} dir="rtl" maxLength={NAME_MAX} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.nameAr))}`} />}
            </Field>
            <Field id="shop-name-en" label={t('admin_shops.name_en')} error={errors.name && invalid} required>
              {(a11y) => <input {...register('name')} {...a11y} dir="ltr" maxLength={NAME_MAX} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.name))}`} />}
            </Field>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field id="shop-description-ar" label={t('admin_shops.description_ar')} error={errors.descriptionAr && invalid}>
              {(a11y) => <textarea {...register('descriptionAr')} {...a11y} dir="rtl" rows={4} maxLength={DESCRIPTION_MAX} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.descriptionAr))} resize-y py-3`} />}
            </Field>
            <Field id="shop-description-en" label={t('admin_shops.description_en')} error={errors.description && invalid}>
              {(a11y) => <textarea {...register('description')} {...a11y} dir="ltr" rows={4} maxLength={DESCRIPTION_MAX} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.description))} resize-y py-3`} />}
            </Field>
          </div>
          <div className="lg:w-1/2 lg:pe-2.5">
            <Field id="shop-category" label={t('admin_shops.category')} required>
              {(a11y) => (
                <select {...register('category')} {...a11y} className={`${CONTROL_CLASS} ${controlBorder(false)}`}>
                  {shopCategories.map((category) => (
                    <option key={category} value={category}>{t(CATEGORY_KEYS[category])}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Section>

        <Section title={t('admin_shops.section_contact')}>
          <div className="grid gap-5 lg:grid-cols-3">
            <Field id="shop-phone" label={t('admin_shops.phone')} error={errors.phone && t('admin_shops.phone_error')} hint={t('admin_shops.phone_hint')}>
              {(a11y) => <input {...register('phone')} {...a11y} type="tel" dir="ltr" inputMode="tel" autoComplete="off" maxLength={20} placeholder="+201012345678" className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.phone))}`} />}
            </Field>
            <Field id="shop-whatsapp" label={t('admin_shops.whatsapp')} error={errors.whatsapp && t('admin_shops.phone_error')}>
              {(a11y) => <input {...register('whatsapp')} {...a11y} type="tel" dir="ltr" inputMode="tel" autoComplete="off" maxLength={20} placeholder="+201012345678" className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.whatsapp))}`} />}
            </Field>
            <Field id="shop-delivery" label={t('admin_shops.delivery_time')} error={errors.deliveryTime && t('admin_shops.delivery_error')}>
              {(a11y) => <input {...register('deliveryTime')} {...a11y} type="number" dir="ltr" inputMode="numeric" min={1} max={DELIVERY_MAX_MINUTES} step={1} placeholder="25" className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.deliveryTime))}`} />}
            </Field>
          </div>
        </Section>

        <Section title={t('admin_shops.section_hours')}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[length:var(--text-body)] font-semibold">
            <input type="checkbox" {...register('hoursEnabled')} className="size-5 accent-[var(--color-primary)]" />
            {t('admin_shops.hours_toggle')}
          </label>
          <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('admin_shops.hours_hint')}</p>
          {hoursEnabled && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {weekDays.map((day) => {
                const closed = hours?.[day]?.closed ?? false;
                const dayError = errors.hours?.[day];
                return (
                  <div key={day} className="grid grid-cols-2 items-center gap-3 px-4 py-3 sm:grid-cols-[8rem_7rem_1fr_1fr]">
                    <span className="font-semibold">{t(`directory.days.${day}`)}</span>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[length:var(--text-body)]">
                      <input type="checkbox" {...register(`hours.${day}.closed`)} className="size-5 accent-[var(--color-primary)]" />
                      {t('admin_shops.day_closed')}
                    </label>
                    {/* A closed day hides its times (values are kept; the payload sends placeholders). */}
                    {!closed && (
                      <>
                        <label className="flex flex-col gap-1 text-[length:var(--text-caption)] text-muted-foreground">
                          {t('admin_shops.opens')}
                          <input type="time" {...register(`hours.${day}.open`)} dir="ltr" aria-invalid={Boolean(dayError) || undefined} className={`${CONTROL_CLASS} ${controlBorder(Boolean(dayError))}`} />
                        </label>
                        <label className="flex flex-col gap-1 text-[length:var(--text-caption)] text-muted-foreground">
                          {t('admin_shops.closes')}
                          <input type="time" {...register(`hours.${day}.close`)} dir="ltr" aria-invalid={Boolean(dayError) || undefined} className={`${CONTROL_CLASS} ${controlBorder(Boolean(dayError))}`} />
                        </label>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {errors.hours && <p role="alert" className="text-[length:var(--text-caption)] text-error">{t('admin_shops.hours_error')}</p>}
        </Section>

        <Section title={t('admin_shops.section_photo')}>
          <div className="flex flex-wrap items-center gap-4">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={photoPreview} alt="" className="h-24 w-36 rounded-md border border-border object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-24 w-36 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                <ImagePlus className="size-6" />
              </span>
            )}
            <div className="flex flex-col gap-2">
              <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-4 font-semibold hover:border-primary/60 hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500`}>
                <ImagePlus aria-hidden="true" className="size-4.5" />
                {t('admin_shops.photo_choose')}
                <input key={photoInputKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={isSubmitting} className="sr-only" />
              </label>
              {photo && (
                <button type="button" onClick={clearPhoto} disabled={isSubmitting} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-muted-foreground hover:bg-muted hover:text-error ${FOCUS}`}>
                  <X aria-hidden="true" className="size-4" />
                  {t('admin_shops.photo_remove')}
                </button>
              )}
              <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('admin_shops.photo_hint')}</p>
              {photoError && <p role="alert" className="text-[length:var(--text-caption)] text-error">{photoError}</p>}
            </div>
          </div>
        </Section>

        <p className="text-[length:var(--text-body)] text-muted-foreground">{t('admin_shops.open_note')}</p>
        {submitError && (
          <p role="alert" className="rounded-md bg-error/15 px-4 py-3 text-[length:var(--text-body)] text-error">
            {submitError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
            {isSubmitting ? t('admin_shops.submitting') : t('admin_shops.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t('admin_shops.cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}
