'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import * as React from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';

import { BACKDROP, useModalDialog } from '@/components/admin/residents/LeadDialogs';
import { UnitFields } from '@/components/form/UnitFields';
import { useTranslation } from '@/lib/i18n';
import { unitFieldsSchema, type UnitFieldsValues } from '@/lib/schemas/registerUnit';
import type { AdminUserItem } from '@/lib/validation/super-admin';

import { FOCUS } from './panel-parts';

const EMPTY: UnitFieldsValues = { building: '', floor: '', flatNumber: '' };

/**
 * "Add flat" for one account (SUPER_ADMIN). Uses the same building / floor / flat inputs and rules
 * as `/register-unit`. `onSubmit` resolves to an error message to show inline (the dialog stays open
 * with the values kept) or `null` when the flat was added (the dialog closes).
 */
export function AddFlatDialog({
  user,
  onSubmit,
  onCancel,
}: {
  user: AdminUserItem | null;
  onSubmit: (user: AdminUserItem, values: UnitFieldsValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const ref = useModalDialog(Boolean(user), onCancel);
  // Keep the last user rendered while the dialog closes.
  const [shown, setShown] = React.useState<AdminUserItem | null>(user);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFieldsValues>({ resolver: zodResolver(unitFieldsSchema), defaultValues: EMPTY });
  const building = useWatch({ control, name: 'building' });
  const { field: floorField } = useController({ control, name: 'floor' });

  if (user && user !== shown) {
    setShown(user);
    setSubmitError(null);
  }
  // A fresh form every time the dialog opens for someone.
  React.useEffect(() => {
    if (user) reset(EMPTY);
  }, [reset, user]);

  const titleId = React.useId();
  const name = shown ? shown.name || shown.email : '';
  const errorText = (key: string | undefined) => (key ? t(key) : undefined);

  async function save(values: UnitFieldsValues) {
    if (!shown) return;
    setSubmitError(null);
    const failure = await onSubmit(shown, values);
    if (failure) setSubmitError(failure);
    else ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`lead-dialog m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {shown && (
        <form className="p-6" noValidate onSubmit={(event) => void handleSubmit(save)(event)}>
          <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
            <bdi>{t('admin_team.add_flat_title', { name })}</bdi>
          </h2>

          <fieldset disabled={isSubmitting} className="mt-5">
            <legend className="sr-only">{t('register.section_unit')}</legend>
            <UnitFields
              idPrefix="add-flat-"
              building={building}
              buildingField={register('building')}
              floor={floorField}
              flatField={register('flatNumber')}
              errors={{
                building: errorText(errors.building?.message),
                floor: errorText(errors.floor?.message),
                flatNumber: errorText(errors.flatNumber?.message),
              }}
              className="grid gap-5 sm:grid-cols-3"
            />
          </fieldset>

          <p className="mt-5 flex items-start gap-2 rounded-md border border-info/45 bg-info/10 px-3 py-2 text-[length:var(--text-body)] leading-relaxed text-foreground">
            <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-info" />
            <span>{t('admin_team.add_flat_body', { name })}</span>
          </p>

          {submitError && (
            <p role="alert" className="mt-4 rounded-md border border-error/45 bg-error/10 px-3 py-2 text-[length:var(--text-body)] text-foreground">
              {submitError}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => ref.current?.close()}
              className={`inline-flex min-h-12 items-center justify-center rounded-md border border-border px-5 text-[length:var(--text-button)] font-semibold hover:bg-muted ${FOCUS}`}
            >
              {t('admin_team.dialog_cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              className={`inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 disabled:cursor-wait disabled:opacity-60 ${FOCUS} ${isSubmitting ? 'lead-pending' : ''}`}
            >
              {isSubmitting ? t('admin_team.saving') : t('admin_team.add_flat_confirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
