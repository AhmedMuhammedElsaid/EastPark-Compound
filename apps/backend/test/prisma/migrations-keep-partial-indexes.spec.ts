import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Prisma cannot model partial indexes, so `prisma migrate dev` proposes to DROP
 * them. This pure file-level test replays every migration in order and fails if a
 * partial unique index ends up dropped, or if its WARNING comment disappears from
 * schema.prisma. No database is needed, so it runs in CI.
 */
const PRISMA_DIR = join(__dirname, '../../prisma');
const MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations');

const PARTIAL_INDEXES = [
    'resident_leads_active_unit_key',
    'listings_active_unit_key',
    'flat_ownership_one_open',
    'billing_runs_period_key',
    'import_batches_committed_file_hash_key',
    'import_rows_committed_flat_key',
] as const;

interface Event {
    migration: string;
    kind: 'create' | 'drop';
    index: string;
    partial: boolean;
}

const stripComments = (sql: string): string =>
    sql
        .split('\n')
        .map(line => line.replace(/--.*$/, ''))
        .join('\n');

function loadEvents(): Event[] {
    const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    const events: Event[] = [];
    for (const migration of folders) {
        const sql = stripComments(
            readFileSync(
                join(MIGRATIONS_DIR, migration, 'migration.sql'),
                'utf8'
            )
        );
        // Statements in file order.
        for (const stmt of sql.split(';')) {
            const create =
                /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/i.exec(
                    stmt
                );
            if (create) {
                events.push({
                    migration,
                    kind: 'create',
                    index: create[1] as string,
                    partial: /\bWHERE\b/i.test(stmt),
                });
                continue;
            }
            const drop = /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/i.exec(
                stmt
            );
            if (drop) {
                events.push({
                    migration,
                    kind: 'drop',
                    index: drop[1] as string,
                    partial: false,
                });
            }
        }
    }
    return events;
}

describe('migrations keep the unmodelled partial indexes', () => {
    const events = loadEvents();
    const schema = readFileSync(join(PRISMA_DIR, 'schema.prisma'), 'utf8');

    it('sorts the finance migration after the listings and accountant ones', () => {
        const folders = readdirSync(MIGRATIONS_DIR).sort();
        const at = (name: string) => folders.indexOf(name);
        expect(at('20261102000000_finance_foundations')).toBeGreaterThan(
            at('20261101000000_accountant_role')
        );
        expect(at('20261101000000_accountant_role')).toBeGreaterThan(
            at('20261031000000_flat_listings')
        );
    });

    it.each(PARTIAL_INDEXES)('%s is created with a WHERE clause', index => {
        const created = events.filter(
            e => e.kind === 'create' && e.index === index
        );
        expect(created.length).toBeGreaterThan(0);
        expect(created.every(e => e.partial)).toBe(true);
    });

    it.each(PARTIAL_INDEXES)(
        '%s is present after replaying every migration',
        index => {
            let present = false;
            for (const e of events) {
                if (e.index !== index) continue;
                present = e.kind === 'create';
            }
            expect(present).toBe(true);
        }
    );

    it.each(PARTIAL_INDEXES)(
        '%s is never dropped without being recreated in the same migration',
        index => {
            const byMigration = new Map<string, Event[]>();
            for (const e of events.filter(x => x.index === index)) {
                byMigration.set(e.migration, [
                    ...(byMigration.get(e.migration) ?? []),
                    e,
                ]);
            }
            for (const [migration, list] of byMigration) {
                const last = list[list.length - 1] as Event;
                if (list.some(e => e.kind === 'drop')) {
                    // A drop is only allowed when the same migration recreates it.
                    expect({ migration, last: last.kind }).toEqual({
                        migration,
                        last: 'create',
                    });
                }
            }
        }
    );

    it('no migration drops a table that owns a partial index', () => {
        const owners = [
            'resident_leads',
            'listings',
            'flat_ownerships',
            'billing_runs',
            'import_batches',
            'import_rows',
        ];
        for (const migration of readdirSync(MIGRATIONS_DIR).sort()) {
            if (migration.endsWith('.toml')) continue;
            const sql = stripComments(
                readFileSync(
                    join(MIGRATIONS_DIR, migration, 'migration.sql'),
                    'utf8'
                )
            );
            for (const table of owners) {
                expect(sql).not.toMatch(
                    new RegExp(
                        `DROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?"${table}"`,
                        'i'
                    )
                );
            }
        }
    });

    it.each(PARTIAL_INDEXES)(
        'schema.prisma carries a WARNING comment for %s',
        index => {
            const re = new RegExp(
                `// WARNING: the partial unique index \`${index}\``
            );
            expect(schema).toMatch(re);
        }
    );

    it('finance_foundations creates all four new partial indexes', () => {
        const sql = stripComments(
            readFileSync(
                join(
                    MIGRATIONS_DIR,
                    '20261102000000_finance_foundations',
                    'migration.sql'
                ),
                'utf8'
            )
        );
        expect(sql).toMatch(
            /CREATE UNIQUE INDEX "flat_ownership_one_open"\s+ON "flat_ownerships"\("flatId"\)\s+WHERE "toDate" IS NULL/
        );
        expect(sql).toMatch(
            /CREATE UNIQUE INDEX "billing_runs_period_key"\s+ON "billing_runs"\("periodKey"\)\s+WHERE "status" = 'COMMITTED' AND "periodKey" IS NOT NULL/
        );
        expect(sql).toMatch(
            /CREATE UNIQUE INDEX "import_batches_committed_file_hash_key"\s+ON "import_batches"\("fileHash"\)\s+WHERE "status" = 'COMMITTED'/
        );
        expect(sql).toMatch(
            /CREATE UNIQUE INDEX "import_rows_committed_flat_key"\s+ON "import_rows"\("flatId"\)\s+WHERE "committed" = true/
        );
    });
});
