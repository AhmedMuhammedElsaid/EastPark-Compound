# Accounting Phase 1a: implementation slices

Source: `ACCOUNTING-PLAN.md` rev 5, §10 and Q21. Section 11 defaults apply (690 flats, January fiscal year,
`O-` series).

**Ground rules**
- Every gate stays green: backend validate/tsc/eslint/jest, web check, mobile tsc/eslint/jest.
- One Opus review per slice, before the next slice starts.
- Build on `feature/flat-listings`; `20261031000000_flat_listings` reaches prod no later than slice 4.
- Prod DB untouched; migrations deploy only when the owner pushes.
- **Real-DB tests:** CI has no Postgres and backend jest is mock-only. Concurrency, view and migration specs go
  in `test/db/*.db-spec.ts` (new `test/jest.db.json`, local docker Postgres, skipped without
  `TEST_DATABASE_URL`). Each slice lists the db-specs it ran.

| # | Slice | Days | Deploy |
|---|---|---|---|
| 1 | ACCOUNTANT enum + backend role plumbing | 1.5 | ships with 2 |
| 2 | Web + mobile role plumbing, confinement, placeholder landings | 2 | ships with 1 |
| 3 | Flat layout, key normaliser, preflight SQL, unit/lead key repair | 1.5 | safe alone (preparatory release) |
| 4 | `finance_foundations` migration + schema | 2 | ships with 5 |
| 5 | Ownership writers + listings link | 2 | ships with 4 |
| 6 | Finance kernel: audit writer, dates, period lock, counter, idempotency, flats read, charges | 3 | safe alone (after 4+5) |
| 7 | Payments: allocation, receipts, void, cheques, credit, private attachments | 3.5 | safe alone (bucket must exist) |
| 8 | Accountant UI: web `/finance` desk + mobile `(finance)` screens | 3.5 | safe alone |

Total about 19 days: the guards and the role ripple all land in 1a.

## Slice 1: ACCOUNTANT enum + backend role plumbing (2 commits)

- **Migration:** hand-written `2026110x000000_accountant_role`, containing only
  `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';`. Nothing else may use the value.
- **Files:** `schema.prisma`; `roles.ts` (`isFinanceRole`); `auth.service.ts` (`ROLE_RANK` plus the
  ACCOUNTANT-only-over-RESIDENT rule, otherwise `roleConflict`); the invitation DTO; `ASSIGNABLE_ROLES`; the 5
  notification routes; `ANY_USER`; the 3 feedback routes. Comments, orders and `DELETE /user` stay unchanged.
- **Tests:** `role-matrix.spec`, table-driven over `@AllowedRoles`: it fails on unreviewed RESIDENT-but-not-
  ACCOUNTANT routes and on any ADMIN route that admits ACCOUNTANT. Plus invitation roleConflict cases.
- **Review focus:** the migration is enum-only; ACCOUNTANT never satisfies ADMIN.
- **Risk:** without slice 2, an accountant lands on resident screens. Send no invite before then.

## Slice 2: Web + mobile role plumbing and confinement (3 commits: web, mobile, mobile Home/Profile)

- **Web:** `lib/auth/roles.ts`, `contracts.ts`; `access-policy.ts` (`FINANCE_ROLE_OPEN_PREFIXES`,
  `isPathAllowedForRole`, `/finance` and `/api/finance` denied, ACCOUNTANT not unrestricted); `proxy.ts` (read
  the role first; matcher gains `/finance` and `/directory`); `ComingSoon.tsx`; `return-path.ts`;
  `finance.server.ts` (`getFinanceSession`); a guarded placeholder `app/finance`.
- **Mobile:** `lib/roles.ts`, `auth-slice.ts`, `api/admin.ts`, `session.ts` (`/finance/today`),
  `use-guest-gate.ts`, `(tabs)/_layout.tsx` (`lockedFor`), `resident-home.tsx` (§8.3 N-4 tiles, "See all",
  cards), Profile (hide "My orders", add "Open Finance"), `(finance)/_layout.tsx` plus a placeholder
  `finance/today.tsx` (no `index`), AR and EN strings.
- **Tests:** web access-policy (the 8.1 point 6 matrix), return-path, roles; mobile guest-gate, Home and
  Profile tests (outside `src/app/`), and the route-collisions `/finance/` case. Run `expo export`.
- **Review focus:** resident and merchant behaviour unchanged; an accountant reaches no `/admin`, `/orders` or
  `/directory`.
- **Risk:** the proxy rewrite touches every route; the OTA reaches builds v11 and later only.

## Slice 3: Flat layout, preflight and key repair (preparatory release, 3 commits)

- **Files:**
  - New `src/common/finance/compound-layout.ts`: the 690 keys from one constant mirroring
    `apps/web/src/config/compound.ts`.
  - `normaliseFlatKey()`: upper-trim building and floor, trim the flat number.
  - `prisma/scripts/check-flat-keys.sql`: read-only, counts only. `resident_units` reports unknown rows and
    collisions; leads and listings report unknown rows and informational active collisions.
  - Lead DTO validation against the layout.
  - `PATCH /admin/resident-units/:id` (SUPER_ADMIN, audited key edit, `unknownFlat`/`alreadyOwned`).
  - `PATCH /admin/residents/leads/:id` (audited unit edit).
  - `FLAT_KEY_STRICT` config, default off.
- **Tests:** the layout count is 690 and matches the web constants; `normaliseFlatKey` cases; lead validation;
  the unit PATCH role and conflicts; the SQL key list equals the generator output.
- **Review focus:** the SQL is read-only and leaks no PII. Lead validation only rejects new bad input and
  never breaks approval of existing leads.
- **Risk:** stricter lead validation can reject a real flat the layout misses. That is why Q1 (690 flats) is
  confirmed first.
- **Owner step after deploy:** run `psql "$DIRECT_DATABASE_URL" -f prisma/scripts/check-flat-keys.sql` and fix
  every `resident_units` collision before slice 4 ships.

## Slice 4: `finance_foundations` migration (2 commits: schema + SQL, then tests)

- **Generation:** offline only, with `prisma migrate diff --from-schema-datamodel <HEAD schema>
  --to-schema-datamodel prisma/schema.prisma --script`, then edited by hand. **WARNING:** `migrate dev` drops
  `listings_active_unit_key` and `resident_leads_active_unit_key`; strip any such `DROP`. New partial indexes
  get the WARNING comment block in `schema.prisma`.
- **Contents:**
  - **Tables:** all of the 2.4 Phase 1 tables and their enums. `Payment` carries `requestKey`, `requestHash`,
    `isOpening` and `replacesId`; `FundEntry` has no `expense_id`. The 1b tables ship now (2.3.1 allows two
    Phase 1 migrations).
  - Nullable `ResidentUnit.flatId` and `Listing.flatId` (`SetNull`, indexed).
  - `CHECK (amount > 0)` on money tables.
  - Partial uniques: `flat_ownership_one_open`, `billing_runs_period_key`, the committed `fileHash`,
    committed `import_rows.flat_id`.
  - **Seeds:** 690 flats, categories, and settings (January, due day 10, threshold 5000).
  - **`DO $$` checks:** `RAISE EXCEPTION` on `flats <> 690` or any `resident_units` collision; `RAISE NOTICE`
    for unknown keys. Listings never get a uniqueness assert.
  - **Backfill:** both `flat_id` columns, plus a `1900-01-01` ownership row per linked unit of a non-deleted
    user.
  - `finance_live_payments` view (`security_invoker`, guarded `REVOKE`); RLS on every table; no reference to
    `ACCOUNTANT`.
- **Tests:**
  - `migrations-keep-partial-indexes.spec` (runs in CI).
  - `finance-foundations.db-spec`: count, collision abort, notice, backfill, deleted user.
  - `finance-view-privileges.db-spec`.
- **Review focus:** go through the migration SQL line by line, the index survival, the backfill invariant, and
  the seed key list matching slice 3.
- **Risk:** if this migration fails on Render, every deploy blocks. Recovery is `migrate resolve
  --rolled-back`. Take a prod backup first.
- **Must ship with slice 5:** without the slice 5 writers, a new unit has no `flatId` and no period, and the
  invariant breaks.

## Slice 5: Ownership writers + listings link (2 commits)

- **Files:** new `FlatOwnershipService`, called inside each writer's transaction:
  - open: `auth.service.ts:405`, `residents.service.ts:272`, `resident-units.service.ts:112`;
  - close: `:171` (SOLD/REMOVED) and `deleteUser` (ACCOUNT_DELETED, in its existing `$transaction`);
  - reopen: `restoreUser` (`trash.service.ts:294`, now a `$transaction`);
  - the unit PATCH gains link-and-open.
  - `ListingsService` sets `flatId`; `FLAT_KEY_STRICT` throws on an unknown key.
- **Tests:** the ownership invariant over fixtures (delete/restore, delete then path 4 then restore, the
  three link cases), plus listing `flatId`.
- **Review focus:** every writer is covered; session `bump` stays outside the transactions.
- **Risk:** live onboarding; a regression blocks invitations.

## Slice 6: Finance kernel (3 commits)

- **Files:** `src/modules/finance/`, with staff routes `[ACCOUNTANT, ADMIN]`.
  - `cairo-date.ts`.
  - `FinanceAuditService`, plus `FINANCE_AUDIT_ACTIONS` hidden from `listActivity` by default.
  - Helpers: period lock, receipt counter (single and bulk), idempotency (P2002 re-read).
  - `livePaymentWhere(asOf)`, balance, credit.
  - Endpoints: `GET /finance/flats[/:id[/ownership]]`, `POST /finance/charges[/:id/void]`, and the
    audit, periods and settings reads.
  - `en/finance.json`; the accountant DTO carries no email or national id.
- **Tests:** the Cairo boundary and DST; one audit row per posting, and a forced audit failure that rolls the
  posting back; a void by another accountant or on a later day is refused; `periodClosed`; db-specs for counter
  gaps under rollback and parallel posts, and for period lock against a raw-SQL close.
- **Review focus:** lock order (period, flat, charges, counter), no float maths, the audit is atomic.
- **Risk:** this sets the patterns every later slice copies, so review it hardest.

## Slice 7: Payments and private attachments (3 commits)

- **Files:**
  - `POST /finance/payments`: idempotent; auto allocation oldest-due first, skipping deposits; explicit
    allocations; `duplicateReference` warning with a `force` override.
  - Payment list and detail; void with cascade; dated `cheque-cleared`/`cheque-bounced`; `apply-credit`.
  - `PrivateFileService`, attachment upload and signed-url routes (audited), bucket config, the `staging/`
    sweep, and `redact`.
- **Tests:** allocation over-allocation errors; the invariant `balance = open − credit`; the void cascade; two
  identical parallel requests produce one row (db-spec); "close October, bounce in November" (db-spec);
  `isStoragePublicUrl` rejects finance paths; the two-accountant concurrency case.
- **Review focus:** the as-of predicates in one place, the gap-free counter, the signed-URL authorisation.
- **Risk:** the backend boot check needs the private bucket. The owner creates `eastpark-finance` before
  deploy.

## Slice 8: Accountant UI (3 commits: web BFF, web pages, mobile)

- **Web:** `app/api/finance/**` BFF (forwards `Idempotency-Key`; attachments use a multipart passthrough with
  a 302 to the signed URL), and `app/finance/` pages: minimal dashboard, `flats`, `flats/[id]` (ledger as
  lines, add charge, apply credit), `payments`, `payments/new`, `audit`, all AR+EN.
- **Mobile:** `(finance)/finance/{today,flats/index,flats/[id],payment/new}.tsx`, `services/api/finance.ts`,
  the camera slip via `expo-image-picker` (`quality: 0.6`), and the admin overview "Finance" row.
- **Tests:** vitest for the BFF header forwarding; jest for the payment form idempotency key reuse on retry;
  route-collision snapshot rows.
- **Review focus:** no cached money screens, keys reused on retry, design tokens.
- **Risk:** none for live users. Accountant screens only.

## Blocking owner questions

1. **Privacy policy timing.** 1a shows residents nothing, and statements arrive in 1b. Can the finance
   section of the privacy policy ship with 1b? §10 says "Phase 1" without anticipating the split.
2. **Slip photos.** 1a stores payment-slip photos on staff accounts, and the policy does not yet mention
   them. Is that acceptable before the policy update?

Non-question gates: the owner runs the slice 3 preflight, then creates `eastpark-finance` before slice 7.
