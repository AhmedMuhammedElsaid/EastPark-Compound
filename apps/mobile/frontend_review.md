# EastPark Frontend — Production Readiness Review

**Audit date:** 2026-07-19
**Auditor:** Opus exploration agent (read-only verification against `CLAUDE.md` claims)
**Verification pass:** 2026-07-26 — re-verified every claim below against the actual current source (both `apps/mobile/` and `apps/backend/`). One finding was upgraded from "likely bug" to **confirmed, launch-blocking** (FE-1). All other findings confirmed accurate; FE-5 refreshed to current git state.
**Scope:** `apps/mobile/` (Expo SDK 54 + React Native 0.81.5)

---

## Verdict

The root `CLAUDE.md` and session memory claim the frontend is **100% complete, audited, production-ready**. Verification confirms the app is **structurally complete** — every documented screen exists and most flows are implemented — **but the "100%" claim is overstated, and one gap is more severe than previously documented: the entire Merchant Tools module (dashboard, menu CRUD, order management) calls backend routes that do not exist and will 404 in production.** There is also a locked-stack item that was never wired (analytics/error monitoring), no real auth test coverage, and the codebase's TS/lint/test status **still cannot be verified in this WSL environment** (Node v12 is too old to run any project tooling).

**Bottom line: ~85–90% done. One confirmed ship-blocker (merchant API routes), plus the same real gaps the docs gloss over.**

---

## READY ✅ (re-verified 2026-07-26)

- **Navigation** — every screen in the locked nav tree exists under `src/app/` (spot-checked directly, all present):
  - `(tabs)`: `index.tsx`, `directory/` + `[shopId]/` + `menu`, `orders/` + `[orderId].tsx`, `community/` + `announcements`/`reports`/`governance/polls`/`governance/elections`/`feedback`, `profile/`
  - `(auth)`: login, register, verify-otp, forgot-password, reset-password, accept-invitation
  - `(admin)`: `_layout.tsx`, `index.tsx`, `announcements/`, `polls/`, `elections/`, `invitations.tsx`
  - `(merchant)`: `_layout.tsx`, `dashboard.tsx`, `menu/index.tsx`, `menu/[productId].tsx`, `orders/index.tsx`, `orders/[orderId].tsx`, `shop-profile.tsx`
  - `checkout/`: cart, address, payment, confirmation
  - `notifications.tsx`
  - **No missing screens** — screens all exist, but see FE-1: several merchant screens exist and render, but their data calls will fail against the live backend.
- **No functional TODO/mock/stub blockers found via grep** for TODO/FIXME/mock/stub/placeholder — only benign hits (form `placeholder=` props, a test-lint TODO, an i18n boilerplate comment, and the now-elevated `merchant.ts` comment — see FE-1).
- **EAS configured** — confirmed: `app.config.ts:12` hardcodes `EAS_PROJECT_ID = '062399ed-48df-4d4f-ba1a-a0801a86b1bc'`, consumed at `app.config.ts:167` (`extra.eas.projectId`). `eas init` is done.
- **Env handling correct** — `.env.example` committed as template (has pending whitespace-only local edits, see FE-5); `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL` documented without `/v1` suffix — confirmed `client.ts:30` appends `/v1` itself (`baseURL: \`${Env.EXPO_PUBLIC_API_URL}/v1\``).
- **Paymob 3-step flow implemented** — confirmed `services/api/orders.ts:58` calls `POST /orders/:orderId/pay/paymob`, matching the backend's `payments-initiate.controller.ts` (`@Controller({ path: '/orders', version: '1' })`). Correct route.
- **Real audit trail** — `Documentation/FixedBugs.md` and `FRONTENDENHANCEMENTPLAN.md` show genuine iterative fix passes with real commit references.
- **Jest suite exists** — 5 test files (`button`, `checkbox`, `input`, `select`, `login-form`); confirmed `login-form.test.tsx` is present but is a placeholder (see FE-3).

---

## LEFT / MISSING ❌

| # | Item | Location | What's needed |
|---|---|---|---|
| FE-1 | **CONFIRMED (upgraded from "likely"): the entire Merchant Tools API surface is broken — not just 2 methods.** Cross-checked every method in `merchant.ts` against the live backend controllers (`shops.controller.ts`, `products.controller.ts`, `orders.controller.ts` — grepped all `@Controller`/`@Patch`/`@Get`/`@Post` decorators). **7 of 9 methods call routes that do not exist on the backend at all:** `getMyShop()` → `GET /merchant/shop`, `toggleShopOpen()` → `PATCH /merchant/shop`, `getMyProducts()` → `GET /merchant/products`, `createProduct()` → `POST /merchant/products`, `updateProduct()` → `PATCH /merchant/products/:id`, `deleteProduct()` → `DELETE /merchant/products/:id`, `getIncomingOrders()` → `GET /merchant/orders`, `getOrder()` → `GET /merchant/orders/:id`. There is **no `/merchant/*` prefix anywhere in the backend** (`grep -rn "path:.*merchant" apps/backend/src` returns zero controller matches). Only `updateShop()` uses a real route (`PATCH /shops/:id`) — but even that is unreachable in practice because `shop-profile.tsx` and `dashboard.tsx` both call the broken `getMyShop()` first to obtain the `shopId` needed to call it. **Net effect: the merchant dashboard, menu CRUD, and order management screens are 100% non-functional against the real backend today — every API call in the module 404s.** This is also a **backend gap**, not purely FE: the backend has no "get my shop" endpoint at all (JWT payload is `{userId, role}` only — no `shopId`; `GET /shops` has no `merchantId`/`mine` filter), so even a corrected FE cannot discover its own shop without a backend addition. Real backend routes that do exist: `GET/PATCH /shops/:id`, `GET/POST/PATCH/DELETE /shops/:shopId/products(/:id)` (nested, needs shopId), `GET /orders` + `GET /orders/:id` + `PATCH /orders/:id/status` (auto role-filtered server-side — no `/merchant` prefix needed at all for orders). | `src/services/api/merchant.ts:59-108`, `src/app/(merchant)/dashboard.tsx`, `shop-profile.tsx`, `menu/index.tsx`, `menu/[productId].tsx`, `orders/index.tsx`, `orders/[orderId].tsx` | **Ship-blocker.** (1) Backend: add a way for a merchant to discover their own `shopId` (e.g. `GET /shops?merchantId=me` filter, or embed `shopId` in `/user/profile` response for MERCHANT role). (2) Frontend: rewrite `merchant.ts` — orders/order-status → plain `ordersApi`-style calls to `/orders`, `/orders/:id`, `/orders/:id/status` (no prefix); products → `/shops/:shopId/products(/:id)` (needs shopId from #1); shop toggle → `PATCH /shops/:id` with `{isOpen}`. |
| FE-2 | **Analytics / error monitoring not wired** — Posthog and Sentry/GlitchTip are locked stack items. Re-confirmed via `grep -rli "posthog\|sentry\|glitchtip" src/ package.json .env.example app.config.ts`: only `.env.example` and `app.config.ts` reference `EXPO_PUBLIC_POSTHOG_KEY` (`app.config.ts:171` → `extra.posthogKey`); zero references anywhere in `src/`, and zero references to Sentry/GlitchTip anywhere in the repo (not even a placeholder). Never initialized, never imported. | `src/` (absent), `.env.example`, `app.config.ts` (placeholder only) | Decide: wire up Posthog + Sentry/GlitchTip before launch, or explicitly descope. |
| FE-3 | **No real auth test coverage — confirmed.** `src/features/auth/components/login-form.test.tsx` contains exactly one line: `it.todo('login form — tests not yet implemented');`. Not a real test. | `src/features/auth/components/login-form.test.tsx:1` | Write actual login/register/OTP tests. |
| FE-4 | **Cannot verify TS/lint/tests in this env** — unchanged, still WSL Node v12.22.9 in this environment; not independently re-verified this pass (out of scope — requires a modern-Node machine). | (environment) | Run `pnpm type-check && pnpm lint && pnpm test` on a machine with modern Node for a real current signal. |
| FE-5 | **Working-tree drift from `main` — refreshed 2026-07-26.** Current `git status --short`: `M .env.example`, `M claude.md`, `M eslint.config.mjs`, `M src/lib/hooks/use-biometric.ts`, plus untracked `frontend_review.md` (this file). Diffing with `git diff -w` (ignore-whitespace) shows `.env.example`, `eslint.config.mjs`, and `use-biometric.ts` are **pure line-ending/whitespace churn** (identical diff stat with/without `-w` collapses to 0) — confirms the prior note. **New finding:** `claude.md` has a **real 9-line content addition** (not whitespace) — it already contains the "Audit 2026-07-19" section documenting FE-1..FE-6, which is committed here but was apparently not yet committed to `main` at the time of the original audit. Also note: the tracked filename is lowercase `claude.md` (not `CLAUDE.md`) — same file, case-only, git `core.ignorecase=true` so no conflict, but worth normalizing. | (git working tree) | Commit the whitespace-only fixes (or discard) and commit `claude.md`'s real content addition; verify filename casing convention. |
| FE-6 | **Legacy/dead routes — confirmed, still present.** `src/app/login.tsx` (`<Redirect href="/(auth)/login" />`), `src/app/onboarding.tsx` (`<Redirect href="/(tabs)" />`) are unused Redirect-only obytes-boilerplate leftovers; `src/app/[...messing].tsx` still exists as the boilerplate generic 404. Not broken, cosmetic tech debt. | `src/app/login.tsx`, `src/app/onboarding.tsx`, `src/app/[...messing].tsx` | Remove or replace with token/i18n-compliant screens. |
| FE-7 | **Deferred UX (self-documented)** — UX-7: merchant product image is a raw URL text field, no `expo-image-picker` upload flow. UX-9: no one-tap reorder. Explicitly deferred post-launch. Not re-verified line-by-line this pass; consistent with FE-1 finding (menu CRUD is unreachable anyway until FE-1 is fixed). | per `FRONTENDENHANCEMENTPLAN.md` | Post-launch enhancement — not a blocker. |

### Backend-blocked FE gaps (self-documented — not FE's fault)

- **B-2** — exact pending-order count unavailable; FE shows "5+" workaround.
- **B-3** — notification deep-link needs backend to send `{type, referenceId}` payload.
- **B-5** — no single-product GET endpoint; FE uses N+1 workaround via list cache `initialData`.
- **B-6** — no product category field/CRUD on backend.
- **B-1 (self-delete account) is now DONE server-side** — `DELETE /user` is implemented (see `backend_review.md`). FE profile screen already calls it.
- **NEW — B-7 (discovered this pass):** no backend endpoint lets a merchant discover their own `shopId`. JWT payload is `{userId, role}` only; `GET /shops` has no `merchantId`/`mine` filter; no `GET /shops/me` or equivalent exists. This blocks a correct fix for FE-1 on the frontend side alone — needs a backend addition (see FE-1 for detail).

---

## REQUIRED USER ACTIONS

1. **Fix the Merchant Tools module (FE-1) — top priority.** This is a confirmed ship-blocker, not a "likely" one: the merchant dashboard, menu CRUD, and order management are entirely non-functional against the live backend. Requires a coordinated backend + frontend fix (see FE-1 detail above): backend needs a "get my shop" mechanism (B-7), then `merchant.ts` needs to be rewritten to call the real routes (`/shops/:id`, `/shops/:shopId/products`, `/orders`).
2. **Commit or discard** the pending whitespace-only changes (`.env.example`, `eslint.config.mjs`, `src/lib/hooks/use-biometric.ts`) and commit the real content addition already sitting in `claude.md`, so the working tree matches a clean state.
3. **Run `pnpm type-check && pnpm lint && pnpm test`** on a machine with modern Node (WSL Node 12 cannot run any tooling) for a real pass/fail signal.
4. **Decide on Posthog/Sentry/GlitchTip** — wire up (locked stack) or explicitly descope.
5. **`eas build` / `eas submit`** — build config exists but no evidence a store build has been produced.

---

*Companion file: `../backend/backend_review.md`. See root `CLAUDE.md` for synced current status.*
