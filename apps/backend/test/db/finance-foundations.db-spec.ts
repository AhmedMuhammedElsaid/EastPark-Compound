import {
    describeDb,
    FINANCE_MIGRATION,
    insertListing,
    insertUnit,
    insertUser,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';

/**
 * Runs the real migration SQL on scratch databases (migrations before
 * finance_foundations are applied first, fixtures are inserted, then the finance
 * migration runs). Skipped without TEST_DATABASE_URL; not part of the default jest run.
 */
describeDb('finance_foundations migration (real Postgres)', () => {
    const dbs: ScratchDb[] = [];
    const fresh = (): ScratchDb => {
        const db = new ScratchDb(TEST_DATABASE_URL as string);
        dbs.push(db);
        db.applyAllBefore(FINANCE_MIGRATION);
        return db;
    };
    afterAll(() => dbs.forEach(d => d.drop()));

    it('seeds exactly 690 flats with unique labels and sane phases', () => {
        const db = fresh();
        expect(db.applyMigration(FINANCE_MIGRATION).status).toBe(0);
        expect(db.scalar('SELECT COUNT(*) FROM "flats"')).toBe('690');
        expect(db.scalar('SELECT COUNT(DISTINCT "label") FROM "flats"')).toBe(
            '690'
        );
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM "flats" WHERE "phase" = 'phase-2' AND "floor" = 'G'`
            )
        ).toBe('90');
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM "flats" WHERE "phase" IN ('phase-1','phase-4') AND "floor" = 'G'`
            )
        ).toBe('0');
        expect(db.scalar('SELECT COUNT(*) FROM "finance_categories"')).toBe(
            '16'
        );
        expect(db.scalar('SELECT COUNT(*) FROM "finance_settings"')).toBe('3');
    });

    it('enables RLS on all 14 new tables', () => {
        const db = fresh();
        db.applyMigration(FINANCE_MIGRATION);
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname IN ('flats','flat_ownerships','finance_categories',
                  'fee_schedules','billing_runs','charges','payments','payment_allocations','receipt_counters',
                  'fiscal_periods','finance_settings','import_batches','import_rows','fund_entries')
                    AND c.relrowsecurity`
            )
        ).toBe('14');
    });

    it('aborts, and rolls back, when two resident_units collide after normalisation', () => {
        const db = fresh();
        db.exec(
            [
                insertUser('u1'),
                insertUser('u2'),
                insertUnit('ru1', 'u1', 'a1', '3', '2'),
                insertUnit('ru2', 'u2', ' A1 ', '3', '2'),
            ].join('\n')
        );
        const r = db.applyMigration(FINANCE_MIGRATION);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/collision group/);
        expect(db.scalar(`SELECT to_regclass('public.flats') IS NULL`)).toBe(
            't'
        );
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'resident_units' AND column_name = 'flatId'`
            )
        ).toBe('0');
    });

    it('raises only a NOTICE for unknown keys and leaves flatId NULL (units and listings)', () => {
        const db = fresh();
        db.exec(
            [
                insertUser('u1'),
                insertUnit('ru1', 'u1', 'Building A', '3', '2'),
                insertListing('l1', 'u1', 'Z9', '1', '1'),
                insertListing('l2', 'u1', 'Z9', '1', '1', 'PENDING'),
            ].join('\n')
        );
        const r = db.applyMigration(FINANCE_MIGRATION);
        expect(r.status).toBe(0);
        expect(r.stderr).toMatch(/unknown flat key/);
        expect(
            db.scalar(
                `SELECT "flatId" IS NULL FROM "resident_units" WHERE "id" = 'ru1'`
            )
        ).toBe('t');
        expect(
            db.scalar(`SELECT COUNT(*) FROM "listings" WHERE "flatId" IS NULL`)
        ).toBe('2');
        expect(db.scalar('SELECT COUNT(*) FROM "flat_ownerships"')).toBe('0');
    });

    it('does not assert uniqueness on listings (colliding after normalisation is fine)', () => {
        const db = fresh();
        db.exec(
            [
                insertUser('u1'),
                insertListing('l1', 'u1', 'a1', '1', '1', 'APPROVED'),
                insertListing('l2', 'u1', 'A1', '1', '1', 'WITHDRAWN'),
                insertListing('l3', 'u1', ' A1', '1', '1', 'EXPIRED'),
            ].join('\n')
        );
        expect(db.applyMigration(FINANCE_MIGRATION).status).toBe(0);
        expect(
            db.scalar(`SELECT COUNT(DISTINCT "flatId") FROM "listings"`)
        ).toBe('1');
    });

    it('links normalised keys (tab and space padded) and opens a 1900-01-01 period per live owner', () => {
        const db = fresh();
        db.exec(
            [
                insertUser('u1'),
                insertUser('u2'),
                insertUnit('ru1', 'u1', 'a1', '3', '2'),
                insertUnit('ru2', 'u1', '\t c3 ', '11', ' 5'),
                insertUnit('ru3', 'u2', 'F2', '1', '1'),
            ].join('\n')
        );
        expect(db.applyMigration(FINANCE_MIGRATION).status).toBe(0);
        expect(
            db.scalar(
                `SELECT f."label" FROM "resident_units" ru JOIN "flats" f ON f.id = ru."flatId" WHERE ru.id = 'ru1'`
            )
        ).toBe('A1-3-2');
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM "resident_units" WHERE "flatId" IS NOT NULL`
            )
        ).toBe('3');
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM "flat_ownerships" WHERE "toDate" IS NULL AND "fromDate" = DATE '1900-01-01'`
            )
        ).toBe('3');
        expect(db.scalar(`SELECT COUNT(*) FROM "flat_ownerships"`)).toBe('3');
    });

    it('gives a soft-deleted user a linked unit but no ownership period', () => {
        const db = fresh();
        db.exec(
            [
                insertUser('live'),
                insertUser('gone', true),
                insertUnit('ru1', 'live', 'A1', '1', '1'),
                insertUnit('ru2', 'gone', 'A1', '1', '2'),
            ].join('\n')
        );
        expect(db.applyMigration(FINANCE_MIGRATION).status).toBe(0);
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM "resident_units" WHERE "flatId" IS NOT NULL`
            )
        ).toBe('2');
        expect(db.scalar(`SELECT "userId" FROM "flat_ownerships"`)).toBe(
            'live'
        );
    });

    it('keeps the two existing partial indexes and creates the four new ones', () => {
        const db = fresh();
        db.applyMigration(FINANCE_MIGRATION);
        const names = db
            .scalar(
                `SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes
                  WHERE indexname IN ('listings_active_unit_key','resident_leads_active_unit_key',
                  'flat_ownership_one_open','billing_runs_period_key',
                  'import_batches_committed_file_hash_key','import_rows_committed_flat_key')`
            )
            .split(',');
        expect(names).toHaveLength(6);
        expect(
            db.scalar(
                `SELECT COUNT(*) FROM pg_indexes WHERE indexdef ILIKE '%WHERE%' AND indexname IN ('flat_ownership_one_open','billing_runs_period_key','import_batches_committed_file_hash_key','import_rows_committed_flat_key')`
            )
        ).toBe('4');
    });

    it('enforces one open ownership period per flat and amount > 0', () => {
        const db = fresh();
        db.applyMigration(FINANCE_MIGRATION);
        db.exec(insertUser('u1'));
        const flat = db.scalar(`SELECT id FROM "flats" LIMIT 1`);
        const open = (id: string) =>
            db.exec(
                `INSERT INTO "flat_ownerships" ("id","fromDate","flatId","userId") VALUES ('${id}', CURRENT_DATE, '${flat}', 'u1')`
            );
        expect(open('o1').status).toBe(0);
        expect(open('o2').stderr).toMatch(/flat_ownership_one_open/);
        expect(
            db.exec(
                `UPDATE "flat_ownerships" SET "toDate" = CURRENT_DATE WHERE id = 'o1'`
            ).status
        ).toBe(0);
        expect(open('o3').status).toBe(0);
        // A period may be empty (toDate = fromDate) but never inverted.
        expect(
            db.exec(
                `UPDATE "flat_ownerships" SET "toDate" = CURRENT_DATE - 1 WHERE id = 'o1'`
            ).stderr
        ).toMatch(/flat_ownerships_dates_ordered/);
        const pay = db.exec(
            `INSERT INTO "payments" ("id","receiptNo","amount","method","requestKey","requestHash","receivedAt","flatId","createdById")
             VALUES ('p1','R-2026-000001',0,'CASH','k','h',CURRENT_DATE,'${flat}','u1')`
        );
        expect(pay.stderr).toMatch(/payments_amount_positive/);
    });
});
