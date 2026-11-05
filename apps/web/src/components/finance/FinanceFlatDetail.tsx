'use client';

import { ArrowLeft, Phone, PlusCircle, ReceiptText, Wallet } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { RowsSkeleton } from '@/components/admin/team/panel-parts';
import { financeApi } from '@/lib/api/finance';
import { formatDate } from '@/lib/finance/money';
import type { FlatDetail, OpenCharge, OwnershipItem, Payment } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { PaymentStatusBadge } from './badges';
import { AddChargeDialog, ApplyCreditDialog, VoidDialog } from './dialogs';
import { Badge, FOCUS, Money, Notice, PageHeader, PRIMARY_BUTTON, SECONDARY_BUTTON, StatTile, TableShell, TD, TH, useFinanceError } from './parts';

type Dialog = { kind: 'charge' } | { kind: 'credit' } | { kind: 'void'; charge: OpenCharge } | null;

/** Flat ledger: totals, owner contact (name + phone only), open charges, payments, ownership. */
export function FinanceFlatDetail({ flatId }: { flatId: string }) {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const [flat, setFlat] = React.useState<FlatDetail | null>(null);
  const [payments, setPayments] = React.useState<Payment[] | null>(null);
  const [ownership, setOwnership] = React.useState<OwnershipItem[] | null>(null);
  const [error, setError] = React.useState('');
  const [listError, setListError] = React.useState('');
  const [flash, setFlash] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog>(null);

  const loadFlat = React.useCallback(async () => {
    try {
      setFlat(await financeApi.flat(flatId));
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [flatId, errorMessage]);

  const loadPayments = React.useCallback(async () => {
    try {
      setPayments((await financeApi.payments({ flatId, limit: 50 })).items);
      setListError('');
    } catch (caught) {
      setPayments([]);
      setListError(errorMessage(caught));
    }
  }, [flatId, errorMessage]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFlat();
      void loadPayments();
      financeApi
        .ownership(flatId)
        .then((list) => setOwnership(list.items))
        .catch(() => setOwnership([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [flatId, loadFlat, loadPayments]);

  const done = (message: string) => {
    setDialog(null);
    setFlash(message);
    void loadFlat();
    void loadPayments();
  };

  if (!flat) {
    return error ? (
      <div className="space-y-4">
        <BackLink />
        <Notice tone="error">{error}</Notice>
      </div>
    ) : (
      <RowsSkeleton rows={6} />
    );
  }

  const canApplyCredit = flat.availableCredit > 0 && flat.openCharges.length > 0;

  return (
    <div className="space-y-8">
      <BackLink />
      <PageHeader
        eyebrow={t('finance.flat.eyebrow', { building: flat.building, floor: flat.floor })}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <bdi dir="ltr">{flat.label}</bdi>
            {!flat.isActive && <Badge>{t('finance.flats.inactive')}</Badge>}
          </span>
        }
        actions={
          <>
            <Link href={`/finance/payments/new?flatId=${encodeURIComponent(flat.id)}`} className={PRIMARY_BUTTON}>
              <ReceiptText aria-hidden="true" className="size-4.5" />
              {t('finance.flat.record_payment')}
            </Link>
            <button type="button" onClick={() => setDialog({ kind: 'charge' })} disabled={!flat.isActive} className={SECONDARY_BUTTON}>
              <PlusCircle aria-hidden="true" className="size-4.5" />
              {t('finance.flat.add_charge')}
            </button>
            <button type="button" onClick={() => setDialog({ kind: 'credit' })} disabled={!canApplyCredit} className={SECONDARY_BUTTON}>
              <Wallet aria-hidden="true" className="size-4.5" />
              {t('finance.flat.apply_credit')}
            </button>
          </>
        }
      />

      {flash && <Notice tone="success">{flash}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <StatTile label={t('finance.flat.balance')}>
            <Money amount={flat.balance} />
          </StatTile>
          <StatTile
            label={t('finance.flat.overdue')}
            hint={flat.oldestDueDays !== null ? t('finance.flat.oldest_due', { days: flat.oldestDueDays }) : undefined}
          >
            <Money amount={flat.overdueAmount} />
          </StatTile>
          <StatTile label={t('finance.flat.credit')}>
            <Money amount={flat.credit} />
          </StatTile>
          <StatTile label={t('finance.flat.available_credit')}>
            <Money amount={flat.availableCredit} />
          </StatTile>
        </dl>

        <section aria-labelledby="flat-owner" className="rounded-md border border-border bg-card p-4">
          <h2 id="flat-owner" className="text-[length:var(--text-label)] font-semibold text-muted-foreground">
            {t('finance.flat.owner')}
          </h2>
          {flat.owner ? (
            <div className="mt-2 space-y-2">
              <p className="text-[length:var(--text-body-lg)] font-bold">
                <bdi>{flat.owner.name}</bdi>
              </p>
              <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('finance.flat.since', { date: formatDate(flat.owner.since, lang) })}</p>
              {flat.owner.phone ? (
                <a
                  href={`tel:${flat.owner.phone}`}
                  aria-label={t('finance.flat.call', { name: flat.owner.name })}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-semibold text-primary hover:underline ${FOCUS}`}
                >
                  <Phone aria-hidden="true" className="size-4" />
                  <bdi dir="ltr">{flat.owner.phone}</bdi>
                </a>
              ) : (
                <p className="text-muted-foreground">{t('finance.flat.no_phone')}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">{t('finance.flat.owner_none')}</p>
          )}
        </section>
      </div>

      <section aria-labelledby="flat-charges" className="space-y-3">
        <div>
          <h2 id="flat-charges" className="text-[length:var(--text-h2)] font-bold">
            {t('finance.flat.open_charges')}
          </h2>
          <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('finance.flat.as_of', { date: formatDate(flat.asOf, lang) })}</p>
        </div>
        {flat.openCharges.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{t('finance.flat.no_open_charges')}</p>
        ) : (
          <TableShell caption={t('finance.flat.open_charges')} minWidth={760}>
            <thead>
              <tr>
                <th scope="col" className={TH}>{t('finance.flat.col_due')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_description')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_period')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_amount')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_open')}</th>
                <th scope="col" className={TH}><span className="sr-only">{t('finance.flat.col_actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {flat.openCharges.map((charge) => (
                <tr key={charge.id} className="border-t border-border">
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(charge.dueDate, lang)}</td>
                  <td className={TD}>
                    <span className="block font-semibold">{t(`finance.charge_kind.${charge.kind}`)}</span>
                    <span className="block text-[length:var(--text-caption)] text-muted-foreground" dir="rtl" lang="ar">
                      {charge.descriptionAr}
                    </span>
                  </td>
                  <td className={`${TD} tabular-nums`}><bdi dir="ltr">{charge.accrualPeriod}</bdi></td>
                  <td className={TD}><Money amount={charge.amount} /></td>
                  <td className={`${TD} font-semibold`}><Money amount={charge.openAmount} /></td>
                  <td className={`${TD} text-end`}>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'void', charge })}
                      aria-label={t('finance.flat.void_charge_for', { charge: charge.descriptionAr })}
                      className={`inline-flex min-h-11 items-center rounded-md px-3 text-[length:var(--text-label)] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
                    >
                      {t('finance.flat.void_charge')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>

      <section aria-labelledby="flat-payments" className="space-y-3">
        <h2 id="flat-payments" className="text-[length:var(--text-h2)] font-bold">
          {t('finance.flat.payments_title')}
        </h2>
        {listError && <Notice tone="error">{listError}</Notice>}
        {payments === null ? (
          <RowsSkeleton rows={3} />
        ) : payments.length === 0 ? (
          !listError && <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{t('finance.flat.no_payments')}</p>
        ) : (
          <TableShell caption={t('finance.flat.payments_title')} minWidth={760}>
            <thead>
              <tr>
                <th scope="col" className={TH}>{t('finance.payments.col_receipt')}</th>
                <th scope="col" className={TH}>{t('finance.payments.col_date')}</th>
                <th scope="col" className={TH}>{t('finance.payments.col_method')}</th>
                <th scope="col" className={TH}>{t('finance.payments.col_amount')}</th>
                <th scope="col" className={TH}>{t('finance.payments.col_allocated')}</th>
                <th scope="col" className={TH}>{t('finance.payments.col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className={`border-t border-border ${payment.status === 'VOID' ? 'text-muted-foreground' : ''}`}>
                  <td className={TD}>
                    <Link href={`/finance/payments/${encodeURIComponent(payment.id)}`} className={`inline-flex min-h-11 items-center font-bold text-primary hover:underline ${FOCUS}`}>
                      <bdi>{payment.receiptNo}</bdi>
                    </Link>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(payment.receivedAt, lang)}</td>
                  <td className={TD}>{t(`finance.method.${payment.method}`)}</td>
                  <td className={`${TD} font-semibold ${payment.status === 'VOID' ? 'line-through' : ''}`}><Money amount={payment.amount} /></td>
                  <td className={TD}><Money amount={payment.allocatedAmount} /></td>
                  <td className={TD}><PaymentStatusBadge payment={payment} /></td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>

      <section aria-labelledby="flat-ownership" className="space-y-3">
        <h2 id="flat-ownership" className="text-[length:var(--text-h2)] font-bold">
          {t('finance.flat.ownership_title')}
        </h2>
        {ownership === null ? (
          <RowsSkeleton rows={2} />
        ) : ownership.length === 0 ? (
          <p className="text-muted-foreground">{t('finance.flat.ownership_none')}</p>
        ) : (
          <ol className="divide-y divide-border rounded-md border border-border bg-card">
            {ownership.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {item.ownerDeleted || !item.ownerName ? t('finance.flat.former_owner') : <bdi>{item.ownerName}</bdi>}
                  </p>
                  <p className="text-[length:var(--text-caption)] text-muted-foreground">
                    {item.beforeGoLive ? t('finance.flat.before_go_live') : formatDate(item.fromDate, lang)}
                    {' – '}
                    {item.toDate ? formatDate(item.toDate, lang) : t('finance.flat.ownership_now')}
                  </p>
                </div>
                {item.toDate === null ? (
                  <Badge tone="gold">{t('finance.flat.ownership_current')}</Badge>
                ) : item.closedReason ? (
                  <Badge>{t(`finance.flat.closed_${item.closedReason}`)}</Badge>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <AddChargeDialog open={dialog?.kind === 'charge'} flat={flat} onClose={() => setDialog(null)} onDone={done} />
      <ApplyCreditDialog open={dialog?.kind === 'credit'} flat={flat} onClose={() => setDialog(null)} onDone={done} onStale={() => void loadFlat()} />
      <VoidDialog
        open={dialog?.kind === 'void'}
        title={t('finance.void_form.title_charge')}
        body={dialog?.kind === 'void' ? t('finance.void_form.body_charge', { charge: dialog.charge.descriptionAr }) : ''}
        onVoid={(reason) => (dialog?.kind === 'void' ? financeApi.voidCharge(dialog.charge.id, reason) : Promise.resolve())}
        onClose={() => setDialog(null)}
        onDone={() => done(t('finance.void_form.done_charge'))}
      />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link href="/finance/flats" className={`inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-muted-foreground hover:text-foreground ${FOCUS}`}>
      <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      {t('finance.flat.back')}
    </Link>
  );
}
