-- Owner decision (2026-10-04): the project owner is the single SUPER_ADMIN.
-- No-op when the account does not exist. No API can grant SUPER_ADMIN.
UPDATE "users" SET "role" = 'SUPER_ADMIN' WHERE "email" = 'ahmed.muhammed.elsaid@gmail.com';
