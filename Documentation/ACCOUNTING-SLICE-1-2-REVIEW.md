# Accounting Phase 1a, slices 1 and 2: independent review

Scope: `git diff 25da213 c571417` (`15edd10` backend, `4c3f8fc` web, `c571417` mobile). Read-only review; no gates re-run.

## Summary

Critical 0 · High 0 · Medium 4 · Low 7. I found no regression for existing roles (guest, resident, merchant, admin, super admin) in the backend, the web proxy or mobile.

## Implementer deviations

1. **`resolveInvitedRole`: OK.** For every pair without ACCOUNTANT, the result equals the old `ROLE_RANK` comparison. The table in `roles.guard.spec.ts` covers M<-R, A<-M, R->M kept, M->A kept and A->SA kept. Prod has no ACCOUNTANT rows, so existing ADMIN/MERCHANT invitations behave as before. The role is now resolved before the claim transaction, which is safe: a conflict leaves the invitation unused.
2. **`/directory` in the proxy matcher: OK.** RESIDENT goes through `isPathAllowedForRole`, which is `!isBlockedPagePath`, and `/directory` is not on the deny list. Guests and MERCHANT return early through `!isRestrictedRole`. Pinned by `proxy.test.ts:35` (resident `/directory`, `/directory/shop-1/menu`, `/api/shops/...`) and `access-policy.test.ts` (`isOpenToRestricted('/directory','RESIDENT')`). The restructured proxy matches the old one for residents: the old early return only skipped paths that were not blocked, and those still pass.
3. **`useGuestGate` feature-only lock: OK.** It matches plan 8.1 (the bell and notification preferences stay open). Every current caller passes `"market"` (header cart, add-to-cart, cart bar) or nothing (bell). `isGuest` stays false for an accountant, and nothing reads it today.

## Migration

`20261101000000_accountant_role` is exactly `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';`. It is the same shape as `20261004000000_super_admin_role`, and nothing in the migration uses the new value, so it is safe inside Prisma's transaction on PG 12+. `schema.prisma` appends `ACCOUNTANT` last, matching `ADD VALUE`'s append order. Verdict: correct.

## Role sweep (backend)

ACCOUNTANT gains no access it should not have:
- Guards and helpers: `roleSatisfies` and `isAdminRole` are unchanged.
- Admin, trash and audit routes stay ADMIN/SUPER_ADMIN.
- Self-delete stays `[RESIDENT, MERCHANT]`, and listings `BROWSE_ROLES` exclude ACCOUNTANT.
- Feedback scoping is own-only through `isAdminRole`.
- Uploads: `ANY_USER` covers avatar and feedback only.
- `ASSIGNABLE_ROLES` stays behind the SUPER_ADMIN route.
- The role-matrix spec really reads the `@AllowedRoles` metadata, so it is a real check.

## Medium

**M1. Mobile `isFinanceRole` means something different from the plan, web and backend.**
- Where: `apps/mobile/src/lib/roles.ts:18`, `app/(finance)/_layout.tsx:12`, `__tests__/screens/finance-layout.test.tsx:29`.
- What is wrong: on mobile it returns true for ACCOUNTANT only. Plan 8.3 says the `(finance)` guard admits ACCOUNTANT, ADMIN and SUPER_ADMIN, and web and backend `isFinanceRole` include the admins.
- Failure scenario:
  - The ADMIN/SUPER_ADMIN redirect is pinned by a test, so the slice 8 approvals screen (admin-only) and the admin "Finance" row cannot be reached.
  - Worse: if someone later aligns the helper with the plan, every confinement call starts locking ADMINs out of Community, the cart and "My orders". These calls are `useGuestGate`, the tabs `lockedForGuests`, the `notFinance` Home tiles and the Profile orders row.
- Fix:
  - Add `isAccountantRole` and use it for all confinement calls.
  - Make `isFinanceRole` = ACCOUNTANT | ADMIN | SUPER_ADMIN and use it in the guard.
  - Flip the ADMIN/SUPER_ADMIN cases in the guard test.

**M2. The accountant confinement depends on the resident lockdown flag.**
- Where: `apps/web/src/proxy.ts:16`, `config/access-policy.ts:29`.
- What is wrong: when `RESIDENT_HOME_ONLY` is false, the proxy returns early and `isRestrictedRole` is false for every role.
- Failure scenario: the day the owner lifts the resident lockdown, the ACCOUNTANT allow-list disappears silently. The accountant then reaches `/directory`, `/orders`, `/cart` and the `/merchant` shell, which are broken 403 pages.
- Fix: evaluate `isAccountantRole` before the flag check (both in the proxy and in `isRestrictedRole`/`GatedLink`), and add a test with the flag off.

**M3. Plausible: double header on the mobile finance landing.**
- Where: `apps/mobile/src/app/_layout.tsx:74-80`.
- What is wrong: the root `Stack` declares `(admin)` and `(merchant)` with `headerShown: false`, but not `(finance)`.
- Failure scenario: an expo-router group that is not declared gets the default Stack header. The accountant's first screen (`/finance/today`) would show a native "(finance)" header above `ScreenHeader`. Not verified on a device.
- Fix: add `<Stack.Screen name="(finance)" options={{ headerShown: false }} />`.

**M4. Tests required by slice 2 are missing.**
- Missing:
  - `resident-home` with and without the ACCOUNTANT tiles and "See all".
  - Profile with and without "My orders".
  - The `/finance/` prefix assertion in `route-collisions.test.ts`.
- Why it matters: the `notFinance` Home tiles, the What's new section and the Profile orders row have no test, and these are exactly the paths that break if M1 is fixed carelessly.
- Fix: add the plan 8.1/8.3 Jest cases, outside `src/app/`.

## Low

- **L1. A role conflict shows the wrong message.** `apps/web/src/app/api/auth/accept-invitation/route.ts:35` and the mobile `acceptInvitationErrorKey` map a 409 `invitation.error.roleConflict` to "account exists, enter your current password", so the user retries forever. Fix: add the code to `bff-errors.ts`, and give web and mobile their own copy.
- **L2. `ROLE_RANK[ACCOUNTANT] = 0` equals RESIDENT, and `ROLE_RANK` is now exported** (`roles.ts:46`). Fix: make it module-private, or comment it so no one compares ranks directly.
- **L3. The accountant's proxy redirect lands on `/home`, not `/finance`** (`proxy.ts:28`). This is acceptable because `/home` is allow-listed. Optionally redirect finance roles to `/finance`.
- **L4. Plausible: the accountant can drift into Community.** The mobile Community stack (`(tabs)/community/_layout.tsx`) only guards guests. The accountant enters it through the Feedback tile or the "My feedback" row; a deep link, or Back without `?from=`, reaches announcements and polls, which return 403. Fix: in the stack layout, redirect ACCOUNTANT away from every screen except `feedback/*`.
- **L5. "Delete account" is shown to the accountant on mobile Profile, and the backend answers 403.** The same already happens for ADMIN today. Fix: hide it for non-RESIDENT/MERCHANT roles (web already does, `ProfileManager.tsx:155`).
- **L6. Cosmetic.** `lockedForGuests` (`(tabs)/_layout.tsx:34`) also locks accountants, so the name misleads (plan: `lockedFor`). `RoleBadge` has no ACCOUNTANT tone and falls back to grey.
- **L7. Web and mobile disagree on the directory.** Web denies `/directory` to accountants; mobile keeps the Directory tab and the Shops tile open, as the plan says, with ordering gated. Confirm this split is intended.

## Tests

Meaningful:
- The backend role matrix is metadata-driven, with stale-entry and collector-size checks.
- `resolveInvitedRole` is table-driven.
- The `acceptInvitation` 409 tests assert the invitation stays unused.
- Web access-policy and proxy tests cover both directions, plus `/financex`.
- The guest-gate tests cover the feature/no-feature split.

Weak:
- `finance-layout.test.tsx` pins the M1 bug.
- `roles.test.ts` asserts `isFinanceRole('ADMIN') === false`.
- No Home or Profile tests (M4).

No `*.test.tsx` under `src/app/`. `(finance)/finance/today` maps to `/finance/today` and collides with nothing. The en/ar keys exist on web (`finance.*`, `access.finance_*`, `profile.roles.accountant`) and on mobile (`auth.role_accountant`, `finance.*`, `profile.finance_dashboard`).

## Verdict

**Safe to build slice 3 on.** Slice 3 (flat layout, key repair) does not touch role code.

**Safe to deploy:** there are no Critical or High findings, and nothing regresses for guests, residents, merchants or admins.
- Fix M1 and M4 before slice 8 builds on the mobile helper.
- Fix M2 before the resident lockdown is ever lifted.
- Fix M3 before the next OTA.
- Send no accountant invitation until L1 and M3 are fixed.
