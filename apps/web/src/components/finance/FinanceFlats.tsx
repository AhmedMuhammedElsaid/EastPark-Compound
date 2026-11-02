'use client';

import { ArrowUpRight, Building2, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState, LoadMoreButton, RowsSkeleton } from '@/components/admin/team/panel-parts';
import { BUILDINGS, PHASES } from '@/config/compound';
import { financeApi, type FlatsQuery } from '@/lib/api/finance';
import { formatDate } from '@/lib/finance/money';
import type { FlatListItem } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { Badge, fetchPage, FOCUS, INPUT_CLASS, Money, Notice, PageHeader, TableShell, TD, TH, useDebounced, useFinanceError } from './parts';

export type FlatsFilters = { hasBalance?: 'true' | 'false'; overdueDays?: string };

const OVERDUE = ['30', '60', '90'] as const;

/** Flat registry: label search, phase/building/owes/overdue filters, cursor paging. */
export function FinanceFlats({ initial }: { initial: FlatsFilters }) {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const [q, setQ] = React.useState('');
  const [phase, setPhase] = React.useState('');
  const [building, setBuilding] = React.useState('');
  const [owes, setOwes] = React.useState<'' | 'true' | 'false'>(initial.hasBalance ?? '');
  const [overdue, setOverdue] = React.useState(OVERDUE.includes(initial.overdueDays as never) ? initial.overdueDays! : '');
  const search = useDebounced(q.trim(), 300);

  const [items, setItems] = React.useState<FlatListItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [asOf, setAsOf] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [more, setMore] = React.useState(false);
  const [error, setError] = React.useState('');

  const query = React.useMemo<FlatsQuery>(
    () => ({
      q: search || undefined,
      phase: phase || undefined,
      building: building || undefined,
      hasBalance: owes === '' ? undefined : owes === 'true',
      overdueDays: overdue ? Number(overdue) : undefined,
      limit: 30,
    }),
    [search, phase, building, owes, overdue],
  );

  const load = React.useCallback(
    async (next?: string) => {
      if (next) setMore(true);
      else setLoading(true);
      setError('');
      try {
        const { page, append } = await fetchPage((cursor) => financeApi.flats({ ...query, cursor }), next);
        setItems((old) => (append ? [...old, ...page.items] : page.items));
        setCursor(page.nextCursor ?? null);
        setAsOf(page.asOf);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [query, errorMessage],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const buildings = phase ? BUILDINGS.filter((item) => item.phase === phase) : BUILDINGS;
  const filtered = Boolean(search || phase || building || owes || overdue);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('finance.desk')} title={t('finance.flats.title')} intro={t('finance.flats.intro')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" role="search" aria-label={t('finance.flats.filters')}>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold lg:col-span-1">
          {t('finance.flats.search_label')}
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t('finance.flats.search_placeholder')}
              maxLength={20}
              dir="ltr"
              className={`${INPUT_CLASS} ps-9 text-start`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.flats.phase')}
          <select
            value={phase}
            onChange={(event) => {
              setPhase(event.target.value);
              setBuilding('');
            }}
            className={INPUT_CLASS}
          >
            <option value="">{t('finance.flats.all')}</option>
            {PHASES.map((item) => (
              <option key={item.id} value={item.id}>
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.flats.building')}
          <select value={building} onChange={(event) => setBuilding(event.target.value)} className={INPUT_CLASS}>
            <option value="">{t('finance.flats.all')}</option>
            {buildings.map((item) => (
              <option key={item.value} value={item.value}>
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.flats.owes')}
          <select value={owes} onChange={(event) => setOwes(event.target.value as '' | 'true' | 'false')} className={INPUT_CLASS}>
            <option value="">{t('finance.flats.all')}</option>
            <option value="true">{t('finance.flats.owes_yes')}</option>
            <option value="false">{t('finance.flats.owes_no')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.flats.overdue')}
          <select value={overdue} onChange={(event) => setOverdue(event.target.value)} className={INPUT_CLASS}>
            <option value="">{t('finance.flats.overdue_any')}</option>
            {OVERDUE.map((days) => (
              <option key={days} value={days}>
                {t('finance.flats.overdue_days', { days })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {asOf && !loading && <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('finance.flats.as_of', { date: formatDate(asOf, lang) })}</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <RowsSkeleton rows={6} />
      ) : items.length === 0 ? (
        !error && <EmptyState icon={Building2} message={filtered ? t('finance.flats.empty_filtered') : t('finance.flats.empty')} />
      ) : (
        <TableShell caption={t('finance.flats.table_caption')} minWidth={860}>
          <thead>
            <tr>
              <th scope="col" className={TH}>{t('finance.flats.col_flat')}</th>
              <th scope="col" className={TH}>{t('finance.flats.col_owner')}</th>
              <th scope="col" className={TH}>{t('finance.flats.col_balance')}</th>
              <th scope="col" className={TH}>{t('finance.flats.col_overdue')}</th>
              <th scope="col" className={TH}>{t('finance.flats.col_credit')}</th>
              <th scope="col" className={TH}>{t('finance.flats.col_oldest')}</th>
              <th scope="col" className={TH}><span className="sr-only">{t('finance.flats.open')}</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((flat) => (
              <tr key={flat.id} className="border-t border-border hover:bg-muted/40">
                <td className={TD}>
                  <Link href={`/finance/flats/${encodeURIComponent(flat.id)}`} className={`inline-flex min-h-11 items-center gap-2 font-bold hover:text-primary ${FOCUS}`}>
                    <bdi dir="ltr">{flat.label}</bdi>
                    {!flat.isActive && <Badge>{t('finance.flats.inactive')}</Badge>}
                  </Link>
                </td>
                <td className={TD}>
                  {flat.ownerName ? <bdi>{flat.ownerName}</bdi> : <span className="text-muted-foreground">{t('finance.flats.no_owner')}</span>}
                </td>
                <td className={`${TD} font-semibold`}>
                  <Money amount={flat.balance} />
                </td>
                <td className={TD}>
                  {flat.overdueAmount > 0 ? (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Money amount={flat.overdueAmount} />
                      <Badge tone="warning">{t('finance.flats.overdue_badge')}</Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={TD}>{flat.credit > 0 ? <Money amount={flat.credit} /> : <span className="text-muted-foreground">—</span>}</td>
                <td className={`${TD} text-muted-foreground`}>
                  {flat.oldestDueDays === null ? '—' : t('finance.flats.oldest_days', { days: flat.oldestDueDays })}
                </td>
                <td className={`${TD} text-end`}>
                  <Link
                    href={`/finance/flats/${encodeURIComponent(flat.id)}`}
                    aria-label={t('finance.flats.open_for', { flat: flat.label })}
                    className={`inline-grid size-11 place-items-center rounded-md hover:bg-muted ${FOCUS}`}
                  >
                    <ArrowUpRight aria-hidden="true" className="size-5 rtl:-scale-x-100" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {cursor && !loading && <LoadMoreButton label={t('common.load_more')} loading={more} onClick={() => void load(cursor)} />}
    </div>
  );
}
