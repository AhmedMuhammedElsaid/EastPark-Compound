-- Close the Supabase Data API (PostgREST) path to the public schema.
-- Supabase advisors flagged rls_disabled_in_public + sensitive_columns_exposed:
-- with RLS off, anyone holding the project URL + anon key can read/write
-- every table over REST. The app never uses that path — the backend talks to
-- Postgres through Prisma as the table owner, which bypasses RLS — so RLS is
-- enabled with NO policies (deny-all for anon/authenticated) and their grants
-- are revoked.
--
-- Only tables owned by the migrating role are touched, so a relation owned by
-- another role (e.g. supabase_admin) can never fail this migration and jam
-- `migrate deploy`. Idempotent. The role-specific part is skipped on plain
-- Postgres (local docker / CI) where the Supabase roles do not exist.
-- Every later migration that creates a table must also ENABLE ROW LEVEL SECURITY.
--
-- Rollback: the same loop with DISABLE ROW LEVEL SECURITY.

DO $$
DECLARE
    t record;
    supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND pg_get_userbyid(c.relowner) = current_user
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
        IF supabase_roles THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t.relname);
        END IF;
    END LOOP;

    IF supabase_roles THEN
        -- Tables created by later migrations (run as this same role) start closed too.
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    END IF;
END
$$;
