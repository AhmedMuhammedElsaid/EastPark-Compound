'use client';

import { Eye, EyeOff, Mail, Phone, ShieldAlert, X } from 'lucide-react';
import * as React from 'react';

import { leadActions, maskIdentifier, unitLabel, type LeadAction, type ResidentLead } from '@/lib/api/resident-leads';
import { useTranslation } from '@/lib/i18n';

import { formatExact, formatRelative } from './lead-format';
import { LeadStatusBadge } from './LeadStatusBadge';

/**
 * Drives a native modal <dialog>: top layer, focus containment, Esc to close and inert background
 * come from the platform. Focus returns to the element that opened it.
 */
function useModalDialog(open: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const closeRef = React.useRef(onClose);
  React.useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target?.isConnected) target.focus();
      closeRef.current();
    };
    // A click on the backdrop lands on the <dialog> element itself.
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, []);

  return ref;
}

const BACKDROP = 'backdrop:bg-[rgb(13_12_11/0.72)] backdrop:backdrop-blur-[2px]';

export type ConfirmRequest = { lead: ResidentLead; action: LeadAction };

export function ConfirmLeadDialog({
  request,
  onConfirm,
  onCancel,
}: {
  request: ConfirmRequest | null;
  onConfirm: (request: ConfirmRequest) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const ref = useModalDialog(Boolean(request), onCancel);
  // Keep the last request while the dialog animates out / closes.
  const [shown, setShown] = React.useState<ConfirmRequest | null>(request);
  if (request && request !== shown) setShown(request);

  const titleId = React.useId();
  const bodyId = React.useId();
  const lead = shown?.lead;
  const kind = shown ? (shown.action === 'reject' ? 'reject' : (leadActions(shown.lead.status).invite ?? 'send')) : 'send';
  const copyKey = kind === 'send' ? 'invite' : kind;
  const danger = kind === 'reject';
  const vars: Record<string, string> = lead ?{ name: lead.name, email: lead.email, unit: unitLabel(lead) } : {};

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={`lead-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {shown && lead && (
        <div className="p-6">
          <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
            {t(`admin_leads.confirm.${copyKey}_title`)}
          </h2>
          <div id={bodyId} className="mt-3 space-y-3 text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
            <p>{t(`admin_leads.confirm.${copyKey}_body`, vars)}</p>
            {danger && lead.status === 'INVITED' && (
              <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-foreground">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {t('admin_leads.confirm.reject_invited_note')}
              </p>
            )}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => ref.current?.close()}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 text-[length:var(--text-button)] font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              {t('admin_leads.confirm.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(shown);
                ref.current?.close();
              }}
              className={`inline-flex min-h-11 items-center justify-center rounded-md px-5 text-[length:var(--text-button)] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${danger ? 'bg-error text-error-foreground hover:bg-error/90' : 'bg-primary text-primary-foreground hover:bg-gold-600'}`}
            >
              {t(`admin_leads.confirm.confirm_${copyKey}`)}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,40%)_1fr] items-baseline gap-3 py-3">
      <dt className="text-[length:var(--text-label)] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[length:var(--text-body)] font-medium">{children}</dd>
    </div>
  );
}

function SensitiveValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = React.useState(false);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <bdi dir="ltr" className="font-mono tracking-wider tabular-nums">
        {revealed ? value : maskIdentifier(value)}
      </bdi>
      <button
        type="button"
        aria-pressed={revealed}
        aria-label={t(revealed ? 'admin_leads.details.hide_label' : 'admin_leads.details.reveal_label', { field: label })}
        onClick={() => setRevealed((current) => !current)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[length:var(--text-label)] font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      >
        {revealed ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        {t(revealed ? 'admin_leads.details.hide' : 'admin_leads.details.reveal')}
      </button>
    </span>
  );
}

export function LeadDetailsDrawer({
  lead,
  actions,
  onClose,
}: {
  lead: ResidentLead | null;
  actions: (lead: ResidentLead) => React.ReactNode;
  onClose: () => void;
}) {
  const { t, lang } = useTranslation();
  const ref = useModalDialog(Boolean(lead), onClose);
  const titleId = React.useId();
  const missing = <span className="text-muted-foreground">{t('admin_leads.details.not_provided')}</span>;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`lead-drawer fixed inset-y-0 m-0 ms-auto h-dvh max-h-dvh w-full max-w-md border-s border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {/* Keyed by lead so identity numbers are masked again every time the drawer opens. */}
      {lead && (
        <div key={lead.id} className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <p className="text-[length:var(--text-overline)] font-bold uppercase tracking-widest text-primary">
                {t('admin_leads.details.title')}
              </p>
              <h2 id={titleId} className="mt-1 truncate text-[length:var(--text-h2)] font-bold">
                {lead.name}
              </h2>
              <div className="mt-2">
                <LeadStatusBadge status={lead.status} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={t('admin_leads.details.close')}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-2">
            <section aria-label={t('admin_leads.details.contact')}>
              <h3 className="pt-3 text-[length:var(--text-label)] font-bold">{t('admin_leads.details.contact')}</h3>
              <dl className="divide-y divide-border">
                <DetailRow label={t('admin_leads.details.email')}>
                  <a href={`mailto:${lead.email}`} dir="ltr" className="inline-flex min-h-11 items-center gap-2 break-all text-primary underline-offset-4 hover:underline">
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {lead.email}
                  </a>
                </DetailRow>
                <DetailRow label={t('admin_leads.details.phone')}>
                  <a href={`tel:${lead.phone}`} dir="ltr" className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline">
                    <Phone aria-hidden="true" className="size-4 shrink-0" />
                    {lead.phone}
                  </a>
                </DetailRow>
                <DetailRow label={t('admin_leads.details.submitted')}>
                  <time dateTime={lead.createdAt}>{formatExact(lead.createdAt, lang)}</time>
                  <span className="block text-[length:var(--text-caption)] text-muted-foreground">{formatRelative(lead.createdAt, lang)}</span>
                </DetailRow>
              </dl>
            </section>

            <section aria-label={t('admin_leads.details.unit')} className="mt-4">
              <h3 className="pt-3 text-[length:var(--text-label)] font-bold">{t('admin_leads.details.unit')}</h3>
              <dl className="divide-y divide-border">
                <DetailRow label={t('admin_leads.details.building')}><bdi>{lead.building}</bdi></DetailRow>
                <DetailRow label={t('admin_leads.details.floor')}><bdi>{lead.floor}</bdi></DetailRow>
                <DetailRow label={t('admin_leads.details.flat')}><bdi>{lead.flatNumber}</bdi></DetailRow>
                <DetailRow label={t('admin_leads.details.parking')}>{lead.parking ? <bdi>{lead.parking}</bdi> : missing}</DetailRow>
              </dl>
            </section>

            <section aria-label={t('admin_leads.details.personal')} className="mt-4 pb-4">
              <h3 className="pt-3 text-[length:var(--text-label)] font-bold">{t('admin_leads.details.personal')}</h3>
              <dl className="divide-y divide-border">
                <DetailRow label={t('admin_leads.details.job')}>{lead.jobTitle || missing}</DetailRow>
                <DetailRow label={t('admin_leads.details.marital')}>
                  {lead.maritalStatus ? t(`admin_ops.marital.${lead.maritalStatus}`) : missing}
                </DetailRow>
                <DetailRow label={t('admin_leads.details.national_id')}>
                  {lead.nationalId ? <SensitiveValue label={t('admin_leads.details.national_id')} value={lead.nationalId} /> : missing}
                </DetailRow>
                <DetailRow label={t('admin_leads.details.passport')}>
                  {lead.passportNumber ? <SensitiveValue label={t('admin_leads.details.passport')} value={lead.passportNumber} /> : missing}
                </DetailRow>
              </dl>
              {(lead.nationalId || lead.passportNumber) && (
                <p className="mt-3 flex items-start gap-2 text-[length:var(--text-caption)] text-muted-foreground">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {t('admin_leads.details.sensitive_note')}
                </p>
              )}
            </section>
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{actions(lead)}</footer>
        </div>
      )}
    </dialog>
  );
}
