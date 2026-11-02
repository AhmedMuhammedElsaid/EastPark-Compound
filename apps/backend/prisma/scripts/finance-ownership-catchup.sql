-- Post-deploy catch-up for migration 20261102000000_finance_foundations (accounting slice 5, review M2).
--
-- Between the migration commit and the new code serving traffic, the OLD code keeps writing
-- resident_units / users / listings without touching flatId or flat_ownerships. This script
-- repairs exactly that drift. It is idempotent (a second run changes 0 rows) and runs in one
-- transaction. Run it once AFTER Render reports the new deploy live, then run
-- finance-ownership-invariant.sql (every count must be 0):
--
--   psql "$DIRECT_DATABASE_URL" -X -1 -v ON_ERROR_STOP=1 -f prisma/scripts/finance-ownership-catchup.sql
--
-- Steps (order matters: stale periods must close before new ones open on the same flat,
-- or flat_ownership_one_open rejects the insert):
--   0. unlink resident_units / listings whose flatId no longer matches their text key
--      (a key edited by code that does not maintain flatId)
--   1. close open periods whose owner was soft-deleted (ACCOUNT_DELETED)
--   2. close open periods whose resident_unit was removed (REMOVED)
--   3. link resident_units WHERE "flatId" IS NULL (same normalisation as the migration)
--   4. link listings WHERE "flatId" IS NULL (informational)
--   5. open a period for every linked unit of a live owner WHERE NOT EXISTS an open period
--      (fromDate: 1900-01-01 sentinel if the unit predates finance.goLiveAt, else its
--      createdAt Cairo date; a restored owner's unit therefore reopens at the sentinel or
--      createdAt, which is the conservative "owned all along" reading)
-- Dates are Cairo calendar dates; a close never goes before the period's fromDate.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "finance_settings" WHERE "key" = 'finance.goLiveAt') THEN
        RAISE EXCEPTION 'finance.goLiveAt missing: finance_foundations is not applied (or the setting was edited)';
    END IF;
END $$;

CREATE TEMP TABLE catchup_counts (step text PRIMARY KEY, n integer NOT NULL) ON COMMIT DROP;

-- 0. Stale links: the text key was edited but flatId still points at the old flat.
WITH unlinked AS (
    UPDATE "resident_units" ru
       SET "flatId" = NULL
      FROM "flats" f
     WHERE f."id" = ru."flatId"
       AND (f."building", f."floor", f."flatNumber") IS DISTINCT FROM
           (upper(btrim(ru."building", E' \t\r\n')), upper(btrim(ru."floor", E' \t\r\n')), btrim(ru."flatNumber", E' \t\r\n'))
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '0_units_unlinked_stale', COUNT(*) FROM unlinked;

WITH unlinked AS (
    UPDATE "listings" l
       SET "flatId" = NULL
      FROM "flats" f
     WHERE f."id" = l."flatId"
       AND (f."building", f."floor", f."flatNumber") IS DISTINCT FROM
           (upper(btrim(l."building", E' \t\r\n')), upper(btrim(l."floor", E' \t\r\n')), btrim(l."flatNumber", E' \t\r\n'))
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '0_listings_unlinked_stale', COUNT(*) FROM unlinked;

-- 1. Owner soft-deleted by the old code: period still open.
WITH closed AS (
    UPDATE "flat_ownerships" fo
       SET "toDate" = GREATEST((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date, fo."fromDate"),
           "closedReason" = 'ACCOUNT_DELETED'
      FROM "users" u
     WHERE u."id" = fo."userId"
       AND fo."toDate" IS NULL
       AND u."deletedAt" IS NOT NULL
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '1_closed_account_deleted', COUNT(*) FROM closed;

-- 2. Unit removed (or moved to another flat) by the old code: period still open.
WITH closed AS (
    UPDATE "flat_ownerships" fo
       SET "toDate" = GREATEST((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date, fo."fromDate"),
           "closedReason" = 'REMOVED'
     WHERE fo."toDate" IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM "resident_units" ru
            WHERE ru."flatId" = fo."flatId" AND ru."userId" = fo."userId"
       )
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '2_closed_removed', COUNT(*) FROM closed;

-- 3. Units created or re-keyed by the old code.
WITH linked AS (
    UPDATE "resident_units" ru
       SET "flatId" = f."id"
      FROM "flats" f
     WHERE ru."flatId" IS NULL
       AND f."building" = upper(btrim(ru."building", E' \t\r\n'))
       AND f."floor" = upper(btrim(ru."floor", E' \t\r\n'))
       AND f."flatNumber" = btrim(ru."flatNumber", E' \t\r\n')
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '3_units_linked', COUNT(*) FROM linked;

-- 4. Listings created or edited by the old code.
WITH linked AS (
    UPDATE "listings" l
       SET "flatId" = f."id"
      FROM "flats" f
     WHERE l."flatId" IS NULL
       AND f."building" = upper(btrim(l."building", E' \t\r\n'))
       AND f."floor" = upper(btrim(l."floor", E' \t\r\n'))
       AND f."flatNumber" = btrim(l."flatNumber", E' \t\r\n')
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '4_listings_linked', COUNT(*) FROM linked;

-- 5. Linked unit of a live owner without an open period (new unit, restored owner, step 3).
WITH go_live AS (
    SELECT ("value" #>> '{}')::timestamptz AS at
      FROM "finance_settings" WHERE "key" = 'finance.goLiveAt'
),
opened AS (
    INSERT INTO "flat_ownerships" ("id", "fromDate", "flatId", "userId")
    SELECT 'fo_cu_' || ru."id" || '_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'),
           CASE
               WHEN (ru."createdAt" AT TIME ZONE 'UTC') >= g.at
                   THEN ((ru."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo')::date
               ELSE DATE '1900-01-01'
           END,
           ru."flatId",
           ru."userId"
      FROM "resident_units" ru
      JOIN "users" u ON u."id" = ru."userId"
     CROSS JOIN go_live g
     WHERE ru."flatId" IS NOT NULL
       AND u."deletedAt" IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM "flat_ownerships" fo
            WHERE fo."flatId" = ru."flatId" AND fo."userId" = ru."userId" AND fo."toDate" IS NULL
       )
    RETURNING 1
)
INSERT INTO catchup_counts SELECT '5_periods_opened', COUNT(*) FROM opened;

SELECT step, n FROM catchup_counts ORDER BY step;
