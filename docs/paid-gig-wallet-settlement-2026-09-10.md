# Paid-gig residual wallet settlement — September 10, 2026

This source checkpoint releases the remaining worker earnings after verified
refunds of a completed paid gig. One protected database receipt records the
exact credit and the refunds already deducted. Later allowed refunds recover
only the additional amount. Original payment amounts remain unchanged.

It extends [durable refund receipts](paid-gig-refund-receipts-2026-09-09.md)
(commit `80d155b30`). The corresponding [web release display and refund
controls](paid-gig-web-refunds-2026-09-09.md) were independently committed as
`991b4f77d`. This is local source/database evidence; hosted deployment and the
whole provider/device journey remain separate gates.

## Transaction and amount boundary

Migration `20260910070000_paid_gig_wallet_settlements.sql` creates service-only
`PaymentWalletSettlement` and `settle_paid_gig_wallet_income`. It locks Payment
before checking the current linked Gig and before crediting Wallet. New credit
requires capture identity, USD, the original total/allocation, an elapsed
cooling period, no dispute or active refund, and the current exact payer,
worker, completed Gig, worker completion and owner confirmation. A missing Gig
link cannot fall through to the legacy wallet path.

The succeeded protected refund receipts must sum exactly to
`Payment.refunded_amount`. With original total T, worker allocation W and
verified refunds R, the credit is `W - floor(R * W / T)`. The transaction saves
R as the receipt's refund basis. For a $10 payment with $8.50 worker allocation
and a $3 refund before release, it credits $5.95 with a $3 basis. A later $2
refund then recovers $1.70, leaving $4.25, rather than deducting the first refund
again. Cumulative integer floors also make repeated partial refunds sum exactly
at the last cent.

The wallet balance, income transaction, settlement receipt, payment release
state and exact Gig mirror commit together. The original payer/payee/Gig,
total/allocation, currency and provider identities are frozen after settlement.
A retry returns the existing exact receipt; it cannot credit again. A zero
result creates a `no_earnings` receipt without a money transaction.
`refunded_partial` and `refunded_full` remain refund states independently of
worker release, and `amount_to_payee` remains the original allocation.

Actual income proof includes its payment, payer, payee, Gig, type, direction,
amount and the referenced Wallet's owner and USD currency. New-credit proof is
checked after the preserved primitive so a mismatch rolls back the entire
credit. An exact historical full credit may be adopted with refund basis zero;
ambiguous or malformed historical credits cannot authorize a recovery debit.
The migration itself rewrites no historical financial rows and manufactures
no settlement receipts.

Later permitted admin/policy refunds debit only cumulative worker recovery
above the frozen pre-credit basis. A frozen or insufficient wallet retains the
incremental amount as debt. Repeated verified receipts cannot debit twice.
Payer self-service refund entitlement still ends at worker wallet credit or an
external transfer. This checkpoint adds no new unilateral refund entitlement.

## Read-only release projection

Refund history, refund POST responses and the current Gig payment summary use
one backend projection:

- `payee_release_status`: `held`, `wallet_credited`, `no_earnings`,
  `external_transfer` or `unknown`.
- `wallet_settlement`: null or `{ id, paymentId, status, amountCents, currency,
  refundBasisCents, createdAt }`, with status `credited` or `no_earnings`.

A receipt's amount is the historical exact credit, not the current wallet
balance or current gross payment minus refunds. A fully verified refund can
show `no_earnings` with no receipt before scheduled settlement runs. Exact full
historical wallet income can show `wallet_credited` with no fabricated receipt.
Contradictory or missing proof stays `unknown`; a database read failure returns
an unavailable error. Read projection performs no mutation or provider call.
Original task amounts and separately aggregated tips keep their existing
meaning. The Gig endpoint also rejects mismatched linked-payment ownership and
continues stripping provider identifiers from worker responses.

The scheduler now selects completed paid-gig payments with partial/full refunds
as well as unreleased capture holds. Its paid-gig branch calls the one SQL
transaction and uses the receipt amount for a new-credit notification. Duplicate
or zero receipts do not announce another credit. It never applies the legacy
status reset after an unknown atomic-settlement response.

## Local verification

- Final complete backend suite: **4,808 passing tests**, **16 existing skips**,
  using
  CI's Node 22. Projection, scheduler, refund service/HTTP, Gig payment HTTP and
  existing legacy lifecycle checks are included.
- Final atomic canonical application replay: **22 SQL contracts pass**. The new
  real-role contract checks residual and later recovery, exact cent rounding,
  duplicate calls, original-term preservation, cooldown, dispute, completion,
  active refund, zero earnings, frozen-wallet debt and recovery, legacy adoption,
  EUR-wallet rollback, malformed/duplicate legacy proof, injected receipt-write
  rollback and denied authenticated access.
- Application function lint: **zero errors**, 161 PL/pgSQL functions, 80 trigger
  bindings, three existing warnings.
- Final concurrency harness passes with **36 separate PostgreSQL connections**:
  both refund/credit lock orders, concurrent duplicate credit, changed cooldown,
  dispute or current Gig ownership/completion while waiting, and repeated refund
  receipts after a residual credit. Exact synthetic fixtures are cleaned.
- Populated upgrade rehearsal preserves exact Payment, Refund,
  PaymentRefundReceipt, Wallet and WalletTransaction rows and both historical
  wallet-credit function bodies. Subsequent exact legacy adoption keeps basis
  zero without a second credit or recovery.
- Privacy gates, migration policy, generated wrapper consistency and diff checks
  pass. Initial test-only issues were corrected: missing nullable mock fields,
  local rehearsal SQL aliases, a refined SQL expression and fixture FK cleanup
  ordering. One final full run encountered the previously observed intermittent
  local HTTP timeout/parse failures in the unrelated business-booking suite;
  its unchanged focused rerun passes (**142 tests** across eight relevant
  suites), and the final complete retry passes as recorded above. No timeout was raised or production assertion relaxed.
- Backend providers are mocked; PostgreSQL fixtures are local and synthetic.
  No hosted migration, Stripe call, device run or deployment occurred here.

Reproduce the concurrency test against a disposable migrated local database:

```sh
node scripts/db/test-paid-gig-wallet-concurrency.cjs CONTAINER DATABASE_contract
```

The reusable SQL contract is
`scripts/db/contracts/paid-gig-wallet-settlement.sql`; its generated pgTAP
wrapper is `supabase/tests/paid-gig-wallet-settlement.test.sql`.

## Remaining acceptance gates

1. Integrate, run current-head CI and reviewed hosted upgrades, then exercise
   the full test-mode paid-gig authorization, completion, capture, refund and
   worker release journey with exact provider reconciliation and fixture cleanup.
2. Finish native refund controls and the separately identified historical
   assigned off-session authorization-retry flow. These are distinct from the
   completed native pending-bid checkout recovery checkpoint.
3. Cancellation-fee residuals without both completion receipts remain held for
   an explicit policy settlement design. Booking/tip legacy full-credit paths
   remain compatible; this migration does not grant a new partial-settlement
   policy for them.
4. Historical Connect transfers/reversals, operational debt recovery and broader
   dispute-loss accounting still need their own verified lifecycle. Contradictory
   legacy wallet proof requires reconciliation instead of an automatic debit.
5. Wallet-credit notifications still use the existing post-commit delivery path.
   Money and its receipt survive process death, but death before notification
   delivery can omit that notice. A durable wallet-notification outbox remains a
   separate reliability task; the acceptance outbox already exists for bid
   assignment and is not changed here.
