-- Adds the SUPER_ADMIN role. Kept alone in its own migration: PostgreSQL cannot
-- use a newly added enum value inside the transaction that added it.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
