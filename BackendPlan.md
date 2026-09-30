# EastPark App — Backend Plan (Merged)

> Canonical backend reference. Supersedes PlanOneBE.md and PlanTwoBE.md.

---

## Framework: NestJS + Fastify adapter

- Built-in modules, guards, DI map directly to 4-role RBAC
- First-class `@WebSocketGateway` for real-time order tracking
- Fastify adapter = better throughput than Express, same NestJS structure
- Prisma as injectable `PrismaService`
- Auto-validation via `class-validator` + `ValidationPipe`
- Swagger via `@nestjs/swagger`

**Package manager: pnpm** (faster installs, better disk usage than npm)

---

## Free Infrastructure

| Layer | Dev (local) | Production |
|---|---|---|
| Database | Docker — `postgres:16-alpine` | Supabase PostgreSQL (500MB free) — same project as Storage |
| Cache | Docker — `redis:7-alpine` | Upstash Redis (10K req/day, 256MB) |
| Email | Docker — Mailpit (catches all mail) | Brevo SMTP (300 emails/day free) |
| File Storage | Docker — MinIO | Supabase Storage (1GB, 2GB bandwidth) |
| Hosting | Local (`pnpm dev`) | Fly.io (no spin-down, WebSocket-friendly) |

---

## Architecture Diagram

```
Mobile App (Expo RN)
        |
        v
   Fly.io Docker Container (cdg — Paris)
   ┌─────────────────────────────┐
   │  NestJS (Fastify adapter)   │
   │  ├── REST API (Guards/Pipes)│
   │  ├── WebSocket Gateway      │
   │  │   (Socket.io)            │
   │  └── @Cron jobs             │
   │      (election auto-open)   │
   └──────────────┬──────────────┘
                  │
       ┌──────────┼────────────┐
       ▼          ▼            ▼
  Supabase   Upstash Redis  Supabase Storage
  Postgres   (OTP/sessions/ (images/PDFs)
              rate-limit)
                  │
            Brevo SMTP      Expo Push Service
            (OTP emails)    (push — inline)
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum Role {
  GUEST
  RESIDENT
  MERCHANT
  ADMIN
}

enum OrderStatus {
  PLACED
  CONFIRMED
  PREPARING
  READY
  ON_THE_WAY
  DELIVERED
  CANCELLED
}

enum FeedbackCategory {
  MAINTENANCE
  SECURITY
  CLEANLINESS
  NOISE
  SUGGESTION
  OTHER
}

enum FeedbackStatus {
  SUBMITTED
  ACKNOWLEDGED
  IN_PROGRESS
  RESOLVED
}

enum NotificationType {
  ORDER_UPDATE
  ANNOUNCEMENT
  POLL
  ELECTION
  FEEDBACK_UPDATE
}

enum AnnouncementCategory {
  GENERAL
  PROMOTION   // hero carousel on home feed
  EVENT       // calendar view
  MAINTENANCE
  NEWS
}

enum ShopCategory {
  CAFE_AND_FOOD
  GROCERY
  BUTCHER
  SERVICES
  OTHER
}

enum PaymentMethod {
  CASH
  PAYMOB
}

// ─── Users & Auth ─────────────────────────────────────────────────────────────

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  phone         String?  @unique
  unitNumber    String?
  passwordHash  String?
  role          Role     @default(RESIDENT)
  isVerified    Boolean  @default(false)
  avatarUrl     String?
  pushToken     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  orders                  Order[]
  reviews                 Review[]
  votes                   Vote[]
  feedbacks               Feedback[]
  savedShops              SavedShop[]
  comments                Comment[]
  electionVotes           ElectionVote[]
  notifications           Notification[]
  shops                   Shop[]
  feedbackReplies         FeedbackReply[]
  invitationsSent         Invitation[]
  notificationPreferences NotificationPreference[]
  auditLogs               AuditLog[]
}

// One-time invite token for MERCHANT and ADMIN accounts
model Invitation {
  id          String    @id @default(cuid())
  email       String
  role        Role      // MERCHANT or ADMIN only
  token       String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

model Shop {
  id            String   @id @default(cuid())
  name          String
  nameAr        String
  description   String?
  descriptionAr String?
  category      ShopCategory
  coverUrl      String?
  // Per-day schedule: { mon: { open: "09:00", close: "22:00", closed: false }, ... }
  workingHours  Json?
  phone         String?
  whatsapp      String?
  isOpen        Boolean  @default(true)  // manual override — merchant toggles this (e.g. emergency closure)
                                         // FE computes "open now" from workingHours; isOpen=false overrides it
  deliveryTime  Int?     // estimated minutes
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  merchantId String
  merchant   User      @relation(fields: [merchantId], references: [id])
  products   Product[]
  orders     Order[]
  reviews    Review[]
  savedBy    SavedShop[]
  photos     ShopPhoto[]
}

model ShopPhoto {
  id        String   @id @default(cuid())
  url       String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  shopId String
  shop   Shop   @relation(fields: [shopId], references: [id], onDelete: Cascade)
}

model Product {
  id          String   @id @default(cuid())
  name        String
  nameAr      String
  description String?
  price       Float
  imageUrl    String?
  isAvailable Boolean  @default(true)
  isDeleted   Boolean  @default(false) // soft delete — preserves OrderItem FKs
  createdAt   DateTime @default(now())

  shopId     String
  shop       Shop        @relation(fields: [shopId], references: [id])
  orderItems OrderItem[]
}

model Order {
  id            String        @id @default(cuid())
  status        OrderStatus   @default(PLACED)
  totalAmount   Float
  notes         String?
  deliveryUnit  String
  paymentMethod PaymentMethod @default(CASH)
  isPaid        Boolean       @default(false)  // flipped true by Paymob webhook
  paymobOrderId String?       // Paymob transaction reference
  cancelledAt   DateTime?     // set when resident cancels a PLACED order
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  residentId String
  resident   User        @relation(fields: [residentId], references: [id])
  shopId     String
  shop       Shop        @relation(fields: [shopId], references: [id])
  items      OrderItem[]
}

model OrderItem {
  id                  String @id @default(cuid())
  quantity            Int
  unitPrice           Float  // snapshot at time of order — not affected by future price changes
  productNameSnapshot String // snapshot of name at time of order — safe for receipts/history
  productNameArSnapshot String

  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
}

model Review {
  id        String   @id @default(cuid())
  rating    Int      // 1–5
  comment   String?
  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id])
  shopId String
  shop   Shop   @relation(fields: [shopId], references: [id])

  @@unique([userId, shopId]) // one review per resident per shop
}

model SavedShop {
  userId String
  user   User   @relation(fields: [userId], references: [id])
  shopId String
  shop   Shop   @relation(fields: [shopId], references: [id])

  @@id([userId, shopId])
}

// ─── Community Hub ────────────────────────────────────────────────────────────

model Announcement {
  id          String               @id @default(cuid())
  title       String
  titleAr     String
  body        String
  bodyAr      String
  category    AnnouncementCategory @default(GENERAL)
  pdfUrl      String?
  publishedAt DateTime             @default(now())
  createdAt   DateTime             @default(now())

  comments Comment[]
}

model Report {
  id          String   @id @default(cuid())
  title       String
  titleAr     String
  description String?
  pdfUrl      String
  period      String   // e.g. "Q1-2025", "January-2025"
  publishedAt DateTime @default(now())
  createdAt   DateTime @default(now())
}

model Comment {
  id             String       @id @default(cuid())
  body           String
  createdAt      DateTime     @default(now())

  userId         String
  user           User         @relation(fields: [userId], references: [id])
  announcementId String
  announcement   Announcement @relation(fields: [announcementId], references: [id])
}

// ─── Governance ───────────────────────────────────────────────────────────────

model Poll {
  id         String   @id @default(cuid())
  question   String
  questionAr String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  options PollOption[]
  votes   Vote[]
}

model PollOption {
  id      String @id @default(cuid())
  label   String
  labelAr String

  pollId String
  poll   Poll   @relation(fields: [pollId], references: [id])
  votes  Vote[]
}

model Vote {
  userId   String
  user     User       @relation(fields: [userId], references: [id])
  pollId   String
  poll     Poll       @relation(fields: [pollId], references: [id])
  optionId String
  option   PollOption @relation(fields: [optionId], references: [id])
  createdAt DateTime  @default(now())

  @@id([userId, pollId]) // enforces one vote per resident per poll
}

model Election {
  id          String   @id @default(cuid())
  title       String
  titleAr     String
  expiresAt   DateTime
  visibility  ElectionVisibilityMode @default(SEALED_UNTIL_DEADLINE) // controls when results are visible
  resultsOpen Boolean  @default(false) // flipped true by @Cron when expiresAt passes (if mode = SEALED_UNTIL_DEADLINE)
  createdAt   DateTime @default(now())

  candidates Candidate[]
  votes      ElectionVote[]
}

enum ElectionVisibilityMode {
  SEALED_UNTIL_DEADLINE
  LIVE_COUNT
  ADMIN_CONTROLLED
}

model Candidate {
  id          String  @id @default(cuid())
  name        String
  nameAr      String
  statement   String?
  statementAr String?
  photoUrl    String?

  electionId String
  election   Election       @relation(fields: [electionId], references: [id])
  votes      ElectionVote[]
}

model ElectionVote {
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  electionId  String
  election    Election  @relation(fields: [electionId], references: [id])
  candidateId String
  candidate   Candidate @relation(fields: [candidateId], references: [id])
  createdAt   DateTime  @default(now())

  @@id([userId, electionId]) // enforces one vote per resident per election
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

model Feedback {
  id          String           @id @default(cuid())
  category    FeedbackCategory
  body        String
  isAnonymous Boolean          @default(false)
  status      FeedbackStatus   @default(SUBMITTED)
  attachments String[]         // Supabase Storage URLs (max 3, photo or video; clarify in API docs if video is not supported)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  userId  String
  user    User            @relation(fields: [userId], references: [id])
  replies FeedbackReply[]
}

model FeedbackReply {
  id        String   @id @default(cuid())
  body      String
  createdAt DateTime @default(now())

  feedbackId String
  feedback   Feedback @relation(fields: [feedbackId], references: [id])
  authorId   String   // the admin who replied
  author     User     @relation(fields: [authorId], references: [id])
}

// ─── Notifications ────────────────────────────────────────────────────────────

model Notification {
  id        String           @id @default(cuid())
  title     String
  titleAr   String
  body      String
  bodyAr    String
  type      NotificationType
  isRead    Boolean          @default(false)
  metadata  Json?            // e.g. { orderId, pollId } for deep-linking
  createdAt DateTime         @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id])
}

// ─── Notification Preferences ─────────────────────────────────────────────────

// One row per user per notification type — easy to query "all users who want POLL notifications"
model NotificationPreference {
  id      String           @id @default(cuid())
  type    NotificationType
  enabled Boolean          @default(true)

  userId String
  user   User   @relation(fields: [userId], references: [id])

  @@unique([userId, type]) // one preference row per user per type
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

// Records admin actions and governance events for traceability
model AuditLog {
  id        String   @id @default(cuid())
  action    String   // e.g. "INVITATION_SENT", "POLL_CREATED", "ORDER_STATUS_CHANGED"
  entity    String   // e.g. "Invitation", "Poll", "Order"
  entityId  String?  // the affected record's id
  metadata  Json?    // any extra context (old value, new value, etc.)
  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

---

## Module Structure

```
src/
├── main.ts                          ← Bootstrap Fastify, global pipes, Swagger
├── app.module.ts
│
├── common/                          ← Shared across all modules
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts  ← Wrap all responses: { data, message }
│   └── pipes/
│       └── validation.pipe.ts
│
├── prisma/
│   ├── prisma.module.ts             ← decorated @Global() — imported once in AppModule, available everywhere
│   └── prisma.service.ts
│
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts             ← Upstash ioredis (OTP, rate limit, blacklist)
│
├── email/
│   ├── email.module.ts
│   └── email.service.ts             ← Mailpit (dev) / Brevo (prod) abstraction
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   │   └── jwt-ws.strategy.ts       ← validates JWT from WS handshake auth header
│   └── dto/
│       ├── register.dto.ts           ← name, email, phone, unitNumber, password
│       ├── login.dto.ts
│       ├── verify-otp.dto.ts
│       ├── resend-otp.dto.ts
│       ├── forgot-password.dto.ts
│       ├── reset-password.dto.ts
│       └── accept-invitation.dto.ts  ← token, name, password
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts          ← /users/me
│   └── users.service.ts
│
├── residents/
│   ├── residents.module.ts
│   └── residents.service.ts         ← Unit format validation (non-empty, max 10 chars)
│                                       MVP: any non-empty string accepted as a valid unit number
│                                       Future: validate against an admin-managed unit list
│
├── invitations/
│   ├── invitations.module.ts
│   ├── invitations.controller.ts    ← POST /invitations [admin]
│   └── invitations.service.ts       ← Generate signed token, send invite email
│
├── shops/
│   ├── shops.module.ts
│   ├── shops.controller.ts
│   ├── shops.service.ts
│   └── shop-photos.controller.ts    ← /shops/:shopId/photos [merchant]
│
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts       ← /shops/:shopId/products
│   └── products.service.ts
│
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── orders.gateway.ts            ← @WebSocketGateway
│
├── announcements/
│   ├── announcements.module.ts
│   ├── announcements.controller.ts
│   └── announcements.service.ts
│
├── reports/
│   ├── reports.module.ts
│   ├── reports.controller.ts        ← /reports (PDFs)
│   └── reports.service.ts
│
├── governance/
│   ├── governance.module.ts
│   ├── polls.controller.ts
│   ├── polls.service.ts
│   ├── elections.controller.ts
│   ├── elections.service.ts
│   └── elections.scheduler.ts       ← @Cron every 5min: flip resultsOpen when expiresAt passed
│
├── webhooks/
│   ├── webhooks.module.ts
│   └── webhooks.controller.ts       ← POST /webhooks/paymob (HMAC-verified)
│
├── feedback/
│   ├── feedback.module.ts
│   ├── feedback.controller.ts
│   └── feedback.service.ts
│
├── notifications/
│   ├── notifications.module.ts
│   ├── notifications.controller.ts  ← /notifications + /users/me/notification-preferences
│   └── notifications.service.ts     ← Expo Push SDK + DB records + preference checks
│
├── audit/
│   ├── audit.module.ts
│   └── audit.service.ts             ← AuditLog.create() helper — injected wherever needed
│
└── uploads/
    ├── uploads.module.ts
    └── uploads.service.ts           ← MinIO (dev) / Supabase Storage (prod)
                                     ← Validates: images ≤ 5MB (jpg/png/webp), PDFs ≤ 20MB
```

---

## Key Patterns

### Auth + OTP Flow

```
POST /auth/register        → collect name+email+phone+unitNumber+password,
                              hash password, save user (isVerified=false),
                              store OTP in Redis (TTL 10min), send OTP email
POST /auth/verify-otp      → check Redis OTP, mark isVerified=true, return JWT pair
POST /auth/resend-otp      → regenerate OTP, reset Redis TTL, resend email
POST /auth/login           → { email, password } → verify password, return JWT pair
                              (passwordless login = use forgot-password → reset flow)
POST /auth/forgot-password → generate reset token (Redis, TTL 30min), send reset email
POST /auth/reset-password  → verify reset token, update passwordHash, invalidate token
POST /auth/refresh         → check refresh token not blacklisted, return new access token
POST /auth/logout          → blacklist refresh token in Redis
```

JWT uses **two separate secrets**: `JWT_SECRET` for access tokens, `JWT_REFRESH_SECRET` for refresh tokens.

### Role Guard

```typescript
@Get('admin/merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
getMerchants() { ... }

@Get('shops')
@Public()           // skips JwtAuthGuard entirely
getShops() { ... }
```

### WebSocket Gateway (with JWT Auth)

```typescript
@WebSocketGateway({ namespace: '/orders', cors: { origin: process.env.APP_URL } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  // Validate JWT on every WS connection — reject unauthenticated clients
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(); // invalid or missing token
    }
  }

  emitStatusUpdate(orderId: string, status: OrderStatus) {
    this.server.to(`order:${orderId}`).emit('status_update', { orderId, status });
  }
}
// Client connects with: socket = io('/orders', { auth: { token: accessToken } })
```

### CORS + Helmet (main.ts)

```typescript
// main.ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await app.register(fastifyCors, { origin: process.env.APP_URL || '*' });
await app.register(fastifyHelmet);
await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
// pnpm add @fastify/cors @fastify/helmet
```

### Anonymous Feedback (service-level rule)

When `isAnonymous=true` on a Feedback record:
- Only admins may see resident identity (userId, author fields). All other roles and any exported/admin-facing lists must strip or null these fields.
- Residents always see their own feedback with full info (ownership check bypasses anonymity).

### Order Validation Rules (service-level)

When `POST /orders`:
1. Validate all `productId` values belong to the same `shopId` as specified in the order body
2. Validate no product has `isAvailable=false` or `isDeleted=true`
3. Validate `items` array is non-empty
4. `totalAmount` is computed server-side from product prices — never trusted from client

When `PATCH /orders/:id/cancel` (resident):
- Only allowed when `status === PLACED` — throw `409 Conflict` otherwise
- Sets `status=CANCELLED` and `cancelledAt=now()`

### OTP Redis

```typescript
// store
await this.redis.set(`otp:${email}`, hashedOtp, 'EX', 600);
// verify
const stored = await this.redis.get(`otp:${email}`);
if (!stored || !bcrypt.compareSync(code, stored)) throw new UnauthorizedException();
await this.redis.del(`otp:${email}`);
```

### Invitation Flow

```
POST /invitations [admin]
  → generate crypto.randomBytes(32).toString('hex') token
  → store Invitation { email, role, token, expiresAt: +48h }
  → send email: "You're invited — click to join as Merchant"

POST /auth/accept-invitation { token, name, password }
  → find Invitation by token, check !usedAt && expiresAt > now
  → create User { email, role, isVerified: true }
  → mark invitation.usedAt = now()
  → return JWT pair
```

### Payment Lifecycle (Cash & Paymob)

**Cash Orders:**
- Resident creates order (status=PLACED, paymentMethod=CASH, isPaid=false)
- Merchant/admin can CONFIRM, PREPARE, READY, DELIVERED
- Resident can CANCEL only while status=PLACED
- No payment confirmation required; order is settled on delivery

**Paymob Orders:**
- Resident creates order (status=PLACED, paymentMethod=PAYMOB, isPaid=false)
- Resident is redirected to Paymob payment page
- Webhook (`POST /webhooks/paymob`) receives payment result
- HMAC signature is verified; webhook is idempotent (ignore duplicates)
- If payment succeeds: isPaid=true, status=CONFIRMED
- If payment fails: status=CANCELLED, isPaid=false
- Unpaid orders expire after X minutes (configurable); cron job cancels expired unpaid orders

```typescript
// POST /webhooks/paymob — raw body needed for HMAC
@Post('paymob')
async handlePaymob(@Req() req: RawBodyRequest, @Body() body: any) {
  const hmac = crypto
    .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
    .update(this.buildHmacString(body))
    .digest('hex');
  if (hmac !== body.hmac) throw new UnauthorizedException();

  // Idempotency: check if already processed
  if (await this.redis.get(`paymob_webhook_${body.obj.id}`)) return;

  if (body.obj?.success === true) {
    const orderId = body.obj.order.merchant_order_id; // our Order.id
    await this.ordersService.markPaid(orderId, body.obj.id.toString());
    await this.redis.set(`paymob_webhook_${body.obj.id}`, '1', 'EX', 86400);
  } else {
    // Mark order as cancelled/failed
  }
}
```

### Paymob FE Integration Flow

1. FE (payment.tsx): user selects "Card via Paymob" → taps "Place Order" → `POST /orders` with `paymentMethod: 'PAYMOB'` → order created with `isPaid: false`
2. FE: calls `POST /orders/:id/pay` → receives `{ paymentKey, iframeId }`
3. FE: opens WebView to `https://accept.paymob.com/api/acceptance/iframes/{iframeId}?payment_token={paymentKey}`
4. User completes payment on Paymob page
5. Paymob calls `POST /webhooks/paymob` on our server → HMAC verified → `Order.isPaid = true`
6. FE: Socket.io `status_update` event (or poll on return from WebView) reflects updated order state
7. FE: navigates to `checkout/confirmation.tsx`

**FE usage after calling `POST /orders/:id/pay`:**
```ts
// After receiving the response:
const paymobUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;
// Open paymobUrl in a WebView or Linking.openURL()
```

**`POST /orders/:id/pay` response shape:**
```json
{
  "data": {
    "paymentKey": "ZXlK...",
    "iframeId": "12345",
    "paymobOrderId": "78901234"
  },
  "message": "Payment initiated"
}
```

### Election Auto-Open (Cron)

```typescript
@Injectable()
export class ElectionsScheduler {
  @Cron(CronExpression.EVERY_5_MINUTES)
  async openExpiredElections() {
    await this.prisma.election.updateMany({
      where: { resultsOpen: false, expiresAt: { lte: new Date() } },
      data: { resultsOpen: true },
    });
  }
}
```

### Prisma Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@eastpark.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  await prisma.user.create({
    data: {
      name: 'EastPark Admin',
      email,
      passwordHash: bcrypt.hashSync('Admin@1234!', 10),
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('Seed: admin created →', email);
}

main().finally(() => prisma.$disconnect());
```

### Config Pattern

All env vars are accessed via injected `ConfigService`, never `process.env` directly:

```typescript
// ✅ correct
constructor(private config: ConfigService) {}
this.config.get<string>('JWT_SECRET')

// ❌ avoid (untyped, not testable)
process.env.JWT_SECRET
```

The code snippets in this plan use `process.env.X` for brevity — in implementation always use `ConfigService`.

### Email Abstraction

```typescript
@Injectable()
export class EmailService {
  // Switches SMTP target based on NODE_ENV via ConfigService
  async sendOtp(to: string, code: string): Promise<void> { ... }
  async sendInvitation(to: string, role: Role, inviteUrl: string): Promise<void> { ... }
  async sendPasswordReset(to: string, resetUrl: string): Promise<void> { ... }
  // inviteUrl  = APP_URL + /auth/accept-invitation?token=xxx
  // resetUrl   = APP_URL + /auth/reset-password?token=xxx
}
```

---

## Local Dev — Docker Compose

> Replace the boilerplate's `docker-compose.yml` with this file. It keeps Postgres + Redis and adds Mailpit (email) and MinIO (file storage), which the boilerplate doesn't include.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: eastpark_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data  # persist data between restarts
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI → http://localhost:8025

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console → http://localhost:9001
    volumes:
      - minio_data:/data

  # One-shot container that creates the 'eastpark' bucket then exits
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3 &&
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb --ignore-existing local/eastpark &&
      mc anonymous set download local/eastpark
      "

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

```bash
docker compose up -d   # starts all services; minio-init auto-creates bucket then exits
```

---

## Recommended Boilerplate

**[hmake98/nestjs-starter](https://github.com/hmake98/nestjs-starter)**

Chosen after evaluating 8 NestJS starters. Closest match to our requirements out of the box.

| Feature | Status |
|---|---|
| NestJS 11 + TypeScript | Included |
| Prisma v6 + PostgreSQL | Included |
| JWT access + refresh tokens | Included |
| RBAC | Included |
| class-validator + class-transformer | Included |
| @nestjs/config | Included |
| Redis + Bull job queues | Included |
| Rate limiting (@nestjs/throttler) | Included |
| Docker + Docker Compose | Included |
| Jest + Supertest (90%+ coverage) | Included |
| Swagger/OpenAPI | Included |
| Fastify adapter | Missing — swap after clone |
| pnpm | Missing — uses Yarn, migrate after clone |
| WebSocket / Socket.io | Missing — add after clone |
| TypeScript strict mode | Not confirmed — enable after clone |
| @nestjs/schedule (Cron jobs) | Missing — add after clone |
| Supabase Storage client | Missing — add after clone |
| Expo Push SDK | Missing — add after clone |

> **Runners-up evaluated:** brocoders/nestjs-boilerplate (no Prisma), andrechristikan/ack-nestjs-boilerplate (MongoDB primary, strict mode disabled), Saluki/nestjs-template (no refresh tokens, stale), NarHakobyan/awesome-nest-boilerplate (no Prisma).

---

## Bootstrap

```bash
# ── Step 1: Clone boilerplate ────────────────────────────────────────────────
git clone https://github.com/hmake98/nestjs-starter eastpark-backend
cd apps/backend
rm -rf .git                        # detach from upstream history
git init && git add . && git commit -m "chore: init from hmake98/nestjs-starter"

# ── Step 2: Migrate Yarn → pnpm ──────────────────────────────────────────────
corepack enable
corepack prepare pnpm@latest --activate
rm yarn.lock
pnpm install                       # generates pnpm-lock.yaml

# ── Step 3: Enable TypeScript strict mode ────────────────────────────────────
# In tsconfig.json, ensure:
#   "strict": true,
#   "strictNullChecks": true,
#   "noImplicitAny": true
# Fix any type errors that surface (usually a handful of missing null checks)

# ── Step 4: Swap Express → Fastify ───────────────────────────────────────────
pnpm remove @nestjs/platform-express
pnpm add @nestjs/platform-fastify @fastify/cors @fastify/helmet
# Update src/main.ts: replace NestFactory.create() with
#   NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())

# ── Step 5: Add missing packages ─────────────────────────────────────────────
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
pnpm add @nestjs/schedule          # @Cron jobs (election auto-open)
pnpm add ioredis                   # raw Redis client for OTP cache + token blacklist
                                   # NOTE: ioredis v5+ bundles its own types — do NOT add @types/ioredis
pnpm add @supabase/supabase-js     # Supabase Storage (prod file storage)
pnpm add expo-server-sdk           # Expo Push Notifications (inline, no queues)
pnpm add nodemailer
pnpm add -D @types/nodemailer

# ── Step 6: Replace Prisma schema ────────────────────────────────────────────
# Delete the boilerplate's prisma/schema.prisma
# Paste the full schema from the "Prisma Schema" section above
npx prisma format

# ── Step 7: Start local infra and run first migration ────────────────────────
docker compose up -d
npx prisma migrate dev --name init

# ── Step 8: Seed first admin ─────────────────────────────────────────────────
pnpm seed
```

### After cloning — what to keep vs replace

| Boilerplate piece | Action |
|---|---|
| Auth module (JWT + refresh + RBAC guards) | **Keep** — adapt to our `auth/` module structure |
| Redis connection setup | **Keep** — extend for OTP cache + token blacklist (raw ioredis, not Bull queues) |
| Bull job queues | **Remove** — push notifications sent inline via Expo Push SDK, no queues needed |
| Rate limiting config | **Keep** — tighten limits to 5 req/min on `/auth/*` |
| Prisma service + module | **Keep** — replace `prisma/schema.prisma` with ours only |
| Docker Compose | **Replace entirely** — use the version in "Local Dev" section (adds Mailpit + MinIO) |
| Dockerfile | **Keep boilerplate's structure** — update CMD to: `prisma migrate deploy && node dist/main` |
| Jest + Supertest setup | **Keep** — add our own test suites on top |
| Swagger setup | **Keep** |
| AWS S3 / SES integration | **Remove** — replace with Supabase Storage (uploads) + Brevo/Mailpit (email) |
| Existing entity/module structure | **Replace** — use the module structure defined in this plan |
| Yarn lockfile | **Remove** — replaced by pnpm (Step 2) |

### package.json scripts

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:prod": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "seed": "ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

---

## Environment Variables

### `.env` (local dev)

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000   # used in invite/reset email links + WS CORS origin

# Local Docker Postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eastpark_dev

# JWT — two separate secrets for access vs refresh tokens
JWT_SECRET=local_dev_access_secret_change_me
JWT_REFRESH_SECRET=local_dev_refresh_secret_change_me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Local Docker Redis
REDIS_URL=redis://localhost:6379

# Local Mailpit SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@eastpark.local

# Local MinIO
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=eastpark
STORAGE_USE_SSL=false

# Paymob (use sandbox keys locally)
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_HMAC_SECRET=your_paymob_hmac_secret
```

### `.env.production`

```env
NODE_ENV=production
PORT=3000
APP_URL=https://eastpark.app   # your production domain

# Supabase PostgreSQL — pooler host only (db.<ref>.supabase.co is IPv6-only;
# Fly has no public IPv4 egress). Percent-encode the password.
DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:5432/postgres

# JWT — two separate secrets
JWT_SECRET=your-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Upstash Redis
REDIS_URL=rediss://default:token@xxx.upstash.io:6379

# Brevo SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=brevo-smtp-key
EMAIL_FROM=noreply@eastpark.app

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=service-role-key
SUPABASE_BUCKET=eastpark-uploads

# Expo Push
EXPO_ACCESS_TOKEN=

# Paymob
PAYMOB_API_KEY=your_live_paymob_api_key
PAYMOB_HMAC_SECRET=your_live_paymob_hmac_secret
```

---

## Fly.io Deployment

### `fly.toml`

```toml
app = "eastpark-backend"
primary_region = "cdg"  # Paris — best latency for MENA (~40-50ms from Egypt/Gulf)

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN npm i -g pnpm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
# Run pending migrations then start — safe for zero-downtime deploys on Fly.io
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

### Deploy

```bash
fly launch

# Set all required production secrets (one command)
fly secrets set \
  APP_URL="https://eastpark.app" \
  DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/eastpark?sslmode=require" \
  JWT_SECRET="your-access-secret-min-32-chars" \
  JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars" \
  JWT_ACCESS_EXPIRES="15m" \
  JWT_REFRESH_EXPIRES="7d" \
  REDIS_URL="rediss://default:token@xxx.upstash.io:6379" \
  SMTP_HOST="smtp-relay.brevo.com" \
  SMTP_PORT="587" \
  SMTP_USER="your@email.com" \
  SMTP_PASS="brevo-smtp-key" \
  EMAIL_FROM="noreply@eastpark.app" \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_SERVICE_KEY="service-role-key" \
  SUPABASE_BUCKET="eastpark-uploads" \
  EXPO_ACCESS_TOKEN="your-expo-token" \
  PAYMOB_API_KEY="your-live-paymob-api-key" \
  PAYMOB_HMAC_SECRET="your-live-paymob-hmac-secret"

fly deploy
fly logs
```

---

## Security Requirements

- JWT with access (15min) + refresh (7d) + blacklist on logout via Redis
- `@nestjs/throttler` rate limiting on all `/auth/*` endpoints (max 5 req/min)
- Input validation via `class-validator` on all DTOs — no raw request data in services
- RBAC guard + resource ownership checks (resident sees only own orders/feedback)
- Audit log: governance votes and admin actions written to DB with timestamp + userId
- OWASP Top 10 compliance — SQL injection impossible via Prisma parameterized queries
- Tokens never logged or returned in error responses

---

## REST API Endpoints

```
AUTH
  POST   /auth/register                         [public] — name+email+phone+unit+password → OTP sent
  POST   /auth/verify-otp                       [public]
  POST   /auth/resend-otp                       [public]
  POST   /auth/login                            [public]
  POST   /auth/forgot-password                  [public] — sends reset link to email
  POST   /auth/reset-password                   [public] — token + newPassword
  POST   /auth/refresh                          [public]
  POST   /auth/logout                           [authenticated]
  POST   /auth/accept-invitation                [public] — token from invite email → sets role

INVITATIONS
  POST   /invitations                           [admin] — send invite email to merchant/admin
  GET    /invitations                           [admin] — list sent invitations + status
```

### Auth Response Shapes

**POST /auth/login** — request body: `{ email: string, password: string }`
**POST /auth/verify-otp** — request body: `{ email: string, code: string }`
**POST /auth/accept-invitation** — request body: `{ token: string, name: string, password: string }`
**POST /auth/refresh** — request body: `{ refreshToken: string }`

All three above return the same shape on success:
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "clxyz123",
      "name": "Ahmed El-Said",
      "email": "ahmed@example.com",
      "role": "RESIDENT",
      "isVerified": true,
      "avatarUrl": null,
      "unitNumber": "B-204"
    }
  },
  "message": "Login successful"
}
```

**POST /auth/register** — request body: `{ name, email, phone, unitNumber, password }`
Returns: `{ "data": { "userId": "clxyz123" }, "message": "Verification OTP sent" }` (no tokens yet — user must verify OTP first)

**POST /auth/resend-otp** — request body: `{ email: string }`
Returns: `{ "data": null, "message": "OTP resent" }`

**POST /auth/forgot-password** — request body: `{ email: string }`
Returns: `{ "data": null, "message": "Reset link sent if account exists" }` (always 200, never leaks email existence)

**POST /auth/reset-password** — request body: `{ token: string, newPassword: string }`
Returns: `{ "data": null, "message": "Password reset successful" }`

**POST /auth/logout** — request body: `{ refreshToken: string }` (Bearer token in header)
Returns: `{ "data": null, "message": "Logged out" }`

```
INVITATIONS
  POST   /invitations                           [admin] — send invite email to merchant/admin
  GET    /invitations                           [admin] — list sent invitations + status

USERS
  GET    /users/me                              [resident, merchant, admin]
  PATCH  /users/me                              [resident, merchant, admin]
  DELETE /users/me                              [resident] — GDPR account deletion request
  PATCH  /users/me/push-token                   [resident, merchant, admin] — register Expo push token
  GET    /users/me/saved-shops                  [resident]
  GET    /users/me/notification-preferences     [resident, merchant, admin]
  PATCH  /users/me/notification-preferences     [resident, merchant, admin]

SHOPS
  GET    /shops?cursor=&limit=&category=&q=     [public] — cursor-paginated, searchable
  GET    /shops/:id                             [public]
  POST   /shops                                 [admin]
  PATCH  /shops/:id                             [merchant (own shop), admin]
  DELETE /shops/:id                             [admin]

SHOP PHOTOS
  GET    /shops/:shopId/photos                  [public]
  POST   /shops/:shopId/photos                  [merchant (own shop)]
  DELETE /shops/:shopId/photos/:id              [merchant (own shop), admin]

SAVED SHOPS
  POST   /shops/:shopId/save                    [resident] — add to favourites
  DELETE /shops/:shopId/save                    [resident] — remove from favourites

PRODUCTS
  GET    /shops/:shopId/products                [public] — excludes isDeleted=true
  POST   /shops/:shopId/products                [merchant]
  PATCH  /shops/:shopId/products/:id            [merchant]
  DELETE /shops/:shopId/products/:id            [merchant] — soft delete (isDeleted=true)

ORDERS
  POST   /orders                                [resident]
  GET    /orders?cursor=&status=                [resident→own | merchant→shop's]
  GET    /orders/:id                            [resident (own), merchant (shop's), admin]
  PATCH  /orders/:id/status                     [merchant, admin]
  PATCH  /orders/:id/cancel                     [resident — only if status=PLACED]
  POST   /orders/:id/pay                        [resident, auth] — initiate Paymob payment; returns paymentKey + iframeId + paymobOrderId
                                                  only callable when paymentMethod=PAYMOB and isPaid=false
                                                  returns 400 if order is already paid or cancelled
                                                  saves paymobOrderId to Order record

REVIEWS
  POST   /shops/:shopId/reviews                 [resident]
  GET    /shops/:shopId/reviews?cursor=         [public]

ANNOUNCEMENTS
  GET    /announcements?cursor=&category=       [public] — filter by AnnouncementCategory
  GET    /announcements/:id                     [public]
  POST   /announcements                         [admin]
  POST   /announcements/:id/comments            [resident]

REPORTS
  GET    /reports?cursor=                       [public]
  GET    /reports/:id                           [public]
  POST   /reports                               [admin]

POLLS
  GET    /polls?cursor=                         [public]
  GET    /polls/:id                             [public] — includes vote counts
  POST   /polls                                 [admin]
  POST   /polls/:id/vote                        [resident — @@id enforces once per poll]

ELECTIONS
  GET    /elections?cursor=                     [public]
  GET    /elections/:id                         [public] — results hidden if !resultsOpen
  POST   /elections                             [admin]
  POST   /elections/:id/candidates              [admin]
  POST   /elections/:id/vote                    [resident — @@id enforces once per election]

FEEDBACK
  POST   /feedback                              [resident]
  GET    /feedback?cursor=&status=              [resident→own | admin→all]
  GET    /feedback/:id                          [resident (own), admin]
  POST   /feedback/:id/replies                  [admin]
  PATCH  /feedback/:id/status                   [admin]

NOTIFICATIONS
  GET    /notifications?cursor=                 [resident, merchant, admin]
  PATCH  /notifications/read-all                [resident, merchant, admin] — ⚠ must be declared BEFORE /:id in controller
  PATCH  /notifications/:id/read                [resident, merchant, admin]

UPLOADS
  POST   /uploads/image                         [resident, merchant, admin]
  POST   /uploads/pdf                           [admin]

WEBHOOKS
  POST   /webhooks/paymob                       [public — HMAC signature verified internally]

WEBSOCKET  ws://host/orders
  Client joins room: order:{orderId}
  Server emits:      status_update { orderId, status }
```

### Cursor Pagination Convention

All list endpoints that return multiple records use cursor-based pagination:

```
Request:  GET /shops?cursor=clxyz123&limit=20
Response: {
  data: [...],
  nextCursor: "clxyz456" | null   ← null means no more pages
}
```

The cursor is the `id` (cuid) of the last item in the current page. Backend uses:

```typescript
prisma.shop.findMany({
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
  orderBy: { createdAt: 'desc' },
})
// if result.length > limit → slice last item, set nextCursor = last item id
```

---

## Delivery Milestones

1. **Foundation** — Clone hmake98/nestjs-starter → migrate to pnpm → swap Express→Fastify → replace schema → Docker Compose + first migration + seed
2. **Auth & Invitations** — register → OTP → login → JWT → logout → invite flow (merchant/admin)
3. **Core APIs** — shops + photo gallery, products (soft delete), orders (REST + WebSocket)
4. **Community** — announcements (with category enum), reports, comments, feedback + reply thread
5. **Governance** — polls + elections, one-vote guarantee, @Cron election auto-open
6. **Payments** — Paymob webhook (`POST /webhooks/paymob`), HMAC verification, order mark-paid
7. **Notifications** — Expo Push inline + in-app notification feed
8. **Hardening** — unit + e2e tests, Swagger docs, Fly.io deploy (cdg), security audit

---

## Verification Checklist

**Foundation**
- [ ] `docker compose up -d` starts Postgres, Redis, Mailpit, MinIO cleanly
- [ ] `npx prisma migrate dev` runs with no errors
- [ ] `npx prisma db seed` creates admin@eastpark.local

**Auth & Invitations**
- [ ] `POST /auth/register` → OTP email visible in Mailpit UI (localhost:8025)
- [ ] `POST /auth/verify-otp` with correct code returns `accessToken` + `refreshToken`
- [ ] `POST /auth/resend-otp` delivers a new OTP, old one is invalidated
- [ ] `POST /auth/forgot-password` → reset email visible in Mailpit
- [ ] `POST /auth/reset-password` with valid token updates password, old token rejected after use
- [ ] `POST /invitations` [admin] → invite email visible in Mailpit
- [ ] `POST /auth/accept-invitation` with valid token creates user with correct role
- [ ] Expired invite token returns 400
- [ ] Used invite token returns 400 on second use

**Role Guards**
- [ ] `GET /shops` returns 200 with no auth header
- [ ] `POST /orders` with no token returns 401
- [ ] `PATCH /orders/:id/status` with resident token returns 403
- [ ] `POST /invitations` with merchant token returns 403

**Ordering & Real-time**
- [ ] WebSocket: unauthenticated connection is rejected (client.disconnect called)
- [ ] WebSocket: authenticated client joins `order:{id}`, receives `status_update` on merchant PATCH
- [ ] `PATCH /orders/:id/cancel` while PLACED returns 200, sets cancelledAt
- [ ] `PATCH /orders/:id/cancel` while CONFIRMED returns 409
- [ ] `POST /orders` with product from wrong shop returns 400
- [ ] `totalAmount` in order response matches server-computed value, not client payload
- [ ] Soft-deleted product does not appear in `GET /shops/:shopId/products`
- [ ] OrderItem FK is intact after product soft-delete
- [ ] OrderItem `productNameSnapshot` matches product name at time of order (even after name change)

**Governance**
- [ ] `POST /polls/:id/vote` twice with same user returns 409
- [ ] `POST /elections/:id/vote` twice with same user returns 409
- [ ] Election with past `expiresAt` has `resultsOpen=true` after next cron tick (≤5 min)

**Security**
- [ ] Auth endpoint hit 6 times/min → 429 Too Many Requests
- [ ] OTP Redis key expires after 10 minutes
- [ ] Logout → blacklisted refresh token returns 401 on reuse
- [ ] `POST /webhooks/paymob` with wrong HMAC returns 401

**Users & Preferences**
- [ ] `POST /shops/:shopId/save` adds to saved shops, `DELETE` removes it
- [ ] `GET /users/me/saved-shops` returns saved shop list
- [ ] `PATCH /users/me/push-token` updates pushToken on User
- [ ] `PATCH /users/me/notification-preferences` toggles a notification type off
- [ ] Disabled notification type is not sent via Expo Push
- [ ] Anonymous feedback: `GET /feedback/:id` [admin] returns `author: null` (userId stripped)
- [ ] AuditLog row created after admin sends invitation, creates poll, changes order status

**Uploads & Pagination**
- [ ] Image upload > 5MB returns 413
- [ ] Non-image file upload to `/uploads/image` returns 400
- [ ] File upload returns Supabase Storage URL
- [ ] `GET /shops?limit=5` returns 5 items + `nextCursor`
- [ ] `GET /shops?cursor=<nextCursor>&limit=5` returns next 5 items

**Deployment**
- [ ] `fly deploy` succeeds, `fly status` shows 0 restarts
