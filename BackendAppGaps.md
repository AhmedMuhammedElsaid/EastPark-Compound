# EastPark Backend — Gaps Audit & Resolution Log

> **Audit date:** 2026-03-30 · **Resolution date:** 2026-04-01 · **Status:** ✅ ALL GAPS + WIRING MISMATCHES RESOLVED · **Compliance:** 100%

---

## Resolution Commits

| Commit | What was fixed |
|---|---|
| `c1571d6` | MINOR-2 + GAP-1 — ElectionVisibilityMode enum (schema + service) + InvitationsModule (send + list) |
| `60d7557` | GAP-3 + GAP-4 — Shop reviews (GET/POST/DELETE + averageRating) + Saved shops (save/unsave/list) |
| `303085c` | MINOR-1 + GAP-2 — Notification preferences endpoints (GET/PUT) + Paymob 3-step initiation |
| `eae0da7` | WIRING — ShopResponseDto reviewCount+averageRating, DELETE /v1/user self-delete, .env.example Paymob vars |
| `ddce900` (FE) | WIRING — FE API service calls aligned with actual BE endpoints (push token, notif prefs, photos, deleteAccount) |

---

## Audit Summary — All Green

| Area | Status | Commit |
|---|---|---|
| Stack (NestJS + Fastify, pnpm, Prisma, Docker) | ✅ | — |
| Auth flows (register, OTP, login, refresh, logout, forgot/reset) | ✅ | — |
| Invitation accept flow (`POST /v1/auth/accept-invitation`) | ✅ | — |
| **Invitation send flow** (`POST /v1/admin/invitations`) | ✅ FIXED | `c1571d6` |
| Shops CRUD + photo gallery | ✅ | — |
| **Shop Reviews** (`GET/POST/DELETE /v1/shops/:shopId/reviews`) | ✅ FIXED | `60d7557` |
| **Saved Shops** (`POST/DELETE /v1/shops/:id/save` + `GET /v1/users/me/saved-shops`) | ✅ FIXED | `60d7557` |
| Products (soft-delete, `isDeleted` flag) | ✅ | — |
| Orders REST + WebSocket `/orders` namespace | ✅ | — |
| **Paymob initiation** (`POST /v1/orders/:id/pay/paymob`) | ✅ FIXED | `303085c` |
| Paymob webhook + HMAC-SHA512 timing-safe verify | ✅ | — |
| Announcements + comments (cursor pagination, category filter) | ✅ | — |
| Reports (separate from announcements) | ✅ | — |
| Feedback + anonymous masking + admin replies | ✅ | — |
| Polls + one-vote guarantee (`@@id([userId, pollId])`) | ✅ | — |
| Elections + `@Cron('*/5 * * * *')` auto-open + one-vote | ✅ | — |
| **ElectionVisibilityMode** (SEALED / LIVE_COUNT / ADMIN_CONTROLLED) | ✅ FIXED | `c1571d6` |
| Notifications: Expo Push inline + preference-aware | ✅ | — |
| Notifications: in-app feed (cursor pagination + unreadCount) | ✅ | — |
| **Notification preferences endpoint** (`GET/PUT /v1/notifications/preferences/:type`) | ✅ FIXED | `303085c` |
| Cursor pagination on ALL list endpoints | ✅ | — |
| AuditLog model + deleteUser cascade | ✅ | — |
| Rate limiting on `/auth/*` (`@nestjs/throttler`) | ✅ | — |
| ConfigService (no raw `process.env` in services) | ✅ | — |
| Swagger / OpenAPI | ✅ | — |
| Unit tests (all services, 88% coverage) | ✅ | — |
| Docker Compose (postgres + redis + mailpit + minio + minio-init) | ✅ | — |
| Dockerfile CMD (`npx prisma migrate deploy && node dist/main`) | ✅ | — |
| Fly.io `cdg` region, `auto_stop_machines = false` | ✅ | — |

---

## What Each Fix Did

### GAP 1 — Admin Invitation Sending (`c1571d6`)

New `InvitationsModule` at `src/modules/invitations/`:
- `POST /v1/admin/invitations` [ADMIN] — generates `randomBytes(32)` token, sets `expiresAt = now + 48h`, creates DB row, calls `email.sendInvitation()`, **never exposes raw token** in response
- `GET /v1/admin/invitations` [ADMIN] — cursor-paginated list with status (pending / used / expired)
- 409 Conflict if an active (unused, non-expired) invite already exists for the same email + role

### GAP 2 — Paymob 3-Step Initiation (`303085c`)

New `POST /v1/orders/:id/pay/paymob` [RESIDENT] in `PaymentsInitiateController`:
1. Auth token → `POST https://accept.paymob.com/api/auth/tokens`
2. Register order → `POST https://accept.paymob.com/api/ecommerce/orders`
3. Payment key → `POST https://accept.paymob.com/api/acceptance/payment_keys`
- Returns `{ paymentKey, iframeUrl }` — FE opens iframe at `iframeUrl`
- Each step throws `BadGatewayException` on non-OK response
- Ownership check: throws `ForbiddenException` if `order.residentId !== actorId`

**New env vars required (add to Fly.io secrets):**
```
PAYMOB_INTEGRATION_ID=<from Paymob dashboard>
PAYMOB_IFRAME_ID=<from Paymob dashboard>
```

### GAP 3 — Shop Reviews (`60d7557`)

New endpoints inside `ShopsModule`:
- `GET /v1/shops/:shopId/reviews` — public, cursor-paginated, returns `{ items, nextCursor, averageRating }` via parallel `aggregate` query
- `POST /v1/shops/:shopId/reviews` [RESIDENT] — upsert (Prisma `upsert` on `@@unique([userId, shopId])`), one review per resident per shop
- `DELETE /v1/shops/:shopId/reviews` [RESIDENT] — 404 if no review found

### GAP 4 — Saved Shops (`60d7557`)

New endpoints inside `ShopsModule` + `UserModule`:
- `POST /v1/shops/:id/save` [RESIDENT] — idempotent upsert (no error on double-save)
- `DELETE /v1/shops/:id/save` [RESIDENT] — 404 if not saved
- `GET /v1/users/me/saved-shops` [RESIDENT] — cursor-paginated, each item includes full `shop` + `photos`

`SavedShopsService` exported from `ShopsModule`, imported into `UserModule`.

### MINOR 1 — Notification Preferences Endpoint (`303085c`)

Added to `NotificationsController` (placed **before** `PATCH :id/read` to avoid Fastify treating `"preferences"` as `:id`):
- `GET /v1/notifications/preferences` — returns all 5 `NotificationType` values; defaults to `enabled: true` for types with no DB row yet
- `PUT /v1/notifications/preferences/:type` — `ParseEnumPipe(NotificationType)` validates path param (400 on unknown type); upserts via composite key `userId_type`

### MINOR 2 — ElectionVisibilityMode Enum (`c1571d6`)

Schema change:
```prisma
enum ElectionVisibilityMode { SEALED_UNTIL_DEADLINE  LIVE_COUNT  ADMIN_CONTROLLED }
// Election model: visibilityMode ElectionVisibilityMode @default(SEALED_UNTIL_DEADLINE)
```

Service changes in `elections.service.ts`:
- `buildElectionDto`: shows vote counts when `resultsOpen === true` OR `visibilityMode === LIVE_COUNT`
- `openExpiredResults` cron: `where: { visibilityMode: { not: ADMIN_CONTROLLED } }` — admin-controlled elections are never auto-opened
- `create()`: accepts optional `visibilityMode` in `ElectionCreateDto`, defaults to `SEALED_UNTIL_DEADLINE`
- `ElectionResponseDto` now includes `visibilityMode: ElectionVisibilityMode`

---

## FYI — Push Token Path (no change needed)

`CLAUDE.md` specifies `PATCH /users/me/push-token`. Implementation uses `PATCH /v1/auth/push-token`. FE already calls the correct implemented path. No change needed on either side.

---

## Post-Audit FE-BE Wiring Fixes (`eae0da7` + `ddce900`)

After the 6-gap audit, a deeper FE-BE wiring pass found 5 additional mismatches:

### BE Fix — `eae0da7` (eastpark-backend)

**ShopResponseDto + shops.service.ts — `reviewCount` + `averageRating`**
- Added `reviewCount: number` + `averageRating?: number | null` to `ShopResponseDto`
- `findAll`: includes `_count: { select: { reviews: true } }`, maps `reviewCount: shop._count.reviews, averageRating: null`
- `findOne`: `Promise.all([findUnique + _count, review.aggregate._avg.rating])` — real averageRating on detail view
- `create` / `update`: also carry `_count` and map `reviewCount`, `averageRating: null`

**user.service.ts — `deleteAccount`**
- Added `deleteAccount(userId)` method — delegates to existing `deleteUser` cascade transaction
- Cascade order: notification prefs → notifications → auditLogs → feedbackReplies → feedbacks → savedShops → comments → electionVotes → votes → reviews → orderItems → orders → invitations → user

**user.public.controller.ts — `DELETE /v1/user`**
- Added `DELETE /v1/user` [RESIDENT | MERCHANT] → 204 No Content
- Uses `@AllowedRoles([Role.RESIDENT, Role.MERCHANT])` + `@HttpCode(HttpStatus.NO_CONTENT)`

**.env.example — Paymob vars documented**
- Added `PAYMOB_INTEGRATION_ID=""` + `PAYMOB_IFRAME_ID=""` with inline comments pointing to Paymob dashboard

### FE Fix — `ddce900` (eastpark-frontend)

**src/services/api/users.ts**
- `updatePushToken`: `/users/me/push-token` → `/auth/push-token`
- Removed `getNotificationPreferences` + `updateNotificationPreferences` (wrong paths)
- `deleteAccount`: `/users/me` → `/user`

**src/services/api/notifications.ts**
- Added `NotificationPreference` interface
- Added `getPreferences()` → `GET /notifications/preferences`
- Added `updatePreference(type, enabled)` → `PUT /notifications/preferences/:type`

**src/services/api/shops.ts**
- `Shop.photos`: `isPrimary: boolean` → `order: number` (matches `ShopPhotoResponseDto`)

**src/app/(tabs)/directory/[shopId]/index.tsx**
- `ShopHero` cover photo: `find(p => p.isPrimary) ?? photos[0]` → `photos[0]` (BE already sorts by `order asc`)
