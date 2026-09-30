# EastPark Backend — Developer Guide

> Your day-to-day reference for understanding and operating the backend.
> Read this when you need to know how things connect, what to do when something breaks, or how to make changes safely.

---

## 1. The Big Picture — How Everything Fits Together

When the frontend app makes a request, here is the full journey:

```
Frontend (Expo app)
      │
      │  HTTP request (e.g. POST /v1/auth/login)
      ▼
NestJS Server (port 3000)
      │
      ├── Checks JWT token (via Redis blacklist)
      ├── Validates request body (class-validator)
      ├── Calls the right Service
      │
      ├── Service reads/writes data → PostgreSQL (via Prisma ORM)
      ├── Service caches/checks OTPs → Redis
      ├── Service uploads/reads files → MinIO
      ├── Service sends emails → Mailpit (dev) / Brevo (prod)
      └── Service sends push notifications → Expo Push Service
```

**In plain English:** The NestJS server is the brain. It sits in the middle and talks to PostgreSQL (permanent data), Redis (temporary data like OTPs), MinIO (files), and email services. The frontend never talks to these directly — only the server does.

---

## 2. Every Technology and What It Does

### PostgreSQL — The Main Database
- **What:** Stores all permanent data — users, shops, orders, polls, everything.
- **Port:** `5432`
- **Credentials:** user `postgres`, password from `POSTGRES_PASSWORD` env var (see `docker-compose.yml`), database `eastpark`
- **You interact with it via:** Prisma (never write raw SQL in the code)
- **Visual browser:** `pnpm prisma:studio` → opens at `http://localhost:5555`

### Redis — Temporary Fast Storage
- **What:** Stores things that expire — OTP codes, password reset tokens, rate-limit counters, and the list of "logged out" JWT tokens (blacklist).
- **Port:** `6379`
- **TTLs (time-to-live):**
  - OTP code: 10 minutes — after that it's gone, user must request again
  - Password reset token: 30 minutes
  - Logged-out JWT: 15 minutes (access token lifespan)
- **You don't interact with Redis manually** — the app handles it automatically.

### MinIO — File Storage
- **What:** Stores all uploaded files (shop photos, product images, PDF reports). Acts like Amazon S3 but runs locally on your machine.
- **Ports:** `9002` (S3 API the server uses), `9001` (Console UI for you)
- **Console:** `http://localhost:9001` — login with credentials from your `.env` file
- **Bucket name:** `eastpark-uploads` — all files go here
- **In production:** replaced by Supabase Storage (same concept, different host)

### Mailpit — Email Catcher (dev only)
- **What:** Catches every email the server tries to send. Instead of going to a real inbox, emails land here.
- **UI:** `http://localhost:8025`
- **Use it for:** Viewing OTP codes during registration, password reset links, merchant invitation emails
- **In production:** replaced by Brevo SMTP (real email delivery)

### Swagger UI — API Explorer
- **What:** A visual interface showing every API endpoint. You can test them directly in the browser.
- **URL:** `http://localhost:3000/docs`
- **Use it for:** Testing endpoints, understanding request/response shapes, debugging

---

## 3. The Database — Models and Relationships

### Complete Model Map

```
User
  ├── owns → Order[]              (as resident placing orders)
  ├── owns → Review[]             (one review per shop)
  ├── owns → SavedShop[]          (bookmarked shops)
  ├── owns → Feedback[]           (submitted complaints/requests)
  ├── owns → Vote[]               (poll votes)
  ├── owns → ElectionVote[]       (election votes)
  ├── owns → Notification[]       (in-app notifications)
  ├── owns → NotificationPreference[] (per-type opt-in settings)
  ├── owns → FeedbackReply[]      (admin replies to feedback)
  └── owns → Shop[]               (as merchant)

Shop
  ├── has → ShopPhoto[]           (gallery, ordered by `order` field)
  ├── has → Product[]             (menu items)
  ├── has → Order[]               (orders placed at this shop)
  └── has → Review[]              (resident reviews)

Order
  ├── has → OrderItem[]           (line items — snapshots of products)
  └── belongs to → User + Shop

Announcement
  └── has → Comment[]

Poll
  ├── has → PollOption[]
  └── has → Vote[]               (one per resident — enforced by DB)

Election
  ├── has → Candidate[]
  └── has → ElectionVote[]       (one per resident — enforced by DB)

Feedback
  └── has → FeedbackReply[]      (admin reply thread)
```

### Key Rules to Remember

| Rule | Why |
|---|---|
| `Product.isDeleted = true` means soft-deleted | Never hard-delete products — old orders reference them |
| `ShopPhoto` has an `order` field (Int) | `photos[0]` is the cover. Always sort by `order ASC` |
| `Review` is unique per `[userId, shopId]` | One review per resident per shop — enforced in DB |
| `Vote` is unique per `[userId, pollId]` | One vote per resident per poll — enforced in DB |
| `ElectionVote` is unique per `[userId, electionId]` | One vote per resident per election |
| `Order.totalAmount` is always computed server-side | Never trust what the client sends as the total |
| `OrderItem` stores `productNameSnapshot` | So receipts stay accurate even if product is renamed later |

---

## 4. The Auth Flow — How Login Works

### Registration (new resident)

```
1. POST /v1/auth/register
   → Server creates user (isVerified: false)
   → Server generates 6-digit OTP
   → OTP stored in Redis with 5min TTL
   → Email sent (check Mailpit)

2. POST /v1/auth/verify-otp  { email, code }
   → Server checks OTP in Redis
   → Sets user.isVerified = true
   → Returns accessToken + refreshToken

3. Frontend stores tokens in expo-secure-store (never localStorage)
```

### Login (existing user)

```
POST /v1/auth/login  { email, password }
→ Server checks password hash (argon2)
→ Returns accessToken (15min) + refreshToken (7 days)
```

### Token refresh (automatic — happens in background)

```
POST /v1/auth/refresh  { refreshToken }
→ Returns new accessToken
```

### Logout

```
POST /v1/auth/logout  { refreshToken }
→ Server adds refreshToken to Redis blacklist
→ Token is now dead even if not expired
```

### Merchant/Admin Invitation

```
1. Admin: POST /v1/admin/invitations  { email, role }
   → Server generates one-time signed token
   → Invitation email sent (check Mailpit for the link)

2. Recipient clicks link → opens accept-invitation screen in app

3. POST /v1/auth/accept-invitation  { token, name, password }
   → Server validates token, creates user account
   → Token marked as used (can't be reused)
```

---

## 5. How Files Are Stored (MinIO)

```
Frontend picks a file
      │
      ▼
POST /v1/uploads/image  (or /uploads/pdf)
      │
      ▼
Server validates:
  - Images: max 5MB, only jpg/png/webp
  - PDFs: max 20MB
      │
      ▼
Server uploads to MinIO bucket "eastpark-uploads"
      │
      ▼
Server returns { url: "http://localhost:9002/eastpark-uploads/filename.jpg" }
      │
      ▼
Frontend uses that URL in the next request
(e.g. POST /v1/shops  { ..., photoUrl: "..." })
```

**To browse uploaded files:** Open `http://localhost:9001`, login with the MinIO credentials from your `.env` file, click the `eastpark-uploads` bucket.

---

## 6. Real-Time Orders (Socket.io)

Orders have live status updates via WebSocket. Here's how it works:

```
1. Resident places order → POST /v1/orders
   → Order created with status: PLACED

2. Merchant sees the order in their dashboard
   → Merchant changes status: PATCH /v1/orders/:id/status
     → Status moves: PLACED → PREPARING → READY → DELIVERED

3. At each status change:
   → Server emits "orderStatusUpdated" via Socket.io
   → Both resident and merchant receive the update instantly
   → Server also sends a push notification (Expo)
```

**Status flow:**
```
PLACED → PREPARING → READY → DELIVERED
   ↓
CANCELLED  (resident can cancel only while status = PLACED)
```

---

## 7. What to Do When You Need to Change Something

### Add a new field to a database model

1. Open `prisma/schema.prisma` and add your field
2. Run `pnpm prisma:migrate` → enter a name like `add-phone-to-shop`
3. Run `pnpm prisma:generate` → updates the Prisma client
4. Update the relevant service/controller to use the new field

### Add a new API endpoint

1. Find the right module in `src/modules/`
2. Add the method to the controller (`.controller.ts`)
3. Implement the logic in the service (`.service.ts`)
4. Add DTOs for request/response in `dtos/`
5. Decorate with `@ApiOperation` so it appears in Swagger

### View or edit data directly

Run `pnpm prisma:studio` → opens `http://localhost:5555`
A visual table editor for every model. Safe for dev — careful in prod.

### Reset everything and start fresh (dev only)

```bash
pnpm docker:reset       # wipes all Docker volumes (all data gone)
pnpm docker:up          # restarts containers
pnpm prisma:migrate     # re-runs migrations
pnpm seed               # re-creates admin user
```

### See what emails were sent

Open `http://localhost:8025` — every email the server sent is captured here.

---

## 8. The Module Structure — Where Code Lives

```
src/modules/
├── auth/           Login, register, OTP, JWT, invitations, push token
├── user/           Profile read/update, self-delete, saved shops
├── shops/          Shop CRUD, photos, reviews, save/unsave
├── products/       Product CRUD (soft delete)
├── orders/         Order create/list/detail, status updates, cancel
├── payments/       Paymob webhook, order mark-paid
├── announcements/  Create/list/read announcements + comments
├── reports/        Official PDF compound reports
├── feedback/       Submit feedback + admin replies
├── governance/     Polls (create/vote) + Elections (create/candidates/vote)
├── notifications/  In-app feed + push + preference settings
├── invitations/    Admin sends/lists merchant/admin invites
└── uploads/        File upload endpoint (images + PDFs)
```

Each module follows this pattern:
```
module/
├── module.ts          → wires everything together
├── controller.ts      → handles HTTP (routes, decorators)
├── service.ts         → business logic
└── dtos/
    ├── request/       → what the client sends
    └── response/      → what the server returns
```

---

## 9. Environment Variables — What Controls What

Your `.env` file is the control panel. Key settings:

| Variable | Controls |
|---|---|
| `AUTH_ACCESS_TOKEN_SECRET` | Signs access JWTs — change this and all users get logged out |
| `AUTH_REFRESH_TOKEN_SECRET` | Signs refresh JWTs — same effect |
| `AUTH_ACCESS_TOKEN_EXP` | How long before user must refresh (`15m`) |
| `AUTH_REFRESH_TOKEN_EXP` | How long before user must re-login (`7d`) |
| `DATABASE_URL` | Which PostgreSQL database to connect to |
| `REDIS_URL` | Which Redis instance to use |
| `SUPABASE_URL` | Where files are stored (`localhost:9002` in dev = MinIO) |
| `SMTP_HOST` / `SMTP_PORT` | Where to send emails (`localhost:1025` in dev = Mailpit) |
| `APP_ENV` | `local` disables some prod-only restrictions and enables Swagger |

**Never commit `.env` to git.** It contains secrets.

---

## 10. Roles and What Each Can Do

| Role | How Created | What They Can Access |
|---|---|---|
| **Guest** | No account needed | Read shops, announcements, polls, elections |
| **Resident** | Register → verify OTP | Place orders, write reviews, vote, submit feedback, manage profile |
| **Merchant** | Admin sends invitation | Everything Resident can + manage their own shop, menu, and orders |
| **Admin** | Admin sends invitation | Everything + create announcements/polls/elections, manage users, view all feedback |

In the code, roles are enforced with this decorator on any endpoint:
```typescript
@AllowedRoles([Role.ADMIN])           // admin only
@AllowedRoles([Role.RESIDENT, Role.MERCHANT])  // either
```

---

## 11. Common Tasks Reference

| Task | Command / Where |
|---|---|
| Start the server | `pnpm dev` |
| Stop Docker services | `pnpm docker:down` |
| Restart Docker services | `pnpm docker:up` |
| View database visually | `pnpm prisma:studio` → http://localhost:5555 |
| View sent emails | http://localhost:8025 |
| Browse uploaded files | http://localhost:9001 |
| Test API endpoints | http://localhost:3000/docs |
| Apply a schema change | `pnpm prisma:migrate` |
| Run tests | `pnpm test` |
| Full data reset (dev) | `pnpm docker:reset && pnpm docker:up && pnpm prisma:migrate && pnpm seed` |

---

## 12. How Paymob Payments Work (when configured)

COD (cash on delivery) works with zero setup. Card/wallet payments need Paymob credentials.

```
1. Resident chooses "Pay by card" at checkout

2. Frontend calls: POST /v1/orders/:id/pay/paymob
   → Server calls Paymob API (3 steps internally)
   → Server returns { paymentKey, iframeUrl }
   → Frontend opens the iframe URL (Paymob's card form)

3. Resident enters card details in Paymob's form

4. Paymob calls our webhook: POST /v1/webhooks/paymob
   → Server verifies the HMAC-SHA512 signature (tamper check)
   → Server marks order.isPaid = true
   → Server sends push notification to resident
```

**In dev:** Paymob credentials are blank — card payment initiation will fail. COD works fine.

---

## 13. Logs — Reading the Server Output

When `pnpm dev` is running, the terminal shows structured logs. Here's how to read them:

```
INFO  [timestamp]: RoutesResolver   → server is registering routes (startup only)
INFO  [timestamp]: NestApplication  → server started successfully
INFO  [timestamp]: AuthService      → your own log messages from services
ERROR [timestamp]: SomeService      → something went wrong — read the message
WARN  [timestamp]: ThrottlerGuard   → rate limit hit (too many requests)
```

If you see an error during a request, the log will show:
- Which service threw it
- The full stack trace
- The error message

---

## 14. The Seed — First Admin Account

The `pnpm seed` command creates the first admin user (idempotent — safe to re-run):

- **Email:** `admin@eastpark.app`
- **Password:** Set via `SEED_ADMIN_PASSWORD` env var

This is defined in `prisma/seed-data.ts`. Edit that file to add more test users, shops, products, or orders. Run `pnpm prisma:reset && pnpm seed` to apply a fresh seed.

---

## 15. What Happens When Docker Is Not Running

If you start `pnpm dev` without Docker running:

| What fails | Why |
|---|---|
| Server crashes immediately | Can't connect to PostgreSQL |
| OTP emails don't arrive | Mailpit not running (but Mailpit failure might not crash the server) |
| File uploads fail | MinIO not running |
| Rate limiting may error | Redis not running |

**Always run `pnpm docker:up` before `pnpm dev`.**
Check containers are healthy: `docker compose ps`
