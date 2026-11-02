import { Prisma } from '@prisma/client';

import {
    FakeFinanceState,
    fakeFinanceState,
    fakeRaw,
} from './finance-raw.mock';

/*
 * In-memory Prisma stand-in for the finance services. It EVALUATES the
 * `where` objects the services and the kernel build (the operators the live
 * predicates use, relation filters, `AND`/`OR`, `in`, `contains`/`mode`), so
 * a wrong predicate fails a spec instead of being mocked away. Transactions
 * are serialised (a mutex models the flat row lock) and roll back on throw.
 */

export type Row = Record<string, unknown>;

const OPS = [
    'lte',
    'lt',
    'gte',
    'gt',
    'in',
    'equals',
    'contains',
    'endsWith',
    'mode',
];

function cmp(a: unknown, b: unknown): number {
    const x = a instanceof Date ? a.getTime() : a;
    const y = b instanceof Date ? b.getTime() : b;
    return (x as number) < (y as number)
        ? -1
        : (x as number) > (y as number)
          ? 1
          : 0;
}

function same(a: unknown, b: unknown, insensitive = false): boolean {
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    if (insensitive && typeof a === 'string' && typeof b === 'string')
        return a.toLowerCase() === b.toLowerCase();
    return a === b;
}

export function matches(row: Row | null | undefined, where: Row): boolean {
    if (!row) return false;
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'AND') return (cond as Row[]).every(w => matches(row, w));
        if (key === 'OR') return (cond as Row[]).some(w => matches(row, w));
        const value = row[key];
        if (cond === undefined) return true;
        if (cond === null) return value === null || value === undefined;
        if (typeof cond !== 'object' || cond instanceof Date)
            return same(value, cond);
        const ops = Object.keys(cond as Row);
        if (ops.length > 0 && ops.every(o => OPS.includes(o))) {
            if (value === null || value === undefined) return false;
            const c = cond as Row;
            const ci = c.mode === 'insensitive';
            if ('lte' in c && cmp(value, c.lte) > 0) return false;
            if ('lt' in c && cmp(value, c.lt) >= 0) return false;
            if ('gte' in c && cmp(value, c.gte) < 0) return false;
            if ('gt' in c && cmp(value, c.gt) <= 0) return false;
            if ('in' in c && !(c.in as unknown[]).some(v => same(value, v, ci)))
                return false;
            if ('equals' in c && !same(value, c.equals, ci)) return false;
            if ('contains' in c) {
                const hay = ci ? String(value).toLowerCase() : String(value);
                const needle = ci
                    ? String(c.contains).toLowerCase()
                    : String(c.contains);
                if (!hay.includes(needle)) return false;
            }
            if (
                'endsWith' in c &&
                !String(value).endsWith(String(c.endsWith))
            )
                return false;
            return true;
        }
        return matches(value as Row, cond as Row); // relation filter
    });
}

type Model =
    'payment' | 'charge' | 'paymentAllocation' | 'fundEntry' | 'flat' | 'user';

const ARRAY_RELATIONS: Partial<Record<Model, Record<string, Model>>> = {
    payment: { allocations: 'paymentAllocation', fundEntries: 'fundEntry' },
    charge: { allocations: 'paymentAllocation' },
};
const SINGLE_RELATIONS: Partial<Record<Model, Record<string, Model>>> = {
    payment: { flat: 'flat', createdBy: 'user', voidedBy: 'user' },
    charge: { flat: 'flat', createdBy: 'user', voidedBy: 'user' },
    paymentAllocation: { charge: 'charge', payment: 'payment' },
    fundEntry: { payment: 'payment' },
};
const FOREIGN_KEYS: Record<string, string> = {
    flat: 'flatId',
    createdBy: 'createdById',
    voidedBy: 'voidedById',
    charge: 'chargeId',
    payment: 'paymentId',
};

function sortRows(rows: Row[], orderBy: unknown): Row[] {
    if (!orderBy) return rows;
    const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<
        string,
        'asc' | 'desc'
    >[];
    return [...rows].sort((a, b) => {
        for (const k of keys) {
            const [field, dir] = Object.entries(k)[0] as [string, string];
            const c = cmp(a[field], b[field]);
            if (c !== 0) return dir === 'desc' ? -c : c;
        }
        return 0;
    });
}

export interface LedgerState {
    raw: FakeFinanceState;
    charges: Row[];
    payments: Row[];
    allocations: Row[];
    fundEntries: Row[];
    audits: Row[];
    settings: Map<string, unknown>;
    users: Map<string, { id: string; name: string }>;
}

export function emptyLedger(): LedgerState {
    return {
        raw: fakeFinanceState(),
        charges: [],
        payments: [],
        allocations: [],
        fundEntries: [],
        audits: [],
        settings: new Map(),
        users: new Map([
            ['acc-1', { id: 'acc-1', name: 'Mona' }],
            ['acc-2', { id: 'acc-2', name: 'Karim' }],
            ['adm-1', { id: 'adm-1', name: 'Admin' }],
        ]),
    };
}

const p2002 = (target: string) =>
    Object.assign(new Error(`Unique constraint failed on ${target}`), {
        code: 'P2002',
    });

/**
 * A fake `DatabaseService` over `state`. `failAudit` makes the next audit
 * insert throw (the whole transaction must roll back).
 */
export class FakeFinanceDb {
    failAudit = false;
    /** Runs at the start of every transaction (simulate concurrent writers). */
    onTransaction?: () => void;
    private seq = 0;
    private clock = Date.now() - 60_000;
    private queue: Promise<unknown> = Promise.resolve();
    readonly $queryRaw;
    readonly $executeRaw;

    constructor(readonly state: LedgerState = emptyLedger()) {
        const raw = fakeRaw(state.raw);
        this.$queryRaw = raw.$queryRaw;
        this.$executeRaw = raw.$executeRaw;
    }

    private table(model: Model): Row[] {
        switch (model) {
            case 'payment':
                return this.state.payments;
            case 'charge':
                return this.state.charges;
            case 'paymentAllocation':
                return this.state.allocations;
            case 'fundEntry':
                return this.state.fundEntries;
            case 'flat':
                return [...this.state.raw.flats.values()] as unknown as Row[];
            case 'user':
                return [...this.state.users.values()] as unknown as Row[];
        }
    }

    private single(model: Model, row: Row, key: string): Row | null {
        const target = SINGLE_RELATIONS[model]?.[key] as Model;
        const fk = row[FOREIGN_KEYS[key] as string];
        return this.table(target).find(r => r.id === fk) ?? null;
    }

    private many(model: Model, row: Row, key: string): Row[] {
        const target = ARRAY_RELATIONS[model]?.[key] as Model;
        const fk = model === 'payment' ? 'paymentId' : 'chargeId';
        return this.table(target).filter(r => r[fk] === row.id);
    }

    /** The row plus its to-one relations (for relation filters). */
    private withRelations(model: Model, row: Row): Row {
        const out: Row = { ...row };
        for (const key of Object.keys(SINGLE_RELATIONS[model] ?? {}))
            out[key] = this.single(model, row, key);
        return out;
    }

    private project(model: Model, row: Row, select?: Row): Row {
        if (!select) return { ...row };
        const out: Row = {};
        for (const [key, spec] of Object.entries(select)) {
            if (spec === true) {
                out[key] = row[key];
                continue;
            }
            const sub = spec as {
                select?: Row;
                where?: Row;
                orderBy?: unknown;
            };
            const arrayTarget = ARRAY_RELATIONS[model]?.[key];
            if (arrayTarget) {
                let list = this.many(model, row, key);
                if (sub.where)
                    list = list.filter(r =>
                        matches(
                            this.withRelations(arrayTarget, r),
                            sub.where as Row
                        )
                    );
                list = sortRows(list, sub.orderBy);
                out[key] = list.map(r =>
                    this.project(arrayTarget, r, sub.select)
                );
                continue;
            }
            const singleTarget = SINGLE_RELATIONS[model]?.[key];
            if (singleTarget) {
                const rel = this.single(model, row, key);
                out[key] = rel
                    ? this.project(singleTarget, rel, sub.select)
                    : null;
            }
        }
        return out;
    }

    private find(model: Model, where: Row = {}): Row[] {
        return this.table(model).filter(r =>
            matches(this.withRelations(model, r), where)
        );
    }

    private findMany(model: Model, args: Row = {}): Row[] {
        let rows = sortRows(this.find(model, args.where as Row), args.orderBy);
        const cursor = args.cursor as { id: string } | undefined;
        if (cursor) {
            const i = rows.findIndex(r => r.id === cursor.id);
            rows = i < 0 ? [] : rows.slice(i + 1);
        }
        if (typeof args.take === 'number') rows = rows.slice(0, args.take);
        return rows.map(r => this.project(model, r, args.select as Row));
    }

    private nextId(prefix: string): string {
        this.seq += 1;
        return `${prefix}-${this.seq}`;
    }

    private now(): Date {
        this.clock += 10;
        return new Date(this.clock);
    }

    private delegate(model: Model, defaults: () => Row, unique: string[][]) {
        const table = () => this.table(model);
        return {
            findUnique: async (args: { where: Row; select?: Row }) => {
                const row = this.find(model, args.where)[0];
                return row ? this.project(model, row, args.select) : null;
            },
            findUniqueOrThrow: async (args: { where: Row; select?: Row }) => {
                const row = this.find(model, args.where)[0];
                if (!row) throw new Error('not found');
                return this.project(model, row, args.select);
            },
            findFirst: async (args: Row) =>
                this.findMany(model, { ...args, take: 1 })[0] ?? null,
            findMany: async (args: Row = {}) => this.findMany(model, args),
            count: async (args: { where?: Row } = {}) =>
                this.find(model, args.where).length,
            create: async (args: { data: Row; select?: Row }) => {
                const row: Row = {
                    id: this.nextId(model),
                    createdAt: this.now(),
                    ...defaults(),
                    ...args.data,
                };
                for (const fields of unique) {
                    if (
                        table().some(r => fields.every(f => same(r[f], row[f])))
                    )
                        throw p2002(fields.join(','));
                }
                table().push(row);
                return this.project(model, row, args.select);
            },
            update: async (args: { where: Row; data: Row; select?: Row }) => {
                const row = this.find(model, args.where)[0];
                if (!row) throw new Error('not found');
                Object.assign(row, args.data);
                return this.project(model, row, args.select);
            },
            updateMany: async (args: { where: Row; data: Row }) => {
                const rows = this.find(model, args.where);
                for (const row of rows) Object.assign(row, args.data);
                return { count: rows.length };
            },
            groupBy: async (args: { where: Row }) => {
                const sums = new Map<string, Prisma.Decimal>();
                for (const p of this.find(model, args.where)) {
                    const flatId = p.flatId as string;
                    sums.set(
                        flatId,
                        (sums.get(flatId) ?? new Prisma.Decimal(0)).add(
                            p.amount as Prisma.Decimal
                        )
                    );
                }
                return [...sums].map(([flatId, amount]) => ({
                    flatId,
                    _sum: { amount },
                }));
            },
        };
    }

    readonly payment = this.delegate(
        'payment',
        () => ({
            status: 'POSTED',
            chequeState: 'NOT_APPLICABLE',
            clearedAt: null,
            bouncedAt: null,
            isOpening: false,
            voidedAt: null,
            voidedById: null,
            voidReason: null,
            reference: null,
            payerName: null,
            note: null,
            attachmentPath: null,
            replacesId: null,
        }),
        [['requestKey'], ['receiptNo']]
    );

    readonly charge = this.delegate(
        'charge',
        () => ({
            status: 'POSTED',
            voidedAt: null,
            voidedById: null,
            voidReason: null,
            billingRunId: null,
            replacesId: null,
            fundContribution: false,
        }),
        []
    );

    readonly paymentAllocation = this.delegate(
        'paymentAllocation',
        () => ({ voidedAt: null, voidedById: null, voidReason: null }),
        [['paymentId', 'chargeId']]
    );

    readonly fundEntry = this.delegate(
        'fundEntry',
        () => ({
            status: 'POSTED',
            voidedAt: null,
            voidedById: null,
            voidReason: null,
            holding: 'CASH',
            countsInFundTotal: true,
        }),
        [['requestKey'], ['entryNo']]
    );

    readonly auditLog = {
        create: async (args: { data: Row }) => {
            if (this.failAudit) throw new Error('audit insert failed');
            this.state.audits.push(args.data);
            return { id: this.nextId('audit') };
        },
    };

    readonly financeSetting = {
        findUnique: async (args: { where: { key: string } }) =>
            this.state.settings.has(args.where.key)
                ? { value: this.state.settings.get(args.where.key) }
                : null,
    };

    /** Serialised, all-or-nothing (a throw restores every table). */
    $transaction<T>(cb: (tx: this) => Promise<T>): Promise<T> {
        const run = async (): Promise<T> => {
            this.onTransaction?.(); // a concurrent writer that committed first
            const snapshot = this.snapshot();
            try {
                return await cb(this);
            } catch (error) {
                this.restore(snapshot);
                throw error;
            }
        };
        const next = this.queue.then(run, run);
        this.queue = next.catch(() => undefined);
        return next;
    }

    private snapshot() {
        const copy = (rows: Row[]) => rows.map(r => ({ ...r }));
        return {
            charges: copy(this.state.charges),
            payments: copy(this.state.payments),
            allocations: copy(this.state.allocations),
            fundEntries: copy(this.state.fundEntries),
            audits: copy(this.state.audits),
            periods: new Map(this.state.raw.periods),
            counters: new Map(this.state.raw.counters),
        };
    }

    private restore(s: ReturnType<FakeFinanceDb['snapshot']>): void {
        this.state.charges.splice(0, Infinity, ...s.charges);
        this.state.payments.splice(0, Infinity, ...s.payments);
        this.state.allocations.splice(0, Infinity, ...s.allocations);
        this.state.fundEntries.splice(0, Infinity, ...s.fundEntries);
        this.state.audits.splice(0, Infinity, ...s.audits);
        this.state.raw.periods = s.periods;
        this.state.raw.counters = s.counters;
    }
}
