# Post-deploy smoke tests

Zero-dependency Node (>= 20) checks against a live EastPark deployment (production by default).

```sh
node scripts/smoke/run.mjs                 # default read-only suite (~75 s)
pnpm smoke                                 # same, from the repo root
node scripts/smoke/run.mjs --with-writes   # + image uploads and Supabase cleanup
node scripts/smoke/run.mjs --only=auth,roles
node scripts/smoke/run.mjs --only=throttle # opt-in, see below
```

Each check prints `PASS|FAIL|SKIP  <name>  <detail>`, followed by a summary. The exit code is 1 when any check fails.
Output holds statuses, counts, hosts and paths only. It never prints passwords, tokens, cookies, emails or env values.

## Groups

| Group      | Default | What it checks |
| ---------- | ------- | -------------- |
| `health`   | always  | `GET /health` returns 200. It allows 60 s and one retry for a Render cold start, and also warms the API for the other groups. |
| `pages`    | yes     | As a guest, `/`, `/login`, `/register-unit`, `/home`, `/announcements` and `/profile` return 200 with no not-found or error page. `/admin` and `/merchant` return 307 to `/login?next=…`. An unknown route renders the not-found page. |
| `auth`     | yes     | Backend login with an unknown email returns 401. Merchant login returns 200. Refresh returns 200, and reusing the old refresh token returns 401. Web BFF login returns 200 and sets 2 cookies. `/api/auth/session` shows a user (only the role is printed). At the end of the run, web logout clears the cookies and the session reads as null. |
| `content`  | yes     | The announcements list and detail return 200 through the API, the BFF and the web page, both as a guest and signed in. |
| `roles`    | yes     | The merchant reaches `/merchant`. With resident creds, `/directory`, `/profile`, `/api/profile` and `/api/shops?limit=1` return 200 (the shops directory is browse-only open), `/cart` redirects 307 to `/home`, and `/api/orders` returns 403 (GET only, no orders are created). With admin creds, `/admin` returns 200. Role checks without creds are SKIPped. |
| `security` | yes     | The web root sends CSP, HSTS, X-Frame-Options and nosniff headers. `/api/auth/session` (guest and signed in) has no positive max-age/s-maxage and never shows `x-vercel-cache: HIT`. |
| `writes`   | opt-in (`--with-writes`) | As the merchant, uploads an avatar and a feedback PNG through the web BFF. Checks that each public URL loads `200 image/png`. Then deletes exactly those objects from Supabase Storage and confirms by listing that they are gone. Comments are never posted, because there is no delete endpoint for them. |
| `throttle` | opt-in (`--only=throttle`) | Sends 7 logins straight to the API with rotating spoofed `X-Forwarded-For` values (a client-sent `CF-Connecting-IP` is rejected by Cloudflare with 403, so it is not used) and unknown emails. One of the first 6 must return 429. **This consumes the login rate limit for your IP for about 60 s.** Run it only when everything else passes. |

## Rate limit

Auth routes allow 5 requests per minute per IP. The BFF forwards the client IP, so web and API logins share one budget. The script keeps to 4 auth calls per rolling 60 s and pauses when it needs to, so one wait of about 55 s is normal. Each role logs in once per run, and the web session is reused across groups. After a failed login the script stops retrying that account, which protects it from the 10-fails/15-min email lockout.

The limiter covers a single process only. Wait about 60 s between consecutive runs.

## Environment

Values are read from the process env first, then from the root `.env` file. Nothing is ever written.

| Variable | Use |
| -------- | --- |
| `SMOKE_WEB_URL` / `SMOKE_API_URL` | Targets. Defaults: `https://eastpark-web-app.vercel.app`, `https://eastpark-backend.onrender.com` |
| `SEED_MERCHANT_PASSWORD` | Password for `showcase.adam-cafe@eastpark.app`. Without it, merchant checks SKIP. |
| `SMOKE_RESIDENT_EMAIL` / `SMOKE_RESIDENT_PASSWORD` | Optional resident account for the `roles` checks |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` | Optional admin account for the `roles` checks |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET` | Cleanup for `--with-writes`. The bucket defaults to `eastpark-uploads`. |
