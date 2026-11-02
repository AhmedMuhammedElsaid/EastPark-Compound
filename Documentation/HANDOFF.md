# EastPark: session handoff (portable state)

Updated **2026-11-02**. This file travels with `git pull`, so any machine or Claude session can continue
from it. Read it after root `CLAUDE.md`. No secrets, credentials or personal data here: the GitHub repo is
public. Credentials stay in each machine's `.env` and in the owner's password manager.

## Where work stands

| Branch | Tip | State |
|---|---|---|
| `main` | `f806451` | live in prod (Vercel web, Render backend) |
| `feature/flat-listings` | `0ab5997` | Sell/Rent flats done, reviewed, fixed. Ready for a PR. Not deployed. |
| `feature/accounting` | see `git log` | built on `feature/flat-listings`, so its PR goes **after** listings |

### Accounting (Phase 1a, 8 slices; spec `Documentation/ACCOUNTING-PHASE-1A-TASKS.md`)

| Slice | What | State |
|---|---|---|
| 1+2 | ACCOUNTANT role: backend, web, mobile confinement | done, Opus-reviewed, fixed |
| 3 | 690-flat layout, `check-flat-keys.sql`, unit/lead key-repair PATCHes | done, reviewed, fixed |
| 4 | `finance_foundations` migration (14 tables, 690 flats, ownership backfill, view, RLS) | built (`e0596e2`, `b9f1e23`) and reviewed (`ACCOUNTING-SLICE-4-REVIEW.md`); **findings not fixed yet**; SQL never executed |
| 5 | ownership writers + listings link | next |
| 6 | finance kernel + privacy-policy finance section (own web commit, deploys first) | todo |
| 7 | payments + private attachments (`eastpark-finance` bucket) | todo |
| 8 | accountant UI, web + mobile | todo |

**Immediate next steps:**
1. Fix slice 4's M1 (`resident-units.service.ts` must trim space, tab, CR and LF like the migration:
   `btrim(x, E' \t\r\n')`) and the Lows that belong to slice 4.
2. Carry M2 into slice 5: a catch-up for units created during the deploy window with no `flatId` and no
   ownership period.
3. Carry M3 into slice 5: store a finance go-live date, which the link step depends on.
4. Then build slices 5 to 8. The review docs are `Documentation/ACCOUNTING-SLICE-*-REVIEW.md`.
5. When all slices are done, write root **`steps.md`**. It replaces the draft
   `Documentation/RELEASE-RUNBOOK-LISTINGS-ACCOUNTING.md`.

### Owner decisions (final)
- 690 flats; phase 4 buildings are **C3, E2, F2** (follow `apps/web/src/config/compound.ts`).
  Approval threshold seed: **5000 EGP**.
- Flats decisions: `Documentation/LISTINGS-DECISIONS.md`. Privacy timing: `Documentation/ACCOUNTING-PRIVACY-DECISION.md`.
- The policy finance section goes live with slice 6, web first. No ACCOUNTANT invite and no finance or slip
  data in prod before that. The Play Data safety form is updated before the slice 8 OTA.
- **Build ALL slices before any deploy.** Then follow `steps.md`.

## How the owner wants the work done

- **Orchestration:** for big features, the assistant orchestrates subagents and fires an independent Opus
  review after every plan and slice. Give the reviewer the diff and the spec, not conclusions. Fix the
  findings, run the gates, commit.
- **Reviewer output cap:** subagents die at 8192 output tokens. Make them write the report file
  incrementally: a short Write, then small Edit appends. Keep replies under about 150 words.
- **One branch per feature** (`feature/<name>` off `main`), so each can be reviewed in a PR. Ask before
  any push or PR.
- **Code vs operations split:** the dev machine does code only. Every action on prod or on service
  providers goes into `steps.md` as copy-pasteable commands, which the owner runs from their own machine.
  That includes Supabase SQL and buckets, backups, Render, Vercel, EAS, Play Console and merging to
  `main`. Secrets appear as placeholders such as `$DIRECT_DATABASE_URL`. Never use the claude.ai Supabase
  MCP: it is linked to a different project.
- **Commits:** `[AhmedMuhammedElsaid][feat|fix|docs|chore]: ...`, `--no-verify`, trailer
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Traps (cost real time before)

- **Migrations:** never run `prisma migrate dev`. It drops the unmodelled partial indexes
  (`listings_active_unit_key`, `resident_leads_active_unit_key`). Generate offline instead:
  `git show HEAD:apps/backend/prisma/schema.prisma > /tmp/before.prisma`, then
  `prisma migrate diff --from-schema-datamodel /tmp/before.prisma --to-schema-datamodel prisma/schema.prisma --script`,
  then edit by hand and audit every `DROP`. Enum values are added with `ALTER TYPE ... ADD VALUE` in their
  own migration.
- **Render and Vercel deploy every push to `main`**, and Render runs `prisma migrate deploy` on boot. A
  failed migration blocks every deploy until `prisma migrate resolve --rolled-back <name>`. Back up first.
- **Mobile:**
  - never put `*.test.tsx` under `src/app/`;
  - run `npx expo export --platform android` before a build, then `git checkout apps/mobile/uniwind-types.d.ts`;
  - OTA is fine for JS-only changes; bump `version` only for native changes (`runtimeVersion: appVersion`);
  - don't add listings to `PERSISTED_QUERY_ROOTS` (PII).
- **WSL dev machine:**
  - WSL node is too old, so run gates through `powershell.exe -NoProfile -Command "cd C:\...; npx ..."`;
  - node_modules are owned by Windows pnpm, so don't `pnpm install` from WSL;
  - Windows tools cause CRLF churn, so `git fetch` and check ahead/behind at session start.
- **Docker/psql** were unavailable on the dev machine, so the slice 4 SQL and `pnpm test:db` have never
  run. They must run against Postgres 15 before deploying (a `steps.md` step). Prod Postgres must be 15 or
  newer: the view uses `security_invoker`.
- **Untracked `eastpark-frontend/`** is a stale legacy snapshot. It is not the mobile app (`apps/mobile`
  is). Don't commit it; it contains a `.env.local`.

## Gates

- backend: `prisma validate`, tsc, eslint, `jest --config test/jest.json`; `pnpm test:db` needs `TEST_DATABASE_URL`.
- web: `pnpm --dir apps/web check` (eslint, tsc, vitest, build).
- mobile: `pnpm check:mobile` plus `npx expo export --platform android`.
