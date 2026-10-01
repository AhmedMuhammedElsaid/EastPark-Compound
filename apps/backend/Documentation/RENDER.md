# Render deployment

Render is the initial replacement target for Fly.io. Keep Fly running until the Render service
passes every verification step below and the Vercel web app has been redeployed against the new
API URL.

## Architecture

- Vercel hosts `apps/web`.
- Render hosts this Dockerized NestJS API on the free web-service plan.
- Supabase remains the PostgreSQL database and object store.
- Upstash REST provides Redis for OTPs, token revocation, and Paymob idempotency.
- Socket.io may remain compiled, but the initial web order experience must poll REST endpoints.
  Free-service sleep means realtime connections and the five-minute election cron are not reliable.

## Create the service

The root-owned monorepo has one Blueprint at `/render.yaml`. Do not add another Blueprint under
`apps/backend`; the root file owns the Docker context and Dockerfile paths.

1. Push the root repository to GitHub.
2. In Render, choose **New > Blueprint** and select `EastPark-Compound`.
3. Render detects the root `render.yaml`. Confirm the service is named `eastpark-backend`, uses Frankfurt,
   the free plan, and health path `/health`.
4. Enter every environment value marked `sync: false`. Never commit those values.

Use the Supabase transaction pooler on port `6543` for `DATABASE_URL` with
`?pgbouncer=true&connection_limit=1`. Use the session pooler on port `5432` for
`DIRECT_DATABASE_URL`. Percent-encode the database password.

`APP_URL` is the final Render origin, for example `https://eastpark-backend.onrender.com`.
`APP_CORS_ORIGINS` is already restricted to `https://eastpark-web-app.vercel.app`.

Generate two different auth secrets locally:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Use the production `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, the Brevo SMTP
credentials, and the Supabase secret service key. The backend retains `REDIS_URL` as the local and
TCP Redis fallback, but Render does not require it when both Upstash REST values are present.
Card payments are disabled for the first release with `PAYMENTS_ENABLED=false`; Render does not
need Paymob credentials. Enable the feature only after real Paymob credentials are configured and
amount verification is complete. Cash on delivery remains available.

## Build and migrations

Render builds the existing multi-stage `Dockerfile`. Its container command runs
`prisma migrate deploy` before starting NestJS, so a release does not serve traffic against an
outdated schema. Never run `prisma migrate dev` in production.

Free Render services sleep when idle. The first request after sleep can be slow. Do not add an
external keep-alive solely to defeat free-tier sleep.

## Verify before cutover

```bash
curl -i https://<render-host>/health
curl -i "https://<render-host>/v1/announcements?limit=1"
curl -i -X OPTIONS "https://<render-host>/v1/residents/leads" \
  -H "Origin: https://eastpark-web-app.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```

Then test registration, OTP login, token refresh, announcement detail, and one duplicate-unit 409.
Only after those pass:

1. Set Vercel `NEXT_PUBLIC_API_URL` to the Render origin without `/v1` or a trailing slash.
2. Redeploy `eastpark-web-app` because the public environment value is build-time configuration.
3. Repeat the web production smoke tests.
4. Keep Fly available for rollback until Render has been stable through at least one sleep/wake
   cycle. Remove Fly only after explicit approval.
