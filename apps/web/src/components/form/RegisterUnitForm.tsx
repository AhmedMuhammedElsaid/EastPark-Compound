'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/Button';
import { FLAT_OPTIONS, getBuildingsByPhase, getFloorOptions } from '@/config/compound';
import { submitLead, type LeadError } from '@/lib/api/leads';
import { useTranslation } from '@/lib/i18n';
import { registerUnitSchema, type RegisterUnitValues } from '@/lib/schemas/registerUnit';

import { Combobox } from './Combobox';
import { CONTROL_CLASS, Field, controlBorder } from './Field';

const ERROR_KEYS: Record<LeadError, string> = {
  network: 'register.submit_error.network',
  timeout: 'register.submit_error.network',
  duplicate: 'register.submit_error.duplicate',
  rate_limited: 'register.submit_error.rate_limited',
  validation: 'register.submit_error.server',
  server: 'register.submit_error.server',
};

export function RegisterUnitForm() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<LeadError | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    register,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RegisterUnitValues>({
    resolver: zodResolver(registerUnitSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      building: '',
      floor: '',
      flatNumber: '',
      parking: '',
      jobTitle: '',
      maritalStatus: '',
    },
  });

  const [building, floor] = useWatch({ control, name: ['building', 'floor'] });
  const floorOptions = React.useMemo(() => getFloorOptions(building), [building]);

  React.useEffect(() => {
    void fetch('/api/resident-leads', { cache: 'no-store' }).catch(() => undefined);
  }, []);

  // Floors are per-building: phases 2 and 3 have a ground floor, 1 and 4 do
  // not. If the chosen floor no longer exists in the newly-chosen building
  // (pick A2 -> "G", then switch to A1), clear it rather than submitting a
  // unit that cannot exist. The API would accept "G" for A1 — this is the
  // only guard.
  React.useEffect(() => {
    if (!floor) return;
    if (!floorOptions.some((option) => option.value === floor)) {
      setValue('floor', '', { shouldValidate: false });
    }
  }, [floorOptions, floor, setValue]);

  // Move focus to the banner so a screen reader reaches the failure reason.
  React.useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const errorText = (key: string | undefined) => (key ? t(key) : undefined);

  async function onSubmit(values: RegisterUnitValues) {
    setSubmitError(null);

    const parking = values.parking?.trim();
    const jobTitle = values.jobTitle?.trim();
    const result = await submitLead({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      building: values.building,
      floor: values.floor,
      flatNumber: values.flatNumber,
      // Omit when blank: sending "" would overwrite a previously stored space.
      ...(parking ? { parking } : {}),
      ...(jobTitle ? { jobTitle } : {}),
      ...(values.maritalStatus ? { maritalStatus: values.maritalStatus } : {}),
    });

    if (result.ok) {
      router.push('/thank-you');
      return;
    }
    // Values are deliberately left untouched so nothing typed is lost.
    setSubmitError(result.error);
  }

  const buildingGroups = getBuildingsByPhase();
  const labelKey = lang === 'ar' ? 'labelAr' : 'labelEn';

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, (formErrors) => {
        const first = Object.keys(formErrors)[0] as keyof RegisterUnitValues | undefined;
        if (first) setFocus(first);
      })}
      className="flex flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
        <legend className="px-2 text-[length:var(--text-label)] font-semibold uppercase tracking-[1px] text-primary">
          {t('register.section_you')}
        </legend>

        <Field id="name" label={t('register.fields.name')} required error={errorText(errors.name?.message)}>
          {(props) => (
            <input
              {...props}
              {...register('name')}
              type="text"
              autoComplete="name"
              placeholder={t('register.fields.name_placeholder')}
              className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.name))}`}
            />
          )}
        </Field>

        <Field id="email" label={t('register.fields.email')} required error={errorText(errors.email?.message)}>
          {(props) => (
            <input
              {...props}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              placeholder={t('register.fields.email_placeholder')}
              className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.email))} text-start`}
            />
          )}
        </Field>

        <Field id="phone" label={t('register.fields.phone')} required error={errorText(errors.phone?.message)}>
          {(props) => (
            <input
              {...props}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder={t('register.fields.phone_placeholder')}
              className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.phone))} text-start`}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobTitle" label={t('register.fields.job')} error={errorText(errors.jobTitle?.message)}>
            {(props) => (
              <input
                {...props}
                {...register('jobTitle')}
                type="text"
                autoComplete="organization-title"
                placeholder={t('register.fields.job_placeholder')}
                className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.jobTitle))}`}
              />
            )}
          </Field>

          <Field id="maritalStatus" label={t('register.fields.marital_status')}>
            {(props) => (
              <select {...props} {...register('maritalStatus')} className={`${CONTROL_CLASS} ${controlBorder(false)}`}>
                <option value="">{t('register.fields.marital_status_placeholder')}</option>
                <option value="MARRIED">{t('register.fields.marital_statuses.married')}</option>
                <option value="SINGLE">{t('register.fields.marital_statuses.single')}</option>
                <option value="DIVORCED">{t('register.fields.marital_statuses.divorced')}</option>
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
        <legend className="px-2 text-[length:var(--text-label)] font-semibold uppercase tracking-[1px] text-primary">
          {t('register.section_unit')}
        </legend>

        <div className="grid gap-5 md:grid-cols-3">
          <Field
            id="building"
            label={t('register.fields.building')}
            required
            error={errorText(errors.building?.message)}
          >
            {(props) => (
              <select
                {...props}
                {...register('building')}
                className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.building))}`}
              >
                <option value="">{t('register.fields.building_placeholder')}</option>
                {buildingGroups.map(({ phase, buildings }) => (
                  <optgroup key={phase.id} label={phase[labelKey]}>
                    {buildings.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b[labelKey]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="floor"
            label={t('register.fields.floor')}
            required
            error={errorText(errors.floor?.message)}
            hint={building ? t('a11y.combobox_hint') : undefined}
          >
            {(props) => (
              <Controller
                control={control}
                name="floor"
                render={({ field }) => (
                  <Combobox
                    id={props.id}
                    options={floorOptions}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    // Disabled until a building is chosen — the available
                    // floors are not knowable before then.
                    disabled={!building}
                    placeholder={t('register.fields.floor_search')}
                    disabledHint={t('register.fields.building_placeholder')}
                    hasError={Boolean(errors.floor)}
                    ariaDescribedBy={props['aria-describedby']}
                    ariaRequired
                    labelFor={lang}
                  />
                )}
              />
            )}
          </Field>

          <Field
            id="flatNumber"
            label={t('register.fields.flat')}
            required
            error={errorText(errors.flatNumber?.message)}
          >
            {(props) => (
              <select
                {...props}
                {...register('flatNumber')}
                className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.flatNumber))}`}
              >
                <option value="">{t('register.fields.flat_placeholder')}</option>
                {FLAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option[labelKey]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field
          id="parking"
          label={t('register.fields.parking')}
          error={errorText(errors.parking?.message)}
          hint={t('register.fields.parking_help')}
        >
          {(props) => (
            <input
              {...props}
              {...register('parking')}
              type="text"
              placeholder={t('register.fields.parking_placeholder')}
              className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.parking))}`}
            />
          )}
        </Field>
      </fieldset>

      {submitError ? (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-error bg-error/10 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          <p className="text-[length:var(--text-body-lg)] font-semibold text-foreground">
            {t('register.submit_error.title')}
          </p>
          <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">
            {t(ERROR_KEYS[submitError])}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </Button>
        <p className="text-center text-[length:var(--text-caption)] text-muted-foreground">
          {t('register.privacy_note')}
        </p>
      </div>
    </form>
  );
}
