'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500';

export const SELECT_CLASS = `min-h-12 w-full rounded-md border border-input bg-background px-3 text-[length:var(--text-body)] ${FOCUS}`;

export function PanelHeader({
  titleId,
  icon: Icon,
  title,
  intro,
  action,
}: {
  titleId: string;
  icon: LucideIcon;
  title: string;
  intro: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
            {title}
          </h2>
          <p className="mt-1 max-w-xl text-[length:var(--text-body)] text-muted-foreground">{intro}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** Pulse rows (never a spinner); motion stops under reduced-motion. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="overflow-hidden rounded-lg border border-border bg-card">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-3/5 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
          </div>
          <div className="hidden h-7 w-24 animate-pulse rounded-full bg-muted motion-reduce:animate-none sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
      <CircleAlert aria-hidden="true" className="size-8 text-error" />
      <p className="text-[length:var(--text-body-lg)] font-bold">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 ${FOCUS}`}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {retryLabel}
      </button>
    </div>
  );
}

export function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="text-[length:var(--text-body-lg)] font-bold">{message}</p>
    </div>
  );
}

export function LoadMoreButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading || undefined}
        className={`inline-flex min-h-12 min-w-44 items-center justify-center rounded-md border border-primary/55 px-6 text-[length:var(--text-button)] font-semibold text-primary hover:bg-primary/10 disabled:cursor-wait ${FOCUS} ${loading ? 'lead-pending' : ''}`}
      >
        {loading ? t('common.loading') : label}
      </button>
    </div>
  );
}

/** First letter for an avatar circle (works for Arabic and Latin names). */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?';
}
