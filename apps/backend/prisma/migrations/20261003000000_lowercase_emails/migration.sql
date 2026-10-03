-- REV-4: canonicalise stored emails to the form the API now writes and looks
-- up (`normalizeEmail`: trim surrounding whitespace, then lower-case).
--
-- Run prisma/scripts/check-email-case.sql first to see what this will touch.
--
-- Safety:
--   * Aborts (RAISE EXCEPTION, nothing changed) if normalising users.email
--     would make two accounts share an address and break "users_email_key".
--     Only counts are reported. Merge or rename the duplicate accounts, then
--     `prisma migrate resolve --rolled-back 20261003000000_lowercase_emails`
--     and deploy again.
--   * Idempotent: only rows that differ from their canonical form are updated,
--     so an empty or already-clean database is a no-op.
--   * A single DO block, so the check and the updates are atomic.
--   * invitations and resident_leads may legitimately repeat an email, so
--     they need no collision check.
--
-- The expression strips leading/trailing whitespace of any kind (\s: space,
-- tab, newline, CR, VT, FF) like JS String.prototype.trim(), then lower().

DO $$
DECLARE
    collision_groups integer;
    collision_rows integer;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(n), 0)
      INTO collision_groups, collision_rows
      FROM (
            SELECT COUNT(*) AS n
              FROM "users"
             GROUP BY lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
            HAVING COUNT(*) > 1
           ) AS dup;

    IF collision_groups > 0 THEN
        RAISE EXCEPTION
            'lowercase_emails aborted: % normalized email(s) are shared by % user rows. Resolve duplicate accounts first (see prisma/scripts/check-email-case.sql).',
            collision_groups, collision_rows;
    END IF;

    UPDATE "users"
       SET "email" = lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
     WHERE "email" <> lower(regexp_replace("email", '^\s+|\s+$', '', 'g'));

    UPDATE "invitations"
       SET "email" = lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
     WHERE "email" <> lower(regexp_replace("email", '^\s+|\s+$', '', 'g'));

    UPDATE "resident_leads"
       SET "email" = lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
     WHERE "email" <> lower(regexp_replace("email", '^\s+|\s+$', '', 'g'));
END
$$;
