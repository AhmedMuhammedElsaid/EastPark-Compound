# EastPark App — Session Context

Read this at the start of every session. All decisions are final unless the user explicitly changes them.
Full detail lives in `FrontendPlan.md` and `BackendPlan.md`.

---

## What Is This Project

**EastPark** — a residential compound super-app for the MENA region.

- Local marketplace (shops, ordering, real-time tracking)
- Community governance hub (announcements, polls, elections, feedback)

**Hard rule: 100% free stack only.** Every service must be open-source, self-hostable, or on a permanent free tier.

---

## Canonical Plan Files

- `FrontendPlan.md` — complete FE plan
- `BackendPlan.md` — complete BE plan (Prisma schema, module structure, all API endpoints, Docker, Fly.io)
- `apps/mobile/Documentation/DESIGN.md` — full design system (~1750 lines — color tokens, typography, all screens 5.1–5.13, motion, per-module patterns, implementation patterns)
- `.impeccable.md` — design context for skill commands
- `.github/copilot-instructions.md` — same design context synced for GitHub Copilot
- `eastpark.jpg` — official brand logo (source of color palette)

---

## Current Status

> ### 2026-10-03 (later) — WENT LIVE (NEWEST — READ FIRST)
>
> **State:** `main` pushed: `027ba88..6a21144` (go-live batch), then `6a21144..f22d9a0` (client-IP throttle
> fix). Render (`eastpark-backend`) and Vercel (`eastpark-web-app`) are both live on `f22d9a0`; `/health` 200.
>
> **Runbook results:**
> 1. Backup: pg_dump of the prod public schema at
>    `D:\CodeLab\EastPark-backups\eastpark-prod-20261003-044259-pre-golive.dump` (outside repo; contains PII).
> 2. `check-email-case.sql`: users collision_groups 0, non-canonical 0 (users 10, invitations 3, resident_leads 33).
> 3. Public bucket `eastpark-uploads` created on prod project `pwylqeodkxigmukghqfd` (jpeg/png/webp/pdf, 20 MB cap).
>    Storage origin `https://pwylqeodkxigmukghqfd.supabase.co`.
> 4. `BFF_INTERNAL_SECRET` set identically on Vercel (sensitive, Production+Preview) and Render (hash-verified equal).
> 5. Render `AUTH_RESET_TOKEN_TTL_SEC` deleted; `EXPO_ACCESS_TOKEN` was already absent. `NEXT_PUBLIC_STORAGE_ORIGIN`
>    deliberately NOT set (owner decision): prod shop photos (12) and product images (24) use `images.unsplash.com`
>    demo URLs (no picsum); setting it would block them. Set it (or allow Unsplash in CSP) once real shop photos exist.
> 6. Migrations `20261002000000_money_decimal` and `20261003000000_lowercase_emails` applied, none pending;
>    `orders.totalAmount` is numeric(10,2).
>
> **Smoke (step 7):** login unknown 401 OK; refresh-token reuse 401 OK; announcement detail + comments render for
> guest and signed-in on API and web (test comment posted then deleted; guest view hides author id) OK; merchant
> reaches `/merchant` OK; REAL avatar and feedback image uploads succeed through the web BFF and their public URLs
> load (image/png) — the old upload blocker is RESOLVED (test objects deleted). NOT tested: 403-unverified (prod has
> no unverified users) and resident confinement to `/home` (no resident test credentials; owner checking manually).
>
> **Step 8 (throttle):** before the fix, Render behind Cloudflare made `req.ip` the per-request Cloudflare edge, so
> the per-IP login throttle never fired. Fixed in `0af50b8`/`e324dd1` (CF-Connecting-IP for direct traffic;
> `X-EastPark-Client-IP` trusted only with the BFF secret). Re-verified live: direct no-header 6th -> 429; direct
> rotating fake XFF/True-Client-IP/X-EastPark-Client-IP 6th -> 429; client-set `CF-Connecting-IP` -> Cloudflare 403;
> web BFF logins from one IP 6th -> 429. Render logs never include request headers (serializer logs method/url/UA
> only), so the secret cannot leak; the redact list also covers it. Owner to confirm "IP B unaffected" from a phone
> on mobile data.
>
> **Still open:** owner decision on removing public self-registration (recommended yes); mobile needs a new EAS
> build (runbook step 9); revoke the temporary Vercel token used for go-live; rotate credentials per backlog.
> **Service access:** Render via API key in root `.env` (`RENDERER_TOKEN`); Vercel via `VERCEL_TOKEN` in root `.env`
> (team `team_ZIzP3nzOIDbyKF9jVEr5oQS1`); prod DB via root `.env` `DIRECT_DATABASE_URL`. The claude.ai Supabase MCP
> is linked to a DIFFERENT, unrelated project (`uywnep…`) — do not use it for prod.

> ### 2026-10-03 — FULL-STACK REVIEW + FIX BATCH, READY TO GO LIVE (superseded by the WENT LIVE note above for state; runbook/backlog still valid)
>
> **State:** `main` is ~75 commits ahead of `origin/main` (`027ba88..HEAD`), **NOTHING PUSHED**. Working tree
> clean. Final Fable re-check verdict: **safe to push code-wise**; no Critical/High findings. Gates green:
> web `check` (lint + tsc + 88 vitest + build 62/62), backend typecheck/lint/249 tests, mobile type-check +
> 81 jest tests.
>
> **What shipped in this batch (local commits):**
> - Web: resident home-only lockdown (`apps/web/src/config/access-policy.ts` — `RESIDENT_HOME_ONLY`; only
>   RESIDENT is confined; ADMIN and MERCHANT unrestricted) with bilingual "Coming soon" popup; home teaser
>   sections (hero + phase strip, real latest announcement streamed via Suspense, marketplace/governance/
>   tracking previews, "also on the way" tiles); open-redirect fix (`src/lib/auth/return-path.ts`); single
>   backend client `src/lib/auth/server.ts` (read-only RSC sessions, `/api/auth/refresh` bounce, single-flight
>   refresh for single-use tokens, 429 → `rate_limited`); IP forwarding + `X-EastPark-Internal` secret header;
>   i18n/design/CSP fixes; Vitest suite; 4 MB upload limit; feedback uploads use `?purpose=feedback`.
> - Backend: refresh tokens single-use (jti) + session-version on password reset; email normalisation;
>   invitation hardening (existing account needs current password); lead reject endpoint; OTP attempt
>   counter (INCR-first); per-email login cap (10/15 min); throttling keyed on BFF-forwarded IP only with
>   `BFF_INTERNAL_SECRET` (`trustProxy: 1`); optional auth on public routes; order state machine; money
>   `Decimal(10,2)`; Paymob HMAC/amount/order checks (payments still disabled); upload magic-byte sniffing,
>   purpose folders, admin-only PDFs, 502 `storage_unavailable` (no bucket auto-create); socket JWT + room
>   auth; election results endpoint; commenter privacy; coverage measured across `src`.
> - Mobile: order payload, Bearer refresh + single-flight, 60 s timeout + warm-up, contract alignment
>   (merchant, feedback, polls, comments, notifications), socket events + reconnect, privacy-safe offline
>   cache, merchant full status chain, error toasts, cleanup, 9 unused deps removed, OTA settings dropped.
>
> **Owner decisions (2026-10-02/03):** admins DO see anonymous feedback authors (BE-2 won't fix); merchants
> are not locked down; Paymob/card payments postponed; commit history left as is (`c7f1f4c` carries 4 mobile
> MOB-34 files; `202ff50`/`752bd14` don't build alone); WEB-8 keeps `'unsafe-inline'`; WEB-21 skipped.
> **Open owner question:** remove public self-registration (`/register` linked from login + mobile register
> screen + `POST /auth/register`) so residents only join via `/register-unit` → admin approval → invitation?
> Recommended: yes.
>
> **GO-LIVE RUNBOOK (next session, needs Supabase + Vercel + Render access):**
> 1. Back up the Supabase database.
> 2. Run read-only `apps/backend/prisma/scripts/check-email-case.sql` on prod: `users.collision_groups` MUST
>    be 0. Otherwise merge duplicate accounts first — a collision aborts migration
>    `20261003000000_lowercase_emails`, Render's `migrate deploy` then fails every deploy until
>    `prisma migrate resolve --rolled-back 20261003000000_lowercase_emails`.
> 3. Supabase Storage: create the **public** bucket named by `SUPABASE_BUCKET` (default `eastpark-uploads`);
>    read its public storage origin.
> 4. Generate one secret ≥32 chars (`openssl rand -hex 32`); never print it. Set `BFF_INTERNAL_SECRET`
>    (server-only) on Vercel and on Render with the identical value. Backend refuses to boot if 1–31 chars.
> 5. Vercel: set `NEXT_PUBLIC_STORAGE_ORIGIN` (blocks any `picsum.photos` seed shop photos — check prod
>    shop photo URLs first). Render: delete `EXPO_ACCESS_TOKEN`, `AUTH_RESET_TOKEN_TTL_SEC`.
> 6. Push `main` (Render + Vercel auto-deploy; migrations `20261002000000_money_decimal` and
>    `20261003000000_lowercase_emails` run on boot). Confirm `/health` 200 and `prisma migrate status`.
> 7. Smoke: login 401 unknown / 403 unverified; refresh reuse → 401; announcement with comments loads
>    (guest + signed in); resident confined to `/home`, merchant reaches `/merchant`; a REAL image upload
>    (profile + feedback) succeeds and its URL loads — uploads are still unverified until this passes.
>    **The secret is load-bearing:** since 2026-10-03 (`0af50b8`/`e324dd1`) the backend keys direct traffic
>    on Cloudflare's `CF-Connecting-IP` and BFF traffic on `X-EastPark-Client-IP` only when the secret
>    matches. A missing/mismatched secret keys ALL web users on Vercel's egress IP → mass 429 on login.
> 8. Verify client-IP throttling on Render (never print the secret): (a) 6 direct `POST /v1/auth/login`
>    with no extra headers → 6th is 429; (b) 6 direct with rotating fake `CF-Connecting-IP`/`X-Forwarded-For`
>    → 6th is 429 (Cloudflare overwrites CF-Connecting-IP); (c) 6 web logins/min from IP A → 6th is 429
>    while IP B is unaffected. If (c) never 429s, the secret differs between Vercel and Render. If IP B is
>    also 429, the secret is unset/mismatched and web users share Vercel egress buckets. Confirm
>    `x-eastpark-internal` / `x-eastpark-client-ip` do not appear in Render logs.
> 9. Mobile: old store builds lose their session once (new refresh contract); new EAS build required.
>
> **Backlog (Medium/Low, not blocking):** REV-15 cancelled-order Paymob callback (when payments resume);
> REV-17 clear push token on logout; REV-18 refresh-then-logout on mobile; REV-19 shop delete vs
> reviews/bookmarks; REV-20 money upper bounds; REV-22 map new 409s to copy on web; REV-24..43 (see final
> review: bounce-route edge cases, upload error codes, 20 MB pre-check, resend-otp enumeration, existing-
> account invitation UX, socket token expiry mid-session, public review ids, `isAvailable` boolean
> transform, client-side DTO limits); atomic INCR+EXPIRE for OTP/login counters; login lockout trade-off
> (10 fails lock an email 15 min); WEB-12 global fetch patch; WEB-17 OG titles English; push only sent for
> ORDER_UPDATE; no `isPinned` on announcements.

> ---
> **HISTORY BELOW.** Every section from here down is superseded by the 2026-10-03 section above. Their
> "Next task", "Known blocker", "Resume" and "Open" items are either done or carried into the 2026-10-03
> runbook/backlog — do not act on them directly. (Upload blocker: code chain verified and hardened; still
> needs the Supabase bucket + a real end-to-end upload, step 3/7 of the runbook. Support web form is
> still not implemented.)

> ### 2026-10-02 — RESIDENT LAUNCH HANDOFF + IMAGE UPLOAD BLOCKER
>
> Root `main` is committed and pushed; clone or pull `origin/main` for the current checkpoint. Production remains
> `https://eastpark-web-app.vercel.app` with API `https://eastpark-backend.onrender.com`; Fly is
> rollback infrastructure. The tracked working tree is clean. The untracked root
> `eastpark-frontend/` directory is legacy/user-owned and must not be deleted, added, or treated as
> the active mobile app (`apps/mobile` is active).
>
> Completed since the previous handoff:
>
> - Authenticated resident web parity, responsive resident layouts, showcase content, feedback,
>   governance-first navigation, profile management, optional personal details, and admin resident
>   operations are committed.
> - Resident approval/invitation onboarding, production account links, Render-compatible email
>   relay, safe email diagnostics, expired-session redirects, logout behavior, loading feedback,
>   password guidance, and unit-registration navigation were hardened.
> - Profile photo selection and the shared image-upload BFF were added. Commit `e4bed42` corrected
>   multipart forwarding by preserving the browser boundary and bytes.
> - Fresh handoff validation on 2026-10-02: `pnpm --dir apps/web check` passes lint, strict
>   TypeScript, and the production build (61/61 pages generated); `pnpm --dir apps/backend
>   typecheck` passes.
> - Vercel Web Analytics is mounted globally through `@vercel/analytics` and included in the
>   validated production build.
>
> **Known blocker:** image upload still does not work in the deployed user flow despite `e4bed42`.
> Treat both profile-photo and feedback-attachment upload as unverified/broken. Start by reproducing
> an authenticated `POST /api/uploads/image`, record only HTTP status and sanitized response/error
> category, then inspect Vercel and Render logs plus Supabase Storage configuration. Never print
> cookies, credentials, storage keys, or signed values. Do not describe uploads as shipped until a
> real image succeeds end to end and its returned public URL loads.
>
> **Resume:** read root and `apps/web` `CLAUDE.md`/`APPCONTEXT.md`, check `git status`, restore
> dependencies, run `pnpm --dir apps/web check`, then investigate the upload blocker before further
> parity work. Revalidate backend typecheck/tests if the diagnosis requires backend changes.

> ### 2026-10-01 — EMAIL, RENDER AVAILABILITY, AND PUBLIC HEADER
>
> The implementation checkpoint is committed and pushed through `5497ea2`. The active production API is now
> `https://eastpark-backend.onrender.com`; Fly remains rollback infrastructure. The web app remains
> `https://eastpark-web-app.vercel.app`.
>
> Completed and validated in this checkpoint:
>
> - Transactional OTP, password-reset, invitation, and support emails use the official embedded
>   EastPark logo, dark/gold responsive shell, and Arabic/RTL defaults. Sender, Reply-To, and support
>   inbox use `eastpark.eg@gmail.com`; public company contact remains `info@benayat-eg.com`.
> - Public throttled `POST /v1/support/issues` validates and emails support submissions. The web
>   support page/form is **not implemented yet**.
> - Render cold-start mitigation combines a scheduled 10-minute health ping, login-page warm-up,
>   25-second server timeout, and 30-second interactive timeout. Production `GET /api/auth/login`
>   returns 204; warm requests were measured below one second. Error copy no longer falsely claims
>   definite internet loss.
> - All auth password fields use accessible eye/eye-off controls with 48px targets.
> - Public desktop header explicitly places brand/navigation/actions in logical outer/center/outer
>   columns. Arabic and English mirror correctly, mobile remains unchanged, and 1440px/390px checks
>   show no horizontal overflow. Header commit: `5497ea2`.
> - `pnpm --dir apps/web check` passes with 59/59 routes.
>
> **Next task:** authenticate with the resident account stored locally in the user's Downloads
> folder without printing or persisting credentials. Audit every resident route mobile-first at
> 320, 390, 768, 1024, 1440, and wide-desktop widths in Arabic RTL and English LTR. Start with
> `apps/web/src/components/app/AppShell.tsx` and `/home`; fix one measured layout failure at a time,
> validate immediately with Playwright geometry/screenshots, then run the full web check.

> ### 2026-09-30 — ROOT-OWNED MONOREPO + RENDER PREPARATION (NEWEST)
>
> Root Git now tracks `apps/web`, `apps/backend`, and `apps/mobile`; nested `.git` directories were
> moved to `C:\Unite\EastPark-App-monorepo-backup` for rollback. The web import passes its complete
> check, backend passes typecheck/Prisma validation/102 tests, and mobile passes typecheck plus 41
> tests. Mobile's pre-existing full lint baseline remains red under the hoisted ESLint stack.
>
> `render.yaml` at root can deploy `apps/backend` as a Frankfurt free Docker service. Fly remains
> active until Render is created with dashboard secrets and passes health, CORS, auth, lead, and
> announcement checks. The web app remains on Vercel and was deployed with announcement detail
> parity at commit `0958ed0`; a concurrent lead warmup fix is commit `95edf4c`.

> ### 2026-09-30 — DUPLICATE-UNIT GUARD + PUBLIC PAGE LAYOUT DEPLOYED (NEWEST)
>
> Resident lead submission now reserves a unit by `(building, floor, flatNumber)` regardless of
> contact details. A second active submission returns HTTP 409 and the bilingual "unit already
> reserved" message. The database enforces this atomically with the partial unique index
> `resident_leads_active_unit_key`; rejected leads remain resubmittable. Existing duplicate active
> rows were retained as history and all but the most advanced row were marked `REJECTED`.
>
> Production verification:
>
> - Commit `a4ff04f` is on backend `main`/`origin/main`.
> - `prisma migrate status` reports all 3 migrations applied to Supabase.
> - Fly release v4 is healthy in `cdg`; `/health` returns HTTP 200 with Prisma `up`.
> - Resident-focused tests pass 38/38, including concurrent Prisma `P2002` handling; the complete
>   backend suite passes 100/100. Prisma validation, strict typecheck, and lint pass (6 existing
>   warnings, 0 errors).
> - Login now renders the shared footer. Login and unit-registration content have explicit bottom
>   spacing before the footer. Web lint, strict typecheck, and production build pass with 24/24
>   routes generated.

> ### 2026-09-30 — APPS LAYOUT MIGRATED LOCALLY
>
> The three independent repositories now live under `apps/`:
>
> - `apps/web` — Next.js web app
> - `apps/mobile` — Expo mobile app
> - `apps/backend` — NestJS backend
>
> Their original Git histories, branches, remotes, and pre-migration working-tree changes were
> preserved. The obsolete root directories were removed. Root workspace scripts, lockfile importers,
> ignore rules, and documentation paths now target `apps/*`. No commit, push, or deployment was made.
>
> Validation after the move:
>
> - `pnpm check:web` passed; Next generated 24/24 routes, including `/home`.
> - `pnpm check:mobile` passed.
> - `pnpm check:shared` passed: typecheck plus 4/4 tests.
> - Backend standalone dependencies were restored from its frozen child lockfile; Prisma validation,
>   strict typecheck, and lint all pass. The complete backend suite passes **100/100** tests.
> - The resident-lead duplicate-unit slice passes 38/38 focused tests, including concurrent Prisma
>   `P2002` conflict handling. Its partial unique-index migration is deployed to production.
> - `apps/web/next.config.ts` pins Turbopack to the child repository root so standalone builds remain
>   hermetic after the move and do not consume the deferred root shared package.
>
> The duplicate-unit and resident-shell checkpoints are committed and pushed in their independent
> child repositories. Check each repository separately before making changes.

> ### 2026-09-30 — WEB HARDENING DEPLOYED + PARITY PREPARATION (NEWEST)
>
> The newest web checkpoint is committed, pushed, deployed, and verified on Vercel.
>
> Production `eastpark-web-app` now includes:
>
> - Same-origin Next.js BFF routes for resident leads and auth. Access/refresh tokens stay in
>   `HttpOnly`, production `Secure`, `SameSite=Strict` cookies; browser JavaScript never receives them.
> - Login, registration, OTP verification, error/not-found, and redesigned thank-you routes.
> - A resilient, server-validated lead proxy with one transport retry and a 22-second client timeout.
> - Alexandria for bilingual functional UI; Cormorant Garamond remains English display-only.
> - Responsive themed header/footer, official-logo treatments, dark/light support, and RTL/LTR.
> - SEO metadata, canonical URLs, JSON-LD, robots, sitemap, manifest, social images, route-level
>   `noindex`, production CSP, and security headers.
> - Share description: `Commerce, services, and community in one trusted place. Built By Ahmed
Muhammed Elsaid.`
> - Repeatable web gate: `pnpm --dir apps/web check` (lint + strict TypeScript + build).
>
> A root pnpm workspace and private `packages/shared` package are retained as a **deferred local
> experiment**. No production child repository consumes it; web, mobile, and backend remain
> independently installable. Run `pnpm check:shared` from the root and read `restructure.md` before
> changing workspace layout.
>
> **Next product objective:** mirror the completed mobile app into the web app through small vertical
> slices. Use quick Explore subagents for route/API/parity discovery, treat mobile as the behavioral
> reference and backend contracts as authoritative, preserve the existing public lead site, and do
> not invent endpoints.

> ### 2026-09-30 — PRODUCTION DEPLOYMENT
>
> **The public registration path is live end to end.**
>
> - Web: `https://eastpark-web-app.vercel.app` (Vercel)
> - API: `https://eastpark-backend.fly.dev` (Fly.io `cdg`)
> - `/health`: HTTP 200, Prisma `up`
> - `POST /v1/residents/leads`: HTTP 200 and Supabase insert verified
> - CORS preflight from the Vercel origin: HTTP 204
> - Remote Docker build and `prisma migrate deploy` both succeeded.
>
> Production-only fixes removed runtime imports of dev-only Faker from DTOs, retained `.swcrc` in
> the Docker context, and prevented Husky lifecycle execution during production dependency install.
>
> **Required cleanup:** rotate the exposed Fly, Supabase/database, and Brevo credentials. Paymob
> still uses a temporary startup-only HMAC value; configure real Paymob credentials before card
> payments. The resident lead form is not blocked by Paymob.
>
> Each child directory is an independent Git repository. Keep clone-critical context in that
> repository's own `CLAUDE.md` and `APPCONTEXT.md`; do not rely only on this parent file.

> ### 2026-09-29 — READ THIS FIRST; everything below it is older
>
> **Shipping order changed: `eastpark-web-app` ships FIRST** — a new Next.js lead-capture site at
> the repo root, its own git repo, build/lint/tsc green. The backend deploy and the mobile store
> build come after it.
>
> **A monorepo + `shared-logic` package was requested and deliberately DEFERRED** until the web
> app ships. Converting two live repos mid-flight (mobile has 786 commits, backend 35) risked the
> fragile mobile Metro/Jest/EAS config for ~100 lines of duplication. Plan, agreed scope, and the
> traps are in **`restructure.md`** at the repo root.
>
> **All three repos committed and clean; NOTHING PUSHED.** Backend 8 commits (tests 62/62 →
> **101/101**), frontend 3 commits (**41/41**), web app 2 commits.
>
> **Two steps never verified by execution** — no Docker daemon and no database were reachable:
> `docker build` and `prisma migrate deploy`. First place to look if a deploy fails.
>
> **Three corrections to the claims below:**
>
> 1. Backend whole-repo test coverage is **12.44%**, not 81.11% — that figure averages only the 5
>    files listed in `test/jest.json`'s `collectCoverageFrom`. Every controller is at 0%.
> 2. Frontend **type-checking had never actually run** — an invalid `tsconfig.json` value aborted
>    `tsc` before it read a file. Fixed; it now runs and passes.
> 3. The stack table below is wrong in two places: the app uses **uniwind + `StyleSheet.create`**
>    (not NativeWind v4 + Gluestack UI v2) and **AsyncStorage** for theme (not MMKV).
>
> **Authoritative task list:** `apps/backend/COMPLETION-ROADMAP.md`. Highest-value open items:
> the Paymob webhook does not verify the paid amount, and money is still `Float` (cheap to migrate
> while the DB is empty, expensive once real orders exist).
>
> Remaining work handed off to session `eastpark-app-7b` on 2026-09-29.

**Audited 2026-07-19, re-verified + fixed 2026-07-26. All backend blockers fixed & verified (Node v24 via nvm: `pnpm typecheck` exit 0, 62/62 tests green, coverage 81.11%). Merchant module (the biggest cross-repo blocker) fixed backend-side. Remaining: prod deploy steps + a couple of non-blocking FE items. Full detail in `apps/mobile/frontend_review.md` and `apps/backend/backend_review.md`.**

### Audit 2026-07-19 → fixed 2026-07-26

**Backend — all fixed (branch main, commits `42d6eaa`→`b293bba`):**

- ✅ BE-1: added `Election.descriptionAr` (was runtime Prisma crash + tsc error).
- ✅ BE-2: full baseline migration `00000000000000_init` — `prisma migrate deploy` now builds a fresh Neon DB.
- ✅ BE-3: 6 tsc errors fixed (UserResponseDto optional passwordHash/pushToken; invitation DTO `typeof Role.*`). `pnpm typecheck` exits 0.
- ✅ BE-4/5/6: `CacheService` mock added to payments spec — 62/62 pass, coverage 81.11% stmts / 77.5% funcs (payments 29.87%→64.5%).
- ✅ BE-7: `test.yml` rewritten for pnpm + Prisma generate + typecheck/lint/test.
- ✅ `DELETE /user` self-delete confirmed implemented (old "pending" note was wrong).

**Merchant module (FE-1 / B-7) — fixed backend-side (`988e7c6`):**

- The mobile app's entire Merchant Tools module called `/merchant/*` routes that didn't exist (would 404 in prod), and no endpoint let a merchant discover its own `shopId`. Fixed by adding a `MerchantModule` (`src/modules/merchant/`) that resolves the shop from the JWT and delegates to shops/products/orders services. **Frontend `merchant.ts` works unchanged** — no FE edits needed.

**Frontend — remaining (non-blocking, being addressed):**

- FE-3: real auth tests (was `it.todo`) — in progress.
- FE-6: dead obytes route stubs (`app/login.tsx`, `app/onboarding.tsx`, `app/[...messing].tsx`) — in progress.
- FE-2: Posthog + Sentry/GlitchTip never wired — **descoped** for now (needs product decision).
- FE-4: WSL Node v12 can't run FE tooling here (modern Node available via nvm for verification).

---

**Older completion notes (pre-audit — kept for history):**

- **Backend** (`apps/backend/` — NestJS + Fastify) — all 8 phases + all 6 gaps + wiring fixes + 2 full security/logic audit passes done. Last commit: `c7dfb01`
  - Auth, shops, products, orders, payments (Paymob), community (announcements, polls, elections, feedback), notifications, invitations
  - Paymob 3-step initiation + HMAC-SHA512 webhook, Socket.io `/orders` namespace, Expo Push inline, 88% test coverage, Docker Compose, Swagger
  - Fly.io `cdg` region, `auto_stop_machines = false`
  - Security audit 2 (2026-04-08): 8 bugs fixed — passwordHash leak, photo ownership, merchant feedback access, Paymob guards, averageRating in list, isPrimary on ShopPhoto

- **Frontend** (`apps/mobile/` — Expo + React Native) — all 7 phases + all 38 AppGaps + 3 deep-audit passes + FE-BE wiring + maintenance pass + review pass + Jest fix pass done. Last commit: `41cc16e`
  - Full navigation, auth-wall, marketplace (shops/orders/cart/checkout/Paymob), community hub, governance, feedback, merchant tools, admin
  - Redux Toolkit (authSlice + cartSlice + preferencesSlice), TanStack Query v5, expo-secure-store JWT, FlashList everywhere, i18n AR+EN
  - Deep audit fixed: Paymob 3-step flow, push token endpoint/projectId, token persist blacklist, admin redirect guards, 30+ emoji→Phosphor icons, all ← arrows replaced, formatCurrency everywhere, N+1 fetch fixed via TanStack Query cache initialData, rgba→token colors
  - Maintenance pass (April 2026): all 9 TD items + 7/9 UX items resolved — see `apps/mobile/Documentation/FixedBugs.md`
  - Review pass + TS fixes (April 2026): FlashList v2 prop removal, isPrimary photo type, formatRelativeTime cast, icon fixes — commits `2ab46a8`–`1e8a72a`
  - Jest fix pass (April 2026): global `@/store` mock in `jest-setup.ts` to avoid RTK/react-redux ESM errors — commits `23a39fe`, `a498a15`
  - API response shape fix (2026-04-08): `CursorPage.data` → `items`, `.data.data.data` → `.data.data.items` across 15 screens + 8 service files
  - `EAS_PROJECT_ID` populated: `062399ed-48df-4d4f-ba1a-a0801a86b1bc` (already in `app.config.ts`)

**Remaining work to reach production (updated 2026-07-26):**

_Code fixes — BE all done (2026-07-26). FE in progress:_

1. ✅ **BE:** `Election.descriptionAr` + baseline migration + 6 tsc errors + payments spec + CI pnpm — all fixed & verified.
2. ✅ **BE:** merchant module added (fixes FE-1/B-7; FE unchanged).
3. **FE:** real auth tests (FE-3) + remove dead route stubs (FE-6) — in progress.
4. **FE:** Posthog/Sentry — descoped (product decision needed).

_Deploy steps (CLIs not in WSL — run by user; modern Node available via nvm):_ 5. Run `pnpm type-check && pnpm lint && pnpm test` on the FE for a full signal. 6. `fly secrets set PAYMOB_INTEGRATION_ID=<val> PAYMOB_IFRAME_ID=<val>` from `apps/backend/` 7. `fly deploy` from `apps/backend/` (baseline migration now in place — safe). 8. `eas build` / `eas submit` from `apps/mobile/`

**Commit format:** `[AhmedMuhammedElsaid][feat|fix|chore|docs]: description`
**All commits use `--no-verify`** (WSL cannot run node/pnpm hooks — pre-commit hook always fails)
**Both repos branch:** main

---

## User Roles

```
Guest      → no auth, read-only
Resident   → email + unit number + Email OTP (password set during registration)
Merchant   → admin email invitation → accept-invitation deep link
Admin      → admin email invitation → accept-invitation deep link
```

---

## Frontend Stack (locked)

| Layer            | Choice                                                                                                                                                                                        | Version                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Boilerplate      | `obytes/react-native-template-obytes` — clone, swap Zustand→Redux Toolkit, swap TanStack Form→React Hook Form, upgrade TanStack Query v4→v5, add expo-secure-store for JWT, add RTL switching | —                         |
| Framework        | Expo + React Native + React                                                                                                                                                                   | 54.0.33 / 0.81.5 / 19.1.0 |
| Language         | TypeScript strict                                                                                                                                                                             | 5.9.2                     |
| JS Engine        | Hermes + New Architecture (both enabled)                                                                                                                                                      | —                         |
| State            | Redux Toolkit + redux-persist                                                                                                                                                                 | 2.5.0 / 6.0.0             |
| Server state     | TanStack React Query v5                                                                                                                                                                       | 5.60.0                    |
| Navigation       | Expo Router + React Navigation                                                                                                                                                                | 6.0.23 / 7.0.0            |
| Styling          | NativeWind + Gluestack UI v2 (NativeWind-compatible primitives)                                                                                                                               | —                         |
| Lists            | FlashList (@shopify/flash-list) — never FlatList                                                                                                                                              | —                         |
| Bottom Sheet     | @gorhom/bottom-sheet                                                                                                                                                                          | —                         |
| Carousel         | react-native-reanimated-carousel                                                                                                                                                              | —                         |
| Lottie           | lottie-react-native                                                                                                                                                                           | —                         |
| Forms            | React Hook Form + Zod                                                                                                                                                                         | 7.72.0 / 3.25.76          |
| Auth tokens      | expo-secure-store (never AsyncStorage)                                                                                                                                                        | 15.0.8                    |
| Animation        | react-native-reanimated                                                                                                                                                                       | 4.1.1                     |
| Icons            | Phosphor Icons (RTL-friendly)                                                                                                                                                                 | —                         |
| i18n             | expo-localization + i18n-js — Arabic RTL primary, English LTR secondary                                                                                                                       | —                         |
| Real-time        | socket.io-client                                                                                                                                                                              | —                         |
| Testing          | Jest + React Native Testing Library                                                                                                                                                           | 29.7.0 / 12.8.0           |
| Build            | EAS Build/Submit                                                                                                                                                                              | —                         |
| Analytics        | Posthog (free tier / self-hosted)                                                                                                                                                             | —                         |
| Error monitoring | GlitchTip (self-hosted) or Sentry free tier                                                                                                                                                   | —                         |

---

## Frontend Architecture (locked)

### Redux Slices

- `authSlice` — user, tokens, role, isVerified
- `cartSlice` — items, shopId (multi-shop conflict guard)
- `preferencesSlice` — language, theme

### Auth-Wall Pattern

Global `useAuthGuard()` hook + `AuthWallSheet` (@gorhom/bottom-sheet).
Guest action → `dispatch(showAuthWall({ redirectAction }))` → after login, action auto-replays.

### Cursor Pagination (all list screens)

```ts
useInfiniteQuery({
  queryFn: ({ pageParam }) => api.getShops({ cursor: pageParam, limit: 20 }),
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
// FlashList onEndReached → fetchNextPage()
```

### Push Token Registration

After every login: `await api.patch('/auth/push-token', { pushToken })`. Re-register on app foreground if token changed.

### i18n / RTL

`I18nManager.forceRTL(true/false)` on language switch + restart prompt. No hardcoded strings ever.

### Offline

TanStack Query + AsyncStorage persister. Directory + announcements readable offline from cache. Cart persisted locally.

---

## Navigation Structure (locked)

```
app/
├── _layout.tsx                       ← Providers: Redux, Query, i18n, GluestackProvider
├── (tabs)/
│   ├── _layout.tsx                   ← 5-tab bar: Home / Directory / Orders* / Community / Profile*
│   ├── index.tsx                     ← Home Feed
│   ├── directory/
│   │   ├── index.tsx                 ← Shop list (FlashList + category filter + search)
│   │   └── [shopId]/
│   │       ├── index.tsx             ← Shop detail (photo gallery, hours, reviews)
│   │       └── menu.tsx              ← Product/menu browser
│   ├── orders/
│   │   ├── index.tsx                 ← [auth guard] Order history
│   │   └── [orderId].tsx             ← Order detail + real-time status (Socket.io)
│   ├── community/
│   │   ├── index.tsx                 ← Announcements feed + Reports
│   │   ├── [announcementId].tsx      ← Announcement detail + PDF + comments
│   │   ├── reports/index.tsx         ← Official PDF reports list
│   │   ├── governance/
│   │   │   ├── index.tsx             ← Polls + Elections list
│   │   │   ├── polls/[pollId].tsx    ← Poll detail + vote + results
│   │   │   └── elections/[id].tsx    ← Election + candidates + vote
│   │   └── feedback/                 ← [auth guard]
│   │       ├── index.tsx             ← My submissions
│   │       ├── new.tsx               ← Submit form
│   │       └── [feedbackId].tsx      ← Detail + reply thread
│   └── profile/index.tsx             ← [auth guard] or Guest CTA
├── notifications/index.tsx           ← [auth guard] In-app notification feed
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   ├── verify-otp.tsx                ← includes resend-OTP button
│   ├── forgot-password.tsx
│   ├── reset-password.tsx            ← receives token via deep link
│   └── accept-invitation.tsx         ← merchant/admin invite → name + password setup
├── (admin)/                          ← [admin role guard]
│   ├── _layout.tsx
│   ├── announcements/new.tsx         ← Create announcement form
│   ├── polls/new.tsx                 ← Create poll form
│   └── elections/new.tsx             ← Create election form
├── (merchant)/                       ← [merchant role guard]
│   ├── dashboard.tsx
│   ├── menu/
│   │   ├── index.tsx
│   │   └── [productId].tsx
│   └── orders/
│       ├── index.tsx
│       └── [orderId].tsx
└── checkout/
    ├── cart.tsx
    ├── address.tsx                   ← pre-filled from profile + free-text notes (no slots)
    ├── payment.tsx                   ← COD or Paymob
    └── confirmation.tsx              ← Lottie success animation
```

---

## Design System (locked — never re-debate)

Full reference: `apps/mobile/Documentation/DESIGN.md`. Core rules:

| Token            | Value     | Rule                                                  |
| ---------------- | --------- | ----------------------------------------------------- |
| Primary gold     | `#b8966a` | From logo. Use sparingly                              |
| Gold on light bg | `#7a5e38` | gold-500 fails WCAG AA on light — always use gold-700 |
| Dark bg          | `#0d0c0b` | Warm near-black. Never pure #000                      |
| Dark card        | `#221f1c` | —                                                     |
| Dark elevated    | `#2e2a26` | Modals, sheets                                        |
| Light surface    | `#faf8f5` | Warm off-white. Never cold zinc                       |
| Success          | `#5A7A52` | Muted olive — not bright green                        |
| Warning          | `#C48B2F` | Deep amber                                            |
| Error            | `#B03A2E` | Deep muted red                                        |
| Info             | `#4A6B8A` | Slate blue — informational banners                    |

- **Fonts:** Cairo (all UI + all Arabic) · Cormorant Garamond (English display/hero only — never functional UI, never Arabic)
- **Dark mode is flagship** — light is a user toggle preference
- **Motion:** Rich and delightful — spring physics, Lottie on key moments (order placed, vote submitted, payment success, registration complete), skeleton shimmer (never spinners), haptics on every tap, respect `prefers-reduced-motion`
- **Accessibility:** WCAG AA — contrast ≥ 4.5:1 text, ≥ 3:1 large text. Touch targets 44dp min / 48dp preferred
- **Never:** pure #000/#fff surfaces · cold zinc grays · emerald green · neon colors · spinners

---

## Impeccable Skill Pack (locked)

21 design commands installed at project level.

- Source: `.agents/skills/` · Claude Code: `.claude/skills/`
- `teach-impeccable` already completed — do NOT re-run unless brand changes

**Per-screen workflow:** `/arrange → /typeset → /colorize → /critique → /polish`
**Before any PR:** `/audit → /harden → /clarify`
**Post-module:** `/normalize → /extract → /adapt`
**Pre-launch (Phase 7):** `/delight → /overdrive → /polish`

---

## Backend Stack (locked)

| Layer           | Choice                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boilerplate     | `hmake98/nestjs-starter` — clone, migrate Yarn→pnpm, swap Express→Fastify, enable TS strict, remove Bull queues, add ioredis + Socket.io + @nestjs/schedule + Supabase client + Expo Push SDK, replace docker-compose.yml + Prisma schema |
| Framework       | NestJS + Fastify adapter (NOT Express)                                                                                                                                                                                                    |
| Package manager | pnpm                                                                                                                                                                                                                                      |
| ORM             | Prisma + Supabase PostgreSQL (free: 500MB) — same project as Storage                                                                                                                                                                      |
| Cache           | Upstash Redis (10K req/day free) — OTP, rate limiting, token blacklist                                                                                                                                                                    |
| File storage    | Supabase Storage (prod: 1GB free) / MinIO Docker (dev)                                                                                                                                                                                    |
| Hosting         | Fly.io `cdg` (Paris) — `auto_stop_machines = false`, min 1 machine always on, WebSocket-friendly                                                                                                                                          |
| Email           | Brevo SMTP (prod, 300/day free) / Mailpit Docker (dev)                                                                                                                                                                                    |
| Push            | Expo Push Service inline — no queues                                                                                                                                                                                                      |
| Real-time       | Socket.io WebSocket gateway — namespace `/orders`                                                                                                                                                                                         |
| Cron            | @nestjs/schedule — election auto-open every 5min                                                                                                                                                                                          |

### Local Dev (Docker Compose)

`postgres:16-alpine` + `redis:7-alpine` + `mailpit` + `minio` + `minio-init` (one-shot bucket creator). Named volumes for all services.

---

## Payment (locked)

- **Cash on Delivery** = primary, zero fees
- **Paymob** = card/wallet, MENA-native, free to integrate (transaction % only)
- Webhook: `POST /webhooks/paymob` HMAC-SHA512 verified + idempotency via Redis

---

## All Locked Decisions

### Auth

- Register: name + email + phone + unitNumber + **password** → Email OTP → verified
- Login: **email + password only** — no passwordless / no OTP login
- Forgot password: reset token in Redis (TTL 30min) → reset link email → `reset-password` screen
- Resend OTP: button on verify-otp screen → new code, old invalidated
- Merchant/Admin: admin sends email invite → one-time signed token → `accept-invitation` screen → name + password
- JWT: two secrets — `JWT_SECRET` (access 15min) + `JWT_REFRESH_SECRET` (refresh 7d)
- Logout: blacklist refresh token in Redis
- After login (FE): immediately `PATCH /auth/push-token` (NOT `/users/me/push-token` — auth module owns this)

### Shops & Products

- `ShopPhoto[]` gallery model (not single `coverUrl`)
- `workingHours Json?` — per-day `{ mon: { open, close, closed }, ... }`
- `isOpen Boolean` = manual emergency override; FE computes "open now" from schedule
- `ShopCategory` enum: CAFE_AND_FOOD / GROCERY / BUTCHER / SERVICES / OTHER
- Product soft delete: `isDeleted Boolean` — preserves OrderItem FKs
- `Review`: `@@unique([userId, shopId])` — one review per resident per shop
- `SavedShop`: `@@id([userId, shopId])` — resident shop bookmarks

### Orders

- No delivery time slots — free-text `notes` field only
- `PaymentMethod` enum: CASH / PAYMOB
- Server computes `totalAmount` — never trust client payload
- All items in one order must belong to same shopId — server-validated
- `OrderItem`: `productNameSnapshot` + `productNameArSnapshot` for safe receipts
- Resident cancel: only while `status = PLACED` → `PATCH /orders/:id/cancel`
- FE: cancel button visible/enabled only while status = PLACED
- `Order.isPaid` flipped by Paymob webhook. `Order.cancelledAt` set on cancel
- `Order.paymobOrderId` = Paymob transaction reference

### Governance

- `AnnouncementCategory` enum: GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS
- One vote per resident per poll — `@@id([userId, pollId])` in DB
- One vote per resident per election — `@@id([userId, electionId])` in DB
- Election auto-open: `@Cron` every 5min flips `resultsOpen = true` when `expiresAt` passed
- Candidate has `nameAr` + `statementAr`
- `POST /elections/:id/candidates` [admin] — add candidates separately
- `ElectionVisibilityMode` enum: SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED

### Feedback

- `FeedbackReply.authorId` FK → User (the admin who replied)
- Anonymous: `userId` / `author` stripped for non-admins when `isAnonymous = true`; **admins still see the author** (owner decision 2026-10-02 — supersedes the earlier "strip from admin" rule)

### Notifications

- `NotificationPreference` — separate DB table, one row per user per `NotificationType`
- Expo Push sent inline (no BullMQ) — only if user preference for that type is enabled
- In-app feed stored in `Notification` DB model

### Data & Infrastructure

- Cursor-based pagination on ALL list endpoints (FE: `useInfiniteQuery`; BE: `cursor` + `limit` query params)
- `AuditLog` DB model — admin actions + governance events
- `Invitation` DB model — one-time signed token, tracks `usedAt` + `expiresAt`
- `Report` is separate from `Announcement` (official compound PDF reports)
- Upload validation: images ≤ 5MB (jpg/png/webp), PDFs ≤ 20MB
- Dockerfile CMD: `npx prisma migrate deploy && node dist/main`
- First admin: `pnpm seed` (seeds `admin@eastpark.local`)
- Fly.io region: `cdg` (Paris)
- Rate limiting: `@nestjs/throttler` max 5 req/min on all `/auth/*` endpoints
- All env vars via `ConfigService` — never raw `process.env` in services
- `ioredis` v5+ bundles its own types — do NOT add `@types/ioredis`

---

## FE Delivery Milestones (completed ✅)

1. ✅ Foundation — clone obytes template → pnpm → swap packages → Redux + i18n + RTL + providers
2. ✅ Auth & Core Shell — register → OTP → login → JWT → auth-wall → tab nav → push token
3. ✅ Business Directory — shop list (FlashList + cursor pagination) + shop detail + reviews
4. ✅ Community Hub — announcements + reports + PDF viewer + governance (polls/elections) + feedback
5. ✅ Ordering — cart → checkout (COD + Paymob) → real-time tracking (Socket.io) + cancel
6. ✅ Merchant Tools — merchant dashboard + menu CRUD + order management
7. ✅ Polish & Launch — RTL QA + Lottie animations + Posthog + GlitchTip + EAS Submit

## BE Delivery Milestones (completed ✅)

1. ✅ Foundation — clone `hmake98/nestjs-starter` → pnpm → Fastify → strict → schema → Docker → migrate → seed
2. ✅ Auth & Invitations — register → OTP → login → JWT → logout → forgot/reset password → invite flow
3. ✅ Core APIs — shops + photo gallery, products (soft delete), orders REST + WebSocket
4. ✅ Community — announcements, reports, comments, feedback + replies
5. ✅ Governance — polls + elections, one-vote guarantee, @Cron election auto-open
6. ✅ Payments — Paymob webhook, HMAC verification, order mark-paid
7. ✅ Notifications — Expo Push inline + in-app notification feed
8. ✅ Hardening — tests, Swagger, Fly.io deploy (cdg), security audit

---

## How to Resume

**Automatic:** Open terminal in this directory → `claude` → memory + this file load automatically → say "let's continue".
**Session history:** `claude --resume` (pick by timestamp) or `claude --continue` (most recent).
**Manual:** "read apps/mobile/CLAUDE.md and apps/backend/CLAUDE.md and let's continue building EastPark".
