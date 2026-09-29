# EastPark — Monetization & Go-to-Market Plan

> **Status: FOR REVIEW — do not implement code yet.** This is a strategy + build plan
> to review first. Deliverable 1 (docs) and Deliverable 2 (commission engine) proceed
> only after you sign off.

---

## Context

The developer built EastPark (a single-compound resident super-app) from scratch and wants to **sell it to the EastPark company** so they deploy it for their residents. This is a B2B sale to one operator — not a multi-tenant SaaS play.

Two facts confirmed from the code drive this plan:
1. **Single-compound architecture** (`eastpark-backend/prisma/schema.prisma` — no `Compound`/`Tenant`/`Organization` model; all tables share one space). This is *fine* for selling to one company; multi-tenancy is not needed.
2. **No platform-side money logic exists.** Paymob only handles resident→shop order payments (`Order.isPaid`). There is no commission, shop-subscription, take-rate, or billing module. The "marketplace earns EastPark money" pitch is therefore **not yet real in code** — it must be built.

The app has two value halves that map to two buyer motivations:
- **Governance half** (announcements, reports, polls, elections, feedback) = control, transparency, prestige → the must-have for the operator.
- **Marketplace half** (shops, products, orders, tracking, Paymob/COD) = a revenue line → "it pays for itself."

Developer's position: sell to the EastPark company; has **one compound lined up** + an **existing shops network**; wants to be paid via **license + yearly support** (recurring maintenance), with revenue-share as an upside hook.

Deliverable order: **(1) pitch/GTM doc first, then (2) plan+build the marketplace commission engine** that makes the revenue pitch demoable.

---

## Deliverable 1 — Pitch / Go-to-Market Document (no code)

Create `BUSINESS/EastPark-Pitch.md` (proposed new top-level folder `BUSINESS/` at repo root: `/mnt/c/Unite/EastPark-App/BUSINESS/EastPark-Pitch.md`). A single, client-ready markdown doc the developer can hand to the EastPark company. Sections:

1. **Executive summary** — one paragraph: a branded resident super-app delivering governance + a revenue-generating marketplace, deployable in their one compound as a paid pilot.
2. **The two-in-one value** — Governance (control/transparency/prestige, unit-sales differentiator) and Marketplace (turns existing shops into a recurring revenue line for EastPark).
3. **Feature inventory** — concrete list drawn from the real build (auth roles, directory, ordering + real-time tracking, COD + Paymob, community hub, polls/elections, feedback, notifications, merchant + admin tools, AR/EN RTL). Cite that it is ~90% built to prove low delivery risk.
4. **Why it's low-cost to run** — 100% free/open-source self-hostable stack (Neon, Upstash, Supabase, Fly.io, Brevo, Expo). Near-zero hosting → maintenance fee is high-margin, and cost is not a barrier for EastPark.
5. **Pricing model (primary: License + yearly support)** — one-time delivery/setup fee + annual maintenance & support contract (hosting mgmt, updates, bug fixes, feature requests). Present 2–3 tiers.
6. **Revenue-share upside (the hook)** — optional add-on: a small commission on marketplace orders flows to EastPark; developer takes a cut. Explicitly note this requires the commission engine (Deliverable 2) and is the "app that pays for itself" story.
7. **Paid pilot proposal** — launch in the one lined-up compound with the existing shops network as day-one proof of ROI, at reduced price, converting to full license after a defined success metric.
8. **Roadmap / what's remaining** — honest note referencing the audit gaps (2 BE deploy-blockers, typecheck/tests) so the buyer sees a credible path to production, not vaporware.
9. **Ask & next steps** — the specific commitment being requested (pilot sign-off + timeline).

Also produce a **short 1-page version** (`BUSINESS/EastPark-Pitch-OnePager.md`) — the same story compressed for a first meeting/email.

*(This deliverable is documents only — safe to write immediately after approval.)*

---

## Deliverable 2 — Marketplace Commission Engine (code, follow-on)

Goal: make "EastPark earns a commission on every order" real and demoable in the admin tools. Minimal, schema-first, reuses existing patterns.

### Schema (`eastpark-backend/prisma/schema.prisma`)
- Add a **platform commission** concept. Simplest viable: a config value + a per-order derived record.
  - New model `PlatformCommission` (per delivered/paid order): `id`, `orderId @unique → Order`, `orderTotal`, `commissionRate` (snapshot), `commissionAmount`, `createdAt`. Preserves history even if rate later changes.
  - New model `CommissionSetting` (single-row config): `commissionRatePercent` (default e.g. 5.0), `appliesToCOD Boolean`, `appliesToPaymob Boolean`, `updatedAt`, `updatedBy`. Avoids hardcoding; editable by admin.
  - Add back-relation field on `Order` (`commission PlatformCommission?`).
- Create a proper Prisma migration (note: repo has a known migration-baseline issue per audit — see `backend_review.md`; coordinate so this migration is additive and clean).

### Module (`eastpark-backend/src/modules/commission/`)
Follow the existing module shape (mirror `merchant/` and `payments/` structure: `*.module.ts`, `*.service.ts`, `*.controller.ts`):
- **Record commission** at the right lifecycle point:
  - Paymob orders → in the webhook path that flips `Order.isPaid` (`payments.service.ts`).
  - COD orders → when `OrderStatus` transitions to `DELIVERED` (in `orders.service.ts` status-update path).
  - Guard with idempotency (commission row is `orderId`-unique) so re-fired webhooks/status updates don't double-count.
- **Admin reporting endpoints** (admin-guarded, cursor-paginated to match app convention):
  - `GET /v1/commission/summary` — totals (period, count, gross order value, total commission).
  - `GET /v1/commission` — list of commission records.
  - `GET /v1/commission/settings` / `PATCH /v1/commission/settings` — read/update rate & applicability.
- Use `ConfigService` for any defaults (locked rule: never raw `process.env`); log via existing logger.

### Frontend (`eastpark-frontend/app/(admin)/`)
- Add an admin screen (e.g. `app/(admin)/revenue/index.tsx`) showing commission summary + list, reusing existing admin-guard + `useInfiniteQuery` + FlashList patterns and `formatCurrency`. This is the live demo surface for the pitch.
- Add the API service methods mirroring existing service files (e.g. a new `commission.ts` under the services dir).

### Representative files to touch
- `eastpark-backend/prisma/schema.prisma` (models + migration)
- `eastpark-backend/src/modules/commission/*` (new module)
- `eastpark-backend/src/modules/payments/payments.service.ts` (Paymob hook)
- `eastpark-backend/src/modules/orders/orders.service.ts` (COD delivered hook)
- `eastpark-backend/src/app.module.ts` (register module)
- `eastpark-frontend/app/(admin)/revenue/index.tsx` + admin layout registration
- `eastpark-frontend/src/api/commission.ts` (or matching services path)

---

## Verification

**Deliverable 1:** Developer reads both docs; confirm the pitch matches real features (cross-check feature inventory against `CLAUDE.md` module list) and that pricing/pilot framing fits their intent.

**Deliverable 2:**
- `pnpm prisma migrate dev` builds the new tables cleanly on a fresh DB.
- Unit test: paying a Paymob order and delivering a COD order each create exactly one `PlatformCommission` at the configured rate; re-firing the webhook/status update creates none (idempotency).
- `GET /v1/commission/summary` returns correct totals against seeded orders.
- Admin revenue screen renders summary + paginated list from the API in the running app.
- Run `pnpm type-check && pnpm lint && pnpm test` in the backend (on a modern-Node machine — WSL Node is too old per audit) for a real signal.

---

## Notes / Open decisions for build phase
- Commission **rate** default and whether it applies to COD (COD cash never touches the platform, so "commission owed" is an accrual EastPark collects from shops out-of-band) vs Paymob only — confirm with developer before building the setting defaults.
- Whether commission is per-**order** or per-**order-item/shop** — start per-order (simplest, all items share one shopId per locked rule).
- Coordinate the new migration with the existing broken migration-baseline (audit item) so we don't compound the problem.
