# Flat Listings (Sell / Rent) — API Contract v1

Status: APPROVED by owner 2026-10-31. Single source of truth for backend (`apps/backend`) and mobile
(`apps/mobile`). If code and this file disagree, fix the code or raise it — do not silently diverge.

All routes are under the global prefix `/v1`. Success responses use the existing envelope
`{ success: true, message: "<i18n.key>", data: <payload> }`. Errors use the existing filter shape
`{ statusCode, message, code?, timestamp }` where `code` is the i18n key below (mobile switches on `code`).

---

## 1. Domain

| Term | Meaning |
|---|---|
| Listing | A resident's offer to SELL or RENT one flat. |
| Owner | The RESIDENT who created the listing (`ownerId`). |
| Active | status `PENDING` or `APPROVED`. At most ONE active listing per flat. |
| Closed | status `SOLD`, `RENTED`, `WITHDRAWN`, `EXPIRED`. Terminal — cannot be edited or reopened. |

### Enums

```
ListingType   = SALE | RENT
ListingStatus = PENDING | APPROVED | REJECTED | SOLD | RENTED | WITHDRAWN | EXPIRED
```

`NotificationType` gains `LISTING_UPDATE` (default enabled; appears in notification preferences).

### Status machine

```
create            → PENDING
admin approve     PENDING  → APPROVED   (approvedAt = now, expiresAt = now + 60 days)
admin reject      PENDING  → REJECTED   (rejectReason required)
admin take down   APPROVED → REJECTED   (rejectReason required)
owner edit        PENDING | APPROVED | REJECTED → PENDING  (approvedAt/expiresAt cleared, rejectReason cleared)
owner renew       APPROVED → APPROVED   (expiresAt = now + 60 days; NO re-review)
owner mark closed APPROVED → SOLD (type SALE) | RENTED (type RENT)
owner withdraw    PENDING | APPROVED | REJECTED → WITHDRAWN
cron (hourly)     APPROVED with expiresAt <= now → EXPIRED
```

Any transition not in this table → 409 `listing.error.invalidStatus`.
Re-approving after an edit sets a fresh 60-day window.

---

## 2. Field rules (create and edit — same validators)

| Field | Type | Rule |
|---|---|---|
| `type` | `"SALE" \| "RENT"` | required |
| `building` | string | required, trimmed, 1–10 chars (typed by hand; same trim rule as resident leads) |
| `floor` | string | required, `^(G\|[1-9]\|1[01])$` |
| `flatNumber` | string | required, `^[1-5]$` |
| `price` | number | required, EGP, > 0, ≤ 1,000,000,000, max 2 decimals. SALE = total price, RENT = per month |
| `areaSqm` | integer | required, 20–1000 |
| `bedrooms` | integer | required, 0–10 |
| `bathrooms` | integer | required, 1–10 |
| `furnished` | boolean | required |
| `description` | string | optional, trimmed, ≤ 2000 chars; `""` → null |
| `contactPhone` | string | required, Egyptian mobile `^(?:\+?20\|0)1[0125]\d{8}$` (same regex as resident leads) |
| `photos` | string[] | required, 1–8 items, unique, each a stored URL (see §5) |

Money is stored `Decimal(12,2)` and returned as a JSON number (`.toNumber()`), like orders.

**Ownership:** on create AND on every edit the flat must be the caller's own: its `resident_units` row
belongs to the caller, or (legacy accounts with no `resident_units` rows at all) the flat label equals the
trimmed `User.unitNumber`. Otherwise 400 `listing.error.unitNotOwned`. When an admin removes a flat from an
account (`DELETE /admin/user/:id/units/:unitId`), that owner's PENDING/APPROVED listing for the flat is set to
WITHDRAWN in the same transaction.

Flat label everywhere: `${building}-${floor}-${flatNumber}` (reuse `src/common/helper/utils/unit-label.ts`).

---

## 3. Response DTOs

### `ListingDto` (public — what browsing residents see)

```jsonc
{
  "id": "cuid",
  "type": "SALE",
  "status": "APPROVED",
  "building": "A1", "floor": "3", "flatNumber": "2", "unitLabel": "A1-3-2",
  "price": 2500000,
  "areaSqm": 140, "bedrooms": 3, "bathrooms": 2, "furnished": false,
  "description": "string | null",
  "contactPhone": "01012345678",
  "photos": ["https://<supabase>/storage/v1/object/public/<bucket>/listing-photos/..."],
  "approvedAt": "ISO | null",
  "expiresAt": "ISO | null",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "owner": { "id": "cuid", "name": "string" }
}
```

### `MyListingDto` = `ListingDto` + `{ "rejectReason": "string | null" }`

### `AdminListingDto` = `MyListingDto` + `{ "owner": { "id", "name", "email", "phone" | null }, "revisionCount": number }`

### `ListingRevisionDto` (admin only)

```jsonc
{
  "id": "cuid",
  "createdAt": "ISO",
  "editor": { "id": "cuid", "name": "string" },
  "changes": [
    { "field": "price", "from": 2500000, "to": 2400000 },
    { "field": "photos", "added": ["url"], "removed": ["url"] }
  ]
}
```

`changes` lists only fields whose value actually changed. A no-op edit (nothing changed) → 400
`listing.error.noChanges` and does NOT reset status. `photos` order-only changes count as a change
(`added`/`removed` empty, plus `"reordered": true`).

### Paged lists

All list endpoints are cursor-paginated with the shared helpers (`cursorArgs` / `toCursorPage`),
query `cursor?` + `limit?` (default 20, max 50), order `[{ createdAt | approvedAt: 'desc' }, { id: 'desc' }]`,
response `{ items: T[], nextCursor: string | null }`.

---

## 4. Endpoints

### Resident / browse — `@Controller({ path: '/listings', version: '1' })`

| Method + path | Roles | Body / query | Result |
|---|---|---|---|
| `GET /listings` | RESIDENT, ADMIN, SUPER_ADMIN | `type?` (SALE\|RENT), `cursor?`, `limit?` | page of `ListingDto`, only `APPROVED` and `expiresAt > now`, newest `approvedAt` first. Owner soft-deleted → hidden. |
| `GET /listings/:id` | RESIDENT, ADMIN, SUPER_ADMIN | — | `ListingDto` if visible-approved; the OWNER also gets their own listing in any status (as `MyListingDto`). Else 404 `listing.error.notFound`. |
| `GET /listings/mine` | RESIDENT | `status?`, `cursor?`, `limit?` | page of `MyListingDto`, all statuses, newest `createdAt` first. **Register this route BEFORE `/:id`.** |
| `POST /listings` | RESIDENT | create body (§2) | 201 `MyListingDto` (status PENDING). Message `listing.success.created`. |
| `PATCH /listings/:id` | RESIDENT (owner) | full body (§2) — complete replacement, not partial | 200 `MyListingDto` (status PENDING). Writes one `ListingRevision`. |
| `POST /listings/:id/renew` | RESIDENT (owner) | — | 200 `MyListingDto`. Only `APPROVED`. |
| `POST /listings/:id/close` | RESIDENT (owner) | — | 200 `MyListingDto`. SALE→SOLD, RENT→RENTED. Only `APPROVED`. |
| `POST /listings/:id/withdraw` | RESIDENT (owner) | — | 200 `MyListingDto`. |

Not the owner (or listing missing) on owner actions → 404 `listing.error.notFound` (do not leak existence).

### Admin — `@Controller({ path: '/admin/listings', version: '1' })`, roles ADMIN (SUPER_ADMIN passes as elsewhere)

| Method + path | Body / query | Result |
|---|---|---|
| `GET /admin/listings` | `status?`, `type?`, `q?` (matches unit label, building or owner name, case-insensitive), `cursor?`, `limit?` | page of `AdminListingDto`, newest `updatedAt` first |
| `GET /admin/listings/stats` | — | `{ PENDING, APPROVED, REJECTED, SOLD, RENTED, WITHDRAWN, EXPIRED, total }` zero-filled (one `groupBy`) |
| `GET /admin/listings/:id` | — | `AdminListingDto` |
| `GET /admin/listings/:id/revisions` | `cursor?`, `limit?` | page of `ListingRevisionDto`, newest first |
| `POST /admin/listings/:id/approve` | optional `{ "expectedUpdatedAt"?: ISO-8601 }` | `AdminListingDto`. Only `PENDING`. Re-checks the one-active-per-flat rule. |
| `POST /admin/listings/:id/reject` | `{ "reason": string, "expectedUpdatedAt"?: ISO-8601 }`, reason trimmed 3–500 chars | `AdminListingDto`. `PENDING` → REJECTED, `APPROVED` → REJECTED (take down). |

`expectedUpdatedAt` is the `updatedAt` of the listing as the admin loaded it. When present the claim also
matches `updatedAt`; if the row is still in the expected status but was edited since, the call fails with 409
`listing.error.changedSinceLoaded` (any other mismatch stays `invalidStatus`). Omitted = previous behaviour.

Every admin action writes an `AuditLog` row: `action` = `LISTING_APPROVED` | `LISTING_REJECTED` |
`LISTING_TAKEN_DOWN`, `entity` = `Listing`, `entityId`, `meta` `{ unitLabel, reason? }`.

### Errors (`code` values)

| HTTP | code | When |
|---|---|---|
| 404 | `listing.error.notFound` | missing, not visible, or not the owner |
| 409 | `listing.error.unitAlreadyListed` | another ACTIVE listing exists for the same flat (create, edit that changes the flat, approve). DB partial unique index enforces it; Prisma P2002 maps here. |
| 409 | `listing.error.invalidStatus` | transition not allowed (also owner renew / close once `expiresAt` has passed but the cron has not yet marked it EXPIRED) |
| 409 | `listing.error.changedSinceLoaded` | admin approve / reject sent a stale `expectedUpdatedAt` (the owner edited the listing after the admin loaded it) |
| 400 | `listing.error.unitNotOwned` | create / edit for a flat that is not on the caller's account (§2 Ownership) |
| 409 | `listing.error.ownerDeleted` | admin approve of a listing whose owner account is soft-deleted |
| 400 | `listing.error.noChanges` | edit with nothing changed |
| 400 | `listing.error.photosRequired` | 0 photos or more than 8 |
| 400 | `file.error.urlNotStored` | a photo URL is not in our bucket (existing code) |
| 400 | validation array | field rules (§2), standard `message[]` |

Create is throttled: max 5 successful `POST /listings` per user per hour (returns the existing 429 shape). Failed attempts (400 / 409) do not count. `building` is upper-cased server-side.

---

## 5. Photos

- Upload with the EXISTING route: `POST /v1/uploads/image?purpose=listing` (multipart field `file`,
  jpeg/png/webp, ≤ 5 MB). New purpose `listing` → store `LISTING_PHOTOS` (folder `listing-photos`),
  roles `[RESIDENT, ADMIN, SUPER_ADMIN]`.
- Every URL in `photos[]` must pass the existing storage URL policy (`src/common/file/storage-url.ts`):
  same Supabase origin + bucket, else 400 `file.error.urlNotStored`. Unchanged URLs on edit are accepted.
- Photo order is the array order; index 0 is the cover.

---

## 6. Notifications (`LISTING_UPDATE`, respects the user's preference)

| Event | To | `data` payload |
|---|---|---|
| approved | owner | `{ type: "LISTING_UPDATE", listingId, status: "APPROVED" }` |
| rejected / taken down | owner | `{ type: "LISTING_UPDATE", listingId, status: "REJECTED" }` |
| expired (cron) | owner | `{ type: "LISTING_UPDATE", listingId, status: "EXPIRED" }` |

Titles/bodies bilingual (`title/titleAr/body/bodyAr`), include the unit label. Best-effort: a
notification failure never rolls back the status change. Mobile deep link: `listingId` →
`/(tabs)/profile/listings/[id]` (the owner's view).

---

## 7. Data model (backend reference)

```
model Listing {
  id, type ListingType, status ListingStatus @default(PENDING)
  building, floor, flatNumber String
  price Decimal(12,2), areaSqm Int, bedrooms Int, bathrooms Int, furnished Boolean
  description String?, contactPhone String, photos String[]
  rejectReason String?, approvedAt DateTime?, expiresAt DateTime?
  ownerId → User (RESTRICT), reviewedById → User? (SET NULL)
  createdAt, updatedAt
  @@index([status, approvedAt, id]); @@index([ownerId, createdAt, id]); @@index([status, expiresAt])
}
model ListingRevision {
  id, listingId → Listing (CASCADE), editorId → User (RESTRICT)
  changes Json, snapshot Json (full previous field values), createdAt
  @@index([listingId, createdAt, id])
}
```

Migration MUST: create both tables + enums, add `LISTING_UPDATE` to `NotificationType`,
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both new tables, and create the partial unique index
`listings_active_unit_key ON listings (building, floor, flatNumber) WHERE status IN ('PENDING','APPROVED')`.
Withdraw/close are status changes — no hard delete endpoint.
