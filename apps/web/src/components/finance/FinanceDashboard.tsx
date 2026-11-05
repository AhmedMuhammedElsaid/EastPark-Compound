'use client';

import { ArrowUpRight, Building2, History, Lock, PlusCircle, Unlock, Wallet } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { RowsSkeleton } from '@/components/admin/team/panel-parts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { financeApi } from '@/lib/api/finance';
import { cairoToday, formatDate } from '@/lib/finance/money';
import type { Payment } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { PaymentStatusBadge } from './badges';
import { Badge, FOCUS, Money, Notice, PageHeader, PRIMARY_BUTTON, TableShell, TD, TH, useFinanceError } from './parts';

type PeriodState = { period: string; status: 'OPEN' | 'CLOSED' } | null;

/** Minimal desk landing: current period status, quick actions and the latest payments. */
export function FinanceDashboard() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const errorMessage = useFinanceError();
  const [period, setPeriod] = React.useState<PeriodState | undefined>(undefined);
  const [payments, setPayments] = React.useState<Payment[] | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let live = true;
    const current = cairoToday().slice(0, 7);
    financeApi
      .periods()
      .then((list) => live && setPeriod(list.items.find((item) => item.period === current) ?? null))
      .catch(() => live && setPeriod(null));
    financeApi
      .payments({ limit: 8 })
      .then((page) => live && setPayments(page.items))
      .catch((caught: unknown) => {
        if (!live) return;
        setPayments([]);
        setError(errorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, [errorMessage]);

  const actions = [
    { href: '/finance/payments/new', icon: PlusCircle, title: t('finance.dashboard.record_payment'), body: t('finance.dashboard.record_payment_body') },
    { href: '/finance/flats', icon: Building2, title: t('finance.dashboard.find_flat'), body: t('finance.dashboard.find_flat_body') },
    { href: '/finance/flats?hasBalance=true', icon: Wallet, title: t('finance.dashboard.owing_flats'), body: t('finance.dashboard.owing_flats_body') },
    { href: '/finance/audit', icon: History, title: t('finance.dashboard.audit'), body: t('finance.dashboard.audit_body') },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('finance.desk')}
        title={user?.name ? t('finance.dashboard.title_named', { name: user.name }) : t('finance.dashboard.title')}
        intro={t('finance.dashboard.intro')}
        actions={
          <Link href="/finance/payments/new" className={PRIMARY_BUTTON}>
            <PlusCircle aria-hidden="true" className="size-4.5" />
            {t('finance.nav.record_payment')}
          </Link>
        }
      />

      {period === undefined ? null : period ? (
        <Notice tone={period.status === 'OPEN' ? 'info' : 'warning'} live="none">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {period.status === 'OPEN' ? <Unlock aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
            {t(period.status === 'OPEN' ? 'finance.dashboard.period_open' : 'finance.dashboard.period_closed', { period: period.period })}
          </p>
        </Notice>
      ) : (
        <Notice tone="warning" live="none">{t('finance.dashboard.period_unknown')}</Notice>
      )}

      <section aria-labelledby="finance-quick">
        <h2 id="finance-quick" className="text-[length:var(--text-h2)] font-bold">
          {t('finance.dashboard.quick_title')}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(({ href, icon: Icon, title, body }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-full min-h-28 flex-col gap-2 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/60 motion-reduce:transition-none ${FOCUS}`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <Icon aria-hidden="true" className="size-5 text-primary" />
                  {title}
                </span>
                <span className="text-[length:var(--text-body)] text-muted-foreground">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="finance-recent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="finance-recent" className="text-[length:var(--text-h2)] font-bold">
            {t('finance.dashboard.recent_payments')}
          </h2>
          <Link href="/finance/payments" className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-primary hover:underline ${FOCUS}`}>
            {t('common.see_all')}
            <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
        <div className="mt-4">
          {payments === null ? (
            <RowsSkeleton rows={4} />
          ) : error ? (
            <Notice tone="error">{error}</Notice>
          ) : payments.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-muted-foreground">{t('finance.dashboard.no_payments')}</p>
          ) : (
            <TableShell caption={t('finance.dashboard.recent_payments')} minWidth={640}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>{t('finance.payments.col_receipt')}</th>
                  <th scope="col" className={TH}>{t('finance.payments.col_flat')}</th>
                  <th scope="col" className={TH}>{t('finance.payments.col_date')}</th>
                  <th scope="col" className={TH}>{t('finance.payments.col_amount')}</th>
                  <th scope="col" className={TH}>{t('finance.payments.col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className={TD}>
                      <Link href={`/finance/payments/${payment.id}`} className={`inline-flex min-h-11 items-center font-bold text-primary hover:underline ${FOCUS}`}>
                        <bdi>{payment.receiptNo}</bdi>
                      </Link>
                    </td>
                    <td className={TD}><bdi>{payment.flatLabel}</bdi></td>
                    <td className={`${TD} text-muted-foreground`}>{formatDate(payment.receivedAt, lang)}</td>
                    <td className={`${TD} font-semibold`}><Money amount={payment.amount} /></td>
                    <td className={TD}><PaymentStatusBadge payment={payment} /></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      </section>

      <p className="flex items-center gap-2 text-[length:var(--text-caption)] text-muted-foreground">
        <Badge>{t('finance.dashboard.scope_badge')}</Badge>
        {t('finance.dashboard.scope_note')}
      </p>
    </div>
  );
}
