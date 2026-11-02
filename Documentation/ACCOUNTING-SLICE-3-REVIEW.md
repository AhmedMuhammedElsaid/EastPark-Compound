# Accounting Phase 1a, slice 3: independent review

Scope: `git diff d22d1a9 18a4598` (`ca25583` layout + SQL, `994bbf6` lead DTO + lead PATCH, `18a4598` unit PATCH +
tests). Read-only review. Ran `jest --config test/jest.json` on `compound-layout`, `resident-units`,
`residents.service` (167/167 pass) and `role-matrix` (7/7 pass). No DB or remote service touched.

## Summary

Critical 0 · High 1 · Medium 3 · Low 7.

The live lead form is not at risk: the stricter DTO accepts exactly what web `/register-unit` can send, and the
BFF already enforces the same layout. The main risk is for slice 4: the new unit PATCH (and legacy-lead approval)
can create a `resident_units` collision after normalisation, which is exactly what aborts `finance_foundations`.

## Live lead form regression check

No regression found.
- Web `/register-unit` sends `building` from a select of the 12 codes, `floor` from `getFloorOptions` (`G` only
  for phases 2 and 3, then `1`..`11`) and `flatNumber` `1`..`5`. The BFF (`app/api/resident-leads/route.ts`)
  re-validates with `registerUnitSchema` (`isValidBuilding`, `isValidFloorForBuilding`, `isValidFlat`) before
  forwarding. Every payload that passes the BFF also passes `@IsKnownFlat`. The two layouts are the same list,
  and `compound-layout.spec.ts` parses the web file to keep them that way.
- `0` was never a ground-floor spelling: the old DTO regex already rejected `0` and `01`, so nothing changes there.
- Mobile submits no leads (its register screens were removed on 2026-10-03). The SUPER_ADMIN "Add flat" form uses
  the same `unitFieldsSchema`.
- The only inputs that are newly rejected are direct API calls with an impossible flat (`A1`/`G`, `D2`,
  `Building A`). That is intended.
- Existing leads are untouched: approval does not validate the layout, and this is pinned by the "Building A"
  invite test.

## Deviations

1. **Phase 4 = C3/E2/F2: OK.** Plan 2.2 says to follow the code, and the spec checks it against the web file.
   Q1 (the owner confirms 690 flats and the phase 4 codes) is still open in memory. Get it confirmed before slice 4
   seeds `flats`.
2. **Upper-casing building and floor: OK.** This matches `normaliseFlatKey`, and the web only sends upper case.
   Side effect: the add-flat DTO (`ResidentUnitCreateDto`) now upper-cases too, which is good. See H1 for the gap
   it leaves against legacy rows.
3. **Lead PATCH 409 on CONVERTED/REJECTED: OK.** A CONVERTED lead's key is history: its unit already exists, so
   it must be repaired through the unit PATCH. A REJECTED lead holds no reservation and can be re-submitted. The
   status check is not atomic, though (M1).
4. **Unit PATCH 409 `unitReserved` for an active lead on the target: OK.** It matches `addToUser`. Edge case: a
   legacy unit `a1-3-2` with a new active lead for `A1-3-2` cannot be canonicalised until that lead is rejected.
   Document this in the owner runbook.
5. **New audit actions, web feed not updated: OK for now.** `activityParts` falls back to `generic_action` with
   the humanised code plus `meta.label`, so it renders a readable line. Add the copy when a UI calls the endpoint.
6. **`FLAT_KEY_STRICT` read but unused: OK, as the spec says** (slice 5 consumes it). The `.env.example` comment
   says it "rejects unknown flat keys at lead approval / invitation acceptance". That is not true yet (L5).
7. **Tests moved from "Building A" to real flats: OK.** The legacy key is still covered by `mockLead()`
   ("Building A") in the invite and lead PATCH tests.

## Critical

None.

## High

**H1. The ownership checks match keys exactly, so they cannot see a legacy non-canonical row. The new unit PATCH
can create the very `resident_units` collision that aborts slice 4.**
- Where: `resident-units.service.ts` `findOwner` (exact `building_floor_flatNumber` lookup), used by `updateKey`,
  `addToUser`, `ResidentsService.create`, `updateUnit` and `invite`. The active-lead `findFirst` checks are exact too.
- What is wrong: the DTOs now canonicalise input (`A1`, `G`), but stored rows may not be canonical. That is the
  whole premise of `check-flat-keys.sql`. The unique index is case-sensitive.
- Failure scenario:
  - Prod has a unit `a1|3|2` for user X (or `A1 ` with a trailing space).
  - A SUPER_ADMIN repairs user Y's typo unit to `A1-3-2`. `findOwner` returns null, the update succeeds, and two
    `resident_units` rows now normalise to the same key.
  - The same happens through a new lead for `A1-3-2`: `create` passes, `invite` passes, accept-invitation creates
    the `A1` unit. It also happens through add-flat.
  - If this happens after the owner's diagnostic run, `finance_foundations` hits `RAISE EXCEPTION` on Render, and
    every deploy fails until `migrate resolve`. The tool meant to remove collisions can add one, and the
    diagnostic cannot be trusted once it has run.
  - Likelihood is low if every prod row came from the web selects. The SQL will tell.
- Fix: make `findOwner` (and the active-lead checks) compare normalised keys, for example a `$queryRaw` on
  `upper(btrim(building)) = $1 AND upper(btrim(floor)) = $2 AND btrim("flatNumber") = $3`. In `updateKey`, treat
  a normalised match on a different unit id as `alreadyOwned`. Add tests with a lower-case or space-padded holder.
  Alternative: fix only the unit PATCH and add-flat now, and require the owner to re-run the SQL right before
  slice 4 ships (put this in the slice 4 runbook either way).

## Medium

**M1. Lead PATCH status check is not atomic (TOCTOU).**
- Where: `residents.service.ts` `updateUnit`: `findUnique`, then a status check, then `update({ where: { id } })`.
- What is wrong: the write is not conditioned on the status (or the old key) read earlier.
- Failure scenario: an admin edits an INVITED lead while the resident accepts the invitation. Accept-invitation
  creates the unit with the old key and marks the lead CONVERTED, then the PATCH rewrites the CONVERTED lead's
  key. The lead history now disagrees with the unit, and the 409 `notEditable` rule is bypassed. The same can
  happen with a concurrent reject. Two concurrent PATCHes on the same lead are last-write-wins, each audited as
  "from the original key".
- Fix: `updateMany({ where: { id, status: { in: ACTIVE_LEAD_STATUSES }, building, floor, flatNumber: <old> },
  data: next })`. If `count === 0`, re-read and answer 409 `notEditable` (or 404). Keep the P2002 mapping.

**M2. A unit re-key leaves the owner's open listings on the old key.**
- Where: `resident-units.service.ts` `updateKey` transaction. Compare `removeFromUser`, which withdraws
  PENDING/APPROVED listings for the flat.
- What is wrong: the listings tables ship with this branch (`20261031000000_flat_listings`, built on
  `feature/flat-listings`). After a re-key, an APPROVED listing still advertises the old flat key and still holds
  `listings_active_unit_key` for it. The owner can no longer edit it (`assertOwnsFlat` fails on the old key).
  If the old key is a real flat (typo `A1-3-2` corrected to `A1-3-3`), the listing blocks that flat's real owner
  from listing it.
- Fix: in the same transaction, withdraw (or re-key) the owner's PENDING/APPROVED listings that match the old key.
  Re-keying is nicer but must handle `P2002` on `listings_active_unit_key`. Add a test.

**M3. Checks run outside the transaction, which contradicts plan 2.2 M2 and the slice 5 assumption.**
- Where: `updateKey`: `normalise`, `findOwner` and the active-lead `findFirst` run before `$transaction`.
  Only the `resident_units` unique index is a real guard.
- What is wrong: a lead created for the target flat between the check and the update ends up as an active lead
  plus a unit for the same flat. The approval later fails with `alreadyOwned`, so the damage is small (same
  pattern as `addToUser`). But slice 5 adds "link and open period" to this method. If it stays like this, the
  `FlatOwnership` writes and the flat lookup will inherit a check-then-act shape.
- Fix (can wait for slice 5, but record it in the tasks doc): move the holder, lead and flat lookups into the
  interactive transaction, and lock the unit row (`SELECT ... FOR UPDATE`) so two concurrent PATCHes on one unit
  serialise. Today they are last-write-wins, and both audit rows say "from <original>".

## Low

**L1. The audit labels carry names and email, and the docstring says otherwise.**
- Where: `UNIT_KEY_CHANGED` `label` = `name (email) · from → to`, plus `userId`. `LEAD_UNIT_CHANGED` `label`
  includes the lead's name.
- What is wrong: this matches the existing `UNIT_ADDED`, `UNIT_REMOVED` and `LEAD_*` entries, and there is no
  phone, national id or passport, so the content is acceptable. But the `updateUnit` docstring says "no PII".
- Fix: reword it to "no phone/national id/passport". Optionally add a unit-PATCH test asserting the meta keys.

**L2. The `unitNumber` follow is an exact string match.**
- Where: `updateKey`, `user.updateMany({ where: { unitNumber: before } })`.
- What is wrong: `before` is built from the raw stored row. A primary label that differs only in spacing or case
  (hand-edited, or set by profile edit) is not updated, so the old label survives.
- Fix: acceptable. Optionally compare normalised labels.

**L3. The lead PATCH response returns the full lead, `nationalId` and `passportNumber` included.**
- What is wrong: this is the same data ADMIN already gets from `GET /admin/residents/leads`, so it is not a new
  exposure.
- Fix: none required. Note it if the admin list ever starts masking these fields.

**L4. The SQL depends on the `listings` table, and its trim differs from JS.**
- `listings` exists only after `20261031000000_flat_listings` deploys. That migration is on this branch, not on
  `main`, so running the script against prod before this branch ships fails with "relation listings does not
  exist". The owner step correctly says "after deploy". Add a line to the script header.
- `btrim` strips spaces only, while JS `.trim()` also strips tabs and NBSP. A row with a tab or NBSP is reported
  as `unknown` (conservative, fine), but the SQL and the JS normaliser would group it differently. Use
  `btrim(x, E' \t\r\n')` or note the difference.
- Otherwise the script is correct. It is only `WITH ... SELECT ... UNION ALL` with counts, with no names, emails
  or ids. Its 690 tuples equal `COMPOUND_FLAT_KEYS` in order (spec), and the sections match plan 2.2: units
  report unknown rows plus collision groups and rows; leads (PENDING/INVITED) and listings (PENDING/APPROVED)
  report unknown rows plus informational active collisions. The read-only regex in the spec is a reasonable
  guard.

**L5. The `.env.example` comment for `FLAT_KEY_STRICT` describes slice 5 behaviour as if it were live.**
- Fix: say "consumed from slice 5; no effect yet".

**L6. The new error codes have no client copy.**
- Where: `residentLead.error.notEditable`, and `unknownFlat` for the unit PATCH. There is also no
  `residentLead` language file at all, but that predates this slice.
- What is wrong: web and mobile map neither code, and no UI calls either PATCH yet. The plan's "fix every
  pre-existing bad lead by the lead PATCH" therefore needs curl or Swagger today.
- Fix: add the strings with the admin UI. Track in the tasks doc.

**L7. A unit of a soft-deleted user can be re-keyed (documented).** This is fine now. Slice 5's link step must
skip opening a period when `user.deletedAt` is set (plan L-2). Note it on the slice 5 checklist next to M3.

## Role checks

Correct.
- `PATCH /v1/admin/resident-units/:id` is `@AllowedRoles([SUPER_ADMIN])`. `roleSatisfies` lets SUPER_ADMIN
  satisfy only ADMIN routes, so ADMIN gets 403, and so do ACCOUNTANT, RESIDENT and MERCHANT. This matches plan
  L-3 and the add/remove routes.
- `PATCH /v1/admin/residents/leads/:id` is `[ADMIN]`, so SUPER_ADMIN is admitted. This matches invite/reject.
- The route `leads/:id` does not shadow `leads/:id/reject` or `leads/stats` (different methods and depths).
- The global `JwtAccessGuard` and `RolesGuard` apply, the role-matrix spec still passes, and `AuditService.record`
  only writes for admin actors, which holds on both routes.

## Soft delete

- `resident_units` and `resident_leads` have no `deletedAt`, so nothing needs filtering there.
- The unit PATCH intentionally works on a deleted owner's unit (needed to clear a collision before slice 4).
  `findOwner` counts deleted owners' units as holders, which is right (FK Restrict, plan path 4).

## Tests

Good coverage of the happy paths and of each conflict branch:
- 690 keys and uniqueness; web parity parsed from the source file.
- `normaliseFlatKey`, plus accept and reject tables for `isKnownFlat`.
- The SQL key list equals the generator output; the read-only/no-PII grep.
- DTO validation through `plainToInstance`, so the transforms really run.
- Unit PATCH: role metadata, unknown flat, `alreadyOwned`, `unitReserved`, P2002, 404, no-op, `unitNumber` follow.
- Lead PATCH: status 409s, reserved, owned, P2002, no-op; the legacy "Building A" invite is still allowed.

Gaps:
- No test for a non-canonical holder (H1).
- No test that the lead update is conditional (M1).
- No listings test on re-key (M2).
- No lead PATCH controller role-metadata test (role-matrix covers ADMIN routes generically).
- The web-parity regex depends on the exact literal formatting of `compound.ts`: a Prettier reflow makes the
  spec fail, which at least fails loudly.
- No db-spec for the P2002 path. The tasks doc expects real-DB specs for concurrency; the mock P2002 tests prove
  only the mapping.

## Verdict

- **Safe to deploy (preparatory release):** yes, with one condition: the branch also carries the listings
  migration, so it ships together with that. The live lead form, approval of legacy leads and the existing roles
  are unaffected. The new endpoints are reachable only by admins and have no UI yet.
- **Safe to build slice 4 on:** yes, after H1. Either the normalised holder check, or at minimum a slice 4
  runbook step that re-runs `check-flat-keys.sql` immediately before the push and requires
  `resident_units collision_groups = 0`.
- Fix M1 and M2 before anyone uses the PATCHes on prod data.
- Carry M3 and L7 into slice 5's design, where `updateKey` gains the flat link and the ownership period.
- Get Q1 (690 flats, phase 4 = C3/E2/F2) confirmed by the owner before the seed.
