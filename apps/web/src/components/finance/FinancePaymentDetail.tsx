'use client';

import { ArrowLeft, Ban, CircleCheck, FileImage, Undo2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { RowsSkeleton } from '@/components/admin/team/panel-parts';
import { financeApi, slipViewHref } from '@/lib/api/finance';
import { formatDate } from '@/lib/finance/money';
import type { PaymentDetail } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { PaymentStatusBadge } from './badges';
import { ChequeDialog, VoidDialog } from './dialogs';
import { FOCUS, Money, Notice, PageHeader, SECONDARY_BUTTON, StatTile, TableShell, TD, TH, useFinanceError } from './parts';

type Dialog = 'void' | 'cleared' | 'bounced' | null;

/** One payment: allocations, void, cheque cleared/bounced, and the private slip ("view slip"). */
export function FinancePaymentDetail({ paymentId, slipError }: { paymentId: string; slipError?: string }) {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const [payment, setPayment] = React.useState<PaymentDetail | null>(null);
  const [error, setError] = React.useState('');
  const [flash, setFlash] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog>(null);

  const load = React.useCallback(async () => {
    try {
      setPayment(await financeApi.payment(paymentId));
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [paymentId, errorMessage]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const done = (message: string) => {
    setDialog(null);
    setFlash(message);
    void load();
  };

  if (!payment) {
    return error ? (
      <div className="space-y-4">
        <BackLink />
        <Notice tone="error">{error}</Notice>
      </div>
    ) : (
      <RowsSkeleton rows={5} />
    );
  }

  const live = payment.status === 'POSTED';
  const pendingCheque = live && payment.method === 'CHEQUE' && payment.chequeState === 'PENDING_CLEARANCE';
  const description = (allocation: PaymentDetail['allocations'][number]) =>
    lang === 'ar' ? allocation.chargeDescriptionAr : allocation.chargeDescription || allocation.chargeDescriptionAr;

  return (
    <div className="space-y-8">
      <BackLink />
      <PageHeader
        eyebrow={
          <Link href={`/finance/flats/${encodeURIComponent(payment.flatId)}`} className={`inline-flex min-h-11 items-center hover:text-primary ${FOCUS}`}>
            <bdi dir="ltr">{payment.flatLabel}</bdi>
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t('finance.payment.receipt_label')}
            <bdi className="tabular-nums">{payment.receiptNo}</bdi>
            <PaymentStatusBadge payment={payment} />
          </span>
        }
        actions={
          <>
            {payment.hasAttachment && (
              <a href={slipViewHref(payment.id)} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}>
                <FileImage aria-hidden="true" className="size-4.5" />
                {t('finance.payment.view_slip')}
                <span className="sr-only">{t('finance.payment.opens_new_tab')}</span>
              </a>
            )}
            {pendingCheque && (
              <>
                <button type="button" onClick={() => setDialog('cleared')} className={SECONDARY_BUTTON}>
                  <CircleCheck aria-hidden="true" className="size-4.5" />
                  {t('finance.payment.mark_cleared')}
                </button>
                <button type="button" onClick={() => setDialog('bounced')} className={SECONDARY_BUTTON}>
                  <Undo2 aria-hidden="true" className="size-4.5" />
                  {t('finance.payment.mark_bounced')}
                </button>
              </>
            )}
            {live && !payment.isOpening && (
              <button type="button" onClick={() => setDialog('void')} className={SECONDARY_BUTTON}>
                <Ban aria-hidden="true" className="size-4.5" />
                {t('finance.payment.void')}
              </button>
            )}
          </>
        }
      />

      {slipError && <Notice tone="error">{t('finance.payment.slip_error', { reason: errorMessage(slipError) })}</Notice>}
      {flash && <Notice tone="success">{flash}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {payment.status === 'VOID' && (
        <Notice tone="warning" live="none">
          {t('finance.payment.voided', {
            name: payment.voidedBy?.name ?? '—',
            date: payment.voidedAt ? formatDate(payment.voidedAt, lang) : '—',
            reason: payment.voidReason ?? '—',
          })}
        </Notice>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('finance.payment.amount')}>
          <Money amount={payment.amount} />
        </StatTile>
        <StatTile label={t('finance.payment.allocated')}>
          <Money amount={payment.allocatedAmount} />
        </StatTile>
        <StatTile label={t('finance.payment.unallocated')}>
          <Money amount={payment.unallocatedAmount} />
        </StatTile>
        <StatTile label={t('finance.payment.received')}>{formatDate(payment.receivedAt, lang)}</StatTile>
      </dl>

      <dl className="grid gap-x-8 gap-y-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
        <Row label={t('finance.payment.method')}>{t(`finance.method.${payment.method}`)}</Row>
        <Row label={t(payment.method === 'CHEQUE' ? 'finance.payment.cheque_number' : 'finance.payment.reference')}>
          {payment.reference ? <bdi>{payment.reference}</bdi> : '—'}
        </Row>
        {payment.method === 'CHEQUE' && (
          <Row label={t('finance.payment.cheque_state')}>
            {t(`finance.cheque.${payment.chequeState}`)}
            {payment.clearedAt && ` · ${formatDate(payment.clearedAt, lang)}`}
            {payment.bouncedAt && ` · ${formatDate(payment.bouncedAt, lang)}`}
          </Row>
        )}
        <Row label={t('finance.payment.payer')}>{payment.payerName ? <bdi>{payment.payerName}</bdi> : '—'}</Row>
        <Row label={t('finance.payment.recorded_by')}>
          <bdi>{payment.createdBy.name}</bdi> · {formatDate(payment.createdAt, lang)}
        </Row>
        {payment.note && (
          <Row label={t('finance.payment.note')}>
            <bdi className="whitespace-pre-line">{payment.note}</bdi>
          </Row>
        )}
        {payment.isOpening && <Row label={t('finance.payment.kind')}>{t('finance.payment.opening')}</Row>}
      </dl>

      <section aria-labelledby="payment-allocations" className="space-y-3">
        <h2 id="payment-allocations" className="text-[length:var(--text-h2)] font-bold">
          {t('finance.payment.allocations_title')}
        </h2>
        {payment.allocations.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-muted-foreground">{t('finance.payment.no_allocations')}</p>
        ) : (
          <TableShell caption={t('finance.payment.allocations_title')} minWidth={720}>
            <thead>
              <tr>
                <th scope="col" className={TH}>{t('finance.payment.col_charge')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_period')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_due')}</th>
                <th scope="col" className={TH}>{t('finance.payment.col_applied_on')}</th>
                <th scope="col" className={TH}>{t('finance.flat.col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((allocation) => (
                <tr key={allocation.id} className={`border-t border-border ${allocation.voidedAt ? 'text-muted-foreground' : ''}`}>
                  <td className={TD}>
                    <span className="block font-semibold">{t(`finance.charge_kind.${allocation.chargeKind}`)}</span>
                    <span className="block text-[length:var(--text-caption)] text-muted-foreground">
                      <bdi>{description(allocation)}</bdi>
                    </span>
                    {allocation.voidedAt && <span className="block text-[length:var(--text-caption)]">{t('finance.payment.allocation_void')}</span>}
                  </td>
                  <td className={`${TD} tabular-nums`}><bdi dir="ltr">{allocation.accrualPeriod}</bdi></td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(allocation.dueDate, lang)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(allocation.allocatedAt, lang)}</td>
                  <td className={`${TD} font-semibold ${allocation.voidedAt ? 'line-through' : ''}`}><Money amount={allocation.amount} /></td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>

      <VoidDialog
        open={dialog === 'void'}
        title={t('finance.void_form.title_payment', { number: payment.receiptNo })}
        body={t('finance.void_form.body_payment')}
        onVoid={(reason) => financeApi.voidPayment(payment.id, reason)}
        onClose={() => setDialog(null)}
        onDone={() => done(t('finance.void_form.done_payment'))}
      />
      <ChequeDialog
        open={dialog === 'cleared' || dialog === 'bounced'}
        kind={dialog === 'bounced' ? 'bounced' : 'cleared'}
        receivedAt={payment.receivedAt}
        onSubmit={(date) => (dialog === 'bounced' ? financeApi.chequeBounced(payment.id, date) : financeApi.chequeCleared(payment.id, date))}
        onClose={() => setDialog(null)}
        onDone={() => done(t(dialog === 'bounced' ? 'finance.cheque_form.done_bounced' : 'finance.cheque_form.done_cleared'))}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[length:var(--text-label)] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link href="/finance/payments" className={`inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-muted-foreground hover:text-foreground ${FOCUS}`}>
      <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      {t('finance.payment.back')}
    </Link>
  );
}
