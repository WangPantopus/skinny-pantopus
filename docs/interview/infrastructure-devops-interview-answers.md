# Infrastructure and DevOps Interview Answers

This document expands the interview answers for Pantopus infrastructure and operations. It is written as if I built and operated this codebase, while staying honest about what the repository currently proves.

## Repo Evidence

Key files behind these answers:

- Backend deployment: [../../.github/workflows/deploy-backend.yml](../../.github/workflows/deploy-backend.yml)
- Backend rollback: [../../.github/workflows/rollback-backend.yml](../../.github/workflows/rollback-backend.yml)
- Release notifications: [../../.github/workflows/release-notify.yml](../../.github/workflows/release-notify.yml)
- Backend container: [../../backend/Dockerfile](../../backend/Dockerfile)
- Local compose: [../../docker-compose.yml](../../docker-compose.yml)
- Express and Socket.IO app: [../../backend/app.js](../../backend/app.js)
- Socket.IO implementation: [../../backend/socket/chatSocketio.js](../../backend/socket/chatSocketio.js)
- Logger: [../../backend/utils/logger.js](../../backend/utils/logger.js)
- APM middleware: [../../backend/middleware/apm.js](../../backend/middleware/apm.js)
- Alerting service: [../../backend/services/alertingService.js](../../backend/services/alertingService.js)
- Payment ops alerts: [../../backend/routes/paymentOps.js](../../backend/routes/paymentOps.js)
- Stripe webhooks: [../../backend/stripe/stripeWebhooks.js](../../backend/stripe/stripeWebhooks.js)
- Backend jobs: [../../backend/jobs/index.js](../../backend/jobs/index.js)
- Seeder SAM template: [../../pantopus-seeder/deploy/template.yaml](../../pantopus-seeder/deploy/template.yaml)
- Seeder documentation: [../04-lambda-functions-seeder.md](../04-lambda-functions-seeder.md)
- Job and realtime documentation: [../03-jobs-stripe-realtime.md](../03-jobs-stripe-realtime.md)
- Cron migration plan: [../05-cron-job-migration-plan.md](../05-cron-job-migration-plan.md)
- Web proxy config: [../../frontend/apps/web/next.config.js](../../frontend/apps/web/next.config.js)

## Executive Position

Pantopus currently uses a deliberately simple production topology:

- Next.js web app on Vercel.
- Express 5 backend with Socket.IO in a Docker container on EC2.
- Supabase-managed Postgres/Auth/Storage as the primary data and auth platform.
- AWS S3/CloudFront for media.
- AWS Lambda plus EventBridge for the Python seeder and notification jobs.
- In-process `node-cron` jobs in the backend for many application jobs.
- Slack/PagerDuty alerting for critical payment and operational paths.

The most important interview framing is that this is a pragmatic early-stage architecture, not a finished hyperscale platform. EC2 plus Docker is acceptable for a small team and a pre-hypergrowth product because it keeps the operational surface understandable. The places where this architecture becomes unsafe are also clear:

- multiple API replicas would double-run current in-process jobs unless jobs move to locks, EventBridge, pg-boss, or a worker service;
- Socket.IO presence and room membership are stored in memory and need Redis or a similar shared adapter for horizontal scaling;
- generic API and generic job failure alerting should be codified in CloudWatch, PagerDuty, or another observability backend;
- the Supabase/Postgres disaster recovery process should be turned into an explicit runbook and tested on a schedule.

That is the answer I would give in an interview: I chose simplicity first, but I can name the exact migration pressure points and the exact next step for each.

## Why EC2 Plus Docker Instead Of ECS, Kubernetes, Fly, Render, Or Managed App Hosting?

### Short Interview Answer

I chose EC2 plus Docker because the backend is a single Node/Express service with Socket.IO and in-process scheduled jobs. At this stage, the highest-leverage infrastructure requirement was repeatable deploys, predictable cost, direct debugging, and a clear rollback path, not a distributed scheduler or orchestration platform. Docker gives environment parity and immutable image tags. EC2 gives full control over long-lived WebSocket behavior, ports, host-level logs, and emergency access.

I would not claim EC2 is the forever answer. ECS is the natural next step once we split cron from the API process and introduce a shared Socket.IO adapter. Kubernetes is too much control-plane overhead for this team and product stage. Fly, Render, and similar managed app hosts are attractive, but I did not want platform-specific limits around long-lived sockets, cron semantics, networking, and debugging to become the bottleneck before the product needed that abstraction.

### What The Repo Shows

The README describes backend infra as Docker plus EC2, with pushes to `dev` deploying staging and pushes to `main` deploying production. The GitHub Actions workflow builds and pushes Docker images to Docker Hub, then SSHes to EC2, pulls the image, runs the container with an environment-specific env file, and checks Docker health.

The deployment path is intentionally simple:

1. Build `backend/Dockerfile` production target.
2. Push image tags such as `staging`, `prod`, `latest`, and branch/SHA tags.
3. SSH into EC2.
4. `docker pull`.
5. Stop and remove the old container.
6. Run the new container on port `8000`.
7. Wait for Docker health status to become `healthy`.
8. Prune old images.

Rollback uses the same pattern with a manually chosen image tag. That matters operationally: a rollback does not require rebuilding from source or reconstructing environment state.

### Why Not ECS Yet?

ECS would be a good next step, but it is only safe after some architecture cleanup:

- Current backend jobs run in-process with `node-cron`.
- Running two ECS tasks would run many jobs twice.
- Some jobs are financial, such as `processPendingTransfers` and `authorizeUpcomingGigs`.
- Double-running those jobs can create duplicate PaymentIntents, double wallet credits, or inconsistent payment state.

The repo already recognizes this in [../05-cron-job-migration-plan.md](../05-cron-job-migration-plan.md). The intended path is:

- move critical jobs to EventBridge and Lambda-triggered internal endpoints protected by `job_locks`;
- move frequent retryable jobs to pg-boss;
- keep only idempotent low-risk jobs in-process;
- optionally split an API container and worker container;
- then scale API replicas safely.

Once that work is complete, ECS with an ALB, autoscaling, CloudWatch Logs, Secrets Manager, and task roles becomes a strong default.

### Why Not Kubernetes?

Kubernetes would solve scheduling, autoscaling, service discovery, and rollout patterns, but it would add a large control-plane and operational burden:

- cluster upgrades;
- ingress controller management;
- cert-manager or ALB ingress setup;
- secrets integration;
- pod disruption budgets;
- node pools or Fargate profiles;
- application-level readiness and liveness probes;
- log and metric plumbing;
- persistent job semantics;
- incident response complexity.

For this repo, the bottleneck is not container orchestration. The bottleneck is correct job ownership, payment idempotency, observability, and Socket.IO horizontal behavior. Kubernetes would not remove those application-level problems.

### Why Not Fly, Render, Or Managed App Hosting?

Managed app hosting would reduce operational work, but this backend has several characteristics that make platform constraints more relevant:

- Socket.IO WebSocket upgrades and long-lived connections;
- same-origin web rewrites for `/socket.io`;
- backend-controlled cron jobs;
- payment jobs where duplicate execution is dangerous;
- internal endpoints called by AWS Lambda;
- existing AWS Lambda, Secrets Manager, CloudWatch, S3, and possible CloudFront integration;
- need for direct host-level debugging during early product iteration.

Render or Fly could work, especially after jobs are externalized. At the current stage, EC2 avoids surprises and keeps the blast radius obvious.

### What Would Make Me Move Off Single EC2?

I would move from single EC2 to ECS or equivalent when one or more of these are true:

- API CPU or memory pressure causes p95 latency misses.
- WebSocket connection count approaches a single-node comfort limit.
- deploys need zero-downtime rolling behavior.
- uptime target moves from "good enough for beta" to strict 99.9 percent or higher.
- on-call pain shows that host-level manual operation is too risky.
- security/compliance requires codified infrastructure, IAM-scoped tasks, and centralized logs.

The migration sequence I would use:

1. Move critical jobs out of API replicas.
2. Add Redis/ElastiCache Socket.IO adapter and shared presence.
3. Put the API behind ALB with WebSocket support.
4. Move container runtime from hand-run EC2 Docker to ECS service.
5. Codify logs, alarms, secrets, scaling, and deploy rollback.

## How Is TLS Terminated?

### Short Interview Answer

The Node container does not terminate TLS. It listens over HTTP on port `8000`. TLS is terminated before traffic reaches the container: Vercel terminates TLS for the web app, and the API domain should terminate TLS at a reverse proxy or load balancer in front of the EC2 container. The backend is proxy-aware through `TRUST_PROXY`, uses Helmet security headers, and the web app proxies `/api` and `/socket.io` to the backend so browser cookies and WebSocket upgrades remain same-origin.

### What The Repo Shows

The backend creates a plain HTTP server:

- `const server = http.createServer(app);`
- Socket.IO attaches to that HTTP server.
- Docker exposes port `8000`.

There is no in-process HTTPS server in `backend/app.js` and no certificate loading in the container. That is intentional: terminating TLS at the edge or load balancer keeps cert lifecycle out of the app container.

The backend configures:

- `app.set('trust proxy', trustProxy)`;
- a default production trust proxy value of one hop;
- a warning when `TRUST_PROXY=true` is too broad;
- Helmet security headers;
- secure-cookie behavior in production in auth-related code paths;
- same-origin web requests through Next.js rewrites.

The web app config contains rewrites:

- `/api/:path*` -> backend `/api/:path*`
- `/socket.io/:path*` -> backend `/socket.io/:path*`

That design is important for httpOnly cookies. Web clients can connect to Socket.IO with a placeholder token and let the server fall back to the `pantopus_access` cookie from the handshake headers.

### Production TLS Topology

The intended production chain is:

1. Browser connects to `https://www.pantopus.com`.
2. Vercel terminates TLS for the web app.
3. Requests to `/api` and `/socket.io` are rewritten to the backend URL.
4. Backend URL is `https://api.pantopus.com` or equivalent.
5. TLS for the API is terminated at an ALB, Nginx/Caddy, or another reverse proxy in front of EC2.
6. Proxy forwards HTTP to the Docker container on `localhost:8000` or the instance private interface.

The API proxy must support:

- WebSocket upgrade headers;
- appropriate idle timeouts for Socket.IO;
- `X-Forwarded-For` and `X-Forwarded-Proto`;
- no buffering for streaming endpoints where relevant;
- health checks against `/health` or `/`.

### What I Would Codify Next

The repo does not include Terraform, CloudFormation, or Caddy/Nginx config for the EC2 TLS layer. I would codify one of:

- ALB listener `443` with ACM cert, target group port `8000`, health check `/health`;
- or Caddy on EC2 with automatic certificate management and reverse proxy to Docker;
- or Nginx with Certbot, systemd renewal, and explicit WebSocket proxy settings.

For a team interview, I would say: "TLS termination is intentionally outside Node, but the exact proxy config should be codified because otherwise it becomes undocumented host state."

## How Are Logs Centralized?

### Short Interview Answer

Application logs use Winston and are emitted to stdout plus rotated local files. Lambda logs are centralized in CloudWatch Logs automatically, and Lambda handlers publish custom CloudWatch metrics. For production EC2, the correct centralization path is to ship Docker stdout and app log files to CloudWatch Logs through the CloudWatch agent or Docker logging driver. The repo has the application logging and Lambda side, but it does not yet codify EC2 log shipping infrastructure.

### Backend Logs

The backend logger:

- uses Winston;
- includes timestamps;
- includes error stacks;
- JSON-stringifies metadata;
- writes to console;
- writes to `combined.log`;
- rotates at 50 MB with five files.

The backend logs important operational events:

- request method and path;
- slow requests through APM middleware;
- route errors;
- uncaught exceptions;
- unhandled rejections;
- startup configuration checks;
- Supabase, AWS, address verification configuration status;
- cron start, completion, and failure;
- Socket.IO connect/disconnect/auth errors;
- Stripe webhook receipt and processing errors;
- payment ops audit events.

### Lambda Logs And Metrics

AWS Lambda logs go to CloudWatch Logs by default. The seeder stack also publishes custom metrics to CloudWatch namespaces:

- `Pantopus/Seeder/{env}` with `SeederQueueDepth`;
- `Pantopus/Briefing/{env}` with eligible, sent, skipped, failed, and latency metrics;
- `Pantopus/Alerts/{env}` with alert checks, weather/AQI findings, users notified, and latency;
- `Pantopus/Reminders/{env}` with bills/tasks/calendar notified, errors, and latency;
- `Pantopus/MailNotifications/{env}` with urgent mail, summaries, skipped, errors, and latency;
- `Pantopus/NoBidNudge/{env}` with gigs checked, nudges sent, errors, and latency.

### What "Centralized" Should Mean In Production

For a production-grade answer, log centralization should include:

- Docker stdout/stderr from the backend container into CloudWatch Logs.
- Local rotated `combined.log` files shipped as a fallback source.
- Lambda log groups retained with an explicit retention policy.
- Vercel logs retained or exported if available on the chosen plan.
- Structured fields for request id, user id where safe, route, status, latency, environment, container image tag, and git SHA.
- Metric filters for `Unhandled error`, `[CRON] Failed`, `Webhook processing error`, and `CRITICAL`.
- Dashboards for 5xx rate, p95/p99 latency, memory, container restarts, Socket.IO connections, and payment stuck-state counts.

### Current Gap

The repo does not include EC2 CloudWatch agent config, Docker log-driver config, or log retention IaC. I would call that out rather than oversell it. Application logs are structured enough to centralize; the final host-level shipping needs to be codified.

## What Alerts Exist For API Errors, Job Failures, Stripe Failures, And Seeder Failures?

### Short Interview Answer

There is strong alerting around payment health and critical Stripe-related stuck states through Slack and PagerDuty. The seeder publishes CloudWatch metrics and logs failures. Generic API 5xx and generic cron failure alerts are partially instrumented through logs and metrics but should be promoted into explicit CloudWatch or observability alarms. The repo is honest about this: it already has a plan to move risky cron jobs to EventBridge, pg-boss, and job locks for better retry and failure visibility.

### Alerting Service

`backend/services/alertingService.js` supports:

- Slack incoming webhook for all severities;
- PagerDuty Events API v2 for critical alerts;
- environment gating with `ALERTS_ENABLED`;
- dedup keys for PagerDuty;
- fire-and-forget semantics so alerting failure does not break the caller.

Severity model:

- `critical`: Slack plus PagerDuty;
- `warning`: Slack only;
- `info`: Slack only.

### API Error Alerts

Implemented pieces:

- `/health` checks Supabase connectivity and returns `503` if DB is unavailable.
- Docker health checks call `/`.
- `/api/health/metrics` exposes uptime, memory, route metrics, and address verification metrics.
- APM middleware records per-route count, errors, p50, p95, p99, max over a rolling five-minute window.
- Slow requests are logged with route, duration, status, user, and threshold.
- Global error handler logs unhandled route errors.
- Process-level handlers log uncaught exceptions and unhandled promise rejections before exiting.

What should be alerting in production:

- API 5xx rate above 1 percent for five minutes -> page or high-priority alert.
- API p95 above SLO for 10 minutes -> warning.
- `/health` failing from an external probe for two consecutive checks -> critical.
- container restart count above threshold -> warning or critical depending on frequency.
- memory RSS above threshold -> warning.

Current gap:

- The repository exposes data and logs errors, but generic API 5xx alarm definitions are not codified.

### Job Failure Alerts

Implemented pieces:

- Every cron job is wrapped in `wrapJob`.
- `wrapJob` logs start, completion, elapsed time, and failure.
- `NODE_ENV=test` disables jobs.
- Payment-related jobs have explicit alerting.

Payment job alerting:

- `processPendingTransfers` alerts on batch errors and fatal errors.
- `checkAndAlertStuckPayments` runs every 15 minutes.
- Admin payment ops endpoints can manually inspect and trigger stuck payment checks.

Current generic-job gap:

- Non-payment cron failures currently rely primarily on logs.
- The migration plan explicitly calls this out: current job failure visibility is essentially log grep, target is CloudWatch plus pg-boss tables.

Production target:

- critical jobs move to EventBridge plus Lambda-triggered internal endpoints and `job_locks`;
- frequent retryable jobs move to pg-boss;
- job status is queryable from `job_locks` or pg-boss;
- failures and missed runs emit metrics;
- alarms fire when a job fails repeatedly, misses a schedule window, or exceeds max duration.

### Stripe Failure Alerts

Implemented pieces:

- Stripe webhooks verify signatures using the raw request body.
- Events are recorded in `StripeWebhookEvent`.
- Duplicate events are skipped if already processed.
- Redelivered unprocessed events are reprocessed.
- Processing errors are stored in `processing_error`.
- Failed processing returns HTTP `500` so Stripe retries.
- Payment state machine controls transitions.
- Stuck payment detection runs every 15 minutes.

Payment health alerts include:

- `captured_hold` payments still present more than two hours after cooling-off should have ended;
- `transfer_scheduled` older than 30 minutes;
- `transfer_pending` older than 10 minutes as warning;
- `transfer_pending` older than 30 minutes as critical;
- gigs where owner confirmed completion but payment remains authorized;
- payment health query failures.

Alert severity:

- lower counts generally warn in Slack;
- higher counts or critical states page via PagerDuty.

This is the most production-ready alert path in the repo because it is tied to state, not only logs.

### Seeder Failure Alerts

Implemented pieces:

- Lambda functions log to CloudWatch Logs.
- Fetcher publishes `SeederQueueDepth`.
- Briefing publishes `BriefingFailed`.
- Reminders publish `ReminderErrors`.
- Mail notifications publish `MailNotifErrors`.
- No-bid nudges publish `NudgeErrors`.
- Queue item failures are stored in `seeder_content_queue.failure_reason`.
- Briefing cleanup retries failed deliveries and resets stuck `composing` rows.

Production alarms I would configure:

- Lambda `Errors > 0` for critical functions.
- Lambda `Throttles > 0`.
- Lambda duration near timeout.
- `SeederQueueDepth == 0` for too long during active regions.
- `SeederQueueDepth` too high, meaning poster is not draining.
- `BriefingFailed > threshold`.
- `ReminderErrors > threshold`.
- `MailNotifErrors > threshold`.
- `NudgeErrors > threshold`.

Current gap:

- The repo documents metrics and publishes them, but CloudWatch Alarm resources are not checked into the repo.

## What Are Your SLOs?

### Short Interview Answer

For the current stage, I would set SLOs around user-visible availability, latency, realtime delivery, payment correctness, scheduled-job freshness, and backup recovery. Payments get stricter correctness objectives than ordinary content surfaces.

### Proposed SLOs

| Area | SLO | Why |
|---|---:|---|
| API availability | 99.9 percent monthly for authenticated API routes | Good production baseline without pretending to be multi-region |
| API latency | p95 under 500 ms, p99 under 1500 ms for normal routes | Keeps product interactions responsive |
| API error rate | 5xx under 0.1 percent over rolling 30 days | Captures server-side reliability |
| Health check | `/health` succeeds 99.95 percent monthly | Detects DB/backend availability |
| Socket.IO connect | 99.5 percent successful authenticated connects | Realtime chat is core but not life-critical |
| Socket.IO event fanout | p95 under 1 second for room events | Typing/chat/badge updates feel live |
| Stripe webhook processing | 99.9 percent processed successfully within 1 minute | External money state must converge quickly |
| Critical payment stuck states | zero critical stuck states older than 30 minutes | Correctness objective, not just availability |
| Critical cron jobs | no more than one missed scheduled run per month | Financial/job freshness |
| Seeder fetch/post | successful seeder cycle within scheduled window 99 percent of eligible cycles | Maintains cold-start content |
| Safety/weather alert checks | p95 check and notification path under 10 minutes | Product trust for alert features |
| Backup RPO | maximum 15 minutes | User data and payments are core |
| Restore RTO | maximum 4 hours, target 2 hours for DB restore | Practical single-region DR target |

### SLIs I Would Track

API:

- request count by route/status;
- 5xx rate;
- p50/p95/p99 latency;
- health check success;
- container restart count;
- memory and CPU.

Socket.IO:

- active connections;
- connected users;
- connection auth failures;
- disconnect rate;
- event delivery latency if instrumented client ack is added;
- room join failures.

Payments:

- Stripe webhook receive count and processing failure count;
- `StripeWebhookEvent` rows with `processed=false` older than five minutes;
- stuck payment counts by state;
- capture retries exhausted;
- transfer failures;
- dispute states needing manual action.

Jobs:

- last successful run per job;
- run duration;
- failure count;
- missed schedules;
- queue backlog where applicable.

Seeder:

- queue depth;
- posted count;
- failed count;
- skipped count;
- Lambda errors/throttles/duration;
- briefing/reminder/mail/no-bid error metrics.

## How Do You Scale Socket.IO Horizontally?

### Short Interview Answer

Today, Socket.IO is single-node because presence and socket membership are in memory. To scale horizontally, I would add a Redis/ElastiCache Socket.IO adapter, move presence to Redis with TTLs, use an ALB that supports WebSocket upgrades and sticky sessions, and move cron jobs out of the API process so multiple API replicas do not double-run jobs. Only after those changes would I increase backend replica count.

### Current State

`backend/socket/chatSocketio.js` keeps:

- `connectedUsers: Map<userId, Set<socketId>>`;
- `userRooms: Map<userId, Set<roomId>>`;
- socket event counters in memory;
- online/offline broadcast logic based on first and last socket per user.

That works on one process. It breaks or becomes incomplete across multiple processes because one process cannot see sockets connected to another process.

Specific single-node assumptions:

- online/offline state is process-local;
- direct chat notifications inspect `connectedUsers` locally;
- room membership joins are local unless a Socket.IO adapter broadcasts them;
- `io.to(room).emit(...)` only reaches sockets attached to that server without an adapter;
- counters reset on disconnect from that process only.

### Horizontal Architecture

Target architecture:

1. Put API instances behind ALB or equivalent.
2. Enable WebSocket upgrades and appropriate idle timeout.
3. Use sticky sessions if long-polling fallback remains enabled.
4. Add Redis/ElastiCache.
5. Use `@socket.io/redis-adapter`.
6. Store presence in Redis with TTL heartbeats.
7. Store user-to-socket mappings in Redis or rely on adapter-level server-side emits.
8. Keep chat messages and read state in Postgres as source of truth.
9. Use idempotent event payloads and client-side reconciliation.
10. Add metrics for connection count, Redis adapter errors, fanout latency, auth failures, and room joins.

### Redis Adapter Pattern

Conceptually:

```js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

Presence would become:

- `SETEX presence:user:{userId}:{socketId} 30 <serverId>`;
- heartbeat refresh while connected;
- online means at least one live key exists for user;
- offline event emitted only after last key expires or disconnect removes it;
- periodic reconciliation handles missed disconnects.

### Required Precondition: Move Jobs Out Of API Replicas

Socket.IO scaling is not isolated from job scaling. If I add multiple backend replicas today, every replica starts `startJobs()`, and that is unsafe for financial jobs.

Before scaling API replicas, I would implement the repo's cron migration plan:

- Tier 1 critical jobs -> EventBridge/Lambda/internal endpoint plus `job_locks`;
- Tier 2 frequent jobs -> pg-boss;
- Tier 3 idempotent jobs -> remain in-process or move later;
- API container handles HTTP and Socket.IO only;
- worker container handles queue jobs if needed.

### Rollout Plan

1. Add Redis in staging.
2. Add Socket.IO Redis adapter with one backend instance.
3. Move presence to Redis but keep local fallback logs.
4. Run multi-instance staging with synthetic clients across rooms.
5. Verify message, badge, typing, read receipt, online/offline semantics.
6. Move critical jobs out of API process.
7. Add second production API instance behind ALB.
8. Monitor connection churn, Redis errors, fanout latency, and duplicate job guard metrics.

## How Do You Isolate Dev, Staging, And Prod Data?

### Short Interview Answer

The repo separates environments by branch, env file, backend host, frontend environment, seeder stack environment, and secrets. The production-grade rule is separate Supabase projects, separate Stripe accounts or test/live modes, separate S3 buckets or prefixes, separate webhook secrets, separate AWS Secrets Manager names, and no raw production data copied into lower environments without sanitization.

### What The Repo Shows

Backend deployment:

- `dev` branch deploys to staging EC2.
- `main` branch deploys to production EC2.
- staging uses `~/pantopus/.env.staging`.
- production uses `~/pantopus/.env.prod`.
- Docker tags differ for staging/prod.

Local development:

- `supabase/config.toml` defines local ports and local Supabase behavior.
- local email confirmation is disabled for convenience.
- local Inbucket captures emails instead of sending real email.
- `.env.dev` is used by default when no `.env` exists.

Seeder:

- SAM template has an `Environment` parameter with `production`, `staging`, and `dev`.
- Secrets default to `pantopus/seeder/{Environment}`.
- function names include `{Environment}`.
- CloudWatch namespaces include `{Environment}`.

Frontend:

- Vercel should use `main` for production and `dev` for preview/staging.
- `NEXT_PUBLIC_API_URL` points the web app to the correct backend.

### Production Isolation Requirements

Database:

- separate Supabase projects for dev, staging, and prod;
- separate service role keys;
- separate JWT secrets;
- separate Auth redirect URLs;
- separate RLS policy rollout validation per project;
- no direct developer access to production except audited break-glass.

Payments:

- Stripe test mode for dev/staging;
- Stripe live mode for prod;
- separate webhook signing secrets per environment;
- separate Connect onboarding settings;
- clear labels in metadata for environment.

Storage:

- separate S3 buckets or hard-separated prefixes;
- separate CloudFront distributions if public CDN behavior differs;
- no staging client reading production media unless explicitly intended and safe.

Secrets:

- GitHub environments for staging and production;
- separate EC2 SSH hosts;
- separate `.env.staging` and `.env.prod`;
- AWS Secrets Manager secret names include environment;
- no production secrets in local `.env` files.

Email, push, and OAuth:

- separate SMTP/Postmark server token or environment stream;
- separate Expo project/channel where appropriate;
- OAuth redirect URLs scoped per environment;
- mobile EAS profiles separated by environment.

Data copying:

- lower environments should use seed data or sanitized snapshots;
- production PII, home addresses, payment identifiers, and chat content should not be copied into dev;
- if a staging restore from prod is required, run anonymization before exposing it to engineers.

### Migration Discipline

The repo has migration smoke scripts and runbooks for sensitive Identity Firewall migrations. The same pattern should apply to all high-risk migrations:

1. preflight in staging;
2. backup or PITR checkpoint;
3. apply migration;
4. run smoke checks;
5. verify RLS and privacy invariants;
6. deploy application code;
7. monitor logs and metrics;
8. keep rollback decision points explicit.

## What Is Your Backup And Restore Process For Supabase/Postgres?

### Short Interview Answer

The repo does not yet contain a full Supabase disaster recovery runbook, so I would not pretend it does. The production process should rely on Supabase point-in-time recovery for short RPO, plus scheduled logical dumps to encrypted S3 for independent recovery. Restores should go into a new Supabase project first, be validated with smoke checks and reconciliation scripts, then the backend should be cut over by changing environment variables and redeploying.

### Backup Policy

Minimum production policy:

- enable Supabase PITR for production;
- retain PITR for the maximum available window appropriate to the plan;
- take daily logical backups with `pg_dump`;
- store dumps encrypted in S3 with versioning and lifecycle retention;
- keep at least 30 daily backups, 12 monthly backups, and a small number of pre-migration snapshots;
- back up storage metadata and know how S3/Supabase Storage objects are recovered;
- record schema migration version and application image tag alongside each backup.

Recommended `pg_dump` pattern:

```sh
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="pantopus-prod-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

For Supabase-hosted Postgres, direct connections generally require SSL. The existing smoke scripts already account for Supabase SSL behavior unless `PGSSLMODE=disable`.

### Restore Process

Restore should be rehearsed into a new environment, not directly over production.

1. Declare incident and freeze risky deploys.
2. Determine restore target timestamp.
3. Choose PITR for recent logical corruption or latest dump for independent restore.
4. Create a new Supabase project or isolated database.
5. Restore schema and data.
6. Apply any required extensions.
7. Reconfigure secrets for the restored database.
8. Run schema smoke checks.
9. Run product smoke checks.
10. Verify RLS policies.
11. Verify auth behavior and representative user access.
12. Reconcile Stripe state for payments changed after the restore target.
13. Reconcile seeder queues and webhook events.
14. Point staging backend at restored DB first.
15. Run API, web, mobile smoke checks.
16. Cut over production backend env and redeploy.
17. Monitor health, 5xx, payment stuck states, and job behavior.

### Payment Reconciliation After Restore

Payments need special handling because Stripe remains an external source of truth. A DB restore can roll the local database back behind Stripe events.

After restore:

- query unprocessed or missing `StripeWebhookEvent` rows;
- replay Stripe events where possible;
- reconcile PaymentIntent status with local `Payment.payment_status`;
- reconcile transfers, refunds, disputes, and payouts;
- check stuck payment alert endpoint;
- manually review any payments in intermediate states.

The key principle is that restoring Postgres alone is not enough for money movement. Stripe and local state must converge.

### Storage Restore

The database contains references to uploaded media and files. A full DR plan must also account for:

- S3 object versioning;
- lifecycle/retention policy;
- Supabase Storage legacy object recovery if still used;
- CloudFront cache invalidation only when needed;
- consistency between DB file rows and object existence.

### Current Gap

The repository has many migration runbooks and smoke scripts, but not a comprehensive Postgres DR runbook. I would create one under `docs/` and eventually codify backup jobs and restore validation as scripts.

## How Often Do You Test Disaster Recovery?

### Short Interview Answer

I would run a full restore rehearsal quarterly, backup integrity checks monthly, and a tabletop exercise monthly. I would also run an extra restore rehearsal before high-risk migrations involving payments, identity, RLS, home addresses, or large destructive backfills.

### DR Test Cadence

| Test | Cadence | Purpose |
|---|---:|---|
| Backup existence and checksum check | Weekly | Verify backups are being produced and retained |
| Logical restore into disposable DB | Monthly | Prove dumps are usable |
| Table count and key invariant comparison | Monthly | Catch partial or corrupt restores |
| Full application restore rehearsal | Quarterly | Prove backend can run against restored DB |
| Payment reconciliation drill | Quarterly | Prove Stripe/local convergence process |
| Tabletop incident exercise | Monthly | Keep human process sharp |
| Pre-migration restore rehearsal | Before high-risk migrations | Reduce rollback uncertainty |

### Definition Of A Passed DR Test

A DR test passes only if:

- backup can be restored into a clean environment;
- migrations and extensions are correct;
- `/health` succeeds;
- auth works for a test user;
- core API routes work;
- representative web and mobile flows work;
- RLS/privacy smoke tests pass;
- payment stuck-state dashboard is clean or understood;
- seeder jobs can read/write expected tables;
- recovery steps and timings are recorded.

## What Is The Maximum Acceptable RPO/RTO?

### Short Interview Answer

For Postgres, the maximum acceptable RPO is 15 minutes. The target is lower when Supabase PITR is available. The maximum acceptable RTO for a full database restore is 4 hours, with a 2-hour target. Backend-only failure should recover in under 30 minutes because the backend container is stateless and redeployable from a known Docker image tag.

### RPO

Maximum acceptable RPO:

- 15 minutes for production Postgres.

Reasoning:

- user accounts, home data, chat, gigs, posts, and payment state are core product data;
- payments require tight reconciliation with Stripe;
- a larger RPO would create unacceptable manual recovery work and user trust issues.

Target RPO:

- near-zero to a few minutes with PITR, subject to Supabase plan capability.

### RTO

Maximum acceptable RTO:

- 30 minutes for backend-only container failure;
- 1 hour for web rollback or frontend deployment issue;
- 2 hours target for database restore;
- 4 hours maximum for full database/platform restore.

Reasoning:

- backend deploys and rollbacks are image-tag based and simple;
- DB restore is slower because it requires validation, secrets cutover, and payment reconciliation;
- full DR includes not only Postgres but also auth, storage, jobs, web, mobile API configuration, and external integrations.

### Incident Priorities

During a DR incident:

1. Protect money movement first.
2. Stop duplicate or dangerous jobs.
3. Preserve evidence and logs.
4. Restore read/write database availability.
5. Reconcile Stripe and local payment state.
6. Restore realtime and non-critical background features.
7. Backfill missed notifications or seeder work only after core state is stable.

## Interview-Ready Caveats

These are the caveats I would say out loud because they show senior judgment:

- I would not horizontally scale the backend before moving critical jobs out of process.
- I would not claim EC2 logs are fully centralized until the CloudWatch agent or log driver is codified.
- I would not claim generic job alerting is complete; payment alerting is strong, generic job alerting still needs the migration plan.
- I would not claim a complete DR process until a restore runbook and scheduled restore tests exist.
- I would not terminate TLS in Node; I would keep it at Vercel, ALB, or a reverse proxy.
- I would use ECS before Kubernetes for the next step because the app needs safer orchestration, not a full platform team problem.

## Strong Closing Answer

The architecture is intentionally boring where it should be boring: Docker image, EC2 host, Supabase managed Postgres, Vercel web, AWS Lambda for scheduled seeder work. That let the product move quickly with a small operational surface.

The dangerous parts are also clear: in-process cron jobs, in-memory Socket.IO presence, and incomplete codified observability/DR. I would harden those in this order:

1. Codify log shipping and alarms.
2. Move critical jobs to EventBridge plus job locks.
3. Move frequent retryable jobs to pg-boss or a worker.
4. Add Redis Socket.IO adapter and Redis presence.
5. Move backend from hand-run EC2 Docker to ECS behind ALB.
6. Codify database backup and restore testing.

That path keeps the original simplicity but removes the failure modes that would block scale.

