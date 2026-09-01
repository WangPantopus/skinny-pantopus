# Operational Readiness, Observability, Privacy, And Admin Controls

Interview-style notes for answering operational questions about this repository.

This document is written from the point of view of the engineer responsible for the system. It is deliberately candid: it separates what the codebase actually implements today from what I would still harden before scaling operations.

## Executive Summary

Pantopus has meaningful backend observability around API health, payments, scheduled jobs, chat delivery, geo/address verification, and privacy-sensitive state changes. The strongest operational surfaces are:

- Backend health and in-memory APM at `/health` and `/api/health/metrics`.
- Payment operations endpoints under `/api/admin/payment-ops`.
- Durable Stripe webhook event storage through `StripeWebhookEvent`.
- Scheduled job wrappers that log start, completion, failure, and elapsed time.
- Chat send/request metrics and Socket.IO connection gauges.
- Privacy gates that run through `pnpm --filter pantopus-backend run test:privacy`.
- Durable audit tables for identity, business IAM, and home IAM flows.

The most important gaps are:

- Frontend errors are not centrally collected in production.
- Request IDs are generated server-side but are not consistently propagated from clients, returned in response headers, or included in all logs.
- Backend log retention is size-based local rotation, not a complete time-based policy.
- Some privileged admin actions are logged to Winston but not durably written to an append-only audit table.
- Log PII controls exist in some subsystems, especially geo and identity, but there is no universal production log DLP/scrubbing layer.

If I were answering in an interview, I would emphasize that operational maturity is not one dashboard or one logger. It is the ability to answer a user-impacting question quickly: what happened, who was affected, which subsystem owns it, what changed, and how we prevent a repeat.

## Repository Anchors

The following files are the key anchors for this answer:

- Backend app, health, request logging, APM mount: [`backend/app.js`](../../backend/app.js)
- Request ID middleware: [`backend/middleware/requestId.js`](../../backend/middleware/requestId.js)
- APM middleware: [`backend/middleware/apm.js`](../../backend/middleware/apm.js)
- Winston logger: [`backend/utils/logger.js`](../../backend/utils/logger.js)
- Payment operations: [`backend/routes/paymentOps.js`](../../backend/routes/paymentOps.js)
- Stripe webhooks: [`backend/stripe/stripeWebhooks.js`](../../backend/stripe/stripeWebhooks.js)
- Job scheduler: [`backend/jobs/index.js`](../../backend/jobs/index.js)
- Pending transfer job: [`backend/jobs/processPendingTransfers.js`](../../backend/jobs/processPendingTransfers.js)
- Capture retry job: [`backend/jobs/retryCaptureFailures.js`](../../backend/jobs/retryCaptureFailures.js)
- Chat routes and send flow: [`backend/routes/chats.js`](../../backend/routes/chats.js)
- Socket.IO chat server: [`backend/socket/chatSocketio.js`](../../backend/socket/chatSocketio.js)
- Chat metrics: [`backend/services/chatMetrics.js`](../../backend/services/chatMetrics.js)
- Geo logging: [`backend/routes/geo.js`](../../backend/routes/geo.js)
- Address verification observability: [`backend/services/addressValidation/addressVerificationObservability.js`](../../backend/services/addressValidation/addressVerificationObservability.js)
- Identity audit utility: [`backend/utils/identityAudit.js`](../../backend/utils/identityAudit.js)
- Business audit helper: [`backend/utils/businessPermissions.js`](../../backend/utils/businessPermissions.js)
- Home audit helper: [`backend/utils/homePermissions.js`](../../backend/utils/homePermissions.js)
- Feature flag admin audit path: [`backend/routes/featureFlags.js`](../../backend/routes/featureFlags.js)
- Database schema, including audit and webhook tables: [`backend/database/schema.sql`](../../backend/database/schema.sql)
- Privacy gate documentation: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- Architecture overview: [`docs/00-architecture-overview.md`](../00-architecture-overview.md)
- Jobs, Stripe, realtime overview: [`docs/03-jobs-stripe-realtime.md`](../03-jobs-stripe-realtime.md)
- Geo monitoring plan: [`docs/geo-monitoring.md`](../geo-monitoring.md)
- Geo runbooks: [`docs/geo-runbooks.md`](../geo-runbooks.md)
- Payment/payout audit: [`docs/payment-payout-audit-2026-03-08.md`](../payment-payout-audit-2026-03-08.md)
- Stripe receipt privacy verification: [`docs/stripe-receipt-verification-2026-05-08.md`](../stripe-receipt-verification-2026-05-08.md)

## 1. What Are The Top Dashboards I Look At Daily?

My daily dashboard set is organized around user-impacting flows rather than vendor products. I care about whether users can sign in, browse, pay, chat, receive notifications, and trust the privacy boundaries.

### 1. API Health And Latency

Primary surfaces:

- `GET /health`
- `GET /api/health/metrics`
- backend logs from Winston

The `/health` endpoint verifies database connectivity and gives a fast binary view of whether the backend can serve traffic. The `/api/health/metrics` endpoint exposes uptime, memory, route-level in-memory metrics, and address verification metrics.

The APM middleware tracks per-route:

- request count
- error count
- p50 latency
- p95 latency
- p99 latency
- max latency
- slow request warnings

What I watch daily:

- API 5xx rate
- route-level p95 and p99
- slow request logs
- memory RSS growth
- database connection failures
- high-volume routes with rising latency

Current limitation:

- Metrics are in-memory. They reset on process restart and are not exported to Prometheus, Datadog, or CloudWatch from this code path.
- The app logs `ip` and `userAgent` on every request, but the request log does not include `requestId`.

### 2. Payment And Stripe Operations

Primary surfaces:

- Stripe Dashboard
- `GET /api/admin/payment-ops/health`
- `GET /api/admin/payment-ops/stuck`
- `StripeWebhookEvent`
- `Payment`
- payment job logs

The payment dashboard is the most important operational dashboard because money movement has the highest user trust impact.

What I watch daily:

- stuck `captured_hold` payments more than 2 hours past cooling-off
- stuck `transfer_scheduled` payments older than 30 minutes
- stuck `transfer_pending` payments older than 10 minutes and 30 minutes
- recent capture failures
- unprocessed Stripe webhooks
- webhooks with `processing_error`
- webhook retry counts
- Stripe disputes, payout failures, and transfer failures
- mismatch between Stripe state and local `Payment` state

Operational behavior:

- Payment ops health marks the subsystem `healthy`, `degraded`, or `critical`.
- Stuck payment checks run every 15 minutes through `checkAndAlertStuckPayments`.
- Warnings go to Slack.
- Critical alerts can go to PagerDuty.

Current limitation:

- Manual payment-ops actions are logged to Winston as `[AUDIT] payment-ops`, but they are not yet written to a durable append-only audit table.

### 3. Scheduled Jobs

Primary surfaces:

- `[CRON] Starting: <job>`
- `[CRON] Completed: <job>`
- `[CRON] Failed: <job>`
- elapsed time in job completion logs
- job-specific domain logs

The scheduler wraps every job in `wrapJob`, which gives consistent lifecycle logs.

The critical jobs I watch:

- `authorizeUpcomingGigs`
- `processPendingTransfers`
- `retryCaptureFailures`
- `expireUncapturedAuthorizations`
- `expirePendingPaymentBids`
- `autoRemindWorker`
- `chatRedactionJob`
- `checkAndAlertStuckPayments`
- `validateHomeCoordinates`
- `processClaimWindows`

What I watch daily:

- jobs not running at expected cadence
- job failures
- long elapsed time
- repeated partial failures
- payment jobs with nonzero error counts
- redaction job success
- geo validation errors

Current limitation:

- The codebase has docs describing CloudWatch/pg-boss style job visibility as a future or recommended architecture, but the current backend job scheduler is still in-process `node-cron`.

### 4. Chat And Realtime Delivery

Primary surfaces:

- `GET /api/chat/metrics`
- chat route logs
- Socket.IO logs
- push delivery warnings
- unread count updates

What I watch daily:

- chat send attempts
- chat send failures
- send latency
- active socket users
- total socket connections
- room join failures
- Socket.IO auth failures
- push notification failures
- unread count update failures

The chat send path logs:

- `message_send_start`
- `message_send_complete`
- `requestId`
- `roomId`
- `userId`
- `senderUserId`
- `messageId`
- `durationMs`

Current limitation:

- Chat metrics are in-memory.
- Push delivery is non-blocking, which is correct for UX, but it means a message can be stored and live-delivered while background push still fails.

### 5. Geo, Maps, And Address Verification

Primary surfaces:

- `geo_request`
- `geo_response`
- `geocode_request`
- `geocode_response`
- address verification pipeline metrics
- `AddressVerificationEvent`
- Mapbox or provider dashboards
- geo monitoring runbooks

What I watch daily:

- request rate by endpoint
- error rate by endpoint
- p95 latency
- cache hit ratio
- provider distribution
- deprecated endpoint usage
- validation failures
- coordinate validation result mix
- provider fallback rate

This subsystem is relatively privacy-aware. Geo routes hash IPs and redact query content. The broader system still needs a universal log scrubbing strategy, but the geo path is one of the better examples in the repo.

Current limitation:

- Client tile load failures are not centrally reported by the app.
- APM is in-memory.
- Some provider raw responses are stored in DB for verification/debugging, so access controls and retention matter.

### 6. Privacy And Identity Firewall

Primary surfaces:

- `pnpm --filter pantopus-backend run test:privacy`
- serializer forbidden-key tests
- notification context firewall tests
- source grep privacy guards
- `IdentityAuditLog`
- identity migration smoke scripts
- raw user response audit script

What I watch daily or per release:

- privacy gate pass/fail
- new API routes returning raw `User` rows
- unsafe nested `User` selects
- notification templates that receive more context than needed
- admin or identity mutations without audit logs
- frontend privacy UX regressions in identity/profile flows

The core principle is that privacy boundaries should be enforced in code, tested in CI, and made visible in the product.

### 7. Admin, Trust, And Verification Queues

Primary surfaces:

- admin home ownership claims
- business verification queue
- feature flag changes
- home and business IAM changes
- `HomeAuditLog`
- `BusinessAuditLog`
- `IdentityAuditLog`
- planned `AdminAccessLog`

What I watch:

- pending claims
- pending business verification evidence
- fee override changes
- role changes
- permission overrides
- member removals
- guest pass revokes
- admin actions without durable audit trails

Current limitation:

- `AdminAccessLog` exists in schema/migrations as an append-only table, but the current app routes do not consistently write to it.

## 2. How Do I Correlate Frontend Errors, Backend Request IDs, Job Logs, And Stripe Events?

The correlation model is a chain of identifiers. The exact chain depends on the flow.

### Backend Request Correlation

The backend has `requestId` middleware:

- It reads `x-request-id` when present.
- Otherwise, it generates a UUID.
- It attaches the value to `req.requestId`.

This is the foundation for request correlation, but today it is only partially used.

What works:

- Chat routes include `requestId` in important send/create logs.
- Some routes include domain identifiers such as `roomId`, `userId`, `homeId`, `businessId`, `paymentId`, or `gigId`.

What is missing:

- The backend does not set `x-request-id` on responses.
- Frontend clients do not consistently generate or send `x-request-id`.
- The global request log does not include `requestId`.
- Not every route logs `requestId`.

The best version of this system would:

1. Generate a client correlation ID for each API call.
2. Send it as `x-request-id`.
3. Server validates or replaces it.
4. Server returns it as `x-request-id`.
5. Every structured log includes it.
6. Frontend error reports include it.
7. Support tooling lets an operator search by it.

### Frontend Error Correlation

Current state:

- Web error boundaries call `console.error`.
- The shared API client logs redacted API errors only in development.
- Mobile logger is a no-op in production builds.
- No Sentry/OpenTelemetry frontend collector appears wired in this repo.

That means production frontend errors are not first-class correlated events today.

How I debug frontend issues today:

- Start with user report, timestamp, screen, user ID, and action.
- If it was an API failure, search backend logs by timestamp, path, user ID, payment ID, room ID, gig ID, or home ID.
- If it was a payment failure, switch to Stripe IDs and payment state.
- If it was a chat failure, switch to `roomId`, `messageId`, `clientMessageId`, and socket session.

How I would harden it:

- Add Sentry or OpenTelemetry browser/mobile instrumentation.
- Scrub PII before event ingestion.
- Include release version, platform, route/screen, user pseudonymous ID, and request ID.
- Store API request ID on thrown API errors.
- Add a support-safe event timeline view per user.

### Stripe Correlation

Stripe correlation is stronger because the system stores durable webhook events.

Primary identifiers:

- `stripe_event_id`
- `event_type`
- `stripe_payment_intent_id`
- `stripe_charge_id`
- `stripe_transfer_id`
- `stripe_dispute_id`
- `stripe_customer_id`
- `stripe_account_id`
- local `Payment.id`
- `gig_id`
- `payer_id`
- `payee_id`

Webhook behavior:

- Stripe events are verified by signature.
- The event is inserted into `StripeWebhookEvent`.
- Duplicate processed events are skipped.
- Duplicate unprocessed events can be reprocessed.
- Handler failures update `processing_error` and `retry_count`.
- Handler failures return 500 so Stripe can retry.

The operational query pattern is:

1. Start with local `Payment.id` or Stripe PaymentIntent.
2. Find all related Stripe object IDs.
3. Search `StripeWebhookEvent` by `stripe_event_id`, event type, or JSON payload IDs.
4. Compare Stripe Dashboard state with local `Payment` state.
5. Check job logs for transitions or recovery attempts.

### Job Log Correlation

Jobs are not request-scoped. They are correlated by:

- job name
- execution timestamp
- elapsed time
- domain identifiers in job-specific logs
- payment IDs
- gig IDs
- home IDs
- business IDs
- user IDs

For example:

- `processPendingTransfers` correlates by `paymentId`.
- `retryCaptureFailures` correlates by `paymentId`, `gigId`, and capture attempt count.
- `chatRedactionJob` correlates by redaction count and room retention settings.
- `validateHomeCoordinates` correlates by `homeId`.

The biggest improvement would be to assign a `jobRunId` for every job execution and include it in every log emitted during that run.

### Chat Correlation

Chat correlation uses:

- `requestId`
- `roomId`
- `userId`
- `senderUserId`
- `messageId`
- `clientMessageId`
- Socket.IO `sessionId`

The send route stores the message, emits `message:new` to the room, updates unread counts/badges, and attempts push notification delivery non-blockingly.

This means I separate chat failures into four classes:

1. API send failed before persistence.
2. Message persisted but Socket.IO live delivery failed.
3. Live delivery worked but push notification failed.
4. Delivery worked but unread/badge state is wrong.

Each class has different identifiers and different likely owners.

## 3. What PII Appears In Logs Today?

The honest answer is that some PII and sensitive identifiers appear in logs or operational tables today. Some paths are privacy-safe; others need hardening.

### PII Or Sensitive Data In Application Logs

Likely or confirmed values:

- full IP address in request logs
- full user agent in request logs
- IP address in auth failure logs
- user IDs
- home IDs
- business IDs
- room IDs
- message IDs
- gig IDs
- payment IDs
- Stripe object IDs
- possibly email in some user/auth paths
- invite email in business seat mismatch logs
- payment failure messages
- push tokens in push error paths

The backend request logger records:

- method
- path
- `ip`
- `userAgent`

That is operationally useful, but it means the general logs contain personal data.

### PII Or Sensitive Data In Durable Tables

Important tables:

- `StripeWebhookEvent.event_data`
- `AddressVerificationEvent.raw_response`
- `HomeAddress.validation_raw_response`
- `IdentityAuditLog.metadata`
- `BusinessAuditLog.metadata`
- `HomeAuditLog.metadata`
- `FileAccessLog.ip_address`
- `FileAccessLog.user_agent`
- `Payment.failure_message`
- payment metadata and Stripe IDs

Stripe raw event payloads may contain:

- customer identifiers
- billing details
- receipt details
- payment method metadata
- dispute details
- connected account details

Address raw responses may contain:

- provider classification data
- address deliverability data
- geocode/provider details
- parcel or postal validation metadata

Audit logs can contain:

- actor user ID
- target user ID
- IP address
- user agent
- before/after snapshots
- action metadata

These are not necessarily wrong to store, but they require restricted access, retention policy, and careful admin auditing.

### Paths With Better PII Hygiene

Geo routes are comparatively careful:

- IP is hashed.
- queries are redacted.
- reverse geocode coordinates are partially redacted.
- responses log status, counts, provider, cache hit, and latency rather than raw payloads.

Privacy serializers are also carefully guarded:

- `SAFE_CREATOR_SELECT` excludes private user fields.
- serializer tests reject forbidden keys at any depth.
- raw personal select scripts block unsafe cross-context data access.

### Risky Or Needs Review

Areas I would review first:

- general request log IP/user-agent retention
- auth failure logs with IP
- push token logging
- business invite mismatch logs containing expected and actual email
- Lob/provider error logs that may include vendor response bodies
- test/mock mail provider logs that include address and verification code if misconfigured
- raw Stripe event retention
- frontend `console.error` calls that may include full Error objects or response payloads

### What I Would Change

I would implement a log classification policy:

- `public`: path, status, duration, route name
- `internal`: user ID, object IDs, Stripe IDs
- `restricted`: IP, user agent, email, address, payment failure message
- `secret`: tokens, auth headers, push tokens, verification codes

Then I would:

- add a central logger scrubber
- hash or truncate IPs by default
- ban token/code logging
- redact email local parts unless required
- move high-risk details to restricted audit tables
- add log PII tests for known unsafe patterns
- add frontend error scrubbing before any production collector is enabled

## 4. What Is The Log Retention Policy?

The current log retention policy is partial.

### Backend Winston Logs

The backend logger writes:

- console output
- `combined.log`
- 50 MB per file
- 5 rotated files
- tailable rotation

That means local file retention is approximately 250 MB, size-based rather than time-based.

This is not a complete production retention policy because console logs may be collected by container, host, or cloud infrastructure outside the codebase. The repo documents CloudWatch for Lambda and custom metrics, but I do not see a complete time-based retention definition for backend application logs.

### In-Memory Metrics

APM and chat metrics are in-memory rolling snapshots.

Implications:

- low storage risk
- easy local debugging
- no historical trend after restart
- no long-term SLO reporting unless exported elsewhere

### Chat Content Retention

Soft-deleted chat messages are redacted by `chatRedactionJob`.

Default:

- `CHAT_DELETED_REDACT_DAYS=180`

Behavior:

- soft-deleted message body becomes `[deleted message]`
- attachments are cleared
- room-level retention overrides are supported
- job runs hourly

This is not the same as total chat retention. It is deleted-message redaction retention.

### Queue And Seeder Retention

Seeder/Lambda docs describe queue hygiene:

- filtered/skipped items older than 7 days are purged
- posted items older than 30 days are purged
- queued items older than 48 hours are treated as stale

### Durable Audit And Financial Tables

I did not find a purge policy for:

- `StripeWebhookEvent`
- `AddressVerificationEvent`
- `IdentityAuditLog`
- `BusinessAuditLog`
- `HomeAuditLog`
- `AdminAccessLog`
- `Payment`

Financial/payment records and audit logs often need longer retention, but the policy should be explicit:

- purpose
- retention period
- access controls
- deletion/anonymization rules
- legal hold behavior
- backup retention

### My Production Policy

If I were formalizing this, I would use:

- 7 to 14 days hot searchable app logs
- 30 to 90 days restricted security/audit operational logs
- 1 to 7 years for financial/audit records depending legal/accounting requirements
- shorter retention for IP/user-agent unless needed for abuse/security
- separate access control for raw Stripe and address provider payloads
- periodic retention jobs with deletion reports

## 5. How Do I Debug One User's Failed Payment?

Payment debugging starts from the highest-fidelity identifier available:

- local `Payment.id`
- `gig_id`
- user ID
- Stripe PaymentIntent ID
- Stripe Charge ID
- Stripe Transfer ID
- timestamp

### Step 1. Identify The User-Visible Failure

First I classify the failure:

- setup failed
- authorization failed
- 3DS/authentication required
- capture failed
- payment captured but transfer did not happen
- wallet credit failed
- payout failed
- refund/dispute changed state
- webhook processed late or failed
- UI showed stale state

The class determines the owner and the recovery path.

### Step 2. Inspect Local State

Inspect the local `Payment` row:

- `payment_status`
- `transfer_status`
- `stripe_payment_intent_id`
- `stripe_charge_id`
- `stripe_transfer_id`
- `stripe_customer_id`
- `stripe_payment_method_id`
- `failure_code`
- `failure_message`
- `capture_attempts`
- `authorized_at`
- `captured_at`
- `cooling_off_ends_at`
- `transfer_scheduled_at`
- `transferred_at`
- `gig_id`
- `payer_id`
- `payee_id`

Then inspect the related `Gig` or bid state. Payment state and product state must agree.

### Step 3. Inspect Stripe State

Open Stripe Dashboard using:

- PaymentIntent
- Charge
- Transfer
- connected account
- customer
- dispute

Confirm:

- did Stripe authorize?
- did Stripe capture?
- did Stripe require action?
- did Stripe create a charge?
- did transfer happen?
- did Stripe send a webhook?
- is there a dispute or refund?
- is connected account restricted?

### Step 4. Inspect Webhook Processing

Query `StripeWebhookEvent`:

- event type
- event ID
- object IDs in `event_data`
- `processed`
- `processed_at`
- `processing_error`
- `retry_count`
- created time

Important operational behavior:

- duplicate processed events are skipped
- unprocessed duplicates can be retried
- processing errors return 500 so Stripe retries

If Stripe says the event was delivered but `StripeWebhookEvent` has an error, I debug the handler. If Stripe never delivered, I inspect endpoint configuration and Stripe logs.

### Step 5. Inspect Payment Jobs

Search logs for:

- `processPendingTransfers`
- `retryCaptureFailures`
- `expireUncapturedAuthorizations`
- `expirePendingPaymentBids`
- `checkAndAlertStuckPayments`
- payment ID
- gig ID
- Stripe IDs

Common cases:

- `captured_hold` past cooling-off means transfer job did not complete.
- `transfer_scheduled` older than 30 minutes means wallet credit may have failed.
- `transfer_pending` older than 10 minutes means recovery should pick it up.
- `transfer_pending` older than 30 minutes is critical.
- owner confirmed but payment still authorized means capture retry path matters.

### Step 6. Use Payment Ops Endpoints

Use:

- `GET /api/admin/payment-ops/health`
- `GET /api/admin/payment-ops/stuck`
- `POST /api/admin/payment-ops/run-alerts`
- `POST /api/admin/payment-ops/trigger-transfers`

I only run manual recovery after verifying the Stripe and DB states. I do not fix money bugs by editing one side of the ledger blindly.

### Step 7. Resolve And Document

A good payment debug produces:

- root cause
- affected users
- affected payment IDs
- Stripe IDs
- local state before recovery
- local state after recovery
- admin action performed
- user communication
- follow-up prevention

If the fix was manual, it must be audited.

## 6. How Do I Debug One User's Failed Chat Delivery?

Chat delivery is a multi-stage pipeline. I debug it by identifying which stage failed.

### Primary Identifiers

Useful identifiers:

- `userId`
- `roomId`
- `messageId`
- `clientMessageId`
- `requestId`
- Socket.IO `sessionId`
- timestamp
- recipient user ID

### Stage 1. API Send Request

Search for:

- `message_send_start`
- `message_send_complete`
- `requestId`
- `roomId`
- `userId`

If `message_send_start` exists but no completion exists, inspect:

- auth
- room membership
- inactive participant state
- blocked users
- bid/pre-bid rules
- attachment validation
- file ownership
- message schema validation
- rate limiting

### Stage 2. Persistence

Check whether the `ChatMessage` row exists.

If it does not exist:

- API send failed before persistence.
- Look at route validation and Supabase insert errors.

If it exists:

- persistence succeeded.
- Move to realtime delivery.

### Stage 3. Idempotency

If the client provided `clientMessageId`, the backend checks for an existing message. This allows safe retry without duplicate messages.

If the user tapped send multiple times or the client retried after a network timeout, I check whether the same `clientMessageId` was reused.

### Stage 4. Socket.IO Delivery

Socket.IO logs include:

- socket auth
- user ID
- session ID
- room join
- connected users
- total connections

If the message exists but the recipient did not see it live, likely causes are:

- recipient socket not connected
- recipient did not join room
- socket auth failed
- app backgrounded
- room ID mismatch
- client listener not attached
- network reconnect race

The server emits `message:new` to the room after insert.

### Stage 5. Unread Counts And Badges

If the message appears but unread counts are wrong, inspect:

- `ChatParticipant` rows
- unread count updates
- badge update logs
- recipient participant state

### Stage 6. Push Notifications

Push is non-blocking. A push failure should not fail message send.

If the message was stored but the recipient did not get a push:

- inspect notification preferences
- inspect push token presence and validity
- inspect Expo receipts/provider response
- search for `Chat push delivery failed (non-blocking)`
- check whether recipient was already active in the room

### Stage 7. User-Facing Resolution

The support answer depends on failure class:

- API failed: message was not sent; client should retry.
- Stored but live delivery failed: message exists; reload/reconnect should show it.
- Push failed: message exists; notification path needs token/preference/provider investigation.
- Unread state failed: message exists; badge state needs reconciliation.

## 7. What Alerts Are Noisy?

The current alerting system supports Slack for info/warning/critical and PagerDuty for critical. This is good, but any alerting system needs constant pruning.

### Likely Noisy Alerts

#### `transfer_pending >10m`

This is useful as an early warning, but it can be noisy because recovery is expected to resolve some of these. The more actionable threshold is `transfer_pending >30m`, which is treated as critical.

Recommendation:

- Keep `>10m` as Slack-only.
- Page only on `>30m` or sustained count over multiple checks.

#### `processPendingTransfers` Any Error Count

The transfer job sends warnings if there are any batch errors. That can be noisy during transient Stripe, DB, or wallet issues.

Recommendation:

- Alert on rate or repeated failures.
- Include affected payment IDs.
- Separate transient provider errors from deterministic data bugs.

#### Geo Cache Hit Ratio

Low cache hit ratio immediately after deploy or cache flush can be expected.

Recommendation:

- Alert only after warm-up.
- Use traffic minimums.
- Segment by endpoint.

#### Auth `no_token` And Invalid Token

Auth warnings can be high volume because of expired sessions, bots, crawlers, and clients with stale cookies.

Recommendation:

- Aggregate by route, IP hash, and user agent class.
- Alert only on spikes or suspicious patterns.

#### Push Token Failures

Invalid or stale push tokens are normal in mobile apps.

Recommendation:

- Aggregate by provider error code.
- Auto-disable invalid tokens.
- Alert on provider-wide failure rate, not individual token failures.

#### Cron No-Work Logs

Many jobs log "no work found" or completion with zero work. This is useful for debugging but should not be alerting noise.

Recommendation:

- Keep as info logs.
- Alert on missing completion, failures, or unexpectedly long runtime.

### Alert Quality Principles

Every page should have:

- clear owner
- clear user impact
- runbook
- threshold
- dedup key
- example query
- rollback or mitigation

Warnings should be useful for business-hours triage. Pages should mean immediate user or money impact.

## 8. What Incidents Have Happened, And What Changed Afterward?

The repo does not contain a complete incident register, but it does contain audits and rollout documents that show the major operational learnings.

### Payment And Payout Readiness Audit

Document:

- [`docs/payment-payout-audit-2026-03-08.md`](../payment-payout-audit-2026-03-08.md)

The audit identified release-blocking issues around payment correctness, webhook idempotency, retry behavior, wallet consistency, Stripe edge cases, and payout state transitions.

Changes visible in the codebase:

- durable `StripeWebhookEvent` storage
- duplicate event handling
- processing error tracking
- retry count tracking
- 500 responses on handler failure so Stripe retries
- payment ops health endpoint
- stuck payment detection endpoint
- stuck payment alerting
- stranded transfer recovery
- capture retry job
- authorization expiry job

Remaining caution:

- Payment systems need continuous reconciliation. The code has improved, but money movement should still be treated as a high-risk subsystem with explicit runbooks and audit trails.

### Identity Firewall And Privacy Hardening

Documents:

- [`docs/pantopus-identity-firewall-engineering-design-2026-05-04.md`](../pantopus-identity-firewall-engineering-design-2026-05-04.md)
- [`docs/identity-firewall-migration-smoke-runbook-2026-05-05.md`](../identity-firewall-migration-smoke-runbook-2026-05-05.md)
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

The system moved toward a stronger separation between local identity, public/persona identity, followers, memberships, and privacy settings.

Changes visible:

- `SAFE_CREATOR_SELECT`
- serializer forbidden-key contracts
- notification context firewall
- source grep guards for raw personal selects
- `IdentityAuditLog`
- raw user response audit scripts
- tests for identity search/privacy boundaries

The key learning:

- Privacy cannot rely on convention. It needs typed serializers, route-level tests, and source-level gates.

### Geo And Maps Production Migration

Documents:

- [`docs/geo-monitoring.md`](../geo-monitoring.md)
- [`docs/geo-runbooks.md`](../geo-runbooks.md)
- [`docs/maps-production-migration-plan.md`](../maps-production-migration-plan.md)
- [`docs/location-privacy-matrix.md`](../location-privacy-matrix.md)

Changes visible:

- privacy-safe geo logs
- IP hashing
- query redaction
- provider observability
- runbooks for provider switching and feature flags
- location privacy matrix for gigs/posts/listings/homes

Remaining gaps:

- client tile load errors are not centrally captured
- metrics export is incomplete
- some map/provider observability depends on logs rather than durable metrics

### Chat Reliability

Documents:

- [`docs/message-chat-plan.md`](../message-chat-plan.md)
- [`docs/03-jobs-stripe-realtime.md`](../03-jobs-stripe-realtime.md)

Changes visible:

- request IDs in chat send logs
- `clientMessageId` idempotency
- Socket.IO session tracking
- room delivery through `message:new`
- chat metrics endpoint
- hourly chat redaction job
- non-blocking push delivery

Remaining gaps:

- no centralized frontend/mobile error correlation
- no durable message delivery receipt system
- chat metrics are in-memory

### Home/Business Trust And Verification

Documents:

- home ownership and claim design docs
- address verification rollout docs
- business verification/admin routes

Changes visible:

- home ownership claim admin flows
- evidence review
- business verification approval/rejection
- home and business audit logs
- role and permission mutation logs
- occupancy attach/detach audit behavior

Remaining gaps:

- admin review routes should consistently write explicit durable audit rows for every privileged action.

## 9. How Do I Detect Privacy Regressions Before Users Do?

Privacy regression detection has three layers: design constraints, CI gates, and runtime audit.

### CI Privacy Gates

The command:

```bash
pnpm --filter pantopus-backend run test:privacy
```

This runs:

1. Serializer forbidden-key contract tests.
2. Notification template and cross-context firewall tests.
3. Source grep guards for unsafe identity patterns.

The gates catch:

- forbidden fields in serialized public API responses
- raw `User` data leaking across identity boundaries
- unsafe nested user selects
- legacy identity aliases
- notification templates receiving too much context
- public/audience surfaces using personal profile fields

### Serializer Strategy

`SAFE_CREATOR_SELECT` is the canonical safe user projection for public creator joins.

The principle is:

- public surfaces get only public-safe fields
- private account serializers are explicit
- local identity and public/persona identity are separated
- raw DB rows should not be returned unless the route is explicitly private/admin

### Notification Context Firewall

Notification templates are dangerous because they often mix user, recipient, actor, and target context.

The repo has tests that assert templates only receive allowed fields for their audience.

This prevents regressions like:

- sending private local identity fields to an audience notification
- exposing personal email/name in fan-facing notifications
- mixing actor private context into public persona notifications

### Source-Level Guards

The CI scripts scan for patterns such as:

- reintroducing unsafe `CREATOR_SELECT`
- raw SQL selecting personal columns from `User`
- nested user selects that do not use safe projections
- legacy identity terminology

These are intentionally blunt. That is useful because privacy regressions are often introduced by a seemingly harmless query shortcut.

### Runtime Audit

Runtime audit paths include:

- `IdentityAuditLog`
- `BusinessAuditLog`
- `HomeAuditLog`
- planned/partial `AdminAccessLog`

These do not prevent leaks by themselves, but they answer:

- who changed this?
- what changed?
- when?
- from what IP/user-agent?
- what object was affected?

### Remaining Privacy Gaps

I would still add:

- production log PII scanner
- pre-commit or CI grep for token/code logging
- Sentry/OpenTelemetry scrubbing tests before enabling frontend capture
- admin access logging on every cross-context lookup
- retention policy for raw Stripe and address provider payloads
- periodic privacy canary tests against deployed APIs

## 10. What Is The Operational Owner For Each Subsystem?

A production system needs ownership by subsystem, not only by repository.

| Subsystem | Operational Owner | Why |
| --- | --- | --- |
| Backend API runtime | Backend/platform owner | Owns Express app, health, request logging, APM, deploys |
| Auth/session middleware | Backend/auth owner | Owns `verifyToken`, auth failures, token paths, session behavior |
| Identity/privacy/personas | Privacy/identity owner | Owns Identity Firewall, serializers, privacy gates, audit logs |
| Payments/Stripe/wallet | Payments owner | Owns Payment state machine, Stripe webhooks, captures, transfers, disputes |
| Scheduled jobs | Backend/platform plus domain owners | Platform owns scheduler; domain owners own job correctness |
| Chat/realtime | Messaging/realtime owner | Owns chat routes, Socket.IO, unread state, push fanout |
| Push notifications | Messaging/mobile owner | Owns tokens, provider errors, preferences, receipts |
| Geo/maps/geocoding | Geo/platform owner | Owns providers, map failures, cache, privacy-safe location behavior |
| Address verification/mail | Trust/address owner | Owns address validation, postcard verification, provider responses |
| Home IAM/claims | Trust and safety owner | Owns home access, claims, occupancy, evidence review |
| Business verification/IAM | Trust/business owner | Owns verification evidence, seats, fee overrides, permissions |
| Marketplace/listings | Marketplace owner | Owns browse/detail privacy, inventory, seller workflows |
| AI/hub/briefings | AI platform owner | Owns model calls, AI logs, prompt/version behavior |
| Seeder/Lambda | Content infrastructure owner | Owns EventBridge/Lambda, CloudWatch metrics, queue depth |
| Web frontend | Web owner | Owns Next.js app, web errors, user flows, frontend observability |
| Mobile app | Mobile owner | Owns Expo app, production logger, push token lifecycle |
| Admin tooling | Ops owner with engineering reviewer | Owns privileged workflows, audit quality, manual recovery |

For every subsystem I want:

- on-call owner
- dashboard
- alert definitions
- runbook
- escalation path
- audit requirements
- privacy classification

## 11. What Manual Admin Actions Are Possible, And How Are They Audited?

Manual admin actions are necessary, but they are also one of the highest-risk parts of the system. The rule is that privileged actions should be explicit, least-privileged, and durably audited.

### Payment Operations

Admin actions:

- view payment system health
- list stuck payments
- manually trigger pending transfers
- manually run stuck payment alerts

Audit today:

- writes `[AUDIT] payment-ops` to Winston

Gap:

- should write to durable `AdminAccessLog` or a payment-specific audit table with actor, action, reason, before/after state, affected payment IDs, and request metadata.

### Home Ownership Claims

Admin actions:

- list pending claims
- view claim details
- view evidence through presigned URLs
- approve claim
- reject claim
- request more information

Audit today:

- logs admin review
- downstream occupancy attach/detach paths write `HomeAuditLog`

Gap:

- the admin review decision itself should be durably written with claim ID, actor ID, decision, reason, evidence IDs viewed, and before/after state.

### Business Verification

Admin actions:

- approve evidence
- reject evidence
- set business verification
- clear or set nonprofit/fee override

Audit today:

- writes `BusinessAuditLog`

This is closer to the desired model because changes are attached to the business and actor.

### Feature Flags

Admin actions:

- update enabled flags
- change descriptions
- modify internal/beta user lists

Audit today:

- writes `IdentityAuditLog`
- includes field-level diff
- includes request metadata
- redacts beta user IDs into counts in responses

This is a good example of an admin mutation path.

### Home IAM

Admin or privileged home actions:

- role changes
- permission overrides
- member removal
- household access approval/rejection
- guest pass revoke
- lockdown-style controls

Audit today:

- `HomeAuditLog`
- before/after data for some changes
- actor and target identifiers

### Business IAM

Admin or privileged business actions:

- role changes
- permission overrides
- seat/member removal
- invite handling

Audit today:

- `BusinessAuditLog`

### Identity And Persona Actions

Actions:

- persona creation/update
- follow/membership changes
- blocks
- privacy setting changes
- persona tier changes
- upload-related identity changes
- feature flag changes

Audit today:

- `IdentityAuditLog`

### File Access

The schema includes `FileAccessLog`:

- file ID
- user ID
- access type
- IP address
- user agent
- success/failure
- error message

This is a useful foundation for evidence/file audit, but file routes should be reviewed to ensure every sensitive file view/download path writes it.

### AdminAccessLog

The schema includes append-only `AdminAccessLog` for moderator/admin cross-context access.

Important properties:

- scope constraints
- reason category constraints
- target IDs
- metadata
- append-only trigger blocking update/delete
- service-role access only

Gap:

- the route layer does not appear to consistently write to it yet.

This is one of the clearest operational improvements: every admin read or mutation crossing normal user boundaries should write an `AdminAccessLog` row.

## 12. How I Would Improve The System Next

If I were prioritizing the next engineering investments, I would do them in this order.

### Priority 1. End-To-End Correlation

Changes:

- generate client request IDs
- send `x-request-id`
- set `x-request-id` response header
- include request ID in every backend log
- attach request ID to API errors
- include request ID in frontend error reports
- add job run IDs

Impact:

- faster incident debugging
- better support workflows
- less guesswork across frontend/backend/job/provider boundaries

### Priority 2. Production Frontend Error Capture

Changes:

- add Sentry or OpenTelemetry for web and mobile
- scrub PII
- tag release, route, screen, platform, user pseudonymous ID
- capture unhandled errors and API failures
- link frontend event to backend request ID

Impact:

- stop relying on user screenshots and console logs
- detect regressions before support tickets pile up

### Priority 3. Durable Admin Audit

Changes:

- wire `AdminAccessLog` into all admin routes
- require reason category for sensitive actions
- log sensitive reads as well as writes
- add audit tests
- add admin audit dashboard

Impact:

- better compliance posture
- better internal accountability
- easier incident reconstruction

### Priority 4. Log PII Reduction

Changes:

- central logger scrubber
- hash/truncate IPs
- redact emails, tokens, verification codes, push tokens
- classify log fields
- add CI grep for forbidden log patterns
- restrict raw provider payload access

Impact:

- lower breach impact
- better privacy posture
- safer observability adoption

### Priority 5. Metrics Export And SLOs

Changes:

- export APM metrics to Prometheus/CloudWatch/Datadog
- export chat metrics
- export job run metrics
- define SLOs per user journey
- add dashboards by user flow

Impact:

- long-term trend analysis
- alerting based on user impact
- fewer false positives

### Priority 6. Payment Reconciliation Dashboard

Changes:

- scheduled reconciliation between Stripe and local `Payment`
- dashboard for state mismatches
- admin-safe recovery workflows
- durable recovery audit
- affected-user export for support

Impact:

- safer money movement
- faster failed payment resolution
- fewer stuck states

## 13. Interview Answer, Condensed

If I had to answer verbally in a few minutes:

> I look daily at API health/APM, payment ops, Stripe webhooks, scheduled jobs, chat delivery, geo/address verification, privacy gates, and admin/audit queues. The backend has solid hooks: route metrics, Winston logs, payment stuck detection, Stripe webhook persistence, job wrappers, chat metrics, and audit tables. The weaker area is end-to-end correlation, especially production frontend errors.
>
> Correlation starts with request IDs, but today it is only partial. Backend request IDs exist, chat uses them well, payments correlate through Stripe and local payment IDs, and jobs correlate by job name plus domain IDs. I would complete the chain by making clients send `x-request-id`, returning it in responses, putting it in every log, and adding frontend error capture with PII scrubbing.
>
> PII in logs today includes IPs, user agents, user IDs, object IDs, Stripe IDs, some emails, push tokens in some error paths, and raw provider payloads in operational tables. Geo logging is relatively privacy-safe, and identity serializers are heavily tested, but log scrubbing is not uniform yet.
>
> Log retention is currently size-based for backend files, with 50 MB times 5 files, plus whatever infrastructure retains console logs. APM/chat metrics are in-memory. Deleted chat messages are redacted after 180 days by default. Financial, webhook, address verification, and audit records do not have an explicit purge policy in the repo.
>
> For a failed payment I start with the local payment and Stripe IDs, compare local `Payment` state to Stripe state, inspect webhook processing, check payment job logs, then use payment ops endpoints for stuck states. For failed chat delivery I determine whether the failure happened before persistence, after persistence but before socket delivery, in push delivery, or in unread/badge state.
>
> The noisiest alerts are early payment stuck warnings, transient transfer job errors, auth token noise, push token failures, and geo cache alerts during warm-up. The incidents reflected in the repo are payment/payout hardening, Identity Firewall privacy hardening, geo observability, and chat reliability work. Privacy regressions are caught mainly through CI privacy gates, safe serializers, notification context tests, and source-level guards.
>
> Operational ownership should be explicit per subsystem: payments owns Stripe and wallet state; messaging owns chat and push; identity/privacy owns serializers and audit; platform owns API/jobs/metrics; trust owns home/business verification; frontend owners own web/mobile observability. Manual admin actions exist across payments, claims, verification, feature flags, IAM, and identity. Some are well audited through domain audit tables, but payment ops and cross-context admin access need stronger durable append-only audit wiring.

## Final Assessment

This is not a toy codebase with no operational thinking. It has real hooks around the riskiest flows: payments, jobs, chat, identity privacy, geo, and admin operations. The codebase shows the right instincts: state-specific payment recovery, webhook persistence, privacy gates, domain audit tables, and runbooks.

The next level is consistency:

- every request correlated
- every frontend failure captured safely
- every privileged admin action durably audited
- every sensitive log field classified
- every critical job externally measured
- every high-risk subsystem owned by a named team/person

That is the difference between "we have logs" and "we can operate this system under pressure."
