-- Read-only pre-flight for migration 20261003000000_lowercase_emails.
-- Reports counts only; never prints an email address.
--
--   psql "$DIRECT_DATABASE_URL" -f prisma/scripts/check-email-case.sql
--
-- non_canonical_rows : rows the migration would rewrite
-- collision_groups   : normalized emails shared by more than one row
-- collision_rows     : rows inside those groups
-- For "users", collision_groups must be 0 or the migration aborts.
-- For "invitations" and "resident_leads", repeats are allowed (informational).

WITH normalized AS (
    SELECT 'users' AS table_name,
           "email" AS email,
           lower(regexp_replace("email", '^\s+|\s+$', '', 'g')) AS canonical
      FROM "users"
    UNION ALL
    SELECT 'invitations',
           "email",
           lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
      FROM "invitations"
    UNION ALL
    SELECT 'resident_leads',
           "email",
           lower(regexp_replace("email", '^\s+|\s+$', '', 'g'))
      FROM "resident_leads"
),
groups AS (
    SELECT table_name, canonical, COUNT(*) AS n
      FROM normalized
     GROUP BY table_name, canonical
    HAVING COUNT(*) > 1
)
SELECT t.table_name,
       (SELECT COUNT(*) FROM normalized n
         WHERE n.table_name = t.table_name)                      AS total_rows,
       (SELECT COUNT(*) FROM normalized n
         WHERE n.table_name = t.table_name
           AND n.email <> n.canonical)                           AS non_canonical_rows,
       (SELECT COUNT(*) FROM groups g
         WHERE g.table_name = t.table_name)                      AS collision_groups,
       (SELECT COALESCE(SUM(g.n), 0) FROM groups g
         WHERE g.table_name = t.table_name)                      AS collision_rows
  FROM (VALUES ('users'), ('invitations'), ('resident_leads')) AS t(table_name)
 ORDER BY t.table_name;
