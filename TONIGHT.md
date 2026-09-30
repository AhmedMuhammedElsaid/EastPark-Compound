# Ship the web form — tonight

Live checklist for the 2026-09-30 session. Ordered; Fly first, then Vercel.
Everything marked **YOU** needs a browser or a dashboard value I cannot reach.

---

## Already done (verified by execution tonight)

| | Check | Result |
|---|---|---|
| ✅ | `pnpm typecheck` (backend) | exit 0 |
| ✅ | `pnpm test` (backend) | exit 0 |
| ✅ | `prisma validate` | valid |
| ✅ | `pnpm install --frozen-lockfile` | exit 0 — lockfile in sync, so the Docker build won't fail on it |
| ✅ | `prisma` is a **runtime** dep (6.19.0) | `migrate deploy` will have a binary in the prod image |
| ✅ | `pnpm build` (web app) | 4 static routes, tsc clean |
| ✅ | `flyctl` v0.4.110 | installed at `~/.fly/bin/flyctl` |
| ✅ | Vercel CLI 61.0.0 | installed at `~/.local/share/pnpm/vercel` |
| ✅ | `resident_leads` migration exists | `20260929000000_resident_lead_indexes_phone` |
| ✅ | Form path is DB-only | `residents.service.ts` imports only `DatabaseService` + `InvitationsService` |
| ✅ | Unreachable Redis does **not** crash boot | reproduced with ioredis: retries forever, logs noisily, process survives |
| ✅ | `SMTP_HOST` + `SUPABASE_URL` in `fly.toml` | commit `e4bb326` |
| ✅ | `directUrl` in `schema.prisma` | commit `e4bb326` |
| ✅ | Postgres moved Neon → Supabase | commit `d2edc26` / `c19bef8` — see WHATLEFT B2 for why |

**Local Docker daemon is stopped.** Not a blocker: `fly deploy --remote-only` builds on
Fly's builders. Don't start Docker Desktop just for this.

---

## Every terminal, first line

```bash
. ~/.nvm/nvm.sh && nvm use 24
export PATH="$HOME/.fly/bin:$HOME/.local/share/pnpm:$PATH"
```

Default shell Node is v12.22.9 and cannot run any of the tooling.

---

## 1. YOU — Fly login

```bash
flyctl auth login
```

Opens a browser. Then tell me, and I take over from step 2.

---

## 2. YOU — three values from the Supabase dashboard

**Dashboard → Connect** (top bar). Copy the two URIs — they differ only in the port:

| Need | Where | Shape |
|---|---|---|
| Transaction pooler | Connect → Transaction pooler | `...pooler.supabase.com:6543/postgres` |
| Session pooler | Connect → Session pooler | `...pooler.supabase.com:5432/postgres` |
| Secret API key | Settings → API Keys | starts **`sb_secret_`** |

> ### ⚠️ Three traps — every one of them fails *silently*
>
> 1. **Never `db.<ref>.supabase.co`.** Verified by DNS: 0 A records, 3 AAAA — IPv6-only.
>    Fly VMs have no public IPv4 egress, so it is simply unreachable. Use the pooler host.
> 2. **Percent-encode the password.** Verified with `new URL()`: a password containing
>    `#` and `@` throws `Invalid URL`, and subtler mixes parse to the **wrong host** with
>    no error at all. `#`→`%23` `@`→`%40` `:`→`%3A` `/`→`%2F`
> 3. **Username is `postgres.<project-ref>`**, not `postgres`.
>
> The dashboard's copy button already handles 1 and 3. It does **not** encode your password
> — it emits `[YOUR-PASSWORD]` as a placeholder for you to substitute.

**Not** the `sb_publishable_` key — that is the browser-side anon replacement and is
useless to the backend. `SUPABASE_SERVICE_KEY` must be the secret one; it writes to Storage.

---

## 3. ME — set secrets and deploy

```bash
cd apps/backend
flyctl secrets set \
  DATABASE_URL='<transaction pooler :6543>?pgbouncer=true&connection_limit=1' \
  DIRECT_DATABASE_URL='<session pooler :5432>' \
  AUTH_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" \
  AUTH_REFRESH_TOKEN_SECRET="$(openssl rand -base64 48)" \
  SUPABASE_SERVICE_KEY='sb_secret_...' \
  SMTP_USER='bbc337001@smtp-brevo.com' \
  SMTP_PASS='<brevo key>'

flyctl deploy --remote-only
```

Single quotes matter — an unquoted `#` truncates the value at the shell.

`REDIS_URL` is deliberately omitted: it defaults to `redis://localhost:6379`, which the
form never touches. It only logs connection errors. Add Upstash before shipping auth.

The Dockerfile CMD runs `prisma migrate deploy` before the server starts, so the
`resident_leads` table is created by the deploy itself.

---

## 4. ME — prove the backend works before anyone sees the site

```bash
curl -i https://eastpark-backend.fly.dev/health      # NOT /v1/health — VERSION_NEUTRAL

curl -i -X POST https://eastpark-backend.fly.dev/v1/residents/leads \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","phone":"01000000000","building":"A2","floor":"G","flatNumber":"3"}'
```

Reading a failure:

| Response | Means |
|---|---|
| **404** | The residents module didn't ship |
| **500** | Almost always `resident_leads` missing → `migrate deploy` failed. Check `flyctl logs` |
| **health fails, grace 30s** | Migration is still running, or the DB is unreachable — trap 1 or 2 above |

---

## 5. YOU — Vercel login

```bash
vercel login
```

---

## 6. ME — deploy the web app

```bash
cd apps/web
vercel link
vercel env add NEXT_PUBLIC_API_URL production   # https://eastpark-backend.fly.dev
vercel --prod
```

No trailing slash, no `/v1` — the client appends `/v1/residents/leads` itself.
`NEXT_PUBLIC_*` is inlined **at build time**: changing it later needs a redeploy.

---

## 7. ME — CORS, once the real domain exists

`fly.toml` currently guesses `https://eastpark-web-app.vercel.app`. If Vercel hands
back anything else, the form fails in the browser with a CORS error while curl still
works — a confusing pair of symptoms.

```bash
flyctl secrets set APP_CORS_ORIGINS="https://<real-domain>"
```

---

## 8. Both — post-deploy

- [ ] Submit a real registration from the live site; confirm the row lands
- [ ] Submit the **same unit twice** — both must succeed (backend dedupes and updates)
- [ ] Ground floor shows for A2/D1 (phases 2+3), hidden for A1/D2
- [ ] Pick "G" for A2, switch to A1 — the floor must clear itself
- [ ] Arabic RTL default, English LTR toggle
- [ ] Dark default; light toggle persists across reload

---

## Deliberately NOT tonight

`B0` Paymob amount verification and `B1` Float→Decimal are both P0 — but the form takes
no payments, so neither blocks it.

> **`B1` has a clock on it.** Float→Decimal is lossless *only* while no real fractional
> order exists. The form creates no orders, so tonight doesn't start that clock — but do
> it **before** enabling ordering, not after. After is a data migration with rounding risk.

Also waiting: Upstash Redis, `EMAIL_FROM` sender verification, and rotating the Brevo key
(it sat in plaintext in `.env`).
