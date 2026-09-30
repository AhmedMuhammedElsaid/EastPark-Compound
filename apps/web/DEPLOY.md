# Deploying `eastpark-web-app` to Vercel

Production was deployed and verified on 2026-09-30:

- Web: `https://eastpark-web-app.vercel.app`
- API: `https://eastpark-backend.fly.dev`
- Health: HTTP 200 with Prisma `up`
- Lead creation: HTTP 200 and database insert verified
- CORS preflight from the Vercel origin: HTTP 204

Default shell Node is v12.22.9 and cannot run any of this. Start every terminal with:

```bash
. ~/.nvm/nvm.sh && nvm use 24
```

---

## 0. Before you deploy

Confirm the build is green locally:

```bash
cd /mnt/c/Unite/EastPark-App/apps/web
pnpm build && pnpm lint && pnpm exec tsc --noEmit
```

> Builds on the `/mnt/c` mount are slow (the first `pnpm install` took ~35 minutes).
> This is a WSL/Windows filesystem issue, not a project problem — Vercel's own build
> runs on Linux and will be much faster.

---

## 1. Push the repo to GitHub

`eastpark-web-app` is its own git repo, matching the `eastpark-frontend` /
`eastpark-backend` convention. Confirm the remote with `git remote -v` after cloning.

```bash
cd /mnt/c/Unite/EastPark-App/apps/web
gh repo create eastpark-web-app --private --source=. --remote=origin --push
```

Or manually, if you'd rather create the repo in the GitHub UI first:

```bash
git remote add origin git@github.com:<you>/eastpark-web-app.git
git push -u origin main
```

---

## 2. Install the Vercel CLI

```bash
pnpm add -g vercel
vercel --version
```

Then authenticate (opens a browser):

```bash
vercel login
```

---

## 3. Link and deploy

From inside `apps/web/`:

```bash
vercel link          # first time only — creates .vercel/
vercel               # preview deployment
vercel --prod        # production deployment
```

Vercel auto-detects Next.js. You should not need to set a build command, output
directory, or install command. If it asks: build `pnpm build`, install `pnpm install`,
framework `Next.js`.

**Alternative (recommended for ongoing work):** import the GitHub repo at
<https://vercel.com/new> instead. You then get automatic deploys on every push and a
preview URL per branch, with no CLI needed after setup.

---

## 4. Environment variables

Set in the Vercel dashboard under **Project → Settings → Environment Variables**, or
via CLI. Apply to **Production**, **Preview**, and **Development**.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://eastpark-backend.fly.dev` | **No trailing slash, no `/v1`** — the client appends `/v1/residents/leads` itself |

```bash
vercel env add NEXT_PUBLIC_API_URL production
# paste: https://eastpark-backend.fly.dev
```

That is the only variable the web app needs today.

⚠️ `NEXT_PUBLIC_*` variables are **inlined into the browser bundle** and are public by
definition. Never put a secret behind that prefix. If the web app later needs a real
secret, give it a name without `NEXT_PUBLIC_` and read it only in a server component
or route handler.

⚠️ `NEXT_PUBLIC_*` values are baked in **at build time**, not read at runtime. Changing
this variable requires a **redeploy** to take effect — editing it in the dashboard
alone does nothing to the already-built bundle.

---

## 5. Backend CORS — required, or the form will fail in production

The backend must allow the Vercel domain or every submission will fail with a CORS
error in the browser (and the resident will see the generic server error).

`APP_CORS_ORIGINS` is a comma-separated list; the backend splits and trims it, so
extending it needs no code change. From `apps/backend/`:

```bash
fly secrets set APP_CORS_ORIGINS="https://eastpark-web-app.vercel.app,https://<your-custom-domain>"
```

Include **every** domain that will serve the form:
- the production domain (`*.vercel.app` or your custom domain)
- any custom domain you attach later
- preview domains, if you want to test the real endpoint from a preview build —
  note Vercel preview URLs are generated per deployment, so a static list will not
  cover them all. Test previews against a local backend instead.

This ties into the backend session's CORS work — `APP_ENV` must also be set in
`fly.toml`, otherwise `APP_CORS_ORIGINS` defaults to `*` with `credentials: true`,
which is both insecure and unreliable.

---

## 6. The form endpoint

The form posts to:

```
POST ${NEXT_PUBLIC_API_URL}/v1/residents/leads
```

This endpoint is deployed and was verified end to end on 2026-09-30. Re-run the check
after backend, schema, CORS, or form-contract changes.

Verify once the backend is deployed:

```bash
curl -i -X POST https://eastpark-backend.fly.dev/v1/residents/leads \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","phone":"01000000000","building":"A2","floor":"G","flatNumber":"3"}'
```

A 2xx means the form is live end to end. Docker image build and `prisma migrate deploy`
have both run successfully on Fly against Supabase. If this check regresses, inspect
Fly health/logs, migration state, and CORS before changing the form.

---

## 7. Post-deploy checklist

- [ ] Landing page renders in Arabic RTL (default) and English LTR
- [ ] Dark mode is the default; the light toggle works and persists across reloads
- [ ] Submit a real registration and confirm the row lands in the database
- [ ] Submit the *same* unit twice — should succeed both times (the backend dedupes
      and updates rather than erroring)
- [ ] Ground floor appears for a phase 2/3 building (A2, D1) and **not** for a
      phase 1/4 building (A1, D2)
- [ ] Pick "G" for A2, then switch the building to A1 — the floor must clear itself
- [ ] Lighthouse accessibility ≥ 90 (run against the deployed URL, both languages)
- [ ] Keyboard-only pass through the whole form, including the floor combobox
- [ ] Update the compound building list in `src/config/compound.ts` if the layout
      changes — one file, no migration, no backend change

---

## Custom domain (optional)

**Project → Settings → Domains** in the Vercel dashboard. After adding it, remember to
add the new domain to `APP_CORS_ORIGINS` (step 5) and redeploy the backend.
