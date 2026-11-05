import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { financeApi } from '@/lib/api/finance';
import { FINANCE_ERROR_KEYS, financeCodeFromBackend, financeKeyOf } from '@/lib/finance/errors';
import {
  amountToDecimal,
  cairoToday,
  centsToDecimal,
  normalizeAmountInput,
  parseAmount,
  previewAutoAllocation,
} from '@/lib/finance/money';
import { isRetryableFailure, PaymentSubmission } from '@/lib/finance/payment-submission';
import { CHARGE_KINDS, CHEQUE_STATES, FINANCE_AUDIT_ACTIONS, PAYMENT_METHODS, POSTING_STATUSES } from '@/lib/finance/schemas';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

const body = { flatId: 'flat_A1-3-2', amount: '900.00', method: 'CASH' as const, receivedAt: '2026-11-02' };
const failure = (status: number) => Object.assign(new Error('x'), { status });

describe('PaymentSubmission (Idempotency-Key per submission)', () => {
  it('reuses the same key and body on a retry after a lost response', async () => {
    const send = vi.fn().mockRejectedValueOnce(failure(0)).mockRejectedValueOnce(failure(503)).mockResolvedValueOnce('receipt');
    let n = 0;
    const submission = new PaymentSubmission(send, () => `key-${++n}-abcdefgh`);

    await expect(submission.submit(body)).rejects.toThrow();
    expect(submission.unconfirmed?.key).toBe('key-1-abcdefgh');
    // The form is locked; even a different body re-sends the unconfirmed attempt unchanged.
    await expect(submission.submit({ ...body, amount: '1.00' })).rejects.toThrow();
    await expect(submission.submit(body)).resolves.toBe('receipt');

    expect(send.mock.calls.map(([sent, key]) => [sent.amount, key])).toEqual([
      ['900.00', 'key-1-abcdefgh'],
      ['900.00', 'key-1-abcdefgh'],
      ['900.00', 'key-1-abcdefgh'],
    ]);
    expect(submission.unconfirmed).toBeNull();
  });

  it('starts a new key after a success, a definite refusal or a discard', async () => {
    const send = vi.fn().mockResolvedValueOnce('r1').mockRejectedValueOnce(failure(409)).mockResolvedValueOnce('r2')
      .mockRejectedValueOnce(failure(0)).mockResolvedValueOnce('r3');
    let n = 0;
    const submission = new PaymentSubmission(send, () => `key-${++n}-abcdefgh`);
    await submission.submit(body);
    await expect(submission.submit(body)).rejects.toThrow();
    expect(submission.unconfirmed).toBeNull();
    await submission.submit({ ...body, force: true });
    await expect(submission.submit(body)).rejects.toThrow();
    submission.discard();
    await submission.submit(body);
    expect(send.mock.calls.map(([, key]) => key)).toEqual([
      'key-1-abcdefgh', 'key-2-abcdefgh', 'key-3-abcdefgh', 'key-4-abcdefgh', 'key-5-abcdefgh',
    ]);
  });

  it('sends the key as the Idempotency-Key header through the client', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'upstream' }), { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const submission = new PaymentSubmission((sent, key) => financeApi.recordPayment(sent, key), () => 'key-fixed-0001');
    await expect(submission.submit(body)).rejects.toMatchObject({ code: 'upstream', status: 502 });
    await expect(submission.submit(body)).rejects.toMatchObject({ status: 502 });
    const keys = fetchMock.mock.calls.map((call) => new Headers((call as unknown as [string, RequestInit])[1].headers).get('Idempotency-Key'));
    expect(keys).toEqual(['key-fixed-0001', 'key-fixed-0001']);
    vi.unstubAllGlobals();
  });

  it('classifies outcomes', () => {
    for (const status of [0, 201, 408, 429, 500, 502, 503]) expect(isRetryableFailure(failure(status))).toBe(true);
    for (const status of [400, 401, 403, 404, 409]) expect(isRetryableFailure(failure(status))).toBe(false);
  });
});

describe('finance money', () => {
  it('parses amounts to piasters without floats', () => {
    expect(parseAmount('450')).toEqual({ ok: true, cents: 45000 });
    expect(parseAmount('0.1')).toEqual({ ok: true, cents: 10 });
    expect(parseAmount('1,234.56')).toEqual({ ok: true, cents: 123456 });
    expect(parseAmount('٤٥٠٫٥')).toEqual({ ok: true, cents: 45050 });
    expect(parseAmount('9999999.99')).toEqual({ ok: true, cents: 999999999 });
    expect(parseAmount('1.234')).toEqual({ ok: false, error: 'precision' });
    expect(parseAmount('0')).toEqual({ ok: false, error: 'range' });
    expect(parseAmount('10000000')).toEqual({ ok: false, error: 'range' });
    expect(parseAmount('-5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseAmount('1e3')).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeAmountInput(' ١٬٠٠٠ ')).toBe('1000');
  });

  it('formats decimal strings for the backend', () => {
    expect(centsToDecimal(45000)).toBe('450.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(amountToDecimal(550.1)).toBe('550.10');
    expect(amountToDecimal(0.07)).toBe('0.07');
  });

  it('uses the Cairo calendar day', () => {
    expect(cairoToday(new Date('2026-11-02T22:30:00Z'))).toBe('2026-11-03');
    expect(cairoToday(new Date('2026-11-02T10:00:00Z'))).toBe('2026-11-02');
  });

  it('previews auto allocation oldest due first, deposits apart', () => {
    const charge = (id: string, kind: string, dueDate: string, openAmount: number) =>
      ({ id, kind, dueDate, openAmount, amount: openAmount, descriptionAr: id, accrualPeriod: dueDate.slice(0, 7) }) as never;
    const charges = [
      charge('nov', 'SERVICE_CHARGE', '2026-11-10', 450),
      charge('dep', 'MAINTENANCE_DEPOSIT', '2026-09-01', 1000),
      charge('oct', 'SERVICE_CHARGE', '2026-10-10', 450),
    ];
    expect(previewAutoAllocation(charges, 60000, 'AUTO')).toEqual({
      lines: [{ chargeId: 'oct', cents: 45000 }, { chargeId: 'nov', cents: 15000 }],
      creditCents: 0,
    });
    expect(previewAutoAllocation(charges, 120000, 'DEPOSIT')).toEqual({
      lines: [{ chargeId: 'dep', cents: 100000 }],
      creditCents: 20000,
    });
  });
});

describe('finance errors', () => {
  it('maps only allowlisted backend keys', () => {
    expect(financeCodeFromBackend('finance.error.periodClosed')).toBe('finance.periodClosed');
    expect(financeCodeFromBackend('finance.error.nope')).toBeUndefined();
    expect(financeCodeFromBackend('user.error.accountDeleted')).toBeUndefined();
    expect(financeKeyOf('finance.creditChanged')).toBe('creditChanged');
    expect(financeKeyOf('upstream')).toBeUndefined();
  });

  it('has en and ar copy for every finance error key', () => {
    const enErrors = (en as { finance: { errors: Record<string, string> } }).finance.errors;
    const arErrors = (ar as { finance: { errors: Record<string, string> } }).finance.errors;
    for (const key of FINANCE_ERROR_KEYS) {
      expect(enErrors[key], `en finance.errors.${key}`).toBeTruthy();
      expect(arErrors[key], `ar finance.errors.${key}`).toBeTruthy();
    }
  });

  it('covers every error key the backend defines', () => {
    const file = fileURLToPath(new URL('../../../backend/src/languages/en/finance.json', import.meta.url));
    if (!existsSync(file)) return;
    const backendKeys = Object.keys((JSON.parse(readFileSync(file, 'utf8')) as { error: Record<string, string> }).error);
    expect([...FINANCE_ERROR_KEYS].sort()).toEqual(backendKeys.sort());
  });

  it('has copy for every static key the finance desk renders', () => {
    const dir = fileURLToPath(new URL('../components/finance/', import.meta.url));
    const resolve = (source: unknown, key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), source);
    const missing: string[] = [];
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.tsx'))) {
      const source = readFileSync(`${dir}${file}`, 'utf8');
      for (const [, key] of source.matchAll(/\bt\(\s*'([a-z_]+(?:\.[A-Za-z_]+)+)'/g)) {
        for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
          if (typeof resolve(dict, key!) !== 'string') missing.push(`${lang}:${key} (${file})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('has copy for every enum value the desk labels', () => {
    const families: [string, readonly string[]][] = [
      ['finance.method', PAYMENT_METHODS],
      ['finance.cheque', CHEQUE_STATES],
      ['finance.status', POSTING_STATUSES],
      ['finance.charge_kind', CHARGE_KINDS],
      ['finance.audit.actions', FINANCE_AUDIT_ACTIONS],
      ['finance.roles', ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN', 'RESIDENT', 'MERCHANT']],
      ['finance.alloc', ['auto', 'auto_body', 'deposit', 'deposit_body', 'explicit', 'explicit_body']],
    ];
    for (const dict of [en, ar]) {
      const finance = dict as unknown as Record<string, unknown>;
      for (const [prefix, values] of families) {
        const node = prefix.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], finance) as Record<string, string>;
        for (const value of values) expect(node?.[value], `${prefix}.${value}`).toBeTruthy();
      }
    }
  });
});
