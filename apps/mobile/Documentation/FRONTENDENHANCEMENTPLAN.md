# EastPark Frontend — Enhancement Plan

> Created: April 2026
> Updated: April 2026 — maintenance pass complete.
> For completed fixes, see `Documentation/FixedBugs.md`.
> For backend-dependent blockers, see Section 3 below.

---

## Section 1 — Technical Debt

✅ **All 9 TD items resolved.** See `Documentation/FixedBugs.md` → "April 2026 — Maintenance Pass" for details and commit hashes.

---

## Section 2 — UX Enhancements

✅ **7 of 9 UX items resolved** (UX-1 through UX-6, UX-8). See `FixedBugs.md`.

The following two are deferred post-launch:

### UX-7: Merchant Product Image — Upload vs URL
**File:** `src/app/(merchant)/menu/[productId].tsx`
**Issue:** Merchants enter a raw image URL in a text field. Impractical for most users — requires external image hosting.
**Action (post-launch):** Replace the URL field with an image picker (`expo-image-picker`) that uploads to Supabase Storage via the backend (`POST /merchant/products/:id/image`) and receives a CDN URL back.

---

### UX-9: Order Reorder (One-Tap)
**File:** `src/app/(tabs)/orders/[orderId].tsx`
**Issue:** Repeating an order requires re-navigating to the shop and re-adding each item manually.
**Action (post-launch):** Add a "Reorder" button that iterates `order.items`, checks availability, and dispatches `addToCart` for each. Warn if any item is unavailable or from a different shop than the current cart.

---

## Section 3 — Post-Launch Feature Roadmap

Features outside the current scope. Do not implement until after the initial production launch is stable.

| # | Feature | Description | Priority |
|---|---|---|---|
| F-1 | ~~**Biometric login**~~ ✅ shipped (see `FixedBugs.md` → "F-1 Biometric Login") | Face ID / fingerprint via `expo-local-authentication` | — |
| F-2 | **Multiple delivery addresses** | Save and switch between multiple addresses at checkout | Medium |
| F-3 | **Saved shop notifications** | Opt-in push when a saved shop adds new products or has a promotion | Medium |
| F-4 | **Order history search + filter** | Filter orders by shop, status, date range | Medium |
| F-5 | **Community feedback voting** | Upvote/downvote feedback items — helps admin prioritize | Medium |
| F-6 | **Merchant analytics dashboard** | Sales by product, peak order times, revenue over time | Low |
| F-7 | **Admin bulk invitation** | Send invitations to multiple merchant emails at once via CSV | Low |
| F-8 | **Announcement comments** | Resident comments on announcements (reply thread) | Low |
| F-9 | **Light/dark mode schedule** | Auto-switch based on sunrise/sunset | Low |
| F-10 | **Merchant menu categories** | Group products under custom categories within a shop menu — **blocked on backend** (see Section 4, B-6) | Low |
| UX-7 | **Merchant product image upload** | expo-image-picker → Supabase Storage (see Section 2) | Medium |
| UX-9 | **Order reorder one-tap** | Re-add previous order items to cart in one tap (see Section 2) | Medium |

---

## Section 4 — Backend Requests

Frontend changes blocked until these backend endpoints or behaviors are added.

| # | What FE needs | Current backend state | Effort |
|---|---|---|---|
| B-1 | `DELETE /user` for self-delete | Admin-only `DELETE /admin/user/:id` exists. Frontend already calls `DELETE /user`. | Add resident-accessible self-delete route |
| B-2 | Exact pending order count | Frontend workaround in place: shows `5+` when `nextCursor` is truthy (commit `d9fcdf6`). Exact count requires backend. | Add `GET /merchant/orders/count?status=PLACED` or `totalCount` in list response |
| B-3 | Notification `data` payload for deep linking | `_layout.tsx` listener is wired and ready (commit `43025a1`). Push payloads need `{ type, referenceId }` fields from backend. | Add structured data to all `sendPushNotification()` calls in backend |
| B-5 | Single product fetch | Edit screen uses `initialData` from list cache. For cold-launch accuracy add `GET /merchant/products/:id`. | Low priority — current workaround is functional |
| B-6 | Product categories (F-10) | `Product` has no `category` field. No category CRUD. | Add `category` (free-text or `Category` entity) on Product, plus shop-scoped category list endpoint, plus filter on product list |

> **B-4 resolved:** `PATCH /merchant/shop` does not exist as a dedicated route, but `PATCH /shops/:id` accepts `MERCHANT` role with ownership enforcement. `merchantApi.updateShop()` uses this correctly. No backend change needed.

---

## How to Use This Document

- **Start a UX polish session:** UX-7 and UX-9 are the only remaining pre-launch UX items.
- **Planning a sprint:** Use Sections 3 + 4 together — confirm backend availability before scheduling F-items.
- **After fixing an item:** Move it to `FixedBugs.md` with the commit hash and remove it from this file.
- **After backend delivers an endpoint:** Move the B-item out of Section 4 and create the corresponding frontend work item.
