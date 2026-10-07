-- Multi-flat owners (2026-10-07): an account can own many flats; a flat has at
-- most one owner at a time. Additive only.
--
-- Unit reservation is split cleanly after this migration:
--   * a flat in an ACTIVE application = a lead with status PENDING or INVITED
--     (partial unique index `resident_leads_active_unit_key`, recreated below);
--   * an OWNED flat = a `resident_units` row (its own unique key).
-- CONVERTED leads stay as history only.

-- CreateTable
CREATE TABLE "resident_units" (
    "id" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "leadId" TEXT,

    CONSTRAINT "resident_units_pkey" PRIMARY KEY ("id")
);

-- RLS lockdown rule: every new table starts closed to the Supabase Data API.
ALTER TABLE "resident_units" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE UNIQUE INDEX "resident_units_leadId_key" ON "resident_units"("leadId");

-- CreateIndex
CREATE INDEX "resident_units_userId_idx" ON "resident_units"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resident_units_building_floor_flatNumber_key" ON "resident_units"("building", "floor", "flatNumber");

-- AddForeignKey (users are soft-deleted, never hard-deleted: RESTRICT)
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "resident_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one owned flat per CONVERTED lead linked to an account. The old
-- partial index (status <> 'REJECTED') already guarantees no duplicate flat
-- among CONVERTED leads; ON CONFLICT is only a defensive no-op.
INSERT INTO "resident_units" ("id", "building", "floor", "flatNumber", "createdAt", "userId", "addedById", "leadId")
SELECT 'ru_' || l."id", l."building", l."floor", l."flatNumber", l."updatedAt", l."userId", NULL, l."id"
FROM "resident_leads" l
WHERE l."status" = 'CONVERTED'
  AND l."userId" IS NOT NULL
ORDER BY l."updatedAt" ASC, l."id" ASC
ON CONFLICT DO NOTHING;

-- Recreate the active-application guard (same name) for PENDING/INVITED only,
-- AFTER the backfill. Prisma cannot model partial indexes — never let a
-- generated diff drop this index (see the WARNING above ResidentLead).
DROP INDEX "resident_leads_active_unit_key";

CREATE UNIQUE INDEX "resident_leads_active_unit_key"
ON "resident_leads"("building", "floor", "flatNumber")
WHERE "status" IN ('PENDING', 'INVITED');
