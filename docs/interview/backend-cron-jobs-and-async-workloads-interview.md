# Backend Cron Jobs And Async Workloads Interview Notes

This document answers the operational and architectural questions around cron jobs, backend scheduled work, Lambda seeder workloads, idempotency, locking, retries, and observability in this repository. It is written in an interview style: direct enough to answer live, but detailed enough to show the engineering tradeoffs behind the current system and the migration path.

## Executive Summary

Many scheduled jobs currently run inside the API process because that was the fastest and lowest-friction way to reuse the backend's existing Node services, Supabase clients, Stripe integration, notification code, and business logic without introducing a separate worker deployment. The API starts the scheduler during boot, and the scheduler registers many `node-cron` jobs in one place.

That design is pragmatic for an early single-container or low-scale deployment, but it is not a robust distributed scheduler. If two backend containers run the same code, both will register the same schedules. The current code relies on per-job idempotency, database predicates, upserts, unique constraints, Stripe or wallet idempotency keys, and some "already processed" checks. Those protections prevent some duplicate harm, but they do not prevent duplicate execution globally.

The correct long-term design is to separate scheduling from execution, use durable queues for per-record work, and use distributed locks or queue uniqueness for singleton jobs. The repository already contains a migration plan in `docs/05-cron-job-migration-plan.md` that points in this direction: move critical singleton jobs to EventBridge/Lambda or a worker, move record-level workloads to a queue such as pg-boss, keep only low-risk maintenance jobs in backend cron, and add job run observability.

My interview answer would be:

> The API-process cron jobs are a transitional architecture. They were chosen for speed and code reuse, not because they are the ideal production scheduler. Today, duplicate execution is prevented only by job-specific idempotency and database guards, not by the scheduler itself. Financial jobs, destructive cleanup, side-effect fanout, and queue consumers need distributed locks or queue semantics. Pure recomputations, upserts, and terminal-state updates are generally safe to rerun. Operationally, I would add durable job run records, CloudWatch or metrics emission for duration and failures, backlog queries for every queue-like table, lock skip metrics, stale-run alarms, and a runbook that starts by proving whether the scheduler stopped, the job is failing, or the backlog is blocked by poison records.

## Current Architecture

The backend server starts scheduled work from the API process. In `backend/app.js`, after the Express server starts listening, it calls `startJobs()`. The scheduler is implemented in `backend/jobs/index.js`, which imports each job module and registers cron schedules through `node-cron`.

There is also a separate Lambda/EventBridge based seeder subsystem under `pantopus-seeder`. Its deployment template schedules Python handlers such as content fetching, posting, cleanup, alert checking, home reminders, mail notifications, no-bid nudges, and briefing work. That subsystem has CloudWatch-native execution and some custom metrics, but it also has queue-consumer race risks in places where rows are selected and then updated without an atomic reserve step.

So there are two async execution models:

1. Backend `node-cron` jobs running inside the API container.
2. Seeder and notification-oriented Lambda jobs scheduled by EventBridge.

The boundary is historical and pragmatic rather than purely architectural. Backend cron owns jobs that are tightly coupled to Node backend services, Stripe flows, wallets, marketplace state, claims, listings, homes, mail, and notifications. Lambda seeder owns content generation, scheduled external data fetch/post flows, and some independent notification/reminder workloads.

## Why Are Many Cron Jobs Run Inside The API Process?

The main reason is code locality. Most of the jobs need the same domain services the API uses: payment state transitions, wallet crediting, Stripe integration, notification creation, mail event creation, home and listing updates, Supabase clients, and application-specific constants. Running them in the API process meant the team could reuse those modules directly without standing up a worker service, packaging a separate runtime, or duplicating environment configuration.

The benefits are real:

- Fast implementation: adding a job is usually just adding a module under `backend/jobs` and registering a schedule.
- Shared runtime: jobs use the same Node version, environment variables, Supabase client setup, service code, logging style, and error helpers as the API.
- Simple deployment: one backend deployment contains both request/response paths and scheduled maintenance.
- Lower operational overhead: no separate worker autoscaling, queue broker, dead-letter queue, dashboard, or IAM surface was required initially.
- Good enough for single-instance assumptions: if only one backend container is ever running, process-local cron is easy to reason about.

Those benefits come with production tradeoffs:

- Horizontal scaling becomes unsafe because every backend instance registers the same schedules.
- A deploy, crash, restart, or memory leak in the API also stops scheduled work.
- A slow job can consume resources in the API process and affect request latency.
- `node-cron` does not provide durable run records, queue depth, distributed locking, retries, or dead-letter handling.
- If a process is down at the scheduled time, the job does not automatically catch up unless the job's query naturally scans old eligible records.
- Overlapping schedules can happen when a job takes longer than its interval.

In an interview, I would describe this as a deliberate early-stage consolidation, not the target architecture for critical production workloads. It optimizes for development speed and domain-code reuse, then needs to be split once reliability and scale matter.

## What Prevents Duplicate Job Execution If Two Backend Containers Run?

At the scheduler level, nothing currently prevents duplicate execution across backend containers.

If two containers boot the API and both call `startJobs()`, both register the same cron schedules. Each process has its own in-memory scheduler. There is no global leader election, database advisory lock, Redis lock, `job_locks` table, or queue uniqueness guarantee around the schedule registration itself.

What prevents duplicate damage today is uneven and job-specific:

- Status predicates, such as updating only rows still in a pending or initiated state.
- Terminal-state transitions, such as archiving expired records or expiring claims.
- Upserts, where repeating the same computation overwrites the same target row.
- Unique constraints, such as unique user/stamp combinations.
- Wallet idempotency keys, such as payment-specific wallet credit keys.
- Stripe-side or local payment state checks in some payment flows.
- Notification history or metadata checks before sending some messages.
- Per-record attempt counters in some retry jobs.

These are useful protections, but they are not a complete distributed execution strategy. A check-then-insert notification pattern can still race. A job that selects rows and sends emails before marking them processed can double-send. A job that creates a Stripe PaymentIntent without an idempotency key can create duplicate external side effects. A job that updates counters based on rows selected before the update can double-decrement if the update predicate is not strong enough.

The right answer depends on the workload:

- Singleton scheduled jobs should acquire a distributed lock before running.
- Per-record workloads should be moved to a queue where each record is atomically claimed by one worker.
- External side effects should carry idempotency keys that are stable per business object.
- Notification sends should have durable deduplication keys and unique constraints.
- Recomputations should be written as idempotent upserts.

## Which Jobs Are Safe To Run More Than Once?

"Safe to run more than once" does not mean "safe to run concurrently with no thought." It means rerunning the job should converge the database to the same intended state and should not duplicate irreversible external side effects. The safest jobs are pure recomputations, upserts, and terminal-state maintenance.

### Strongly Idempotent Or Mostly Safe

These are the jobs I would be most comfortable rerunning manually:

| Job | Why it is relatively safe |
| --- | --- |
| `computeAvgResponseTime` | Recomputes derived response-time data. Repeating the calculation should converge to the same value. |
| `computeReputation` | Recomputes reputation or derived score data. Repeated execution should overwrite or converge. |
| `recomputeUtilityScores` | Derived scoring workload. Repetition is usually acceptable if writes are upserts or replacements. |
| `refreshDiscoveryCache` | Cache refresh work. Re-running should refresh the same cache state. |
| `billBenchmarkRefresh` | Benchmark refresh uses upsert-style behavior and is naturally repeatable. |
| `autoArchivePosts` | Terminal status update. If rows are already archived, they should no longer match. |
| `expireInitiatedHomeClaims` | Uses a phase/status predicate so already-expired claims stop matching. |
| `reconcileHomeHouseholdResolution` | Reconciliation-style job that should converge records to the correct state. |
| `trustAnomalyDetection` | Mostly advisory detection; still needs deduplication for flags, but repeating detection is not inherently destructive. |
| `expireGigs` | Usually a terminal-state update if implemented with status predicates. |
| `expirePopupBusinesses` | Expiration maintenance; repeated runs should no-op after the first update. |
| `vacationHoldExpiry` | Expiration maintenance; repeated runs should no-op after eligible records are updated. |

### Mostly Idempotent But Side Effects Can Duplicate

These jobs may keep the database mostly correct, but can duplicate notifications, emails, audit logs, external API calls, or counters if run concurrently:

| Job | Main duplicate risk |
| --- | --- |
| `mailDayNotification` | Daily mail event or notification can duplicate without a unique key. |
| `mailInterruptNotification` | Check-then-insert notification/event logic can race. |
| `mailPartyExpiry` | Session expiration may be safe, but events and notifications can duplicate. |
| `mailEscrowExpiry` | State update can be safe; user-facing notification can duplicate. |
| `vaultWeeklyDigest` | Digest sends can duplicate unless keyed by user and digest period. |
| `stampAwarder` | Unique constraints protect stamp ownership, but races can create insert errors or duplicate downstream effects. |
| `processClaimWindows` | State may converge, but notifications and audit entries can duplicate. |
| `notifyClaimWindowExpiry` | Metadata checks are not enough without a unique notification key. |
| `validateHomeCoordinates` | Duplicate Mapbox/API calls can happen before `coordinate_validation` is written. |
| `neighborhoodPreviewRefresh` | Upsert is safe, milestone notifications can duplicate. |
| `autoRemindWorker` | Reminder count and send timing can race without compare-and-set updates. |
| `supportTrainReminders` | Last-reminder checks can race and double-send. |
| `draftBusinessReminder` | Sends before incrementing or without strong claim semantics can duplicate. |
| `monthlyReceiptJob` | Receipt upsert may be safe, but notification/email send can duplicate. |
| `communityModeration` | Reprocessing may be acceptable, but moderation actions and user notifications need idempotency keys. |

### Not Safe Without Stronger Locking Or Queue Semantics

These jobs should not rely on "probably idempotent" behavior:

| Job | Why it needs stronger protection |
| --- | --- |
| `processPendingTransfers` | Money movement and wallet crediting. It has some strong idempotency, but the blast radius is high. |
| `retryCaptureFailures` | Stripe capture retries and attempt counters. Races can consume attempts or duplicate external calls. |
| `authorizeUpcomingGigs` | Can create external Stripe PaymentIntents; must be locked or idempotency-keyed per gig/payment. |
| `expireUncapturedAuthorizations` | Financial authorization lifecycle. Repeated cancellation may be safe externally, but state transitions need consistency. |
| `checkAndAlertStuckPayments` | Alert fanout can spam operators without deduplication. |
| `expirePendingPaymentBids` | Payment authorization cancellation plus bid state changes and possible counter updates. |
| `cleanupGhostBusinesses` | Destructive cleanup. Even if predicates are careful, it should run as a singleton. |
| `chatRedactionJob` | Privacy/security cleanup. Re-running can be safe, but it deserves singleton control and auditability. |
| `expireListings` | Listing state update plus inventory slot counter mutation can race. |
| `expireOffers` | Offer expiration, active-offer counters, and notifications can race. |
| Seeder `poster` Lambda | Selecting queued content then posting externally can double-post without atomic reservation. |

## Which Jobs Need Distributed Locks?

Distributed locks are needed when the job is intended to be singleton work and duplicate execution could create external side effects, corrupt counters, over-alert, or put money/privacy at risk.

The jobs that most clearly need distributed locks or queue uniqueness are:

| Category | Jobs | Required protection |
| --- | --- | --- |
| Money movement | `processPendingTransfers`, `retryCaptureFailures`, `authorizeUpcomingGigs`, `expireUncapturedAuthorizations`, `expirePendingPaymentBids` | Per-payment queue jobs, stable idempotency keys, status compare-and-set, Stripe idempotency keys, and a singleton scheduler lock. |
| Destructive/privacy cleanup | `cleanupGhostBusinesses`, `chatRedactionJob` | Singleton job lock, dry-run metrics, audit log, and conservative predicates. |
| Counter mutation | `expireListings`, `expireOffers`, marketplace inventory or offer counters | Atomic SQL updates, per-record claiming, or database functions that update state and counters in one transaction. |
| Notification/email fanout | `mailDayNotification`, `mailInterruptNotification`, `vaultWeeklyDigest`, `supportTrainReminders`, `draftBusinessReminder`, `monthlyReceiptJob`, `notifyClaimWindowExpiry`, alert jobs | Unique notification keys, send ledger, per-user-period queue uniqueness, and lock/claim semantics before sending. |
| External API heavy jobs | `validateHomeCoordinates`, content fetchers, briefing composition, sports/event fetchers | Queue reservation, rate limits, retry backoff, and poison record handling. |
| Queue consumers | Seeder poster, briefing cleanup/retry, any table-backed queue poller | Atomic `queued -> processing` claim with `locked_until`, worker id, attempts, and dead-letter state. |

I would not use one global lock for everything. That reduces duplicate execution but also creates a bottleneck and hides per-record failures. The better design is layered:

- Scheduler-level lock: only one scheduler enqueues due work.
- Job-level lock: only one instance runs a singleton batch job.
- Record-level lock or queue claim: only one worker processes a given payment, notification, post, claim, or content item.
- External idempotency key: Stripe, email, push, and other external side effects use deterministic business keys.

For example, `processPendingTransfers` should not just be "one big locked cron." It should enqueue one transfer job per eligible payment and process each payment with a deterministic idempotency key such as `transfer:{payment_id}` or `wallet_credit:{payment_id}:{recipient_id}`.

## How Do You Observe Job Duration, Failure Rate, And Backlog?

### What Exists Today

The backend scheduler wraps jobs in a helper that logs start, finish, failure, and elapsed time. That gives basic process logs for duration and failure visibility, but logs alone are not enough for production operations. They do not provide durable run history, skip counts, backlog depth, SLOs, or easy alerting when a job silently stops.

The Lambda seeder side has stronger native infrastructure because EventBridge and Lambda emit CloudWatch logs and metrics. Some handlers publish custom metrics, such as queue depth or notification counts. That is closer to the target model, but it still needs consistent application-level run records and poison-record reporting.

The migration plan describes a better model: emit metrics such as `JobCompleted`, `JobFailed`, and `JobSkipped`, add alarms for failures and stale runs, and use queue depth queries for pg-boss or table-backed queues.

### What I Would Add

I would add a durable `job_runs` table:

```sql
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped', 'timed_out')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  records_seen integer default 0,
  records_processed integer default 0,
  records_failed integer default 0,
  error_message text,
  error_stack text,
  worker_id text,
  lock_acquired boolean default false,
  created_at timestamptz not null default now()
);
```

For queue-like work, I would add or standardize fields on the work table:

```sql
status text,
attempts integer not null default 0,
next_run_at timestamptz,
locked_at timestamptz,
locked_until timestamptz,
locked_by text,
last_error text,
dead_lettered_at timestamptz
```

Then I would emit metrics on every run:

- `job.duration_ms`
- `job.success_count`
- `job.failure_count`
- `job.skipped_lock_count`
- `job.records_processed`
- `job.records_failed`
- `job.backlog_count`
- `job.backlog_oldest_age_seconds`
- `job.poison_count`

The most important dashboards are:

- Last successful run by job.
- Failure rate by job.
- P95 and max job duration.
- Current backlog count.
- Oldest pending record age.
- Lock skips and stale locks.
- Dead-letter or poison records by queue.
- External API error rates for Stripe, email, Mapbox, and content generation.

### Example Backlog Queries

Payment transfer backlog:

```sql
select
  count(*) as pending_count,
  min(created_at) as oldest_pending,
  extract(epoch from now() - min(created_at)) as oldest_age_seconds
from "Payment"
where status in ('release_pending', 'transfer_pending', 'capture_succeeded');
```

Seeder queue backlog:

```sql
select
  status,
  count(*) as count,
  min(created_at) as oldest_item
from seeder_content_queue
group by status
order by status;
```

Failed or stuck seeder records:

```sql
select id, status, attempts, updated_at, last_error
from seeder_content_queue
where status in ('failed', 'processing')
order by updated_at asc
limit 50;
```

Expected scheduler health:

```sql
select job_name, max(finished_at) as last_finished_at
from job_runs
where status = 'succeeded'
group by job_name
order by last_finished_at asc;
```

Jobs that may have silently stopped:

```sql
select job_name, max(started_at) as last_started_at
from job_runs
group by job_name
having max(started_at) < now() - interval '2 hours'
order by last_started_at asc;
```

Oldest pending pg-boss style queue items:

```sql
select name, count(*) as queued, min(created_on) as oldest
from pgboss.job
where state in ('created', 'retry')
group by name
order by oldest asc;
```

## What Happens When A Job Exceeds Its Schedule Interval?

In the current backend `node-cron` model, a job can overlap with its next scheduled run unless the code explicitly prevents it. If a job scheduled every minute takes three minutes, the next tick can start another invocation in the same process. If two backend containers are running, that overlap can multiply across containers.

The consequences depend on the job:

- Pure recomputations waste CPU but usually converge.
- Notification jobs can double-send.
- Financial jobs can race state transitions or external API calls.
- Counter mutation jobs can produce incorrect counts.
- Long jobs can compete with API request handling for CPU, memory, database connections, and outbound API rate limits.

Lambda/EventBridge has a similar issue in a different form. If a Lambda schedule fires every minute and a previous invocation is still running, AWS can run another concurrent invocation unless concurrency is constrained or the function implements its own locking/claiming.

The production behavior I want is explicit:

- If a singleton job is already running, the next scheduled invocation should skip and emit `JobSkipped`.
- If a job exceeds an expected duration, it should emit a warning or alarm.
- If a lock is stale, a later worker should be able to take over after `locked_until`.
- If a per-record worker is slow, other records can continue processing, but that record remains locked until timeout.
- If backlog age grows, alert even if individual job invocations are succeeding.

The key point is that "exceeds interval" should be an observable operational state, not an accidental overlap.

## How Are Retries And Poison Records Handled?

### Current State

Retries are currently handled inconsistently by subsystem:

- Some payment jobs maintain attempt counters or max attempts.
- Transfer processing has idempotency protections and stranded-transfer recovery patterns.
- Some Lambda seeder flows mark records as `failed`, `skipped`, `posted`, or similar terminal states.
- Briefing cleanup can reset stale composing work and retry certain failed records once.
- Alert and notification systems use history tables or metadata checks to reduce duplicates.
- The generic backend cron wrapper catches job-level exceptions and logs failure, but it does not automatically retry with backoff or move a record to a dead-letter state.

That means there is no single poison-record model across the system. Some jobs can get stuck silently if one record always throws. Other jobs may keep retrying the same bad record every schedule interval unless they mark it failed.

### Target Pattern

For queue or table-backed work, I would standardize this lifecycle:

```text
queued -> processing -> succeeded
queued -> processing -> retry
retry -> processing -> succeeded
retry -> processing -> dead
```

Each work item should carry:

- `attempts`
- `max_attempts`
- `next_run_at`
- `locked_by`
- `locked_until`
- `last_error`
- `last_error_at`
- `dead_lettered_at`

Retry delays should use exponential backoff with jitter:

```text
attempt 1: retry after 1 minute
attempt 2: retry after 5 minutes
attempt 3: retry after 15 minutes
attempt 4: retry after 1 hour
attempt 5: dead-letter
```

Poison records should not block the whole queue. After max attempts, they should move to a dead-letter state with enough context to debug and replay:

- Business object id.
- Error class and message.
- Last payload.
- Worker version or deployment sha.
- Attempt count.
- First failure and last failure timestamps.

Manual replay should be deliberate. An operator should be able to fix the data or code, then move the item from `dead` back to `queued` with a note.

## Why Are Some Async Workloads In Lambda Seeder Code While Others Are In Backend Cron?

The split comes from operational fit and implementation history.

Lambda/EventBridge is better for workloads that are naturally scheduled, isolated, external-service-heavy, and not tightly coupled to the request path:

- Content fetching.
- Content posting.
- Sports/event data ingestion.
- Briefing scheduling and cleanup.
- Scheduled alert checks.
- Some reminder and notification jobs.
- Queue-depth metrics.

Those jobs benefit from AWS-managed scheduling, native CloudWatch logs, independent scaling, and not consuming API process resources.

Backend cron is better, or at least was easier, for workloads that need direct access to Node backend domain services:

- Stripe authorization and capture flows.
- Wallet crediting and payment state transitions.
- Listing, offer, gig, claim, and home lifecycle maintenance.
- Existing notification service calls.
- Marketplace and reputation recomputation.
- Data cleanup that shares backend models and constants.

The current boundary is not perfect. It reflects where the code already lived and which runtime had the necessary libraries. A more mature architecture would not decide "Lambda versus backend cron" per se. It would decide:

- Is this singleton scheduling, per-record work, or event-driven work?
- Does it need queue semantics?
- What is the blast radius of duplicate execution?
- Which runtime owns the domain logic?
- What observability and retry model does it need?

Then the implementation could be:

- EventBridge only enqueues due work.
- pg-boss or SQS owns work distribution.
- Backend worker containers process Node-domain jobs.
- Lambda processes isolated external-ingestion jobs.
- API containers serve API traffic only.

## What Would I Move To A Queue First?

I would move work in order of blast radius and queue fit.

### 1. Payment And Wallet Work

First priority:

- `processPendingTransfers`
- `retryCaptureFailures`
- `authorizeUpcomingGigs`
- `expireUncapturedAuthorizations`
- `expirePendingPaymentBids`

These involve money movement, Stripe side effects, wallet balances, and user trust. They should become per-payment or per-gig work items with:

- Deterministic idempotency keys.
- Atomic status compare-and-set.
- Attempt counters.
- Dead-letter records.
- Operator replay.
- Alerts on oldest pending age.

This is the highest-value queue migration because it reduces financial risk and improves debuggability.

### 2. Notification And Email Fanout

Second priority:

- `mailDayNotification`
- `mailInterruptNotification`
- `mailPartyExpiry`
- `mailEscrowExpiry`
- `vaultWeeklyDigest`
- `supportTrainReminders`
- `draftBusinessReminder`
- `monthlyReceiptJob`
- `notifyClaimWindowExpiry`
- Alert notification jobs

These are classic queue workloads. Each notification should have a unique business key such as:

```text
notification:{type}:{user_id}:{business_object_id}:{period}
```

The send ledger should enforce uniqueness before calling external providers. That turns "did we send twice?" into a database property instead of a timing assumption.

### 3. Seeder Poster And Content Queue Consumers

Third priority:

- Seeder poster.
- Briefing composition.
- Content queue processing.

The poster is a high-risk queue consumer because posting externally is an irreversible side effect. The worker should atomically reserve one queued record:

```sql
update seeder_content_queue
set status = 'processing',
    locked_by = :worker_id,
    locked_until = now() + interval '10 minutes',
    attempts = attempts + 1
where id = (
  select id
  from seeder_content_queue
  where status = 'queued'
    and (next_run_at is null or next_run_at <= now())
  order by priority desc, created_at asc
  for update skip locked
  limit 1
)
returning *;
```

Then only the worker that owns the lock can post it.

### 4. Counter And Marketplace State Mutations

Fourth priority:

- `expireListings`
- `expireOffers`
- Active inventory slot counts.
- Active offer counts.

These can often be fixed with stronger SQL functions rather than a queue alone. The important property is that state changes and counter updates happen atomically.

### 5. External API Validation

Fifth priority:

- `validateHomeCoordinates`
- Discovery and enrichment jobs.

These are not usually high blast radius, but they can waste money or hit rate limits if duplicated. A queue provides rate limiting, retries, and poison handling.

## Operational Runbook When Jobs Silently Stop

The first step is to determine which failure mode occurred:

- The scheduler process is not running.
- The scheduler is running, but a specific job is failing.
- The job is succeeding, but processing zero records due to a query or data issue.
- The job is running too slowly and backlog is growing.
- The job is blocked by a stale lock.
- The external dependency is failing.
- Poison records are repeatedly failing and exhausting attempts.

### 1. Confirm The Deployment And Scheduler Are Alive

Check the backend deployment:

- Is at least one backend container running?
- Did the latest deploy restart the API successfully?
- Does the server log show `startJobs()` or job registration?
- Are environment variables present?
- Is the process crashing or restarting?
- Did autoscaling change the number of containers?

For Lambda jobs:

- Is the EventBridge rule enabled?
- Did the Lambda function run at the expected time?
- Are there recent CloudWatch logs?
- Did IAM, secrets, VPC, timeout, or memory configuration change?

### 2. Check Last Successful Run

If `job_runs` exists, query the last success and last failure by job:

```sql
select job_name, status, started_at, finished_at, duration_ms, error_message
from job_runs
where job_name = :job_name
order by started_at desc
limit 20;
```

If durable run records do not exist yet, inspect structured logs by job name and deployment version.

### 3. Measure Backlog And Oldest Age

For every job there should be a known backlog query. Examples:

- Pending payments older than expected.
- Queued seeder content older than expected.
- Notifications due but unsent.
- Failed records with attempts at max.
- Rows in `processing` past `locked_until`.
- Stuck claims, offers, listings, or authorizations.

Backlog age is often more useful than simple failure count. A job can be "green" while the oldest item is six hours old.

### 4. Check Locks And Overlap

If a distributed lock table exists:

```sql
select *
from job_locks
where job_name = :job_name;
```

Look for:

- `locked_until` in the past but not released.
- A worker id from a dead deployment.
- Repeated lock skips.
- A lock TTL shorter than actual job duration.
- A lock TTL longer than the operational recovery target.

Stale locks should be recoverable by TTL. Manual unlock should require confirming no worker is still running.

### 5. Inspect Recent Errors And Poison Records

Find records with repeated failures:

```sql
select id, status, attempts, last_error, updated_at
from job_work_items
where job_name = :job_name
  and status in ('retry', 'dead')
order by updated_at desc
limit 50;
```

Classify failures:

- Data validation issue.
- Missing related record.
- External provider timeout.
- Authentication or secret issue.
- Schema drift.
- Rate limit.
- Code regression from latest deploy.

### 6. Decide Whether To Pause, Drain, Or Replay

For high-risk jobs like payments, do not blindly rerun the whole job. Use a controlled replay:

1. Pause schedule or prevent new enqueues if needed.
2. Fix the root cause.
3. Select a small batch of affected records.
4. Replay with idempotency keys.
5. Verify database state and external provider state.
6. Increase batch size.
7. Re-enable schedule.

For low-risk recompute jobs, manual rerun is usually acceptable after confirming the query and runtime.

### 7. Communicate And Postmortem

The incident closeout should include:

- Time detected.
- Actual start time.
- Jobs affected.
- User-visible impact.
- Backlog size and oldest age.
- Root cause.
- Replay or recovery actions.
- Data corrections.
- Monitoring gap that allowed silent stop.
- Follow-up owner and deadline.

The most important postmortem question is: "What signal should have paged us before a user noticed?"

## Job-By-Job Classification

This table is intentionally conservative. A job listed as "needs lock" may still be partly idempotent internally, but the operational risk warrants stronger protection.

| Job | Current risk | Idempotency expectation | Recommended execution model |
| --- | --- | --- | --- |
| `authorizeUpcomingGigs` | Duplicate Stripe PaymentIntents or authorization attempts. | Not safe enough without per-gig idempotency. | Queue per gig/payment; Stripe idempotency key; distributed scheduler lock. |
| `processPendingTransfers` | Money movement, wallet credit, transfer state. | Partly protected by wallet idempotency and state checks. | Queue per payment; compare-and-set state; dead-letter. |
| `retryCaptureFailures` | Duplicate capture attempts, attempt counter races. | Attempt caps help but do not fully serialize. | Queue per payment; lock per payment; max attempts. |
| `expireUncapturedAuthorizations` | Financial authorization lifecycle. | Repeated cancellation may be safe externally, but local state must be consistent. | Singleton lock plus per-payment idempotency. |
| `checkAndAlertStuckPayments` | Duplicate operator alerts. | Advisory only, but can create alert noise. | Singleton lock and alert dedup key. |
| `expirePendingPaymentBids` | Cancels payment authorization and mutates bid state. | Needs stronger protection. | Queue per bid/payment; lock or CAS update. |
| `autoArchivePosts` | Archives old posts. | Mostly safe terminal status update. | Keep cron or move to low-priority maintenance queue. |
| `mailDayNotification` | Duplicate daily mail notifications. | Needs per-user/day dedup. | Notification queue with unique send key. |
| `mailInterruptNotification` | Duplicate interrupt events or notifications. | Check-then-insert can race. | Notification queue with unique event key. |
| `mailPartyExpiry` | Duplicate expiry events. | State update likely safe; side effects need dedup. | Lock or queue per party/session. |
| `mailEscrowExpiry` | Duplicate escrow notifications. | State update likely safe; side effects need dedup. | Queue with unique notification key. |
| `vaultWeeklyDigest` | Duplicate weekly digest. | Needs per-user/week dedup. | Notification queue. |
| `vacationHoldExpiry` | Expires holds. | Terminal update should be safe. | Backend cron acceptable with lock preferred. |
| `stampAwarder` | Race on unique stamp insert. | Unique constraint protects final state. | Queue or idempotent upsert; handle duplicate insert gracefully. |
| `communityModeration` | Duplicate moderation actions or notifications. | Depends on action idempotency. | Queue per moderation item. |
| `computeAvgResponseTime` | Wasted recompute. | Safe derived-data recompute. | Backend cron acceptable. |
| `organicMatch` | Duplicate matching or recommendations. | Depends on match table uniqueness. | Queue if side effects; otherwise lock batch run. |
| `trustAnomalyDetection` | Duplicate flags or alerts. | Needs unique anomaly key. | Singleton lock plus dedup. |
| `recomputeUtilityScores` | Wasted recompute. | Safe derived-data recompute. | Backend cron acceptable or pg-boss batch. |
| `expireListings` | Inventory counter races. | Status update may be safe; counters risky. | Atomic SQL function or queue per listing. |
| `expireOffers` | Active offer counter and notification races. | Needs stronger CAS and dedup. | Atomic SQL function or queue per offer. |
| `computeReputation` | Wasted recompute. | Safe derived-data recompute. | Backend cron acceptable. |
| `refreshDiscoveryCache` | Wasted refresh. | Safe cache refresh. | Backend cron acceptable. |
| `expireGigs` | Terminal status update. | Usually safe with status predicate. | Backend cron acceptable with singleton lock. |
| `processClaimWindows` | Duplicate notifications and audit logs. | State may converge; side effects need dedup. | Queue per claim/window. |
| `validateHomeCoordinates` | Duplicate Mapbox calls and rate limits. | Final state likely safe. | Queue per home with lock and rate limit. |
| `notifyClaimWindowExpiry` | Duplicate notifications. | Metadata check can race. | Notification queue with unique key. |
| `expireInitiatedHomeClaims` | Terminal phase update. | Safe with phase predicate. | Backend cron acceptable. |
| `reconcileHomeHouseholdResolution` | Reconciliation work. | Safe if deterministic. | Backend cron acceptable. |
| `chatRedactionJob` | Privacy/security cleanup. | Re-run may be safe, but high importance. | Singleton lock and audit run records. |
| `cleanupGhostBusinesses` | Destructive deletion. | Re-run may no-op, but destructive. | Singleton lock, dry-run metric, audit log. |
| `expirePopupBusinesses` | Terminal expiration. | Mostly safe. | Backend cron acceptable with lock preferred. |
| `draftBusinessReminder` | Duplicate reminders. | Needs per-business/reminder dedup. | Notification queue. |
| `billBenchmarkRefresh` | Upsert refresh. | Safe. | Backend cron acceptable. |
| `monthlyReceiptJob` | Duplicate receipt emails/notifications. | Receipt row may upsert; send can duplicate. | Queue per user/month with unique send key. |
| `neighborhoodPreviewRefresh` | Duplicate milestone notifications. | Preview upsert safe; notification risky. | Queue or lock plus notification dedup. |
| `autoRemindWorker` | Duplicate worker reminders. | Needs compare-and-set on reminder state. | Queue per gig/user reminder. |
| `supportTrainReminders` | Duplicate support reminders. | Last-sent checks can race. | Queue with unique reminder key. |

## Design I Would Build Next

The target architecture should separate four concerns:

1. Scheduling: deciding that work is due.
2. Claiming: ensuring exactly one worker owns a specific job or record.
3. Execution: doing the domain work with idempotency.
4. Observation: recording what happened, how long it took, and what is stuck.

### Scheduler

Use EventBridge or one lightweight scheduler process to enqueue due work. It should not perform large amounts of business logic itself. For jobs that remain singleton, use a database lock:

```sql
create table job_locks (
  job_name text primary key,
  locked_by text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);
```

Acquire lock by inserting or updating only expired locks:

```sql
insert into job_locks (job_name, locked_by, locked_until)
values (:job_name, :worker_id, now() + :ttl)
on conflict (job_name) do update
set locked_by = excluded.locked_by,
    locked_until = excluded.locked_until,
    updated_at = now()
where job_locks.locked_until < now()
returning *;
```

If no row is returned, the job is already owned and this invocation should skip with a metric.

### Queue Workers

Use pg-boss, SQS, or a Postgres-backed queue for per-record work. The claim operation must be atomic. A worker should never select a row and then later mark it processing in a separate non-transactional step.

### Idempotency

Every external side effect needs a deterministic key:

- Stripe: per payment/gig authorization or capture key.
- Wallet credit: per payment/recipient credit key.
- Email: per user/template/business object/period key.
- Push notification: per user/event key.
- Content posting: per content item/channel key.
- Alerting: per alert type/object/time bucket key.

Idempotency should be enforced as close to the side effect as possible. For internal side effects, that means unique constraints or upserts. For external providers, use provider idempotency keys when supported and maintain an internal send ledger regardless.

### Observability

Every job run should produce:

- A durable `job_runs` row.
- A success/failure metric.
- Duration metric.
- Records processed count.
- Backlog count and oldest age.
- Structured logs with `job_name`, `run_id`, `worker_id`, and deployment sha.

Every queue should expose:

- Pending count.
- Retry count.
- Dead count.
- Oldest pending age.
- Processing rows past `locked_until`.
- Attempts distribution.

### Failure Policy

Failure behavior should be explicit:

- Record-level failure should not fail the whole batch unless the batch cannot safely continue.
- Retriable errors should get backoff and jitter.
- Permanent data errors should dead-letter.
- External rate limits should slow down the queue, not create duplicate work.
- Poison records should be visible and replayable.

## Interview-Ready Answers

### Why are many cron jobs run inside the API process?

Because the earliest version optimized for code reuse and operational simplicity. The jobs needed backend domain services, Supabase clients, Stripe code, notification code, and shared configuration. Running them in the API process avoided a separate worker deployment. That is acceptable under a single-instance assumption, but it is not the target design for critical production jobs because it couples scheduling to API uptime and makes horizontal scaling unsafe.

### What prevents duplicate job execution if two backend containers run?

At the scheduler level, nothing. Both containers will register the same `node-cron` schedules. Duplicate harm is reduced only by job-specific idempotency: status predicates, upserts, unique constraints, wallet idempotency keys, and notification history checks. That is not enough for all jobs. Critical jobs need distributed locks, queue uniqueness, and external idempotency keys.

### Which jobs are safe to run more than once?

Pure recomputations, cache refreshes, upserts, and terminal-state updates are generally safe: response-time computation, reputation computation, utility score recomputation, discovery cache refresh, benchmark refresh, post archiving, claim expiration, household reconciliation, and similar maintenance jobs. Jobs that send notifications, mutate counters, call Stripe, delete data, or post external content are not safely repeatable unless they have strong idempotency keys and lock/claim semantics.

### Which jobs need distributed locks?

Financial jobs, destructive cleanup, privacy cleanup, notification fanout, queue consumers, external posting, and counter mutation jobs need locks or queue semantics. The highest-priority examples are payment transfer processing, capture retry, upcoming authorization, authorization expiration, pending-payment bid expiration, ghost business cleanup, chat redaction, listing and offer expiration, monthly receipts, reminder jobs, and the seeder poster.

### How do you observe job duration, failure rate, and backlog?

Today there are logs and some Lambda/CloudWatch metrics. The proper implementation is a durable `job_runs` table plus metrics for duration, success, failure, skipped-lock runs, records processed, records failed, backlog count, oldest backlog age, and poison records. Every queue-like table needs a backlog query, and every critical job needs an alarm on stale success, high failure rate, and oldest pending age.

### What happens when a job exceeds its schedule interval?

Currently it can overlap with its next invocation, and multiple backend containers can multiply the overlap. That can be harmless for recomputes but dangerous for payments, notifications, counters, and external posts. The target behavior is to skip overlapping singleton runs with a metric, or process per-record queue work where each record has a lock timeout and retries.

### How are retries and poison records handled?

Today retries are inconsistent: some jobs have attempt counters, some mark failed records, some rely on logs, and some Lambda jobs reset stale records. The target is a standard queue lifecycle with `attempts`, `next_run_at`, `locked_until`, `last_error`, exponential backoff, max attempts, and a dead-letter state. Poison records should be visible, not block the whole job, and be manually replayable after a fix.

### Why are some async workloads in Lambda seeder code while others are in backend cron?

Lambda seeder workloads are isolated, scheduled, external-service-heavy jobs that fit EventBridge and CloudWatch well. Backend cron jobs are tightly coupled to Node backend domain services such as payments, wallets, marketplace state, claims, homes, mail, and notifications. The split is pragmatic and historical. The future boundary should be based on queue semantics and ownership of domain logic rather than simply Lambda versus backend cron.

### What would you move to a queue first?

I would move payment and wallet workflows first because duplicate execution has the highest blast radius. Then I would move notification/email fanout, then seeder posting/content queue consumers, then listing/offer counter mutation, then external API validation and enrichment. That sequence reduces financial risk first, then user-facing duplicate communication, then irreversible external posting and operational cost.

### What is the operational runbook when jobs silently stop?

Confirm whether the scheduler or Lambda trigger is alive, check last successful run, measure backlog and oldest age, inspect logs and recent deploys, check locks or stale processing records, identify poison records, and decide whether to pause, drain, or replay. For payments, replay only a small controlled batch with idempotency keys. After recovery, add the missing alert that would have detected the issue before users did.

## Repository References

Useful files for reviewing the current implementation:

- `backend/app.js`: API boot path that starts scheduled jobs.
- `backend/jobs/index.js`: central `node-cron` registration and job wrapper.
- `backend/jobs/processPendingTransfers.js`: payment transfer processing and idempotency-oriented logic.
- `backend/jobs/authorizeUpcomingGigs.js`: upcoming payment authorization job.
- `backend/jobs/retryCaptureFailures.js`: capture retry job.
- `backend/jobs/expirePendingPaymentBids.js`: pending-payment bid expiration.
- `backend/jobs/expireListings.js`: listing expiration and inventory counter behavior.
- `backend/services/listingOfferService.js`: stale offer expiration and counter behavior.
- `backend/services/walletService.js`: wallet credit idempotency keys.
- `backend/stripe/paymentStateMachine.js`: local payment state transition helper.
- `backend/services/alertingService.js`: alerting helpers used by payment and operational jobs.
- `docs/05-cron-job-migration-plan.md`: migration plan and job classification.
- `pantopus-seeder/deploy/template.yaml`: Lambda/EventBridge schedule definitions.
- `pantopus-seeder/src/handlers/fetcher.py`: seeder content fetch and queue metrics.
- `pantopus-seeder/src/handlers/poster.py`: seeder posting queue consumer.
- `pantopus-seeder/src/handlers/briefing_cleanup.py`: briefing retry and cleanup behavior.

## Bottom Line

The current system is understandable: it consolidated scheduled work in the API process to ship quickly and reuse domain code. But the reliability boundary is now clear. The scheduler itself does not prevent duplicate execution across containers, so safety depends on each job's idempotency. Recomputations and terminal updates are mostly safe; payments, notifications, destructive cleanup, queue consumers, and external side effects need distributed locks, queues, and deterministic idempotency keys.

The engineering direction I would defend in an interview is incremental hardening:

1. Add durable job run records and metrics.
2. Add distributed locks for singleton jobs.
3. Move financial and notification work to queues first.
4. Standardize retries and poison-record handling.
5. Keep only genuinely low-risk maintenance jobs in backend cron.
6. Make backlog age and stale success the primary operational alerts.

