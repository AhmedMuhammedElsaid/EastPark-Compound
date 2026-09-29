# EastPark — Monorepo Restructure Plan

**Status: DEFERRED. Do not start until `eastpark-web-app` is shipped and stable in production.**

Decided 2026-09-29. The user asked for a monorepo with a shared package so mobile and web stop
duplicating code. Sequencing was deliberately deferred: web ships first, this happens after.

---

## Why this is deferred, not dropped

| Fact | Consequence |
|---|---|
| `eastpark-frontend` is its own git repo — **786 commits**, branch `main` | Converting means rewriting or losing that history |
| `eastpark-backend` is its own git repo — **35 commits**, branch `main` | Same |
| Root repo is on `master`; the three projects are nested but independent | Three histories to reconcile, not one |
| Mobile build config is fragile | `jest-setup.ts` globally mocks `@/store` to dodge RTK/react-redux ESM parse errors; `transformIgnorePatterns` lists `immer\|@reduxjs/toolkit\|redux-persist`. Metro + Jest + EAS all need path remapping for a workspace layout |
| The real duplicated surface is small | `tokens.ts` is **93 lines** of constants; translations are data |

Doing this mid-flight — while the stated priority is shipping web — risks breaking the mobile
build for a payoff measured in ~100 lines of duplication. Carry the duplication for one release.

---

## Agreed scope — what goes in the shared package

**Only platform-agnostic data. No React, no React Native, no Next.**

| Include | Source of truth today | Notes |
|---|---|---|
| `theme/tokens.ts` | `eastpark-frontend/src/theme/tokens.ts` (93 lines) | `BRAND`, `LIGHT`, `DARK`, `SEMANTIC`, `SPACING`, `RADIUS`, `FONT`, `TYPE`. Pure TS constants, zero imports. **The two copies are no longer byte-identical** — mobile's was reformatted to double quotes by `eslint --fix` (commit `03d13bd`). All token *values* are identical; only quote style differs. Whichever copy becomes the shared one, diff values not bytes |
| Translations | `eastpark-frontend/src/translations/{ar,en}.json` | ~650 strings. Web adds a `web` namespace for landing/form/thank-you copy — merge, don't fork |
| Zod schemas | Validation schemas across both apps | Messages are **i18n keys** resolved via `t(...)` at render time — never inline English |
| `compound.ts` | `eastpark-web-app/src/config/compound.ts` | Phase/building/floor layout. **Web-only today — see the caveat below** |

> **`compound.ts` is not a pure code move.** The mobile app has no building/floor/flat concept at
> all: `User.unitNumber` is a single free-text string. Sharing `compound.ts` only pays off if
> mobile *also* adopts structured units — which is a **product decision**, not a refactor. Until
> someone decides that, moving this file into `shared` gives web a longer import path and nothing
> else. Either defer it, or make the structured-unit decision first. Do not let an implementer
> assume it is mechanical.

**Explicitly excluded** (decided, not an oversight):

- **API client layer** — the mobile client is coupled to `expo-secure-store` for token storage.
  Sharing it requires abstracting storage behind an interface first. Separate task.
- **Redux slices** — largest blast radius on mobile, least benefit.
- **Anything rendering UI** — RN primitives and DOM elements do not share.

---

## Preconditions

1. `eastpark-web-app` is deployed to Vercel and verified working end-to-end against the backend.
2. Both mobile and web are committed with clean working trees.
3. Mobile is green: `pnpm type-check` exits 0, `pnpm lint` clean, tests **41/41**.
4. Backend is green: `pnpm typecheck` exits 0, tests **62/62**.
5. A tagged commit on each repo to roll back to.

---

## Target layout

```
EastPark-App/                      ← pnpm workspace root
├── pnpm-workspace.yaml
├── package.json                   ← workspace scripts only, no app deps
├── packages/
│   └── shared/                    ← @eastpark/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── theme/tokens.ts
│           ├── translations/{ar,en}.json
│           ├── schemas/
│           └── config/compound.ts
├── apps/
│   ├── mobile/                    ← was eastpark-frontend
│   ├── web/                       ← was eastpark-web-app
│   └── backend/                   ← was eastpark-backend
```

Whether the three keep separate git histories (git subtree / submodules) or collapse into one
repo is **an open decision** — see below.

---

## Execution order

Do these one at a time, verifying between each. Never batch.

1. **Tag rollback points** — `git tag pre-monorepo` in all three repos.
2. **Decide the git strategy** (see open questions). Do not proceed until settled.
3. **Create the workspace skeleton** — root `pnpm-workspace.yaml` + `packages/shared`. Nothing
   consumes it yet. Verify all three apps still build untouched.
4. **Populate `packages/shared`** — move `tokens.ts` first, on its own. It is 93 lines with zero
   imports and is the safest possible canary.
5. **Web consumes shared** — web is the lowest-risk consumer and is already shipped by this point,
   so a regression is visible immediately and reversible. Verify `pnpm build`, lint, `tsc --noEmit`.
6. **Backend consumes shared** *(if anything applies — likely only Zod schemas)*. Verify typecheck + 62/62.
7. **Mobile consumes shared — LAST, and most carefully.** Metro needs `watchFolders` + resolver
   config for symlinked workspace packages; Jest needs `moduleNameMapper` for `@eastpark/shared`;
   EAS build must resolve workspace deps in CI. Verify type-check, lint, **41/41 tests**, and an
   actual `eas build` before calling it done.
8. **Delete the duplicated originals** only after each consumer is verified green.

---

## Known traps

- **Metro + symlinks.** React Native's bundler historically breaks on pnpm's symlinked
  `node_modules`. Expect to need `watchFolders` and possibly `node-linker=hoisted` in `.npmrc`.
- **Jest.** The existing global `@/store` mock and `transformIgnorePatterns` must keep working.
  Adding a workspace package changes resolution — re-verify the ESM mocking still holds.
- **EAS Build.** Cloud builds must install workspace dependencies. Verify with a real build, not locally.
- **JSON imports.** Translations as `.json` need `resolveJsonModule` consistent across all three
  tsconfigs.
- **`tokens.ts` must stay import-free.** If anything Next- or RN-specific creeps in, it stops
  being shareable. Guard this.

---

## Open questions — decide before starting

- **Git history:** one repo (histories merged via subtree) or keep three (submodules)? 786 + 35
  commits of real history are at stake. Losing mobile's history would be the single most
  destructive outcome of this work.
- **Does the backend consume `shared` at all?** It has no tokens and no translations. If only
  Zod schemas apply, it may not be worth wiring in.
- **Publish or path-only?** Path-based workspace deps are simpler; a published package is only
  needed if something outside this repo consumes it. Default to path-only.
- **Rename directories?** `eastpark-frontend` → `apps/mobile` is clearer but breaks every
  existing doc path, CI reference, and muscle-memory command. Could keep the current names
  under `apps/`.

---

*Companion: `eastpark-backend/COMPLETION-ROADMAP.md` (the backend/mobile completion audit).
The duplication this plan removes is deliberate and temporary — see the "Design mirroring"
section of Prompt B in `migration.md`.*
