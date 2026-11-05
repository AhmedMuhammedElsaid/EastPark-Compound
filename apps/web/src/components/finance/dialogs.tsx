'use client';

import * as React from 'react';

import { financeApi } from '@/lib/api/finance';
import { amountToDecimal, cairoToday, centsToDecimal, formatMoney, parseAmount, toCents } from '@/lib/finance/money';
import { MANUAL_CHARGE_KINDS, VOID_REASON_MIN, type FlatDetail, type PayFor } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import { codeOf, describedBy, FormDialog, INPUT_CLASS, Labelled, Money, useFinanceError } from './parts';

type AmountError = 'invalid' | 'precision' | 'range';

export function useAmountErrorText(): (error: AmountError) => string {
  const { t } = useTranslation();
  return React.useCallback(
    (error: AmountError) =>
      t(error === 'precision' ? 'finance.errors.amountPrecision' : error === 'range' ? 'finance.errors.amountOutOfRange' : 'finance.errors.invalidAmount'),
    [t],
  );
}

/** Void with a reason (payments and charges). The backend decides who may void what. */
export function VoidDialog({
  open,
  title,
  body,
  onVoid,
  onClose,
  onDone,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  onVoid: (reason: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useFinanceError();
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');
  const id = React.useId();

  const close = () => {
    setReason('');
    setError('');
    setFieldError('');
    onClose();
  };

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < VOID_REASON_MIN) {
      setFieldError(t('finance.errors.reasonRequired'));
      return;
    }
    setFieldError('');
    setBusy(true);
    setError('');
    try {
      await onVoid(trimmed);
      setReason('');
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const hint = t('finance.void_form.reason_hint', { min: VOID_REASON_MIN });
  return (
    <FormDialog open={open} title={title} intro={body} submitLabel={t('finance.void_form.submit')} tone="danger" busy={busy} error={error} onSubmit={() => void submit()} onClose={close}>
      <Labelled id={id} label={t('finance.void_form.reason')} hint={hint} error={fieldError} required>
        <textarea
          id={id}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={describedBy(id, hint, fieldError)}
          className={`${INPUT_CLASS} py-3`}
        />
      </Labelled>
    </FormDialog>
  );
}

/** Cheque cleared / bounced on a Cairo date (default today, never in the future). */
export function ChequeDialog({
  open,
  kind,
  receivedAt,
  onSubmit,
  onClose,
  onDone,
}: {
  open: boolean;
  kind: 'cleared' | 'bounced';
  receivedAt: string;
  onSubmit: (date: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useFinanceError();
  const today = cairoToday();
  const [date, setDate] = React.useState(today);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const id = React.useId();

  const submit = async () => {
    if (!date || date > today) return setError(t('finance.errors.futureDate'));
    if (date < receivedAt) return setError(t('finance.errors.dateBeforeReceived'));
    setBusy(true);
    setError('');
    try {
      await onSubmit(date);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t(kind === 'cleared' ? 'finance.cheque_form.cleared_title' : 'finance.cheque_form.bounced_title')}
      intro={t(kind === 'cleared' ? 'finance.cheque_form.cleared_body' : 'finance.cheque_form.bounced_body')}
      submitLabel={t(kind === 'cleared' ? 'finance.cheque_form.submit_cleared' : 'finance.cheque_form.submit_bounced')}
      tone={kind === 'bounced' ? 'danger' : 'primary'}
      busy={busy}
      error={error}
      onSubmit={() => void submit()}
      onClose={() => {
        setError('');
        onClose();
      }}
    >
      <Labelled id={id} label={t('finance.cheque_form.date')} required>
        <input id={id} type="date" value={date} min={receivedAt} max={today} onChange={(event) => setDate(event.target.value)} className={INPUT_CLASS} />
      </Labelled>
    </FormDialog>
  );
}

/** Post a charge to one flat. */
export function AddChargeDialog({ open, flat, onClose, onDone }: { open: boolean; flat: FlatDetail; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useTranslation();
  const errorMessage = useFinanceError();
  const amountErrorText = useAmountErrorText();
  const today = cairoToday();
  const empty = { kind: 'SERVICE_CHARGE', amount: '', description: '', descriptionAr: '', dueDate: today, accrualPeriod: '' };
  const [form, setForm] = React.useState(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const base = React.useId();
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));

  const submit = async () => {
    const next: Record<string, string> = {};
    const amount = parseAmount(form.amount);
    if (!amount.ok) next.amount = amountErrorText(amount.error);
    if (!form.description.trim()) next.description = t('finance.charge_form.required');
    if (!form.descriptionAr.trim()) next.descriptionAr = t('finance.charge_form.required');
    if (!form.dueDate) next.dueDate = t('finance.charge_form.required');
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount.ok) return;
    setBusy(true);
    setError('');
    try {
      await financeApi.createCharge({
        flatId: flat.id,
        kind: form.kind as (typeof MANUAL_CHARGE_KINDS)[number],
        amount: centsToDecimal(amount.cents),
        description: form.description.trim(),
        descriptionAr: form.descriptionAr.trim(),
        dueDate: form.dueDate,
        ...(form.accrualPeriod ? { accrualPeriod: form.accrualPeriod } : {}),
      });
      setForm(empty);
      onDone(t('finance.charge_form.success', { flat: flat.label }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const ids = {
    kind: `${base}-kind`,
    amount: `${base}-amount`,
    description: `${base}-desc`,
    descriptionAr: `${base}-desc-ar`,
    dueDate: `${base}-due`,
    accrualPeriod: `${base}-period`,
  };
  const periodHint = t('finance.charge_form.accrual_hint');
  return (
    <FormDialog
      open={open}
      title={t('finance.charge_form.title', { flat: flat.label })}
      intro={t('finance.charge_form.intro')}
      submitLabel={t('finance.charge_form.submit')}
      busy={busy}
      error={error}
      onSubmit={() => void submit()}
      onClose={() => {
        setError('');
        setErrors({});
        onClose();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled id={ids.kind} label={t('finance.charge_form.kind')} required>
          <select id={ids.kind} value={form.kind} onChange={set('kind')} className={INPUT_CLASS}>
            {MANUAL_CHARGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`finance.charge_kind.${kind}`)}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled id={ids.amount} label={t('finance.charge_form.amount')} error={errors.amount} required>
          <input
            id={ids.amount}
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={form.amount}
            onChange={set('amount')}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={describedBy(ids.amount, undefined, errors.amount)}
            className={`${INPUT_CLASS} text-start tabular-nums`}
          />
        </Labelled>
        <Labelled id={ids.descriptionAr} label={t('finance.charge_form.description_ar')} error={errors.descriptionAr} required>
          <input id={ids.descriptionAr} dir="rtl" lang="ar" maxLength={300} value={form.descriptionAr} onChange={set('descriptionAr')} aria-invalid={Boolean(errors.descriptionAr)} className={INPUT_CLASS} />
        </Labelled>
        <Labelled id={ids.description} label={t('finance.charge_form.description')} error={errors.description} required>
          <input id={ids.description} dir="ltr" lang="en" maxLength={300} value={form.description} onChange={set('description')} aria-invalid={Boolean(errors.description)} className={INPUT_CLASS} />
        </Labelled>
        <Labelled id={ids.dueDate} label={t('finance.charge_form.due_date')} error={errors.dueDate} required>
          <input id={ids.dueDate} type="date" value={form.dueDate} onChange={set('dueDate')} className={INPUT_CLASS} />
        </Labelled>
        <Labelled id={ids.accrualPeriod} label={t('finance.charge_form.accrual_period')} hint={periodHint}>
          <input id={ids.accrualPeriod} type="month" value={form.accrualPeriod} onChange={set('accrualPeriod')} aria-describedby={describedBy(ids.accrualPeriod, periodHint)} className={INPUT_CLASS} />
        </Labelled>
      </div>
    </FormDialog>
  );
}

/**
 * Apply the flat's credit to open charges, dated today. Sends `expectedCredit` = the available
 * credit shown here; if it changed meanwhile the backend refuses (`creditChanged`) and the page
 * reloads the figure, so a retry can never apply credit twice.
 */
export function ApplyCreditDialog({
  open,
  flat,
  onClose,
  onDone,
  onStale,
}: {
  open: boolean;
  flat: FlatDetail;
  onClose: () => void;
  onDone: (message: string) => void;
  onStale: () => void;
}) {
  const { t, lang } = useTranslation();
  const errorMessage = useFinanceError();
  const amountErrorText = useAmountErrorText();
  const [payFor, setPayFor] = React.useState<PayFor>('AUTO');
  const [amount, setAmount] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const base = React.useId();
  const available = toCents(flat.availableCredit);

  const submit = async () => {
    let cents: number | undefined;
    if (amount.trim()) {
      const parsed = parseAmount(amount);
      if (!parsed.ok) return setFieldError(amountErrorText(parsed.error));
      if (parsed.cents > available) return setFieldError(t('finance.errors.insufficientCredit'));
      cents = parsed.cents;
    }
    setFieldError('');
    setBusy(true);
    setError('');
    try {
      const result = await financeApi.applyCredit(flat.id, {
        expectedCredit: amountToDecimal(flat.availableCredit),
        payFor,
        ...(cents !== undefined ? { amount: centsToDecimal(cents) } : {}),
      });
      setAmount('');
      onDone(t('finance.credit_form.success', { amount: formatMoney(result.applied, lang) }));
    } catch (caught) {
      setError(errorMessage(caught));
      if (codeOf(caught) === 'finance.creditChanged') onStale();
    } finally {
      setBusy(false);
    }
  };

  const hint = t('finance.credit_form.amount_hint');
  return (
    <FormDialog
      open={open}
      title={t('finance.credit_form.title', { flat: flat.label })}
      intro={
        <span>
          {t('finance.credit_form.available')} <Money amount={flat.availableCredit} className="font-bold text-foreground" />
        </span>
      }
      submitLabel={t('finance.credit_form.submit')}
      busy={busy}
      error={error}
      onSubmit={() => void submit()}
      onClose={() => {
        setError('');
        setFieldError('');
        onClose();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-[length:var(--text-label)] font-semibold">{t('finance.credit_form.mode')}</legend>
        {(['AUTO', 'DEPOSIT'] as const).map((value) => (
          <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 has-[:checked]:border-primary">
            <input type="radio" name={`${base}-mode`} value={value} checked={payFor === value} onChange={() => setPayFor(value)} className="mt-1 size-4 accent-primary" />
            <span>
              <span className="block font-semibold">{t(value === 'AUTO' ? 'finance.alloc.auto' : 'finance.alloc.deposit')}</span>
              <span className="block text-[length:var(--text-caption)] text-muted-foreground">
                {t(value === 'AUTO' ? 'finance.alloc.auto_body' : 'finance.alloc.deposit_body')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Labelled id={`${base}-amount`} label={t('finance.credit_form.amount')} hint={hint} error={fieldError}>
        <input
          id={`${base}-amount`}
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={describedBy(`${base}-amount`, hint, fieldError)}
          className={`${INPUT_CLASS} text-start tabular-nums`}
        />
      </Labelled>
    </FormDialog>
  );
}
