import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real-database test helper (no pg driver in the repo): drives the `psql` binary
 * (override with PSQL_BIN) against a scratch database created from
 * TEST_DATABASE_URL. Specs are skipped when TEST_DATABASE_URL is unset, and they
 * are not matched by the default jest config (`*.spec.ts` only). Run them with
 * `pnpm test:db` against a local docker Postgres, never against a shared or prod
 * database: the helper creates and drops its own `ff_test_*` databases.
 */
export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
export const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const PSQL = process.env['PSQL_BIN'] ?? 'psql';
export const MIGRATIONS_DIR = join(__dirname, '../../prisma/migrations');
export const FINANCE_MIGRATION = '20261102000000_finance_foundations';

export interface PsqlResult {
    status: number;
    stdout: string;
    stderr: string;
}

function withDatabase(url: string, db: string): string {
    const u = new URL(url);
    u.pathname = `/${db}`;
    // Prisma-only query params (schema=, pgbouncer=) are not valid for psql.
    u.search = '';
    return u.toString();
}

export function psql(url: string, args: string[], input?: string): PsqlResult {
    const r = spawnSync(
        PSQL,
        ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', url, ...args],
        { encoding: 'utf8', input }
    );
    if (r.error) throw r.error;
    return {
        status: r.status ?? 1,
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
    };
}

/** All migration folders sorted, optionally stopping before `stopBefore`. */
export function migrationFolders(stopBefore?: string): string[] {
    const all = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    return stopBefore ? all.filter(n => n < stopBefore) : all;
}

export class ScratchDb {
    readonly name = `ff_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    readonly url: string;
    private readonly adminUrl: string;

    constructor(baseUrl: string) {
        this.adminUrl = withDatabase(baseUrl, 'postgres');
        this.url = withDatabase(baseUrl, this.name);
        const r = psql(this.adminUrl, ['-c', `CREATE DATABASE "${this.name}"`]);
        if (r.status !== 0) throw new Error(`create db failed: ${r.stderr}`);
    }

    /** Apply migrations in one transaction each; returns the failing result, if any. */
    applyMigration(folder: string): PsqlResult {
        return psql(this.url, [
            '-1',
            '-f',
            join(MIGRATIONS_DIR, folder, 'migration.sql'),
        ]);
    }

    applyAllBefore(stopBefore: string): void {
        for (const f of migrationFolders(stopBefore)) {
            const r = this.applyMigration(f);
            if (r.status !== 0) throw new Error(`${f} failed: ${r.stderr}`);
        }
    }

    exec(sql: string): PsqlResult {
        return psql(this.url, ['-c', sql]);
    }

    /** Single scalar / one-line result. */
    scalar(sql: string): string {
        const r = psql(this.url, ['-t', '-A', '-c', sql]);
        if (r.status !== 0) throw new Error(`query failed: ${r.stderr}`);
        return r.stdout.trim();
    }

    drop(): void {
        psql(this.adminUrl, [
            '-c',
            `DROP DATABASE IF EXISTS "${this.name}" WITH (FORCE)`,
        ]);
    }
}

export const insertUser = (id: string, deleted = false): string =>
    `INSERT INTO "users" ("id","name","email","passwordHash","updatedAt","deletedAt") ` +
    `VALUES ('${id}','n','${id}@t.test','x',CURRENT_TIMESTAMP,${deleted ? 'CURRENT_TIMESTAMP' : 'NULL'});`;

export const insertUnit = (
    id: string,
    userId: string,
    building: string,
    floor: string,
    flatNumber: string
): string =>
    `INSERT INTO "resident_units" ("id","building","floor","flatNumber","userId") ` +
    `VALUES ('${id}','${building}','${floor}','${flatNumber}','${userId}');`;

export const insertListing = (
    id: string,
    ownerId: string,
    building: string,
    floor: string,
    flatNumber: string,
    status = 'APPROVED'
): string =>
    `INSERT INTO "listings" ("id","type","status","building","floor","flatNumber","price","areaSqm",` +
    `"bedrooms","bathrooms","furnished","contactPhone","photos","updatedAt","ownerId") ` +
    `VALUES ('${id}','SALE','${status}','${building}','${floor}','${flatNumber}',1,1,1,1,false,'0','{}',CURRENT_TIMESTAMP,'${ownerId}');`;
