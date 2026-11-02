'use client';

import { PlusCircle, ReceiptText, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState, LoadMoreButton, RowsSkeleton } from '@/components/admin/team/panel-parts';
import { financeApi, type PaymentsQuery } from '@/lib/api/finance';
import { formatDate } from '@/lib/finance/money';
import { CHEQUE_STATES, PAYMENT_METHODS, POSTING_STATUSES, type Payment } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { PaymentStatusBadge } from './badges';
import { fetchPage, FOCUS, INPUT_CLASS, Money, Notice, PageHeader, PRIMARY_BUTTON, TableShell, TD, TH, useDebounced, useFinanceError } from './parts';

/** Payments: receipt/reference search, method, status, cheque state and date filters. */
export function FinancePayments() {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const [q, setQ] = React.useState('');
  const [method, setMethod] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [chequeState, setChequeState] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const search = useDebounced(q.trim(), 300);

  const [items, setItems] = React.useState<Payment[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [more, setMore] = React.useState(false);
  const [error, setError] = React.useState('');

  const query = React.useMemo<PaymentsQuery>(
    () => ({
      q: search || undefined,
      method: method || undefined,
      status: status || undefined,
      chequeState: chequeState || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 30,
    }),
    [search, method, status, chequeState, from, to],
  );

  const load = React.useCallback(
    async (next?: string) => {
      if (next) setMore(true);
      else setLoading(true);
      setError('');
      try {
        const { page, append } = await fetchPage((cursor) => financeApi.payments({ ...query, cursor }), next);
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

  const filtered = Boolean(search || method || status || chequeState || from || to);
  const select = (label: string, value: string, onChange: (value: string) => void, options: readonly string[], prefix: string) => (
    <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS}>
        <option value="">{t('finance.payments.all')}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`${prefix}.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('finance.desk')}
        title={t('finance.payments.title')}
        intro={t('finance.payments.intro')}
        actions={
          <Link href="/finance/payments/new" className={PRIMARY_BUTTON}>
            <PlusCircle aria-hidden="true" className="size-4.5" />
            {t('finance.nav.record_payment')}
          </Link>
        }
      />

      <div role="search" aria-label={t('finance.payments.filters')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold lg:col-span-2">
          {t('finance.payments.search_label')}
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={q} maxLength={100} onChange={(event) => setQ(event.target.value)} placeholder={t('finance.payments.search_placeholder')} className={`${INPUT_CLASS} ps-9`} />
          </span>
        </label>
        {select(t('finance.payments.method'), method, setMethod, PAYMENT_METHODS, 'finance.method')}
        {select(t('finance.payments.status'), status, setStatus, POSTING_STATUSES, 'finance.status')}
        {select(t('finance.payments.cheque_state'), chequeState, setChequeState, CHEQUE_STATES.filter((state) => state !== 'NOT_APPLICABLE'), 'finance.cheque')}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
            {t('finance.payments.from')}
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={`${INPUT_CLASS} px-2`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[length:var(--text-label)] font-semibold">
            {t('finance.payments.to')}
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={`${INPUT_CLASS} px-2`} />
          </label>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <RowsSkeleton rows={6} />
      ) : items.length === 0 ? (
        !error && <EmptyState icon={ReceiptText} message={filtered ? t('finance.payments.empty_filtered') : t('finance.payments.empty')} />
      ) : (
        <TableShell caption={t('finance.payments.table_caption')} minWidth={900}>
          <thead>
            <tr>
              <th scope="col" className={TH}>{t('finance.payments.col_receipt')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_date')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_flat')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_method')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_amount')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_by')}</th>
              <th scope="col" className={TH}>{t('finance.payments.col_status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((payment) => (
              <tr key={payment.id} className={`border-t border-border hover:bg-muted/40 ${payment.status === 'VOID' ? 'text-muted-foreground' : ''}`}>
                <td className={TD}>
                  <Link href={`/finance/payments/${encodeURIComponent(payment.id)}`} className={`inline-flex min-h-11 items-center font-bold text-primary hover:underline ${FOCUS}`}>
                    <bdi>{payment.receiptNo}</bdi>
                  </Link>
                  {payment.reference && (
                    <span className="block text-[length:var(--text-caption)] text-muted-foreground">
                      <bdi>{payment.reference}</bdi>
                    </span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{formatDate(payment.receivedAt, lang)}</td>
                <td className={TD}>
                  <Link href={`/finance/flats/${encodeURIComponent(payment.flatId)}`} className={`inline-flex min-h-11 items-center hover:text-primary ${FOCUS}`}>
                    <bdi dir="ltr">{payment.flatLabel}</bdi>
                  </Link>
                </td>
                <td className={TD}>{t(`finance.method.${payment.method}`)}</td>
                <td className={`${TD} font-semibold ${payment.status === 'VOID' ? 'line-through' : ''}`}><Money amount={payment.amount} /></td>
                <td className={TD}><bdi>{payment.createdBy.name}</bdi></td>
                <td className={TD}><PaymentStatusBadge payment={payment} /></td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {cursor && !loading && <LoadMoreButton label={t('common.load_more')} loading={more} onClick={() => void load(cursor)} />}
    </div>
  );
}
