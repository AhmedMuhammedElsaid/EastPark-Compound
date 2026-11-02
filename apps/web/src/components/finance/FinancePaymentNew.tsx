'use client';

import { ArrowUpRight, CircleCheck, FileUp, RotateCcw, Search, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { financeApi } from '@/lib/api/finance';
import { cairoToday, centsToDecimal, formatDate, parseAmount, previewAutoAllocation, toCents } from '@/lib/finance/money';
import { PaymentSubmission } from '@/lib/finance/payment-submission';
import {
  PAYMENT_METHODS,
  type FlatDetail,
  type FlatListItem,
  type PaymentCreateInput,
  type PaymentMethod,
  type PaymentResult,
} from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { useAmountErrorText } from './dialogs';
import {
  codeOf,
  describedBy,
  FOCUS,
  INPUT_CLASS,
  Labelled,
  Money,
  Notice,
  PageHeader,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TableShell,
  TD,
  TH,
  useDebounced,
  useFinanceError,
} from './parts';

type Mode = 'AUTO' | 'DEPOSIT' | 'EXPLICIT';
type Slip = { status: 'idle' } | { status: 'uploading'; name: string } | { status: 'ready'; name: string; path: string };

// The BFF (Vercel) caps request bodies at 4.5 MB; the backend allows photos to 5 MB, PDFs to 10 MB.
const SLIP_MAX_BYTES = 4.5 * 1024 * 1024;
const SLIP_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ATTACHMENT_ERRORS = new Set(['finance.attachmentExpired', 'finance.attachmentMissing', 'finance.attachmentInvalid', 'finance.attachmentInUse']);

/**
 * Record a payment. One Idempotency-Key per submission (`PaymentSubmission`): if the answer is
 * lost, the form locks to that exact request and "Retry" re-sends it with the same key, so the
 * backend replays the original receipt instead of recording the money twice.
 */
export function FinancePaymentNew({ initialFlatId }: { initialFlatId?: string }) {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const amountErrorText = useAmountErrorText();
  const base = React.useId();
  const today = cairoToday();

  const [flat, setFlat] = React.useState<FlatDetail | null>(null);
  const [flatLoading, setFlatLoading] = React.useState(Boolean(initialFlatId));
  const [flatError, setFlatError] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [receivedAt, setReceivedAt] = React.useState(today);
  const [reference, setReference] = React.useState('');
  const [payerName, setPayerName] = React.useState('');
  const [note, setNote] = React.useState('');
  const [mode, setMode] = React.useState<Mode>('AUTO');
  const [explicit, setExplicit] = React.useState<Record<string, string>>({});
  const [slip, setSlip] = React.useState<Slip>({ status: 'idle' });
  const [slipError, setSlipError] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [submission] = React.useState(() => new PaymentSubmission<PaymentResult>((body, key) => financeApi.recordPayment(body, key)));
  const [submitting, setSubmitting] = React.useState(false);
  const [unconfirmed, setUnconfirmed] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [duplicate, setDuplicate] = React.useState(false);
  const [result, setResult] = React.useState<PaymentResult | null>(null);

  const pickFlat = React.useCallback(
    async (flatId: string) => {
      setFlatLoading(true);
      setFlatError('');
      try {
        setFlat(await financeApi.flat(flatId));
        setExplicit({});
      } catch (caught) {
        setFlat(null);
        setFlatError(errorMessage(caught));
      } finally {
        setFlatLoading(false);
      }
    },
    [errorMessage],
  );

  React.useEffect(() => {
    if (!initialFlatId) return;
    const timer = window.setTimeout(() => void pickFlat(initialFlatId), 0);
    return () => window.clearTimeout(timer);
  }, [initialFlatId, pickFlat]);

  const parsedAmount = parseAmount(amount);
  const amountCents = parsedAmount.ok ? parsedAmount.cents : 0;

  const preview = React.useMemo(() => {
    if (!flat || !amountCents || mode === 'EXPLICIT') return null;
    return previewAutoAllocation(flat.openCharges, amountCents, mode);
  }, [flat, amountCents, mode]);

  const explicitTotal = Object.values(explicit).reduce((sum, value) => {
    const parsed = parseAmount(value);
    return sum + (parsed.ok ? parsed.cents : 0);
  }, 0);

  const uploadSlip = async (file: File | undefined) => {
    setSlipError('');
    if (!file) return;
    if (!SLIP_TYPES.includes(file.type)) return setSlipError(t('finance.errors.attachmentType'));
    if (file.size > SLIP_MAX_BYTES) return setSlipError(t('finance.new_payment.slip_too_large'));
    setSlip({ status: 'uploading', name: file.name });
    try {
      const uploaded = await financeApi.uploadSlip(file);
      setSlip({ status: 'ready', name: file.name, path: uploaded.path });
    } catch (caught) {
      setSlip({ status: 'idle' });
      setSlipError(errorMessage(caught));
    }
  };

  /** Validates the form and builds the request body; null when a field needs attention. */
  const build = (force: boolean): PaymentCreateInput | null => {
    const next: Record<string, string> = {};
    if (!flat) next.flat = t('finance.new_payment.errors.flat_required');
    if (!parsedAmount.ok) next.amount = amountErrorText(parsedAmount.error);
    if (!receivedAt) next.receivedAt = t('finance.new_payment.errors.date_required');
    else if (receivedAt > today) next.receivedAt = t('finance.errors.futureDate');
    if (method === 'CHEQUE' && !reference.trim()) next.reference = t('finance.new_payment.errors.cheque_number_required');

    const allocations: { chargeId: string; amount: string }[] = [];
    if (mode === 'EXPLICIT' && flat) {
      for (const charge of flat.openCharges) {
        const value = explicit[charge.id];
        if (value === undefined) continue;
        const parsed = parseAmount(value);
        if (!parsed.ok) next[`alloc-${charge.id}`] = amountErrorText(parsed.error);
        else if (parsed.cents > toCents(charge.openAmount)) next[`alloc-${charge.id}`] = t('finance.errors.allocationExceedsCharge');
        else allocations.push({ chargeId: charge.id, amount: centsToDecimal(parsed.cents) });
      }
      if (Object.keys(explicit).length === 0) next.allocations = t('finance.new_payment.errors.allocation_none');
      else if (parsedAmount.ok && explicitTotal > parsedAmount.cents) next.allocations = t('finance.errors.allocationExceedsPayment');
    }
    if (slip.status === 'uploading') next.slip = t('finance.new_payment.slip_wait');

    setErrors(next);
    if (Object.keys(next).length > 0 || !flat || !parsedAmount.ok) return null;
    return {
      flatId: flat.id,
      amount: centsToDecimal(parsedAmount.cents),
      method,
      receivedAt,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(slip.status === 'ready' ? { attachmentPath: slip.path } : {}),
      ...(mode === 'EXPLICIT' ? { allocations } : { payFor: mode }),
      ...(force ? { force: true } : {}),
    };
  };

  const submit = async (force = false) => {
    if (submitting) return;
    const body = submission.unconfirmed?.body ?? build(force);
    if (!body) return;
    setSubmitting(true);
    setFormError('');
    setDuplicate(false);
    try {
      setResult(await submission.submit(body));
      setUnconfirmed(false);
    } catch (caught) {
      const pending = submission.unconfirmed !== null;
      setUnconfirmed(pending);
      if (pending) {
        setFormError(errorMessage(caught));
      } else {
        const code = codeOf(caught);
        if (code === 'finance.duplicateReference') setDuplicate(true);
        if (code && ATTACHMENT_ERRORS.has(code)) setSlip({ status: 'idle' });
        setFormError(errorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    submission.discard();
    setResult(null);
    setUnconfirmed(false);
    setAmount('');
    setReference('');
    setPayerName('');
    setNote('');
    setExplicit({});
    setSlip({ status: 'idle' });
    setFormError('');
    setDuplicate(false);
    setErrors({});
    if (flat) void pickFlat(flat.id);
  };

  if (result) return <Receipt result={result} onAnother={reset} />;

  const chargeLabel = (chargeId: string) => {
    const charge = flat?.openCharges.find((item) => item.id === chargeId);
    return charge ? `${t(`finance.charge_kind.${charge.kind}`)} · ${charge.accrualPeriod}` : chargeId;
  };
  const ids = {
    amount: `${base}-amount`,
    method: `${base}-method`,
    date: `${base}-date`,
    reference: `${base}-ref`,
    payer: `${base}-payer`,
    note: `${base}-note`,
    slip: `${base}-slip`,
  };
  const amountHint = t('finance.new_payment.amount_hint');
  const locked = unconfirmed || submitting;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('finance.desk')} title={t('finance.new_payment.title')} intro={t('finance.new_payment.intro')} />

      <form
        noValidate
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={locked} className="space-y-8 disabled:opacity-90">
          <section aria-labelledby={`${base}-flat-title`} className="space-y-3">
            <h2 id={`${base}-flat-title`} className="text-[length:var(--text-h2)] font-bold">
              {t('finance.new_payment.flat')}
            </h2>
            {flat ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-primary/50 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[length:var(--text-body-lg)] font-bold">
                    <bdi dir="ltr">{flat.label}</bdi>
                    {flat.owner && (
                      <span className="ms-2 font-normal text-muted-foreground">
                        · <bdi>{flat.owner.name}</bdi>
                      </span>
                    )}
                  </p>
                  <p className="text-[length:var(--text-caption)] text-muted-foreground">
                    {t('finance.new_payment.flat_balance')} <Money amount={flat.balance} /> · {t('finance.new_payment.flat_credit')} <Money amount={flat.credit} />
                  </p>
                </div>
                <button type="button" onClick={() => setFlat(null)} className={SECONDARY_BUTTON}>
                  {t('finance.new_payment.change_flat')}
                </button>
              </div>
            ) : (
              <FlatPicker onPick={(id) => void pickFlat(id)} loading={flatLoading} error={errors.flat || flatError} />
            )}
          </section>

          <section aria-labelledby={`${base}-money-title`} className="space-y-4">
            <h2 id={`${base}-money-title`} className="text-[length:var(--text-h2)] font-bold">
              {t('finance.new_payment.details')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Labelled id={ids.amount} label={t('finance.new_payment.amount')} hint={amountHint} error={errors.amount} required>
                <input
                  id={ids.amount}
                  inputMode="decimal"
                  dir="ltr"
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describedBy(ids.amount, amountHint, errors.amount)}
                  className={`${INPUT_CLASS} text-start text-[length:var(--text-body-lg)] font-bold tabular-nums`}
                />
              </Labelled>
              <Labelled id={ids.method} label={t('finance.new_payment.method')} required>
                <select id={ids.method} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={INPUT_CLASS}>
                  {PAYMENT_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {t(`finance.method.${value}`)}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled id={ids.date} label={t('finance.new_payment.received')} error={errors.receivedAt} required>
                <input
                  id={ids.date}
                  type="date"
                  value={receivedAt}
                  max={today}
                  onChange={(event) => setReceivedAt(event.target.value)}
                  aria-invalid={Boolean(errors.receivedAt)}
                  aria-describedby={describedBy(ids.date, undefined, errors.receivedAt)}
                  className={INPUT_CLASS}
                />
              </Labelled>
              <Labelled
                id={ids.reference}
                label={t(method === 'CHEQUE' ? 'finance.new_payment.cheque_number' : 'finance.new_payment.reference')}
                hint={method === 'CHEQUE' ? t('finance.new_payment.cheque_hint') : undefined}
                error={errors.reference}
                required={method === 'CHEQUE'}
              >
                <input
                  id={ids.reference}
                  dir="ltr"
                  maxLength={100}
                  autoComplete="off"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  aria-invalid={Boolean(errors.reference)}
                  aria-describedby={describedBy(ids.reference, method === 'CHEQUE' ? 'hint' : undefined, errors.reference)}
                  className={`${INPUT_CLASS} text-start`}
                />
              </Labelled>
              <Labelled id={ids.payer} label={t('finance.new_payment.payer')}>
                <input id={ids.payer} maxLength={120} autoComplete="off" value={payerName} onChange={(event) => setPayerName(event.target.value)} className={INPUT_CLASS} />
              </Labelled>
              <Labelled id={ids.note} label={t('finance.new_payment.note')}>
                <input id={ids.note} maxLength={500} autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} className={INPUT_CLASS} />
              </Labelled>
            </div>
          </section>

          <section aria-labelledby={`${base}-alloc-title`} className="space-y-4">
            <h2 id={`${base}-alloc-title`} className="text-[length:var(--text-h2)] font-bold">
              {t('finance.new_payment.allocation')}
            </h2>
            <fieldset className="grid gap-3 md:grid-cols-3">
              <legend className="sr-only">{t('finance.new_payment.allocation')}</legend>
              {(['AUTO', 'DEPOSIT', 'EXPLICIT'] as const).map((value) => (
                <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-4 py-3 has-[:checked]:border-primary">
                  <input type="radio" name={`${base}-mode`} value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-4 accent-primary" />
                  <span>
                    <span className="block font-semibold">{t(`finance.alloc.${value.toLowerCase()}`)}</span>
                    <span className="block text-[length:var(--text-caption)] text-muted-foreground">{t(`finance.alloc.${value.toLowerCase()}_body`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {!flat ? (
              <p className="text-muted-foreground">{t('finance.new_payment.pick_flat_first')}</p>
            ) : mode === 'EXPLICIT' ? (
              flat.openCharges.length === 0 ? (
                <p className="text-muted-foreground">{t('finance.flat.no_open_charges')}</p>
              ) : (
                <div className="space-y-3">
                  <TableShell caption={t('finance.new_payment.explicit_caption')} minWidth={640}>
                    <thead>
                      <tr>
                        <th scope="col" className={TH}><span className="sr-only">{t('finance.new_payment.pay_this')}</span></th>
                        <th scope="col" className={TH}>{t('finance.flat.col_description')}</th>
                        <th scope="col" className={TH}>{t('finance.flat.col_due')}</th>
                        <th scope="col" className={TH}>{t('finance.flat.col_open')}</th>
                        <th scope="col" className={TH}>{t('finance.new_payment.pay_amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flat.openCharges.map((charge) => {
                        const ticked = explicit[charge.id] !== undefined;
                        const errorKey = `alloc-${charge.id}`;
                        return (
                          <tr key={charge.id} className="border-t border-border">
                            <td className={TD}>
                              <input
                                type="checkbox"
                                checked={ticked}
                                aria-label={t('finance.new_payment.pay_charge', { charge: chargeLabel(charge.id) })}
                                onChange={(event) =>
                                  setExplicit((old) => {
                                    const next = { ...old };
                                    if (event.target.checked) next[charge.id] = centsToDecimal(toCents(charge.openAmount));
                                    else delete next[charge.id];
                                    return next;
                                  })
                                }
                                className="size-5 accent-primary"
                              />
                            </td>
                            <td className={TD}>
                              <span className="block font-semibold">{t(`finance.charge_kind.${charge.kind}`)}</span>
                              <span className="block text-[length:var(--text-caption)] text-muted-foreground" dir="rtl" lang="ar">
                                {charge.descriptionAr}
                              </span>
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>{formatDate(charge.dueDate, lang)}</td>
                            <td className={TD}><Money amount={charge.openAmount} /></td>
                            <td className={TD}>
                              <input
                                inputMode="decimal"
                                dir="ltr"
                                disabled={!ticked}
                                value={explicit[charge.id] ?? ''}
                                aria-label={t('finance.new_payment.pay_amount_for', { charge: chargeLabel(charge.id) })}
                                aria-invalid={Boolean(errors[errorKey])}
                                onChange={(event) => setExplicit((old) => ({ ...old, [charge.id]: event.target.value }))}
                                className={`${INPUT_CLASS} max-w-40 text-start tabular-nums`}
                              />
                              {errors[errorKey] && (
                                <p role="alert" className="mt-1 text-[length:var(--text-caption)] text-error">
                                  {errors[errorKey]}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableShell>
                  <p className="font-semibold">
                    {t('finance.new_payment.explicit_total')} <Money amount={explicitTotal / 100} />
                    {amountCents > 0 && (
                      <span className="ms-2 font-normal text-muted-foreground">
                        · {t('finance.new_payment.left_as_credit')} <Money amount={Math.max(amountCents - explicitTotal, 0) / 100} />
                      </span>
                    )}
                  </p>
                  {errors.allocations && <Notice tone="error">{errors.allocations}</Notice>}
                </div>
              )
            ) : preview ? (
              <div className="rounded-md border border-border bg-card p-4" aria-live="polite">
                <p className="font-semibold">{t('finance.new_payment.preview_title')}</p>
                <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('finance.new_payment.preview_estimate')}</p>
                {preview.lines.length === 0 ? (
                  <p className="mt-3 text-muted-foreground">{t('finance.new_payment.preview_none')}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {preview.lines.map((line) => (
                      <li key={line.chargeId} className="flex items-center justify-between gap-3 py-2">
                        <span>{chargeLabel(line.chargeId)}</span>
                        <Money amount={line.cents / 100} className="font-semibold" />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 border-t border-border pt-3 font-semibold">
                  {t('finance.new_payment.left_as_credit')} <Money amount={preview.creditCents / 100} />
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t('finance.new_payment.preview_enter_amount')}</p>
            )}
          </section>

          <section aria-labelledby={`${base}-slip-title`} className="space-y-3">
            <h2 id={`${base}-slip-title`} className="text-[length:var(--text-h2)] font-bold">
              {t('finance.new_payment.slip')}
            </h2>
            <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('finance.new_payment.slip_hint')}</p>
            {slip.status === 'idle' ? (
              <label htmlFor={ids.slip} className={`${SECONDARY_BUTTON} cursor-pointer`}>
                <FileUp aria-hidden="true" className="size-4.5" />
                {t('finance.new_payment.slip_choose')}
                <input
                  id={ids.slip}
                  type="file"
                  accept={SLIP_TYPES.join(',')}
                  className="sr-only"
                  onChange={(event) => {
                    void uploadSlip(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-2" role="status">
                <FileUp aria-hidden="true" className="size-4.5 text-primary" />
                <bdi className="min-w-0 truncate">{slip.name}</bdi>
                <span className="text-[length:var(--text-caption)] text-muted-foreground">
                  {slip.status === 'uploading' ? t('finance.new_payment.slip_uploading') : t('finance.new_payment.slip_ready')}
                </span>
                {slip.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => setSlip({ status: 'idle' })}
                    aria-label={t('finance.new_payment.slip_remove')}
                    className={`ms-auto inline-grid size-11 place-items-center rounded-md hover:bg-muted ${FOCUS}`}
                  >
                    <X aria-hidden="true" className="size-4.5" />
                  </button>
                )}
              </div>
            )}
            {(slipError || errors.slip) && <Notice tone="error">{slipError || errors.slip}</Notice>}
          </section>
        </fieldset>

        {unconfirmed ? (
          <Notice tone="warning">
            <p className="font-bold">{t('finance.new_payment.unconfirmed_title')}</p>
            <p>{t('finance.new_payment.unconfirmed_body')}</p>
            {formError && <p className="text-[length:var(--text-caption)]">{formError}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              <button type="submit" disabled={submitting} aria-busy={submitting || undefined} className={PRIMARY_BUTTON}>
                <RotateCcw aria-hidden="true" className="size-4.5" />
                {submitting ? t('finance.new_payment.submitting') : t('finance.new_payment.retry')}
              </button>
              <Link href="/finance/payments" target="_blank" rel="noopener" className={SECONDARY_BUTTON}>
                {t('finance.new_payment.check_payments')}
                <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              </Link>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  submission.discard();
                  setUnconfirmed(false);
                  setFormError('');
                }}
                className={SECONDARY_BUTTON}
              >
                {t('finance.new_payment.discard')}
              </button>
            </div>
          </Notice>
        ) : (
          <>
            {formError && (
              <Notice tone="error">
                <p>{formError}</p>
                {duplicate && (
                  <div className="pt-1">
                    <button type="button" onClick={() => void submit(true)} disabled={submitting} className={SECONDARY_BUTTON}>
                      {t('finance.new_payment.force')}
                    </button>
                  </div>
                )}
              </Notice>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <button type="submit" disabled={submitting || flatLoading} aria-busy={submitting || undefined} className={`${PRIMARY_BUTTON} min-w-48`}>
                {submitting ? t('finance.new_payment.submitting') : t('finance.new_payment.submit')}
              </button>
              {flat && parsedAmount.ok && (
                <p className="text-muted-foreground">
                  {t('finance.new_payment.summary', { flat: flat.label })} <Money amount={amountCents / 100} className="font-bold text-foreground" />
                </p>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function FlatPicker({ onPick, loading, error }: { onPick: (flatId: string) => void; loading: boolean; error?: string }) {
  const { t } = useTranslation();
  const errorMessage = useFinanceError();
  const id = React.useId();
  const [q, setQ] = React.useState('');
  const search = useDebounced(q.trim(), 250);
  const [results, setResults] = React.useState<FlatListItem[]>([]);
  const [searchError, setSearchError] = React.useState('');

  React.useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      if (!search) {
        setResults([]);
        return;
      }
      financeApi
        .flats({ q: search, limit: 8 })
        .then((page) => {
          if (!live) return;
          setResults(page.items);
          setSearchError('');
        })
        .catch((caught: unknown) => live && setSearchError(errorMessage(caught)));
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [search, errorMessage]);

  const hint = t('finance.new_payment.flat_hint');
  const shownError = error || searchError;
  return (
    <div className="space-y-3">
      <Labelled id={id} label={t('finance.new_payment.flat_search')} hint={hint} error={shownError} required>
        <span className="relative block">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={id}
            type="search"
            dir="ltr"
            autoComplete="off"
            maxLength={20}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t('finance.flats.search_placeholder')}
            aria-invalid={Boolean(shownError)}
            aria-describedby={describedBy(id, hint, shownError)}
            className={`${INPUT_CLASS} ps-9 text-start`}
          />
        </span>
      </Labelled>
      {loading && <p role="status" className="text-muted-foreground">{t('common.loading')}</p>}
      {search && results.length === 0 && !searchError && !loading && <p className="text-muted-foreground">{t('finance.new_payment.flat_none')}</p>}
      {results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={t('finance.new_payment.flat_results')}>
          {results.map((flat) => (
            <li key={flat.id}>
              <button
                type="button"
                onClick={() => onPick(flat.id)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-2 text-start hover:border-primary/60 ${FOCUS}`}
              >
                <span className="min-w-0">
                  <span className="block font-bold"><bdi dir="ltr">{flat.label}</bdi></span>
                  <span className="block truncate text-[length:var(--text-caption)] text-muted-foreground">
                    {flat.ownerName ? <bdi>{flat.ownerName}</bdi> : t('finance.flats.no_owner')}
                  </span>
                </span>
                <Money amount={flat.balance} className="shrink-0 font-semibold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Receipt({ result, onAnother }: { result: PaymentResult; onAnother: () => void }) {
  const { t, lang } = useTranslation();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="receipt-title" className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-primary/50 bg-card p-6 text-center">
        <CircleCheck aria-hidden="true" className="mx-auto size-12 text-success motion-safe:animate-[lead-dialog-in_300ms_ease-out]" />
        <h1 id="receipt-title" ref={headingRef} tabIndex={-1} className="mt-3 text-[length:var(--text-h1)] font-bold outline-none">
          {t('finance.new_payment.success_title')}
        </h1>
        <p className="mt-4 text-[length:var(--text-label)] font-semibold text-muted-foreground">{t('finance.new_payment.success_receipt')}</p>
        <p className="mt-1 text-[length:var(--text-display)] font-bold tabular-nums text-primary">
          <bdi>{result.receiptNo}</bdi>
        </p>
        <p className="mt-3 text-[length:var(--text-body-lg)]">
          <Money amount={result.amount} className="font-bold" /> · {t(`finance.method.${result.method}`)} · <bdi dir="ltr">{result.flatLabel}</bdi>
        </p>
        <p className="text-[length:var(--text-caption)] text-muted-foreground">{formatDate(result.receivedAt, lang)}</p>
      </div>

      {result.allocations.length > 0 && (
        <TableShell caption={t('finance.payment.allocations_title')} minWidth={480}>
          <thead>
            <tr>
              <th scope="col" className={TH}>{t('finance.payment.col_charge')}</th>
              <th scope="col" className={TH}>{t('finance.flat.col_period')}</th>
              <th scope="col" className={TH}>{t('finance.flat.col_amount')}</th>
            </tr>
          </thead>
          <tbody>
            {result.allocations.map((allocation) => (
              <tr key={allocation.id} className="border-t border-border">
                <td className={TD}>{t(`finance.charge_kind.${allocation.chargeKind}`)}</td>
                <td className={`${TD} tabular-nums`}><bdi dir="ltr">{allocation.accrualPeriod}</bdi></td>
                <td className={`${TD} font-semibold`}><Money amount={allocation.amount} /></td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-[length:var(--text-label)] text-muted-foreground">{t('finance.new_payment.balance_after')}</dt>
          <dd className="mt-1 font-bold"><Money amount={result.flatTotals.balance} /></dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-[length:var(--text-label)] text-muted-foreground">{t('finance.new_payment.credit_after')}</dt>
          <dd className="mt-1 font-bold"><Money amount={result.flatTotals.credit} /></dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onAnother} className={PRIMARY_BUTTON}>
          {t('finance.new_payment.record_another')}
        </button>
        <Link href={`/finance/payments/${encodeURIComponent(result.id)}`} className={SECONDARY_BUTTON}>
          {t('finance.new_payment.view_payment')}
        </Link>
        <Link href={`/finance/flats/${encodeURIComponent(result.flatId)}`} className={SECONDARY_BUTTON}>
          {t('finance.new_payment.view_flat')}
        </Link>
      </div>
    </section>
  );
}
