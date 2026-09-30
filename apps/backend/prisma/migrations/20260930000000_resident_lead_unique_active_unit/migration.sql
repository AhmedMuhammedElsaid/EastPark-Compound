-- Preserve historical submissions while allowing only one active lead per unit.
WITH "rankedActiveLeads" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "building", "floor", "flatNumber"
            ORDER BY
                CASE "status"
                    WHEN 'CONVERTED' THEN 1
                    WHEN 'INVITED' THEN 2
                    WHEN 'PENDING' THEN 3
                END,
                "createdAt" ASC,
                "id" ASC
        ) AS "unitRank"
    FROM "resident_leads"
    WHERE "status" <> 'REJECTED'
)
UPDATE "resident_leads"
SET "status" = 'REJECTED'
WHERE "id" IN (
    SELECT "id"
    FROM "rankedActiveLeads"
    WHERE "unitRank" > 1
);

CREATE UNIQUE INDEX "resident_leads_active_unit_key"
ON "resident_leads"("building", "floor", "flatNumber")
WHERE "status" <> 'REJECTED';
