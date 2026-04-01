# EastPark Backend — Gaps Audit & Fix Plan

> Generated: 2026-03-30 | **Resolution date:** 2026-04-01 | **Compliance now:** ~100% | **Resolved:** 6/6
> Audit compared `BackendPlan.md` + `CLAUDE.md` locked decisions against the live `eastpark-backend/` source.

### Resolution commits
| Phase | Commit | Description |
|---|---|---|
| BE-A + BE-B | `c1571d6` | ElectionVisibilityMode enum + InvitationsModule |
| BE-C | `60d7557` | Shop reviews + saved shops endpoints |
| BE-D | `303085c` | Notification preferences + Paymob initiation |

---

## Audit Summary

| Area | Status | Notes |
|---|---|---|
| Stack (NestJS + Fastify, pnpm, Prisma, Docker) | ✅ | All correct |
| Auth flows (register, OTP, login, refresh, logout, forgot/reset) | ✅ | All flows correct |
| Invitation accept flow | ✅ | `accept-invitation` endpoint works |
| Invitation send flow (admin) | ✅ | `POST /v1/admin/invitations` + `GET /v1/admin/invitations` — commit `c1571d6` |
| Shops CRUD + photo gallery | ✅ | Complete |
| Shop Reviews | ✅ | `GET/POST/DELETE /v1/shops/:shopId/reviews` + averageRating — commit `60d7557` |
| Saved Shops | ✅ | `POST/DELETE /v1/shops/:id/save` + `GET /v1/users/me/saved-shops` — commit `60d7557` |
| Products (soft-delete) | ✅ | `isDeleted` flag correct |
| Orders REST + WebSocket | ✅ | Server-side total, same-shop validation, cancel, real-time |
| Paymob initiation (3-step) | ✅ | `POST /v1/orders/:id/pay/paymob` → auth→order→key → `{ paymentKey, iframeUrl }` — commit `303085c` |
| Paymob webhook + HMAC-SHA512 | ✅ | Correct and timing-safe |
| Announcements + comments | ✅ | Cursor pagination, category filter |
| Reports (separate from announcements) | ✅ | Correct |
| Feedback + anonymous masking + replies | ✅ | Correct |
| Polls + one-vote guarantee | ✅ | DB `@@id([userId, pollId])` enforced |
| Elections + cron auto-open + one-vote | ✅ | `@Cron('*/5 * * * *')` in elections.service |
| ElectionVisibilityMode enum | ✅ | 3-mode enum added to schema; cron skips `ADMIN_CONTROLLED`; LIVE_COUNT shows counts before deadline — commit `c1571d6` |
| Notifications: Expo Push inline | ✅ | Fire-and-forget, preference-aware |
| Notifications: in-app feed | ✅ | Cursor pagination + unreadCount |
| Notification preferences endpoint | ✅ | `GET /v1/notifications/preferences` + `PUT /v1/notifications/preferences/:type` — commit `303085c` |
| Cursor pagination on all list endpoints | ✅ | Consistent pattern throughout |
| AuditLog model + user deleteUser cascade | ✅ | Full cascade in transaction |
| Rate limiting on `/auth/*` | ✅ | `@nestjs/throttler` |
| ConfigService (no raw process.env) | ✅ | Consistent |
| Swagger / OpenAPI | ✅ | `swagger.ts` + doc decorators |
| Tests (unit coverage) | ✅ | All services covered |
| Docker Compose (postgres, redis, mailpit, minio) | ✅ | All services + minio-init |
| Dockerfile CMD (migrate + start) | ✅ | `npx prisma migrate deploy && node dist/main` |
| Fly.io `cdg` region | ✅ | Configured |

---

## ✅ Critical Gaps — ALL RESOLVED

### ✅ GAP 1 — Admin Invitation Sending (commit `c1571d6`)

**Problem:** No API endpoint for admins to send invitations.
`email.service.sendInvitation()` exists. `Invitation` DB model is complete (`id, email, role, token, expiresAt, usedAt, invitedById`). The accept side (`POST /v1/auth/accept-invitation`) works. The send side was never implemented.

**Impact:** Admins have no way to invite merchants or other admins. Merchant onboarding is completely blocked.

**Fix — new `InvitationsModule`:**

```
src/modules/invitations/
├── dtos/
│   ├── request/
│   │   ├── invitation.create.dto.ts     # email, role (MERCHANT|ADMIN)
│   │   └── invitation.query.dto.ts      # cursor, limit
│   └── response/
│       └── invitation.response.dto.ts   # id, email, role, expiresAt, usedAt, createdAt
├── invitations.controller.ts            # POST + GET /v1/admin/invitations [ADMIN]
├── invitations.service.ts               # create() + findAll()
└── invitations.module.ts
```

**`invitations.service.ts` — `create(dto, actor)`:**
1. Check no active (unused, non-expired) invitation already exists for this email+role
2. Generate `token = randomBytes(32).toString('hex')`
3. Set `expiresAt = new Date(Date.now() + 48 * 3600 * 1000)`
4. Create `Invitation` row with `invitedById = actor.userId`
5. Call `email.sendInvitation(dto.email, inviteUrl, dto.role)` where `inviteUrl = ${appUrl}/auth/accept-invitation?token=${token}`
6. Return `InvitationResponseDto` (never expose raw `token` in response)

**`invitations.service.ts` — `findAll(query)`:** cursor pagination on `Invitation` table ordered by `createdAt desc`.

**Register in `app.module.ts`:** add `InvitationsModule` to imports.

---

### ✅ GAP 2 — Paymob Initiation Flow (3-Step) (commit `303085c`)

**Problem:** `PAYMOB_API_KEY` is in config but never used. No outbound Paymob API calls exist. Choosing `paymentMethod: PAYMOB` at order creation stores the value but returns no payment token. FE cannot open the payment iframe.

**Impact:** Card/wallet payments are non-functional end-to-end. Only COD works.

**Fix — add `initiatePayment()` to `PaymentsService` + new controller:**

**Step 1 — Update `paymob.config.ts`:**
```typescript
export default registerAs('paymob', () => ({
    apiKey:        process.env.PAYMOB_API_KEY        ?? '',
    hmacSecret:    process.env.PAYMOB_HMAC_SECRET    ?? '',
    integrationId: process.env.PAYMOB_INTEGRATION_ID ?? '',
    iframeId:      process.env.PAYMOB_IFRAME_ID      ?? '',
}));
```

**Step 2 — Add `initiatePayment(order, user)` to `PaymentsService`:**

```typescript
async initiatePayment(order: Order, user: User): Promise<{ paymentKey: string; iframeUrl: string }> {
    const amountCents = Math.round(order.totalAmount * 100);

    // 1. Auth token
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: this.apiKey }),
    });
    if (!authRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
    const { token: authToken } = await authRes.json() as { token: string };

    // 2. Register Paymob order
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
            amount_cents: amountCents,
            currency: 'EGP',
            merchant_order_id: order.id,
            items: [],
        }),
    });
    if (!orderRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
    const { id: paymobOrderId } = await orderRes.json() as { id: number };

    // 3. Payment key
    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
            amount_cents: amountCents,
            currency: 'EGP',
            order_id: paymobOrderId,
            billing_data: {
                first_name:      user.name.split(' ')[0] ?? user.name,
                last_name:       user.name.split(' ').slice(1).join(' ') || 'N/A',
                email:           user.email,
                phone_number:    user.phone ?? 'N/A',
                apartment: 'N/A', floor: 'N/A', street: 'N/A',
                building: 'N/A', shipping_method: 'NA',
                postal_code: 'N/A', city: 'N/A', country: 'EG', state: 'N/A',
            },
            integration_id: Number(this.integrationId),
            expiration: 3600,
        }),
    });
    if (!keyRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
    const { token: paymentKey } = await keyRes.json() as { token: string };

    return {
        paymentKey,
        iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey}`,
    };
}
```

**Step 3 — Create `src/modules/payments/payments-initiate.controller.ts`:**

```typescript
@ApiTags('payments')
@ApiBearerAuth('accessToken')
@Controller({ path: '/orders', version: '1' })
export class PaymentsInitiateController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly db: DatabaseService,
    ) {}

    @Post(':id/pay/paymob')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Initiate Paymob payment for an order [RESIDENT]' })
    async initiatePaymob(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser,
    ): Promise<{ paymentKey: string; iframeUrl: string }> {
        const order = await this.db.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundException('order.error.notFound');
        if (order.residentId !== actor.userId) throw new ForbiddenException();

        const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.userId } });
        return this.paymentsService.initiatePayment(order, user);
    }
}
```

**Register `PaymentsInitiateController` in `PaymentsModule`.**

**New env vars required:**
```
PAYMOB_INTEGRATION_ID=<from Paymob dashboard>
PAYMOB_IFRAME_ID=<from Paymob dashboard>
```

---

### ✅ GAP 3 — Shop Reviews (commit `60d7557`)

**Problem:** `Review` model in schema with `@@unique([userId, shopId])` and fields `id, rating (1–5), comment, userId, shopId, createdAt, updatedAt`. Zero API endpoints. Zero service methods. Zero DTOs.

**Impact:** Residents cannot rate shops. Shop detail screen shows no reviews. Average rating is unavailable.

**Fix — add to `ShopsModule`:**

```
src/modules/shops/
├── dtos/
│   ├── request/
│   │   ├── review.create.dto.ts       # rating: number (1-5), comment?: string
│   │   └── review.query.dto.ts        # cursor, limit
│   └── response/
│       └── review.response.dto.ts     # id, rating, comment, userId, createdAt
│                                      # ReviewListResponseDto: items, nextCursor, averageRating
├── reviews.service.ts
└── reviews.controller.ts
```

**`reviews.service.ts` methods:**

```typescript
// findAll — cursor pagination + parallel aggregate for averageRating
async findAll(shopId: string, query: ReviewQueryDto): Promise<ReviewListResponseDto>

// upsert — create or update; one review per resident per shop (@@unique enforces in DB)
async upsert(shopId: string, userId: string, dto: ReviewCreateDto): Promise<ReviewResponseDto>

// remove — delete own review; throw NotFoundException if not found or not owned
async remove(shopId: string, userId: string): Promise<void>
```

**`reviews.controller.ts` routes:**

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/v1/shops/:shopId/reviews` | Public | cursor pagination + averageRating |
| POST | `/v1/shops/:shopId/reviews` | RESIDENT | upsert (create or update own review) |
| DELETE | `/v1/shops/:shopId/reviews` | RESIDENT | delete own review |

**Register `ReviewsController` and `ReviewsService` in `ShopsModule`.**

---

### ✅ GAP 4 — Saved Shops (commit `60d7557`)

**Problem:** `SavedShop` model with composite PK `@@id([userId, shopId])`. Only referenced in `deleteUser` cascade. No save/unsave/list endpoints.

**Impact:** Bookmarking feature has no API backing. FE save button has nothing to call.

**Fix — add to `ShopsModule` + `UserModule`:**

```
src/modules/shops/
├── dtos/response/
│   └── saved-shop.response.dto.ts       # SavedShopResponseDto: userId, shopId, shop: ShopResponseDto
├── saved-shops.service.ts
└── saved-shops.controller.ts            # POST + DELETE /v1/shops/:id/save [RESIDENT]

src/modules/user/controllers/
└── user.saved-shops.controller.ts       # GET /v1/users/me/saved-shops [RESIDENT]
```

**`saved-shops.service.ts` methods:**

```typescript
// saveShop — upsert SavedShop (idempotent; no error if already saved)
async saveShop(shopId: string, userId: string): Promise<void>

// unsaveShop — delete; throw NotFoundException if not saved
async unsaveShop(shopId: string, userId: string): Promise<void>

// findSavedShops — cursor pagination; include { shop: { photos: true } }
async findSavedShops(userId: string, query: ShopQueryDto): Promise<SavedShopListResponseDto>
```

**`saved-shops.controller.ts` routes:**

| Method | Path | Guard |
|---|---|---|
| POST | `/v1/shops/:id/save` | RESIDENT |
| DELETE | `/v1/shops/:id/save` | RESIDENT |

**`user.saved-shops.controller.ts`:**

| Method | Path | Guard |
|---|---|---|
| GET | `/v1/users/me/saved-shops` | RESIDENT |

**Module wiring:** export `SavedShopsService` from `ShopsModule`; import `ShopsModule` in `UserModule`.

---

## ✅ Minor Gaps — ALL RESOLVED

### ✅ MINOR 1 — Notification Preferences Endpoint (commit `303085c`)

**Problem:** `NotificationPreference` table (`userId, type: NotificationType, enabled`) exists and is read inside `notifications.service.ts` during push delivery. No endpoint for users to read or update their preferences. FE settings screen has nothing to call.

**Fix — add to `NotificationsController` and `NotificationsService`:**

New DTOs:
- `notification.preference.dto.ts` → `UpdateNotificationPreferenceDto { enabled: boolean }`
- `notification.preference.response.dto.ts` → `NotificationPreferenceResponseDto { type: NotificationType, enabled: boolean }`

New service methods:
```typescript
// getPreferences — for every NotificationType value, return DB row or default { enabled: true }
async getPreferences(userId: string): Promise<NotificationPreferenceResponseDto[]>

// updatePreference — upsert on { userId_type: { userId, type } }
async updatePreference(userId: string, type: NotificationType, enabled: boolean): Promise<NotificationPreferenceResponseDto>
```

New controller endpoints (place **before** `PATCH ':id/read'` to avoid Fastify treating `"preferences"` as `:id`):

| Method | Path | Guard |
|---|---|---|
| GET | `/v1/notifications/preferences` | Any authenticated |
| PUT | `/v1/notifications/preferences/:type` | Any authenticated |

Use `@Param('type', new ParseEnumPipe(NotificationType)) type: NotificationType` to validate the `:type` param.

---

### ✅ MINOR 2 — ElectionVisibilityMode Enum (commit `c1571d6`)

**Problem:** `CLAUDE.md` specifies `ElectionVisibilityMode enum: SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED`. Current schema uses only `resultsOpen: Boolean`. The boolean covers the `SEALED_UNTIL_DEADLINE` case but misses `LIVE_COUNT` (show counts before deadline) and `ADMIN_CONTROLLED` (cron never auto-opens; admin flips manually).

**Fix:**

**1. Schema change** (`prisma/schema.prisma`):
```prisma
enum ElectionVisibilityMode {
  SEALED_UNTIL_DEADLINE
  LIVE_COUNT
  ADMIN_CONTROLLED
}

model Election {
  // ... existing fields ...
  visibilityMode ElectionVisibilityMode @default(SEALED_UNTIL_DEADLINE)
}
```
Run: `pnpm prisma migrate dev --name add_election_visibility_mode`

**2. Update `elections.service.ts`:**

- `buildElectionDto`: show `voteCount` when `resultsOpen === true` OR `visibilityMode === LIVE_COUNT`
- `openExpiredResults` cron: add `visibilityMode: { not: ElectionVisibilityMode.ADMIN_CONTROLLED }` to the `where` clause
- `create()`: accept optional `visibilityMode` in `ElectionCreateDto`

**3. Update `ElectionCreateDto`:** add `visibilityMode?: ElectionVisibilityMode`

**4. Update `ElectionResponseDto`:** add `visibilityMode: ElectionVisibilityMode`

---

## Implementation Order

Implement in this sequence to avoid blocking dependencies:

```
Step 0  schema.prisma — add ElectionVisibilityMode enum + field
        → pnpm prisma migrate dev --name add_election_visibility_mode
        → pnpm prisma generate

Step 1  MINOR 2 — elections.service.ts + dto updates (uses new schema)

Step 2  GAP 1   — InvitationsModule (self-contained; no other module deps)

Step 3  GAP 3   — Reviews (add to ShopsModule)

Step 4  GAP 4   — SavedShops (add to ShopsModule + UserModule)

Step 5  MINOR 1 — Notification preferences endpoints (add to NotificationsModule)

Step 6  GAP 2   — Paymob initiation (paymob.config.ts + payments.service.ts + new controller)
```

---

## New Files to Create

```
src/modules/invitations/dtos/request/invitation.create.dto.ts
src/modules/invitations/dtos/request/invitation.query.dto.ts
src/modules/invitations/dtos/response/invitation.response.dto.ts
src/modules/invitations/invitations.service.ts
src/modules/invitations/invitations.controller.ts
src/modules/invitations/invitations.module.ts

src/modules/shops/dtos/request/review.create.dto.ts
src/modules/shops/dtos/request/review.query.dto.ts
src/modules/shops/dtos/response/review.response.dto.ts
src/modules/shops/reviews.service.ts
src/modules/shops/reviews.controller.ts

src/modules/shops/dtos/response/saved-shop.response.dto.ts
src/modules/shops/saved-shops.service.ts
src/modules/shops/saved-shops.controller.ts

src/modules/user/controllers/user.saved-shops.controller.ts

src/modules/notifications/dtos/request/notification.preference.dto.ts
src/modules/notifications/dtos/response/notification.preference.response.dto.ts

src/modules/payments/payments-initiate.controller.ts
```

## Existing Files to Edit

```
prisma/schema.prisma                                              # Step 0
src/modules/governance/dtos/request/election.create.dto.ts       # Step 1
src/modules/governance/dtos/response/election.response.dto.ts    # Step 1
src/modules/governance/services/elections.service.ts             # Step 1
src/app/app.module.ts                                             # Step 2 (add InvitationsModule)
src/modules/shops/shops.module.ts                                 # Steps 3 + 4
src/modules/user/user.module.ts                                   # Step 4 (import ShopsModule)
src/modules/notifications/notifications.service.ts                # Step 5
src/modules/notifications/notifications.controller.ts             # Step 5
src/common/config/paymob.config.ts                                # Step 6
src/modules/payments/payments.service.ts                          # Step 6
src/modules/payments/payments.module.ts                           # Step 6
```

---

## Testing Checklist Per Gap

### GAP 1 — Invitations
- [ ] `POST /v1/admin/invitations` with ADMIN JWT → 201 + DB row created + `emailService.sendInvitation` called
- [ ] Same endpoint with MERCHANT/RESIDENT JWT → 403
- [ ] `GET /v1/admin/invitations` → cursor pagination correct
- [ ] Token field is **never** returned in any response DTO
- [ ] `expiresAt` ≈ `now + 48h`
- [ ] Duplicate active invite for same email+role → 409 Conflict

### GAP 2 — Paymob
- [ ] `POST /v1/orders/:id/pay/paymob` with owning RESIDENT JWT → `{ paymentKey, iframeUrl }`
- [ ] `iframeUrl` contains `PAYMOB_IFRAME_ID` and `paymentKey`
- [ ] Different resident's JWT → 403
- [ ] Non-existent order ID → 404
- [ ] Mock `fetch` step-1 failure → 502 BadGateway
- [ ] Mock `fetch` step-2 failure → 502 BadGateway
- [ ] Mock `fetch` step-3 failure → 502 BadGateway

### GAP 3 — Reviews
- [ ] `GET /v1/shops/:shopId/reviews` (no JWT) → 200 + `averageRating` in response
- [ ] `POST` same review twice by same user → second call updates (upsert); DB has 1 row
- [ ] `DELETE` with no existing review → 404
- [ ] `DELETE` correct user → 204

### ✅ GAP 4 — Saved Shops (commit `60d7557`)
- [ ] `POST /v1/shops/:id/save` twice → idempotent, no error on second call
- [ ] `DELETE /v1/shops/:id/save` when not saved → 404
- [ ] `GET /v1/users/me/saved-shops` → each item includes `shop` relation
- [ ] MERCHANT JWT on save/unsave → 403

### MINOR 1 — Notification Preferences
- [ ] `GET /v1/notifications/preferences` with no DB rows → all types returned with `enabled: true`
- [ ] `PUT /v1/notifications/preferences/ORDER_UPDATE` `{ enabled: false }` → row created
- [ ] Second `PUT` `{ enabled: true }` → row updated (not duplicated)
- [ ] Invalid type in URL (e.g. `INVALID_TYPE`) → 400

### MINOR 2 — ElectionVisibilityMode
- [ ] `LIVE_COUNT` election → vote counts visible before `expiresAt`
- [ ] `ADMIN_CONTROLLED` election → cron does NOT auto-open after `expiresAt`
- [ ] `SEALED_UNTIL_DEADLINE` (default) → cron auto-opens after `expiresAt`
- [ ] `visibilityMode` appears in `ElectionResponseDto`

---

## Push Token Path Discrepancy (FYI)

`CLAUDE.md` says `PATCH /users/me/push-token`. Implementation uses `PATCH /v1/auth/push-token`.
**No BE change needed** — just ensure the FE `authSlice` post-login call hits `/v1/auth/push-token`.
