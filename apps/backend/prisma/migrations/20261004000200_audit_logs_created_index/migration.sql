-- Additive only: one new index, no table, column or data change.
-- Serves GET /admin/activity (ORDER BY "createdAt" DESC, id DESC, cursor
-- pagination). The audit_logs table is small, so a plain (non-CONCURRENT)
-- build holds its write lock only briefly. IF NOT EXISTS makes a re-run a no-op.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_id_idx" ON "audit_logs"("createdAt", "id");
