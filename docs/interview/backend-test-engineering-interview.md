# Backend Test Engineering Interview Notes

This document is an interview-ready explanation of the backend test strategy in this repository. It is written from the perspective of a test engineer who knows the system deeply, understands where the tests create the most risk reduction, and can speak honestly about the remaining gaps.

The backend is an Express/Supabase/Socket.IO/Stripe service. Most tests run under Jest with mocked Supabase clients for speed and determinism. A smaller set runs against real Supabase/Postgres for schema, migration, and high-risk workflow coverage.

## Executive Summary

The highest-value backend tests protect the areas where a regression would create the largest user, business, or compliance impact:

1. Privacy and identity isolation
2. Payment and webhook correctness
3. Home, business, and neighborhood authority rules
4. Schema and migration compatibility
5. Realtime chat behavior across reconnects and multiple clients

The suite is intentionally layered:

- Fast unit and route tests use mocks heavily.
- Privacy gates combine static source scanning with runtime response assertions.
- Live Supabase tests cover selected schema and workflow contracts.
- Direct Postgres tests validate migration-level constraints, triggers, and views.
- Payment tests use deterministic Stripe fixtures and mocked SDK calls.
- Realtime tests use real Socket.IO clients but still mock Supabase.

The honest assessment is that the suite has strong coverage for business logic and privacy serialization, but comparatively limited live Supabase coverage. That is a deliberate tradeoff for CI speed and determinism, but it means schema/RLS/join behavior must be protected by a smaller number of focused live tests.

## Repository Facts

Key files:

- `backend/package.json`
- `backend/jest.config.js`
- `backend/jest.integration.config.js`
- `backend/tests/__mocks__/supabaseAdmin.js`
- `backend/tests/integration/helpers.js`

Important scripts:

```json
{
  "test": "jest --verbose --forceExit",
  "test:integration": "jest --config jest.integration.config.js --verbose --forceExit",
  "test:privacy": "node scripts/ci/run-privacy-gates.js"
}
```

Important privacy and static-gate scripts:

- `backend/scripts/ci/check-creator-select.js`
- `backend/scripts/ci/check-legacy-identity-aliases.js`
- `backend/scripts/ci/check-legacy-ui-terms.js`
- `backend/scripts/ci/check-raw-personal-selects.js`
- `backend/scripts/ci/check-nested-user-selects.js`
- `backend/scripts/ci/run-privacy-gates.js`

Approximate coverage shape from repository inspection:

- Backend test files: 203 `*.test.js` files
- Approximate backend `test`/`it` count: 3,081
- Approximate integration-folder `test`/`it` count: 253
- Live Supabase route tests: about 86
- Direct Postgres migration tests: about 23
- Combined live database-oriented tests: about 109, roughly 3.5 percent of backend test cases

The exact counts can change as tests are added, but the important architectural point is stable: most backend tests are mock-backed, while a focused minority run against real Supabase/Postgres.

## What Are The Highest-Value Backend Tests?

The highest-value backend tests are the tests that protect irreversible or high-blast-radius failures. In this codebase, that means privacy, payments, authority, schema, and realtime.

### 1. Privacy And Identity Isolation

These are the most important tests in the backend because the product has multiple identity contexts: local identity, persona identity, business identity, audience identity, home identity, and chat identity. A bad select, serializer, join, or response spread can leak private user fields across contexts.

High-value examples:

- `backend/tests/unit/privacy/serializerForbiddenKeys.test.js`
- `backend/tests/unit/privacy/privacyGates.test.js`
- `backend/tests/unit/rawUserIdentityResponses.test.js`
- `backend/tests/unit/safeCreatorSelect.test.js`
- `backend/tests/unit/identityFirewallPrivacy.test.js`
- `backend/tests/unit/identitySearch.test.js`
- `backend/tests/unit/userSearchPrivacy.test.js`
- `backend/tests/integration/audienceProfile.e2e.test.js`
- `backend/tests/integration/identityCenter.viewAs.test.js`
- `backend/tests/integration/posts.identityContext.test.js`
- `backend/tests/integration/notifications.context.test.js`

Why these tests matter:

- They verify that raw `User` fields do not escape through API responses.
- They protect against accidental object spreading of database rows.
- They force use of safe serializer contracts instead of ad hoc response shapes.
- They test both direct keys and leaked values, which is important because a field can leak even if it is renamed.

In an interview, I would emphasize that privacy tests have to be both static and dynamic. Static scanning catches dangerous source changes early. Runtime response tests prove that actual API payloads are clean.

### 2. Payments, Webhooks, And Money Movement

Payment tests are high value because the failure modes include duplicate charges, missed captures, incorrect refunds, membership desynchronization, and webhook replay bugs.

High-value examples include:

- `backend/tests/paymentStateMachine.test.js`
- `backend/tests/fullPaymentLifecycle.test.js`
- `backend/tests/bidAcceptancePayment.test.js`
- `backend/tests/paymentReliability.test.js`
- `backend/tests/captureRetry.test.js`
- `backend/tests/scaOnSession.test.js`
- `backend/tests/scaOffSession.test.js`
- `backend/tests/webhookIdempotency.test.js`
- `backend/tests/stripeWebhookTipNotification.test.js`
- `backend/tests/unit/personaWebhooks.test.js`
- `backend/tests/unit/personaMembershipLifecycle.test.js`
- `backend/tests/withdrawalIdempotency.test.js`
- `backend/tests/refundAuthorization.test.js`
- `backend/tests/postTransferRefund.test.js`
- `backend/tests/transferRecovery.test.js`

The most important payment invariants are:

- Webhook event IDs are idempotent.
- Duplicate webhooks do not duplicate side effects.
- Failed webhooks can be retried deterministically.
- State transitions are allowed only from valid prior states.
- Refund and transfer recovery logic does not overpay or underpay.
- Persona subscription events produce canonical membership state.

### 3. Home, Business, And Neighborhood Authority

The home and address system is a high-risk area because it determines who can see or act on home, mailbox, neighborhood, landlord, renter, and business data.

High-value live tests:

- `backend/tests/integration/homeOnboarding.test.js`
- `backend/tests/integration/home-mailbox.test.js`
- `backend/tests/integration/schema-validation.test.js`
- `backend/tests/integration/neighborhoodPulse.integration.test.js`
- `backend/tests/integration/gig-lifecycle.test.js`

High-value unit and route tests:

- address decision engine tests
- business address tests
- home claim routing tests
- landlord authority tests
- mailbox verification tests
- occupancy attachment tests
- home permissions tests
- home IAM tests
- business IAM tests
- auth exploit tests

These tests matter because mocks are weak at enforcing database truth. Home and business behavior depends on real columns, uniqueness rules, occupancy state, authority state, and route-level permissions.

### 4. Schema And Migration Contracts

The schema tests are high value because this backend uses Supabase/PostgREST-style selects heavily. A stale column name can compile fine and still fail only at runtime.

High-value examples:

- `backend/tests/integration/schema-validation.test.js`
- `backend/tests/integration/personaTier.migration.test.js`
- `backend/tests/integration/personaSchemaPhase1.test.js`
- `backend/tests/unit/identityFirewallMigrationSmoke.test.js`
- `backend/scripts/identity-firewall-migration-smoke.js`

These tests protect:

- column names used by route code
- constraints
- foreign keys
- check constraints
- uniqueness
- trigger behavior
- append-only audit behavior
- view filters
- backfill idempotency

### 5. Realtime Chat Behavior

Realtime tests are valuable because bugs often appear only when multiple clients, reconnects, and ordering interact.

Primary test:

- `backend/tests/e2e/chatSocket.test.js`

It uses:

- an in-process HTTP server
- the real Socket.IO server layer
- real `socket.io-client` clients
- mocked Supabase/auth

It covers:

- connection authentication
- room join
- message broadcast
- message edit broadcast
- message delete broadcast
- reaction update broadcast
- typing indicators
- disconnect cleanup
- reconnect and rejoin
- multiple sockets for one user
- first-socket online transition
- last-socket offline transition

The key limitation is that it does not test real Supabase Realtime or real database-backed replication.

## Which Privacy Tests Would Fail If A Developer Selected Raw User Fields?

There are two lines of defense: static gates and runtime payload tests.

### Static Gates

If a developer introduces a new raw `User` select in an obvious dangerous pattern, these gates should fail:

- `backend/scripts/ci/check-creator-select.js`
- `backend/scripts/ci/check-raw-personal-selects.js`
- `backend/scripts/ci/check-nested-user-selects.js`

These scripts are designed to catch patterns such as:

- selecting raw creator fields
- selecting raw personal fields from `User`
- nested Supabase selects that pull unsafe `User` columns
- Prisma-style includes/selects that expose private identity fields

Examples of fields that should be blocked:

- `name`
- `first_name`
- `last_name`
- `legal_name`
- `email`
- `phone`
- `phone_number`
- `address`
- `city`
- `state`

The static checks are especially useful because they fail before the developer has to know which endpoint fixture would expose the problem.

### Runtime Serializer And Response Tests

If the raw fields make it into an object that is serialized or returned from an API, these tests should fail:

- `backend/tests/unit/privacy/serializerForbiddenKeys.test.js`
- `backend/tests/unit/rawUserIdentityResponses.test.js`
- `backend/tests/unit/safeCreatorSelect.test.js`
- `backend/tests/unit/identityFirewallPrivacy.test.js`
- `backend/tests/unit/identitySearch.test.js`
- `backend/tests/unit/userSearchPrivacy.test.js`
- `backend/tests/integration/audienceProfile.e2e.test.js`
- `backend/tests/integration/identityCenter.viewAs.test.js`
- `backend/tests/integration/posts.identityContext.test.js`
- `backend/tests/integration/notifications.context.test.js`

These tests catch both forbidden keys and forbidden values. That distinction matters. A response might not literally contain an `email` key, but it might still leak `private@example.com` under a different property name.

### What Would Not Be Fully Protected?

The static gates are pattern-based and some legacy files are allowlisted. If a developer adds a new raw select inside an allowlisted legacy route, the static gate may not catch it. In that case, the leak would need to be caught by serializer or endpoint response tests.

That is why privacy coverage should never rely on only one strategy. The correct model is:

1. static source scanning catches dangerous code patterns
2. serializer tests enforce canonical output contracts
3. route tests verify real response payloads
4. integration tests verify cross-context behavior

## How Much Of The System Is Covered By Integration Tests Against Supabase?

The answer is: a focused minority, not the majority.

Approximate repository inspection numbers:

| Category | Approximate Count | Notes |
| --- | ---: | --- |
| All backend `test`/`it` cases | 3,081 | Across backend test files |
| Tests under `backend/tests/integration` | 253 | Includes both live and mock-backed tests |
| Live Supabase route tests | 86 | Real Supabase plus running backend |
| Direct Postgres migration tests | 23 | Real Postgres/Supabase DB connection |
| Combined live DB-oriented tests | 109 | About 3.5 percent of backend test cases |

The live Supabase route tests include:

- `backend/tests/integration/gig-lifecycle.test.js`
- `backend/tests/integration/home-mailbox.test.js`
- `backend/tests/integration/homeOnboarding.test.js`
- `backend/tests/integration/neighborhoodPulse.integration.test.js`
- `backend/tests/integration/schema-validation.test.js`
- the conditional live Supabase block in `backend/tests/businessAddress.test.js`

The direct Postgres migration tests include:

- `backend/tests/integration/personaTier.migration.test.js`
- `backend/tests/integration/personaSchemaPhase1.test.js`

Several files in `backend/tests/integration` are integration-shaped but mock-backed. They are still valuable because they exercise route/service boundaries, but they should not be described as real Supabase coverage.

Examples of mock-backed integration-shaped tests:

- `auth-exploits`
- `audienceProfile.e2e`
- `business-onboarding`
- `chatAccessControl`
- `chatMessageDelivery`
- `identity-firewall`
- `identityCenter.unified`
- `identityCenter.viewAs`
- `notifications.context`
- `posts.identityContext`
- `personaPayments.stripeArgs`

In an interview, I would be direct about this. The system has broad mocked integration coverage and narrow live Supabase coverage. That is acceptable only because the live tests are targeted at failure classes mocks historically miss.

## Which Tests Require Real External Services?

### Real Supabase And Running Backend

The live integration helper requires Supabase environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- usually `SUPABASE_ANON_KEY`
- `BACKEND_URL`, defaulting to `http://localhost:8000`

Tests in this category create users through Supabase Auth admin APIs, seed rows, sign in as anon clients, and call the running backend.

Examples:

- `backend/tests/integration/gig-lifecycle.test.js`
- `backend/tests/integration/home-mailbox.test.js`
- `backend/tests/integration/homeOnboarding.test.js`
- `backend/tests/integration/neighborhoodPulse.integration.test.js`
- `backend/tests/integration/schema-validation.test.js`
- live block in `backend/tests/businessAddress.test.js`

### Real Postgres/Supabase Database

The migration tests require a direct database URL or PG environment variables:

- `IDENTITY_FIREWALL_DATABASE_URL`
- `DATABASE_URL`
- `SUPABASE_DB_URL`
- `POSTGRES_*`
- `PGHOST`, `PGDATABASE`, `PGUSER`, and related variables

Examples:

- `backend/tests/integration/personaTier.migration.test.js`
- `backend/tests/integration/personaSchemaPhase1.test.js`
- `backend/scripts/identity-firewall-migration-smoke.js`

### Optional Real OpenAI

The support train draft eval test calls real OpenAI only when `OPENAI_API_KEY` is present.

This is an eval-style test, not a deterministic CI unit test. It should be treated differently from normal pass/fail backend tests because model outputs can change.

### Not Real Stripe

Stripe is mocked in automated tests. Webhook tests do not hit the real Stripe API.

The tests mock:

- `stripe.webhooks.constructEvent`
- charges
- invoices
- subscriptions
- refunds
- transfers
- account operations

That is the right choice for deterministic CI. Stripe behavior is represented through fixed event fixtures and mocked SDK responses.

### Other External Services

The suite does not rely on live calls to services such as AirNow, Mapbox, Lob, Census, AWS, Twilio, email, or push providers. Those are mocked or represented through fake `fetch`/SDK behavior.

## Where Do We Use Mocks?

The default Jest configuration maps many backend dependencies to mocks:

- Supabase admin client
- Supabase anon client
- logger
- dotenv
- auth middleware
- notification service
- push service

The primary Supabase mock is:

- `backend/tests/__mocks__/supabaseAdmin.js`

It provides an in-memory query builder and helpers such as:

- table seeding
- chained select/insert/update/delete behavior
- RPC mocking
- auth mocking
- relationship aliases in selected cases

Mocks are also used for:

- Stripe SDK
- notification service
- push service
- S3/storage behavior
- feature flags
- external provider HTTP calls
- auth token verification
- email sending
- AI in deterministic tests

This mock-heavy design gives the backend suite three important advantages:

1. speed
2. determinism
3. ability to exercise failure cases that are hard to force in live systems

## Where Have Mocks Hidden Bugs?

Mocks are useful, but they are approximations. The places where they hide bugs are predictable.

### 1. Schema Drift

The most concrete example is the `is_current` versus `is_active` style bug in home occupancy behavior. A mock can accept whichever property the test seeded. A real Supabase query fails when a column does not exist.

That is why live schema validation and home mailbox tests are high value.

### 2. SQL Defaults

Mocks often return `undefined` unless a value was explicitly seeded. Real SQL tables may have defaults. This can create both false positives and false negatives:

- a mock test may fail even though production would default correctly
- a mock test may pass because the fixture accidentally supplies a value production code relies on incorrectly

### 3. Constraints And Triggers

The in-memory mock does not faithfully enforce:

- foreign keys
- check constraints
- uniqueness
- cascade behavior
- trigger behavior
- append-only audit constraints
- RLS policies

That is why migration tests connect directly to Postgres and intentionally validate constraint behavior with transactions and savepoints.

### 4. PostgREST Nested Selects

Several backend routes depend on Supabase nested selects. A mock-backed test can seed already-nested objects, which means the test can pass even if the actual select string is invalid.

This is a classic mock-hidden bug: the test verifies downstream logic but does not prove the real database query shape works.

### 5. Upsert, Ordering, Range, And Conflict Semantics

Supabase and Postgres have precise semantics for:

- `upsert`
- `onConflict`
- ordering
- range/limit
- null handling
- conflict resolution

The mock approximates these behaviors. That is fine for service logic tests, but not enough for schema-contract tests.

### 6. Realtime Payload Privacy

Socket.IO tests use real socket clients, but still use mocked Supabase. That means they validate socket fan-out and lifecycle behavior well, but they do not fully validate real database-backed payload privacy.

One important risk area is socket payload construction that selects raw `User` fields for reaction or sender summaries. REST privacy tests may not catch every realtime payload shape.

That is why the next highest-value test I would add is a live Supabase-backed realtime privacy contract test.

## Why Does Backend Jest Use `--forceExit`?

Backend Jest uses `--forceExit` because some tests and modules leave open handles or long-lived async resources.

Likely sources include:

- HTTP servers
- Socket.IO servers
- Socket.IO clients
- intervals
- Supabase clients
- Postgres clients
- push receipt loops
- metrics loops
- background timers in services or middleware

The current scripts are:

```json
{
  "test": "jest --verbose --forceExit",
  "test:integration": "jest --config jest.integration.config.js --verbose --forceExit"
}
```

The mature answer is that `--forceExit` is pragmatic but not ideal. It keeps CI from hanging, but it can hide real resource leaks and late async work.

The better long-term approach is:

1. run Jest with `--detectOpenHandles`
2. identify unclosed servers, sockets, clients, and timers
3. make background intervals injectable or consistently `unref()` them
4. close Supabase/Postgres clients explicitly in integration tests
5. ensure every server created in a test has deterministic teardown
6. remove `--forceExit`

If I were explaining this in an interview, I would say: I accept `--forceExit` as a temporary CI guardrail, but I would not consider the test infrastructure fully clean until it is gone.

## How Do We Test Migrations?

Migrations are tested at multiple levels.

### 1. Direct Postgres Integration Tests

The strongest migration tests connect directly to Postgres. They start transactions, run assertions, use savepoints for expected failures, and roll back at the end.

Examples:

- `backend/tests/integration/personaTier.migration.test.js`
- `backend/tests/integration/personaSchemaPhase1.test.js`

These tests validate:

- table existence
- column existence
- required columns
- foreign keys
- check constraints
- unique constraints
- view definitions
- backfill behavior
- trigger behavior
- append-only audit behavior

This is the right level for migration tests because application mocks cannot prove that the real database enforces the intended rules.

### 2. Identity Firewall Migration Smoke Tests

The identity firewall smoke script checks that key database objects exist and have the expected properties.

Examples of what it validates:

- required tables
- required columns
- enum values
- RLS-enabled tables
- safe views
- revoked legacy RPCs
- environment parsing

The unit test verifies the smoke script itself contains the expected contract checks.

### 3. Live Schema Validation Tests

Schema validation tests issue real Supabase selects against expected columns. These are cheap but valuable because they catch stale query strings.

Example:

- verifying `HomeOccupancy` uses `is_active`, not stale `is_current`
- verifying `BusinessTeam` columns still match backend selects

### 4. Remaining Gap

The migration test strategy is good at selected high-risk migrations, but it does not appear to replay every migration from an empty database in normal CI.

The improvement I would add is an ephemeral database migration-up job:

1. create a fresh Postgres/Supabase-compatible database
2. apply all migrations from zero
3. run schema smoke checks
4. run selected live integration tests
5. destroy the database

That would catch ordering bugs, missing prerequisite objects, and drift between local and deployed schema.

## How Do We Test Realtime Behavior Across Reconnects And Multiple Clients?

Realtime chat is tested through `backend/tests/e2e/chatSocket.test.js`.

The test starts:

- an in-process HTTP server
- the real Socket.IO server layer
- real `socket.io-client` clients
- route handlers for chat APIs
- mocked Supabase/auth backing data

The reconnect and multi-client coverage includes:

- a client disconnecting and reconnecting
- a client rejoining the room after reconnect
- room membership being restored explicitly through `room:join`
- two sockets for the same user
- online status emitted only when the first socket connects
- offline status emitted only after the last socket disconnects
- typing indicators cleaned up on disconnect
- message events delivered to joined clients
- edit/delete/reaction events delivered to clients

This is a good socket-layer test because it uses real socket clients rather than directly calling event handlers.

The limitation is that it is not a full distributed realtime test. It does not cover:

- real Supabase Realtime
- Postgres replication delay
- network partitions
- token expiry and refresh
- multiple backend nodes
- Redis/socket adapter behavior
- database-backed missed-event replay
- privacy of realtime payloads against live database rows

For the current architecture, the socket test is valuable because it validates the application realtime contract. But I would not claim it proves infrastructure-level realtime behavior.

## How Do We Test Payment Webhooks Deterministically?

The webhook tests make Stripe deterministic by replacing Stripe with controlled fixtures and mocks.

The webhook route behavior is roughly:

1. receive raw request body
2. verify Stripe signature through `stripe.webhooks.constructEvent`
3. insert or check a `StripeWebhookEvent` idempotency row
4. process based on event type
5. update payment, gig, membership, transfer, refund, or notification state
6. mark the webhook processed or record retry/error metadata

The deterministic test strategy:

- mock `stripe.webhooks.constructEvent`
- return a fixed event object with a fixed event ID
- seed the in-memory database with exact rows
- call the webhook endpoint with Supertest where raw-body/signature wiring matters
- call exported handlers directly for narrower persona membership cases
- assert final database state
- assert side effects exactly once
- send the same event twice to prove idempotency
- use controlled failures to prove retry behavior

Important examples:

- `backend/tests/webhookIdempotency.test.js`
- `backend/tests/stripeWebhookTipNotification.test.js`
- `backend/tests/unit/personaWebhooks.test.js`
- `backend/tests/unit/personaMembershipLifecycle.test.js`

For persona webhooks, the tests use fixed fake subscription, invoice, dispute, refund, and chargeback objects. That allows the suite to assert canonical membership state without depending on Stripe's live API.

The key principle is that webhook tests should not depend on wall-clock timing, live Stripe availability, or eventual consistency. They should be fixture-driven and idempotency-focused.

## What Test Would I Add Next If I Had One Day?

I would add a live Supabase-backed realtime privacy contract test.

This is the best next test because it targets a real gap at the intersection of:

- privacy
- realtime behavior
- chat
- reconnects
- multiple clients
- real database query shape

The test would:

1. start the backend against a real local Supabase database
2. create two users with deliberately sensitive fields:
   - email
   - phone
   - name
   - first name
   - last name
   - city
   - state
   - address
3. create a chat room between them
4. connect two real Socket.IO clients
5. join the same room
6. send a message
7. add and remove reactions
8. edit and delete a message
9. disconnect and reconnect one client
10. connect a second socket for the same user
11. assert all event payloads exclude raw private fields

Payload assertions should recursively reject:

- `email`
- `phone`
- `phone_number`
- `name`
- `first_name`
- `last_name`
- `legal_name`
- `address`
- `city`
- `state`
- raw `user_id` where a scoped identity object is expected
- raw actor IDs where they violate the identity firewall
- home identifiers in contexts where they are not allowed

This test would likely catch issues that current tests can miss because current socket tests use real sockets but mocked database behavior. It would also create a reusable helper for future realtime privacy assertions.

## Additional Tests Worth Adding After That

If I had more than one day, I would add these in priority order.

### 1. Ephemeral Full Migration Replay

Create a fresh database, apply every migration from zero, then run schema smoke tests. This catches migration ordering and drift problems that selected migration tests cannot catch.

### 2. RLS Contract Tests

Use real Supabase anon clients for representative user roles and verify:

- allowed reads work
- forbidden reads fail
- service-role-only operations are not exposed
- cross-home/cross-business/cross-persona access is denied

### 3. Live PostgREST Join Contract Tests

For each route that relies on nested Supabase selects, run a real select against Supabase and assert the shape. This would reduce the risk that mock-seeded nested objects hide invalid query strings.

### 4. Payment Webhook Raw-Body Regression Test

Add or expand an HTTP-level test that proves the webhook endpoint receives the exact raw body Stripe signs. Direct handler tests are useful, but raw-body middleware mistakes are common and severe.

### 5. Open-Handle Teardown Test

Run a focused Jest job with `--detectOpenHandles` and fail on leaked handles after the worst offenders are cleaned up. This creates pressure to remove `--forceExit`.

## How I Would Summarize This In An Interview

My test strategy for this backend is risk-based. I do not try to make every test a live end-to-end test because that would make the suite slow, expensive, and flaky. Instead, I use fast mocks for most business logic, static and dynamic gates for privacy, deterministic fixtures for payments, and focused live Supabase/Postgres tests where the database itself is part of the behavior.

The highest confidence areas are privacy serialization, payment idempotency, and core route/service business rules. The areas I would continue strengthening are live Supabase query contracts, RLS behavior, full migration replay, and realtime privacy across reconnects.

The most important quality signal is that the tests are not just checking happy paths. They are trying to encode product invariants:

- private identity must not leak
- money must not move twice
- users must not gain authority across homes, businesses, or personas
- migrations must preserve real database contracts
- realtime events must remain correct across disconnects and multiple clients

That is the testing posture I would want in a production backend: fast feedback for most changes, targeted live coverage for the places mocks cannot be trusted, and explicit acknowledgement of the remaining risk.
