'use client';

import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Mail, PanelRightOpen, RotateCcw, Send, UserX } from 'lucide-react';
import * as React from 'react';

import { leadActions, unitLabel, type LeadAction, type LeadStatus, type ResidentLead } from '@/lib/api/resident-leads';
import { useTranslation } from '@/lib/i18n';

import { formatExact, formatRelative, localeFor } from './lead-format';
import { LeadStatusBadge } from './LeadStatusBadge';

export type PendingAction = { action: LeadAction; from: LeadStatus };
export type PendingMap = Record<string, PendingAction>;

const STATUS_ORDER: Record<LeadStatus, number> = { PENDING: 0, INVITED: 1, CONVERTED: 2, REJECTED: 3 };
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500';

function floorRank(floor: string): number {
  return floor.toUpperCase() === 'G' ? 0 : Number(floor) || 99;
}

function buildColumns(locale: string): ColumnDef<ResidentLead>[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return [
    {
      id: 'resident',
      accessorFn: (lead) => lead.name,
      sortingFn: (a, b) => collator.compare(a.original.name, b.original.name),
    },
    {
      id: 'unit',
      accessorFn: (lead) => unitLabel(lead),
      sortingFn: (a, b) =>
        collator.compare(a.original.building, b.original.building) ||
        floorRank(a.original.floor) - floorRank(b.original.floor) ||
        collator.compare(a.original.flatNumber, b.original.flatNumber),
    },
    {
      id: 'createdAt',
      accessorFn: (lead) => Date.parse(lead.createdAt) || 0,
      sortingFn: 'basic',
      sortDescFirst: true,
    },
    {
      id: 'status',
      accessorFn: (lead) => STATUS_ORDER[lead.status],
      sortingFn: 'basic',
    },
  ];
}

/** Invite / resend / re-invite, reject and details for one lead. Shared by table, cards and drawer. */
export function LeadRowActions({
  lead,
  pending,
  onAction,
  onDetails,
  variant,
}: {
  lead: ResidentLead;
  pending?: PendingAction;
  onAction: (lead: ResidentLead, action: LeadAction) => void;
  onDetails?: (lead: ResidentLead) => void;
  variant: 'table' | 'card' | 'drawer';
}) {
  const { t } = useTranslation();
  // While a request is in flight the row already shows the optimistic status; keep the original
  // buttons in place so nothing jumps under the pointer.
  const available = leadActions(pending ? pending.from : lead.status);
  const busy = Boolean(pending);
  const InviteIcon = available.invite === 'reinvite' ? RotateCcw : available.invite === 'resend' ? Send : Mail;
  const size = variant === 'table' ? 'min-h-11 px-3.5' : 'min-h-12 px-4';

  return (
    <div className={`flex items-center gap-2 ${variant === 'card' ? 'w-full' : ''} ${variant === 'table' ? 'justify-end' : ''}`}>
      {available.invite && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(lead, 'invite')}
          aria-busy={pending?.action === 'invite' || undefined}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[length:var(--text-button)] font-semibold transition-colors disabled:cursor-not-allowed ${size} ${FOCUS} ${variant === 'card' ? 'flex-1' : ''} ${variant === 'drawer' ? 'bg-primary text-primary-foreground hover:bg-gold-600 disabled:opacity-70' : 'border border-primary/55 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-80'} ${pending?.action === 'invite' ? 'lead-pending' : ''}`}
        >
          <InviteIcon aria-hidden="true" className="size-4 shrink-0 rtl:-scale-x-100" />
          {pending?.action === 'invite' ? t('admin_leads.pending.invite') : t(`admin_leads.actions.${available.invite}`)}
        </button>
      )}
      {available.reject && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(lead, 'reject')}
          aria-busy={pending?.action === 'reject' || undefined}
          aria-label={variant === 'table' ? (pending?.action === 'reject' ? t('admin_leads.pending.reject') : t('admin_leads.actions.reject_for', { name: lead.name })) : undefined}
          title={variant === 'table' ? t('admin_leads.actions.reject') : undefined}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border text-[length:var(--text-button)] font-semibold text-foreground transition-colors hover:border-error/70 hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-70 ${FOCUS} ${variant === 'table' ? 'size-11' : size} ${pending?.action === 'reject' ? 'lead-pending' : ''}`}
        >
          <UserX aria-hidden="true" className="size-4 shrink-0" />
          {variant !== 'table' && (pending?.action === 'reject' ? t('admin_leads.pending.reject') : t('admin_leads.actions.reject'))}
        </button>
      )}
      {onDetails && (
        <button
          type="button"
          onClick={() => onDetails(lead)}
          aria-label={t('admin_leads.actions.details_for', { name: lead.name })}
          title={t('admin_leads.actions.details')}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS} ${variant === 'card' ? 'size-12' : ''}`}
        >
          <PanelRightOpen aria-hidden="true" className="size-5 rtl:-scale-x-100" />
        </button>
      )}
    </div>
  );
}

function SubmittedAt({ iso }: { iso: string }) {
  const { lang } = useTranslation();
  return (
    <time dateTime={iso} title={formatExact(iso, lang)} className="whitespace-nowrap">
      {formatRelative(iso, lang)}
    </time>
  );
}

function UnitCell({ lead }: { lead: ResidentLead }) {
  const { t } = useTranslation();
  return (
    <span
      className="whitespace-nowrap font-semibold tabular-nums"
      title={t('admin_leads.unit_parts', { building: lead.building, floor: lead.floor, flat: lead.flatNumber })}
    >
      <bdi>{unitLabel(lead)}</bdi>
    </span>
  );
}

export function LeadsTable({
  rows,
  sorting,
  onSortingChange,
  pending,
  onAction,
  onDetails,
}: {
  rows: ResidentLead[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pending: PendingMap;
  onAction: (lead: ResidentLead, action: LeadAction) => void;
  onDetails: (lead: ResidentLead) => void;
}) {
  const { t, lang } = useTranslation();
  const columns = React.useMemo(() => buildColumns(localeFor(lang)), [lang]);
  // TanStack Table keeps its own mutable instance; it is read during render only.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (lead) => lead.id,
  });
  const modelRows = table.getRowModel().rows;

  const headers: { id: string; label: string; className: string }[] = [
    { id: 'resident', label: t('admin_leads.columns.resident'), className: 'w-full min-w-56' },
    { id: 'unit', label: t('admin_leads.columns.unit'), className: '' },
    { id: 'createdAt', label: t('admin_leads.columns.submitted'), className: '' },
    { id: 'status', label: t('admin_leads.columns.status'), className: '' },
  ];

  return (
    <>
      {/* Tablet and desktop: table with a header that stays visible while the list scrolls. */}
      <div className="hidden max-h-[min(72vh,52rem)] overflow-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full border-separate border-spacing-0 text-start text-[length:var(--text-body)]">
          <caption className="sr-only">{t('admin_leads.table_caption')}</caption>
          <thead>
            <tr>
              {headers.map((header) => {
                const column = table.getColumn(header.id);
                const direction = column?.getIsSorted();
                const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
                    className={`sticky top-0 z-10 border-b border-border bg-card px-2 py-2 text-start text-[length:var(--text-label)] font-semibold text-muted-foreground first:ps-4 ${header.className}`}
                  >
                    <button
                      type="button"
                      onClick={column?.getToggleSortingHandler()}
                      className={`-mx-2 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2 hover:bg-muted hover:text-foreground ${FOCUS} ${direction ? 'text-foreground' : ''}`}
                    >
                      {header.label}
                      <Icon aria-hidden="true" className={`size-3.5 ${direction ? 'text-primary' : 'opacity-60'}`} />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="sticky top-0 z-10 border-b border-border bg-card px-4 py-2 text-end text-[length:var(--text-label)] font-semibold text-muted-foreground">
                <span className="sr-only">{t('admin_leads.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {modelRows.map((row) => {
              const lead = row.original;
              return (
                <tr key={row.id} className={`group transition-colors hover:bg-muted/40 ${pending[lead.id] ? 'bg-muted/30' : ''}`}>
                  <td className="w-full max-w-0 border-b border-border py-3 ps-4 pe-2 align-middle group-last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onDetails(lead)}
                      className={`block max-w-full truncate rounded-sm text-start font-semibold hover:text-primary hover:underline hover:underline-offset-4 ${FOCUS}`}
                    >
                      {lead.name}
                    </button>
                    <span className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 text-[length:var(--text-label)] text-muted-foreground" dir="ltr">
                      <span className="max-w-full truncate">{lead.email}</span>
                      <span className="tabular-nums">{lead.phone}</span>
                    </span>
                  </td>
                  <td className="border-b border-border px-2 py-3 align-middle group-last:border-b-0"><UnitCell lead={lead} /></td>
                  <td className="border-b border-border px-2 py-3 align-middle text-muted-foreground group-last:border-b-0"><SubmittedAt iso={lead.createdAt} /></td>
                  <td className="border-b border-border px-2 py-3 align-middle group-last:border-b-0"><LeadStatusBadge status={lead.status} /></td>
                  <td className="border-b border-border py-3 ps-2 pe-4 align-middle group-last:border-b-0">
                    <LeadRowActions lead={lead} pending={pending[lead.id]} onAction={onAction} onDetails={onDetails} variant="table" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: stacked cards with the same actions. */}
      <ul className="space-y-3 md:hidden">
        {modelRows.map((row) => {
          const lead = row.original;
          return (
            <li key={row.id}>
              <article className={`rounded-lg border border-border bg-card p-4 ${pending[lead.id] ? 'opacity-95' : ''}`} aria-label={lead.name}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onDetails(lead)}
                    className={`min-w-0 rounded-sm text-start text-[length:var(--text-body-lg)] font-bold leading-snug hover:text-primary ${FOCUS}`}
                  >
                    <span className="line-clamp-2 break-words">{lead.name}</span>
                  </button>
                  <LeadStatusBadge status={lead.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--text-label)]">
                  <div>
                    <dt className="text-muted-foreground">{t('admin_leads.columns.unit')}</dt>
                    <dd className="mt-0.5"><UnitCell lead={lead} /></dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('admin_leads.columns.submitted')}</dt>
                    <dd className="mt-0.5"><SubmittedAt iso={lead.createdAt} /></dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="sr-only">{t('admin_leads.details.contact')}</dt>
                    <dd className="flex min-w-0 flex-col gap-0.5 text-muted-foreground" dir="ltr">
                      <span className="truncate">{lead.email}</span>
                      <span className="tabular-nums">{lead.phone}</span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-border pt-3">
                  <LeadRowActions lead={lead} pending={pending[lead.id]} onAction={onAction} onDetails={onDetails} variant="card" />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function LeadsSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <div className="h-12 border-b border-border" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
              <div className="h-3 w-3/5 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            </div>
            <div className="h-4 w-16 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-20 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            <div className="h-7 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="h-11 w-28 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {[0, 1, 2].map((card) => (
          <div key={card} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between gap-3">
              <div className="h-5 w-1/2 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
              <div className="h-7 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            </div>
            <div className="h-4 w-3/4 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
            <div className="h-12 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
