# Payments & Payouts Thread Summary (2026-03-18)

## Scope
This note summarizes what was fixed during this thread, why those fixes were needed, and what still needs hardening.

Fee math was intentionally not changed (`$10 -> $8.50` net to worker remains expected per platform fee policy).

## Root Cause Found For "Wallet Still 0"
The critical blocker was a schema/code mismatch in transfer finalization:

- `processPendingTransfers` wrote `Payment.transferred_at`.
- Actual schema column is `Payment.transfer_completed_at`.
- Result: cron could credit wallet, then fail status transition to `transferred` with error:
  `Could not find the 'transferred_at' column of 'Payment' in the schema cache`.

Evidence:
- `backend/jobs/processPendingTransfers.js`
- `backend/database/schema.sql` (`transfer_completed_at`)
- runtime logs shared in thread

## What Was Fixed In This Thread

### 1) Paid instant-accept now initializes payment before assignment
Issue addressed: paid v2 instant-accept could assign without initializing payment.

Fix:
- `backend/routes/gigsV2.js`
- In `POST /:gigId/instant-accept`, paid gigs now create payment setup (`PaymentIntent` or `SetupIntent`) before assignment.
- On setup failure, route now blocks assignment with `payer_payment_required`.

Outcome:
- Prevents paid gigs from being assigned with missing `payment_id`.

### 2) Bid acceptance now blocks on payment setup failure and uses agreed bid amount
Issues addressed:
- assignment could happen even if payment setup failed
- amount source drift (`gig.price` vs accepted bid/countered amount)

Fix:
- `backend/routes/gigs.js` (`POST /:gigId/bids/:bidId/accept`)
- Computes `agreedPrice` from `GigBid.bid_amount` first, fallback to `Gig.price`.
- Initializes payment before mutating bid/gig state.
- Returns blocking error if setup fails.
- Updates `Gig.price` to agreed accepted price.

Outcome:
- Correct payer authorization amount source.
- No assignment without payment setup.

### 3) Worker start self-heals legacy assigned paid gigs with missing payment
Issue addressed: legacy rows could block worker start forever.

Fix:
- `backend/routes/gigs.js` (`POST /:gigId/start`)
- If paid gig is assigned but missing `payment_id`, route attempts to initialize payment and backfill gig payment fields.

Outcome:
- Prevents permanent deadlocks for older assignments.

### 4) History API now supports combined payment+payout history and direction metadata
Issues addressed:
- no payout stream in history tab
- sign direction ambiguity in UI

Fix:
- `backend/routes/pays.js`
- Added/used `GET /api/payments/history` merging `Payment` + `Payout`.
- Adds `entry_type`, `direction`, `_isSender`, `_currentUserId`, `amount_cents`.

Frontend wiring:
- `frontend/packages/api/src/endpoints/payments.ts` (`getTransactionHistory`)
- mobile/web history tabs read this endpoint.

Outcome:
- History can show payout events and stable sign direction.

### 5) Earnings/spending response shape compatibility aligned
Issue addressed: frontend/backend contract mismatch produced occasional zero rendering.

Fix:
- `backend/routes/pays.js` `/earnings` returns both nested and flat forms (`{ earnings, ...earnings }`).
- `frontend/apps/mobile/src/components/payments/PayoutsTab.tsx` parses both nested and flat shape.
- `frontend/apps/web/src/app/(app)/app/settings/payments/page.tsx` parses both nested and flat shape.

Outcome:
- Reduced rendering zeros caused by response-shape drift.

### 6) Financial read endpoints no longer rate-limited as writes
Issue addressed: intermittent `0`/empty values after refresh due to GETs being rate-limited.

Fix:
- `backend/middleware/rateLimiter.js`
- `financialWriteLimiter` now skips `GET/HEAD/OPTIONS`.
- Mounted routes remain `/api/payments` and `/api/wallet` in `backend/app.js`.

Outcome:
- Prevents payment/wallet reads from being throttled as writes.

### 7) Mobile history no longer wipes list on transient fetch failure
Issue addressed: history could disappear on one failed refresh.

Fix:
- `frontend/apps/mobile/src/components/payments/HistoryTab.tsx`
- On fetch error, existing list is retained (no forced `setTransactions([])`).

Outcome:
- Better UX stability under transient API failures.

### 8) PaymentSheet setup-mode support fixed across mobile entry points
Issues addressed:
- setup-intent flows used wrong secret key field in PaymentSheet init
- several acceptance surfaces ignored payment setup requirement

Fixes include:
- `frontend/apps/mobile/src/components/gig-detail/PaymentSection.tsx`
- `frontend/apps/mobile/src/components/gig-detail/OffersPanel.tsx`
- `frontend/apps/mobile/src/app/gig-v2/[id].tsx`
- `frontend/apps/mobile/src/app/offers.tsx`
- `frontend/apps/mobile/src/components/chat/GigChatActions.tsx`

Behavior:
- if `isSetupIntent`, uses `setupIntentClientSecret`; else uses `paymentIntentClientSecret`.
- acceptance flows now check `requiresPaymentSetup` and `clientSecret` and trigger payment flow.

Outcome:
- SetupIntent/PaymentIntent parity and fewer stuck `setup_pending/authorize_pending` flows.

### 9) Mobile payment status badge normalized to lifecycle states
Issue addressed: UI checked `captured` while backend canonical is `captured_hold`.

Fix:
- `frontend/apps/mobile/src/components/gig-detail/PaymentSection.tsx`
- Badge logic now recognizes `captured_hold`.

Outcome:
- Correct status display.

### 10) Tip release semantics aligned with backend lifecycle
Issues addressed:
- copy implied instant tip availability
- transfer job / recovery assumptions were gig-only

Fixes:
- Transfer job credits `tip_income` for tip payments.
- Recovery check now treats both `gig_income` and `tip_income` as wallet-credit evidence.
  - `backend/jobs/processPendingTransfers.js`
- Added regression test:
  - `backend/tests/transferRecovery.test.js` (`transfer_scheduled tip with tip_income wallet credit -> advanced to transferred`)
- UX copy updated in payments/wallet informational text to reflect review period.

Outcome:
- Tip behavior and messaging are now consistent.

### 11) Transfer finalization schema mismatch fixed (`transferred_at` -> `transfer_completed_at`)
Issue addressed: payments getting stuck due to nonexistent column.

Fix:
- `backend/jobs/processPendingTransfers.js`
- Replaced all transfer completion updates to use `transfer_completed_at`.

Added test assertion:
- `backend/tests/transferRecovery.test.js` checks `transfer_completed_at` is set.

Outcome:
- Removes the hard failure shown in logs and allows stuck rows to recover.

### 12) Transfer-status schema constraint alignment migration added
Issue addressed: runtime writes used values absent from DB constraint in some environments.

Fix:
- `backend/database/migrations/092_payment_transfer_status_values.sql`
- Allows `wallet_credited` and `partially_reversed`.

### 13) Payment API contract alignment and analytics migration updates
Issues addressed:
- frontend expected `stateInfo` with gig payment response
- stale SQL analytics functions in some environments still used old lifecycle assumptions

Fixes:
- `backend/routes/gigs.js` `GET /:gigId/payment` returns `{ payment, stateInfo }`.
- `backend/routes/pays.js` uses `supabaseAdmin` for history query path.
- `backend/database/migrations/093_update_user_payment_analytics_functions.sql` refreshes earnings/spending RPCs for modern lifecycle states.

Outcome:
- Better frontend/backend contract consistency.
- Lower risk of stale analytics in DB environments that run migrations from files.

## Verification Performed
Executed targeted backend tests:

- `leakyPipe.test.js`
- `transferRecovery.test.js`
- `fullPaymentLifecycle.test.js`
- `instantAccept.test.js` (in earlier step of this thread)
- `bidAcceptancePayment.test.js` (in earlier step of this thread)

All executed suites passed at the time of changes.

## What Is Still Not Great (Needs Follow-up)

### A) Wallet/Payout UI still suppresses errors too quietly
Current pattern in several components favors silent catches or stale display over explicit error state.

Impact:
- Users can still perceive "random zeros" or stale snapshots without understanding fetch failure vs true zero.

Recommendation:
- Add explicit inline error banners and retry CTA in Wallet/Payouts/History tabs.

### B) Ledger model is correct but still confusing to users
`Earnings` (Payment ledger) and `Wallet balance` (withdrawable ledger) are intentionally different.

Impact:
- Users see non-zero earned totals with zero wallet and interpret as broken.

Recommendation:
- Add a dedicated "Pending release" amount and "next release ETA" in UI.
- Show clear breakdown: `Total earned`, `In review/hold`, `Available in wallet`.

### C) Operational safety and observability are still light
No explicit alerting path was added in this thread for stuck transfers.

Recommendation:
- Add monitors/alerts for:
  - `captured_hold` older than 48h
  - `transfer_scheduled` older than 30m
  - repeated `processPendingTransfers` failures

### D) Manual trigger for transfer job is not exposed as internal endpoint
There is an internal route set, but not for `processPendingTransfers`.

Recommendation:
- Add protected internal endpoint to trigger transfer processing for ops recovery.

### E) Existing stuck rows from pre-fix runs may need one-time reconciliation
Rows that were wallet-credited before transition fix can remain in intermediate status until next successful recovery pass.

Recommendation:
- Run job once after deploy.
- Verify intermediate rows transitioned to `transferred`.

## Recommended Next Steps (Priority)
1. Deploy backend with current transfer-job fixes.
2. Trigger `processPendingTransfers` once manually in environment.
3. Run SQL reconciliation checks for stuck rows and wallet-credit parity.
4. Add user-visible error states in mobile/web Wallet/Payouts/History.
5. Add monitoring for stale `captured_hold` and transfer failures.

## Quick Risk Assessment (Current)
- Before this thread: high risk for payout reliability and status correctness.
- After these fixes: medium risk.
- To reach low risk: complete observability + explicit UI error states + ops trigger/reconciliation tooling.
