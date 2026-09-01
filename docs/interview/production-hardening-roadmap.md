# Production Hardening Roadmap

This roadmap turns the infrastructure interview answers into concrete engineering work. It is ordered by risk reduction rather than novelty.

## Current Risk Summary

| Area | Current State | Risk | Target |
|---|---|---|---|
| Backend hosting | Docker container on EC2 | Single host, manual host state | ECS service or codified EC2 with ALB/proxy |
| TLS | Terminated outside Node | Proxy config not codified in repo | ALB/ACM or Caddy/Nginx config in IaC |
| Logs | Winston stdout/files, Lambda CloudWatch | EC2 log shipping not codified | CloudWatch Logs for Docker and app files |
| API alerts | Health and metrics endpoints | Generic 5xx alarms not codified | External health check plus 5xx/latency alarms |
| Job alerts | Cron wrapper logs failures | Generic job failure visibility weak | EventBridge/job locks/pg-boss metrics |
| Payment alerts | Slack/PagerDuty stuck payment checks | Strongest current alert path | Keep, add dashboards and replay tooling |
| Seeder alerts | CloudWatch metrics/logs | Alarms not codified | CloudWatch alarms for errors/backlog |
| Socket.IO | Single-node in-memory presence | Cannot safely scale horizontally | Redis adapter and shared presence |
| Database DR | Migrations and smoke checks exist | Full DR runbook not codified | PITR, dumps, restore rehearsals |
| Environment isolation | Branch/env separation | Must enforce separate projects/secrets | Formal environment inventory and access policy |

## Phase 1: Codify Observability

Goal: make failure visible before changing architecture.

Tasks:

- Add CloudWatch agent or Docker log-driver config for EC2.
- Ship backend stdout/stderr to `/pantopus/backend/{env}` log groups.
- Ship `combined.log` only if needed as a secondary source.
- Add retention policies for backend and Lambda logs.
- Add CloudWatch metric filters for:
  - `Unhandled error`;
  - `[CRON] Failed`;
  - `Webhook processing error`;
  - `CRITICAL`;
  - `Payment health query failed`.
- Add alarms for:
  - `/health` failure;
  - API 5xx rate;
  - p95 latency breach;
  - container restart loop;
  - memory pressure;
  - Lambda errors and throttles;
  - seeder queue depth zero or too high;
  - briefing/reminder/mail/no-bid error metrics.
- Build a dashboard with:
  - API latency and 5xx;
  - active Socket.IO connections;
  - payment stuck-state counts;
  - job failures;
  - Lambda duration/errors;
  - DB health.

Exit criteria:

- an on-call engineer can detect backend, payment, job, and seeder failures without SSHing to EC2;
- alarms have clear severities and owners;
- alert messages include environment, commit/image tag, and runbook link.

## Phase 2: Make Jobs Horizontally Safe

Goal: remove the biggest blocker to multiple backend replicas.

Tasks:

- Implement the `job_locks` migration from [../05-cron-job-migration-plan.md](../05-cron-job-migration-plan.md).
- Add internal endpoints for critical jobs.
- Move Tier 1 jobs to EventBridge-triggered Lambda calls:
  - `processPendingTransfers`;
  - `retryCaptureFailures`;
  - `authorizeUpcomingGigs`;
  - `expireUncapturedAuthorizations`;
  - `checkAndAlertStuckPayments`;
  - destructive or heavy jobs listed in the migration plan.
- Add job success/failure metrics under `Pantopus/Jobs/{env}`.
- Add missed-run detection.
- Add pg-boss for frequent retryable jobs.
- Keep only idempotent low-risk jobs in process until they are worth moving.

Exit criteria:

- running two API instances does not double-run financial jobs;
- every critical job has last-success, last-failure, duration, and owner visibility;
- failed jobs retry with bounded backoff where appropriate;
- payment jobs are still idempotent even if triggers retry.

## Phase 3: Scale Socket.IO Correctly

Goal: allow more than one backend process to serve realtime clients.

Tasks:

- Provision Redis/ElastiCache.
- Add Socket.IO Redis adapter.
- Move presence to Redis with TTL heartbeat keys.
- Add server id to socket/session logs.
- Add fanout and room join metrics.
- Validate:
  - cross-node room broadcasts;
  - direct chat notifications;
  - badge updates;
  - typing indicators;
  - online/offline semantics;
  - reconnects and fallback transport.
- Configure ALB or reverse proxy for:
  - WebSocket upgrade;
  - suitable idle timeout;
  - sticky sessions if long-polling fallback is retained.

Exit criteria:

- two backend instances can both host Socket.IO clients;
- a message created through REST on one instance emits to clients connected to another;
- user online/offline state is not tied to one process;
- Redis failure behavior is understood and alarmed.

## Phase 4: Move Runtime To ECS

Goal: replace hand-run EC2 Docker with managed container orchestration.

Tasks:

- Create ECS cluster and service for backend.
- Put service behind ALB with ACM certificate.
- Use task definitions with explicit CPU/memory.
- Use Secrets Manager or SSM Parameter Store for env.
- Use CloudWatch Logs from the task definition.
- Add autoscaling based on CPU, memory, or request count.
- Keep image-tag rollback path.
- Add deployment circuit breaker.
- Keep staging and prod services separate.

Exit criteria:

- deploys are rolling and health-gated;
- rollback does not require SSH;
- API can run more than one task safely;
- logs and metrics are attached to task/service identity.

## Phase 5: Formalize Database DR

Goal: make data recovery a practiced process, not tribal knowledge.

Tasks:

- Enable Supabase PITR for production.
- Add scheduled encrypted logical dumps to S3.
- Store backup metadata:
  - timestamp;
  - app image tag;
  - git SHA;
  - migration version;
  - Supabase project id;
  - checksum.
- Write `docs/database-disaster-recovery-runbook.md`.
- Add restore validation scripts:
  - schema check;
  - RLS check;
  - table count check;
  - payment stuck-state check;
  - representative API smoke check.
- Run monthly logical restore tests.
- Run quarterly full application restore rehearsals.

Exit criteria:

- backup can be restored into a clean Supabase project;
- restored backend passes `/health`;
- critical product smoke checks pass;
- Stripe/local payment reconciliation process is documented;
- measured RPO/RTO are recorded after every drill.

## Phase 6: Tighten Environment Isolation

Goal: ensure no cross-environment data or secret leaks.

Tasks:

- Document every environment:
  - web domain;
  - API domain;
  - EC2/ECS target;
  - Supabase project;
  - Stripe mode/account;
  - S3 bucket;
  - Secrets Manager path;
  - Vercel project/env;
  - EAS profile;
  - OAuth redirect URLs.
- Add a secret inventory without secret values.
- Ensure staging uses Stripe test mode only.
- Ensure production service role keys never appear in local env files.
- Add sanitization policy for any production-derived dataset.
- Add access review cadence.

Exit criteria:

- an engineer can identify the owning project and secret path for any environment;
- staging cannot accidentally write to production Stripe, Supabase, or S3;
- production data is never copied into dev without sanitization.

## Interview Framing

The mature answer is not "we used EC2 because it is best forever." The mature answer is:

1. EC2 plus Docker minimized early operational complexity.
2. The repo already has Dockerized deploys, health checks, rollback, structured logs, payment alerting, Lambda metrics, and migration smoke discipline.
3. The known scale blockers are in-process jobs and in-memory Socket.IO presence.
4. The migration path is clear: job locks/EventBridge/pg-boss, Redis adapter, ALB/ECS, codified observability, and tested DR.

That framing demonstrates ownership of both the current system and the next version of it.

