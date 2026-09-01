# Cron Job Migration Plan

> Migration strategy for moving 35 in-process `node-cron` jobs to a tiered architecture using AWS Lambda, pg-boss, and retained node-cron.

---

## 1. Problem Statement

All 35 background jobs currently run in-process via `node-cron` inside the Express API server (`jobs/index.js`, called from `app.js` line 408).

### Current Architecture

```
 +--------------------------------------------------+
 |  Single Node.js Process (Express + node-cron)     |
 |                                                    |
 |  +----------------+    +----------------------+   |
 |  | Express API    |    | node-cron scheduler  |   |
 |  | (handles HTTP) |    | (35 jobs, all UTC)   |   |
 |  +-------+--------+    +----------+-----------+   |
 |          |                        |                |
 |          +--- shared event loop --+                |
 |          |                        |                |
 |  +-------v------------------------v-----------+   |
 |  |  supabaseAdmin, stripeService, etc.        |   |
 |  +--------------------------------------------+   |
 +--------------------------------------------------+
```

### Risks

| Risk | Severity | Example |
|------|----------|---------|
| **Double-run on multi-instance** | Critical | 2 API replicas both run `processPendingTransfers` -> double wallet credits |
| **API latency degradation** | High | `recomputeUtilityScores` (batch 100, concurrency 20) blocks event loop |
| **No failure tracking** | Medium | Job silently fails, next run silently retries; no dead-letter |
| **No retry with backoff** | Medium | Failed jobs wait for next cron tick (could be 15m-24h) |
| **No visibility** | Medium | No dashboard to see job status, last run, failure rate |
| **Financial jobs unprotected** | Critical | `authorizeUpcomingGigs` creates duplicate PaymentIntents |

---

## 2. Target Architecture

```
 +-------------------+     +------------------+     +-----------------+
 |  EventBridge      | --> | Lambda Functions | --> | Backend API     |
 |  (Tier 1 cron)    |     | (thin triggers)  |     | /api/internal/* |
 +-------------------+     +------------------+     +--------+--------+
                                                             |
                                                    +--------v--------+
                                                    |  job_locks      |
                                                    |  (advisory lock)|
                                                    +-----------------+
                                                             |
 +-------------------+                              +--------v--------+
 |  pg-boss          | <-- enqueue on schedule ---> | Supabase PG     |
 |  (Tier 2 queue)   |     (via node-cron stub)     | (shared DB)     |
 |  Runs in backend  |                              +-----------------+
 +-------------------+

 +-------------------+
 |  node-cron        |
 |  (Tier 3 retain)  |  Lightweight, idempotent jobs stay in-process
 +-------------------+
```

### Design Principles

1. **No job logic changes** -- Only the trigger/scheduling mechanism changes. Existing job functions are called as-is.
2. **Lambda triggers backend via HTTP** -- Lambdas don't contain business logic. They POST to `/api/internal/{job}` endpoints that run the existing JS code. This avoids repackaging Node.js for Lambda.
3. **pg-boss uses existing PostgreSQL** -- No Redis or new infrastructure. pg-boss creates its own schema in the existing Supabase database.
4. **`job_locks` table** -- Simple distributed lock for Phase 1 (before pg-boss is available). Prevents concurrent runs of the same job across instances.
5. **Incremental rollout** -- Each phase is independently deployable and rollbackable.

---

## 3. Job Classification

### Tier 1: Lambda + EventBridge (10 jobs)

Financial and critical jobs that **must not double-run** and benefit from isolated execution.

| Job | Current Schedule | EventBridge Expression | Why Lambda |
|-----|-----------------|----------------------|------------|
| `processPendingTransfers` | Hourly :15 | `cron(15 * * * ? *)` | Credits wallets, must not double-run |
| `retryCaptureFailures` | 15m :05/:20/:35/:50 | `rate(15 minutes)` | Retries Stripe captures |
| `authorizeUpcomingGigs` | Hourly :05 | `cron(5 * * * ? *)` | Creates PaymentIntents |
| `expireUncapturedAuthorizations` | Daily 3:00 AM | `cron(0 3 * * ? *)` | Cancels gigs, financial |
| `checkAndAlertStuckPayments` | 15m :12/:27/:42/:57 | `rate(15 minutes)` | Ops alerting (Slack/PagerDuty) |
| `cleanupGhostBusinesses` | Daily 2:30 AM | `cron(30 2 * * ? *)` | Destructive (deletes User rows) |
| `chatRedactionJob` | Hourly :30 | `cron(30 * * * ? *)` | GDPR-sensitive, batch processing |
| `trustAnomalyDetection` | 6h :45 | `cron(45 */6 * * ? *)` | Heavy query, infrequent |
| `computeAvgResponseTime` | Daily 5:00 AM | `cron(0 5 * * ? *)` | Heavy daily query (90d window) |
| `autoArchivePosts` | Daily 4:00 AM | `cron(0 4 * * ? *)` | Bulk status updates |

### Tier 2: pg-boss Queue (11 jobs)

Frequent jobs that need **distributed locking** and **retry/failure tracking** but don't justify Lambda overhead.

| Job | Current Schedule | pg-boss Queue Name | Cron (pg-boss) |
|-----|-----------------|-------------------|----------------|
| `recomputeUtilityScores` | 15m | `recompute-utility-scores` | `*/15 * * * *` |
| `organicMatch` | 2m | `organic-match` | `*/2 * * * *` |
| `refreshDiscoveryCache` | 2m | `refresh-discovery-cache` | `*/2 * * * *` |
| `expirePendingPaymentBids` | 2m | `expire-pending-payment-bids` | `*/2 * * * *` |
| `computeReputation` | 30m :07/:37 | `compute-reputation` | `7,37 * * * *` |
| `earnRiskReview` | 15m | `earn-risk-review` | `*/15 * * * *` |
| `processClaimWindows` | 10m | `process-claim-windows` | `*/10 * * * *` |
| `reconcileHomeHouseholdResolution` | 30m :14/:44 | `reconcile-household` | `14,44 * * * *` |
| `validateHomeCoordinates` | 30m :12/:42 | `validate-home-coordinates` | `12,42 * * * *` |
| `mailInterruptNotification` | 5m | `mail-interrupt-notification` | `*/5 * * * *` |
| `communityModeration` | 30m | `community-moderation` | `*/30 * * * *` |

### Tier 3: Keep node-cron (14 jobs)

Lightweight, idempotent jobs safe to run on multiple instances.

| Job | Schedule | Why Keep |
|-----|----------|---------|
| `mailPartyExpiry` | Every 1m | Trivial status flip, idempotent |
| `expireGigs` | 15m | Idempotent status update |
| `expireListings` | 15m | Idempotent status update |
| `expireOffers` | 15m | Idempotent status update |
| `expirePopupBusinesses` | Hourly :45 | Idempotent |
| `expireInitiatedHomeClaims` | Hourly :11 | Idempotent state transition |
| `vacationHoldExpiry` | Hourly :25 | Simple status flip |
| `stampAwarder` | 6h :35 | Idempotent upsert |
| `draftBusinessReminder` | Daily 10:00 AM | Has reminder cap (max 3) |
| `mailDayNotification` | Daily 8:00 AM | Already has dedup logic |
| `autoRemindWorker` | 5m | Has cooldown/ack guards |
| `supportTrainReminders` | 30m | Has `last_reminder_sent` guard |
| `notifyClaimWindowExpiry` | 2h :20 | Has time-window guard |
| `vaultWeeklyDigest` | Monday 9:00 AM | Low frequency, low stakes |

---

## 4. Phase 1: Lambda + EventBridge (Week 1-2)

### 4.1 Database Migration: `job_locks` Table

Create an advisory lock table to prevent concurrent job execution even before pg-boss is available.

```sql
-- Migration: create_job_locks_table.sql
CREATE TABLE IF NOT EXISTS job_locks (
  job_name     TEXT PRIMARY KEY,
  locked_by    TEXT NOT NULL,          -- instance identifier (hostname or random UUID)
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,   -- auto-expire stale locks
  run_count    BIGINT NOT NULL DEFAULT 0,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  last_error   TEXT
);

-- Index for cleanup query
CREATE INDEX idx_job_locks_expires ON job_locks (expires_at);

-- Function: try to acquire lock (returns true if acquired)
CREATE OR REPLACE FUNCTION acquire_job_lock(
  p_job_name TEXT,
  p_locked_by TEXT,
  p_ttl_seconds INT DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- Try to insert (new lock) or update (expired lock)
  INSERT INTO job_locks (job_name, locked_by, locked_at, expires_at, run_count)
  VALUES (p_job_name, p_locked_by, now(), now() + (p_ttl_seconds || ' seconds')::INTERVAL, 1)
  ON CONFLICT (job_name) DO UPDATE
    SET locked_by = p_locked_by,
        locked_at = now(),
        expires_at = now() + (p_ttl_seconds || ' seconds')::INTERVAL,
        run_count = job_locks.run_count + 1
    WHERE job_locks.expires_at < now();  -- Only if expired

  GET DIAGNOSTICS v_acquired = ROW_COUNT;
  RETURN v_acquired > 0;
END;
$$ LANGUAGE plpgsql;

-- Function: release lock and record result
CREATE OR REPLACE FUNCTION release_job_lock(
  p_job_name TEXT,
  p_locked_by TEXT,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE job_locks
  SET expires_at = now(),  -- immediately expire
      last_success = CASE WHEN p_success THEN now() ELSE last_success END,
      last_failure = CASE WHEN NOT p_success THEN now() ELSE last_failure END,
      last_error = CASE WHEN NOT p_success THEN p_error ELSE last_error END
  WHERE job_name = p_job_name AND locked_by = p_locked_by;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 New Internal API Endpoints

Add to `routes/internal.js`:

```
POST /api/internal/jobs/process-pending-transfers
POST /api/internal/jobs/retry-capture-failures
POST /api/internal/jobs/authorize-upcoming-gigs
POST /api/internal/jobs/expire-uncaptured-authorizations
POST /api/internal/jobs/check-stuck-payments
POST /api/internal/jobs/cleanup-ghost-businesses
POST /api/internal/jobs/chat-redaction
POST /api/internal/jobs/trust-anomaly-detection
POST /api/internal/jobs/compute-avg-response-time
POST /api/internal/jobs/auto-archive-posts
```

Each endpoint follows this pattern:

```javascript
// routes/internal.js (additions)
const processPendingTransfers = require('../jobs/processPendingTransfers');

router.post('/jobs/process-pending-transfers',
  requireInternalAuth,   // existing x-internal-api-key check
  async (req, res) => {
    const instanceId = `lambda-${Date.now()}`;
    const ttl = 600; // 10 minutes

    // Acquire distributed lock
    const { data } = await supabaseAdmin.rpc('acquire_job_lock', {
      p_job_name: 'processPendingTransfers',
      p_locked_by: instanceId,
      p_ttl_seconds: ttl,
    });

    if (!data) {
      return res.status(409).json({ status: 'skipped', reason: 'lock_held' });
    }

    try {
      await processPendingTransfers();
      await supabaseAdmin.rpc('release_job_lock', {
        p_job_name: 'processPendingTransfers',
        p_locked_by: instanceId,
        p_success: true,
      });
      res.json({ status: 'completed' });
    } catch (err) {
      await supabaseAdmin.rpc('release_job_lock', {
        p_job_name: 'processPendingTransfers',
        p_locked_by: instanceId,
        p_success: false,
        p_error: err.message,
      });
      res.status(500).json({ status: 'failed', error: err.message });
    }
  }
);
```

### 4.3 Lambda Functions (SAM Template Additions)

Add to the existing `pantopus-seeder/deploy/template.yaml`:

```yaml
# --- Tier 1: Job Trigger Lambda Functions ---

JobTriggerFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub pantopus-job-trigger-${Environment}
    Handler: src.handlers.job_trigger.handler
    Runtime: python3.13
    Architectures: [arm64]
    CodeUri: ../build/
    Timeout: 120
    MemorySize: 128
    Environment:
      Variables:
        SECRET_NAME: !Sub pantopus/seeder/${Environment}
        ENVIRONMENT: !Ref Environment
    Policies:
      - Statement:
          - Effect: Allow
            Action: secretsmanager:GetSecretValue
            Resource: !Ref SeederSecret
      - Statement:
          - Effect: Allow
            Action: cloudwatch:PutMetricData
            Resource: '*'
    Events:
      ProcessPendingTransfers:
        Type: Schedule
        Properties:
          Schedule: cron(15 * * * ? *)
          Input: '{"job": "process-pending-transfers"}'
          Enabled: true
      RetryCaptureFailures:
        Type: Schedule
        Properties:
          Schedule: rate(15 minutes)
          Input: '{"job": "retry-capture-failures"}'
          Enabled: true
      AuthorizeUpcomingGigs:
        Type: Schedule
        Properties:
          Schedule: cron(5 * * * ? *)
          Input: '{"job": "authorize-upcoming-gigs"}'
          Enabled: true
      ExpireUncapturedAuth:
        Type: Schedule
        Properties:
          Schedule: cron(0 3 * * ? *)
          Input: '{"job": "expire-uncaptured-authorizations"}'
          Enabled: true
      CheckStuckPayments:
        Type: Schedule
        Properties:
          Schedule: rate(15 minutes)
          Input: '{"job": "check-stuck-payments"}'
          Enabled: true
      CleanupGhostBusinesses:
        Type: Schedule
        Properties:
          Schedule: cron(30 2 * * ? *)
          Input: '{"job": "cleanup-ghost-businesses"}'
          Enabled: true
      ChatRedaction:
        Type: Schedule
        Properties:
          Schedule: cron(30 * * * ? *)
          Input: '{"job": "chat-redaction"}'
          Enabled: true
      TrustAnomalyDetection:
        Type: Schedule
        Properties:
          Schedule: cron(45 */6 * * ? *)
          Input: '{"job": "trust-anomaly-detection"}'
          Enabled: true
      ComputeAvgResponseTime:
        Type: Schedule
        Properties:
          Schedule: cron(0 5 * * ? *)
          Input: '{"job": "compute-avg-response-time"}'
          Enabled: true
      AutoArchivePosts:
        Type: Schedule
        Properties:
          Schedule: cron(0 4 * * ? *)
          Input: '{"job": "auto-archive-posts"}'
          Enabled: true
```

### 4.4 Lambda Handler (Generic Job Trigger)

New file: `pantopus-seeder/src/handlers/job_trigger.py`

```python
"""Generic job trigger Lambda handler.

Triggers backend cron jobs via POST /api/internal/jobs/{job_name}.
EventBridge passes {"job": "job-name"} as the event payload.
"""
import logging
import os
from typing import Any

import httpx

from ..config.secrets import get_briefing_secrets

log = logging.getLogger("seeder.handlers.job_trigger")
log.setLevel(logging.INFO)

SEND_TIMEOUT_S = 90  # Most jobs complete within 90s

def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    try:
        return _run(event, context)
    except Exception:
        log.exception("Job trigger handler failed")
        return {"status": "error", "job": event.get("job", "unknown")}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    job_name = event.get("job")
    if not job_name:
        log.error("No job name in event payload")
        return {"status": "error", "reason": "missing_job_name"}

    secrets = get_briefing_secrets()
    url = f"{secrets.pantopus_api_base_url}/api/internal/jobs/{job_name}"

    log.info("Triggering job: %s", job_name)

    response = httpx.post(
        url,
        json={"triggered_by": "lambda", "function_name": context.function_name},
        headers={
            "Content-Type": "application/json",
            "x-internal-api-key": secrets.internal_api_key,
        },
        timeout=SEND_TIMEOUT_S,
    )

    result = response.json()
    status_code = response.status_code

    if status_code == 409:
        log.info("Job %s skipped (lock held): %s", job_name, result)
        _publish_metric(job_name, "Skipped")
        return {"status": "skipped", "job": job_name}

    if status_code >= 400:
        log.error("Job %s failed (%d): %s", job_name, status_code, result)
        _publish_metric(job_name, "Failed")
        return {"status": "failed", "job": job_name, "http_status": status_code}

    log.info("Job %s completed: %s", job_name, result)
    _publish_metric(job_name, "Completed")
    return {"status": "completed", "job": job_name}


def _publish_metric(job_name: str, status: str) -> None:
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Jobs/{env}",
            MetricData=[
                {
                    "MetricName": f"Job{status}",
                    "Value": 1,
                    "Unit": "Count",
                    "Dimensions": [
                        {"Name": "JobName", "Value": job_name},
                    ],
                },
            ],
        )
    except Exception:
        log.warning("Failed to publish metrics", exc_info=True)
```

### 4.5 Remove Tier 1 Jobs from node-cron

In `jobs/index.js`, comment out (don't delete) the 10 Tier 1 cron registrations:

```javascript
// Phase 1 migration: These jobs are now triggered by Lambda via EventBridge.
// Kept as comments for rollback reference.
// cron.schedule('15 * * * *', wrapJob('processPendingTransfers', processPendingTransfers));
// cron.schedule('5,20,35,50 * * * *', wrapJob('retryCaptureFailures', retryCaptureFailures));
// ... etc
```

### 4.6 Rollback Strategy (Phase 1)

```
To rollback:
1. Disable EventBridge rules in SAM template (set Enabled: false)
2. Re-deploy: sam deploy
3. Uncomment cron.schedule() lines in jobs/index.js
4. Restart backend

The job_locks table and internal endpoints are safe to leave in place.
```

---

## 5. Phase 2: pg-boss Queue (Week 3-4)

### 5.1 Install pg-boss

```bash
cd backend
npm install pg-boss
```

### 5.2 pg-boss Initialization

New file: `backend/jobs/pgBossManager.js`

```javascript
const PgBoss = require('pg-boss');
const logger = require('../utils/logger');

let boss = null;

async function initPgBoss() {
  if (process.env.NODE_ENV === 'test') return null;

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'pgboss',               // Separate schema, won't interfere with app tables
    retryLimit: 3,                   // Retry failed jobs up to 3 times
    retryDelay: 30,                  // 30 second delay between retries
    retryBackoff: true,              // Exponential backoff
    expireInHours: 1,                // Jobs expire after 1 hour
    archiveCompletedAfterSeconds: 86400,  // Archive completed jobs after 24h
    deleteAfterDays: 7,              // Delete archived jobs after 7 days
    monitorStateIntervalSeconds: 30, // Monitor state every 30s
  });

  boss.on('error', (error) => {
    logger.error('[pg-boss] Error:', { error: error.message });
  });

  boss.on('monitor-states', (states) => {
    logger.info('[pg-boss] Queue states:', states);
  });

  await boss.start();
  logger.info('[pg-boss] Started successfully');

  return boss;
}

function getBoss() {
  return boss;
}

async function stopPgBoss() {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10000 });
    logger.info('[pg-boss] Stopped');
  }
}

module.exports = { initPgBoss, getBoss, stopPgBoss };
```

### 5.3 Register Tier 2 Jobs with pg-boss

New file: `backend/jobs/pgBossJobs.js`

```javascript
const logger = require('../utils/logger');

// Import existing job functions (no changes to them)
const recomputeUtilityScores = require('./recomputeUtilityScores');
const organicMatch = require('./organicMatch');
const refreshDiscoveryCache = require('./refreshDiscoveryCache');
const expirePendingPaymentBids = require('./expirePendingPaymentBids');
const computeReputation = require('./computeReputation');
const earnRiskReview = require('./earnRiskReview');
const processClaimWindows = require('./processClaimWindows');
const reconcileHomeHouseholdResolution = require('./reconcileHomeHouseholdResolution');
const validateHomeCoordinates = require('./validateHomeCoordinates');
const mailInterruptNotification = require('./mailInterruptNotification');
const communityModeration = require('./communityModeration');

const JOBS = [
  { name: 'recompute-utility-scores',     cron: '*/15 * * * *', fn: recomputeUtilityScores },
  { name: 'organic-match',                cron: '*/2 * * * *',  fn: organicMatch },
  { name: 'refresh-discovery-cache',      cron: '*/2 * * * *',  fn: refreshDiscoveryCache },
  { name: 'expire-pending-payment-bids',  cron: '*/2 * * * *',  fn: expirePendingPaymentBids },
  { name: 'compute-reputation',           cron: '7,37 * * * *', fn: computeReputation },
  { name: 'earn-risk-review',             cron: '*/15 * * * *', fn: earnRiskReview },
  { name: 'process-claim-windows',        cron: '*/10 * * * *', fn: processClaimWindows },
  { name: 'reconcile-household',          cron: '14,44 * * * *',fn: reconcileHomeHouseholdResolution },
  { name: 'validate-home-coordinates',    cron: '12,42 * * * *',fn: validateHomeCoordinates },
  { name: 'mail-interrupt-notification',  cron: '*/5 * * * *',  fn: mailInterruptNotification },
  { name: 'community-moderation',         cron: '*/30 * * * *', fn: communityModeration },
];

async function registerPgBossJobs(boss) {
  for (const job of JOBS) {
    // Schedule recurring job
    await boss.schedule(job.name, job.cron, null, {
      tz: 'UTC',
      singletonKey: job.name,  // Prevents duplicate runs across instances
    });

    // Register worker
    await boss.work(job.name, { newJobCheckInterval: 5000 }, async (pgJob) => {
      const start = Date.now();
      logger.info(`[pg-boss] Starting: ${job.name}`, { jobId: pgJob.id });
      try {
        await job.fn();
        const elapsed = Date.now() - start;
        logger.info(`[pg-boss] Completed: ${job.name}`, { elapsed_ms: elapsed, jobId: pgJob.id });
      } catch (err) {
        const elapsed = Date.now() - start;
        logger.error(`[pg-boss] Failed: ${job.name}`, {
          error: err.message,
          stack: err.stack,
          elapsed_ms: elapsed,
          jobId: pgJob.id,
        });
        throw err; // pg-boss handles retry
      }
    });

    logger.info(`[pg-boss] Registered job: ${job.name} (${job.cron})`);
  }
}

module.exports = { registerPgBossJobs };
```

### 5.4 Integration in app.js

```javascript
// In app.js, after server.listen():
const { initPgBoss, stopPgBoss } = require('./jobs/pgBossManager');
const { registerPgBossJobs } = require('./jobs/pgBossJobs');

// After server starts:
if (process.env.NODE_ENV !== 'test') {
  const boss = await initPgBoss();
  if (boss) {
    await registerPgBossJobs(boss);
  }
  startJobs();  // Starts remaining Tier 3 node-cron jobs
}

// In graceful shutdown:
process.on('SIGTERM', async () => {
  server.close();
  io.close();
  await stopPgBoss();
  process.exit(0);
});
```

### 5.5 Remove Tier 2 Jobs from node-cron

In `jobs/index.js`, remove the 11 Tier 2 cron registrations (same comment-out pattern as Phase 1).

### 5.6 pg-boss Monitoring

pg-boss stores all job state in its own schema. Query for visibility:

```sql
-- Active jobs
SELECT name, state, createdon, startedon, completedon, output
FROM pgboss.job
WHERE state IN ('active', 'retry')
ORDER BY createdon DESC
LIMIT 50;

-- Failed jobs (dead letter)
SELECT name, state, createdon, output
FROM pgboss.job
WHERE state = 'failed'
ORDER BY createdon DESC
LIMIT 50;

-- Job throughput (last 24h)
SELECT name, state, COUNT(*) as count
FROM pgboss.job
WHERE createdon > now() - interval '24 hours'
GROUP BY name, state
ORDER BY name, state;
```

### 5.7 Rollback Strategy (Phase 2)

```
To rollback:
1. Uncomment Tier 2 cron.schedule() lines in jobs/index.js
2. Comment out initPgBoss() and registerPgBossJobs() in app.js
3. Restart backend

pg-boss tables can be left in place (they auto-archive/delete).
To fully remove: DROP SCHEMA pgboss CASCADE;
```

---

## 6. Phase 3: Worker Container Split (Week 5-6, Optional)

If API latency is still impacted by Tier 2 jobs running in the same process, split into separate containers.

### 6.1 Architecture

```
 +-------------------+          +-------------------+
 |  API Container    |          |  Worker Container  |
 |  (Express only)   |          |  (pg-boss only)    |
 |                   |          |                    |
 |  - HTTP routes    |          |  - pg-boss workers |
 |  - Socket.IO      |          |  - Tier 2 jobs     |
 |  - Tier 3 cron    |          |  - Tier 3 cron     |
 |  - NO pg-boss     |          |  - NO Express      |
 |    workers        |          |    listening        |
 +--------+----------+          +--------+-----------+
          |                              |
          +---------- Shared DB ---------+
          |       (Supabase PG)          |
          +------------------------------+
```

### 6.2 Worker Entry Point

New file: `backend/worker.js`

```javascript
require('dotenv').config();
const logger = require('./utils/logger');
const { initPgBoss, stopPgBoss } = require('./jobs/pgBossManager');
const { registerPgBossJobs } = require('./jobs/pgBossJobs');
const { startJobs } = require('./jobs');  // Tier 3 only

async function main() {
  logger.info('[Worker] Starting...');

  const boss = await initPgBoss();
  if (boss) {
    await registerPgBossJobs(boss);
  }
  startJobs();  // Tier 3 node-cron jobs

  logger.info('[Worker] Ready');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('[Worker] Shutting down...');
    await stopPgBoss();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('[Worker] Fatal error:', err);
  process.exit(1);
});
```

### 6.3 Docker Compose Update

```yaml
services:
  pantopus-api:
    build: .
    command: node app.js
    environment:
      - PGBOSS_ENABLED=false  # API doesn't run pg-boss workers
    ports:
      - "8000:8000"

  pantopus-worker:
    build: .
    command: node worker.js
    environment:
      - PGBOSS_ENABLED=true
    # No ports exposed -- worker doesn't serve HTTP
```

### 6.4 Conditional pg-boss in app.js

```javascript
if (process.env.PGBOSS_ENABLED !== 'false') {
  const boss = await initPgBoss();
  if (boss) await registerPgBossJobs(boss);
}
```

### 6.5 Rollback Strategy (Phase 3)

```
To rollback:
1. Remove pantopus-worker from docker-compose.yml
2. Set PGBOSS_ENABLED=true (or remove) in API container
3. Restart

Both containers share the same codebase, so this is just a config change.
```

---

## 7. Migration Timeline

```
 Week 1                Week 2                Week 3                Week 4                Week 5-6
 +===================+======================+===================+======================+====================+
 |  PHASE 1a         |  PHASE 1b            |  PHASE 2a         |  PHASE 2b            |  PHASE 3           |
 |  - job_locks      |  - Deploy Lambda     |  - Install pg-boss|  - Register Tier 2   |  - Worker container |
 |    migration      |    functions         |  - Init manager   |    jobs              |    split           |
 |  - Internal API   |  - Disable Tier 1    |  - Test single    |  - Disable Tier 2    |  - docker-compose  |
 |    endpoints      |    in node-cron      |    job (organicM) |    in node-cron      |    update          |
 |  - Test locally   |  - Monitor 48h       |  - Monitor        |  - Monitor 48h       |  - (Optional)      |
 +===================+======================+===================+======================+====================+

 Checkpoint gates:
 [C1] After 1b: Verify no duplicate payments for 48h before proceeding
 [C2] After 2a: Verify pg-boss schema created, single job runs correctly
 [C3] After 2b: Verify all Tier 2 jobs running via pg-boss for 48h
 [C4] After Phase 3: Compare API p95 latency before/after worker split
```

---

## 8. New Files Summary

### Phase 1

| File | Type | Purpose |
|------|------|---------|
| `database/migrations/xxx_create_job_locks.sql` | Migration | job_locks table + RPC functions |
| `routes/internal.js` (additions) | Route | 10 new `/api/internal/jobs/*` endpoints |
| `pantopus-seeder/src/handlers/job_trigger.py` | Lambda | Generic job trigger handler |
| `pantopus-seeder/deploy/template.yaml` (additions) | SAM | JobTriggerFunction + 10 EventBridge rules |

### Phase 2

| File | Type | Purpose |
|------|------|---------|
| `jobs/pgBossManager.js` | New | pg-boss initialization + lifecycle |
| `jobs/pgBossJobs.js` | New | Tier 2 job registration |
| `app.js` (modifications) | Edit | Add pg-boss init + graceful shutdown |
| `jobs/index.js` (modifications) | Edit | Remove Tier 2 cron registrations |
| `package.json` | Edit | Add `pg-boss` dependency |

### Phase 3 (Optional)

| File | Type | Purpose |
|------|------|---------|
| `worker.js` | New | Worker-only entry point |
| `docker-compose.yml` (modifications) | Edit | Add `pantopus-worker` service |
| `Dockerfile` (modifications) | Edit | Add worker target stage |

---

## 9. Monitoring & Alerting Additions

### CloudWatch Metrics (Phase 1)

| Metric | Namespace | Dimensions |
|--------|-----------|------------|
| `JobCompleted` | `Pantopus/Jobs/{env}` | JobName |
| `JobFailed` | `Pantopus/Jobs/{env}` | JobName |
| `JobSkipped` | `Pantopus/Jobs/{env}` | JobName |

### CloudWatch Alarms (Recommended)

```
- processPendingTransfers: Alert if JobFailed > 0 in 1 hour
- authorizeUpcomingGigs: Alert if JobFailed > 0 in 2 hours
- retryCaptureFailures: Alert if JobFailed > 3 in 1 hour
- Any job: Alert if JobSkipped > 5 in 1 hour (lock contention)
```

### pg-boss Dashboard Query (Phase 2)

```sql
-- Job health dashboard (run periodically or expose via admin API)
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

---

## 10. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Lambda cold start delays job execution | Jobs are not latency-sensitive; 1-5s cold start is acceptable for hourly/15m jobs |
| pg-boss schema migration fails on Supabase | Test on staging first; pg-boss auto-creates schema on `boss.start()` |
| job_locks race condition under load | PostgreSQL INSERT...ON CONFLICT is atomic; the lock function is transactional |
| Backend API unreachable from Lambda | Lambda retry policy (built into EventBridge); also job_locks prevents stale state |
| pg-boss fills up database | `archiveCompletedAfterSeconds: 86400` + `deleteAfterDays: 7` keeps table small |
| Two systems running same job during migration | Always disable node-cron schedule BEFORE enabling Lambda/pg-boss schedule |

---

## 11. Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Financial job double-runs | Possible | Zero (lock-protected) |
| API p95 latency during heavy jobs | Degraded | Stable (pg-boss isolation) |
| Job failure visibility | None (log grep) | CloudWatch + pg-boss tables |
| Job retry on failure | Next cron tick (up to 24h) | 30s with exponential backoff |
| Horizontal scaling safety | Unsafe | Safe (locks + pg-boss singleton) |

---

## 12. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lambda vs dedicated worker for Tier 1 | Lambda | Already have SAM infrastructure; EventBridge gives exactly-once triggering for free |
| Lambda triggers HTTP vs contains job code | HTTP trigger | No need to package Node.js for Lambda; reuses battle-tested job code; simplest migration path |
| pg-boss vs BullMQ for Tier 2 | pg-boss | Uses existing PostgreSQL; no Redis dependency; simpler infrastructure |
| pg-boss vs Lambda for Tier 2 | pg-boss | 2-minute frequency jobs would have excessive cold starts; pg-boss is lower latency |
| Worker split timing | Phase 3 (optional) | Only needed if API latency is measurably impacted after Phase 2 |
| job_locks vs pg_advisory_lock | job_locks table | Provides observability (last_success, last_failure, run_count); pg_advisory_lock is invisible |

---

*This plan is designed for incremental adoption. Each phase is independently deployable, testable, and rollbackable without affecting the others.*
