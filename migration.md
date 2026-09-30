# EastPark — Migration & Next-Phase Plan

Two pieces of work, sequenced:

1. **Prompt A** — a read-only roadmap of what's left to finish the backend (database first) and the mobile app.
2. **Prompt B** — build `eastpark-web-app`, a Vercel-hosted web mirror of `eastpark-frontend` whose job is collecting resident data via a form.

Run A, review its `ResidentLead` schema proposal, then run B. Both prompts live in this file as paste-ready blocks.

---

## 1. Verified findings

A prior exploration session read both repos. These are verified against source as of 2026-09-29. Don't rediscover them — but **do** re-verify any specific claim before acting on it, since commits may have landed since.

### The resident form cannot store data as originally specified

`User.passwordHash` is required and `User.email` is `@unique` (`apps/backend/prisma/schema.prisma`). A public form collecting only building / floor / flat / parking can neither create a `User` row nor identify the submitter.

**Resolved:** the form gains `name` + `email` + `phone`, and submissions land in a new `ResidentLead` model (no auth, no password), later matched/invited into a real `User`.

### No building / floor / flat / parking exists in the schema

`User` has only a free-text `unitNumber String?`. This is a from-scratch model + migration, not a tweak.

### More of the design system ports than expected

- `apps/mobile/src/theme/tokens.ts` (93 lines) is pure TypeScript constants — `BRAND`, `LIGHT`, `DARK`, `SEMANTIC`, `SPACING`, `RADIUS`, `FONT`, `TYPE`. No React Native imports.
- `tailwindcss@4.1.18` is already a devDependency, and `apps/mobile/src/global.css` is a valid Tailwind v4 entry file a web app can import unchanged.
- Also portable as-is: `src/services/api/*.ts` (axios interceptors are platform-agnostic), `src/translations/*.json` (~650 strings), every Zod schema, the Redux store.

### The stack docs are wrong

`CLAUDE.md` and `apps/mobile/Documentation/APPCONTEXT.md` claim **NativeWind v4 + Gluestack UI v2** and **MMKV** theme storage. Reality: **uniwind + `StyleSheet.create`**, and **AsyncStorage**. Mirror the tokens and the visual result, not the claimed component library.

### Do not port these three paths

| Path | Why |
|---|---|
| `src/components/ui/form-utils.ts` | TanStack Form API (`field.state.meta.isTouched`) — orphaned template code, not RHF |
| `src/lib/api/**` | Dead duplicate axios client with the wrong pagination shape |
| `src/features/**` | Orphaned |

### The form pattern already exists

11 screens use React Hook Form + Zod via `<Controller>`, and Zod validation messages are **i18n keys** resolved through `t(...)` at render time — see `apps/mobile/src/app/(auth)/login.tsx:29`. RHF + Zod + `@hookform/resolvers` are web-identical, so the validation layer is a straight copy; only the input components get rebuilt (`onChangeText`→`onChange`, `keyboardType`→`inputMode`, `secureTextEntry`→`type="password"`).

### Database gaps the earlier audit never examined

- Money stored as `Float` / `DOUBLE PRECISION` — should be `Decimal(10,2)` before real transactions.
- Zero non-unique indexes — no FK or `createdAt` indexes, despite cursor pagination on every list endpoint.
- No Neon pooling story — no `directUrl`, no pgbouncer / `connection_limit`.
- No `prisma.seed` hook in `package.json`, so `migrate reset` won't reseed.

### Deploy gaps

- `APP_ENV` is not set in `fly.toml`. That leaves Swagger public at `/docs`, Helmet CSP off, and `APP_CORS_ORIGINS` defaulting to `*` with `credentials: true`.
- Seven Supabase/Paymob secrets use `config.getOrThrow()`, but their factories default to `''`. `getOrThrow` only throws on `undefined`, so it never fires — the app boots with empty credentials and fails at the first API call instead of at startup.

### Mobile build blockers

- `apps/mobile/eas.json`: `submit.production` and `submit.preview` are both `{}` — store submission is impossible as configured.
- No profile supplies `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`. They rely on EAS server-side env vars that must be verified with `eas env:list --environment production`, or cloud builds ship pointing at `localhost:3000`.

### Test reality

The headline 81.11% backend coverage is measured over 5 hand-picked files (`apps/backend/test/jest.json`, `collectCoverageFrom`). 8 of the 13 modules under `apps/backend/src/modules/` have zero tests. No e2e tests exist.

### Toolchain

- Default shell Node is **v12.22.9 (unusable)**. Node **v24.15.0** is available via nvm — prefix every command with `. ~/.nvm/nvm.sh && nvm use 24`.
- `vercel` and `fly` CLIs are **not installed**.
- `eastpark-frontend` and `eastpark-backend` are independent git repos on `main`; the root repo is on `master`.
- The frontend has 3 uncommitted whitespace-only files and a stray `package-lock.json`.

---

## 2. Settled decisions — do not re-litigate

| Question | Decision |
|---|---|
| Web app scope | Form-first landing site: landing + resident form + thank-you. Full feature mirror comes later. |
| Form storage | New `ResidentLead` model — forced by the `passwordHash` constraint |
| Building options | Config-driven in a single constants file, never hardcoded in form code |
| Identity fields | Add `name` + `email` + `phone` to the form |
| Sequencing | Roadmap (Prompt A) first, then build (Prompt B), so the web form targets a settled API contract |
| Model routing | Opus 5.5 for judgment, Sonnet 5.5 for mechanical work |

---

## 3. Model routing policy

Both prompts delegate via the Agent tool with an explicit per-subtask `model` override.

**The rule:** if a wrong answer is cheap to detect and cheap to fix → **Sonnet 5.5**. If a wrong answer silently ships to production or is expensive to reverse → **Opus 5.5**. When uncertain → **Opus 5.5**.

**Always:**
- Review every Sonnet result against source before acting on it.
- Launch independent subagents in parallel, in a single message.
- Never let unreviewed subagent output become a schema or security decision.

### Prompt A routing

| Subtask | Model | Why |
|---|---|---|
| `ResidentLead` schema design + lead→User matching | Opus 5.5 | Irreversible; everything downstream depends on it |
| `Float`→`Decimal(10,2)` migration + risk analysis | Opus 5.5 | Data-loss risk on money |
| Security pass: `getOrThrow`, `APP_ENV`, CORS, Swagger | Opus 5.5 | Silent production exposure |
| Final P0/P1/P2 prioritization | Opus 5.5 | Cross-cutting judgment |
| Enumerate env vars + secrets for `fly secrets set` | Sonnet 5.5 | Mechanical grep across config files |
| Enumerate missing indexes on cursor-paginated models | Sonnet 5.5 | Mechanical schema read |
| Run FE type-check / lint / test, report output | Sonnet 5.5 | Bounded, verifiable |
| `eas.json` submit-block required fields | Sonnet 5.5 | Documented, enumerable |
| Inventory the 8 untested modules + real coverage | Sonnet 5.5 | Counting |

The three Sonnet enumeration tasks are independent — launch them in parallel in one message.

### Prompt B routing

| Subtask | Model | Why |
|---|---|---|
| Landing page visual design + token→Tailwind mapping | Opus 5.5 | Design judgment; a credible mirror is the whole point |
| `ResidentLead` NestJS module design + rate-limit strategy | Opus 5.5 | Public write endpoint — abuse surface |
| Final review of all Sonnet output before commit | Opus 5.5 | Quality gate |
| Scaffold Next.js + copy tokens / `global.css` / translations | Sonnet 5.5 | Mechanical |
| Build the 7 form fields from the fixed spec | Sonnet 5.5 | Spec is exact; errors are immediately visible |
| `src/config/compound.ts` constants | Sonnet 5.5 | Trivial |
| NestJS controller / service / DTO / spec boilerplate | Sonnet 5.5 | Only after Opus approves the shape |
| Vercel deploy steps + env var list | Sonnet 5.5 | Documented procedure |

Scaffolding and the compound config are independent of the backend module — run them in parallel. Form fields depend on the scaffold; the NestJS boilerplate depends on Opus's approved schema.

---

## 4. Prompt A — backend + mobile completion roadmap

**Read-only. Run this first.** Review its `ResidentLead` schema proposal before running Prompt B.

```text
You are the lead agent on a READ-ONLY audit. Make NO code edits, NO migrations, NO commits.
Your single deliverable is a markdown report at apps/backend/COMPLETION-ROADMAP.md.

Repo root: /mnt/c/Unite/EastPark-App
  apps/backend/   NestJS + Fastify + Prisma + Neon (git repo, branch main)
  apps/mobile/  Expo + React Native (git repo, branch main)

TOOLCHAIN: default shell Node is v12.22.9 and cannot run the tooling. Prefix EVERY
command with:  . ~/.nvm/nvm.sh && nvm use 24
The `fly` and `vercel` CLIs are NOT installed — never assume you can run them.

START BY READING: CLAUDE.md, apps/backend/backend_review.md,
apps/mobile/frontend_review.md. Treat the VERDICT PARAGRAPHS in both review
files as STALE — fixes landed in commits written after those bodies. Verify every
claim against current source before it enters your report.

MODEL ROUTING — delegate via the Agent tool with an explicit per-subtask `model`.
Rule: a wrong answer that is cheap to detect and fix -> Sonnet 5.5. A wrong answer
that silently ships to production or is expensive to reverse -> Opus 5.5. Uncertain
-> Opus 5.5. Review every Sonnet result against source before acting on it. Never
let unreviewed subagent output become a schema or security decision.

  Opus 5.5:   ResidentLead schema design + lead->User matching
              Float->Decimal(10,2) migration + data-loss risk analysis
              Security pass (getOrThrow / APP_ENV / CORS / Swagger)
              Final P0/P1/P2 prioritization
  Sonnet 5.5: Enumerate env vars + secrets needed for `fly secrets set`
              Enumerate missing indexes on cursor-paginated models
              Run FE type-check / lint / test under Node 24 and report raw output
              Enumerate eas.json submit-block required fields
              Inventory the untested modules + compute real coverage

Launch the independent Sonnet enumeration subagents IN PARALLEL, in a single message.

=== PART 1 — DATABASE (the priority) ===

1a. Design a ResidentLead model. Context: the public web form cannot create a User
    row, because User.passwordHash is required and User.email is @unique. Fields:
    name, email, phone, building, floor, flatNumber, parking (nullable), createdAt,
    plus a status field for the later invite->User conversion. Specify:
      - the uniqueness rule that prevents duplicate submissions per unit
      - how a lead is later matched onto a real User
      - the exact Prisma schema diff
      - the exact `prisma migrate dev` command that generates it
    Also note: nothing in the current schema models building/floor/flat/parking.
    User has only a free-text `unitNumber String?`.

1b. Address these four known gaps with concrete diffs:
      - Money is Float / DOUBLE PRECISION; should be Decimal(10,2). List EVERY
        affected field and the data-migration risk for each.
      - Zero non-unique indexes exist, despite cursor pagination on every list
        endpoint. Enumerate the missing FK and createdAt indexes.
      - No Neon pooling story: no directUrl, no pgbouncer / connection_limit.
      - No `prisma.seed` hook in package.json, so `migrate reset` won't reseed.

1c. Rank everything in Part 1: must-fix-before-launch vs can-wait.

=== PART 2 — BACKEND TO PRODUCTION ===

2a. APP_ENV is not set in apps/backend/fly.toml. That leaves Swagger public at
    /docs, Helmet CSP off, and APP_CORS_ORIGINS defaulting to `*` with
    credentials:true. Give the fix.
2b. The getOrThrow false-safety bug: seven Supabase/Paymob secrets use
    config.getOrThrow(), but their factories default to ''. getOrThrow only throws
    on undefined, so it never fires — the app boots with empty credentials and
    fails at the first API call instead of at startup. List all seven factories and
    the diff that makes missing secrets undefined rather than ''.
2c. Complete secret inventory for `fly secrets set`. The docs undercount badly —
    it is far more than the two Paymob IDs.
2d. Health check wiring to the existing /health endpoint.
2e. Dockerfile: pnpm version pin and a non-root user.
2f. The exact ordered deploy command sequence.

=== PART 3 — MOBILE APP TO A WORKING BUILD ===

3a. Verify EAS env vars: `eas env:list --environment production`. No build profile
    supplies EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL, so cloud builds may ship
    pointing at localhost:3000. State exactly what to set if the list is empty.
3b. apps/mobile/eas.json: submit.production and submit.preview are both {},
    so store submission is impossible. Enumerate the required iOS keys (appleId,
    ascAppId, appleTeamId) and Android keys (serviceAccountKeyPath), and how to
    obtain each.
3c. Run `pnpm type-check && pnpm lint && pnpm test` under Node 24 and report the
    ACTUAL output. The frontend has never been verified on a working toolchain, so
    do not predict the result — run it.
3d. The preview profile's distribution:store + buildType:apk mismatch.
3e. Resolve the 3 uncommitted whitespace-only files and the stray package-lock.json.

=== PART 4 — TESTING HONESTY ===

The headline 81.11% backend coverage is measured over 5 hand-picked files
(apps/backend/test/jest.json, collectCoverageFrom). There are 13 modules under
apps/backend/src/modules/ and 8 have zero tests. No e2e tests exist. Report the
real whole-repo coverage, name the untested modules, and recommend the minimum test
set to add before launch.

=== OUTPUT FORMAT ===

Write apps/backend/COMPLETION-ROADMAP.md. Every item on one line in this shape:

  [P0|P1|P2] — title — file:line — what to change — how to verify

End the report with an ordered "do this next" checklist.
Then, in chat, summarize the proposed ResidentLead schema and stop for my approval.
```

---

## 5. Prompt B — build `eastpark-web-app`

**Run only after Prompt A's `ResidentLead` schema has been reviewed and approved.**

```text
You are the lead agent building a new web app. Prompt A has already produced
apps/backend/COMPLETION-ROADMAP.md and I have approved its ResidentLead schema
— READ THAT FILE FIRST and treat its approved schema as the contract. Do not
redesign it.

Repo root: /mnt/c/Unite/EastPark-App
TOOLCHAIN: default shell Node is v12.22.9 and cannot run the tooling. Prefix EVERY
command with:  . ~/.nvm/nvm.sh && nvm use 24
The `vercel` CLI is NOT installed — do not assume you can deploy.

GOAL: apps/web/ — a new directory at the repo root, its own git repo
(matching the existing convention where eastpark-frontend and eastpark-backend are
independent repos). A form-first landing site that visually mirrors the mobile app.
Its job is collecting resident data. The full feature mirror comes LATER — do not
build directory/community/orders now.

MODEL ROUTING — delegate via the Agent tool with an explicit per-subtask `model`.
Rule: a wrong answer cheap to detect and fix -> Sonnet 5.5. A wrong answer that
silently ships or is expensive to reverse -> Opus 5.5. Uncertain -> Opus 5.5.
Review every Sonnet result before acting on it.

  Opus 5.5:   Landing page visual design + the token->Tailwind mapping
              ResidentLead NestJS module design + rate-limit strategy
                (public write endpoint — treat it as an abuse surface)
              Final review of all Sonnet output before any commit
  Sonnet 5.5: Scaffold Next.js, copy tokens.ts / global.css / translations
              Build the 7 form fields from the fixed spec below
              src/config/compound.ts constants
              NestJS controller/service/DTO/spec boilerplate (AFTER Opus approves
                the module shape)
              Vercel deploy steps + env var list for me to run

Scaffolding and the compound config are independent of the backend module — run
those in parallel. Form fields depend on the scaffold. The NestJS boilerplate
depends on the approved schema.

=== STACK ===

Next.js (App Router) + TypeScript strict + Tailwind CSS.
NOT react-native-web. A form-first marketing site does not need the RN
compatibility layer, and Next gives better Vercel output, SEO, and Arabic SSR.

=== DESIGN MIRRORING — the hard requirement ===

- Copy apps/mobile/src/theme/tokens.ts VERBATIM to
  apps/web/src/theme/tokens.ts and generate the Tailwind theme from it.
  It is 93 lines of pure TS constants (BRAND, LIGHT, DARK, SEMANTIC, SPACING,
  RADIUS, FONT, TYPE) with no React Native imports. No hand-picked hex values
  anywhere in the web app.
- apps/mobile/src/global.css is already a valid Tailwind v4 entry file
  (tailwindcss@4.1.18 is a devDependency there). Start from it rather than
  writing a new one.
- Read apps/mobile/Documentation/DESIGN.md for motion, typography scale,
  and component patterns.
- THE STACK DOCS LIE. CLAUDE.md and apps/mobile/Documentation/APPCONTEXT.md
  claim NativeWind v4 + Gluestack UI v2 and MMKV theme storage. The app actually
  uses uniwind + StyleSheet.create and AsyncStorage. Mirror the TOKENS and the
  VISUAL RESULT, not the claimed component library.
- Reuse the established form convention: Zod validation messages are i18n KEYS,
  resolved via t(...) at render time. See apps/mobile/src/app/(auth)/login.tsx:29.
  Never inline English validation strings.
- DO NOT PORT: src/components/ui/form-utils.ts (TanStack Form API, orphaned),
  src/lib/api/** (dead duplicate axios client, wrong pagination shape),
  src/features/** (orphaned).
- Non-negotiables from CLAUDE.md: dark mode is flagship and light is a toggle;
  gold #b8966a used sparingly; #7a5e38 for gold text on light backgrounds (gold-500
  fails WCAG AA there); never pure #000/#fff; never cold zinc; never emerald; never
  neon; never spinners — skeleton shimmer instead; Cairo for all UI and all Arabic;
  Cormorant Garamond for English display/hero only, never functional UI, never Arabic.
- Arabic RTL primary, English LTR secondary. Reuse the existing
  apps/mobile/src/translations/ar.json and en.json keys where they overlap
  (~650 strings).

=== THE FORM — exact spec ===

  name        text    required
  email       email   required
  phone       tel     required
  building    select  required   <- from config
  floor       select  required   <- searchable / combobox, 1..11
  flatNumber  select  required   <- 1..5
  parking     text    optional   <- placeholder: "1-10 or second floor 2-10"

- Config-driven: src/config/compound.ts exporting BUILDINGS, FLOOR_RANGE,
  FLAT_RANGE. The building list must be editable in ONE place.
- React Hook Form + Zod, mirroring the pattern already used in eastpark-frontend.
  RHF, Zod and @hookform/resolvers are web-identical, so the validation layer is a
  straight copy — only the input components get rebuilt (onChangeText -> onChange,
  keyboardType -> inputMode, secureTextEntry -> type="password").
- Accessible: real <label> elements, 44px minimum touch targets, keyboard-navigable
  combobox, visible focus rings, aria-invalid plus linked error text. Error
  messages in both languages.

=== BACKEND CONTRACT ===

Endpoint: POST /v1/residents/leads — public, rate-limited.
Add it to eastpark-backend as part of this work: Prisma model (the approved
ResidentLead) + migration + module (controller / service / DTO) + throttler guard
+ a spec file. The web client posts to NEXT_PUBLIC_API_URL.

=== PAGES ===

  /               landing: hero explaining EastPark, the two pillars
                  (marketplace + community governance), CTA to the form
  /register-unit  the form
  /thank-you      confirmation

Scaffold the route structure so directory/community can be added later without
restructuring.

=== DEPLOY ===

The vercel CLI is not installed. Produce exact install + deploy steps for ME to
run, plus the env vars to set in the Vercel dashboard. Do not assume you can
deploy. Note that the backend's APP_CORS_ORIGINS must include the Vercel domain —
this ties into Prompt A's CORS fix.

=== ACCEPTANCE CRITERIA ===

- `pnpm build` passes; `pnpm lint` and `tsc --noEmit` are clean.
- The form submits end-to-end against a locally running backend.
- Lighthouse accessibility >= 90.
- Renders correctly in both dir="rtl" and dir="ltr", in light and dark.
- Commit format: [AhmedMuhammedElsaid][feat]: description
- All commits use --no-verify (WSL cannot run the node/pnpm pre-commit hooks).
```

---

## 6. Verification checklist

1. `migration.md` is self-contained — a fresh session needs no other context.
2. Prompts A and B are in fenced blocks, each stating its own scope, model routing, and done-criteria.
3. Prompt A is explicitly read-only; Prompt B explicitly depends on A's approved schema.
4. Every cited path resolves — verified 2026-09-29: `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/global.css`, `apps/mobile/Documentation/DESIGN.md`, `apps/mobile/src/app/(auth)/login.tsx`, `apps/mobile/eas.json`, `apps/backend/prisma/schema.prisma`, `apps/backend/fly.toml`, `apps/backend/test/jest.json`, both `*_review.md` files. 13 modules confirmed under `apps/backend/src/modules/`.
5. Run Prompt A → review `COMPLETION-ROADMAP.md` → approve the `ResidentLead` schema → run Prompt B.
