# Google Cloud Run Migration Plan

This runbook prepares a future migration of the EastPark API from Render to Google Cloud Run. It
does not authorize or perform the migration. Vercel, Supabase, Upstash, Brevo, and Expo remain in
place; Cloud Run replaces only Render.

## Current Baseline

- Web: `https://eastpark-web-app.vercel.app`
- API: `https://eastpark-backend.onrender.com`
- Database and storage: Supabase
- Cache: Upstash Redis REST
- Payments: disabled with `PAYMENTS_ENABLED=false`

Keep Render running for at least 48 hours after cutover as the rollback target.

## 1. Prepare Google Cloud

Use Google Cloud Shell and replace every placeholder:

```bash
export GCP_PROJECT_ID="replace-with-project-id"
export GCP_REGION="europe-west1"
export AR_REPOSITORY="eastpark"
export RUN_SERVICE="eastpark-backend"
export MIGRATION_JOB="eastpark-prisma-migrate"
export RUNTIME_SA_NAME="eastpark-run"
export RUNTIME_SA="${RUNTIME_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
export IMAGE_TAG="replace-with-git-sha"
export IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPOSITORY}/backend:${IMAGE_TAG}"

gcloud config set project "$GCP_PROJECT_ID"
gcloud services enable \
  artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com \
  iamcredentials.googleapis.com logging.googleapis.com monitoring.googleapis.com

gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
  --display-name="EastPark Cloud Run runtime"

gcloud artifacts repositories create "$AR_REPOSITORY" \
  --repository-format=docker \
  --location="$GCP_REGION"
```

Google Cloud requires billing. Create budget alerts at 50%, 90%, and 100% before deploying. Budget
alerts notify but do not stop spending.

## 2. Store Secrets

Create these Secret Manager entries using the active Render values:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `AUTH_ACCESS_TOKEN_SECRET`
- `AUTH_REFRESH_TOKEN_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SMTP_USER`
- `SMTP_PASS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Keep the current JWT secrets during migration so active sessions remain valid. Never put values in
Git, command arguments, CI logs, or chat. Do not create Paymob secrets while payments are disabled.

Create each secret from secure standard input, then grant only the runtime identity access:

```bash
gcloud secrets create DATABASE_URL --replication-policy=automatic
printf '%s' 'ENTER_IN_SECURE_CLOUD_SHELL' | \
  gcloud secrets versions add DATABASE_URL --data-file=-

for secret in \
  DATABASE_URL DIRECT_DATABASE_URL \
  AUTH_ACCESS_TOKEN_SECRET AUTH_REFRESH_TOKEN_SECRET \
  UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN \
  SMTP_USER SMTP_PASS SUPABASE_URL SUPABASE_SERVICE_KEY
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

Repeat the create/version command for every listed secret before running the grant loop.

## 3. Build the Existing Image

The build context must remain `apps/backend`, matching `render.yaml`:

```bash
pnpm check:backend

gcloud builds submit apps/backend \
  --tag "$IMAGE_URI" \
  --project "$GCP_PROJECT_ID"

gcloud artifacts docker images describe "$IMAGE_URI"
```

Use an immutable Git SHA tag, never `latest`.

## 4. Run Migrations as a Job

The Docker image currently runs `prisma migrate deploy` during startup. Do not let every autoscaled
API instance run migrations. Create a one-off Cloud Run Job from the same image:

```bash
gcloud run jobs create "$MIGRATION_JOB" \
  --image "$IMAGE_URI" \
  --region "$GCP_REGION" \
  --service-account "$RUNTIME_SA" \
  --command pnpm \
  --args exec,prisma,migrate,deploy \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,DIRECT_DATABASE_URL=DIRECT_DATABASE_URL:latest \
  --max-retries 0 \
  --task-timeout 10m

gcloud run jobs execute "$MIGRATION_JOB" --region "$GCP_REGION" --wait
```

For later releases, update the job image and run it before shifting API traffic. Stop deployment if
the job fails. Use backward-compatible expand-and-contract schema changes.

## 5. Deploy the API

Cloud Run injects `PORT`; EastPark reads `HTTP_PORT`. Keep both aligned at `10000`. Override the
image command so API instances start Node without rerunning migrations:

```bash
gcloud run deploy "$RUN_SERVICE" \
  --image "$IMAGE_URI" \
  --region "$GCP_REGION" \
  --service-account "$RUNTIME_SA" \
  --allow-unauthenticated \
  --port 10000 \
  --command node \
  --args dist/main \
  --cpu 1 --memory 512Mi \
  --concurrency 40 --timeout 300s \
  --min-instances 0 --max-instances 1 \
  --set-env-vars NODE_ENV=production,APP_ENV=production,APP_LOG_LEVEL=info,APP_CORS_ORIGINS=https://eastpark-web-app.vercel.app,HTTP_HOST=0.0.0.0,HTTP_PORT=10000,AUTH_ACCESS_TOKEN_EXP=15m,AUTH_REFRESH_TOKEN_EXP=7d,SMTP_HOST=smtp-relay.brevo.com,SMTP_PORT=587,EMAIL_FROM=noreply@eastpark.app,SUPABASE_BUCKET=eastpark-uploads,PAYMENTS_ENABLED=false \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,DIRECT_DATABASE_URL=DIRECT_DATABASE_URL:latest,AUTH_ACCESS_TOKEN_SECRET=AUTH_ACCESS_TOKEN_SECRET:latest,AUTH_REFRESH_TOKEN_SECRET=AUTH_REFRESH_TOKEN_SECRET:latest,UPSTASH_REDIS_REST_URL=UPSTASH_REDIS_REST_URL:latest,UPSTASH_REDIS_REST_TOKEN=UPSTASH_REDIS_REST_TOKEN:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest

export CLOUD_RUN_URL="$(gcloud run services describe "$RUN_SERVICE" \
  --region "$GCP_REGION" --format='value(status.url)')"

gcloud run services update "$RUN_SERVICE" \
  --region "$GCP_REGION" \
  --update-env-vars "APP_URL=${CLOUD_RUN_URL}"
```

## 6. Scheduler and Socket.IO Prerequisites

Before cutover, replace the in-process election cron:

1. Extract the operation into an idempotent service method.
2. Add a protected internal POST endpoint.
3. Validate Google OIDC tokens from a dedicated scheduler service account.
4. Create a five-minute Cloud Scheduler HTTP job.
5. Verify it, then disable the in-process decorator.

Cloud Scheduler provides at-least-once delivery. Never expose an unauthenticated cron endpoint.

Cloud Run supports WebSockets, but connections end on timeout or instance replacement. The current
Socket.IO order gateway keeps room state in memory, so initially keep `max-instances=1`. Before
scaling further, add and load-test a shared Socket.IO adapter. Upstash REST is not automatically a
Socket.IO pub/sub adapter. Clients must retain reconnection and REST polling fallbacks.

## 7. Verify Before Cutover

```bash
curl -i "${CLOUD_RUN_URL}/health"
curl -i "${CLOUD_RUN_URL}/v1/announcements?limit=1"
curl -i -X OPTIONS "${CLOUD_RUN_URL}/v1/residents/leads" \
  -H 'Origin: https://eastpark-web-app.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Also verify:

- Prisma reports `up`, and announcements return production data.
- Registration, OTP, login, refresh, and logout work through Upstash and Brevo.
- Lead submission succeeds and duplicate active units return 409.
- Supabase uploads, COD orders, push-token registration, and role checks work.
- Paymob returns the intentional disabled response.
- Socket.IO reconnects after a revision restart.
- Scheduler authentication and idempotency work.
- Logs contain no credentials, JWTs, OTPs, or personal request bodies.

## 8. Cutover and Rollback

After all checks pass:

1. Set Vercel production `NEXT_PUBLIC_API_URL` to `CLOUD_RUN_URL` without `/v1` or a trailing slash.
2. Redeploy Vercel and smoke-test all primary routes.
3. Update both mobile EAS API/socket URLs and test a preview build before store builds.
4. Monitor errors, latency, Supabase connections, Upstash usage, and instance count.

Fast rollback:

1. Restore Vercel `NEXT_PUBLIC_API_URL` to `https://eastpark-backend.onrender.com`.
2. Redeploy Vercel.
3. Restore Render in mobile EAS configuration if a Cloud Run build was released.

To roll back only the Cloud Run revision:

```bash
gcloud run revisions list --service "$RUN_SERVICE" --region "$GCP_REGION"
gcloud run services update-traffic "$RUN_SERVICE" \
  --region "$GCP_REGION" \
  --to-revisions PREVIOUS_REVISION=100
```

## 9. Decommission Render

Delete Render only after Cloud Run has served production successfully for at least 48 hours, cold
starts and revision restarts have been tested, scheduler executions are successful, web and mobile
use Cloud Run, and rollback has been exercised once. Remove Render secrets before deleting the
service. This final step requires explicit approval.