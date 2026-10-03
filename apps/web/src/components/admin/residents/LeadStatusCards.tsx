'use client';

import { Layers } from 'lucide-react';

import { LEAD_STATUSES, type LeadFilter, type LeadStats } from '@/lib/api/resident-leads';
import { useTranslation } from '@/lib/i18n';

import { formatCount, STATUS_TONE } from './lead-format';

type Props = {
  value: LeadFilter;
  stats: LeadStats | null;
  statsState: 'loading' | 'ready' | 'error';
  onChange: (value: LeadFilter) => void;
};

const FILTERS: LeadFilter[] = ['ALL', ...LEAD_STATUSES];

/** One card per status: shows the live count and acts as the list filter (toggle buttons). */
export function LeadStatusCards({ value, stats, statsState, onChange }: Props) {
  const { t, lang } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('admin_leads.cards_label')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
    >
      {FILTERS.map((filter) => {
        const selected = value === filter;
        const count = stats ? (filter === 'ALL' ? stats.total : stats[filter]) : null;
        const share = stats && stats.total > 0 && filter !== 'ALL' && count !== null ? Math.round((count / stats.total) * 100) : null;
        const label = filter === 'ALL' ? t('admin_leads.card_all') : t(`admin_leads.status.${filter}`);
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(filter)}
            className={`group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-lg border p-4 text-start transition-[border-color,background-color,box-shadow] duration-200 ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${filter === 'ALL' ? 'col-span-2 sm:col-span-1' : ''} ${selected ? 'border-primary bg-primary/8 shadow-[inset_0_0_0_1px_var(--color-primary)]' : 'border-border bg-card hover:border-primary/50 hover:bg-muted/60'}`}
          >
            <span className="flex items-center gap-2 text-[length:var(--text-label)] font-semibold text-muted-foreground group-aria-pressed:text-foreground">
              {filter === 'ALL' ? (
                <Layers aria-hidden="true" className="size-4 text-primary" />
              ) : (
                <span aria-hidden="true" className={`size-2.5 rounded-full ${STATUS_TONE[filter].dot}`} />
              )}
              {label}
            </span>
            <span className="mt-3 block">
              {count !== null ? (
                <span className="block text-[length:var(--text-display)] font-bold leading-none tabular-nums">
                  {formatCount(count, lang)}
                </span>
              ) : statsState === 'loading' ? (
                <span aria-hidden="true" className="block h-9 w-14 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
              ) : (
                <span className="block text-[length:var(--text-display)] font-bold leading-none text-muted-foreground" title={t('admin_leads.count_unavailable')}>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{t('admin_leads.count_unavailable')}</span>
                </span>
              )}
              <span className="mt-2 block text-[length:var(--text-caption)] text-muted-foreground">
                {share !== null ? t('admin_leads.share_of_total', { percent: formatCount(share, lang) }) : t(`admin_leads.card_hint.${filter}`)}
              </span>
            </span>
            {filter !== 'ALL' && (
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-border/60">
                <span
                  className={`block h-full transition-[width] duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none ${STATUS_TONE[filter].bar}`}
                  style={{ width: `${share ?? 0}%` }}
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
