-- Additive only: one new index, no table, column or data change.
-- Serves GET /notifications (WHERE "userId" = $1 ORDER BY "createdAt" DESC, id DESC)
-- when no isRead filter is given; the existing (userId, isRead, createdAt) index
-- cannot return that order without a sort. The notifications table is small, so a
-- plain (non-CONCURRENT) build holds its write lock only briefly. IF NOT EXISTS
-- makes a re-run, or an index created by hand beforehand, a no-op.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
