# Paid-gig authorization and capture checkpoint — September 9, 2026

The existing paid-gig backend now reserves one durable acceptance before creating
its provider intent, requires exact authorization before assigning or starting
work, and confirms capture only from matching provider success plus a saved
receipt. This is a source checkpoint. It does not complete paid-gig SDK,
notification, refund, wallet settlement, or Connect acceptance.

Source is isolated in `codex/staging-paid-gig`, initially based on payment-sheet
source `89662d8da`. No paid-gig provider call, hosted migration, production change,
or new Home/business permission grant was made during this checkpoint. Merge the
payment-sheet work and reconcile current master before deploying this candidate.

## Durable acceptance and provider proof

The [migration](../supabase/migrations/20260910020000_paid_gig_acceptance.sql)
introduces a service-owned `GigPaymentAcceptance` operation with a stable UUID,
exact gig/bid/payer/payee/amount, one active operation per gig, and retained
canceled/accepted receipts. Reservation locks the Gig before the Bid. Free bids
use the same lock and cannot overtake a paid checkout. Expiry checks use the
current clock after lock acquisition.

[Acceptance orchestration](../backend/services/gigPaymentAcceptance.js) creates a
manual-capture PaymentIntent using the operation UUID as the idempotency key.
Known intents are retrieved and reused. A saved Payment whose binding response
was lost is recovered by its exact operation metadata. An unknown creation
outcome can retry the same operation only within a conservative ten-minute
window. Older unknown outcomes remain blocked; list absence must never justify
creating a replacement authorization.

[Provider proof](../backend/stripe/gigPaymentProof.js) checks the local payment
and provider intent against the exact payer, worker, gig, customer, agreed bid
amount, currency and operation. A payment-sheet success callback alone cannot
assign the worker. Finalization updates Bid, Gig, and operation in one database
transaction after authorization is durable. Its receipt survives HTTP retries;
chat/participant repair runs again on accepted retries without duplicating
acceptance chat messages.

Abort checks the bid belongs to the owned URL gig. Its cancellation fence blocks
finalization; a provider timeout retains the operation and payment reference.
Only confirmed provider cancellation releases the bid. The expiry job preserves
new durable operations and does not discard a legacy payment reference after an
unknown cancellation outcome.

## Workflow and capture boundaries

Worker start fails closed for missing, unreadable, or mismatched payment proof.
It no longer creates a payer checkout from a worker request. Start and owner
confirmation bind their final writes to the exact payment, payer, worker and
price checked before the provider await. Bid edit/counter/rejection/withdrawal
paths use status comparisons and require a returned mutation row. Database
reservation guards also reject stale service writes to active checkout terms.

Capture first retrieves the exact provider intent. A new capture uses a stable
idempotency key and a durable `capture_pending` admission. A canceled or partially
captured intent cannot become `captured_hold`. Lost provider responses and failed
local receipts reconcile existing provider success without recapturing. The
receipt preserves its original capture/cooling-off timestamps. Capture limits
apply after provider-success reconciliation, including job retries.

Payment transitions compare their prior state and update Gig status only when
`Gig.payment_id` still matches that payment. A tip, retired payment, or delayed
job cannot overwrite another main payment's status. Authenticated payer/payee
reads remain; direct client Payment mutations and Gig/Bid payment/assignment
field writes are closed.

## Verification

- All 4,692 backend tests pass, with 16 existing skips; all privacy gates pass.
- [Actual service proof tests](../backend/tests/paidGigPaymentProof.test.js) cover
  identity/amount/provider-state denial, retry keys, missing authorization,
  capture/cancel unknown responses, saved-but-unbound recovery, and expiry.
- [Actual route tests](../backend/tests/unit/paidGigLifecycleRoute.test.js) cover
  owner/worker/foreign access, cross-gig abort denial, stale bid writes, payment
  replacements during provider awaits, and accepted-receipt chat repair.
- All 19 SQL contracts pass after a fresh chronological replay of every canonical
  migration into separate local disposable databases. The historical local
  payment fixture was incomplete, so it was replaced by a fresh replay; no source
  compatibility exception was added for that fixture.
- The [paid-gig SQL contract](../scripts/db/contracts/paid-gig-acceptance.sql)
  exercises real service/authenticated roles, exact binding, authorization
  denial, forced mid-assignment rollback, cancellation fencing, free expiry,
  stable capture receipts, row retention, and service-only privileges.
- [Concurrency checks](../scripts/db/test-paid-gig-concurrency.cjs) pass across
  35 local PostgreSQL connections: same/different/free bids, stale service edits,
  cancel versus finalize, repeated assignment, capture counters and receipts.
- The whole migration preserves populated Gig/GigBid/Payment rows, including a
  legacy pending authorization, in a rollback rehearsal. Function lint reports
  zero errors across 141 functions and 78 trigger bindings. Migration policy,
  generated wrappers and whitespace checks pass. Synthetic contract profiles,
  auth users and acceptance operations are absent after cleanup.

These tests use mocked Stripe and local PostgreSQL. They do not prove real SDK
charge/authorization, webhooks, notification delivery, hosted migration adoption,
or a completed customer refund.

## Next bounded work before paid-gig acceptance

1. Reconcile unknown provider creation outcomes by listing only the exact payer
   customer and operation metadata, requiring one exact matching intent before
   binding it. Never create beyond the conservative window from a negative list
   result. Add durable acceptance side effects/outbox so a process death after
   assignment cannot lose chat/notification delivery; recheck current delivery
   eligibility. Business delegated-actor revocation during SQL admission remains
   a separate authority boundary to close before broad paid-gig acceptance.
2. Persist native/web pending acceptance across process/navigation/redirect
   interruptions. Web's payment modal must display the selected bid amount;
   currently it uses the gig budget. Complete the exact recovery UI on all
   acceptance entry points.
3. Repair the payer-scoped refund API: durable operation/idempotency, unknown
   provider/DB outcomes, cumulative partial-refund state and a usable refund
   receipt. There is no paid-gig refund UI consumer yet. Keep this separate from
   subscriptions, marketplaces and post-transfer reversals.
4. Run a fresh synthetic test-mode paid gig through SDK authorization, exact
   worker start/completion, owner capture, notification/exact-gig return and
   payer refund before settlement. Assert the amount/identity tuple and one
   provider operation after retries, deny worker/foreign refund attempts, and
   retain minimal sanitized financial receipts during fixture cleanup.

The inspected charge/capture/pre-settlement refund path makes Connect optional.
The normal cooling-off job credits a Pantopus wallet; wallet withdrawal requires
an eligible payout account. Wallet settlement/withdrawal and Connect onboarding
are later acceptance steps and must not be inferred from this checkpoint.
