# ACCOUNTING-PLAN.md — Re-review 2 (2026-10-31)

Read-only review of the revised plan against the code on `feature/flat-listings`.

## 1. Were the 24 earlier findings resolved?

Mostly yes. Each of the 24 fixes listed in the summary now appears in the plan body: the in-transaction
`FinanceAuditService`, `(finance)/today`, `flatId` plus `FlatOwnership`, `sendMany`, enum-only migrations, the fund
opening balance, `ImportRow` uniqueness, `allocatedAt`/`voidedAt`, credit reservation, `Payment.requestKey`, cheque
states, `/home/finance/*`, the HTML print path, and Q16–Q21. The residual problems are leftovers the edits
missed (stale text, enums that were not updated, phase placement) and a few new correctness gaps. They are listed
below.

Verified claims (code matches the plan):
- `AuditService.record` returns early for non-admins: `apps/backend/src/modules/audit/audit.service.ts:31`; it swallows errors in the `catch` at `:42`.
- `ROLE_RANK: Record<Role, number>`: `apps/backend/src/common/auth/services/auth.service.ts:52`.
- Notification routes `[RESIDENT, MERCHANT, ADMIN]`: `notifications.controller.ts:38,51,61,71,93`.
- `ANY_USER` has no ACCOUNTANT: `uploads/upload-purpose.ts:11`.
- `send()` handles one user per call (`findUnique`): `notifications.service.ts:30,53`.
- Three `ResidentUnit` write paths: `auth.service.ts:405`, `residents.service.ts:272`, `resident-units.service.ts:112`; the hard delete is at `:171`.
- `UNRESTRICTED_ROLES` (`access-policy.ts:24`); `OPEN_PAGE_PREFIXES` (`:66`).
- `KNOWN_COLLISIONS` (`route-collisions.test.ts:29`).
- `ROLE_HOME_ROUTE` (`session.ts:31`).
- `ID_KEY_BY_TYPE`/`ROUTE_BY_TYPE` (`routing.ts:22,31`).
- `UserRole` (`lib/roles.ts:7`).
- `Role` and `NotificationType` enums (`schema.prisma:21,76`); `NotificationType` already has `LISTING_UPDATE`.

## 2. Findings

### Critical

**C1 — Bounced cheques still count as paid in the balance (§2.1 vs §3.8, §3.5).**
- Problem: §2.1 defines the balance as `sum(non-void charges) − sum(non-void payments)`. §3.8 says a bounce "is not a void, it is a state", so a BOUNCED payment stays `status = POSTED`. The flat's balance therefore stays reduced by the bounced amount. At the same time aging (which is allocation-based) shows the charges as open again. The flat looks settled on its statement and on `/me/finance` while the arrears report says it owes, and the R5 and R6 figures disagree.
- Fix: define one canonical predicate, "live payment" = `status = POSTED AND chequeState <> 'BOUNCED'`. Put it in a single SQL helper that balance, statement, credit, R3/R5/R6 and the brought-forward line all use. Add a test: a bounced cheque restores the balance and the aging to identical figures.

**C2 — Mobile `/flats` collides with the listings tab on this branch (§8.3, Phase 1 Mobile).**
- Problem: `apps/mobile/src/app/(tabs)/flats/_layout.tsx` (untracked, `feature/flat-listings`) already produces `/flats`. `(finance)/flats` would resolve to the same URL. That is the `1479c9e` launch-bug class, and `route-collisions.test.ts:29` fails. The plan states "`/flats` is free".
- Fix: put every staff finance screen under a literal folder: `(finance)/finance/today`, `/finance/flats`, `/finance/flats/[id]`, `/finance/payment/new`, and so on. `ROLE_HOME_ROUTE.ACCOUNTANT = "/finance/today"`. Drop the "grep first" hedge.

### High

**H1 — Fund tables and fields are used in Phase 1 but defined in Phase 2 (§4.6, §2.4, §10).**
- Problem: the Phase 1 opening import creates `DEPOSIT_IN` `FundEntry` rows with `countsInFundTotal = false`, and Phase 1 ships `POST /finance/fund/opening-balance`. But `FundEntry` is created in the Phase 2 migration `..._finance_ledgers`.
- Problem: `isOpening` is said to be "Phase 2, or put it in Phase 1".
- Problem: `countsInFundTotal` is missing from the FundEntry field table (it appears only in prose).
- Problem: `OPENING_BALANCE` is listed in the FundEntry kind column but is **absent from `enum FundEntryKind`** in §2.3.
- Problem: `holding` is an inline enum with no name.
- Fix: move `FundEntry` (with `countsInFundTotal`, `holding FundHolding`, and `OPENING_BALANCE` in `FundEntryKind`) plus `Payment.isOpening` into `..._finance_foundations`, and list them in the §2.4 table.

**H2 — Migration names and count disagree (§2.3 vs §10 Phase 1).**
- Problem: §2.3 names `..._accountant_role` and makes `FINANCE_UPDATE` a Phase 3 migration.
- Problem: §10 names `..._finance_role` and lists "three migrations" in Phase 1, the third being `..._finance_notification_type`.
- Problem: Phase 3 also lists "notification preference defaults", which §2.3 and §6.4 forbid.
- Fix: one list in §2.3, referenced from §10. Remove "notification preference defaults" from Phase 3.

**H3 — The `ResidentUnit.flatId` link and backfill break the zero-diff rule and the live listings index (§2.2, §10).**
- Problem: the `flatId` backfill runs inside a schema migration. If the normalisation finds collisions (two rows that map to the same flat), it silently links both. The plan relies on the diagnostic, but the migration itself does not assert.
- Problem: `prisma migrate dev` on this branch already proposes dropping `listings_active_unit_key` (`schema.prisma`, warning above `model Listing`). Any finance migration generated with `migrate dev` will carry that DROP plus the new raw partial indexes.
- Fix: (a) generate the finance migrations offline (`migrate diff`), and hand-check that they neither drop `listings_active_unit_key` nor `resident_leads_active_unit_key`; (b) in the backfill SQL, `RAISE EXCEPTION` if any normalised key maps to more than one `resident_units` row, or if the count of `Flat` rows is not 690.

**H4 — Listings use the same free-text flat key but are not linked (§2.2, new on this branch).**
- Problem: `Listing` has its own free-text `building/floor/flatNumber` (`schema.prisma`, listings block). Only `ResidentUnit` gets `normaliseFlatKey()` and `flatId`. A listing for `a1-3-2` and the finance `Flat` `A1-3-2` will never be joined. Q16 (clearance before transfer) is the obvious place to warn about arrears when a SELL listing is approved.
- Fix: say explicitly that `Listing` stays unlinked in v1, or add a nullable `Listing.flatId` set through the same helper. Either way, apply the shared `normaliseFlatKey()` in listings creation as well, so both modules validate against the 690-flat layout.

**H5 — Q3's default contradicts the decided design (§11 Q3 vs §2.2, §6.4, §9).**
- Problem: Q3's default is "Yes, full history" for the new owner. §2.2, §6.4 and §9 decide "brought forward line only, no seller payments". Silence from the owner means the default is used, which reintroduces the privacy leak §9 just fixed.
- Fix: change the Q3 default to "No: one Balance brought forward line".

**H6 — The `FlatOwnership` write rule has no hook for account deletion, and the backfill `fromDate` misdates history (§2.2, §2.4, §9).**
- Problem: `closedReason ACCOUNT_DELETED` exists, but `UserService.deleteUser` (`user.service.ts`, soft-delete) is not among the "three code paths". A soft-deleted owner keeps an open period and stays a push recipient in `sendMany`. `sendMany` filters `deletedAt`, but `/me/finance/flats` would still list the flat as current.
- Problem: the backfill uses `ResidentUnit.createdAt`. For pre-existing owners that is the app-registration date, not the purchase date. Every opening-import line dated `as_of` before it is hidden from the real owner. Today almost all owners registered after go-live of the app, but before the finance `as_of`, so their own opening charges fall outside their period.
- Fix: (a) add `deleteUser` (and restore) to the ownership writers; (b) backfill `fromDate = '1900-01-01'` (or `min(as_of)`) for owners present at cut-over, documented as "owned since before finance go-live".

**H7 — A credit refund never leaves the flat balance (§2.1, §3.5).**
- Problem: the balance is `charges − payments`. A refund paid out as an Expense with `refundFlatId` lowers *credit* (§3.5 formula) but not the *balance*. After refunding 1,200 the statement still shows −1,200, and balance ≠ −credit.
- Fix: balance = `charges − live payments + approved refund expenses`. Show the refund as a statement line ("Refund paid, E-2026-…"). Put it in the same helper as C1.

**H8 — Staff `/finance` is not blocked for residents today (§8.1 "Careful points").**
- Problem: the plan says staff `/finance/*` "stays blocked for residents through `BLOCKED_PAGE_PREFIXES` and `BLOCKED_API_PREFIXES`". Neither list contains `/finance` or `/api/finance` (`access-policy.ts:32-58`), and they are deny lists. So unless the change adds them, a resident can open the staff pages at the proxy. Only the backend 403 would remain.
- Problem: putting ACCOUNTANT into `UNRESTRICTED_ROLES` also opens `/orders`, `/cart`, `/checkout`, and the `/merchant` and `/admin` shells to accountants. Their backend routes exclude ACCOUNTANT, so they get broken 403 pages.
- Fix: add `/finance` to `BLOCKED_PAGE_PREFIXES` and `/api/finance` to `BLOCKED_API_PREFIXES`. Use `/api/me/finance`, which does not match. Replace "unrestricted" with a per-role allow-list: finance roles get the open prefixes plus `/finance` and `/api/finance`. Pin both in `access-policy.test.ts`.

**H9 — Period close races a concurrent posting (§3.2, §3.4).**
- Problem: FiscalPeriod rows are lazy ("missing row = OPEN"), so a posting has nothing to lock. A payment transaction can read OPEN, an admin closes the month, and then the payment commits into the closed period. A report published from that month then disagrees with the ledger.
- Fix: every posting upserts its `fiscal_periods` row and takes `FOR SHARE` on it. Close takes `FOR UPDATE`. Add it as step 0 of the lock order in §3.4 (period, then flat, then charges, then counter), and add a concurrency test.

### Medium

**M1 — Idempotency columns are missing outside Payment and BillingRun (§3.3 vs §2.4).**
- Problem: §3.3 applies `requestKey` to expenses, revenues and fund entries (and §10 adds a "shortfall `requestKey`"). The Expense, Revenue and FundEntry tables have no such column.
- Problem: `idempotencyConflict` needs a stored request hash, and there is none.
- Problem: the concurrent same-key race (both requests miss the find, one hits P2002) is not specified.
- Fix: add `requestKey @unique` and `requestHash` to those tables. On P2002 for `requestKey`, re-read and return the original, or return `idempotencyConflict` when the hash differs.

**M2 — The FINANCE_UPDATE deep link path disagrees (§6.4 vs §8.3).**
- Problem: §6.4 routes to `/(tabs)/profile/finance/reports/<id>`. §8.3 creates `(tabs)/profile/finance-reports/[id]`.
- Fix: pick one, ideally `(tabs)/profile/finance/index` plus `finance/reports/[id]`, and add a `routing.test.ts` case.

**M3 — Quarterly and annual runs have no `accrualPeriod` mapping (§2.4 BillingRun/Charge, Q20).**
- Problem: `BillingRun.period` may be `YYYY-Qn` or `YYYY`. `Charge.accrualPeriod` and `FiscalPeriod` are `YYYY-MM`, so the "period OPEN" check and accrual reports are undefined for those runs.
- Fix: map to the first month of the run's period (or the month of `dueDate`) and state it.

**M4 — A bounce or clearance date can fall in a closed period (§3.8, §7.2 `{ date? }`).**
- Problem: the plan asserts that `bouncedAt` "falls in the open period", but the endpoint accepts a client date.
- Fix: validate the date against period status (`periodClosed`). Default the date to today.

**M5 — Day and year boundaries have no timezone (§3.4, §3.6).**
- Problem: "Same calendar day" voids, the receipt year from `receivedAt`, and `YYYY-MM` periods all depend on the timezone. Render runs in UTC; Cairo is UTC+2/+3.
- Fix: derive all finance dates in `Africa/Cairo` through one helper, and store `Date` columns as Cairo-local dates.

**M6 — Rejecting unknown flats breaks the live lead approval flow (§2.2).**
- Problem: once `unit.error.unknownFlat` is on, the existing leads typed as free text ("Building A" in the DTO example) fail at approval (`residents.service.ts:272`) and at invitation acceptance (`auth.service.ts:405`).
- Fix: validate in `resident-lead.create.dto.ts` first, and run the diagnostic over `resident_leads` (PENDING/INVITED) as well. Give admins a way to correct a lead's unit before approving it.

**M7 — PublishedReport schema gaps (§2.4 vs §6.4, §7.6).**
- Problem: `approvalRef` is used on publish but is not a field.
- Problem: "marked superseded" has no status value; `PublishStatus` has none.
- Fix: add `approvalRef String?`. Either add a `SUPERSEDED` status or state that "superseded" is derived from a newer row's `supersedesId`.

**M8 — Finance actions flood the admin activity feed (§3.7).**
- Problem: hundreds of `PAYMENT_RECORDED` rows a month will bury the governance and admin events in `GET /admin/activity`.
- Fix: exclude finance actions from the default feed, or add an entity filter. Keep them in `/finance/audit`.

### Low

- **L1 §2.5** — The entity diagram still shows the old `(by building+floor+flat)── ResidentUnit` text join. Redraw it with `ResidentUnit.flatId` and `FlatOwnership`.
- **L2 §9 Concurrency row** — It still says "row locks on charges". Align it with §3.4 (flat row first, then the counter).
- **L3 §2.4 Expense** — "assigned on approval-independent creation" is unclear. Say "number assigned at creation, whatever the approval status".
- **L4 §3.4 / Q15** — The `FinanceSetting` key is `receipt.prefix`, but the scopes are hard-coded R/O/E/V/F. Drop the setting or define what it changes.
- **L5 §8.1 self-delete** — The public `DELETE /user` (`user.public.controller.ts:63`) admits only `[RESIDENT, MERCHANT]`, so ADMINs cannot self-delete today either. If accountants can, state why accountants differ from admins.
- **L6 §10 Mobile delivery** — "The ACCOUNTANT role must ship to the store build" is true, but OTA only reaches builds with `expo-updates` (v11 and later). Older installs will route an accountant via the `ROLE_HOME_ROUTE` fallback to Home, which is harmless. Note it.
- **L7 Appendix A** — Add the facts this review relied on: the listings `(tabs)/flats` route, the `listings_active_unit_key` partial index, and the soft-delete in `deleteUser`.

## 3. Breakage check (existing behaviour)

- Auth/roles: safe if H8 is applied. Without it, accountants get the merchant, ordering and admin page shells (backend 403s) and residents can open staff page shells. `ROLE_RANK`, `ROLE_HOME_ROUTE` and `UserRole` are exhaustive or typed, so the compiler forces the edits.
- Notifications: the additive enum is safe, and `send()` is unchanged. Remember the 5 controller routes (§8.1 covers them). The new `sendMany` must also skip soft-deleted owners (H6).
- Uploads: the private route is separate, so the public `/uploads` is untouched. Adding ACCOUNTANT to `ANY_USER` is safe.
- Migrations on the live DB: the enum-only first migration follows the `20261004000000_super_admin_role` precedent. The risks are H3 (partial-index drift, unasserted backfill) and M6 (stricter unit validation).
