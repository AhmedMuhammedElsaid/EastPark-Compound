import { BUILDINGS } from '@/config/compound';

/** The flats-list filters a dashboard drilldown can pre-set through the URL (slice 9, 3.3). */
export type FlatsFilters = {
  hasBalance?: 'true' | 'false';
  overdueDays?: string;
  building?: string;
  sort?: 'balance';
  asOf?: string;
};

/** `30 / 60 / 90` are the select's options; `91` ("over 90") is what the dashboard card links to. */
export const OVERDUE_OPTIONS = ['30', '60', '90', '91'] as const;

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/** Reads the URL's query into validated filters; anything unknown is dropped, never relayed. */
export function parseFlatsParams(params: Params): FlatsFilters {
  const hasBalance = one(params.hasBalance);
  const overdueDays = one(params.overdueDays);
  const building = one(params.building);
  const asOf = one(params.asOf);
  return {
    hasBalance: hasBalance === 'true' || hasBalance === 'false' ? hasBalance : undefined,
    overdueDays: overdueDays && (OVERDUE_OPTIONS as readonly string[]).includes(overdueDays) ? overdueDays : undefined,
    building: building && BUILDINGS.some((item) => item.value === building) ? building : undefined,
    sort: one(params.sort) === 'balance' ? 'balance' : undefined,
    asOf: asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : undefined,
  };
}

/** The component's starting state for a set of URL filters (phase follows the building). */
export function initialFlatsState(initial: FlatsFilters) {
  const building = initial.building ?? '';
  return {
    building,
    phase: building ? (BUILDINGS.find((item) => item.value === building)?.phase ?? '') : '',
    owes: (initial.hasBalance ?? '') as '' | 'true' | 'false',
    overdue: initial.overdueDays ?? '',
    sort: initial.sort,
    asOf: initial.asOf,
  };
}
