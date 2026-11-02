/**
 * In-memory stand-in for the raw SQL the finance kernel runs (period, flat and
 * charge locks, the receipt counter). Recognises statements by table name and
 * logs them in order, so specs can assert the lock order.
 */
export interface FakeFinanceState {
    periods: Map<string, 'OPEN' | 'CLOSED'>;
    flats: Map<string, { id: string; label: string; isActive: boolean }>;
    counters: Map<string, number>;
    log: string[];
}

interface SqlLike {
    sql?: string;
    values?: unknown[];
}

const textOf = (q: unknown): string => (q as SqlLike).sql ?? '';
const valuesOf = (q: unknown): unknown[] => (q as SqlLike).values ?? [];

export function fakeFinanceState(
    partial: Partial<FakeFinanceState> = {}
): FakeFinanceState {
    return {
        periods: new Map(),
        flats: new Map([
            ['flat-1', { id: 'flat-1', label: 'A1-3-2', isActive: true }],
        ]),
        counters: new Map(),
        log: [],
        ...partial,
    };
}

/** `$queryRaw` / `$executeRaw` mocks bound to `state`. */
export function fakeRaw(state: FakeFinanceState) {
    const $executeRaw = jest.fn(async (q: unknown) => {
        const text = textOf(q);
        const values = valuesOf(q);
        if (text.includes('INSERT INTO "fiscal_periods"')) {
            const period = String(values[0]);
            state.log.push(`upsert-period:${period}`);
            if (!state.periods.has(period)) state.periods.set(period, 'OPEN');
        }
        if (text.includes('pg_advisory_xact_lock'))
            state.log.push(`advisory:${String(values[0])}`);
        return 1;
    });
    const $queryRaw = jest.fn(async (q: unknown) => {
        const text = textOf(q);
        const values = valuesOf(q);
        if (text.includes('FROM "fiscal_periods"')) {
            const period = String(values[0]);
            state.log.push(`lock-period:${period}`);
            const status = state.periods.get(period);
            return status ? [{ status }] : [];
        }
        if (text.includes('FROM "flats"')) {
            const id = String(values[0]);
            state.log.push(`lock-flat:${id}`);
            const flat = state.flats.get(id);
            return flat ? [flat] : [];
        }
        if (text.includes('FROM "charges"')) {
            state.log.push(`lock-charges:${values.join(',')}`);
            return values.map(id => ({ id }));
        }
        if (text.includes('"receipt_counters"')) {
            const [scope, year, count] = values as [string, number, number];
            const key = `${scope}:${year}`;
            const last = (state.counters.get(key) ?? 0) + count;
            state.counters.set(key, last);
            state.log.push(`counter:${key}+${count}`);
            return [{ last }];
        }
        return [];
    });
    return { $executeRaw, $queryRaw };
}
