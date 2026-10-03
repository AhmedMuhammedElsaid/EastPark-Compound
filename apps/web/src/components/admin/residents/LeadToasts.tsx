'use client';

import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import * as React from 'react';

import { useTranslation } from '@/lib/i18n';

export type Toast = { id: number; kind: 'success' | 'error'; message: string };

const DURATION = { success: 6_000, error: 10_000 } as const;

export function useToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);
  const timers = React.useRef(new Map<number, number>());

  const dismiss = React.useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (kind: Toast['kind'], message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      // Keep the stack short; the newest message matters most.
      setToasts((current) => [...current.slice(-2), { id, kind, message }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION[kind]));
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return { toasts, push, dismiss };
}

export function LeadToasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const { t } = useTranslation();
  return (
    <div
      aria-live="polite"
      aria-label={t('admin_leads.toast.region')}
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-96"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`lead-toast pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-[length:var(--text-body)] text-foreground shadow-xl ${toast.kind === 'error' ? 'border-error/60' : 'border-success/60'}`}
        >
          {toast.kind === 'error' ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          )}
          <p className="flex-1 leading-relaxed">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('admin_leads.toast.dismiss')}
            className="-my-1 -me-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
