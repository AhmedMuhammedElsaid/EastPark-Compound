import { describe, expect, it } from 'vitest';

import {
  attentionCards,
  checklist,
  dashboardSchema,
  deltaView,
  flatsHref,
  furthestBehind,
  highestOutstanding,
  percentOf,
  stringToCents,
  timelineKind,
  timelineLabelKey,
  type Dashboard,
} from '@/lib/finance/dashboard';
import { initialFlatsState, parseFlatsParams } from '@/lib/finance/flats-params';
import { dashboardQuerySchema, flatsQuerySchema } from '@/lib/finance/schemas';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

const cohort = { charges: '512500.00', allocated: '441000.00', open: '71500.00', rate: '86.0' };

function fixture(over: Partial<Dashboard> = {}): Dashboard {
  const base: Dashboard = {
    asOf: '2026-11-15',
    months: 12,
    period: { period: '2026-11', status: 'OPEN' },
    cohort,
    billed: [{ period: '2026-11', amount: '512500.00' }],
    collected: [{ period: '2026-11', amount: '441000.00' }],
    receiptsByMethod: [{ method: 'CASH', gross: '148000.00', reversed: '0.00', net: '148000.00' }],
    outstanding: '1284000.00',
    credit: { netCreditFlats: 3, netCreditTotal: '1250.00', creditTotal: '4000.00' },
    aging: { current: '412000.00', d31_60: '301000.00', d61_90: '228000.00', over90: '343000.00' },
    owingFlats: 137,
    totalFlats: 400,
    fundBalance: '3420000.00',
    deposits: { billed: '0.00', collected: '25000.00' },
    unapplied: { count: 5, total: '13750.00', oldest: [] },
    pendingCheques: { count: 0, total: '0.00' },
    checks: { previewBillingRuns: 0, previewImportBatches: 0, operatingChargesInMonth: 12 },
    byBuilding: [
      { building: 'A1', totalFlats: 52, owingFlats: 18, outstanding: '168000.00', floors: [] },
      { building: 'C1', totalFlats: 60, owingFlats: 26, outstanding: '254000.00', floors: [] },
      { building: 'B1', totalFlats: 56, owingFlats: 22, outstanding: '207000.00', floors: [] },
    ],
    topOwing: [],
    series: [],
    previous: { asOf: '2026-10-15', cohort, collected: '1.00', outstanding: '1.00', owingFlats: 1, fundBalance: '1.00' },
    deltas: { collected: '2.1', outstanding: '3.2', owingFlats: '-2.2', fundBalance: null, rate: '0.4' },
  };
  return { ...base, ...over };
}

describe('decimal helpers', () => {
  it('parses decimal strings to piasters without floats', () => {
    expect(stringToCents('12500.00')).toBe(BigInt(1250000));
    expect(stringToCents('-0.05')).toBe(BigInt(-5));
    expect(stringToCents('0.1')).toBe(BigInt(10));
    expect(stringToCents('nope')).toBe(BigInt(0));
  });

  it('computes a one-decimal half-up share, null on a zero whole', () => {
    expect(percentOf('343000.00', '1284000.00')).toBe('26.7');
    expect(percentOf('1.00', '8.00')).toBe('12.5');
    expect(percentOf('1.00', '3.00')).toBe('33.3');
    expect(percentOf('2.00', '3.00')).toBe('66.7');
    expect(percentOf('5.00', '0.00')).toBeNull();
  });
});

describe('deltas', () => {
  it('shows a dash on a null (zero baseline) delta', () => {
    expect(deltaView(null, true)).toEqual({ text: '—', direction: 'none', tone: 'neutral' });
  });
  it('colours by whether up is good', () => {
    expect(deltaView('2.1', true)).toMatchObject({ direction: 'up', tone: 'good', text: '▲ 2.1%' });
    expect(deltaView('3.2', false)).toMatchObject({ direction: 'up', tone: 'bad' });
    expect(deltaView('-2.2', false)).toMatchObject({ direction: 'down', tone: 'good', text: '▼ 2.2%' });
    expect(deltaView('-1.0', true)).toMatchObject({ direction: 'down', tone: 'bad' });
  });
  it('treats zero as flat and labels the rate in percentage points', () => {
    expect(deltaView('0.0', true)).toMatchObject({ direction: 'flat', tone: 'neutral' });
    expect(deltaView('0.4', true, 'pp').text).toBe('▲ 0.4 pp');
  });
});

describe('null collection rate', () => {
  it('is carried as null by the contract and a null delta is a dash', () => {
    const d = fixture({ cohort: { charges: '0.00', allocated: '0.00', open: '0.00', rate: null } });
    expect(dashboardSchema.safeParse(d).success).toBe(true);
    expect(deltaView(d.deltas.fundBalance, true).text).toBe('—');
  });
});

describe('attention cards', () => {
  it('builds the four cards in order with their destinations', () => {
    const cards = attentionCards(fixture());
    expect(cards.map((c) => c.id)).toEqual(['unapplied', 'over90', 'building', 'period']);
    expect(cards[0]).toMatchObject({ href: '/finance/payments', count: 5 });
    expect(cards[1]).toMatchObject({
      href: '/finance/flats?hasBalance=true&overdueDays=91&sort=balance&asOf=2026-11-15',
      share: '26.7',
    });
    expect(cards[2]).toMatchObject({
      building: 'C1',
      href: '/finance/flats?building=C1&hasBalance=true&sort=balance&asOf=2026-11-15',
    });
  });

  it('hides cards whose condition is false and prefers cheques over the period status', () => {
    const quiet = fixture({
      unapplied: { count: 0, total: '0.00', oldest: [] },
      aging: { current: '1.00', d31_60: '0.00', d61_90: '0.00', over90: '0.00' },
      byBuilding: [{ building: 'A1', totalFlats: 10, owingFlats: 0, outstanding: '0.00', floors: [] }],
    });
    expect(attentionCards(quiet).map((c) => c.id)).toEqual(['period']);
    const cheques = fixture({ ...quiet, pendingCheques: { count: 2, total: '900.00' } });
    expect(attentionCards(cheques).map((c) => c.id)).toEqual(['cheques']);
  });

  it('picks the building with the most arrears per flat, ties by code', () => {
    const b = (building: string, totalFlats: number, outstanding: string) => ({
      building,
      totalFlats,
      owingFlats: 1,
      outstanding,
      floors: [],
    });
    // 100 / 10 = 10 per flat beats 150 / 20 = 7.5 although its total is lower
    expect(furthestBehind([b('X', 20, '150.00'), b('Y', 10, '100.00')])?.building).toBe('Y');
    expect(furthestBehind([b('B2', 10, '100.00'), b('A1', 10, '100.00')])?.building).toBe('A1');
    expect(furthestBehind([b('A1', 10, '0.00')])).toBeNull();
  });
});

describe('initial building selection', () => {
  it('is the highest outstanding, ties by code', () => {
    const b = (building: string, outstanding: string) => ({ building, totalFlats: 1, owingFlats: 1, outstanding, floors: [] });
    expect(highestOutstanding([b('B1', '5.00'), b('A1', '9.00'), b('C1', '9.00')])?.building).toBe('A1');
    expect(highestOutstanding([])).toBeNull();
  });
});

describe('period checklist', () => {
  it('is all ok on a clean month', () => {
    const d = fixture({ unapplied: { count: 0, total: '0.00', oldest: [] } });
    expect(checklist(d).every((c) => c.state === 'ok')).toBe(true);
  });
  it('warns (never fails) and lists the strong checks first', () => {
    const d = fixture({
      period: { period: '2026-11', status: 'CLOSED' },
      checks: { previewBillingRuns: 1, previewImportBatches: 1, operatingChargesInMonth: 0 },
      pendingCheques: { count: 2, total: '900.00' },
    });
    const items = checklist(d);
    expect(items.map((c) => c.id)).toEqual(['period', 'preview', 'charges', 'unapplied', 'cheques']);
    expect(items.map((c) => c.state)).toEqual(['warn', 'warn', 'warn', 'warn', 'warn']);
    expect(items.filter((c) => c.strong).map((c) => c.id)).toEqual(['period', 'preview']);
    expect(items[1]!.count).toBe(2);
  });
});

describe('timeline label mapping', () => {
  it('maps the mockup labels and every known action to an existing translation', () => {
    expect(timelineLabelKey('FUND_ENTRY_RECORDED')).toBe('finance.dashboard.tl_fund_deposit');
    expect(timelineLabelKey('PAYMENT_RECORDED')).toBe('finance.audit.actions.PAYMENT_RECORDED');
    for (const action of Object.keys(en.finance.audit.actions)) {
      let node: unknown = en;
      for (const part of timelineLabelKey(action).split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
      expect(typeof node, action).toBe('string');
    }
  });
  it('never shows a raw code for an unknown action', () => {
    expect(timelineLabelKey('SOMETHING_NEW')).toBe('finance.dashboard.tl_generic');
    expect(timelineKind('PAYMENT_RECORDED')).toBe('pay');
    expect(timelineKind('FUND_ENTRY_RECORDED')).toBe('fund');
    expect(timelineKind('CHARGE_VOIDED')).toBe('warn');
    expect(timelineKind('PERIOD_CLOSED')).toBe('other');
  });
});

describe('copy parity', () => {
  it('has every dashboard key in both languages', () => {
    const keys = (o: Record<string, unknown>) => Object.keys(o).sort();
    expect(keys(ar.finance.dashboard)).toEqual(keys(en.finance.dashboard));
    expect(ar.finance.flats.overdue_over90).toBeTruthy();
  });
});

describe('drilldown links and flats-page initialisation', () => {
  it('builds links the flats page can read back', () => {
    const href = flatsHref({ building: 'C1', hasBalance: true, overdueDays: 91, sort: 'balance', asOf: '2026-11-15' });
    const params = Object.fromEntries(new URL(href, 'https://x.test').searchParams);
    expect(parseFlatsParams(params)).toEqual({
      building: 'C1',
      hasBalance: 'true',
      overdueDays: '91',
      sort: 'balance',
      asOf: '2026-11-15',
    });
    expect(flatsHref()).toBe('/finance/flats');
  });

  it('drops unknown or malformed values instead of relaying them', () => {
    expect(parseFlatsParams({ building: 'ZZ9', hasBalance: 'maybe', overdueDays: '45', sort: 'name', asOf: 'tomorrow' })).toEqual({
      building: undefined,
      hasBalance: undefined,
      overdueDays: undefined,
      sort: undefined,
      asOf: undefined,
    });
    expect(parseFlatsParams({ building: ['A1', 'B1'] }).building).toBeUndefined();
  });

  it('starts the page state from the URL filters (phase follows the building)', () => {
    const state = initialFlatsState(
      parseFlatsParams({ building: 'C1', hasBalance: 'true', overdueDays: '91', sort: 'balance', asOf: '2026-11-15' }),
    );
    expect(state).toMatchObject({ building: 'C1', phase: 'phase-1', owes: 'true', overdue: '91', sort: 'balance', asOf: '2026-11-15' });
    expect(initialFlatsState({})).toMatchObject({ building: '', phase: '', owes: '', overdue: '' });
  });

  it('lets the BFF forward sort/asOf and the dashboard query, nothing else', () => {
    expect(flatsQuerySchema.parse({ sort: 'balance', asOf: '2026-11-15' })).toMatchObject({ sort: 'balance', asOf: '2026-11-15' });
    expect(flatsQuerySchema.safeParse({ sort: 'name' }).success).toBe(false);
    expect(dashboardQuerySchema.parse({ months: '12', evil: 'x' })).toEqual({ months: '12' });
    expect(dashboardQuerySchema.safeParse({ months: '7' }).success).toBe(false);
  });
});
