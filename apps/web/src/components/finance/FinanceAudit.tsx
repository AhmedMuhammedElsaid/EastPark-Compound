'use client';

import { History } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState, LoadMoreButton, RowsSkeleton } from '@/components/admin/team/panel-parts';
import { financeApi, type AuditQuery } from '@/lib/api/finance';
import { formatDate } from '@/lib/finance/money';
import { FINANCE_AUDIT_ACTIONS, type AuditItem } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { Badge, fetchPage, FOCUS, INPUT_CLASS, Notice, PageHeader, useFinanceError } from './parts';

/** Only plain, non-identifying meta values are shown (the backend keeps PII out of finance meta). */
const META_KEYS = ['receiptNo', 'amount', 'flatLabel', 'kind', 'method', 'reason', 'date', 'chequeState', 'applied', 'period'];

function metaEntries(meta: AuditItem['meta']): [string, string][] {
  if (!meta) return [];
  return META_KEYS.flatMap((key) => {
    const value = meta[key];
    return typeof value === 'string' || typeof value === 'number' ? [[key, String(value)] as [string, string]] : [];
  });
}

function entityHref(item: AuditItem): string | null {
  if (!item.entityId) return null;
  if (item.entity === 'Payment') return `/finance/payments/${encodeURIComponent(item.entityId)}`;
  if (item.entity === 'Flat') return `/finance/flats/${encodeURIComponent(item.entityId)}`;
  return null;
}

/** Finance audit trail, newest first. */
export function FinanceAudit() {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const [action, setAction] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [items, setItems] = React.useState<AuditItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [more, setMore] = React.useState(false);
  const [error, setError] = React.useState('');

  const query = React.useMemo<AuditQuery>(() => ({ action: action || undefined, from: from || undefined, to: to || undefined, limit: 30 }), [action, from, to]);

  const load = React.useCallback(
    async (next?: string) => {
      if (next) setMore(true);
      else setLoading(true);
      setError('');
      try {
        const { page, append } = await fetchPage((cursor) => financeApi.audit({ ...query, cursor }), next);
        setItems((old) => (append ? [...old, ...page.items] : page.items));
        setCursor(page.nextCursor ?? null);
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

  const filtered = Boolean(action || from || to);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('finance.desk')} title={t('finance.audit.title')} intro={t('finance.audit.intro')} />

      <div role="search" aria-label={t('finance.audit.filters')} className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.audit.action')}
          <select value={action} onChange={(event) => setAction(event.target.value)} className={INPUT_CLASS}>
            <option value="">{t('finance.audit.all_actions')}</option>
            {FINANCE_AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`finance.audit.actions.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.payments.from')}
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
          {t('finance.payments.to')}
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={INPUT_CLASS} />
        </label>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <RowsSkeleton rows={6} />
      ) : items.length === 0 ? (
        !error && <EmptyState icon={History} message={filtered ? t('finance.audit.empty_filtered') : t('finance.audit.empty')} />
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border bg-card">
          {items.map((item) => {
            const href = entityHref(item);
            const meta = metaEntries(item.meta);
            return (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {t(`finance.audit.actions.${item.action}`)}
                    {href ? (
                      <Link href={href} className={`inline-flex min-h-11 items-center text-[length:var(--text-label)] font-semibold text-primary hover:underline ${FOCUS}`}>
                        {t('finance.audit.open_entity')}
                      </Link>
                    ) : null}
                  </p>
                  <p className="text-[length:var(--text-label)] text-muted-foreground">
                    <bdi>{item.actor.name}</bdi> · {t(`finance.roles.${item.actor.role}`)}
                  </p>
                  {meta.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {meta.map(([key, value]) => (
                        <li key={key}>
                          <Badge>
                            {t(`finance.audit.meta.${key}`)}: <bdi className="ms-1">{value}</bdi>
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <time dateTime={item.createdAt} className="shrink-0 text-[length:var(--text-caption)] text-muted-foreground">
                  {formatDate(item.createdAt, lang)}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {cursor && !loading && <LoadMoreButton label={t('common.load_more')} loading={more} onClick={() => void load(cursor)} />}
    </div>
  );
}
