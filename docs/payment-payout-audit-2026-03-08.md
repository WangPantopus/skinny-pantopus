# Payment and Payout Audit

Date: 2026-03-08

Scope reviewed:
- `backend/routes/pays.js`
- `backend/routes/wallet.js`
- `backend/routes/mailboxV2Phase3.js`
- `backend/stripe/paymentStateMachine.js`
- `backend/stripe/stripeService.js`
- `backend/stripe/stripeWebhooks.js`
- `backend/jobs/authorizeUpcomingGigs.js`
- `backend/jobs/processPendingTransfers.js`
- `backend/routes/gigs.js`
- wallet/payment schema in `backend/database/schema.sql`
- relevant web/mobile payment and wallet clients

Tests run:
- `pnpm test -- --runInBand paymentStateMachine.test.js scaOffSession.test.js leakyPipe.test.js postTransferRefund.test.js timeTravel.test.js`
- Result: 5 suites passed, 47 tests passed

## Bottom line

This payment stack is not production-ready to release.

Current state by dimension:
- Security: weak for refunds and webhook handling
- Reliability: weak due to retry/idempotency mistakes and split wallet implementations
- Accuracy: weak because some money movement can succeed externally while local state stays wrong
- Efficiency: acceptable for current scale, but operationally expensive because manual reconciliation would be common

Release readiness:
- Status: blocked
- Confidence to release safely: low
- Minimum work before release: fix the blocking issues below, add end-to-end webhook/refund/withdrawal tests, and reconcile the wallet architecture

## Blocking issues

### P0-1 Refunds are both over-permissive and state-machine broken

Impact:
- Any involved user can call the refund route directly.
- For captured or transferred payments, Stripe refund/reversal can be executed before the local payment transition fails.
- That creates real money movement with a stale or incorrect internal ledger.

Evidence:
- `backend/routes/pays.js` allows either payer or payee to create refunds with no admin or policy gate.
- `backend/stripe/stripeService.js` issues the Stripe refund first, then attempts invalid transitions such as `captured_hold -> refunded_full` and `transferred -> refunded_full`, which are not allowed by the state machine.

Why this blocks release:
- A payer can self-serve a refund on a completed payment.
- The API may return 500 after refunding the customer, leaving Pantopus and Stripe out of sync.

### P0-2 Stripe webhook idempotency and retry handling are broken

Impact:
- Duplicate Stripe deliveries can be treated as bad requests.
- Processing failures are acknowledged to Stripe anyway, so failed events are dropped.
- The retry counter update path is itself invalid.

Evidence:
- `backend/stripe/stripeWebhooks.js` inserts into `StripeWebhookEvent` inside the same `try` block as signature verification. A duplicate `stripe_event_id` will fall into the catch block and return HTTP 400.
- The same file returns HTTP 200 on processing errors but has no replay worker.
- The same file uses `supabaseAdmin.sql`, which is not defined on the Supabase client.

Why this blocks release:
- Stripe is at-least-once delivery.
- Payment correctness cannot depend on every webhook arriving exactly once and every handler succeeding first try.

### P0-3 There are two different wallet systems in production code, and the mailbox one does not match the current schema

Impact:
- `/api/wallet` uses the newer `Wallet` plus `wallet_credit` and `wallet_debit` ledger model in cents.
- `/api/mailbox/v2/p3/wallet/*` uses `EarnWallet` plus an older `WalletTransaction` shape in decimal dollars.
- The active mailbox withdrawal route writes fields that do not exist on the current `WalletTransaction` schema and inserts a negative amount despite the `amount > 0` check.

Evidence:
- `backend/routes/wallet.js` is the current wallet API.
- `backend/routes/mailboxV2Phase3.js` still writes `amount: -amount` and `source: 'withdrawal'`.
- `backend/database/schema.sql` defines `WalletTransaction` with `wallet_id`, `direction`, `balance_before`, and positive amounts.
- `backend/database/migrations/048_mailbox_phase3.sql` shows the older mailbox-era wallet shape still assumed by the mailbox routes.

Why this blocks release:
- Users can hit two wallet UIs backed by different data models and units.
- The mailbox withdrawal flow is very likely to fail at runtime or drift from the real ledger.

### P0-4 Withdrawal idempotency keys will collapse legitimate repeat withdrawals of the same amount

Impact:
- A user who successfully withdraws `$10.00` once may have every future `$10.00` withdrawal deduplicated forever.

Evidence:
- `backend/services/walletService.js` builds the idempotency key as `withdraw:${userId}:${amount}` and reuses it for both the wallet debit RPC and `stripe.transfers.create`.

Why this blocks release:
- Idempotency must scope to a request attempt, not to all future withdrawals with the same amount.
- This is a correctness bug in core payout behavior.

### P0-5 On-session 3DS/SCA handling is not modeled correctly

Impact:
- A normal on-session card flow that requires user authentication can be downgraded to `authorization_failed` or `requires_confirmation`, then never recover to `authorized`.

Evidence:
- `backend/stripe/stripeWebhooks.js` treats `payment_intent.requires_action` as an off-session failure whenever the payment is in `authorize_pending`.
- `backend/stripe/stripeWebhooks.js` only accepts `payment_intent.amount_capturable_updated` when the local payment is still `authorize_pending`.

Why this blocks release:
- 3DS is common in production.
- A successful customer authentication flow must not leave the payment stuck in the wrong state.

### P0-6 Gig completion can succeed even when capture fails

Impact:
- The owner confirmation is written first.
- Payment capture failure is logged as non-blocking.
- A gig can be marked confirmed while the money was never captured.

Evidence:
- `backend/routes/gigs.js` writes `owner_confirmed_at` before calling `stripeService.capturePayment`, then swallows capture failures.

Why this blocks release:
- This creates completed-work but unpaid-provider states with no strong retry or reconciliation path.

## Major gaps

### P1-1 Transfer processing can strand payments after wallet credit

`backend/jobs/processPendingTransfers.js` transitions to `transfer_scheduled`, credits the wallet, then transitions to `transfer_pending` and `transferred`. Its recovery logic only reverts if the payment is still `transfer_scheduled`. If failure happens after wallet credit and after the next state change, the wallet may already be credited while the payment remains stuck in an intermediate state.

### P1-2 Bid acceptance does not require payment setup to succeed

`backend/routes/gigs.js` explicitly makes payment setup failure non-blocking during bid acceptance. That means a worker can be assigned before the payer has a valid payment path, pushing the failure later into start-work, retry, or auto-cancel flows.

### P1-3 Web and mobile surface different wallet truths

The settings payments page uses the `/api/wallet` stack. The mailbox earn wallet uses `/api/mailbox/v2/p3/wallet`. Even if both routes were bug-free, users would still have two payout surfaces with different units, status models, and withdrawal rules.

### P1-4 The payout model is semantically confusing

The payment state machine marks a payment as `transferred` once funds hit the Pantopus wallet, but Stripe `Payout` rows only track later bank payouts. User-facing copy says money was "sent to the provider" even when it only moved into an internal wallet. This is likely to confuse support, accounting, and dispute handling.

### P1-5 Several payment API methods do not correspond to live backend routes

`frontend/packages/api/src/endpoints/payments.ts` still exposes routes such as `/api/payments/confirm`, `/api/payments/balance`, `/api/payments/payout`, and `/api/payments/payouts`, but those handlers are not present in the active backend payment router. That is route drift and a maintenance risk.

## Test coverage gaps

What passes today:
- state-machine tests
- job-level tests with mocked wallet service
- time-based authorization/cancellation tests

What is still missing:
- direct tests for `stripeService.createSmartRefund`
- direct tests for `walletService.withdraw`
- webhook idempotency and duplicate-delivery tests
- end-to-end tests for on-session 3DS
- end-to-end tests for capture failure after completion
- tests covering the mailbox wallet routes against the real schema

The current passing tests are useful, but they mainly validate happy-path state transitions. They do not prove the live money-moving services behave correctly under retries, duplicates, or external partial failures.

## Recommended release gate

Do not release payment or payout flows until all of the following are done:
- Lock down refund authorization and policy.
- Fix `createSmartRefund` to follow valid state transitions and make DB updates atomic with external side effects as much as possible.
- Make webhook processing idempotent and replayable.
- Collapse the wallet implementation to one source of truth.
- Fix withdrawal idempotency keys.
- Rework on-session SCA handling and verify it with end-to-end tests.
- Make completion plus capture transactional from a product perspective, or add explicit retry and operator recovery flows.

## Rough distance to production readiness

Assuming one focused engineer and no major schema surprises:
- Core code fixes: a few days
- schema and wallet consolidation: a few more days
- integration and webhook test harness: several more days
- operational runbook and final QA: at least a couple of days

Rough estimate: around 2 to 3 weeks of focused work before this should be considered release-ready for real money movement.
