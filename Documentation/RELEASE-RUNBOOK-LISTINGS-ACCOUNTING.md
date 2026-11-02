# Release runbook: flat listings + accounting (slices 1 to 3)

> **DRAFT** (2026-11-02). It will be folded into root `steps.md` once all accounting slices are built. Do not
> run the prod parts yet.

Written 2026-11-02. Branches on GitHub:
- `feature/flat-listings` (tip `0ab5997`);
- `feature/accounting` (built on the listings branch).

Render and Vercel deploy every push to `main`. A push to a feature branch deploys nothing.

Each prod step is on Ahmed's go. Never print secrets.

## What ships in which release

| Release | Contents | Migration | Clients |
|---|---|---|---|
| 1. Listings | `feature/flat-listings` | `20261031000000_flat_listings` (additive) | web fix first, then backend, then mobile OTA |
| 2. Accounting prep | `feature/accounting` **up to `9178bc6` only** (slices 1 to 3) | `20261101000000_accountant_role` (enum value only) | backend + web together, then mobile OTA |
| 3+ | slices 4 + 5 together, then 6, 7, 8 | `finance_foundations` | see the end of this file |

`feature/accounting` keeps growing: slice 4 is being built on top of `9178bc6`. Release 2 must merge `9178bc6`, not the branch tip, because slice 4 must never reach prod without slice 5.

## Part A: run the whole flow locally first (no prod risk)

1. **Gates**, on `feature/accounting`, which contains both features:
   - web: `pnpm --dir apps/web check`
   - backend: `pnpm --dir apps/backend typecheck`, `lint`, `test`
   - mobile: `pnpm check:mobile`, then `npx expo export --platform android` in `apps/mobile`. Afterwards run `git checkout apps/mobile/uniwind-types.d.ts`.
2. **Local services:** `cd apps/backend && docker compose up -d` (postgres 5432, redis 6379, mailpit, minio).
   - The backend `.env` must point at these services, not at prod.
   - Check `DATABASE_URL` is a localhost URL before the next step.
3. **Database:** `pnpm --dir apps/backend exec prisma migrate deploy`, then `pnpm --dir apps/backend seed`. This replays every migration, the new ones included, on an empty DB.
4. **Run:**
   - backend `pnpm --dir apps/backend dev`;
   - web `pnpm --dir apps/web dev` (`NEXT_PUBLIC_API_URL=http://localhost:3000`);
   - mobile `pnpm --dir apps/mobile dev` (`EXPO_PUBLIC_API_URL=http://<PC LAN IP>:3000`).
5. **Click through.** Emails land in Mailpit.
   - **Resident:**
     1. Submit `/register-unit` (for example A1, floor 3, flat 2). Try the same flat again: you should get a "unit already reserved" 409.
     2. As admin, approve the lead.
     3. Open the Mailpit invitation and accept it.
     4. Log in.
   - **Listings (mobile):**
     1. As the resident, go to Profile → My listings → new listing; you can only pick your own flat.
     2. As admin, approve it under moderation. The resident gets a `LISTING_UPDATE` notification.
     3. The web `/notifications` page still loads.
   - **Orders back (mobile):** Profile → My orders → back returns to Profile, both with the header button and with hardware back.
   - **Accountant:**
     1. As SUPER_ADMIN, invite an ACCOUNTANT and accept the invitation.
     2. Web: the accountant lands on `/finance`; `/directory`, `/orders` and `/merchant` redirect away.
     3. Mobile: the finance placeholder; Community, cart and ordering locked; feedback open; no "Delete account".
   - **Existing roles unchanged:** resident, merchant (`/merchant`), admin, guest landing.
   - **Key repair:** call `PATCH /v1/admin/resident-units/:id` as SUPER_ADMIN (ADMIN gets 403) and `PATCH /v1/admin/residents/leads/:id` as ADMIN, through Swagger or curl. Both write an audit row. Re-keying a flat that has an open listing withdraws the listing.
   - **Preflight:** `psql <local url> -f apps/backend/prisma/scripts/check-flat-keys.sql`. Expect `flats_in_layout` 690 and 0 unknown/collisions.

## Part B: release 1, listings

1. **Read-only gap query on prod** (`LISTINGS-DECISIONS.md` point 1): residents with no `resident_units` row. A SUPER_ADMIN adds their flats.
2. **Push A (web only):**
   1. Cherry-pick `7ee0161` (the notifications parser) onto `main` and push.
   2. Wait for Vercel Ready.
   3. As admin, open `/notifications`.
   4. Render redeploys the unchanged backend; that is harmless.
3. **Back up prod:** `pg_dump` the public schema to `D:\CodeLab\EastPark-backups\` (outside the repo; it contains PII).
4. **Push B:**
   1. Merge the listings PR. Rebase onto the new `main` first, so the cherry-picked commit drops out.
   2. Render runs the additive `flat_listings` migration on boot.
   3. Check `/health` 200, `prisma migrate status` clean, and that `GET /v1/notifications/preferences` lists `LISTING_UPDATE`.
   4. Run `node scripts/smoke/run.mjs`.
5. **Mobile:** `eas update` on `preview` (JS-only; do not bump `version`). Verify on the A72. If the update doesn't apply, do an EAS build (ask first).
- **Rollback:**
  - Backend: redeploy the previous Render build. FIRST delete `LISTING_UPDATE` rows from `notifications` and `notification_preferences`, because the old Prisma client can't read them. Leave the migration in place.
  - Never roll the web back past `7ee0161`.
  - Mobile: `eas update:republish` the previous update.

## Part C: release 2, accounting slices 1 to 3 (preparatory)

Release 1 must be live first: the preflight reads the `listings` table.

1. **Merge:**
   1. Rebase `feature/accounting` onto `main` after release 1. The listings commits drop out.
   2. Open the PR **for commits up to `9178bc6` only**: create a branch at that commit, or merge before any slice 4 commit.
   3. Run the gates again.
2. **Back up prod.**
3. **Push** (backend + web in one push).
   - It's safe in either order, because prod has no ACCOUNTANT user yet.
   - Render applies `accountant_role` (`ALTER TYPE ... ADD VALUE`).
   - Check `/health`, `migrate status`, the smoke test, and that a resident, a merchant and an admin can each log in and land where they did before.
4. **Mobile OTA** (slice 2 confinement, JS-only), same as release 1, step 5.
5. **Preflight on prod:** `psql "$DIRECT_DATABASE_URL" -f apps/backend/prisma/scripts/check-flat-keys.sql`. It is read-only.
   - Fix every `resident_units` collision and unknown key with the unit PATCH (SUPER_ADMIN).
   - Fix bad active leads with the lead PATCH.
   - Re-run until it is clean.
6. **Do NOT invite any ACCOUNTANT yet.** That waits until the privacy-policy finance section is live (slice 6).
- **Rollback:**
  - Redeploy the previous Render build. The enum value stays, which is harmless while no row uses it.
  - Web and mobile: the previous Vercel deploy, or republish the previous update.

## Part D: later releases

1. **Owner confirms** 690 flats and phase 4 = C3/E2/F2. The slice 4 seed refuses any other count.
2. **Slices 4 + 5 together:**
   1. Back up prod.
   2. Re-run `check-flat-keys.sql` immediately before the push; `resident_units` `collision_groups` must be 0. A collision aborts `finance_foundations` and blocks every deploy until `prisma migrate resolve --rolled-back <name>`.
3. **Slice 6:**
   1. Deploy the web privacy-policy finance section first (bump `PRIVACY_EFFECTIVE_DATE` and post an in-app announcement).
   2. Then deploy the backend.
4. **Slice 7:** create the private `eastpark-finance` bucket first.
5. **Slice 8:** update the Play Data safety form (Financial info, slip Photos) before the OTA reaches any accountant.
6. **Lawyer review** of the policy wording before the first accountant invite.
