import { join } from 'node:path';

import {
    describeDb,
    FINANCE_MIGRATION,
    insertListing,
    insertUnit,
    insertUser,
    SCRIPTS_DIR,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';

const CATCHUP = join(SCRIPTS_DIR, 'finance-ownership-catchup.sql');
const INVARIANT = join(SCRIPTS_DIR, 'finance-ownership-invariant.sql');

/**
 * Slice 5 / review M2: the deploy-window drift (old code writing after the
 * migration) is repaired by the catch-up script, which is idempotent, and the
 * invariant script then reports all zeros. Skipped without TEST_DATABASE_URL.
 */
describeDb('finance ownership catch-up + invariant scripts (real Postgres)', () => {
    const dbs: ScratchDb[] = [];
    const migrated = (): ScratchDb => {
        const db = new ScratchDb(TEST_DATABASE_URL as string);
        dbs.push(db);
        db.applyAllBefore(FINANCE_MIGRATION);
        db.exec(
            [
                insertUser('keep'),
                insertUser('gone'),
                insertUser('mover'),
                insertUnit('ru_keep', 'keep', 'A1', '1', '1'),
                insertUnit('ru_gone', 'gone', 'A1', '1', '2'),
                insertUnit('ru_mover', 'mover', 'A1', '1', '3'),
            ].join('\n')
        );
        expect(db.applyMigration(FINANCE_MIGRATION).status).toBe(0);
        return db;
    };
    afterAll(() => dbs.forEach(d => d.drop()));

    const invariant = (db: ScratchDb): Record<string, number> => {
        const r = db.runFile(INVARIANT);
        expect(r.status).toBe(0);
        return Object.fromEntries(
            r.stdout
                .trim()
                .split('\n')
                .map(line => line.split('|'))
                .map(([k, n]) => [k, Number(n)])
        );
    };
    const allZero = (counts: Record<string, number>) =>
        Object.values(counts).every(n => n === 0);

    it('right after the migration the invariant holds', () => {
        const db = migrated();
        const counts = invariant(db);
        expect(Object.keys(counts)).toHaveLength(9);
        expect(allZero(counts)).toBe(true);
    });

    it('repairs old-code writes from the deploy window, then a second run changes nothing', () => {
        const db = migrated();
        // What the OLD code can do between migration commit and the new deploy:
        db.exec(
            [
                // path 1-3: new unit with no flatId and no period
                insertUser('new'),
                insertUnit('ru_new', 'new', 'b2', 'g', '5'),
                // path 5: soft delete without closing the period
                `UPDATE "users" SET "deletedAt" = CURRENT_TIMESTAMP WHERE "id" = 'gone';`,
                // re-key: text moved to another flat, flatId still on the old one
                `UPDATE "resident_units" SET "flatNumber" = '4' WHERE "id" = 'ru_mover';`,
                // new listing without flatId
                insertListing('l_new', 'keep', 'A1', '1', '1', 'PENDING'),
            ].join('\n')
        );
        expect(allZero(invariant(db))).toBe(false);

        const first = db.runFile(CATCHUP);
        expect(first.status).toBe(0);
        expect(first.stdout).toMatch(/1_closed_account_deleted\|1/);
        expect(first.stdout).toMatch(/0_units_unlinked_stale\|1/);
        expect(first.stdout).toMatch(/5_periods_opened\|2/);
        expect(allZero(invariant(db))).toBe(true);

        // Pre-go-live units open at the sentinel; the mover's old period is
        // EMPTY (a re-key is a typo repair, review L1).
        expect(
            db.scalar(
                `SELECT "closedReason" || ':' || ("toDate" = "fromDate") FROM "flat_ownerships" WHERE "userId" = 'mover' AND "toDate" IS NOT NULL`
            )
        ).toBe('REMOVED:true');
        expect(
            db.scalar(
                `SELECT f."label" FROM "flat_ownerships" fo JOIN "flats" f ON f.id = fo."flatId" WHERE fo."userId" = 'mover' AND fo."toDate" IS NULL`
            )
        ).toBe('A1-1-4');

        const second = db.runFile(CATCHUP);
        expect(second.status).toBe(0);
        expect(
            second.stdout
                .trim()
                .split('\n')
                .every(line => line.endsWith('|0'))
        ).toBe(true);
    });

    it('a unit created after go-live opens at its createdAt Cairo date', () => {
        const db = migrated();
        db.exec(
            [
                insertUser('late'),
                `INSERT INTO "resident_units" ("id","building","floor","flatNumber","userId","createdAt")
                 VALUES ('ru_late','C3','11','5','late', TIMESTAMP '2999-01-01 22:30:00');`,
            ].join('\n')
        );
        expect(db.runFile(CATCHUP).status).toBe(0);
        expect(
            db.scalar(
                `SELECT "fromDate"::text FROM "flat_ownerships" WHERE "userId" = 'late'`
            )
        ).toBe('2999-01-02');
    });

    it('a flat sold in the window closes on the buyer unit day, so periods never overlap (review L1)', () => {
        const db = migrated();
        db.exec(
            [
                `UPDATE "finance_settings" SET "value" = to_jsonb(to_char((CURRENT_TIMESTAMP - INTERVAL '5 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) WHERE "key" = 'finance.goLiveAt';`,
                `DELETE FROM "resident_units" WHERE "id" = 'ru_keep';`,
                insertUser('buyer'),
                `INSERT INTO "resident_units" ("id","building","floor","flatNumber","userId","createdAt")
                 VALUES ('ru_buyer','A1','1','1','buyer', CURRENT_TIMESTAMP - INTERVAL '2 days');`,
            ].join('\n')
        );
        expect(db.runFile(CATCHUP).status).toBe(0);
        expect(
            db.scalar(
                `SELECT (s."toDate" = b."fromDate")::text
                   FROM "flat_ownerships" s, "flat_ownerships" b
                  WHERE s."userId" = 'keep' AND b."userId" = 'buyer'`
            )
        ).toBe('true');
        expect(allZero(invariant(db))).toBe(true);
    });

    it('reports a listing whose flatId no longer matches its key', () => {
        const db = migrated();
        db.exec(
            [
                insertListing('l_stale', 'keep', 'A1', '1', '1', 'PENDING'),
                `UPDATE "listings" SET "flatId" = (SELECT "id" FROM "flats" WHERE "label" = 'A1-1-1') WHERE "id" = 'l_stale';`,
                `UPDATE "listings" SET "flatNumber" = '2' WHERE "id" = 'l_stale';`,
            ].join('\n')
        );
        expect(invariant(db).listing_stale_link).toBe(1);
        expect(db.runFile(CATCHUP).status).toBe(0);
        expect(invariant(db).listing_stale_link).toBe(0);
    });

    it('refuses to run when finance_foundations is not applied', () => {
        const db = new ScratchDb(TEST_DATABASE_URL as string);
        dbs.push(db);
        db.applyAllBefore(FINANCE_MIGRATION);
        const r = db.runFile(CATCHUP);
        expect(r.status).not.toBe(0);
    });
});
