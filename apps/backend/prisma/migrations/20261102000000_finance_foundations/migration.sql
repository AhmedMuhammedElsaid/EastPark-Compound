-- Accounting Phase 1a: finance foundations (2026-11-02). Plan: Documentation/ACCOUNTING-PLAN.md
-- section 2.4 and 2.3.1 row 2. Generated offline with `prisma migrate diff`, then edited by
-- hand: the generated script never touched `listings_active_unit_key` or
-- `resident_leads_active_unit_key`; the partial indexes, CHECKs, RLS, seeds, backfill and
-- the view are added below.
--
-- Additive only: 14 new tables and 2 NULLABLE columns (`resident_units.flatId`,
-- `listings.flatId`). Nothing is removed or rewritten and no enum value is added or used.
-- Seeds that need the accountant role are application code, never inside a migration.
-- Do not accept a `migrate dev` diff that removes the unmodelled partial indexes (see the
-- WARNING comments in schema.prisma).
-- Rollback if it fails on Render: `prisma migrate resolve --rolled-back 20261102000000_finance_foundations`.

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('SERVICE_CHARGE', 'MAINTENANCE_DEPOSIT', 'SHORTFALL', 'SERVICE_FEE', 'OPENING_BALANCE', 'OTHER');
-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('POSTED', 'VOID');
-- CreateEnum
CREATE TYPE "FinancePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'INSTAPAY', 'CHEQUE');
-- CreateEnum
CREATE TYPE "ChequeState" AS ENUM ('NOT_APPLICABLE', 'PENDING_CLEARANCE', 'CLEARED', 'BOUNCED');
-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'VOIDED', 'DISCARDED');
-- CreateEnum
CREATE TYPE "ImportRowAction" AS ENUM ('CREATE', 'SKIP');
-- CreateEnum
CREATE TYPE "EntryDirection" AS ENUM ('IN', 'OUT');
-- CreateEnum
CREATE TYPE "FundEntryKind" AS ENUM ('DEPOSIT_IN', 'INVESTMENT_INCOME', 'MAINTENANCE_OUT', 'ADJUSTMENT', 'OPENING_BALANCE');
-- CreateEnum
CREATE TYPE "FundHolding" AS ENUM ('CASH', 'INVESTED');
-- CreateEnum
CREATE TYPE "OwnershipClosedReason" AS ENUM ('SOLD', 'REMOVED', 'ACCOUNT_DELETED');
-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');
-- CreateEnum
CREATE TYPE "BillingRunKind" AS ENUM ('SERVICE_CHARGE', 'SHORTFALL', 'CUSTOM');
-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'VOID');
-- CreateEnum
CREATE TYPE "FinanceCategoryType" AS ENUM ('REVENUE', 'EXPENSE');
-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_OFF');
-- AlterTable
ALTER TABLE "resident_units" ADD COLUMN     "flatId" TEXT;
-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "flatId" TEXT;
-- CreateTable
CREATE TABLE "flats" (
    "id" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shareWeight" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flats_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "flat_ownerships" (
    "id" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE,
    "closedReason" "OwnershipClosedReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedById" TEXT,
    "closedById" TEXT,
    CONSTRAINT "flat_ownerships_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "finance_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "FinanceCategoryType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "billing_runs" (
    "id" TEXT NOT NULL,
    "kind" "BillingRunKind" NOT NULL,
    "period" TEXT NOT NULL,
    "accrualPeriod" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "BillingRunStatus" NOT NULL DEFAULT 'PREVIEW',
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "periodKey" TEXT,
    "params" JSONB NOT NULL,
    "committedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeScheduleId" TEXT,
    "createdById" TEXT NOT NULL,
    "committedById" TEXT,
    "voidedById" TEXT,
    CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "accrualPeriod" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PostingStatus" NOT NULL DEFAULT 'POSTED',
    "fundContribution" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flatId" TEXT NOT NULL,
    "billingRunId" TEXT,
    "replacesId" TEXT,
    "voidedById" TEXT,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "FinancePaymentMethod" NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reference" TEXT,
    "chequeState" "ChequeState" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "clearedAt" DATE,
    "bouncedAt" DATE,
    "receivedAt" DATE NOT NULL,
    "payerName" TEXT,
    "note" TEXT,
    "status" "PostingStatus" NOT NULL DEFAULT 'POSTED',
    "attachmentPath" TEXT,
    "isOpening" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flatId" TEXT NOT NULL,
    "replacesId" TEXT,
    "voidedById" TEXT,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAt" DATE NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "voidedById" TEXT,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "receipt_counters" (
    "scope" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "receipt_counters_pkey" PRIMARY KEY ("scope","year")
);
-- CreateTable
CREATE TABLE "fiscal_periods" (
    "period" TEXT NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "closedById" TEXT,
    "reopenedById" TEXT,
    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("period")
);
-- CreateTable
CREATE TABLE "finance_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("key")
);
-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "asOf" DATE NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "okRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "committedById" TEXT,
    "voidedById" TEXT,
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "parsed" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "action" "ImportRowAction" NOT NULL,
    "committed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "flatId" TEXT,
    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "fund_entries" (
    "id" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" "FundEntryKind" NOT NULL,
    "holding" "FundHolding" NOT NULL DEFAULT 'CASH',
    "countsInFundTotal" BOOLEAN NOT NULL DEFAULT true,
    "direction" "EntryDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "entryDate" DATE NOT NULL,
    "investmentRef" TEXT,
    "description" TEXT NOT NULL,
    "status" "PostingStatus" NOT NULL DEFAULT 'POSTED',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,
    "voidedById" TEXT,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "fund_entries_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "flats_label_key" ON "flats"("label");
-- CreateIndex
CREATE INDEX "flats_phase_idx" ON "flats"("phase");
-- CreateIndex
CREATE INDEX "flats_building_idx" ON "flats"("building");
-- CreateIndex
CREATE UNIQUE INDEX "flats_building_floor_flatNumber_key" ON "flats"("building", "floor", "flatNumber");
-- CreateIndex
CREATE INDEX "flat_ownerships_flatId_toDate_idx" ON "flat_ownerships"("flatId", "toDate");
-- CreateIndex
CREATE INDEX "flat_ownerships_userId_idx" ON "flat_ownerships"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "finance_categories_type_name_key" ON "finance_categories"("type", "name");
-- CreateIndex
CREATE INDEX "fee_schedules_categoryId_idx" ON "fee_schedules"("categoryId");
-- CreateIndex
CREATE UNIQUE INDEX "billing_runs_requestKey_key" ON "billing_runs"("requestKey");
-- CreateIndex
CREATE INDEX "billing_runs_status_idx" ON "billing_runs"("status");
-- CreateIndex
CREATE INDEX "billing_runs_accrualPeriod_idx" ON "billing_runs"("accrualPeriod");
-- CreateIndex
CREATE INDEX "billing_runs_feeScheduleId_idx" ON "billing_runs"("feeScheduleId");
-- CreateIndex
CREATE INDEX "charges_flatId_status_idx" ON "charges"("flatId", "status");
-- CreateIndex
CREATE INDEX "charges_accrualPeriod_idx" ON "charges"("accrualPeriod");
-- CreateIndex
CREATE INDEX "charges_dueDate_idx" ON "charges"("dueDate");
-- CreateIndex
CREATE INDEX "charges_replacesId_idx" ON "charges"("replacesId");
-- CreateIndex
CREATE UNIQUE INDEX "charges_billingRunId_flatId_key" ON "charges"("billingRunId", "flatId");
-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNo_key" ON "payments"("receiptNo");
-- CreateIndex
CREATE UNIQUE INDEX "payments_requestKey_key" ON "payments"("requestKey");
-- CreateIndex
CREATE INDEX "payments_flatId_status_idx" ON "payments"("flatId", "status");
-- CreateIndex
CREATE INDEX "payments_flatId_chequeState_idx" ON "payments"("flatId", "chequeState");
-- CreateIndex
CREATE INDEX "payments_receivedAt_idx" ON "payments"("receivedAt");
-- CreateIndex
CREATE INDEX "payments_method_reference_idx" ON "payments"("method", "reference");
-- CreateIndex
CREATE INDEX "payments_replacesId_idx" ON "payments"("replacesId");
-- CreateIndex
CREATE INDEX "payment_allocations_chargeId_idx" ON "payment_allocations"("chargeId");
-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_chargeId_key" ON "payment_allocations"("paymentId", "chargeId");
-- CreateIndex
CREATE INDEX "import_batches_fileHash_idx" ON "import_batches"("fileHash");
-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");
-- CreateIndex
CREATE INDEX "import_rows_batchId_idx" ON "import_rows"("batchId");
-- CreateIndex
CREATE INDEX "import_rows_flatId_idx" ON "import_rows"("flatId");
-- CreateIndex
CREATE UNIQUE INDEX "fund_entries_entryNo_key" ON "fund_entries"("entryNo");
-- CreateIndex
CREATE UNIQUE INDEX "fund_entries_requestKey_key" ON "fund_entries"("requestKey");
-- CreateIndex
CREATE INDEX "fund_entries_entryDate_idx" ON "fund_entries"("entryDate");
-- CreateIndex
CREATE INDEX "fund_entries_kind_status_idx" ON "fund_entries"("kind", "status");
-- CreateIndex
CREATE INDEX "fund_entries_paymentId_idx" ON "fund_entries"("paymentId");
-- CreateIndex
CREATE INDEX "resident_units_flatId_idx" ON "resident_units"("flatId");
-- CreateIndex
CREATE INDEX "listings_flatId_idx" ON "listings"("flatId");
-- AddForeignKey
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flat_ownerships" ADD CONSTRAINT "flat_ownerships_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flat_ownerships" ADD CONSTRAINT "flat_ownerships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flat_ownerships" ADD CONSTRAINT "flat_ownerships_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "flat_ownerships" ADD CONSTRAINT "flat_ownerships_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_feeScheduleId_fkey" FOREIGN KEY ("feeScheduleId") REFERENCES "fee_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "billing_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS lockdown rule: every new table starts closed to the Supabase Data API.
ALTER TABLE "flats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flat_ownerships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipt_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fund_entries" ENABLE ROW LEVEL SECURITY;

-- CHECK constraints (Prisma cannot model them): money is always positive; a flat's
-- credit comes only from unallocated payments, never from a negative charge.
ALTER TABLE "charges" ADD CONSTRAINT "charges_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_amount_positive" CHECK ("amount" > 0);

-- Partial unique indexes. Prisma cannot model them: never let a generated diff drop
-- them (see the WARNING comments above the models in schema.prisma).
-- At most ONE open ownership period per flat.
CREATE UNIQUE INDEX "flat_ownership_one_open"
ON "flat_ownerships"("flatId")
WHERE "toDate" IS NULL;

-- One committed billing per period key (SC:<feeScheduleId>:<period>, SF:<period>).
CREATE UNIQUE INDEX "billing_runs_period_key"
ON "billing_runs"("periodKey")
WHERE "status" = 'COMMITTED' AND "periodKey" IS NOT NULL;

-- The same opening-balance file cannot be committed twice.
CREATE UNIQUE INDEX "import_batches_committed_file_hash_key"
ON "import_batches"("fileHash")
WHERE "status" = 'COMMITTED';

-- A flat can be imported only once (voiding a batch sets committed = false).
CREATE UNIQUE INDEX "import_rows_committed_flat_key"
ON "import_rows"("flatId")
WHERE "committed" = true;

-- Pre-flight assert 1: the existing `resident_units` must not collide once their keys
-- are normalised (upper-trim building and floor, trim flat number; same rule as
-- normaliseFlatKey() and prisma/scripts/check-flat-keys.sql). A collision would make
-- two accounts claim one flat. Fix with the audited PATCH /admin/resident-units/:id
-- (SUPER_ADMIN), then redeploy. Unknown keys only raise a NOTICE.
DO $$
DECLARE
    collisions integer;
BEGIN
    SELECT COUNT(*) INTO collisions FROM (
        SELECT 1
          FROM "resident_units"
         GROUP BY upper(btrim("building", E' \t\r\n')), upper(btrim("floor", E' \t\r\n')), btrim("flatNumber", E' \t\r\n')
        HAVING COUNT(*) > 1
    ) g;
    IF collisions > 0 THEN
        RAISE EXCEPTION 'finance_foundations: % resident_units key collision group(s) after normalisation; repair them before deploying', collisions;
    END IF;
END
$$;

-- Seed: the 690 physical flats of the compound (phases 1 and 4 have no ground floor,
-- phases 2 and 3 do). The list is generated from
-- src/common/finance/compound-layout.ts; test/common/finance-foundations-migration.spec.ts
-- fails if the two differ. `label` = building-floor-flatNumber (formatUnitLabel).
INSERT INTO "flats" ("id", "building", "floor", "flatNumber", "label", "phase")
SELECT 'flat_' || v.b || '-' || v.f || '-' || v.n, v.b, v.f, v.n, v.b || '-' || v.f || '-' || v.n, v.ph
FROM (
    VALUES
        ('A1','1','1','phase-1'), ('A1','1','2','phase-1'), ('A1','1','3','phase-1'), ('A1','1','4','phase-1'), ('A1','1','5','phase-1'),
        ('A1','2','1','phase-1'), ('A1','2','2','phase-1'), ('A1','2','3','phase-1'), ('A1','2','4','phase-1'), ('A1','2','5','phase-1'),
        ('A1','3','1','phase-1'), ('A1','3','2','phase-1'), ('A1','3','3','phase-1'), ('A1','3','4','phase-1'), ('A1','3','5','phase-1'),
        ('A1','4','1','phase-1'), ('A1','4','2','phase-1'), ('A1','4','3','phase-1'), ('A1','4','4','phase-1'), ('A1','4','5','phase-1'),
        ('A1','5','1','phase-1'), ('A1','5','2','phase-1'), ('A1','5','3','phase-1'), ('A1','5','4','phase-1'), ('A1','5','5','phase-1'),
        ('A1','6','1','phase-1'), ('A1','6','2','phase-1'), ('A1','6','3','phase-1'), ('A1','6','4','phase-1'), ('A1','6','5','phase-1'),
        ('A1','7','1','phase-1'), ('A1','7','2','phase-1'), ('A1','7','3','phase-1'), ('A1','7','4','phase-1'), ('A1','7','5','phase-1'),
        ('A1','8','1','phase-1'), ('A1','8','2','phase-1'), ('A1','8','3','phase-1'), ('A1','8','4','phase-1'), ('A1','8','5','phase-1'),
        ('A1','9','1','phase-1'), ('A1','9','2','phase-1'), ('A1','9','3','phase-1'), ('A1','9','4','phase-1'), ('A1','9','5','phase-1'),
        ('A1','10','1','phase-1'), ('A1','10','2','phase-1'), ('A1','10','3','phase-1'), ('A1','10','4','phase-1'), ('A1','10','5','phase-1'),
        ('A1','11','1','phase-1'), ('A1','11','2','phase-1'), ('A1','11','3','phase-1'), ('A1','11','4','phase-1'), ('A1','11','5','phase-1'),
        ('B1','1','1','phase-1'), ('B1','1','2','phase-1'), ('B1','1','3','phase-1'), ('B1','1','4','phase-1'), ('B1','1','5','phase-1'),
        ('B1','2','1','phase-1'), ('B1','2','2','phase-1'), ('B1','2','3','phase-1'), ('B1','2','4','phase-1'), ('B1','2','5','phase-1'),
        ('B1','3','1','phase-1'), ('B1','3','2','phase-1'), ('B1','3','3','phase-1'), ('B1','3','4','phase-1'), ('B1','3','5','phase-1'),
        ('B1','4','1','phase-1'), ('B1','4','2','phase-1'), ('B1','4','3','phase-1'), ('B1','4','4','phase-1'), ('B1','4','5','phase-1'),
        ('B1','5','1','phase-1'), ('B1','5','2','phase-1'), ('B1','5','3','phase-1'), ('B1','5','4','phase-1'), ('B1','5','5','phase-1'),
        ('B1','6','1','phase-1'), ('B1','6','2','phase-1'), ('B1','6','3','phase-1'), ('B1','6','4','phase-1'), ('B1','6','5','phase-1'),
        ('B1','7','1','phase-1'), ('B1','7','2','phase-1'), ('B1','7','3','phase-1'), ('B1','7','4','phase-1'), ('B1','7','5','phase-1'),
        ('B1','8','1','phase-1'), ('B1','8','2','phase-1'), ('B1','8','3','phase-1'), ('B1','8','4','phase-1'), ('B1','8','5','phase-1'),
        ('B1','9','1','phase-1'), ('B1','9','2','phase-1'), ('B1','9','3','phase-1'), ('B1','9','4','phase-1'), ('B1','9','5','phase-1'),
        ('B1','10','1','phase-1'), ('B1','10','2','phase-1'), ('B1','10','3','phase-1'), ('B1','10','4','phase-1'), ('B1','10','5','phase-1'),
        ('B1','11','1','phase-1'), ('B1','11','2','phase-1'), ('B1','11','3','phase-1'), ('B1','11','4','phase-1'), ('B1','11','5','phase-1'),
        ('C1','1','1','phase-1'), ('C1','1','2','phase-1'), ('C1','1','3','phase-1'), ('C1','1','4','phase-1'), ('C1','1','5','phase-1'),
        ('C1','2','1','phase-1'), ('C1','2','2','phase-1'), ('C1','2','3','phase-1'), ('C1','2','4','phase-1'), ('C1','2','5','phase-1'),
        ('C1','3','1','phase-1'), ('C1','3','2','phase-1'), ('C1','3','3','phase-1'), ('C1','3','4','phase-1'), ('C1','3','5','phase-1'),
        ('C1','4','1','phase-1'), ('C1','4','2','phase-1'), ('C1','4','3','phase-1'), ('C1','4','4','phase-1'), ('C1','4','5','phase-1'),
        ('C1','5','1','phase-1'), ('C1','5','2','phase-1'), ('C1','5','3','phase-1'), ('C1','5','4','phase-1'), ('C1','5','5','phase-1'),
        ('C1','6','1','phase-1'), ('C1','6','2','phase-1'), ('C1','6','3','phase-1'), ('C1','6','4','phase-1'), ('C1','6','5','phase-1'),
        ('C1','7','1','phase-1'), ('C1','7','2','phase-1'), ('C1','7','3','phase-1'), ('C1','7','4','phase-1'), ('C1','7','5','phase-1'),
        ('C1','8','1','phase-1'), ('C1','8','2','phase-1'), ('C1','8','3','phase-1'), ('C1','8','4','phase-1'), ('C1','8','5','phase-1'),
        ('C1','9','1','phase-1'), ('C1','9','2','phase-1'), ('C1','9','3','phase-1'), ('C1','9','4','phase-1'), ('C1','9','5','phase-1'),
        ('C1','10','1','phase-1'), ('C1','10','2','phase-1'), ('C1','10','3','phase-1'), ('C1','10','4','phase-1'), ('C1','10','5','phase-1'),
        ('C1','11','1','phase-1'), ('C1','11','2','phase-1'), ('C1','11','3','phase-1'), ('C1','11','4','phase-1'), ('C1','11','5','phase-1'),
        ('A2','G','1','phase-2'), ('A2','G','2','phase-2'), ('A2','G','3','phase-2'), ('A2','G','4','phase-2'), ('A2','G','5','phase-2'),
        ('A2','1','1','phase-2'), ('A2','1','2','phase-2'), ('A2','1','3','phase-2'), ('A2','1','4','phase-2'), ('A2','1','5','phase-2'),
        ('A2','2','1','phase-2'), ('A2','2','2','phase-2'), ('A2','2','3','phase-2'), ('A2','2','4','phase-2'), ('A2','2','5','phase-2'),
        ('A2','3','1','phase-2'), ('A2','3','2','phase-2'), ('A2','3','3','phase-2'), ('A2','3','4','phase-2'), ('A2','3','5','phase-2'),
        ('A2','4','1','phase-2'), ('A2','4','2','phase-2'), ('A2','4','3','phase-2'), ('A2','4','4','phase-2'), ('A2','4','5','phase-2'),
        ('A2','5','1','phase-2'), ('A2','5','2','phase-2'), ('A2','5','3','phase-2'), ('A2','5','4','phase-2'), ('A2','5','5','phase-2'),
        ('A2','6','1','phase-2'), ('A2','6','2','phase-2'), ('A2','6','3','phase-2'), ('A2','6','4','phase-2'), ('A2','6','5','phase-2'),
        ('A2','7','1','phase-2'), ('A2','7','2','phase-2'), ('A2','7','3','phase-2'), ('A2','7','4','phase-2'), ('A2','7','5','phase-2'),
        ('A2','8','1','phase-2'), ('A2','8','2','phase-2'), ('A2','8','3','phase-2'), ('A2','8','4','phase-2'), ('A2','8','5','phase-2'),
        ('A2','9','1','phase-2'), ('A2','9','2','phase-2'), ('A2','9','3','phase-2'), ('A2','9','4','phase-2'), ('A2','9','5','phase-2'),
        ('A2','10','1','phase-2'), ('A2','10','2','phase-2'), ('A2','10','3','phase-2'), ('A2','10','4','phase-2'), ('A2','10','5','phase-2'),
        ('A2','11','1','phase-2'), ('A2','11','2','phase-2'), ('A2','11','3','phase-2'), ('A2','11','4','phase-2'), ('A2','11','5','phase-2'),
        ('B2','G','1','phase-2'), ('B2','G','2','phase-2'), ('B2','G','3','phase-2'), ('B2','G','4','phase-2'), ('B2','G','5','phase-2'),
        ('B2','1','1','phase-2'), ('B2','1','2','phase-2'), ('B2','1','3','phase-2'), ('B2','1','4','phase-2'), ('B2','1','5','phase-2'),
        ('B2','2','1','phase-2'), ('B2','2','2','phase-2'), ('B2','2','3','phase-2'), ('B2','2','4','phase-2'), ('B2','2','5','phase-2'),
        ('B2','3','1','phase-2'), ('B2','3','2','phase-2'), ('B2','3','3','phase-2'), ('B2','3','4','phase-2'), ('B2','3','5','phase-2'),
        ('B2','4','1','phase-2'), ('B2','4','2','phase-2'), ('B2','4','3','phase-2'), ('B2','4','4','phase-2'), ('B2','4','5','phase-2'),
        ('B2','5','1','phase-2'), ('B2','5','2','phase-2'), ('B2','5','3','phase-2'), ('B2','5','4','phase-2'), ('B2','5','5','phase-2'),
        ('B2','6','1','phase-2'), ('B2','6','2','phase-2'), ('B2','6','3','phase-2'), ('B2','6','4','phase-2'), ('B2','6','5','phase-2'),
        ('B2','7','1','phase-2'), ('B2','7','2','phase-2'), ('B2','7','3','phase-2'), ('B2','7','4','phase-2'), ('B2','7','5','phase-2'),
        ('B2','8','1','phase-2'), ('B2','8','2','phase-2'), ('B2','8','3','phase-2'), ('B2','8','4','phase-2'), ('B2','8','5','phase-2'),
        ('B2','9','1','phase-2'), ('B2','9','2','phase-2'), ('B2','9','3','phase-2'), ('B2','9','4','phase-2'), ('B2','9','5','phase-2'),
        ('B2','10','1','phase-2'), ('B2','10','2','phase-2'), ('B2','10','3','phase-2'), ('B2','10','4','phase-2'), ('B2','10','5','phase-2'),
        ('B2','11','1','phase-2'), ('B2','11','2','phase-2'), ('B2','11','3','phase-2'), ('B2','11','4','phase-2'), ('B2','11','5','phase-2'),
        ('C2','G','1','phase-2'), ('C2','G','2','phase-2'), ('C2','G','3','phase-2'), ('C2','G','4','phase-2'), ('C2','G','5','phase-2'),
        ('C2','1','1','phase-2'), ('C2','1','2','phase-2'), ('C2','1','3','phase-2'), ('C2','1','4','phase-2'), ('C2','1','5','phase-2'),
        ('C2','2','1','phase-2'), ('C2','2','2','phase-2'), ('C2','2','3','phase-2'), ('C2','2','4','phase-2'), ('C2','2','5','phase-2'),
        ('C2','3','1','phase-2'), ('C2','3','2','phase-2'), ('C2','3','3','phase-2'), ('C2','3','4','phase-2'), ('C2','3','5','phase-2'),
        ('C2','4','1','phase-2'), ('C2','4','2','phase-2'), ('C2','4','3','phase-2'), ('C2','4','4','phase-2'), ('C2','4','5','phase-2'),
        ('C2','5','1','phase-2'), ('C2','5','2','phase-2'), ('C2','5','3','phase-2'), ('C2','5','4','phase-2'), ('C2','5','5','phase-2'),
        ('C2','6','1','phase-2'), ('C2','6','2','phase-2'), ('C2','6','3','phase-2'), ('C2','6','4','phase-2'), ('C2','6','5','phase-2'),
        ('C2','7','1','phase-2'), ('C2','7','2','phase-2'), ('C2','7','3','phase-2'), ('C2','7','4','phase-2'), ('C2','7','5','phase-2'),
        ('C2','8','1','phase-2'), ('C2','8','2','phase-2'), ('C2','8','3','phase-2'), ('C2','8','4','phase-2'), ('C2','8','5','phase-2'),
        ('C2','9','1','phase-2'), ('C2','9','2','phase-2'), ('C2','9','3','phase-2'), ('C2','9','4','phase-2'), ('C2','9','5','phase-2'),
        ('C2','10','1','phase-2'), ('C2','10','2','phase-2'), ('C2','10','3','phase-2'), ('C2','10','4','phase-2'), ('C2','10','5','phase-2'),
        ('C2','11','1','phase-2'), ('C2','11','2','phase-2'), ('C2','11','3','phase-2'), ('C2','11','4','phase-2'), ('C2','11','5','phase-2'),
        ('D1','G','1','phase-3'), ('D1','G','2','phase-3'), ('D1','G','3','phase-3'), ('D1','G','4','phase-3'), ('D1','G','5','phase-3'),
        ('D1','1','1','phase-3'), ('D1','1','2','phase-3'), ('D1','1','3','phase-3'), ('D1','1','4','phase-3'), ('D1','1','5','phase-3'),
        ('D1','2','1','phase-3'), ('D1','2','2','phase-3'), ('D1','2','3','phase-3'), ('D1','2','4','phase-3'), ('D1','2','5','phase-3'),
        ('D1','3','1','phase-3'), ('D1','3','2','phase-3'), ('D1','3','3','phase-3'), ('D1','3','4','phase-3'), ('D1','3','5','phase-3'),
        ('D1','4','1','phase-3'), ('D1','4','2','phase-3'), ('D1','4','3','phase-3'), ('D1','4','4','phase-3'), ('D1','4','5','phase-3'),
        ('D1','5','1','phase-3'), ('D1','5','2','phase-3'), ('D1','5','3','phase-3'), ('D1','5','4','phase-3'), ('D1','5','5','phase-3'),
        ('D1','6','1','phase-3'), ('D1','6','2','phase-3'), ('D1','6','3','phase-3'), ('D1','6','4','phase-3'), ('D1','6','5','phase-3'),
        ('D1','7','1','phase-3'), ('D1','7','2','phase-3'), ('D1','7','3','phase-3'), ('D1','7','4','phase-3'), ('D1','7','5','phase-3'),
        ('D1','8','1','phase-3'), ('D1','8','2','phase-3'), ('D1','8','3','phase-3'), ('D1','8','4','phase-3'), ('D1','8','5','phase-3'),
        ('D1','9','1','phase-3'), ('D1','9','2','phase-3'), ('D1','9','3','phase-3'), ('D1','9','4','phase-3'), ('D1','9','5','phase-3'),
        ('D1','10','1','phase-3'), ('D1','10','2','phase-3'), ('D1','10','3','phase-3'), ('D1','10','4','phase-3'), ('D1','10','5','phase-3'),
        ('D1','11','1','phase-3'), ('D1','11','2','phase-3'), ('D1','11','3','phase-3'), ('D1','11','4','phase-3'), ('D1','11','5','phase-3'),
        ('E1','G','1','phase-3'), ('E1','G','2','phase-3'), ('E1','G','3','phase-3'), ('E1','G','4','phase-3'), ('E1','G','5','phase-3'),
        ('E1','1','1','phase-3'), ('E1','1','2','phase-3'), ('E1','1','3','phase-3'), ('E1','1','4','phase-3'), ('E1','1','5','phase-3'),
        ('E1','2','1','phase-3'), ('E1','2','2','phase-3'), ('E1','2','3','phase-3'), ('E1','2','4','phase-3'), ('E1','2','5','phase-3'),
        ('E1','3','1','phase-3'), ('E1','3','2','phase-3'), ('E1','3','3','phase-3'), ('E1','3','4','phase-3'), ('E1','3','5','phase-3'),
        ('E1','4','1','phase-3'), ('E1','4','2','phase-3'), ('E1','4','3','phase-3'), ('E1','4','4','phase-3'), ('E1','4','5','phase-3'),
        ('E1','5','1','phase-3'), ('E1','5','2','phase-3'), ('E1','5','3','phase-3'), ('E1','5','4','phase-3'), ('E1','5','5','phase-3'),
        ('E1','6','1','phase-3'), ('E1','6','2','phase-3'), ('E1','6','3','phase-3'), ('E1','6','4','phase-3'), ('E1','6','5','phase-3'),
        ('E1','7','1','phase-3'), ('E1','7','2','phase-3'), ('E1','7','3','phase-3'), ('E1','7','4','phase-3'), ('E1','7','5','phase-3'),
        ('E1','8','1','phase-3'), ('E1','8','2','phase-3'), ('E1','8','3','phase-3'), ('E1','8','4','phase-3'), ('E1','8','5','phase-3'),
        ('E1','9','1','phase-3'), ('E1','9','2','phase-3'), ('E1','9','3','phase-3'), ('E1','9','4','phase-3'), ('E1','9','5','phase-3'),
        ('E1','10','1','phase-3'), ('E1','10','2','phase-3'), ('E1','10','3','phase-3'), ('E1','10','4','phase-3'), ('E1','10','5','phase-3'),
        ('E1','11','1','phase-3'), ('E1','11','2','phase-3'), ('E1','11','3','phase-3'), ('E1','11','4','phase-3'), ('E1','11','5','phase-3'),
        ('F1','G','1','phase-3'), ('F1','G','2','phase-3'), ('F1','G','3','phase-3'), ('F1','G','4','phase-3'), ('F1','G','5','phase-3'),
        ('F1','1','1','phase-3'), ('F1','1','2','phase-3'), ('F1','1','3','phase-3'), ('F1','1','4','phase-3'), ('F1','1','5','phase-3'),
        ('F1','2','1','phase-3'), ('F1','2','2','phase-3'), ('F1','2','3','phase-3'), ('F1','2','4','phase-3'), ('F1','2','5','phase-3'),
        ('F1','3','1','phase-3'), ('F1','3','2','phase-3'), ('F1','3','3','phase-3'), ('F1','3','4','phase-3'), ('F1','3','5','phase-3'),
        ('F1','4','1','phase-3'), ('F1','4','2','phase-3'), ('F1','4','3','phase-3'), ('F1','4','4','phase-3'), ('F1','4','5','phase-3'),
        ('F1','5','1','phase-3'), ('F1','5','2','phase-3'), ('F1','5','3','phase-3'), ('F1','5','4','phase-3'), ('F1','5','5','phase-3'),
        ('F1','6','1','phase-3'), ('F1','6','2','phase-3'), ('F1','6','3','phase-3'), ('F1','6','4','phase-3'), ('F1','6','5','phase-3'),
        ('F1','7','1','phase-3'), ('F1','7','2','phase-3'), ('F1','7','3','phase-3'), ('F1','7','4','phase-3'), ('F1','7','5','phase-3'),
        ('F1','8','1','phase-3'), ('F1','8','2','phase-3'), ('F1','8','3','phase-3'), ('F1','8','4','phase-3'), ('F1','8','5','phase-3'),
        ('F1','9','1','phase-3'), ('F1','9','2','phase-3'), ('F1','9','3','phase-3'), ('F1','9','4','phase-3'), ('F1','9','5','phase-3'),
        ('F1','10','1','phase-3'), ('F1','10','2','phase-3'), ('F1','10','3','phase-3'), ('F1','10','4','phase-3'), ('F1','10','5','phase-3'),
        ('F1','11','1','phase-3'), ('F1','11','2','phase-3'), ('F1','11','3','phase-3'), ('F1','11','4','phase-3'), ('F1','11','5','phase-3'),
        ('C3','1','1','phase-4'), ('C3','1','2','phase-4'), ('C3','1','3','phase-4'), ('C3','1','4','phase-4'), ('C3','1','5','phase-4'),
        ('C3','2','1','phase-4'), ('C3','2','2','phase-4'), ('C3','2','3','phase-4'), ('C3','2','4','phase-4'), ('C3','2','5','phase-4'),
        ('C3','3','1','phase-4'), ('C3','3','2','phase-4'), ('C3','3','3','phase-4'), ('C3','3','4','phase-4'), ('C3','3','5','phase-4'),
        ('C3','4','1','phase-4'), ('C3','4','2','phase-4'), ('C3','4','3','phase-4'), ('C3','4','4','phase-4'), ('C3','4','5','phase-4'),
        ('C3','5','1','phase-4'), ('C3','5','2','phase-4'), ('C3','5','3','phase-4'), ('C3','5','4','phase-4'), ('C3','5','5','phase-4'),
        ('C3','6','1','phase-4'), ('C3','6','2','phase-4'), ('C3','6','3','phase-4'), ('C3','6','4','phase-4'), ('C3','6','5','phase-4'),
        ('C3','7','1','phase-4'), ('C3','7','2','phase-4'), ('C3','7','3','phase-4'), ('C3','7','4','phase-4'), ('C3','7','5','phase-4'),
        ('C3','8','1','phase-4'), ('C3','8','2','phase-4'), ('C3','8','3','phase-4'), ('C3','8','4','phase-4'), ('C3','8','5','phase-4'),
        ('C3','9','1','phase-4'), ('C3','9','2','phase-4'), ('C3','9','3','phase-4'), ('C3','9','4','phase-4'), ('C3','9','5','phase-4'),
        ('C3','10','1','phase-4'), ('C3','10','2','phase-4'), ('C3','10','3','phase-4'), ('C3','10','4','phase-4'), ('C3','10','5','phase-4'),
        ('C3','11','1','phase-4'), ('C3','11','2','phase-4'), ('C3','11','3','phase-4'), ('C3','11','4','phase-4'), ('C3','11','5','phase-4'),
        ('E2','1','1','phase-4'), ('E2','1','2','phase-4'), ('E2','1','3','phase-4'), ('E2','1','4','phase-4'), ('E2','1','5','phase-4'),
        ('E2','2','1','phase-4'), ('E2','2','2','phase-4'), ('E2','2','3','phase-4'), ('E2','2','4','phase-4'), ('E2','2','5','phase-4'),
        ('E2','3','1','phase-4'), ('E2','3','2','phase-4'), ('E2','3','3','phase-4'), ('E2','3','4','phase-4'), ('E2','3','5','phase-4'),
        ('E2','4','1','phase-4'), ('E2','4','2','phase-4'), ('E2','4','3','phase-4'), ('E2','4','4','phase-4'), ('E2','4','5','phase-4'),
        ('E2','5','1','phase-4'), ('E2','5','2','phase-4'), ('E2','5','3','phase-4'), ('E2','5','4','phase-4'), ('E2','5','5','phase-4'),
        ('E2','6','1','phase-4'), ('E2','6','2','phase-4'), ('E2','6','3','phase-4'), ('E2','6','4','phase-4'), ('E2','6','5','phase-4'),
        ('E2','7','1','phase-4'), ('E2','7','2','phase-4'), ('E2','7','3','phase-4'), ('E2','7','4','phase-4'), ('E2','7','5','phase-4'),
        ('E2','8','1','phase-4'), ('E2','8','2','phase-4'), ('E2','8','3','phase-4'), ('E2','8','4','phase-4'), ('E2','8','5','phase-4'),
        ('E2','9','1','phase-4'), ('E2','9','2','phase-4'), ('E2','9','3','phase-4'), ('E2','9','4','phase-4'), ('E2','9','5','phase-4'),
        ('E2','10','1','phase-4'), ('E2','10','2','phase-4'), ('E2','10','3','phase-4'), ('E2','10','4','phase-4'), ('E2','10','5','phase-4'),
        ('E2','11','1','phase-4'), ('E2','11','2','phase-4'), ('E2','11','3','phase-4'), ('E2','11','4','phase-4'), ('E2','11','5','phase-4'),
        ('F2','1','1','phase-4'), ('F2','1','2','phase-4'), ('F2','1','3','phase-4'), ('F2','1','4','phase-4'), ('F2','1','5','phase-4'),
        ('F2','2','1','phase-4'), ('F2','2','2','phase-4'), ('F2','2','3','phase-4'), ('F2','2','4','phase-4'), ('F2','2','5','phase-4'),
        ('F2','3','1','phase-4'), ('F2','3','2','phase-4'), ('F2','3','3','phase-4'), ('F2','3','4','phase-4'), ('F2','3','5','phase-4'),
        ('F2','4','1','phase-4'), ('F2','4','2','phase-4'), ('F2','4','3','phase-4'), ('F2','4','4','phase-4'), ('F2','4','5','phase-4'),
        ('F2','5','1','phase-4'), ('F2','5','2','phase-4'), ('F2','5','3','phase-4'), ('F2','5','4','phase-4'), ('F2','5','5','phase-4'),
        ('F2','6','1','phase-4'), ('F2','6','2','phase-4'), ('F2','6','3','phase-4'), ('F2','6','4','phase-4'), ('F2','6','5','phase-4'),
        ('F2','7','1','phase-4'), ('F2','7','2','phase-4'), ('F2','7','3','phase-4'), ('F2','7','4','phase-4'), ('F2','7','5','phase-4'),
        ('F2','8','1','phase-4'), ('F2','8','2','phase-4'), ('F2','8','3','phase-4'), ('F2','8','4','phase-4'), ('F2','8','5','phase-4'),
        ('F2','9','1','phase-4'), ('F2','9','2','phase-4'), ('F2','9','3','phase-4'), ('F2','9','4','phase-4'), ('F2','9','5','phase-4'),
        ('F2','10','1','phase-4'), ('F2','10','2','phase-4'), ('F2','10','3','phase-4'), ('F2','10','4','phase-4'), ('F2','10','5','phase-4'),
        ('F2','11','1','phase-4'), ('F2','11','2','phase-4'), ('F2','11','3','phase-4'), ('F2','11','4','phase-4'), ('F2','11','5','phase-4')
) AS v(b, f, n, ph);

-- Pre-flight assert 2: exactly 690 flats were seeded.
DO $$
DECLARE
    flat_count integer;
BEGIN
    SELECT COUNT(*) INTO flat_count FROM "flats";
    IF flat_count <> 690 THEN
        RAISE EXCEPTION 'finance_foundations: expected 690 flats, found %', flat_count;
    END IF;
END
$$;

-- Seed: finance categories (system rows cannot be deleted, only hidden).
INSERT INTO "finance_categories" ("id", "name", "nameAr", "type", "sortOrder", "isSystem", "updatedAt") VALUES
    ('fc_expense_security', 'Security', 'الأمن', 'EXPENSE', 10, true, CURRENT_TIMESTAMP),
    ('fc_expense_cleaning', 'Cleaning', 'النظافة', 'EXPENSE', 20, true, CURRENT_TIMESTAMP),
    ('fc_expense_gardening', 'Gardening', 'تنسيق الحدائق', 'EXPENSE', 30, true, CURRENT_TIMESTAMP),
    ('fc_expense_elevators', 'Elevators', 'المصاعد', 'EXPENSE', 40, true, CURRENT_TIMESTAMP),
    ('fc_expense_utilities', 'Utilities (electricity, water)', 'المرافق (كهرباء ومياه)', 'EXPENSE', 50, true, CURRENT_TIMESTAMP),
    ('fc_expense_repairs', 'Repairs and maintenance', 'الإصلاحات والصيانة', 'EXPENSE', 60, true, CURRENT_TIMESTAMP),
    ('fc_expense_insurance', 'Insurance', 'التأمين', 'EXPENSE', 70, true, CURRENT_TIMESTAMP),
    ('fc_expense_admin', 'Admin and office', 'الإدارة والمكتب', 'EXPENSE', 80, true, CURRENT_TIMESTAMP),
    ('fc_expense_refunds', 'Resident refunds', 'مبالغ مردودة للسكان', 'EXPENSE', 90, true, CURRENT_TIMESTAMP),
    ('fc_expense_other', 'Other', 'أخرى', 'EXPENSE', 100, true, CURRENT_TIMESTAMP),
    ('fc_revenue_service_charges', 'Service charges', 'رسوم الخدمات', 'REVENUE', 10, true, CURRENT_TIMESTAMP),
    ('fc_revenue_parking', 'Parking', 'مواقف السيارات', 'REVENUE', 20, true, CURRENT_TIMESTAMP),
    ('fc_revenue_gate_cards', 'Gate cards and access', 'بطاقات البوابة والدخول', 'REVENUE', 30, true, CURRENT_TIMESTAMP),
    ('fc_revenue_gym', 'Gym and facilities', 'النادي والمرافق', 'REVENUE', 40, true, CURRENT_TIMESTAMP),
    ('fc_revenue_common_rent', 'Rent of common areas', 'إيجار المناطق المشتركة', 'REVENUE', 50, true, CURRENT_TIMESTAMP),
    ('fc_revenue_other', 'Other income', 'إيرادات أخرى', 'REVENUE', 60, true, CURRENT_TIMESTAMP);

-- Seed: settings (January fiscal year, due day 10, approval threshold 5000 EGP).
INSERT INTO "finance_settings" ("key", "value", "updatedAt") VALUES
    ('expense.approvalThreshold', to_jsonb(5000), CURRENT_TIMESTAMP),
    ('fiscal.yearStartMonth', to_jsonb(1), CURRENT_TIMESTAMP),
    ('billing.defaultDueDay', to_jsonb(10), CURRENT_TIMESTAMP);

-- Backfill 1: link every existing resident_unit whose normalised key is a known flat.
-- Unknown keys keep flatId NULL (the text columns remain the fallback).
UPDATE "resident_units" ru
   SET "flatId" = f."id"
  FROM "flats" f
 WHERE f."building" = upper(btrim(ru."building", E' \t\r\n'))
   AND f."floor" = upper(btrim(ru."floor", E' \t\r\n'))
   AND f."flatNumber" = btrim(ru."flatNumber", E' \t\r\n');

-- Backfill 2: link listings (any status). Informational only: no uniqueness assert,
-- unknown keys keep flatId NULL.
UPDATE "listings" l
   SET "flatId" = f."id"
  FROM "flats" f
 WHERE f."building" = upper(btrim(l."building", E' \t\r\n'))
   AND f."floor" = upper(btrim(l."floor", E' \t\r\n'))
   AND f."flatNumber" = btrim(l."flatNumber", E' \t\r\n');

DO $$
DECLARE
    unknown_units integer;
    unknown_listings integer;
BEGIN
    SELECT COUNT(*) INTO unknown_units FROM "resident_units" WHERE "flatId" IS NULL;
    SELECT COUNT(*) INTO unknown_listings FROM "listings" WHERE "flatId" IS NULL;
    IF unknown_units > 0 THEN
        RAISE NOTICE 'finance_foundations: % resident_units row(s) have an unknown flat key (flatId left NULL)', unknown_units;
    END IF;
    IF unknown_listings > 0 THEN
        RAISE NOTICE 'finance_foundations: % listing(s) have an unknown flat key (flatId left NULL)', unknown_listings;
    END IF;
END
$$;

-- Backfill 3: one OPEN ownership period per linked unit of a non-deleted user, dated
-- 1900-01-01 ("owned since before finance go-live"). A soft-deleted user gets none:
-- the invariant is "open period <=> unit exists AND user not deleted"; restoring the
-- account reopens it (slice 5).
INSERT INTO "flat_ownerships" ("id", "fromDate", "flatId", "userId")
SELECT 'fo_' || ru."id", DATE '1900-01-01', ru."flatId", ru."userId"
  FROM "resident_units" ru
  JOIN "users" u ON u."id" = ru."userId"
 WHERE ru."flatId" IS NOT NULL
   AND u."deletedAt" IS NULL;

-- The one SQL definition of a "live" payment's dated columns (plan 2.1.1). The caller
-- applies the as-of date D: receivedAt <= D AND (status = 'POSTED' OR voidedAt > D)
-- AND (bouncedAt IS NULL OR bouncedAt > D). Phase 2 replaces it with CREATE OR REPLACE
-- VIEW, appending the refund columns last. security_invoker makes it run with the
-- caller's rights so RLS on `payments` applies; payerName and note are not exposed.
CREATE OR REPLACE VIEW public.finance_live_payments WITH (security_invoker = true) AS
SELECT
    p."id",
    p."receiptNo",
    p."flatId",
    p."amount",
    p."method",
    p."chequeState",
    p."isOpening",
    p."status",
    p."receivedAt",
    p."clearedAt",
    p."bouncedAt",
    p."voidedAt",
    p."createdAt"
FROM public."payments" p;

-- Revoke from the Supabase API roles only when both exist (plain Postgres: local
-- docker, CI, the migrated test DB: has neither, and a bare REVOKE would fail).
DO $$
DECLARE
    supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
    IF supabase_roles THEN
        REVOKE ALL ON public.finance_live_payments FROM anon, authenticated;
    END IF;
END
$$;
