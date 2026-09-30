# EastPark Frontend — How to Run

> **EastPark** is a residential compound super-app for the MENA region.
> This document covers the **Expo 54 React Native** frontend only.
> For the backend setup, see `../../backend/Documentation/HOWTORUN.md`.
> For full-stack local dev, run both simultaneously.

---

## What This App Does

- **Local Marketplace** — browse compound shops, add to cart, place orders, track delivery in real-time
- **Community Governance** — announcements, PDF reports, polls, elections, resident feedback
- **Merchant Tools** — merchant dashboard, menu management, order fulfillment
- **Admin Tools** — create announcements, polls, elections, invite merchants/admins

Primary language: **Arabic (RTL)**. Secondary: **English (LTR)**. Switchable in-app.

---

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@latest` — enforced, npm/yarn rejected |
| Expo Go | Latest | iOS App Store / Google Play — for quick UI preview only |
| EAS CLI | Latest | `npm install -g eas-cli` — only needed for cloud/native builds |
| Android Studio | Latest | Android emulator |
| Xcode | Latest (macOS only) | iOS simulator |

> **Windows developers:** All Windows-specific pnpm path issues are auto-fixed by a `postinstall` hook. No extra steps required.

---

## Step 1 — Install dependencies

```bash
cd apps/mobile
pnpm install
```

> pnpm is enforced via a `preinstall` hook (`npx only-allow pnpm`). Running `npm install` or `yarn` will fail immediately.

---

## Step 2 — Configure environment

The repo ships with an example env template:

- **`.env.example`** — committed template showing all required keys with safe placeholder values. **Never contains real secrets.**
- **`.env.local`** — your local developer override. **Not committed.** Takes precedence and is where your real values live.

Copy the template and fill in your values:

```bash
cp .env.example .env.local
# Then edit .env.local with your machine-specific values
```

Example `.env.local`:

```bash
# .env.local
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3000    # do NOT add /v1 — the Axios client appends it automatically
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_POSTHOG_KEY=                    # optional — leave blank for dev
SECRET_KEY=my-secret-key                    # build-time only — not accessible in client code
APP_BUILD_ONLY_VAR=build-only-value         # build-time only
```

> **Security:** `.env.local` is git-ignored. Never commit real secrets to any tracked file.

> All bundle IDs, URL schemes, and package names are derived automatically from `EXPO_PUBLIC_APP_ENV`. You do not set them manually.

| `EXPO_PUBLIC_APP_ENV` | Bundle ID | URL Scheme |
|---|---|---|
| `development` | `com.eastpark.app.development` | `eastpark` |
| `preview` | `com.eastpark.app.preview` | `eastpark.preview` |
| `production` | `com.eastpark.app` | `eastpark` |

> After changing any env var, restart Metro with cache clear: `pnpm start -- -c`

---

## Step 3 — Start the backend

The frontend requires a running backend. In a separate terminal:

```bash
cd ../eastpark-backend
pnpm dev:setup    # Docker → migrate → seed → API server on :3000
```

See `../../backend/Documentation/HOWTORUN.md` for full backend setup.

---

## Step 4 — Run the app

### Option A — Expo Go (quick UI preview, limited features)

```bash
pnpm start
```

Scan the QR code with **Expo Go** (iOS App Store / Google Play).

> Expo Go does **not** support: push notifications, `expo-secure-store`, custom URL schemes, or deep links. Use a dev client for full functionality.

### Option B — iOS simulator (full native features)

```bash
pnpm ios
```

Builds and installs a dev client on the iOS simulator, then starts Metro.

### Option C — Android emulator (full native features)

```bash
pnpm android
```

> **Android emulator note:** Android cannot reach `localhost` of your host machine. Use `10.0.2.2` instead in `.env.local`:
> ```
> EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
> EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:3000
> ```

### Option D — Physical device (cloud dev client via EAS)

First-time only — initialize EAS:
```bash
eas login          # create a free account at expo.dev
eas init           # generates EAS_PROJECT_ID — paste into app.config.ts line 10
```

Then build and install the dev client:
```bash
pnpm build:development:ios       # iOS .ipa → install via TestFlight or Xcode
pnpm build:development:android   # Android .apk → install directly on device
```

Then start Metro:
```bash
pnpm start
```

> **Physical device note:** Use your machine's LAN IP (e.g. `192.168.x.x`) in `.env.local` so the device can reach the backend over Wi-Fi.

---

## Test Accounts

| Role | How to obtain |
|---|---|
| **Admin** | Seeded by `pnpm seed` → `admin@eastpark.local` / `Admin@123456` |
| **Resident** | Register via app → email + unit number + password → verify OTP (check Mailpit at `http://localhost:8025`) |
| **Merchant** | Admin sends email invite via API → accept link from Mailpit → set name + password |
| **Guest** | No login — read-only access to directory and announcements |

---

## All Commands

```bash
pnpm start                      # Start Metro dev server
pnpm start -- -c                # Start Metro with cache cleared (after env changes)
pnpm ios                        # Build + run on iOS simulator
pnpm android                    # Build + run on Android emulator
pnpm start:preview              # Metro with preview environment
pnpm lint                       # ESLint
pnpm lint:fix                   # ESLint with auto-fix
pnpm type-check                 # TypeScript check (no emit)
pnpm test                       # Jest unit tests
pnpm test:watch                 # Tests in watch mode
pnpm check-all                  # lint + type-check + i18n lint + tests
pnpm doctor                     # expo-doctor codebase health check

# EAS cloud builds
pnpm build:development:ios      # Dev client — iOS
pnpm build:development:android  # Dev client — Android
pnpm build:preview:ios          # Preview build — iOS
pnpm build:preview:android      # Preview .apk — Android (for testers)
pnpm build:production:ios       # Production .ipa — App Store
pnpm build:production:android   # Production .aab — Google Play
```

---

## Navigation Map

```
app/
├── (tabs)/
│   ├── index                   Home Feed
│   ├── directory/              Shop list → shop detail + reviews → menu browser
│   ├── orders/                 [auth] Order history → real-time order detail (Socket.io)
│   ├── community/              Announcements → governance (polls/elections) → feedback
│   └── profile/                [auth] User profile / Guest CTA
├── notifications/              [auth] In-app notification feed
├── (auth)/                     login · register · verify-otp · forgot-password
│                               reset-password · accept-invitation
├── (admin)/                    [admin] Create announcements · polls · elections
├── (merchant)/                 [merchant] Dashboard · menu CRUD · order management
└── checkout/                   cart → address → payment (COD / Paymob) → confirmation (Lottie)
```

---

## Before Going to Production

### 1 — EAS project ID (required for push notifications)

```bash
cd apps/mobile
eas login
eas init
```

After `eas init`, open `app.config.ts` line 10 and paste the generated project ID:

```ts
const EAS_PROJECT_ID = 'paste-your-project-id-here'; // was: ''
```

Without this, push notifications silently fail in all non-Expo-Go builds.

### 2 — Production API URL

In your EAS build environment or `.env.production`:

```
EXPO_PUBLIC_API_URL=https://eastpark-backend.fly.dev
EXPO_PUBLIC_SOCKET_URL=https://eastpark-backend.fly.dev
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `only-allow` error on `npm install` | Use `pnpm install` — npm/yarn are blocked |
| Native module crash in Expo Go | Build a dev client: `pnpm ios` or `pnpm android` |
| Android cannot reach API | Use `10.0.2.2` instead of `localhost` in `.env.local` |
| Physical device cannot reach API | Use your LAN IP (e.g. `192.168.1.x`) in `.env.local` |
| `EAS_PROJECT_ID is empty` | Run `eas init` → paste ID into `app.config.ts` |
| Push notifications not arriving | Check `EAS_PROJECT_ID` in `app.config.ts`; must be non-empty |
| Metro bundle error after env change | `pnpm start -- -c` to clear Metro cache |
| Type errors on `pnpm type-check` | Run `pnpm lint:fix` first; some are auto-fixable |
| Fonts not loading | Fonts are embedded at build time via `expo-font` plugin in `app.config.ts` |
| OTP not received | Check Mailpit at `http://localhost:8025` — all emails are captured there |

---

## Running Both Services Together

When developing end-to-end, run the backend and frontend simultaneously.

### Terminal 1 — Backend
```bash
cd /mnt/c/Unite/EastPark-App/apps/backend
cp .env.example .env         # first time only
pnpm dev:setup               # Docker + migrate + seed + dev server in one command
# or manually: docker compose up -d && pnpm prisma:migrate && pnpm seed && pnpm dev
```

### Terminal 2 — Frontend
```bash
cd /mnt/c/Unite/EastPark-App/apps/mobile
# Ensure EXPO_PUBLIC_API_URL=http://localhost:3000 in .env.local (no /v1)
pnpm start                   # Expo dev server
# Press i (iOS simulator) or a (Android emulator) or scan QR with Expo Go
```

### Key Integration Points
- Backend must be running before frontend API calls work
- Swagger docs: http://localhost:3000/docs
- Mailpit (email preview): http://localhost:8025
- MinIO (file storage): http://localhost:9001 (minioadmin/minioadmin)
- For Paymob testing: use sandbox credentials in backend .env

### Environment Alignment
- `EXPO_PUBLIC_API_URL` must NOT include `/v1` — the Axios client appends it automatically (`baseURL: \`${EXPO_PUBLIC_API_URL}/v1\``)
- `EXPO_PUBLIC_SOCKET_URL` points to backend root (no `/v1`) — Socket.io mounts at `/orders`
- Set `EAS_PROJECT_ID` in `app.config.ts` via `eas init` before building with EAS
