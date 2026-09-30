'use client';

import * as React from 'react';

import { useTranslation } from '@/lib/i18n';

/**
 * Shared label + error scaffolding for every control on the form, so the
 * accessible wiring (label association, aria-describedby, role="alert") is
 * written once and cannot drift between fields.
 */
export function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean;
  }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[length:var(--text-label)] font-medium text-foreground">
        {label}
        {required ? (
          <span className="ms-1 text-error" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ms-2 text-[length:var(--text-caption)] font-normal text-muted-foreground">
            {t('common.optional')}
          </span>
        )}
      </label>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': Boolean(required),
      })}

      {hint ? (
        <p id={hintId} className="text-[length:var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-[length:var(--text-caption)] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control chrome — one definition so focus and error states match everywhere. */
export const CONTROL_CLASS =
  'min-h-[48px] w-full rounded-md border bg-card px-4 text-[length:var(--text-body-lg)] text-card-foreground ' +
  'placeholder:text-muted-foreground transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export function controlBorder(hasError: boolean) {
  return hasError ? 'border-error' : 'border-border hover:border-primary/60';
}
