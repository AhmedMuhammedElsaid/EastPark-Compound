-- Read-only ownership invariant check (accounting slice 5, review M2). Prints counts only.
--
--   psql "$DIRECT_DATABASE_URL" -X -f prisma/scripts/finance-ownership-invariant.sql
--
-- Invariant: an open flat_ownerships period for (flat, user) exists
--   <=> a resident_units row with that flatId exists for the user
--   <=> the user is not soft-deleted.
-- Units with flatId NULL (unknown key) are outside it.
--
-- Every row must report 0 after finance-ownership-catchup.sql. Non-zero:
--   linked_unit_without_period  : live owner's linked unit has no open period
--   period_without_unit         : open period whose unit is gone (or moved)
--   period_of_deleted_user      : open period on a soft-deleted account
--   unit_unlinked_known_key     : unit with flatId NULL whose key is a real flat
--   listing_unlinked_known_key  : listing with flatId NULL whose key is a real flat
--   unit_stale_link             : unit whose flatId no longer matches its text key
--   flat_with_two_open_periods  : should be impossible (partial unique index)

SELECT 'linked_unit_without_period' AS check_name, COUNT(*) AS n
  FROM "resident_units" ru
  JOIN "users" u ON u."id" = ru."userId"
 WHERE ru."flatId" IS NOT NULL
   AND u."deletedAt" IS NULL
   AND NOT EXISTS (
       SELECT 1 FROM "flat_ownerships" fo
        WHERE fo."flatId" = ru."flatId" AND fo."userId" = ru."userId" AND fo."toDate" IS NULL
   )
UNION ALL
SELECT 'period_without_unit', COUNT(*)
  FROM "flat_ownerships" fo
 WHERE fo."toDate" IS NULL
   AND NOT EXISTS (
       SELECT 1 FROM "resident_units" ru
        WHERE ru."flatId" = fo."flatId" AND ru."userId" = fo."userId"
   )
UNION ALL
SELECT 'period_of_deleted_user', COUNT(*)
  FROM "flat_ownerships" fo
  JOIN "users" u ON u."id" = fo."userId"
 WHERE fo."toDate" IS NULL AND u."deletedAt" IS NOT NULL
UNION ALL
SELECT 'unit_unlinked_known_key', COUNT(*)
  FROM "resident_units" ru
  JOIN "flats" f
    ON f."building" = upper(btrim(ru."building", E' \t\r\n'))
   AND f."floor" = upper(btrim(ru."floor", E' \t\r\n'))
   AND f."flatNumber" = btrim(ru."flatNumber", E' \t\r\n')
 WHERE ru."flatId" IS NULL
UNION ALL
SELECT 'listing_unlinked_known_key', COUNT(*)
  FROM "listings" l
  JOIN "flats" f
    ON f."building" = upper(btrim(l."building", E' \t\r\n'))
   AND f."floor" = upper(btrim(l."floor", E' \t\r\n'))
   AND f."flatNumber" = btrim(l."flatNumber", E' \t\r\n')
 WHERE l."flatId" IS NULL
UNION ALL
SELECT 'unit_stale_link', COUNT(*)
  FROM "resident_units" ru
  JOIN "flats" f ON f."id" = ru."flatId"
 WHERE (f."building", f."floor", f."flatNumber") IS DISTINCT FROM
       (upper(btrim(ru."building", E' \t\r\n')), upper(btrim(ru."floor", E' \t\r\n')), btrim(ru."flatNumber", E' \t\r\n'))
UNION ALL
SELECT 'flat_with_two_open_periods', COUNT(*)
  FROM (
      SELECT "flatId" FROM "flat_ownerships" WHERE "toDate" IS NULL
       GROUP BY "flatId" HAVING COUNT(*) > 1
  ) dup;
