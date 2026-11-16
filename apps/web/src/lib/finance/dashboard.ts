import { z } from 'zod';

import { FINANCE_AUDIT_ACTIONS } from './schemas';

/**
 * `GET /v1/finance/dashboard` (accounting slice 9). Money is a decimal STRING and a percentage a
 * one-decimal string; nothing here turns a figure into a float. The derivations below (attention
 * cards, checklist, deltas, timeline labels) are pure so they can be tested without a browser.
 */

const money = z.string();
const percent = z.string().nullable();

const cohortSchema = z.object({ charges: money, allocated: money, open: money, rate: percent });
const monthAmount = z.object({ period: z.string(), amount: money });

export const dashboardSchema = z.object({
  asOf: z.string(),
  months: z.number(),
  period: z.object({ period: z.string(), status: z.string() }),
  cohort: cohortSchema,
  billed: z.array(monthAmount),
  collected: z.array(monthAmount),
  receiptsByMethod: z.array(z.object({ method: z.string(), gross: money, reversed: money, net: money })),
  outstanding: money,
  credit: z.object({ netCreditFlats: z.number(), netCreditTotal: money, creditTotal: money }),
  aging: z.object({ current: money, d31_60: money, d61_90: money, over90: money }),
  owingFlats: z.number(),
  totalFlats: z.number(),
  fundBalance: money,
  deposits: z.object({ billed: money, collected: money }),
  unapplied: z.object({
    count: z.number(),
    total: money,
    oldest: z.array(
      z.object({
        paymentId: z.string(),
        flatId: z.string(),
        flatLabel: z.string(),
        method: z.string(),
        receivedAt: z.string(),
        unallocated: money,
        ageDays: z.number(),
      }),
    ),
  }),
  pendingCheques: z.object({ count: z.number(), total: money }),
  checks: z.object({ previewBillingRuns: z.number(), previewImportBatches: z.number(), operatingChargesInMonth: z.number() }),
  byBuilding: z.array(
    z.object({
      building: z.string(),
      totalFlats: z.number(),
      owingFlats: z.number(),
      outstanding: money,
      floors: z.array(z.object({ floor: z.string(), totalFlats: z.number(), owingFlats: z.number(), outstanding: money })),
    }),
  ),
  topOwing: z.array(
    z.object({
      flatId: z.string(),
      label: z.string(),
      ownerName: z.string().nullable(),
      ownerDeleted: z.boolean(),
      balance: money,
      daysPastDue: z.number(),
    }),
  ),
  series: z.array(z.object({ period: z.string(), date: z.string(), outstanding: money, owingFlats: z.number(), fundBalance: money })),
  previous: z.object({
    asOf: z.string(),
    cohort: cohortSchema,
    collected: money,
    outstanding: money,
    owingFlats: z.number(),
    fundBalance: money,
  }),
  deltas: z.object({
    collected: percent,
    outstanding: percent,
    owingFlats: percent,
    fundBalance: percent,
    rate: percent,
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export type DashboardBuilding = Dashboard['byBuilding'][number];

// ---- decimal-string helpers (BigInt piasters, never float) ----------------------------------

// BigInt() calls, not literals: the project's TS target is below ES2020.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const TWO_THOUSAND = BigInt(2000);

/** A backend decimal string as whole piasters, half away from zero at a third decimal. Unparsable is 0. */
export function stringToCents(value: string | null | undefined): bigint {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec((value ?? '').trim());
  if (!match) return ZERO;
  const fraction = match[3] ?? '';
  let cents = BigInt(match[2]!) * HUNDRED + BigInt(fraction.slice(0, 2).padEnd(2, '0'));
  if (fraction.length > 2 && fraction.charCodeAt(2) >= 53) cents += BigInt(1);
  return match[1] ? -cents : cents;
}

/** `part ÷ whole` as a whole-number percentage ("27"), half up, as the mockup shows; null when whole is not positive. */
export function percentOf(part: string, whole: string): string | null {
  const p = stringToCents(part);
  const w = stringToCents(whole);
  if (w <= ZERO) return null;
  return String((p * TWO * HUNDRED + w) / (TWO * w)); // round(p / w * 100) half up, for p >= 0
}

/** `part ÷ whole` as a one-decimal percentage string ("26.7"), half up; null when whole is not positive. */
export function percentTenths(part: string, whole: string): string | null {
  const p = stringToCents(part);
  const w = stringToCents(whole);
  if (w <= ZERO) return null;
  const tenths = (p * TWO_THOUSAND + w) / (TWO * w);
  return `${tenths / TEN}.${tenths % TEN}`;
}

/** The exact sum of decimal strings, as a 2-dp decimal string (whole piasters, never float). */
export function sumDecimal(values: readonly string[]): string {
  const total = values.reduce((sum, v) => sum + stringToCents(v), ZERO);
  const negative = total < ZERO;
  const abs = negative ? -total : total;
  return `${negative ? '-' : ''}${abs / HUNDRED}.${String(abs % HUNDRED).padStart(2, '0')}`;
}

export function isPositive(value: string): boolean {
  return stringToCents(value) > ZERO;
}

// ---- deltas ---------------------------------------------------------------------------------

export type DeltaView = { text: string; direction: 'up' | 'down' | 'flat' | 'none'; tone: 'good' | 'bad' | 'neutral' };

/**
 * A "vs last month" chip. `null` is "—" (zero baseline). `goodWhenUp` is false for debt figures,
 * where a rise is bad news. The rate delta is in percentage points (`unit: 'pp'`).
 */
export function deltaView(value: string | null, goodWhenUp: boolean, unit: '%' | 'pp' = '%'): DeltaView {
  if (value === null) return { text: '—', direction: 'none', tone: 'neutral' };
  const negative = value.startsWith('-');
  const magnitude = negative ? value.slice(1) : value;
  if (/^0(\.0+)?$/.test(magnitude)) return { text: `0${unit === 'pp' ? ' pp' : '%'}`, direction: 'flat', tone: 'neutral' };
  const up = !negative;
  return {
    text: `${up ? '▲' : '▼'} ${magnitude}${unit === 'pp' ? ' pp' : '%'}`,
    direction: up ? 'up' : 'down',
    tone: up === goodWhenUp ? 'good' : 'bad',
  };
}

// ---- drilldown links ------------------------------------------------------------------------

export type FlatsLink = { building?: string; hasBalance?: boolean; overdueDays?: number; sort?: 'balance'; asOf?: string };

export function flatsHref(link: FlatsLink = {}): string {
  const query = new URLSearchParams();
  if (link.building) query.set('building', link.building);
  if (link.hasBalance !== undefined) query.set('hasBalance', String(link.hasBalance));
  if (link.overdueDays !== undefined) query.set('overdueDays', String(link.overdueDays));
  if (link.sort) query.set('sort', link.sort);
  if (link.asOf) query.set('asOf', link.asOf);
  const text = query.toString();
  return text ? `/finance/flats?${text}` : '/finance/flats';
}

// ---- attention cards ------------------------------------------------------------------------

export type AttentionCard =
  | { id: 'unapplied'; tone: 'warning'; href: string; count: number; total: string }
  | { id: 'over90'; tone: 'error'; href: string; amount: string; share: string | null }
  | { id: 'building'; tone: 'gold'; href: string; building: string; outstanding: string; owingFlats: number; totalFlats: number }
  | { id: 'cheques'; tone: 'info'; href: string; count: number; total: string }
  | { id: 'period'; tone: 'info'; href: string; period: string; status: string };

/** The building with the highest outstanding per flat (ties: code order); null when no debt. */
export function furthestBehind(buildings: readonly DashboardBuilding[]): DashboardBuilding | null {
  let best: DashboardBuilding | null = null;
  const sorted = [...buildings].sort((a, b) => a.building.localeCompare(b.building, 'en', { numeric: true }));
  for (const b of sorted) {
    if (b.totalFlats <= 0 || stringToCents(b.outstanding) <= ZERO) continue;
    if (!best) {
      best = b;
      continue;
    }
    // b.outstanding / b.totalFlats > best.outstanding / best.totalFlats, by cross-multiplication
    if (stringToCents(b.outstanding) * BigInt(best.totalFlats) > stringToCents(best.outstanding) * BigInt(b.totalFlats)) best = b;
  }
  return best;
}

/** The building with the highest outstanding (ties: code order); the map's initial selection. */
export function highestOutstanding(buildings: readonly DashboardBuilding[]): DashboardBuilding | null {
  const sorted = [...buildings].sort((a, b) => a.building.localeCompare(b.building, 'en', { numeric: true }));
  let best: DashboardBuilding | null = null;
  for (const b of sorted) if (!best || stringToCents(b.outstanding) > stringToCents(best.outstanding)) best = b;
  return best;
}

/** Rules of spec section 4.1. The fourth slot is pending cheques, else the period status. */
export function attentionCards(d: Dashboard): AttentionCard[] {
  const cards: AttentionCard[] = [];
  if (d.unapplied.count > 0) {
    cards.push({ id: 'unapplied', tone: 'warning', href: '/finance/payments', count: d.unapplied.count, total: d.unapplied.total });
  }
  if (isPositive(d.aging.over90)) {
    cards.push({
      id: 'over90',
      tone: 'error',
      // `overdueDays` alone filters flats with a charge 91+ days old, so a net-credit flat that still holds one stays listed.
      href: flatsHref({ overdueDays: 91, sort: 'balance', asOf: d.asOf }),
      amount: d.aging.over90,
      share: percentOf(d.aging.over90, d.outstanding),
    });
  }
  const behind = furthestBehind(d.byBuilding);
  if (behind) {
    cards.push({
      id: 'building',
      tone: 'gold',
      href: flatsHref({ building: behind.building, hasBalance: true, sort: 'balance', asOf: d.asOf }),
      building: behind.building,
      outstanding: behind.outstanding,
      owingFlats: behind.owingFlats,
      totalFlats: behind.totalFlats,
    });
  }
  if (d.pendingCheques.count > 0) {
    cards.push({ id: 'cheques', tone: 'info', href: '/finance/payments', count: d.pendingCheques.count, total: d.pendingCheques.total });
  } else {
    cards.push({ id: 'period', tone: 'info', href: '/finance/audit', period: d.period.period, status: d.period.status });
  }
  return cards;
}

// ---- period checklist -----------------------------------------------------------------------

export type CheckId = 'period' | 'preview' | 'charges' | 'unapplied' | 'cheques';
export type CheckItem = { id: CheckId; state: 'ok' | 'warn'; strong: boolean; href: string | null; count?: number };

/** Computed, advisory checks (spec 4.1 / Q3): `ok` or `warn`, never `fail`; strong warnings first. */
export function checklist(d: Dashboard): CheckItem[] {
  const preview = d.checks.previewBillingRuns + d.checks.previewImportBatches;
  return [
    { id: 'period', state: d.period.status !== 'OPEN' ? 'warn' : 'ok', strong: true, href: '/finance/audit' },
    { id: 'preview', state: preview > 0 ? 'warn' : 'ok', strong: true, href: null, count: preview },
    { id: 'charges', state: d.checks.operatingChargesInMonth === 0 ? 'warn' : 'ok', strong: false, href: '/finance/flats' },
    { id: 'unapplied', state: d.unapplied.count > 0 ? 'warn' : 'ok', strong: false, href: '/finance/payments', count: d.unapplied.count },
    { id: 'cheques', state: d.pendingCheques.count > 0 ? 'warn' : 'ok', strong: false, href: '/finance/payments', count: d.pendingCheques.count },
  ];
}

// ---- timeline -------------------------------------------------------------------------------

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(FINANCE_AUDIT_ACTIONS);

/** Translation key for an audit action. Unmapped actions get the generic label, never a raw code. */
export function timelineLabelKey(action: string): string {
  if (action === 'FUND_ENTRY_RECORDED') return 'finance.dashboard.tl_fund_deposit';
  if (KNOWN_ACTIONS.has(action)) return `finance.audit.actions.${action}`;
  return 'finance.dashboard.tl_generic';
}

export type TimelineKind = 'pay' | 'fund' | 'warn' | 'other';

export function timelineKind(action: string): TimelineKind {
  if (action === 'PAYMENT_RECORDED') return 'pay';
  if (action.startsWith('FUND_')) return 'fund';
  if (action.endsWith('_VOIDED') || action === 'CHEQUE_STATE_CHANGED') return 'warn';
  return 'other';
}

/** First day of the as-of month, `YYYY-MM-01`. */
export function monthStart(asOf: string): string {
  return `${asOf.slice(0, 7)}-01`;
}
