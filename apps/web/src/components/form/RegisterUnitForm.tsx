'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/Button';
import { submitLead, type LeadError } from '@/lib/api/leads';
import { useTranslation } from '@/lib/i18n';
import { registerUnitSchema, type RegisterUnitValues } from '@/lib/schemas/registerUnit';

import { CONTROL_CLASS, Field, controlBorder } from './Field';
import { UnitFields } from './UnitFields';

const ERROR_KEYS: Record<LeadError, string> = {
  network: 'register.submit_error.network',
  timeout: 'register.submit_error.network',
  duplicate: 'register.submit_error.duplicate',
  rate_limited: 'register.submit_error.rate_limited',
  validation: 'register.submit_error.server',
  server: 'register.submit_error.server',
};

export function RegisterUnitForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<LeadError | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    register,
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
      nationalId: '',
      passportNumber: '',
    },
  });

  const building = useWatch({ control, name: 'building' });
  const { field: floorField } = useController({ control, name: 'floor' });

  React.useEffect(() => {
    void fetch('/api/resident-leads', { cache: 'no-store' }).catch(() => undefined);
  }, []);

  // Move focus to the banner so a screen reader reaches the failure reason.
  React.useEffect(() => {
    if (submitError) errorRef.current?.focus();
  }, [submitError]);

  const errorText = (key: string | undefined) => (key ? t(key) : undefined);

  async function onSubmit(values: RegisterUnitValues) {
    setSubmitError(null);

    const parking = values.parking?.trim();
    const jobTitle = values.jobTitle?.trim();
    const nationalId = values.nationalId?.trim();
    const passportNumber = values.passportNumber?.trim();
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
      ...(nationalId ? { nationalId } : {}),
      ...(passportNumber ? { passportNumber } : {}),
    });

    if (result.ok) {
      router.push('/thank-you');
      return;
    }
    // Values are deliberately left untouched so nothing typed is lost.
    setSubmitError(result.error);
  }

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

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="nationalId"
            label={t('register.fields.national_id')}
            error={errorText(errors.nationalId?.message)}
          >
            {(props) => (
              <input
                {...props}
                {...register('nationalId')}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={14}
                placeholder={t('register.fields.national_id_placeholder')}
                className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.nationalId))} text-start`}
              />
            )}
          </Field>

          <Field
            id="passportNumber"
            label={t('register.fields.passport_number')}
            error={errorText(errors.passportNumber?.message)}
          >
            {(props) => (
              <input
                {...props}
                {...register('passportNumber')}
                type="text"
                autoComplete="off"
                dir="ltr"
                maxLength={30}
                placeholder={t('register.fields.passport_number_placeholder')}
                className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.passportNumber))} text-start`}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
        <legend className="px-2 text-[length:var(--text-label)] font-semibold uppercase tracking-[1px] text-primary">
          {t('register.section_unit')}
        </legend>

        <UnitFields
          building={building}
          buildingField={register('building')}
          floor={floorField}
          flatField={register('flatNumber')}
          errors={{
            building: errorText(errors.building?.message),
            floor: errorText(errors.floor?.message),
            flatNumber: errorText(errors.flatNumber?.message),
          }}
        />

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
