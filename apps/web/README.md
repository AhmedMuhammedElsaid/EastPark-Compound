# EastPark Web App

Public bilingual resident registration site for EastPark compound. Arabic/RTL and dark mode are the
defaults; English/LTR and light mode are switchable.

Production: <https://eastpark-web-app.vercel.app>

## Setup

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

Create `.env.local` for local API access:

```dotenv
NEXT_PUBLIC_API_URL=https://eastpark-backend.fly.dev
```

Do not append `/v1`; the client adds `/v1/residents/leads`.

## Validate

```bash
pnpm build
pnpm lint
pnpm exec tsc --noEmit
```

## Context

- `APPCONTEXT.md` — canonical architecture, production, form contract, and design context
- `CLAUDE.md` — current AI session state
- `AGENTS.md` — Next.js 16 agent rules
- `DEPLOY.md` — deployment and verification runbook

Never commit `.env*`, `.vercel/`, API tokens, database credentials, or SMTP credentials.
