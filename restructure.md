# EastPark — Monorepo Restructure Plan

**Status: ROOT-OWNED MONOREPO COMPLETE LOCALLY. Shared-package adoption remains deferred.**

On 2026-09-30, the three standalone repositories moved to `apps/web`, `apps/mobile`, and
`apps/backend`. The root repository now tracks all three application trees. Their final standalone
Git metadata and remotes are preserved outside the workspace at
`C:\Unite\EastPark-App-monorepo-backup` for rollback. The root workspace and private shared-package
prototype remain, but no production application consumes `@eastpark/shared` yet.

---

## Preserved constraints

| Fact                                                               | Consequence                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile has **786 commits** in its preserved standalone repository  | Keep the external backup until the root remote and deployments are verified                                                                                                                                                     |
| Backend has **35+ commits** in its preserved standalone repository | Keep the external backup until the root remote and deployments are verified                                                                                                                                                     |
| Root repo is on `master` and now owns all files under `apps/`      | Vercel and Render can use app-specific root directories from one repository                                                                                                                                                     |
| Mobile build config is fragile                                     | `jest-setup.ts` globally mocks `@/store` to dodge RTK/react-redux ESM parse errors; `transformIgnorePatterns` lists `immer\|@reduxjs/toolkit\|redux-persist`. Metro + Jest + EAS all need path remapping for a workspace layout |
| The real duplicated surface is small                               | `tokens.ts` is **93 lines** of constants; translations are data                                                                                                                                                                 |

Consuming the shared package still risks the mobile build for a payoff measured in roughly 100
lines of duplication. Carry that duplication until a real EAS workspace build is verified.

---

## Settled repository strategy

- Keep web, mobile, and backend under `apps/` as root-owned workspace packages.
- Preserve the former standalone repositories in the external migration backup until cutover is
  complete. The root imports are snapshots; historical child commits remain recoverable there.
- Add a root pnpm workspace and a private, path-only `@eastpark/shared` package.
- The root repository owns workspace files and the shared package. Existing app repositories keep
  owning their platform code.
- Revisit a single combined Git history only as a separate, explicitly approved operation.

## Agreed scope — what goes in the shared package

**Only platform-agnostic data. No React, no React Native, no Next.**

| Include              | Source of truth today                          | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/tokens.ts`    | `apps/mobile/src/theme/tokens.ts` (93 lines)   | `BRAND`, `LIGHT`, `DARK`, `SEMANTIC`, `SPACING`, `RADIUS`, `FONT`, `TYPE`. Pure TS constants, zero imports. **The two copies are no longer byte-identical** — mobile's was reformatted to double quotes by `eslint --fix` (commit `03d13bd`). All token _values_ are identical; only quote style differs. Whichever copy becomes the shared one, diff values not bytes |
| Translations         | `apps/mobile/src/translations/{ar,en}.json`    | ~650 strings. Web adds a `web` namespace for landing/form/thank-you copy — merge, don't fork                                                                                                                                                                                                                                                                           |
| Zod schemas          | Validation schemas across both apps            | Messages are **i18n keys** resolved via `t(...)` at render time — never inline English                                                                                                                                                                                                                                                                                 |
| Domain/API contracts | Backend DTOs and actual HTTP response shapes   | Backend is authoritative; mobile remains the behavioral reference                                                                                                                                                                                                                                                                                                      |
| Pure business rules  | Cart, order, localization, working-hours logic | No storage, networking, UI, or framework imports                                                                                                                                                                                                                                                                                                                       |
| `compound.ts`        | `apps/web/src/config/compound.ts`              | Phase/building/floor layout. **Web-only today — see the caveat below**                                                                                                                                                                                                                                                                                                 |

> **`compound.ts` is not a pure code move.** The mobile app has no building/floor/flat concept at
> all: `User.unitNumber` is a single free-text string. Sharing `compound.ts` only pays off if
> mobile _also_ adopts structured units — which is a **product decision**, not a refactor. Until
> someone decides that, moving this file into `shared` gives web a longer import path and nothing
> else. Either defer it, or make the structured-unit decision first. Do not let an implementer
> assume it is mechanical.

**Explicitly excluded** (decided, not an oversight):

- **API transport and token storage** — mobile uses Expo SecureStore while web needs a deliberate
  browser/server session design. Shared endpoint contracts do not imply shared credential handling.
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

The root owns all three application trees. Their prior histories remain available in the external
migration backup; importing those historical commit graphs into root remains unnecessary.

---

## Shared-package execution order

Do these one at a time, verifying between each. Never batch.

1. **Completed:** preserve each standalone `.git` directory in the external migration backup.
2. **Completed:** root tracks `apps/web`, `apps/backend`, and `apps/mobile`; all app checks run from
   root scripts.
3. **Populate `packages/shared`** — move `tokens.ts` first, on its own. It is 93 lines with zero
   imports and is the safest possible canary.
4. **Web consumes shared** — web is the lowest-risk consumer and is already shipped by this point,
   so a regression is visible immediately and reversible. Verify `pnpm build`, lint, `tsc --noEmit`.
5. **Backend consumes shared** only where a genuine contract benefit exists.
6. **Mobile consumes shared — LAST, and most carefully.** Metro needs `watchFolders` + resolver
   config for symlinked workspace packages; Jest needs `moduleNameMapper` for `@eastpark/shared`;
   EAS build must resolve workspace deps in CI. Verify type-check, lint, **41/41 tests**, and an
   actual `eas build` before calling it done.
7. **Delete the duplicated originals** only after each consumer is verified green.

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

## Deferred decisions

- **Historical commit graph import:** root owns current snapshots; old child commit graphs remain in
  the external backup and do not need to be rewritten into root.
- **Does the backend consume `shared` at all?** It has no tokens and no translations. If only
  Zod schemas apply, it may not be worth wiring in.
- **Publish or path-only?** Path-based workspace deps are simpler; a published package is only
  needed if something outside this repo consumes it. Default to path-only.
- **Directory migration:** completed as `apps/mobile`, `apps/web`, and `apps/backend` on
  2026-09-30.

---

_Companion: `apps/backend/COMPLETION-ROADMAP.md` (the backend/mobile completion audit).
The duplication this plan removes is deliberate and temporary so web and mobile can remain
independently installable while shared-package adoption is deferred._
