# EastPark Web App — Application Context

Read this file at the start of every AI-assisted session in this repository. It is intentionally self-contained so a standalone clone does not depend on the parent `EastPark-App` workspace.

## Purpose

`eastpark-web-app` is EastPark's bilingual Next.js application. Its deployed release is the public
resident lead-capture site; locally it is expanding into the browser counterpart of the completed
mobile app without removing or weakening the public registration path.

- Arabic is the default language and RTL is the primary layout.
- English is switchable and LTR.
- Dark mode is the flagship/default experience.
- The form preserves entered values when submission fails.
- Mobile is the behavioral reference for parity work; backend contracts are authoritative.
- Public pages are SEO-first. Auth, account, and confirmation routes must be `noindex`.

## Release Checkpoint — 2026-09-30

- Same-origin BFF routes proxy lead and auth requests to Fly.
- Access/refresh tokens stay in `HttpOnly`, production `Secure`, `SameSite=Strict` cookies.
- Login, registration, OTP verification, thank-you, error, and not-found routes are implemented.
- Lead proxy validates shared Zod input, retries one transport failure, and preserves expected
  upstream 400/409/422/429 responses.
- A backend 409 means the selected building/floor/flat already has a non-rejected lead; the form
  shows the bilingual reserved-unit message and keeps the entered values.
- Header, footer, hero, logo treatments, dark/light themes, and RTL/LTR behavior were redesigned.
- Login uses the shared footer. Login and unit-registration pages keep explicit bottom spacing
  between page content and the footer.
- SEO/security includes canonical metadata, JSON-LD creator data, robots, sitemap, manifest,
  Open Graph/X images, route-level indexing policy, CSP, and hardened response headers.
- Share description: `Commerce, services, and community in one trusted place. Built By Ahmed
  Muhammed Elsaid.`
- The checkpoint is validated for standalone installation and is ready for production deployment.

## Local Parity Work — 2026-09-30

- `/announcements` mirrors the first public community slice from mobile with Arabic/English fields,
  category filters, responsive resident-shell navigation, accessible empty/error/loading states,
  PDF links, and cursor-based loading.
- `/api/announcements` keeps browser traffic same-origin. Server responses are runtime-validated
  against the backend DTO, and one transport retry covers a sleeping Fly instance.
- `/announcements/[id]` renders bilingual long-form announcement content, category/date metadata,
  PDF links, and read-only comments. Feed titles link to the detail route.
- `/api/announcements/[id]` is the same-origin detail proxy. It validates embedded comment authors
  and timestamps, preserves upstream 404 responses, and converts other upstream failures to 502.
- The authoritative backend detail response embeds all comments. There is no
  `GET /announcements/:id/comments`; the mobile client's paginated comments call is stale and must
  not be copied to web. Comment creation remains authenticated and is outside this public slice.
- The backend contract has no `isPinned` field, so web does not reproduce the mobile client's stale
  pinned-announcement type.
- The slice passes lint, strict TypeScript, and production build. Arabic/English desktop (1440px)
  and mobile (390px) layouts were browser-verified with a local contract fixture, including RTL/LTR,
  PDF links, comments, 44px actions, fixed-navigation clearance, 404 propagation, and no horizontal
  overflow. The slice remains undeployed.

## Production

| Service | URL | Status verified 2026-09-30 |
|---|---|---|
| Web | `https://eastpark-web-app.vercel.app` | Deployed on Vercel |
| API | `https://eastpark-backend.fly.dev` | Deployed on Fly.io (`cdg`) |
| Health | `https://eastpark-backend.fly.dev/health` | HTTP 200; Prisma `up` |
| Lead endpoint | `POST https://eastpark-backend.fly.dev/v1/residents/leads` | HTTP 200 and database insert verified |

Production CORS was verified from `https://eastpark-web-app.vercel.app` with an HTTP 204 preflight and the matching `Access-Control-Allow-Origin` header.

## Stack

- Next.js 16.3.7 with App Router
- React 19.2.8
- TypeScript strict
- Tailwind CSS 4
- pnpm 10.33.0
- Vercel hosting
- Alexandria for bilingual functional UI and Arabic
- Cormorant Garamond for English display text only

Next.js 16 differs from older Next.js versions. Before changing framework behavior, read the relevant local guide in `node_modules/next/dist/docs/` and follow `AGENTS.md`.

## Local Setup

```bash
pnpm install
pnpm dev
```

Local URL: `http://localhost:3000`.

Validation before committing:

```bash
pnpm check
```

## Environment

The only required browser environment variable is:

```dotenv
NEXT_PUBLIC_API_URL=https://eastpark-backend.fly.dev
```

Rules:

- Do not include a trailing slash or `/v1`.
- `NEXT_PUBLIC_*` values are public and inlined at build time.
- Never place credentials in a `NEXT_PUBLIC_*` variable.
- Changing the value requires a redeploy.
- `.env*` and `.vercel/` are ignored and must stay untracked.

## Lead Form Contract

The browser sends to the same origin:

```http
POST /api/resident-leads
Content-Type: application/json
```

The Next route validates the payload and forwards it to
`${NEXT_PUBLIC_API_URL}/v1/residents/leads`. Browser components must not call Fly directly.

Payload fields:

```json
{
  "name": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "phone": "01000000000",
  "building": "A2",
  "floor": "G",
  "flatNumber": "3",
  "parking": "B-12"
}
```

`parking` is optional. Egyptian mobile numbers are accepted in local `01xxxxxxxxx` or international `+201xxxxxxxxx` form. Floor is `G` or `1` through `11`; flat number is `1` through `5`.

A successful new reservation returns HTTP 200. If the unit already has a non-`REJECTED` lead, the
backend returns HTTP 409. The BFF must preserve that status so the client can show
`register.submit_error.duplicate`; it must not turn the conflict into a generic server error.

The canonical building list and phase rules live in `src/config/compound.ts`. Do not duplicate them in components.

## Key Files

| Path | Responsibility |
|---|---|
| `src/app/page.tsx` | Landing-page section order |
| `src/app/layout.tsx` | Fonts, metadata, JSON-LD, and providers |
| `src/app/api/resident-leads/route.ts` | Validated, retrying lead BFF proxy |
| `src/app/api/auth/` | Same-origin authentication BFF routes |
| `src/app/api/announcements/` | Runtime-validated announcement feed/detail BFF routes |
| `src/app/(resident)/announcements/` | Public announcement feed and detail pages |
| `src/components/form/RegisterUnitForm.tsx` | Lead form UX and submission |
| `src/lib/auth/` | Cookie-backed web session and auth provider |
| `src/config/compound.ts` | Buildings, phases, floor rules |
| `src/lib/i18n/` | Arabic/English direction and translations |
| `src/translations/ar.json` | Arabic copy |
| `src/translations/en.json` | English copy |
| `DEPLOY.md` | Vercel and backend deployment runbook |
| `AGENTS.md` | Next.js-specific agent rule generated by Next |

## Design Rules

- Prestige, civic, warm.
- Gold `#b8966a` is reserved for primary interaction, not decoration.
- Warm dark surfaces; no pure black/white or cold gray palette.
- Alexandria for all Arabic and functional UI.
- RTL must be validated before considering English complete.
- WCAG AA; touch targets at least 44px.
- Do not expose internal implementation instructions in the visible UI.

## Repository and Deployment Workflow

This directory remains an independently installable Git repository and does not consume the parent
workspace's deferred `packages/shared` experiment. Preserve all Git histories; do not move
directories or collapse repositories without explicit approval.

Vercel project: `eastpark-web-app`.

After changing production code:

1. Run build, lint, and TypeScript checks.
2. Commit using `[AhmedMuhammedElsaid][type]: description`.
3. Push `main` to GitHub once the remote is configured.
4. Redeploy production when environment or production behavior changes.
5. Verify health, CORS, and one real form submission.

## Security and Remaining Operations

- Credentials exposed during the initial deployment must be rotated: Fly token, Supabase keys/database password, and Brevo SMTP key.
- Do not commit `.env.local`, `.vercel/`, tokens, passwords, or copied terminal output containing secrets.
- The backend currently has a temporary Paymob HMAC value only to allow startup. Real Paymob credentials are required before enabling card payments; this does not block the resident lead form.
- Mobile store deployment is a separate project and is not implied by this website being live.
