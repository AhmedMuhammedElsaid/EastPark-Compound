# EastPark Backend — Production Readiness Review

**Audit date:** 2026-07-19
**Auditor:** Opus exploration agent (read-only verification against `CLAUDE.md` claims)
**Scope:** `apps/backend/` (NestJS + Fastify)

**Verification pass: 2026-07-26** — every claim below was re-checked directly against current source (not inferred). Additionally, unlike the 2026-07-19 pass, a modern Node toolchain (`nvm` → Node v24.15.0, present on this machine alongside the WSL-default Node v12) was used to actually **run** `pnpm typecheck` and `pnpm test` (after manually restoring a missing `@swc/core` native binding — a local, non-repo, non-lockfile workaround) to get real, non-inferred signal instead of static reading. Results matched the 2026-07-19 written claims almost exactly, with one correction (BE-3 spans 3 files, not 2) and one addition (BE-3 is not just a `tsc`-only issue — see below). No source files were modified; only this review file was edited.

## Verdict

The root `CLAUDE.md` and session memory claim the backend is **100% complete, audited, production-ready** with **88% test coverage**. Verification confirms **all modules and endpoints exist and match the documented API surface**, but the "100%" claim is **overstated**: there are **2 genuine ship-blockers** (a schema/runtime bug and a broken migration baseline), plus `tsc --noEmit` fails with 6 type errors, the test suite has a failing suite, and the coverage figure is stale (~74%, not 88%). CI is also broken (still configured for yarn).

**Bottom line: ~90% done. Two hard deploy-blockers must be fixed before `fly deploy`. Status unchanged since 2026-07-19 — no code fixes have landed (working tree confirmed clean, no relevant commits since `c7dfb01`).**

---

## READY ✅

- **All modules exist and match the documented API surface** — auth (register / verify-otp / resend-otp / login / refresh / logout / forgot-reset / accept-invitation / push-token), shops (CRUD, photos, reviews, saved-shops), products (CRUD + soft delete), orders (REST + Socket.io `/orders` gateway + Paymob initiation), payments (webhook, HMAC-SHA512), announcements, comments, reports, feedback, polls, elections (+ candidates + cron auto-open), notifications (feed + preferences + Expo push), invitations (admin send/list), user (profile GET/PUT/DELETE + admin delete). **No missing modules.**
- **`DELETE /user` self-delete IS implemented** — `src/modules/user/controllers/user.public.controller.ts:62-69` calls `userService.deleteAccount`. This **corrects the stale memory/`APPCONTEXT.md` note** claiming it was "pending". ✅ Done. **Re-verified 2026-07-26**, line numbers exact: `@Delete()` decorator at line 62, `@AllowedRoles([Role.RESIDENT, Role.MERCHANT])` line 63, `deleteAccount` method calling `this.userService.deleteAccount(actor.userId)` at line 67-69.
- **No TODO/FIXME/mock/stub markers** in `src/` (one harmless doc-comment match only).
- **Prisma schema present** — all documented enums/models exist (~32 models/enums); locked decisions reflected (soft delete, `@@id` composite PKs for votes, `ShopPhoto[]`, etc.).
- **`docker-compose.yml`** — postgres, redis, mailpit, minio, minio-init all present.
- **`Dockerfile`** — multi-stage build, `prisma migrate deploy && node dist/main` CMD. **Re-verified**: line 41 exactly `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]`.
- **`fly.toml`** — region `cdg`, `auto_stop_machines = false`, `min_machines_running = 1` (matches locked decisions). **Re-verified**: `primary_region = "cdg"`, `auto_stop_machines = false`, `auto_start_machines = true`, `min_machines_running = 1` all present under `[http_service]`.
- **`.env.example`** — comprehensive: JWT/auth secrets, DATABASE_URL, REDIS_URL, SMTP (Brevo/Mailpit), Supabase/MinIO storage, Expo, Paymob, seed vars.
- **Build compiles** — `nest build` via SWC produces `dist/` cleanly.
- **ESLint** — 0 errors (6 minor unused-var warnings only) per the 2026-07-19 audit. **Not re-verified this pass** — `eslint` was still running after ~5 minutes on this machine (WSL filesystem I/O over the Windows-mounted drive is slow) and was killed rather than block the review further; no reason to doubt the original finding, but treat as unconfirmed-this-pass.
- **Working tree clean** — matches last commit. **Re-verified 2026-07-26**: `git status --short` shows only this review file's pre-existing untracked state and an unrelated `CLAUDE.md` doc edit — no source changes since commit `c7dfb01` (`git log` HEAD is `a646e15`, a credentials-cleanup commit after `c7dfb01`; no functional module changes).

---

## LEFT / MISSING ❌

| # | Item | Location | What's needed | 2026-07-26 status |
|---|---|---|---|---|
| BE-1 | **🚫 BLOCKER — `descriptionAr` schema/runtime bug.** `election.create()` writes `descriptionAr`, but the `Election` model has **no `descriptionAr` column** (only `Shop` line 138 and `Product` line 177 have it). Creating an election with `descriptionAr` throws a Prisma validation error at runtime; the read always returns `undefined`. FE `(admin)/elections/new.tsx` sends this field. | `src/modules/governance/services/elections.service.ts:55` (write), `:89` (read); `prisma/schema.prisma` `Election` model lines 344-358 | Add `descriptionAr String?` to `Election`, generate + commit a migration. | **CONFIRMED, still open.** Exact lines verified: write at `elections.service.ts:55` (`descriptionAr: dto.descriptionAr,`), read at `:89` (`descriptionAr: election.descriptionAr ?? null,`). `Election` model (schema.prisma:344-358) has no such field. `tsc` independently flags this as TS2561 at `elections.service.ts(55,17)`. |
| BE-2 | **🚫 BLOCKER — migration baseline broken.** Only one incremental migration exists (`20260401000000_add_election_visibility_mode`); the base schema was applied via `prisma db push`, not a migration. `prisma migrate deploy` (Dockerfile CMD) against a fresh Neon DB will **not** create the full schema — only the incremental change. | `prisma/migrations/` (missing baseline) | Create a full baseline migration (`prisma migrate diff` / `--create-only` / `migrate resolve`) before deploying to a from-scratch DB. | **CONFIRMED, still open.** `prisma/migrations/` contains exactly one directory (`20260401000000_add_election_visibility_mode`, containing only an `ALTER TABLE elections ADD COLUMN visibilityMode ...` + enum creation). No baseline migration exists. Dockerfile line 41 confirmed: `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]` — this would build an incomplete schema on a fresh DB. |
| BE-3 | **`tsc --noEmit` fails with 6 type errors** (build "succeeds" only because SWC skips type-checking). See breakdown below. | `auth.service.ts`, `elections.service.ts`, `invitation.create.dto.ts` | Fix all 6; add `pnpm typecheck` to CI so it can't regress. | **CONFIRMED via actual `tsc --noEmit` run** (not just code reading — ran it for real using Node v24.15.0 via `nvm`, since the WSL-default Node is v12 and can't run the toolchain). Exit code 2, exactly 6 errors. **Correction to the original file:** the 6 errors span **3 files, not 2** — the original "Location" column omitted `elections.service.ts:55` (BE-1's TS2561 is one of the 6, not a separate issue from BE-1). See corrected breakdown below. |
| BE-4 | **Test suite has a failing suite** — `payments.service.spec.ts` fails 10/62 with `Nest can't resolve dependencies of PaymentsService` — the spec's `TestingModule` never provides `CacheService`, now a required constructor param. Payments coverage ≈ **29.87%**. | `test/modules/payments.service.spec.ts` | Provide a `CacheService` mock in the TestingModule. | **CONFIRMED via actual test run.** `PaymentsService` constructor (`src/modules/payments/payments.service.ts:60-63`) takes `(DatabaseService, CacheService, ConfigService)`; the spec's `TestingModule` (line 110-116) only provides `PaymentsService`, `DatabaseService`, `ConfigService` — no `CacheService`. Real run: `Test Suites: 1 failed, 4 passed, 5 total. Tests: 10 failed, 52 passed, 62 total.` Failure reason confirmed verbatim: `Nest can't resolve dependencies of the PaymentsService (DatabaseService, ?, ConfigService)... argument CacheService at index [1]`. |
| BE-5 | **`pnpm test` exits non-zero** — coverage-threshold gate fails (functions 67.5% < 70% required) due to BE-4. | (test run) | Fixed once BE-4 is resolved; re-run to confirm real numbers. | **CONFIRMED via actual run.** Real output: `Jest: "global" coverage threshold for functions (70%) not met: 67.5%`, exit non-zero. |
| BE-6 | **Coverage "88%" is stale/misleading** — current run shows **~74.12%** overall statements (`coverage/coverage-summary.json`, generated 2026-04-08, before the payments spec broke). The global 88% figure only ever measured 5 hand-picked files per `test/jest.json`'s `collectCoverageFrom`, not all of `src/`. | `coverage/coverage-summary.json`, `test/jest.json` | Broaden `collectCoverageFrom`; report honest whole-`src` coverage. | **CONFIRMED, and re-generated live.** Re-running the full suite on 2026-07-26 reproduces the same numbers exactly: overall `lines/statements 74.12%, functions 67.5%, branches 80.99%`. `payments.service.ts` is the outlier at `29.87%` lines / `16.66%` functions (the 6 failing HMAC/webhook tests never execute). `test/jest.json`'s `collectCoverageFrom` is still scoped to only 5 files: `auth.service.ts`, `payments.service.ts`, `polls.service.ts`, `orders.service.ts`, `notifications.service.ts` — confirmed unchanged. |
| BE-7 | **CI stale/broken** — `.github/workflows/test.yml` still uses `yarn` (cache: yarn, `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`) even though the project migrated to `pnpm` (`packageManager: pnpm@9.15.0`, no `yarn.lock`). CI fails immediately on `yarn install`. Also never runs `typecheck` (defined in `package.json` `ci` script but omitted from the workflow). | `.github/workflows/test.yml` | Rewrite for pnpm; add `pnpm typecheck` step. | **CONFIRMED, still open.** Workflow file unchanged: `cache: 'yarn'`, `yarn install --frozen-lockfile`, `yarn lint`, `yarn format`, `yarn test` (no `yarn.lock` exists in the repo — confirmed via `ls`, only `pnpm-lock.yaml` present, 348KB). `package.json` confirms `"packageManager": "pnpm@9.15.0"`. Workflow also runs on Node 20.x (matrix), not tied to any pnpm setup step at all — would fail immediately at `yarn install`. `pnpm typecheck` still absent from the workflow. |

### `tsc --noEmit` error breakdown (BE-3) — corrected against a real run

Actual output (`tsc --noEmit`, Node v24.15.0, exit code 2):

```
src/common/auth/services/auth.service.ts(98,29): error TS2739: ...missing... passwordHash, pushToken
src/common/auth/services/auth.service.ts(138,29): error TS2739: ...missing... passwordHash, pushToken
src/common/auth/services/auth.service.ts(261,29): error TS2739: ...missing... passwordHash, pushToken
src/modules/governance/services/elections.service.ts(55,17): error TS2561: Object literal may only specify known properties, but 'descriptionAr' does not exist in type '...ElectionUncheckedCreateInput...'. Did you mean to write 'description'?
src/modules/invitations/dtos/request/invitation.create.dto.ts(13,11): error TS2702: 'Role' only refers to a type, but is being used as a namespace here.
src/modules/invitations/dtos/request/invitation.create.dto.ts(13,27): error TS2702: 'Role' only refers to a type, but is being used as a namespace here.
```

- `src/common/auth/services/auth.service.ts:98,138,261` (verifyOtp, login, acceptInvitation respectively) — `const { passwordHash: _h, pushToken: _p, ...safeUser } = user; return { ...tokens, user: safeUser };` — the destructured-rest object is missing `passwordHash`/`pushToken` fields that `UserResponseDto` (via `AuthResponseDto.user`) still declares as required, so TS considers `safeUser` an incomplete `UserResponseDto` (TS2739) even though this is the *intended* redaction behavior. This is a type-modeling gap, not a functional bug — the fix is to make those fields optional/omitted on `UserResponseDto` rather than to stop stripping them.
- `src/modules/governance/services/elections.service.ts:55` — this is the **same root cause as BE-1**, not an independent bug: `descriptionAr` genuinely doesn't exist on the Prisma `Election` model, so `tsc` catches it as a type error in addition to it being a runtime Prisma-validation crash.
- `src/modules/invitations/dtos/request/invitation.create.dto.ts:13` — `role: Role.MERCHANT | Role.ADMIN` (confirmed on line 13) uses `Role` as a namespace for member-access types; TS5 / Prisma's enum-as-const-object no longer supports this (TS2702, ×2, one per enum member access). Fix with `role: (typeof Role)[keyof typeof Role]` or `$Enums.Role.MERCHANT | $Enums.Role.ADMIN`.

**Net effect:** BE-3 is really only **2 independent defects** (the `UserResponseDto` typing gap ×3 call sites, and the `Role`-as-namespace usage ×2 error sites) plus **1 duplicate of BE-1** (the `elections.service.ts` error). Fixing BE-1 removes one of the six `tsc` errors "for free."

---

## REQUIRED USER ACTIONS

1. **Fix `descriptionAr`** on the `Election` model + generate/commit a Prisma migration. (Also clears 1 of the 6 `tsc` errors.)
2. **Fix the migration baseline** — create a full baseline migration so `prisma migrate deploy` builds a fresh Neon DB correctly.
3. **Fix the remaining TS errors** — `UserResponseDto` should not require `passwordHash`/`pushToken` on the redacted-response shape (3 sites in `auth.service.ts`), and the `invitations` DTO's `Role.MERCHANT | Role.ADMIN` namespace usage needs `(typeof Role)[keyof typeof Role]` or `$Enums.Role` (2 sites). Add `pnpm typecheck` to CI.
4. **Fix `payments.service.spec.ts`** (provide `CacheService` mock); re-run `pnpm test` to confirm real coverage (currently failing / ~74%, verified live on 2026-07-26).
5. **Fix `.github/workflows/test.yml`** to use pnpm (or replace it) so CI actually runs.
6. **`fly secrets set PAYMOB_INTEGRATION_ID=<val> PAYMOB_IFRAME_ID=<val>`** from `apps/backend/`.
7. **`fly deploy`** from `apps/backend/` — **only after** BE-2 (migration baseline) is resolved, since deploy runs `prisma migrate deploy` against a fresh prod DB.

---

*Companion file: `../mobile/frontend_review.md`. See root `CLAUDE.md` for synced current status.*
*Verification-pass tooling note: WSL's default Node is v12 (cannot run this project's toolchain). This pass used `nvm` (already installed on the machine) to switch to Node v24.15.0 and ran `pnpm typecheck` / `pnpm test` for real, after manually placing a missing `@swc/core-linux-x64-gnu` native binding fetched via a scratch `npm install` in `/tmp` (not added to the repo, `package.json`, or `pnpm-lock.yaml` — purely a local `node_modules` file-copy workaround so the existing SWC-based Jest/tsc config could run). This means BE-3/BE-4/BE-5/BE-6 are now backed by actual command output, not inference — see the tables above for exact figures.*
