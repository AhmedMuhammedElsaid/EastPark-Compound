-- Flat listings, sell / rent (2026-10-31). Additive only. Contract:
-- Documentation/LISTINGS-CONTRACT.md.
--
-- `LISTING_UPDATE` is only ADDED here, never referenced: PostgreSQL cannot use a
-- newly added enum value inside the transaction that added it.

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'RENTED', 'WITHDRAWN', 'EXPIRED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LISTING_UPDATE';

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "building" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "areaSqm" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "furnished" BOOLEAN NOT NULL,
    "description" TEXT,
    "contactPhone" TEXT NOT NULL,
    "photos" TEXT[],
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_revisions" (
    "id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,

    CONSTRAINT "listing_revisions_pkey" PRIMARY KEY ("id")
);

-- RLS lockdown rule: every new table starts closed to the Supabase Data API.
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listing_revisions" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE INDEX "listings_status_approvedAt_id_idx" ON "listings"("status", "approvedAt", "id");

-- CreateIndex
CREATE INDEX "listings_ownerId_createdAt_id_idx" ON "listings"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "listings_status_expiresAt_idx" ON "listings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "listing_revisions_listingId_createdAt_id_idx" ON "listing_revisions"("listingId", "createdAt", "id");

-- At most ONE active (PENDING or APPROVED) listing per flat. Prisma cannot model
-- partial indexes — never let a generated diff drop this index (see the WARNING
-- above `model Listing` in schema.prisma).
CREATE UNIQUE INDEX "listings_active_unit_key"
ON "listings"("building", "floor", "flatNumber")
WHERE "status" IN ('PENDING', 'APPROVED');

-- AddForeignKey (users are soft-deleted, never hard-deleted: RESTRICT)
ALTER TABLE "listings" ADD CONSTRAINT "listings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
