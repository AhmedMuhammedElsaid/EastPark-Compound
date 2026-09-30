-- CreateEnum
CREATE TYPE "ResidentLeadStatus" AS ENUM ('PENDING', 'INVITED', 'CONVERTED', 'REJECTED');

-- DropIndex
DROP INDEX "users_phone_key";

-- CreateTable
CREATE TABLE "resident_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "parking" TEXT,
    "status" "ResidentLeadStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "resident_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resident_leads_status_createdAt_idx" ON "resident_leads"("status", "createdAt");

-- CreateIndex
CREATE INDEX "resident_leads_email_idx" ON "resident_leads"("email");

-- CreateIndex
CREATE INDEX "resident_leads_building_floor_flatNumber_idx" ON "resident_leads"("building", "floor", "flatNumber");

-- CreateIndex
CREATE INDEX "resident_leads_userId_idx" ON "resident_leads"("userId");

-- CreateIndex
CREATE INDEX "invitations_invitedById_idx" ON "invitations"("invitedById");

-- CreateIndex
CREATE INDEX "shops_merchantId_idx" ON "shops"("merchantId");

-- CreateIndex
CREATE INDEX "shops_category_createdAt_idx" ON "shops"("category", "createdAt");

-- CreateIndex
CREATE INDEX "shop_photos_shopId_order_idx" ON "shop_photos"("shopId", "order");

-- CreateIndex
CREATE INDEX "products_shopId_isDeleted_createdAt_idx" ON "products"("shopId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "orders_residentId_createdAt_idx" ON "orders"("residentId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_shopId_createdAt_idx" ON "orders"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "reviews_shopId_createdAt_idx" ON "reviews"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_announcementId_createdAt_idx" ON "comments"("announcementId", "createdAt");

-- CreateIndex
CREATE INDEX "votes_pollId_idx" ON "votes"("pollId");

-- CreateIndex
CREATE INDEX "elections_expiresAt_resultsOpen_idx" ON "elections"("expiresAt", "resultsOpen");

-- CreateIndex
CREATE INDEX "candidates_electionId_idx" ON "candidates"("electionId");

-- CreateIndex
CREATE INDEX "election_votes_electionId_idx" ON "election_votes"("electionId");

-- CreateIndex
CREATE INDEX "feedbacks_userId_createdAt_idx" ON "feedbacks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feedbacks_category_idx" ON "feedbacks"("category");

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "feedback_replies_feedbackId_createdAt_idx" ON "feedback_replies"("feedbackId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- AddForeignKey
ALTER TABLE "resident_leads" ADD CONSTRAINT "resident_leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

