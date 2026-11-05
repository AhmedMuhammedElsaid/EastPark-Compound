'use client';

import type { LucideIcon } from 'lucide-react';

import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { BACKDROP, useModalDialog } from '@/components/admin/residents/LeadDialogs';
import { FOCUS } from '@/components/admin/team/panel-parts';
import { FinanceApiError } from '@/lib/api/finance';
import { financeKeyOf } from '@/lib/finance/errors';
import { formatMoney } from '@/lib/finance/money';
import { useTranslation } from '@/lib/i18n';

export { FOCUS };

export const INPUT_CLASS = `min-h-12 w-full rounded-md border border-border bg-card px-3 text-[length:var(--text-body)] text-card-foreground placeholder:text-muted-foreground hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const SECONDARY_BUTTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border px-5 text-[length:var(--text-button)] font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;
export const PRIMARY_BUTTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;
export const DANGER_BUTTON = `inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-error px-5 text-[length:var(--text-button)] font-bold text-error-foreground hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** User-facing copy for a finance BFF error code (finance keys first, then the shared vocabulary). */
export function financeErrorMessage(t: Translate, error: unknown): string {
  const code = error instanceof FinanceApiError ? error.code : typeof error === 'string' ? error : 'network';
  const key = financeKeyOf(code);
  if (key) return t(`finance.errors.${key}`);
  switch (code) {
    case 'network':
      return t('errors.network');
    case 'unauthorized':
      return t('errors.session_expired');
    case 'forbidden':
      return t('finance.errors_generic.forbidden');
    case 'not_found':
      return t('finance.errors_generic.not_found');
    case 'rate_limited':
      return t('finance.errors_generic.rate_limited');
    case 'validation':
    case 'request_failed':
      return t('finance.errors_generic.request_failed');
    case 'unavailable':
      return t('finance.errors_generic.unavailable');
    default:
      return t('errors.server');
  }
}

export function useFinanceError(): (error: unknown) => string {
  const { t } = useTranslation();
  return React.useCallback((error: unknown) => financeErrorMessage(t, error), [t]);
}

export function codeOf(error: unknown): string | undefined {
  return error instanceof FinanceApiError ? error.code : undefined;
}

/**
 * One page of a cursor list. If the list moved under the cursor (`invalidCursor`), it starts again
 * from the top instead (`append: false`).
 */
export async function fetchPage<P>(load: (cursor?: string) => Promise<P>, cursor?: string): Promise<{ page: P; append: boolean }> {
  if (!cursor) return { page: await load(), append: false };
  try {
    return { page: await load(cursor), append: true };
  } catch (caught) {
    if (codeOf(caught) !== 'finance.invalidCursor') throw caught;
    return { page: await load(), append: false };
  }
}

export function PageHeader({
  title,
  intro,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="text-[length:var(--text-label)] font-semibold text-muted-foreground">{eyebrow}</div>}
        <h1 className="mt-1 text-[length:var(--text-h1)] font-bold leading-tight">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-[length:var(--text-body)] text-muted-foreground">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

/** Money is always a bidi-isolated, tabular figure so digits never reorder in RTL. */
export function Money({ amount, className = '' }: { amount: number; className?: string }) {
  const { lang } = useTranslation();
  return <bdi className={`tabular-nums ${className}`}>{formatMoney(amount, lang)}</bdi>;
}

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'gold';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'border-border text-muted-foreground',
  success: 'border-success/45 text-success',
  warning: 'border-warning/45 text-warning',
  error: 'border-error/45 text-error',
  info: 'border-info/45 text-info',
  gold: 'border-primary/50 text-primary',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 text-[length:var(--text-caption)] font-bold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const ALERT_TONES: Record<Exclude<Tone, 'neutral' | 'gold'>, { box: string; icon: LucideIcon; iconClass: string }> = {
  error: { box: 'border-error/45 bg-error/10', icon: CircleAlert, iconClass: 'text-error' },
  warning: { box: 'border-warning/45 bg-warning/10', icon: TriangleAlert, iconClass: 'text-warning' },
  info: { box: 'border-info/45 bg-info/10', icon: Info, iconClass: 'text-info' },
  success: { box: 'border-success/45 bg-success/10', icon: CircleCheck, iconClass: 'text-success' },
};

export function Notice({
  tone,
  children,
  live = tone === 'error' ? 'alert' : 'status',
}: {
  tone: keyof typeof ALERT_TONES;
  children: React.ReactNode;
  live?: 'alert' | 'status' | 'none';
}) {
  const { box, icon: Icon, iconClass } = ALERT_TONES[tone];
  return (
    <div
      role={live === 'none' ? undefined : live}
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-[length:var(--text-body)] leading-relaxed ${box}`}
    >
      <Icon aria-hidden="true" className={`mt-1 size-4.5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

export function StatTile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-4">
      <dt className="text-[length:var(--text-label)] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[length:var(--text-h2)] font-bold">{children}</dd>
      {hint && <dd className="mt-1 text-[length:var(--text-caption)] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Labelled control without the Field "optional" hint (the desk marks required fields only). */
export function Labelled({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[length:var(--text-label)] font-semibold">
        {label}
        {required && (
          <span className="ms-1 text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[length:var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[length:var(--text-caption)] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
}

/**
 * A modal form (native <dialog>: focus containment, Esc and backdrop close). The submit button
 * shows its busy state; errors render inside the dialog so the desk never loses the typed values.
 */
export function FormDialog({
  open,
  title,
  intro,
  submitLabel,
  tone = 'primary',
  busy,
  error,
  onSubmit,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  intro?: React.ReactNode;
  submitLabel: string;
  tone?: 'primary' | 'danger';
  busy: boolean;
  error?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useModalDialog(open, onClose);
  const titleId = React.useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`lead-dialog m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {open && (
        <form
          noValidate
          className="space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onSubmit();
          }}
        >
          <div>
            <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
              {title}
            </h2>
            {intro && <div className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{intro}</div>}
          </div>
          {children}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => ref.current?.close()} className={SECONDARY_BUTTON}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
              className={tone === 'danger' ? DANGER_BUTTON : PRIMARY_BUTTON}
            >
              {busy ? t('common.loading') : submitLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** Calls `fn` once `value` has been stable for `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function TableShell({ caption, children, minWidth = 760 }: { caption: string; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-[length:var(--text-body)]" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const TH = 'px-4 py-3 text-start text-[length:var(--text-label)] font-semibold text-muted-foreground';
export const TD = 'px-4 py-3 align-middle';
