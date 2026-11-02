import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COMPOUND_FLAT_KEYS } from 'src/common/finance/compound-layout';

const sql = readFileSync(
    join(
        __dirname,
        '../../prisma/migrations/20261102000000_finance_foundations/migration.sql'
    ),
    'utf8'
);
const code = sql
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n');
const checkSql = readFileSync(
    join(__dirname, '../../prisma/scripts/check-flat-keys.sql'),
    'utf8'
);

const NEW_TABLES = [
    'flats',
    'flat_ownerships',
    'finance_categories',
    'fee_schedules',
    'billing_runs',
    'charges',
    'payments',
    'payment_allocations',
    'receipt_counters',
    'fiscal_periods',
    'finance_settings',
    'import_batches',
    'import_rows',
    'fund_entries',
];

describe('finance_foundations migration (file-level)', () => {
    it('seeds exactly the 690 layout keys, in order', () => {
        const seed = code.slice(
            code.indexOf('INSERT INTO "flats"'),
            code.indexOf(') AS v(b, f, n, ph)')
        );
        const listed = [
            ...seed.matchAll(
                /\('([A-Z0-9]+)','(G|\d+)','(\d)','phase-(\d)'\)/g
            ),
        ];
        expect(listed.map(m => `${m[1]}|${m[2]}|${m[3]}`)).toEqual(
            COMPOUND_FLAT_KEYS.map(
                k => `${k.building}|${k.floor}|${k.flatNumber}`
            )
        );
        expect(listed).toHaveLength(690);
    });

    it('derives the phase like the layout (1 and 4 without a ground floor)', () => {
        const seed = code.slice(
            code.indexOf('INSERT INTO "flats"'),
            code.indexOf(') AS v(b, f, n, ph)')
        );
        const phaseOf = new Map<string, string>();
        for (const m of seed.matchAll(
            /\('([A-Z0-9]+)','(G|\d+)','\d','phase-(\d)'\)/g
        )) {
            const prev = phaseOf.get(m[1] as string);
            expect(prev === undefined || prev === m[3]).toBe(true);
            phaseOf.set(m[1] as string, m[3] as string);
        }
        expect([...phaseOf.entries()]).toEqual([
            ['A1', '1'],
            ['B1', '1'],
            ['C1', '1'],
            ['A2', '2'],
            ['B2', '2'],
            ['C2', '2'],
            ['D1', '3'],
            ['E1', '3'],
            ['F1', '3'],
            ['C3', '4'],
            ['E2', '4'],
            ['F2', '4'],
        ]);
    });

    it('creates all 14 tables with RLS enabled and no policy', () => {
        for (const t of NEW_TABLES) {
            expect(code).toContain(`CREATE TABLE "${t}"`);
            expect(code).toContain(
                `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`
            );
        }
        expect(code).not.toMatch(/CREATE\s+POLICY/i);
        expect(code.match(/CREATE TABLE /g)).toHaveLength(NEW_TABLES.length);
    });

    it('is additive: no drop, truncate or delete, only two nullable columns added', () => {
        expect(code).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM|RENAME)\b/i);
        const alters = [
            ...code.matchAll(
                /ALTER TABLE "(\w+)" ADD COLUMN\s+"(\w+)" ([A-Z]+)(.*);/g
            ),
        ].map(m => `${m[1]}.${m[2]} ${m[3]}${m[4]?.trim()}`);
        expect(alters).toEqual([
            'resident_units.flatId TEXT',
            'listings.flatId TEXT',
        ]);
    });

    it('links units and listings with SET NULL and indexes the columns', () => {
        expect(code).toMatch(
            /"resident_units_flatId_fkey" FOREIGN KEY \("flatId"\) REFERENCES "flats"\("id"\) ON DELETE SET NULL/
        );
        expect(code).toMatch(
            /"listings_flatId_fkey" FOREIGN KEY \("flatId"\) REFERENCES "flats"\("id"\) ON DELETE SET NULL/
        );
        expect(code).toContain('CREATE INDEX "resident_units_flatId_idx"');
        expect(code).toContain('CREATE INDEX "listings_flatId_idx"');
    });

    it('has no CASCADE delete on any finance foreign key', () => {
        expect(code).not.toMatch(/ON DELETE CASCADE/i);
    });

    it('never references ACCOUNTANT or adds an enum value', () => {
        expect(code).not.toMatch(/ACCOUNTANT/);
        expect(code).not.toMatch(/ALTER TYPE/i);
    });

    it('has CHECK (amount > 0) on every money table', () => {
        for (const t of [
            'charges',
            'payments',
            'payment_allocations',
            'fund_entries',
        ]) {
            expect(code).toMatch(
                new RegExp(
                    `ALTER TABLE "${t}" ADD CONSTRAINT "${t}_amount_positive" CHECK \\("amount" > 0\\)`
                )
            );
        }
    });

    it('asserts 690 flats and aborts on resident_units collisions, notice only for unknown keys', () => {
        expect(code).toMatch(/flat_count <> 690[\s\S]*RAISE EXCEPTION/);
        expect(code).toMatch(
            /collisions > 0 THEN\s+RAISE EXCEPTION[^;]*resident_units/
        );
        expect(code).toMatch(/RAISE NOTICE[^;]*resident_units/);
        expect(code).toMatch(/RAISE NOTICE[^;]*listing/);
        // Listings never get an exception.
        const exceptions = [...code.matchAll(/RAISE EXCEPTION '([^']*)'/g)].map(
            m => m[1]
        );
        expect(exceptions).toHaveLength(2);
        exceptions.forEach(m => expect(m).not.toMatch(/listing/i));
    });

    it('orders the collision assert before the seed and the backfill after it', () => {
        const at = (s: string) => code.indexOf(s);
        expect(at('resident_units key collision')).toBeLessThan(
            at('INSERT INTO "flats"')
        );
        expect(at('INSERT INTO "flats"')).toBeLessThan(
            at('UPDATE "resident_units"')
        );
        expect(at('UPDATE "resident_units"')).toBeLessThan(
            at('INSERT INTO "flat_ownerships"')
        );
    });

    it('normalises exactly like check-flat-keys.sql', () => {
        const ext = String.raw`E' \t\r\n'`;
        // Same expression text in both files.
        expect(checkSql).toContain(`upper(btrim("building", ${ext}))`);
        expect(checkSql).toContain(`btrim("flatNumber", ${ext})`);
        expect(code).toContain(`upper(btrim("building", ${ext}))`);
        expect(code).toContain(`upper(btrim("floor", ${ext}))`);
        expect(code).toContain(`btrim("flatNumber", ${ext})`);
        expect(code).toContain(`upper(btrim(ru."building", ${ext}))`);
        expect(code).toContain(`upper(btrim(l."building", ${ext}))`);
        // No plain one-argument btrim left behind.
        expect(code).not.toMatch(/btrim\("?\w*"?\)/);
    });

    it('backfills a 1900-01-01 open period only for linked units of non-deleted users', () => {
        const stmt = code.slice(code.indexOf('INSERT INTO "flat_ownerships"'));
        const insert = stmt.slice(0, stmt.indexOf(';'));
        expect(insert).toContain("DATE '1900-01-01'");
        expect(insert).toContain('"flatId" IS NOT NULL');
        expect(insert).toContain('u."deletedAt" IS NULL');
        expect(insert).not.toMatch(/"toDate"/);
    });

    it('seeds categories (10 expense, 6 revenue) and the three settings', () => {
        expect(code.match(/'EXPENSE', \d+, true/g)).toHaveLength(10);
        expect(code.match(/'REVENUE', \d+, true/g)).toHaveLength(6);
        expect(code).toContain("'expense.approvalThreshold', to_jsonb(5000)");
        expect(code).toContain("'fiscal.yearStartMonth', to_jsonb(1)");
        expect(code).toContain("'billing.defaultDueDay', to_jsonb(10)");
    });

    it('creates finance_live_payments with security_invoker and a guarded REVOKE', () => {
        expect(code).toMatch(
            /CREATE OR REPLACE VIEW public\.finance_live_payments WITH \(security_invoker = true\)/
        );
        const revokes = [...code.matchAll(/REVOKE[^;]*;/g)];
        expect(revokes).toHaveLength(1);
        const before = code.slice(0, revokes[0]?.index);
        const guard = before.slice(before.lastIndexOf('DO $$'));
        expect(guard).toMatch(/pg_roles WHERE rolname = 'anon'/);
        expect(guard).toMatch(/pg_roles WHERE rolname = 'authenticated'/);
        expect(guard).toMatch(/IF supabase_roles THEN\s*$/);
        // The view hides payer names and notes.
        const view = code.slice(
            code.indexOf('CREATE OR REPLACE VIEW'),
            code.indexOf('FROM public."payments" p')
        );
        expect(view).not.toMatch(/payerName|"note"|attachmentPath|requestKey/);
    });
});
