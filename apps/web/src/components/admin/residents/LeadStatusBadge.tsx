'use client';

import type { LeadStatus } from '@/lib/api/resident-leads';

import { useTranslation } from '@/lib/i18n';

import { STATUS_TONE } from './lead-format';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 text-[length:var(--text-caption)] font-semibold text-foreground ${tone.tint}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone.dot}`} />
      {t(`admin_leads.status.${status}`)}
    </span>
  );
}
