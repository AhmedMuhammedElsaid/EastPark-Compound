-- Soft delete + restore (recycle bin). Additive only: new nullable columns,
-- indexes and SET NULL foreign keys. Never drops resident_leads_active_unit_key.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "shop_photos" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "shops_deletedAt_idx" ON "shops"("deletedAt");

-- CreateIndex
CREATE INDEX "shop_photos_deletedAt_idx" ON "shop_photos"("deletedAt");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "reviews_deletedAt_idx" ON "reviews"("deletedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: accounts anonymised by the old hard-delete flow are tombstones.
-- Mark them deleted so every read that filters on "deletedAt" hides them; they
-- are never restorable (the service refuses them by their email).
UPDATE "users"
SET "deletedAt" = "updatedAt"
WHERE "email" LIKE 'deleted-%@deleted.invalid'
  AND "deletedAt" IS NULL;

-- Backfill: products soft-deleted before this migration (isDeleted only) get a
-- deletion time, so they appear in the recycle bin and can be restored.
UPDATE "products"
SET "deletedAt" = "updatedAt"
WHERE "isDeleted" = true
  AND "deletedAt" IS NULL;
