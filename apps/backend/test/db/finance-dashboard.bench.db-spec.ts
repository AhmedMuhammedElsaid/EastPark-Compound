import { Prisma, PrismaClient } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { FinanceDashboardService } from 'src/modules/finance/finance-dashboard.service';

import { insertUser, ScratchDb, TEST_DATABASE_URL } from './db-helper';

/**
 * Slice 9 benchmark (opt-in: TEST_DATABASE_URL and FINANCE_BENCH=1). Seeds
 * the 690 migrated flats with 24 months of ledger (a 450 charge per flat per
 * month, ~90% paid and allocated across all four methods, ~1% of cheques
 * bounced, ~0.5% of payments voided, monthly fund rows), then times the whole
 * endpoint path (one REPEATABLE READ transaction, queries in sequence on one
 * connection) and prints EXPLAIN ANALYZE timings and any sequential scan per
 * query. Numbers go into the slice 9 review, not into assertions (only a
 * generous ceiling is asserted).
 */
const describeBench =
    TEST_DATABASE_URL && process.env['FINANCE_BENCH'] === '1'
        ? describe
        : describe.skip;

const SEED = `
INSERT INTO "charges" ("id","kind","amount","description","descriptionAr","accrualPeriod","dueDate","status","fundContribution","flatId","createdById")
SELECT 'bc_' || f."id" || '_' || m, 'SERVICE_CHARGE'::"ChargeKind", 450, 'x', 'x', to_char(x.d, 'YYYY-MM'), x.d + 9,
       'POSTED'::"PostingStatus", false, f."id", 'acc_bench'
  FROM "flats" f CROSS JOIN generate_series(0, 23) m
 CROSS JOIN LATERAL (SELECT (date '2024-11-01' + make_interval(months => m))::date AS d) x;

INSERT INTO "payments" ("id","receiptNo","amount","method","requestKey","requestHash","chequeState","bouncedAt","receivedAt","status","voidedAt","flatId","createdById")
SELECT 'bp_' || f."id" || '_' || m, 'B-' || f."id" || '-' || m, 450,
       (ARRAY['CASH','BANK_TRANSFER','INSTAPAY','CHEQUE'])[1 + abs(hashtext(f."id" || m)) % 4]::"FinancePaymentMethod",
       'rk-b-' || f."id" || '-' || m, 'h',
       CASE WHEN abs(hashtext(f."id" || m)) % 4 = 3
            THEN (CASE WHEN abs(hashtext('b' || f."id" || m)) % 100 = 0 THEN 'BOUNCED' ELSE 'CLEARED' END)
            ELSE 'NOT_APPLICABLE' END::"ChequeState",
       CASE WHEN abs(hashtext(f."id" || m)) % 4 = 3 AND abs(hashtext('b' || f."id" || m)) % 100 = 0 THEN x.d + 20 END,
       x.d + 5,
       CASE WHEN abs(hashtext('v' || f."id" || m)) % 200 = 0 THEN 'VOID' ELSE 'POSTED' END::"PostingStatus",
       CASE WHEN abs(hashtext('v' || f."id" || m)) % 200 = 0 THEN (x.d + 6)::timestamp + interval '10 hours' END,
       f."id", 'acc_bench'
  FROM "flats" f CROSS JOIN generate_series(0, 23) m
 CROSS JOIN LATERAL (SELECT (date '2024-11-01' + make_interval(months => m))::date AS d) x
 WHERE abs(hashtext('p' || f."id" || m)) % 10 <> 0;

INSERT INTO "payment_allocations" ("id","amount","allocatedAt","voidedAt","paymentId","chargeId","createdById")
SELECT 'ba_' || substr(p."id", 4), 450, p."receivedAt",
       CASE WHEN p."bouncedAt" IS NOT NULL THEN p."bouncedAt"::timestamp - interval '2 hours'
            WHEN p."status" = 'VOID' THEN p."voidedAt" END,
       p."id", 'bc_' || substr(p."id", 4), 'acc_bench'
  FROM "payments" p WHERE p."id" LIKE 'bp_%';

INSERT INTO "fund_entries" ("id","entryNo","requestKey","requestHash","kind","direction","amount","entryDate","description","createdById")
SELECT 'bf_' || m || '_' || k, 'BF-' || m || '-' || k, 'rk-bf-' || m || '-' || k, 'h',
       (CASE k WHEN 0 THEN 'DEPOSIT_IN' ELSE 'MAINTENANCE_OUT' END)::"FundEntryKind",
       (CASE k WHEN 0 THEN 'IN' ELSE 'OUT' END)::"EntryDirection",
       CASE k WHEN 0 THEN 25000 ELSE 9000 END,
       (date '2024-11-01' + make_interval(months => m))::date + 15, 'x', 'acc_bench'
  FROM generate_series(0, 23) m CROSS JOIN generate_series(0, 1) k;

ANALYZE;
`;

describeBench('finance dashboard benchmark (690 flats x 24 months)', () => {
    let scratch: ScratchDb;
    let db: PrismaClient;

    beforeAll(() => {
        scratch = new ScratchDb(TEST_DATABASE_URL as string);
        scratch.applyAllBefore('99999999999999_end');
        scratch.exec(insertUser('acc_bench'));
        const r = scratch.exec(SEED);
        if (r.status !== 0) throw new Error(r.stderr);
        db = new PrismaClient({ datasourceUrl: scratch.url });
    });

    afterAll(async () => {
        await db?.$disconnect();
        scratch?.drop();
    });

    it('times the endpoint and explains every query', async () => {
        const counts = scratch.scalar(
            `SELECT (SELECT count(*) FROM charges) || ' charges, ' || (SELECT count(*) FROM payments) || ' payments, ' || (SELECT count(*) FROM payment_allocations) || ' allocations'`
        );
        const service = new FinanceDashboardService(
            db as unknown as DatabaseService
        );
        const runs: number[] = [];
        for (let i = 0; i < 12; i += 1) {
            const t = Date.now();
            await service.dashboard({ asOf: '2026-10-31', months: 12 });
            runs.push(Date.now() - t);
        }
        const sorted = [...runs].slice(2).sort((a, b) => a - b);
        const pct = (p: number) =>
            sorted[
                Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
            ];

        // EXPLAIN ANALYZE every raw query the endpoint runs, in order.
        const plans: string[] = [];
        const explaining = new Proxy(db, {
            get(target, key, receiver) {
                const value = Reflect.get(target, key, receiver);
                if (key !== '$queryRaw') return value;
                return async (q: Prisma.Sql) => {
                    const rows = await target.$queryRawUnsafe<
                        { 'QUERY PLAN': string }[]
                    >(`EXPLAIN (ANALYZE, BUFFERS) ${q.text}`, ...q.values);
                    const lines = rows.map(r => r['QUERY PLAN']);
                    const seq = lines
                        .filter(l => l.includes('Seq Scan'))
                        .map(l => l.trim().replace(/\s+\(cost.*$/, ''));
                    const exec = lines.find(l =>
                        l.startsWith('Execution Time')
                    );
                    if (process.env['FINANCE_BENCH_PLANS'] === '1')
                        console.log(lines.join(String.fromCharCode(10)));
                    plans.push(
                        `#${plans.length + 1} ${exec ?? ''} | seq scans: ${[...new Set(seq)].join('; ') || 'none'}`
                    );
                    return (value as (x: Prisma.Sql) => Promise<unknown>).call(
                        target,
                        q
                    );
                };
            },
        });
        await service.build(
            explaining as unknown as PrismaClient,
            new Date('2026-10-31T00:00:00.000Z'),
            12
        );

        console.log(
            [
                `seeded: ${counts}`,
                `endpoint ms (12 runs, first 2 dropped): ${runs.join(', ')}`,
                `p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms`,
                ...plans,
            ].join('\n')
        );
        expect(pct(0.95)).toBeLessThan(5000);
    });
});
