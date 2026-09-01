# Stripe Payment State Machine Interview Notes

This document is a comprehensive, interview-style explanation of the Stripe payment system in this repository. It is written as if I built the codebase and need to explain the architecture, tradeoffs, guarantees, failure modes, and test strategy to a senior engineering interview panel.

Primary files referenced:

- `backend/stripe/paymentStateMachine.js`
- `backend/stripe/stripeService.js`
- `backend/stripe/stripeWebhooks.js`
- `backend/jobs/authorizeUpcomingGigs.js`
- `backend/jobs/processPendingTransfers.js`
- `backend/jobs/retryCaptureFailures.js`
- `backend/services/walletService.js`
- `backend/routes/gigs.js`
- `backend/routes/gigsV2.js`
- `backend/routes/pays.js`
- `backend/database/schema.sql`
- `docs/payment-payout-audit-2026-03-08.md`

## Executive Summary

Pantopus uses Stripe Connect with separate charges and transfers, manual capture, and a local Payment state machine. The core product behavior is marketplace escrow for local gigs:

1. The requester accepts a worker or helper.
2. Pantopus creates either a SetupIntent for future authorization or a manual-capture PaymentIntent for near-term work.
3. Stripe authorizes the card and places a hold.
4. The worker starts and completes the gig only after payment is authorized.
5. The requester confirms completion.
6. Pantopus captures the PaymentIntent.
7. Captured funds stay on the platform during a cooling-off period.
8. After the cooling-off period, the worker's Pantopus wallet is credited.
9. The worker can later withdraw wallet earnings to their Stripe Connect account.

The design deliberately separates gig lifecycle from payment lifecycle. Gig state answers "what happened operationally?" Payment state answers "where is the money?" A gig can be `completed` after the worker marks it done, while the payment remains `authorized` until owner confirmation captures funds.

The important interview nuance: the system provides strong local state-machine validation and recoverable side-effect ordering, but it does not provide true distributed atomicity across Stripe and Postgres. The correct framing is that this is a saga: each external Stripe side effect has an intermediate local state, webhook reconciliation, idempotency, and recovery jobs.

## Core State Machine

The state machine lives in `backend/stripe/paymentStateMachine.js`. It defines the canonical set of states and valid transitions. The meaningful states are:

| State | Meaning |
| --- | --- |
| `none` | No payment has been initialized. |
| `setup_pending` | A SetupIntent exists; the user is saving a payment method for future off-session authorization. |
| `ready_to_authorize` | A card/payment method is saved and can be used later to authorize the gig. |
| `authorize_pending` | A PaymentIntent exists and authorization is in progress or waiting for on-session confirmation/SCA. |
| `authorized` | Stripe approved the authorization and the PaymentIntent is manual-capture `requires_capture`. Funds are held but not captured. |
| `authorization_failed` | Authorization failed, usually because the card was declined or off-session SCA was required. |
| `capture_pending` | Reserved intermediate capture state. The current happy path usually goes directly from `authorized` to `captured_hold`. |
| `captured_hold` | Stripe capture succeeded. Funds are now on the platform and held during the cooling-off window. |
| `transfer_scheduled` | Transfer or wallet credit processing has claimed this payment. |
| `transfer_pending` | Reserved for asynchronous Stripe transfer flows. Current wallet settlement usually skips directly to `transferred`. |
| `transferred` | Worker has been credited in the Pantopus wallet. In current semantics this does not necessarily mean a bank payout completed. |
| `refund_pending` | A refund or cancellation action is in progress. This is the important intermediate state before external refund side effects. |
| `refunded_partial` | Some of the original payment was refunded. Additional refunds are still possible. |
| `refunded_full` | Full refund completed. Terminal state. |
| `disputed` | Stripe dispute/chargeback exists. Transfers should stop. |
| `canceled` | Pre-capture authorization or setup was canceled. Terminal state. |

The main happy path is:

```text
none
  -> authorize_pending
  -> authorized
  -> captured_hold
  -> transfer_scheduled
  -> transferred
```

For future gigs:

```text
none
  -> setup_pending
  -> ready_to_authorize
  -> authorize_pending
  -> authorized
  -> captured_hold
  -> transfer_scheduled
  -> transferred
```

For SCA/off-session failure and retry:

```text
ready_to_authorize
  -> authorize_pending
  -> authorization_failed
  -> authorize_pending
  -> authorized
```

For refund:

```text
captured_hold
  -> refund_pending
  -> refunded_partial
  -> refund_pending
  -> refunded_full
```

For dispute:

```text
captured_hold
  -> disputed
  -> captured_hold       # dispute won before worker wallet credit
```

or:

```text
transferred
  -> disputed
  -> transferred         # dispute won after worker wallet credit
```

or:

```text
disputed
  -> refund_pending
  -> refunded_full       # dispute lost
```

## End-to-End Payment Flow

### 1. Bid Acceptance Or Instant Accept

For paid gigs, the system initializes payment before fully assigning work. This is a direct fix to the historical issue where workers could be assigned before a valid payment path existed.

In `backend/routes/gigs.js`, normal bid acceptance creates a payment setup before the gig/bid is fully accepted. Near-term gigs create a manual-capture PaymentIntent. Some future/self-heal flows still use SetupIntent when the gig is far enough out.

In `backend/routes/gigsV2.js`, instant accept checks payout onboarding and initializes payment before the optimistic `Gig.status = assigned` update.

For paid bid flows, the system can put a bid into `pending_payment` while the owner completes PaymentSheet/SCA. Finalization then accepts the bid and links the payment to the gig.

### 2. PaymentIntent Creation

`stripeService.createPaymentIntentForGig` creates the PaymentIntent on the platform:

- `amount`: total requester charge.
- `currency`: `usd`.
- `customer`: requester's Stripe customer.
- `capture_method`: `manual`.
- no `transfer_data`.
- no `application_fee_amount`.
- metadata stores `payer_id`, `payee_id`, `gig_id`, platform fee, and optional payee connected account.

This is the core separate-charges-and-transfers decision: the charge belongs to the platform first. Provider settlement is a later step.

If Stripe returns `requires_capture`, the local state becomes `authorized`. Otherwise it starts as `authorize_pending` and waits for client confirmation and/or webhooks.

### 3. SetupIntent Path For Future Authorization

For gigs too far in the future to hold a card authorization safely, the system saves a card first:

```text
setup_pending -> ready_to_authorize
```

`authorizeUpcomingGigs` later creates a PaymentIntent off-session when the gig is closer to start. If the bank requires SCA, the payment moves to `authorization_failed` and the owner is notified to retry on-session.

This matters because card authorizations expire. A hold placed too early would fail before the work happens.

### 4. Authorization And SCA

Stripe's `payment_intent.amount_capturable_updated` webhook is the canonical "manual-capture authorization succeeded" signal. In the webhook handler, that event transitions:

```text
authorize_pending -> authorized
authorization_failed -> authorized
```

The second transition is important: it covers an off-session auth attempt that failed due to SCA, followed by an on-session retry that succeeds.

`payment_intent.requires_action` is handled differently based on whether the PaymentIntent metadata says `off_session = true`:

- Off-session: transition to `authorization_failed`, mark `off_session_auth_required`, notify payer.
- On-session: stay in `authorize_pending`; the frontend handles 3DS challenge.

This fixes the historically dangerous bug where a normal on-session 3DS flow could be treated as a failed payment.

### 5. Start-Work Guard

A worker cannot start a paid gig unless the payment is authorized. `POST /api/gigs/:gigId/start` checks the linked Payment. If it is still `authorize_pending`, it tries to reconcile from Stripe before blocking. If it is not `authorized`, start is rejected and the payer is notified.

This is a product-level invariant:

```text
No authorized hold, no paid work start.
```

### 6. Worker Completion

The worker marks the gig completed. This updates operational gig state:

```text
Gig.status = completed
Gig.worker_completed_at = now
```

No money is captured at this point. The worker has claimed completion, but the owner still needs to confirm.

### 7. Owner Confirmation And Capture

Owner confirmation calls `confirmCompletionHelper` in `backend/routes/gigs.js`. It captures payment before writing `owner_confirmed_at`.

The order is deliberate:

1. Fetch gig and validate owner access.
2. Validate worker already marked completed.
3. If there is a payment, call `stripeService.capturePayment(payment_id)`.
4. Only after capture succeeds, update `Gig.owner_confirmed_at`.

This directly addresses the March 2026 audit issue where gig completion could be confirmed even when capture failed.

`stripeService.capturePayment`:

- reads the Payment row;
- requires `payment_status = authorized`;
- increments `capture_attempts`;
- calls `stripe.paymentIntents.capture`;
- transitions to `captured_hold`;
- sets `captured_at`, `cooling_off_ends_at`, `stripe_charge_id`, and `payment_succeeded_at`.

If Stripe says the PaymentIntent was already captured, the code retrieves the PaymentIntent and reconciles the local state to `captured_hold`.

### 8. Cooling-Off And Wallet Credit

After capture, funds are not immediately released to the worker. The payment sits in:

```text
captured_hold
```

until `cooling_off_ends_at` passes, currently 48 hours. `processPendingTransfers` picks up eligible rows:

- `payment_status = captured_hold`
- `cooling_off_ends_at <= now`
- no `dispute_id`
- valid positive `amount_to_payee`

The job then:

1. Re-reads the Payment row to make sure the state did not change.
2. Transitions to `transfer_scheduled`.
3. Credits the worker wallet using `walletService.creditGigIncome` or `creditTipIncome`.
4. Transitions directly to `transferred` with `transfer_status = wallet_credited`.

The word `transferred` is semantically imperfect here. In the current implementation, it means "credited to the worker's Pantopus wallet", not necessarily "paid to the worker's bank account." The March audit called this out as a P1 semantics issue.

### 9. Wallet Withdrawal

Worker wallet withdrawal is a separate flow in `walletService.withdraw`:

1. Verify the worker has a Stripe Connect account with payouts enabled.
2. Debit the wallet with an atomic Postgres RPC.
3. Create a Stripe Transfer to the connected account.
4. Update the WalletTransaction with the Stripe transfer ID.
5. If Stripe transfer fails, credit a reversal transaction and mark the original debit as reversed.

The wallet is an earnings-only wallet. Users cannot deposit stored value or pay for gigs from wallet balance. This is a regulatory simplification and helps avoid money-transmission complexity.

## Why Separate Charges And Transfers Instead Of Destination Charges?

Stripe Connect gives several marketplace patterns. Destination charges are convenient: charge the buyer and route funds to the connected account with `transfer_data[destination]` and an application fee. We do not use that as the core gig path because it is the wrong control model for escrow-like local work.

Separate charges and transfers are better here because:

### 1. Manual Capture And Escrow Semantics

The product wants to authorize before work starts, capture after owner confirmation, then hold funds during a review window. With destination charges, the connected account is too close to the original charge event. With separate charges and transfers, the platform owns the charge and decides when worker settlement happens.

### 2. Dispute Control

If a dispute arrives during the cooling-off window, `processPendingTransfers` excludes the payment because `dispute_id` is no longer null. That means funds are not credited to the worker wallet while the dispute is active.

With early destination transfer, we would often be trying to claw money back after it already moved to the connected account.

### 3. Refund And Reversal Control

Refunds have three different behaviors:

- Pre-capture: cancel the authorization.
- Post-capture, pre-transfer: refund the customer.
- Post-transfer: refund the customer and reverse the provider transfer or record provider debt if reversal fails.

Separate charges and transfers make those states explicit.

### 4. Internal Wallet Model

Pantopus credits an internal earnings wallet after the cooling-off period. That wallet credit is a platform ledger event. Bank payout is separate and user-initiated. Destination charges would blur "payment completed", "provider wallet credited", and "bank payout completed."

### 5. Operational Recovery

If something fails halfway, the system can reason from local states and ledgers:

- `captured_hold`: money captured, not released.
- `transfer_scheduled`: release claimed by a worker/job.
- `transferred`: wallet ledger credit exists or should exist.
- wallet transaction idempotency proves whether a credit happened.

That recovery story is cleaner when the platform controls settlement.

### 6. Fee Flexibility

The fee model computes platform fee locally and stores `amount_platform_fee`, `amount_to_payee`, and estimated processing fee. Separate charges make it easier to evolve fee logic, promotions, provider-specific fee overrides, and tip behavior without coupling every charge to Stripe's destination-charge fee machinery.

## Atomicity: What Is Guaranteed And What Is Not

The strongest answer is nuanced:

We do not guarantee true atomicity across Stripe and Postgres. Stripe calls and database writes are two separate systems. Instead, we guarantee:

- all local state transitions go through a finite state machine;
- invalid transitions fail fast;
- external side effects are bracketed by intermediate local states;
- idempotency keys prevent duplicate local wallet mutations;
- webhooks and reconciliation jobs converge local projections toward Stripe;
- visible stuck states are retryable or operable.

### Local State Machine Enforcement

`transitionPaymentStatus(paymentId, newStatus, extraUpdates)` reads the current Payment row, checks `VALID_TRANSITIONS`, updates `Payment`, and syncs denormalized `Gig.payment_status`.

This centralizes business rules. Callers do not manually jump from `authorized` to `transferred` or from `captured_hold` to `canceled`.

### Important Current Limitation

The current `transitionPaymentStatus` implementation is not a single Postgres transaction with row lock and compare-and-swap. It:

1. reads `Payment`;
2. validates in application code;
3. updates `Payment`;
4. separately updates `Gig`.

That is good structure, but it is not strict DB-level atomicity. A production-grade strengthening would be a Postgres RPC:

```sql
transition_payment_status(
  payment_id uuid,
  expected_current_status text,
  next_status text,
  extra_updates jsonb
)
```

The RPC should:

- `SELECT ... FOR UPDATE` on `Payment`;
- validate transition in SQL;
- update `Payment`;
- update linked `Gig`;
- insert payment audit row;
- return updated row;
- fail if current status does not equal expected state.

That would make local transitions strongly atomic and eliminate the race between read and update.

### Atomic Wallet Operations

Wallet balance mutation is stronger. `wallet_credit` and `wallet_debit` are Postgres functions that:

- create or fetch the wallet;
- check idempotency key;
- lock the wallet row `FOR UPDATE`;
- validate frozen/balance conditions;
- update balance;
- insert `WalletTransaction`;
- return the ledger row.

That gives true local atomicity for wallet balances and ledger entries.

### Saga Ordering Around Stripe

For external Stripe side effects, the system uses saga-style sequencing:

- capture: call Stripe capture, then local `captured_hold`, with webhook/retry reconciliation if local update misses;
- refund: move to `refund_pending`, call Stripe refund, record Refund, then `refunded_partial/full`;
- post-transfer refund: `refund_pending`, Stripe refund, transfer reversal, final refund state;
- wallet withdrawal: local debit, Stripe transfer, then transaction update, with reversal if Stripe transfer fails.

This is not "all or nothing" across systems. It is "every partial outcome has a state and recovery path."

## What Prevents Two Workers Or Webhooks From Moving The Same Payment Concurrently?

There are several layers of protection.

### 1. State Machine Validity

The state machine makes duplicate processing mostly harmless. If one worker moves:

```text
authorized -> captured_hold
```

a second worker attempting the same transition sees `captured_hold -> captured_hold`, which is invalid. It should no-op or log as a skipped duplicate depending on handler.

### 2. Stripe PaymentIntent Semantics

Stripe PaymentIntents are stateful. Capture is not an arbitrary idempotent ledger write; the PaymentIntent moves from `requires_capture` to `succeeded`. A second capture attempt will be rejected by Stripe or return an unexpected-state error. The service then tries to reconcile if Stripe has already captured.

### 3. Webhook Event Deduplication

`StripeWebhookEvent` has a unique `stripe_event_id`. The webhook handler:

1. verifies signature;
2. inserts the event row;
3. if insert fails, reads existing event;
4. returns 200 immediately if already processed;
5. reprocesses if previous processing failed and `processed = false`;
6. marks `processed = true` only after successful handling.

This matches Stripe's at-least-once delivery model.

### 4. Transfer Job Re-Read

`processPendingTransfers` queries eligible `captured_hold` rows, then re-fetches each Payment immediately before acting. If a dispute/refund/other worker changed the row, it skips.

### 5. Transfer Claim State

Before wallet credit, the job transitions:

```text
captured_hold -> transfer_scheduled
```

If another job tries to do the same work and the state has moved, it should fail or skip. This is a soft lock.

### 6. Wallet Idempotency Keys

Wallet credits use deterministic idempotency keys:

- `gig_income:${paymentId}`
- `tip_income:${paymentId}`

Even if two jobs reach the wallet credit call, the wallet RPC returns the existing transaction for the same idempotency key instead of double-crediting.

### 7. Gig Assignment Optimistic Locks

For assignment and instant accept, routes use optimistic state checks such as `eq('status', 'open')`. That prevents two helpers from both winning the same gig assignment.

### Remaining Gap

The soft spot is the generic `transitionPaymentStatus` read-then-write pattern. It validates against a state read before the update but does not include `eq('payment_status', expectedStatus)` on the update. The next hardening step is to make all transitions compare-and-swap at the database level.

## Reconciling Stripe As Source Of Truth With Payment And Gig Rows

Stripe is the source of truth for external money movement. Local rows are our operational projection.

### Payment Row Responsibilities

`Payment` stores:

- Stripe IDs: PaymentIntent, SetupIntent, charge, transfer, reversal, customer, payment method.
- Parties: payer, payee, gig, home.
- Amounts: total, subtotal, platform fee, payee amount, processing fee estimate.
- State: payment status, transfer status, dispute status.
- Timestamps: attempted, succeeded, captured, cooling-off ends, transfer completed, authorization expiration.
- Refund/dispute metadata.

### Gig Row Responsibilities

`Gig.payment_status` and `Gig.payment_id` are denormalized for fast UI and feed filtering. The authoritative financial state is the `Payment` row. `transitionPaymentStatus` tries to keep the gig projection in sync.

### Reconciliation Sources

The system reconciles through:

1. Stripe webhooks:
   - `setup_intent.succeeded`
   - `payment_intent.amount_capturable_updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `charge.dispute.created/updated/closed`
   - `transfer.created/paid/failed/reversed`
   - payout events

2. Request-path reconciliation:
   - continue authorization checks Stripe before returning client secret;
   - start-work checks reconcile pending authorization;
   - tip read paths reconcile stuck successful tips.

3. Jobs:
   - `authorizeUpcomingGigs`;
   - `processPendingTransfers`;
   - `retryCaptureFailures`;
   - operations/alert jobs for stuck states.

4. Migrations/patches:
   - stuck payment reconciliation patches sync `Payment` and `Gig` when wallet credits exist.

### Rule Of Thumb

When local state disagrees with Stripe:

- For money movement, Stripe wins.
- For wallet balance, the local wallet ledger wins as the internal accounting source.
- For UI status, `Payment` should be repaired and `Gig` should be re-synced from `Payment`.

## Failure Mode: Capture Succeeds But DB Update Fails

This is one of the most important failure modes.

The sequence:

1. Owner confirms completion.
2. Backend calls `stripe.paymentIntents.capture`.
3. Stripe succeeds; money is captured.
4. Backend fails before or during local transition to `captured_hold`.

Result:

- Stripe says the PaymentIntent is `succeeded`.
- Local `Payment` may still say `authorized`.
- `Gig.owner_confirmed_at` should not be written because capture helper throws before confirmation update.
- The requester may see an error even though money was captured.

Recovery:

- Stripe sends `payment_intent.succeeded`; webhook transitions to `captured_hold`.
- A later capture retry can get "already captured" from Stripe, retrieve the PaymentIntent, and reconcile to `captured_hold`.
- Ops should have stuck-state visibility for `authorized` payments with Stripe-succeeded PaymentIntents.

Product impact:

- The user experience can be confusing: "confirmation failed" while card was charged.
- The worker should not be wallet-credited until local state reaches `captured_hold` and cooling-off expires.

What I would improve:

- Add an outbox/audit row before capture attempt.
- Store a local `capture_pending` state with a Stripe idempotency key before calling Stripe.
- Make capture idempotency key deterministic, e.g. `capture:${paymentId}:${captureAttempt}` or simply `capture:${paymentId}` if only one final capture is allowed.
- Add a reconciliation job that retrieves Stripe status for `authorized` rows with capture attempts.

## Failure Mode: DB State Changes But Stripe Call Fails

Different flows handle this differently.

### Refund

`createSmartRefund` transitions to `refund_pending` before calling Stripe refund. If Stripe refund fails:

- Payment stays `refund_pending`.
- No final `refunded_*` state is written.
- The row is visible as incomplete and can be retried or investigated.

This is a good saga pattern, but it needs operational tooling so `refund_pending` does not become a permanent limbo state.

### Transfer/Wallet Credit

`processPendingTransfers` transitions to `transfer_scheduled` before wallet credit. If wallet credit fails:

- It checks whether a wallet ledger row exists for the payment.
- If no credit exists, it reverts to `captured_hold` for retry.
- If credit exists but final state update failed, it advances to `transferred`.

This is the right recovery rule because the wallet ledger is the accounting fact.

### Wallet Withdrawal

Withdrawal debits wallet first and then creates a Stripe transfer. If Stripe transfer fails:

- It credits a reversal transaction.
- It marks the original withdrawal transaction as reversed.
- If reversal also fails, that is a critical condition requiring manual support because the local wallet has been debited but no external transfer succeeded.

### Capture

Capture currently calls Stripe before local final transition. If the Stripe call fails:

- Payment remains `authorized`.
- Owner confirmation is blocked.
- Retry job can later retry, capped by `capture_attempts`.

This is safer than marking the gig confirmed before capture, which was the March 2026 bug.

## Webhook Retries, Duplicates, And Out-Of-Order Events

Stripe webhooks are at-least-once and can arrive out of order. The handler is designed around that assumption.

### Signature Verification

The webhook route requires raw body middleware and verifies the Stripe signature before doing anything else. Bad signatures return HTTP 400.

### Idempotency Row

Every event is inserted into `StripeWebhookEvent` with:

- `stripe_event_id`
- `event_type`
- `event_data`
- `api_version`
- `processed = false`

The database unique key on `stripe_event_id` dedupes delivery.

### Duplicate Processed Event

If insert fails and the existing row has `processed = true`, the handler returns:

```json
{ "received": true, "duplicate": true }
```

That tells Stripe not to retry and prevents duplicate side effects.

### Duplicate Failed Event

If insert fails and the existing row has `processed = false`, the handler reprocesses. That handles Stripe retries after a prior 500.

### Processing Failure

If processing throws:

- `processing_error` is stored;
- `retry_count` is incremented;
- handler returns HTTP 500;
- Stripe retries later.

This fixes the March audit issue where failures were acknowledged with 200 and dropped.

### Out-Of-Order Events

Out-of-order handling is mostly done through state gates:

- `amount_capturable_updated` only acts if Payment is `authorize_pending` or `authorization_failed`.
- `payment_intent.succeeded` for manual capture only transitions if Payment is still `authorized`; if already `captured_hold`, it updates card details and no-ops.
- `charge.refunded` can update refund state even if the synchronous refund route already did it.
- dispute events can freeze post-capture states but only record metadata for non-freezable states.

The state machine is the guardrail. Events can arrive twice or late; they can only cause allowed state transitions.

## March 2026 Audit: Which P0s Were Fixed?

The audit in `docs/payment-payout-audit-2026-03-08.md` said the payment stack was not production-ready. The current code materially addresses the P0s, although there are still hardening opportunities.

### P0-1: Refunds Over-Permissive And State-Machine Broken

Original issue:

- Any involved user could call refund.
- Stripe refund could happen before local state transition failed.
- Captured/transferred refund transitions were invalid.

Current state:

- User refund route allows only the payer.
- Transferred payments require admin/support intervention.
- Admin refund route is protected by `requireAdmin`.
- `createSmartRefund` uses `refund_pending`.
- Post-transfer refund handles transfer reversal and records provider debt if reversal fails.

Remaining caveat:

- The payer can still self-initiate some pre-transfer refunds. Whether that is acceptable depends on product policy. For a strict marketplace, refund initiation should probably be policy/admin gated except for explicit cancellation rules.

### P0-2: Webhook Idempotency And Retry Broken

Original issue:

- Duplicate webhook deliveries could return 400.
- Processing failures returned 200.
- Retry counter path used an invalid Supabase API.

Current state:

- Signature verification is separated from event insertion.
- Duplicate processed events return 200 with duplicate flag.
- Failed processing returns 500 and stores error/retry count.
- `StripeWebhookEvent` is the dedupe table.

Remaining caveat:

- A replay/admin worker for unprocessed `StripeWebhookEvent` rows would make operations stronger.

### P0-3: Two Wallet Systems

Original issue:

- `/api/wallet` and mailbox earn wallet used different schemas/units.

Current state:

- Web mailbox earn wallet API maps to canonical `/api/wallet`.
- Web and mobile legacy wallet screens redirect to canonical payments/wallet UI.
- Migration 078 marks `EarnWallet` deprecated.

Remaining caveat:

- `backend/routes/mailboxV2Phase3.js` is still mounted and still references `EarnWallet` in at least seed behavior. It is less user-facing now, but the dead/legacy backend surface should be removed or made read-only after data migration.

### P0-4: Withdrawal Idempotency Keys Collapse Repeat Withdrawals

Original issue:

- Idempotency key was `withdraw:${userId}:${amount}`, so two legitimate withdrawals of the same amount could collapse forever.

Current state:

- `walletService.withdraw` uses client-provided request key or generated UUID:

```text
withdraw:${userId}:${requestId}
```

That dedupes double-taps without deduping all future same-amount withdrawals.

### P0-5: On-Session SCA Modeled Incorrectly

Original issue:

- `requires_action` could be treated as failure during on-session flow.
- Successful SCA retry could leave payment stuck.

Current state:

- Webhook distinguishes off-session from on-session.
- On-session `requires_action` leaves payment in `authorize_pending`.
- Off-session `requires_action` moves to `authorization_failed`.
- `amount_capturable_updated` accepts both `authorize_pending` and `authorization_failed`.
- Retry and continue authorization routes exist.

### P0-6: Gig Completion Could Succeed Even When Capture Failed

Original issue:

- `owner_confirmed_at` was written before capture.
- Capture failure was swallowed.

Current state:

- `confirmCompletionHelper` captures before writing `owner_confirmed_at`.
- Capture failure throws and blocks confirmation.
- Retry job exists for orphaned confirmed/authorized cases.

Remaining caveat:

- The retry job is mostly a safety net for legacy/orphaned rows because the fixed path should not write `owner_confirmed_at` when capture fails.

## Testing Strategy

The current repository has payment tests covering the main state machine and many fixes:

- `backend/tests/paymentStateMachine.test.js`
- `backend/tests/scaOffSession.test.js`
- `backend/tests/scaOnSession.test.js`
- `backend/tests/leakyPipe.test.js`
- `backend/tests/transferRecovery.test.js`
- `backend/tests/postTransferRefund.test.js`
- `backend/tests/refundAuthorization.test.js`
- `backend/tests/webhookIdempotency.test.js`
- `backend/tests/captureRetry.test.js`
- `backend/tests/fullPaymentLifecycle.test.js`
- `backend/tests/paymentReliability.test.js`
- `backend/tests/paymentOps.test.js`
- `backend/tests/paymentOpsAlerts.test.js`

### Refund Tests

I would test:

- `authorized -> canceled` releases hold and does not call refund.
- `captured_hold -> refund_pending -> refunded_full`.
- `captured_hold -> refund_pending -> refunded_partial`.
- second partial refund from `refunded_partial -> refund_pending -> refunded_full`.
- refund amount cannot exceed remaining refundable amount.
- transferred admin refund creates Stripe refund and transfer reversal.
- transfer reversal failure records `metadata.reversal_failed` and `provider_debt_amount`.
- duplicate `charge.refunded` webhook is idempotent.
- Stripe refund fails after `refund_pending`; row remains retryable and no final refunded state is written.

### Dispute Tests

I would test:

- `charge.dispute.created` on `captured_hold` transitions to `disputed`.
- `charge.dispute.created` on `transfer_scheduled` or `transfer_pending` freezes transfer.
- `charge.dispute.created` on `transferred` logs provider debt/admin action risk.
- active dispute excludes payment from `processPendingTransfers`.
- dispute won before transfer restores `captured_hold`.
- dispute won after transfer restores `transferred`.
- dispute lost moves `disputed -> refund_pending -> refunded_full`.
- dispute updated only updates `dispute_status`.
- duplicate dispute created does not double-notify or corrupt state.
- evidence auto-draft failure is recorded in metadata.

### Partial Capture Tests

Current code does not implement partial capture. `stripe.paymentIntents.capture` is called without `amount_to_capture`, and local amount fields assume full capture.

So the honest answer is:

- Today, partial capture should be treated as unsupported.
- Tests should assert that capture is full amount and no partial-capture API path exists.
- If product needs partial capture for change orders or underperformance, add it explicitly:
  - `captured_amount`
  - `amount_capturable_remaining`
  - recalculated platform fee/payee amount
  - refund/capture math based on captured amount, not original amount
  - Stripe capture call with `amount_to_capture`
  - state names or metadata for `partially_captured`

Without those schema and state-machine changes, partial capture is unsafe to imply.

### SCA Tests

I would test:

- on-session `requires_action` does not transition out of `authorize_pending`.
- off-session `requires_action` transitions to `authorization_failed`.
- `authorization_failed -> authorize_pending` retry creates new on-session PaymentIntent.
- `authorization_failed -> authorized` is accepted after successful SCA.
- `amount_capturable_updated` ignores automatic-capture PaymentIntents.
- start-work endpoint blocks while payment is `authorization_failed`.
- continue authorization reconciles an already-authorized PaymentIntent.
- webhook and read-path reconciliation both converge to `authorized`.

### Transfer Failure Tests

For `processPendingTransfers`, I would test:

- captured payment after cooling-off credits wallet and transitions to `transferred`.
- payment still inside cooling-off is skipped.
- payment with `dispute_id` is skipped.
- zero or negative `amount_to_payee` is skipped and alerts.
- state changes between query and processing are skipped.
- wallet credit failure reverts to `captured_hold`.
- wallet credit success but final state update failure is recovered to `transferred`.
- duplicate worker/job only creates one wallet transaction because of idempotency key.
- legacy `captured_hold` with null `cooling_off_ends_at` only processes after fallback age.
- stuck `transfer_scheduled`/`transfer_pending` rows recover based on wallet ledger truth.

### Webhook Tests

I would test:

- invalid signature returns 400.
- first delivery inserts `StripeWebhookEvent`.
- duplicate processed event returns 200 and no-ops.
- failed event returns 500 and increments retry count.
- retry of failed event processes and marks processed.
- out-of-order `charge.succeeded` before PaymentIntent success only stores charge info.
- `payment_intent.succeeded` after capture no-ops if already captured.
- `charge.refunded` after synchronous refund finalizes local refund state.
- `transfer.failed` does not corrupt already wallet-credited payments.

### End-To-End Stripe Test Mode

Unit tests with mocked Stripe prove logic, but payment systems also need test-mode integration:

- Use Stripe CLI to forward webhooks to local API.
- Use test cards for:
  - successful auth/capture;
  - 3DS required;
  - card decline;
  - insufficient funds;
  - dispute simulation.
- Run full gig flow:
  - create gig;
  - accept bid;
  - authorize with PaymentSheet;
  - start;
  - worker complete;
  - owner confirm;
  - capture webhook;
  - cooling-off override;
  - wallet credit;
  - withdrawal.

## Interview Answers To The Exact Questions

### Explain the Stripe payment state machine end to end.

The state machine models money movement separately from gig status. We initialize payment at acceptance, authorize before work starts, capture only after owner confirmation, hold captured funds during a cooling-off period, then credit the provider wallet. SetupIntent handles far-future gigs, PaymentIntent manual capture handles near-term gigs, SCA moves through `authorization_failed` and retry, refunds move through `refund_pending`, and disputes freeze post-capture payments until they are won or lost.

### Why use separate charges and transfers instead of destination charges?

Because we need platform-controlled escrow semantics: authorize before work, capture after confirmation, hold during dispute window, then release to an internal wallet. Destination charges move funds toward the connected account too early and make disputes, refunds, wallet settlement, and provider debt recovery harder. Separate charges and transfers keep the original charge on the platform and make settlement a separate, recoverable state-machine step.

### How do you guarantee payment state transitions are atomic?

Strictly speaking, across Stripe and Postgres we do not and cannot guarantee distributed atomicity. We implement a saga. Locally, transitions are centralized in the state machine and wallet mutations are atomic Postgres RPCs. For production-hard local atomicity, I would move `transitionPaymentStatus` into a Postgres RPC with row locking, expected-state compare-and-swap, Payment/Gig sync, and audit insert in one transaction. The current implementation is a good centralized validator but not a perfect local transaction.

### What prevents two workers/webhooks from moving the same payment concurrently?

State-machine gates, Stripe's own PaymentIntent state, webhook event dedupe, transfer job re-read, transfer claim states, wallet idempotency keys, and optimistic gig assignment locks. The most important financial backstop is deterministic wallet credit idempotency by payment ID. The remaining improvement is DB-level compare-and-swap for every payment transition.

### How do you reconcile Stripe as source of truth with your Payment and Gig rows?

Stripe is source of truth for external money movement. `Payment` is the local projection and internal operational ledger. `Gig.payment_status` is a denormalized UI/search projection. Webhooks, explicit Stripe retrieval, read-path self-healing, recovery jobs, and migrations converge local rows back to Stripe and wallet-ledger truth.

### What is the failure mode if capture succeeds but DB update fails?

Stripe has captured money, but local Payment may remain `authorized` and owner confirmation may fail before `owner_confirmed_at` is written. Recovery comes from `payment_intent.succeeded` webhook or a later capture retry that detects "already captured" and reconciles to `captured_hold`. It is recoverable but should be operationally visible because the user may see an error despite successful card capture.

### What is the failure mode if DB state changes but Stripe call fails?

The system should remain in an intermediate state. Refund stays `refund_pending`; transfer release reverts to `captured_hold` if wallet credit did not happen; withdrawal debits are reversed if Stripe transfer fails. The key is never to mark final success until the external effect is confirmed.

### How are webhook retries, duplicates, and out-of-order events handled?

Retries are handled by returning 500 on processing failure. Duplicates are deduped by unique `stripe_event_id`. Processed duplicates return 200. Failed duplicates are reprocessed. Out-of-order events are handled by looking up Stripe IDs and only applying transitions valid for the current local state.

### The payment audit doc says the system was not production-ready in March 2026. Which P0s were fixed?

The P0s materially addressed are refund authorization/state-machine flow, webhook idempotency/retry, wallet consolidation toward canonical wallet, withdrawal idempotency keys, SCA modeling, and completion-before-capture bug. The biggest remaining caveats are strict DB-level transition atomicity/CAS, residual legacy mailbox wallet backend surface, and production-grade replay/ops tooling.

### How do you test refunds, disputes, partial captures, SCA, and transfer failures?

Refunds, disputes, SCA, and transfer failures are tested with state-machine/unit tests plus service/job tests and should be backed by Stripe test-mode integration. Partial capture is not currently implemented, so I would test that it is unsupported or add schema/state/API support before pretending to support it.

## What I Would Improve Next

If I were hardening this for real money at scale, I would prioritize:

1. Replace `transitionPaymentStatus` with a Postgres RPC using row lock, expected state, Payment/Gig sync, and audit insert.
2. Add a real `PaymentAudit` table if not already present in the deployed schema, and write every transition with actor, source, Stripe event ID, old state, new state, and metadata.
3. Add a webhook replay/admin worker for `StripeWebhookEvent(processed = false)`.
4. Add deterministic Stripe idempotency keys for capture/refund/transfer calls wherever Stripe supports them.
5. Make `transferred` naming clearer, perhaps `wallet_credited`, and reserve `payout_paid` for bank payout.
6. Remove or fully disable old mailbox wallet backend routes after migration.
7. Add dashboards for stuck `refund_pending`, `authorized` with capture attempts, `captured_hold` past cooling-off, and transfer/wallet reconciliation mismatches.
8. Explicitly decide whether payer self-refund before transfer is product-approved or should be admin/policy-gated.
9. Add first-class partial capture only if product requirements justify it.

## Final Interview Position

The architecture is fundamentally correct for a marketplace escrow model: manual capture, separate charges and transfers, local state machine, Stripe webhook reconciliation, idempotent wallet ledger, and recovery jobs. The important senior-engineering distinction is not to claim impossible distributed atomicity. The system should be described as a recoverable saga with strong local invariants, and the next production-hardening step is to move local payment transitions into a database-level compare-and-swap transaction with full audit logging.
