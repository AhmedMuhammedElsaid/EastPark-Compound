import {
    describeDb,
    FINANCE_MIGRATION,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';

/**
 * `finance_live_payments` must run with the caller's rights (security_invoker) and
 * be closed to the Supabase API roles. The anon/authenticated assertions only run
 * when both roles exist (plain Postgres has neither, and has_table_privilege
 * errors on a missing role); the security_invoker assertion always runs.
 */
describeDb('finance_live_payments privileges (real Postgres)', () => {
    let db: ScratchDb;
    beforeAll(() => {
        db = new ScratchDb(TEST_DATABASE_URL as string);
        db.applyAllBefore(FINANCE_MIGRATION);
        const r = db.applyMigration(FINANCE_MIGRATION);
        if (r.status !== 0) throw new Error(r.stderr);
    });
    afterAll(() => db.drop());

    it('is a security_invoker view', () => {
        expect(
            db.scalar(
                `SELECT 'security_invoker=true' = ANY (c.reloptions)
                   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'finance_live_payments' AND c.relkind = 'v'`
            )
        ).toBe('t');
    });

    it('exposes the dated columns but not payer, note, attachment or idempotency data', () => {
        const cols = db
            .scalar(
                `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
                   FROM information_schema.columns WHERE table_name = 'finance_live_payments'`
            )
            .split(',');
        expect(cols).toEqual(
            expect.arrayContaining([
                'receivedAt',
                'bouncedAt',
                'voidedAt',
                'status',
                'flatId',
                'amount',
            ])
        );
        for (const hidden of [
            'payerName',
            'note',
            'attachmentPath',
            'requestKey',
            'requestHash',
        ]) {
            expect(cols).not.toContain(hidden);
        }
    });

    it('is revoked from anon and authenticated when those roles exist', () => {
        const both = db.scalar(
            `SELECT (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
                 AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'))`
        );
        if (both !== 't') {
            console.warn(
                'skipping anon/authenticated assertions: Supabase roles absent'
            );
            return;
        }
        for (const role of ['anon', 'authenticated']) {
            expect(
                db.scalar(
                    `SELECT has_table_privilege('${role}', 'public.finance_live_payments', 'SELECT')`
                )
            ).toBe('f');
        }
    });

    it('has RLS on the underlying payments table', () => {
        expect(
            db.scalar(
                `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payments'::regclass`
            )
        ).toBe('t');
    });
});
