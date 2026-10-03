'use client';

import type { SortingState } from '@tanstack/react-table';

import { CircleAlert, Inbox, RefreshCw, Search, SearchX, UsersRound, X } from 'lucide-react';
import * as React from 'react';

import {
  fetchLeadPage,
  fetchLeadStats,
  inviteLead,
  leadErrorKey,
  leadMatches,
  LeadRequestError,
  rejectLead,
  shiftStats,
  type LeadAction,
  type LeadFilter,
  type LeadStats,
  type LeadStatus,
  type ResidentLead,
} from '@/lib/api/resident-leads';
import { useTranslation } from '@/lib/i18n';

import { formatCount } from './lead-format';
import { ConfirmLeadDialog, LeadDetailsDrawer, type ConfirmRequest } from './LeadDialogs';
import { LeadRowActions, LeadsSkeleton, LeadsTable, type PendingMap } from './LeadsTable';
import { LeadStatusCards } from './LeadStatusCards';
import { LeadToasts, useToasts } from './LeadToasts';

type SortKey = 'newest' | 'oldest' | 'name' | 'unit';
const SORTS: Record<SortKey, SortingState> = {
  newest: [{ id: 'createdAt', desc: true }],
  oldest: [{ id: 'createdAt', desc: false }],
  name: [{ id: 'resident', desc: false }],
  unit: [{ id: 'unit', desc: false }],
};

function sortKeyFor(sorting: SortingState): SortKey | '' {
  const current = sorting[0];
  if (!current) return '';
  const match = (Object.keys(SORTS) as SortKey[]).find(
    (key) => SORTS[key][0].id === current.id && SORTS[key][0].desc === current.desc,
  );
  return match ?? '';
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500';

export function ResidentRequestsPanel() {
  const { t, lang } = useTranslation();
  const { toasts, push, dismiss } = useToasts();

  const [filter, setFilter] = React.useState<LeadFilter>('PENDING');
  const [rows, setRows] = React.useState<ResidentLead[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [listState, setListState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const listSeq = React.useRef(0);

  const [stats, setStats] = React.useState<LeadStats | null>(null);
  const [statsState, setStatsState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [statsKey, setStatsKey] = React.useState(0);

  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [sorting, setSorting] = React.useState<SortingState>(SORTS.newest);
  const [pending, setPending] = React.useState<PendingMap>({});
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);

  // First page for the selected status. A newer request supersedes an older one.
  React.useEffect(() => {
    const seq = ++listSeq.current;
    void (async () => {
      try {
        const page = await fetchLeadPage(filter);
        if (seq !== listSeq.current) return;
        setRows(page.items);
        setNextCursor(page.nextCursor);
        setListState('ready');
      } catch {
        if (seq === listSeq.current) setListState('error');
      }
    })();
  }, [filter, reloadKey]);

  // Counts load independently: if the stats endpoint is unavailable the list still works.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await fetchLeadStats();
        if (!active) return;
        setStats(next);
        setStatsState('ready');
      } catch {
        if (active) setStatsState((current) => (current === 'ready' ? current : 'error'));
      }
    })();
    return () => {
      active = false;
    };
  }, [statsKey]);

  const refreshStats = React.useCallback(() => setStatsKey((key) => key + 1), []);

  function selectFilter(next: LeadFilter) {
    if (next === filter && listState !== 'error') return;
    setListState('loading');
    setRows([]);
    setNextCursor(undefined);
    setFilter(next);
    setReloadKey((key) => key + 1);
  }

  function reload() {
    setListState('loading');
    setRows([]);
    setNextCursor(undefined);
    setReloadKey((key) => key + 1);
    if (statsState !== 'ready') setStatsState('loading');
    refreshStats();
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const seq = listSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchLeadPage(filter, nextCursor);
      if (seq !== listSeq.current) return;
      setRows((current) => {
        const seen = new Set(current.map((lead) => lead.id));
        return [...current, ...page.items.filter((lead) => !seen.has(lead.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      const status = error instanceof LeadRequestError ? error.status : 0;
      push('error', t(`admin_leads.errors.${leadErrorKey('load', status)}`));
    } finally {
      setLoadingMore(false);
    }
  }

  function setRowStatus(id: string, status: LeadStatus) {
    setRows((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
  }

  async function runAction({ lead, action }: ConfirmRequest) {
    if (pending[lead.id]) return;
    const from = lead.status;
    const optimistic: LeadStatus = action === 'invite' ? 'INVITED' : 'REJECTED';
    setPending((current) => ({ ...current, [lead.id]: { action, from } }));
    setRowStatus(lead.id, optimistic);
    setStats((current) => shiftStats(current, from, optimistic));

    try {
      let result: LeadStatus = optimistic;
      if (action === 'invite') result = await inviteLead(lead.id);
      else await rejectLead(lead.id);

      if (result !== optimistic) {
        setRowStatus(lead.id, result);
        setStats((current) => shiftStats(current, optimistic, result));
      }
      const toastKey =
        result === 'CONVERTED' ? 'already_registered' : action === 'reject' ? 'rejected' : from === 'INVITED' ? 'resent' : 'invited';
      push('success', t(`admin_leads.toast.${toastKey}`, { name: lead.name }));
    } catch (error) {
      const status = error instanceof LeadRequestError ? error.status : 0;
      setRowStatus(lead.id, from);
      setStats((current) => shiftStats(current, optimistic, from));
      push('error', t(`admin_leads.errors.${leadErrorKey(action, status)}`));
      if (status === 404) {
        setRows((current) => current.filter((item) => item.id !== lead.id));
        setDetailsId((current) => (current === lead.id ? null : current));
      } else if (status === 409) {
        // The server state moved on (e.g. the lead registered meanwhile); show the truth.
        reload();
      }
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[lead.id];
        return next;
      });
      refreshStats();
    }
  }

  const requestAction = React.useCallback((lead: ResidentLead, action: LeadAction) => setConfirm({ lead, action }), []);
  const openDetails = React.useCallback((lead: ResidentLead) => setDetailsId(lead.id), []);
  const closeConfirm = React.useCallback(() => setConfirm(null), []);
  const closeDetails = React.useCallback(() => setDetailsId(null), []);

  const visibleRows = React.useMemo(
    () => (deferredQuery.trim() ? rows.filter((lead) => leadMatches(lead, deferredQuery)) : rows),
    [rows, deferredQuery],
  );
  const searching = deferredQuery.trim().length > 0;
  const detailsLead = detailsId ? (rows.find((lead) => lead.id === detailsId) ?? null) : null;
  const filterTotal = stats ? (filter === 'ALL' ? stats.total : stats[filter]) : null;
  const sortKey = sortKeyFor(sorting);
  const searchId = React.useId();
  const sortId = React.useId();

  return (
    <section aria-labelledby="resident-requests-title" className="border-t border-border pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <UsersRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[length:var(--text-overline)] font-bold uppercase tracking-widest text-primary">{t('admin_leads.eyebrow')}</p>
            <h2 id="resident-requests-title" className="mt-1 text-[length:var(--text-h2)] font-bold">
              {t('admin_leads.title')}
            </h2>
            <p className="mt-1 max-w-xl text-[length:var(--text-body)] text-muted-foreground">{t('admin_leads.intro')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={listState === 'loading'}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:bg-muted disabled:opacity-60 ${FOCUS}`}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {t('admin_leads.refresh')}
        </button>
      </div>

      <LeadStatusCards value={filter} stats={stats} statsState={statsState} onChange={selectFilter} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={searchId} className="sr-only">
            {t('admin_leads.search_label')}
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('admin_leads.search_placeholder')}
              autoComplete="off"
              enterKeyHint="search"
              className={`min-h-12 w-full rounded-md border border-input bg-background ps-11 pe-12 text-[length:var(--text-body)] placeholder:text-muted-foreground focus:border-primary ${FOCUS} [&::-webkit-search-cancel-button]:hidden`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('admin_leads.clear_search')}
                className={`absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="sm:w-52">
          <label htmlFor={sortId} className="mb-1.5 block text-[length:var(--text-label)] font-semibold text-muted-foreground">
            {t('admin_leads.sort_label')}
          </label>
          <select
            id={sortId}
            value={sortKey}
            onChange={(event) => {
              const key = event.target.value as SortKey;
              if (SORTS[key]) setSorting(SORTS[key]);
            }}
            className={`min-h-12 w-full rounded-md border border-input bg-background px-3 text-[length:var(--text-body)] ${FOCUS}`}
          >
            {sortKey === '' && <option value="">—</option>}
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {t(`admin_leads.sort.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listState === 'ready' && rows.length > 0 && (
        <p className="mt-4 text-[length:var(--text-label)] text-muted-foreground" aria-live="polite">
          {!searching && filterTotal !== null
            ? t('admin_leads.showing_of_total', { shown: formatCount(visibleRows.length, lang), total: formatCount(Math.max(filterTotal, rows.length), lang) })
            : t('admin_leads.showing', { shown: formatCount(visibleRows.length, lang), loaded: formatCount(rows.length, lang) })}
          {searching && nextCursor && <span className="block sm:inline sm:ms-2">{t('admin_leads.search_scope')}</span>}
        </p>
      )}

      <div className="mt-4">
        {listState === 'loading' && <LeadsSkeleton />}

        {listState === 'error' && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
            <CircleAlert aria-hidden="true" className="size-8 text-error" />
            <p className="text-[length:var(--text-body-lg)] font-bold">{t('admin_leads.load_error_title')}</p>
            <p className="text-[length:var(--text-body)] text-muted-foreground">{t('admin_leads.load_error_body')}</p>
            <button
              type="button"
              onClick={reload}
              className={`mt-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 ${FOCUS}`}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {t('admin_leads.retry')}
            </button>
          </div>
        )}

        {listState === 'ready' && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="text-[length:var(--text-body-lg)] font-bold">{t('admin_leads.empty_title')}</p>
            <p className="text-[length:var(--text-body)] text-muted-foreground">
              {filter === 'ALL' ? t('admin_leads.empty_body') : t('admin_leads.empty_filter', { status: t(`admin_leads.status.${filter}`) })}
            </p>
          </div>
        )}

        {listState === 'ready' && rows.length > 0 && visibleRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="text-[length:var(--text-body-lg)] font-bold">{t('admin_leads.no_matches_title')}</p>
            <p className="text-[length:var(--text-body)] text-muted-foreground">{t('admin_leads.no_matches_body', { query: deferredQuery.trim() })}</p>
            <button type="button" onClick={() => setQuery('')} className={`mt-1 inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-primary hover:bg-muted ${FOCUS}`}>
              {t('admin_leads.clear_search')}
            </button>
          </div>
        )}

        {listState === 'ready' && visibleRows.length > 0 && (
          <LeadsTable
            rows={visibleRows}
            sorting={sorting}
            onSortingChange={setSorting}
            pending={pending}
            onAction={requestAction}
            onDetails={openDetails}
          />
        )}

        {listState === 'ready' && rows.length > 0 && (
          <div className="mt-5 flex justify-center">
            {nextCursor ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                aria-busy={loadingMore || undefined}
                className={`inline-flex min-h-12 min-w-44 items-center justify-center rounded-md border border-primary/55 px-6 text-[length:var(--text-button)] font-semibold text-primary hover:bg-primary/10 disabled:cursor-wait ${FOCUS} ${loadingMore ? 'lead-pending' : ''}`}
              >
                {loadingMore ? t('admin_leads.loading_more') : t('admin_leads.load_more')}
              </button>
            ) : (
              <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('admin_leads.all_loaded')}</p>
            )}
          </div>
        )}
      </div>

      <ConfirmLeadDialog request={confirm} onConfirm={(request) => void runAction(request)} onCancel={closeConfirm} />
      <LeadDetailsDrawer
        lead={detailsLead}
        onClose={closeDetails}
        actions={(lead) => <LeadRowActions lead={lead} pending={pending[lead.id]} onAction={requestAction} variant="drawer" />}
      />
      <LeadToasts toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
