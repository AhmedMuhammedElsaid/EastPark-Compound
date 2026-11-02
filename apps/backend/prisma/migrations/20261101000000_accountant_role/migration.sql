-- Adds the ACCOUNTANT role. Kept alone in its own migration: PostgreSQL cannot
-- use a newly added enum value inside the transaction that added it, so
-- nothing else in this migration (or any statement that runs with it) may
-- reference 'ACCOUNTANT'.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
