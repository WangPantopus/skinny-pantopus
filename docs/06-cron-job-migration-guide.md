# Cron Job Migration: Step-by-Step Deployment & Testing Guide

## Context

All code for Phase 1-3 is written. This guide covers how to test locally, deploy to staging, verify, cut over to the new system, and roll back if needed — for each phase independently.

**Current deployment setup:**
- Backend: Docker image → Docker Hub → EC2 via SSH (`deploy-backend.yml`)
- Lambdas: SAM build → `sam deploy --config-env {env}` (`pantopus-seeder/deploy/`)
- Database: Supabase migrations in `supabase/migrations/` (timestamp format: `20260612000000_*.sql`)
- Environments: dev → staging → production

---

## Pre-flight: Fix Migration File Location

The job_locks migration was created at `backend/database/migrations/123_create_job_locks.sql`, but Supabase migrations live in `supabase/migrations/` with timestamp naming. Need to:

1. Create `supabase/migrations/20260612000000_create_job_locks.sql` with the same content
2. Delete `backend/database/migrations/123_create_job_locks.sql`

---

## Phase 1: Lambda + EventBridge (Tier 1 Jobs)

### Step 1.1 — Test Locally

**1.1a: Run the migration against local Supabase**
```bash
supabase db reset   # applies all migrations including job_locks
```

Verify the table and functions exist:
```sql
SELECT * FROM job_locks;  -- should return empty
SELECT acquire_job_lock('test-job', 'local-test', 60);  -- should return true
SELECT acquire_job_lock('test-job', 'other-instance', 60);  -- should return false (lock held)
SELECT release_job_lock('test-job', 'local-test', true);  -- release it
SELECT acquire_job_lock('test-job', 'other-instance', 60);  -- should return true now
```

**1.1b: Test the internal endpoints**

Start the backend locally, then curl each endpoint:
```bash
# Should return {"status":"completed"} or {"status":"failed"} (depending on data)
curl -X POST http://localhost:8000/api/internal/jobs/process-pending-transfers \
  -H "Content-Type: application/json" \
  -H "x-internal-key: YOUR_LOCAL_INTERNAL_API_KEY" \
  -d '{"triggered_by": "manual-test"}'
```

Test all 10 endpoints:
- `process-pending-transfers`
- `retry-capture-failures`
- `authorize-upcoming-gigs`
- `expire-uncaptured-authorizations`
- `check-stuck-payments`
- `cleanup-ghost-businesses`
- `chat-redaction`
- `trust-anomaly-detection`
- `compute-avg-response-time`
- `auto-archive-posts`

For each, verify:
- 200 with `{"status":"completed"}` — job ran successfully
- 409 with `{"status":"skipped","reason":"lock_held"}` — if you fire twice quickly
- 401/403 — if auth header is wrong or missing

**1.1c: Test lock contention**

Open two terminals and fire the same endpoint simultaneously:
```bash
# Terminal 1 and 2 at the same time:
curl -X POST http://localhost:8000/api/internal/jobs/compute-avg-response-time \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  -d '{}'
```
One should return 200 (completed), the other 409 (skipped).

**1.1d: Test the Lambda handler locally (optional)**
```bash
cd pantopus-seeder
# Invoke locally with SAM
sam local invoke JobTriggerFunction \
  --event '{"job": "auto-archive-posts"}' \
  --env-vars env.json
```
Where `env.json` contains `{"JobTriggerFunction": {"SECRET_NAME": "", "PANTOPUS_API_BASE_URL": "http://host.docker.internal:8000", "INTERNAL_API_KEY": "your-key"}}`.

### Step 1.2 — Deploy to Staging

**Order matters. Deploy bottom-up: database → backend → Lambda.**

**1.2a: Run migration on staging Supabase**
```bash
supabase db push --linked   # pushes new migration to remote staging DB
```
Verify via Supabase SQL Editor:
```sql
SELECT * FROM job_locks;
SELECT proname FROM pg_proc WHERE proname LIKE '%job_lock%';
-- Should show: acquire_job_lock, release_job_lock
```

**1.2b: Deploy backend to staging**

Push the branch to `dev` (or merge PR to `dev`). The `deploy-backend.yml` workflow will:
1. Build Docker image with `target: production`
2. Push to Docker Hub as `:staging`
3. SSH to staging EC2 and restart container

After deploy, verify the new endpoints are reachable:
```bash
curl -X POST https://staging-api.your-domain.com/api/internal/jobs/auto-archive-posts \
  -H "x-internal-key: $STAGING_INTERNAL_API_KEY" \
  -d '{"triggered_by": "manual-test"}'
```

**1.2c: Add INTERNAL_API_KEY to Secrets Manager (if not already)**

Check the staging secret `pantopus/seeder/staging` in AWS Secrets Manager.
Ensure it has `INTERNAL_API_KEY` matching the staging backend's `INTERNAL_API_KEY` env var.

**1.2d: Deploy Lambda to staging**
```bash
cd pantopus-seeder
./deploy/build.sh
cd deploy
sam build --use-container
sam deploy --config-env staging
```

Review the changeset — it should show `JobTriggerFunction` and 10 EventBridge rules being created. Confirm the changeset.

**1.2e: Verify Lambda fires correctly**

Wait for one of the schedules to trigger (e.g., `auto-archive-posts` at 4:00 AM UTC), or trigger manually:
```bash
aws lambda invoke \
  --function-name pantopus-job-trigger-staging \
  --payload '{"job": "auto-archive-posts"}' \
  --cli-binary-format raw-in-base64-out \
  /dev/stdout
```

Check CloudWatch Logs for the Lambda:
- Log group: `/aws/lambda/pantopus-job-trigger-staging`
- Look for: `Triggering job: auto-archive-posts` → `Job auto-archive-posts completed`

Check CloudWatch Metrics:
- Namespace: `Pantopus/Jobs/staging`
- Metric: `JobCompleted`, Dimension: `JobName=auto-archive-posts`

### Step 1.3 — Monitor Staging (48 hours)

**What to watch:**
- CloudWatch Logs: any `Job ... failed` entries
- CloudWatch Metrics: `JobFailed` count should be 0
- `job_locks` table: `last_failure` should be NULL for all jobs
- Backend logs: `[internal] Completed job:` entries with reasonable `elapsed_ms`

**Verify no double-runs:**
Both node-cron AND Lambda are running during this period. Check the `job_locks` table:
```sql
SELECT job_name, run_count, last_success, last_failure, last_error
FROM job_locks
ORDER BY last_success DESC;
```
The Lambda-triggered runs will show up here. Node-cron runs won't (they bypass the lock). This is expected during transition.

### Step 1.4 — Cut Over (Disable node-cron for Tier 1)

Once you're confident the Lambda triggers work:

1. Set `LAMBDA_BACKED_CRON_ENABLED=false` on the backend/worker environment
2. Deploy the backend again
3. Now ONLY the Lambda triggers these jobs

**Rollback:** Set `LAMBDA_BACKED_CRON_ENABLED=true`, redeploy. The Lambda can stay active — the lock prevents double-runs.

---

## Phase 2: pg-boss (Tier 2 Jobs)

### Step 2.1 — Prerequisites

**Add DATABASE_URL to all env files.**

Get the direct PostgreSQL connection string from Supabase Dashboard → Settings → Database → Connection string (URI format). Add to:
- `backend/.env.dev` (local)
- `backend/.env.staging` (staging EC2 at `~/pantopus/.env.staging`)
- `backend/.env.prod` (production EC2 at `~/pantopus/.env.prod`)

Format: `postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres`

### Step 2.2 — Test Locally

**2.2a: Start backend with DATABASE_URL**
```bash
# Ensure DATABASE_URL is in .env.dev, then:
npm run dev   # or however you start locally
```

Watch logs for:
```
[pg-boss] Started successfully
[pg-boss] Registered job: recompute-utility-scores (10,25,40,55 * * * *)
[pg-boss] Registered job: organic-match (*/2 * * * *)
... (11 jobs total)
```

**2.2b: Verify pg-boss schema was created**
```sql
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'pgboss';
-- Should show: job, version, subscription, schedule, archive
```

**2.2c: Verify jobs are scheduled**
```sql
SELECT name, cron, timezone, data FROM pgboss.schedule;
-- Should show 11 rows with correct cron expressions
```

**2.2d: Wait for a job to fire**

Wait 2 minutes for `organic-match` or `refresh-discovery-cache` to run. Check logs:
```
[pg-boss] Starting: organic-match
[pg-boss] Completed: organic-match {elapsed_ms: 1234, jobId: ...}
```

And verify in the database:
```sql
SELECT name, state, createdon, completedon
FROM pgboss.job
WHERE name = 'organic-match'
ORDER BY createdon DESC
LIMIT 5;
```

**2.2e: Test retry behavior**

If a job fails, pg-boss should retry up to 3 times with exponential backoff (30s, 60s, 120s). You can verify retry config:
```sql
SELECT name, retrylimit, retrydelay, retrybackoff FROM pgboss.schedule;
```

### Step 2.3 — Deploy to Staging

**2.3a: Add DATABASE_URL on staging EC2**

SSH to staging and add `DATABASE_URL=...` to `~/pantopus/.env.staging`.

**2.3b: Deploy backend**

Push to `dev` branch. After deploy, check staging logs for pg-boss startup messages.

**2.3c: Verify on staging**
```sql
-- On staging Supabase:
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'pgboss';
SELECT name, cron FROM pgboss.schedule;
SELECT name, state, COUNT(*) FROM pgboss.job
WHERE createdon > now() - interval '1 hour'
GROUP BY name, state;
```

### Step 2.4 — Monitor Staging (48 hours)

**Check pg-boss health dashboard:**
```sql
SELECT
  name,
  COUNT(*) FILTER (WHERE state = 'completed') as completed_24h,
  COUNT(*) FILTER (WHERE state = 'failed') as failed_24h,
  COUNT(*) FILTER (WHERE state = 'active') as active_now,
  AVG(EXTRACT(EPOCH FROM (completedon - startedon)))
    FILTER (WHERE state = 'completed') as avg_duration_s
FROM pgboss.job
WHERE createdon > now() - interval '24 hours'
GROUP BY name
ORDER BY name;
```

**What to watch:**
- `failed_24h` should be 0 (or very low with successful retries)
- `active_now` should be 0 or 1 (no stuck jobs)
- `avg_duration_s` should be reasonable (not increasing over time)

**Check for dead-letter jobs:**
```sql
SELECT name, state, createdon, output
FROM pgboss.job
WHERE state = 'failed'
ORDER BY createdon DESC
LIMIT 20;
```

### Step 2.5 — Cut Over (Disable node-cron for Tier 2)

No code edit is required. Once pg-boss starts and registers its jobs, `startJobs()` skips the 11 pg-boss-backed node-cron fallbacks automatically. If pg-boss fails to initialize, those jobs fall back to node-cron for continuity.

**Rollback:** Set `PGBOSS_ENABLED=false`, deploy. The Tier 2 jobs run through node-cron again.

---

## Phase 3: Worker Container Split

### Step 3.1 — Test Locally

**3.1a: Test worker.js standalone**
```bash
# Ensure DATABASE_URL is in .env.dev
cd backend
PGBOSS_ENABLED=false CRON_ENABLED=false node app.js &   # API without background jobs
node worker.js &                       # Worker with pg-boss + node-cron
```

Verify:
- app.js logs: NO `[pg-boss]` messages (skipped)
- app.js logs: `[CRON] Skipping job startup because CRON_ENABLED=false`
- worker.js logs: `[pg-boss] Started successfully`, `[Worker] Ready`
- worker.js logs: `[CRON] Background jobs initialized`

**3.1b: Test with Docker Compose**
```bash
cd backend
docker compose up --build
```

Check that both `pantopus-backend` and `pantopus-worker` start. Backend should NOT log pg-boss messages. Worker should.

### Step 3.2 — Deploy to Staging

**This requires CI/CD changes.** The current `deploy-backend.yml` only builds/deploys the `production` target. For Phase 3, you need to also build and deploy the `worker` target.

**3.2a: Update the deploy workflow (or do it manually first)**

For initial testing, deploy manually on staging EC2:
```bash
# SSH to staging EC2
# Pull latest image (already has worker.js in it since same codebase)
docker pull $DOCKERHUB_USERNAME/pantopus-backend:staging

# Stop existing backend
docker stop pantopus-backend-staging || true
docker rm pantopus-backend-staging || true

# Start API (no pg-boss)
docker run -d \
  --name pantopus-backend-staging \
  --env-file ~/pantopus/.env.staging \
  -e PGBOSS_ENABLED=false \
  -e CRON_ENABLED=false \
  -p 8000:8000 \
  --restart unless-stopped \
  $DOCKERHUB_USERNAME/pantopus-backend:staging

# Start Worker (pg-boss + cron)
docker run -d \
  --name pantopus-worker-staging \
  --env-file ~/pantopus/.env.staging \
  -e PGBOSS_ENABLED=true \
  -e CRON_ENABLED=true \
  --restart unless-stopped \
  $DOCKERHUB_USERNAME/pantopus-backend:staging \
  node worker.js
```

Note: Both use the same Docker image — just different commands and env.

**3.2b: Verify split**
- Backend container: healthy, serving HTTP, no pg-boss logs
- Worker container: running, pg-boss started, cron initialized
- Jobs executing normally (check pg-boss.job table)

### Step 3.3 — Monitor & Compare

Compare API p95 latency before and after the worker split. If API latency improves during heavy job windows (e.g., when recomputeUtilityScores runs), the split is working.

### Step 3.4 — Update CI/CD

Once validated, update `deploy-backend.yml` to also start the worker container on deploy. This is a separate task — the worker uses the same image, just a different `docker run` command.

---

## Rollback Procedures

### Rollback Phase 1 (Lambda → node-cron)
1. Set `LAMBDA_BACKED_CRON_ENABLED=true`
2. Deploy backend
3. Optionally disable EventBridge rules: set `Enabled: false` in template.yaml, `sam deploy`
4. `job_locks` table and internal endpoints are safe to leave in place

### Rollback Phase 2 (pg-boss → node-cron)
1. Set `PGBOSS_ENABLED=false`
2. Deploy backend
3. pg-boss tables auto-archive/delete. To fully remove: `DROP SCHEMA pgboss CASCADE;`

### Rollback Phase 3 (worker split → single process)
1. Stop and remove worker container
2. Remove `PGBOSS_ENABLED=false` from backend env (or set to `true`)
3. Restart backend — it now runs pg-boss in-process again

---

## Files To Modify Before Starting

| Task | File | What |
|------|------|------|
| Move migration | `supabase/migrations/20260612000000_create_job_locks.sql` | Create with content from `backend/database/migrations/123_create_job_locks.sql` |
| Delete old migration | `backend/database/migrations/123_create_job_locks.sql` | Remove (wrong location) |
| Add DATABASE_URL | `backend/.env.dev`, `.env.staging`, `.env.prod` | Supabase direct PG connection string |
| Verify INTERNAL_API_KEY | AWS Secrets Manager `pantopus/seeder/{env}` | Must match backend env var |
