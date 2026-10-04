'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import * as React from 'react';

import { BACKDROP, useModalDialog } from '@/components/admin/residents/LeadDialogs';

import { FOCUS } from './panel-parts';

export type ConfirmContent = {
  title: string;
  /** Explanation of what happens; rendered in a tinted note. */
  body: ReactNode;
  icon: LucideIcon;
  tone: 'danger' | 'primary';
  confirmLabel: string;
  cancelLabel: string;
};

/**
 * Explicit confirm step for a destructive or restoring action (native modal <dialog>: focus
 * containment, Esc and backdrop close). Cancel is focused first so Enter never confirms by accident.
 */
export function ConfirmActionDialog({
  content,
  onConfirm,
  onCancel,
}: {
  content: ConfirmContent | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useModalDialog(Boolean(content), onCancel);
  // Keep the last content rendered while the dialog closes.
  const [shown, setShown] = React.useState<ConfirmContent | null>(content);
  if (content && content !== shown) setShown(content);

  const titleId = React.useId();
  const bodyId = React.useId();
  const Icon = shown?.icon;
  const danger = shown?.tone === 'danger';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={`lead-dialog m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {shown && Icon && (
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
            ref.current?.close();
          }}
        >
          <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
            <bdi>{shown.title}</bdi>
          </h2>
          <div
            id={bodyId}
            className={`mt-4 flex items-start gap-3 rounded-md border px-3 py-3 text-[length:var(--text-body)] leading-relaxed ${danger ? 'border-error/45 bg-error/10' : 'border-info/45 bg-info/10'}`}
          >
            <Icon aria-hidden="true" className={`mt-1 size-4.5 shrink-0 ${danger ? 'text-error' : 'text-info'}`} />
            <div className="min-w-0 space-y-2">{shown.body}</div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => ref.current?.close()}
              className={`inline-flex min-h-12 items-center justify-center rounded-md border border-border px-5 text-[length:var(--text-button)] font-semibold hover:bg-muted ${FOCUS}`}
            >
              {shown.cancelLabel}
            </button>
            <button
              type="submit"
              className={`inline-flex min-h-12 items-center justify-center rounded-md px-5 text-[length:var(--text-button)] font-bold ${danger ? 'bg-error text-error-foreground hover:bg-error/90' : 'bg-primary text-primary-foreground hover:bg-gold-600'} ${FOCUS}`}
            >
              {shown.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
