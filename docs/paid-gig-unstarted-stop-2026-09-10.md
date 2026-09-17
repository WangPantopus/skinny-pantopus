# Unstarted task cancellation and release — September 10, 2026

Status: locally verified source checkpoint with independent review. This report
does not establish deployed provider, browser or native acceptance.

The old cancellation path could cancel a task after an unknown payment result.
Worker release and reopening could overwrite a changed assignment after waiting
for Stripe, and `/close` could bypass payment handling entirely. The shared stop
gateway now saves the original command before financial work. It only completes
the exact current task after verified hold release, verified refund success, or
proof that no authorization was attempted. Unknown outcomes retain the request
and block conflicting work or a replacement payment.

## API and task behavior

The [concrete request and receipt contract](../backend/contracts/gig-stop-contract.md)
defines the common POST, read-only preview/status GETs, and strict compatibility
shims for cancellation, reopening, worker release and close. Clients retain a
nonsecret UUID, action, reason code, rollback mode and original displayed terms
before POST. A current server session fingerprint is required on each command.
The saved original actor and terms never change; the same actor may explicitly
resume after signing in again with a fresh opening proof. Stale screens cannot
dispatch under a replacement account or session.

Reopening and worker release retain their pre-capture-only policy. Cancellation
with a verified zero fee can return a captured payment's remaining amount through
the existing protected refund service. Provider history is reconciled **before**
freezing that amount. The stop barrier exists first; the exact refund reservation
then acquires the same task/payment locks and uses the stop UUID. A late external
refund cannot silently enlarge or change the original refund request.

Nonzero fees, started work, no-show execution, disputed payments, released worker
earnings and unknown historical attempts remain explicit restrictions for the
next policy checkpoint. No fee is waived or described as charged. A cancellation
accepted during its zero-fee window keeps those agreed terms on retry. A command
that crosses the grace boundary while waiting for a database lock is checked
against the fresh time before reservation.

Close only applies to an open, unassigned task without unresolved payment or
checkout history. A task reopened by a verified stop may subsequently close while
retaining its historical payment receipt. Legacy clients without the required
proof receive an actionable conflict before provider access; matching client and
backend deployment is required.
The former DELETE close shortcut now uses the same strict close command and
retains the task/receipt. Generic status updates cannot reopen or cancel a task
without going through that gateway. Other existing lifecycle transitions remain
outside this bounded repair.

## Financial and transaction boundaries

Service-only `GigStopRequest` rows preserve the original actor/session audit,
task/payment/worker/amount/policy terms and terminal receipt. Stop reservation,
leases and finalization acquire task then payment locks. Existing refund
reservation, claim and receipt functions retain their implementations behind
small stop-aware wrappers with the same lock order and current authority checks.
The wallet primitive checks the stopped payment before taking a wallet lock,
closing the interval before refund reservation exists. Its original credit
calculation is preserved behind a private implementation; separate tip payments
and existing idempotent receipts retain their behavior. Legacy release markers,
release timestamps and income ledger evidence cannot be mistaken for held funds.
The protected settlement/outbox transaction also retains its original body
behind a wrapper that acquires task then payment locks. A stale settlement call
cannot hold the payment while waiting on a stop's task lock.

Pending stops fence worker start, capture, assignment/price changes, accepted-bid
mutation, new bids, modern checkout and legacy authorization/expiry operations.
A terminal transaction rolls back the exact accepted bid when required, changes
the task, retains the historical payment and stores its notices together. An
interrupted final response recovers the saved receipt without repeating payment
effects. Existing dispute truth can still be recorded; it cannot authorize a new
provider mutation or silently close the task.

Hold release addresses only the exact existing intent and uses one stable
cancellation key. It verifies the current intent, customer, payer, worker, amount,
currency and Charge. Both zero amount received and explicit zero captured amount
are required. The current no-Refund authorization-release representation and the
documented historical full-authorization-refund representation are accepted;
actual captured money or missing capture proof cannot be labeled released.
Financial evidence may be recorded after an actor/dispute change during the call,
while task mutation still requires the current authority and unchanged terms.

GET reads do not call providers. A separate bounded reconciliation job reads
existing provider outcomes and may finish the original request; it never issues
a new cancellation, authorization or refund. The five-minute scan rotates at
most 100 pending requests. A separate minute relay handles at most 25 stored
notices. Due/lease/payment indexes support those bounded scans. These limits are
implementation bounds, not production workload/capacity acceptance.

Notifications keep one stored identity, honor current global/gig push preferences
and suppress retired contexts or deleted notices. Reopening or closing a task
again can correctly suppress an obsolete notice. Transport retries remain at
least once with the same notification ID; no exactly-once APNs claim is made.

## Verification

- The production service/real-SQL harness passes **221 database connections**,
  including external partial-refund discovery before freezing the remainder,
  read-only background completion, unknown/lost outcomes, both wallet-credit
  winners and the protected-settlement lock-order interleaving. Fixtures clean up.
- The final fresh replay passes all **21 migrations, 27 raw contracts and 27
  generated wrappers**. SQL lint checks 209 functions and 92 trigger bindings
  with zero errors and three existing warnings.
- A populated upgrade preserves exact JSON rows in **16 tables**, including
  historical legacy/expiry operations, pending and succeeded refunds, protected
  wallet credits, refund recovery and notices. There is no stop backfill; fixture
  cleanup passes. All 29 current function bodies match the applied source. The
  three preserved refund bodies, original wallet primitive and settlement/outbox
  body match their pre-upgrade definitions exactly.
- The final full backend run passes **5,005 tests**, with 16 existing skips and
  one unchanged `homeRecordWatch` HTTP test timeout. The unchanged affected suite
  and all 66 stop/route/scheduler checks then pass together: **75 tests in five
  suites**, with no source changes or raised timeout. The preceding full run
  passed 5,002 tests before the four additional
  termination-route checks. Old worker-release fixtures now verify missing proof
  causes no provider call or parallel task mutation. All privacy gates pass.
- Independent final service, wrapper and route review passes. Current-head CI is
  still a release requirement; the passing focused repeat does not establish the
  cause of the isolated full-run HTTP timeout.

Migration SHA-256: `d84e429d4c611ed7fc08e1a41d58b80d54d85afcbf54599fc95de3f8a72130c8`.
The aggregate of the 29 current function bodies is
`df12c477c9583486524910e4c0230d8919c0fa1c7e9b4da23602be981e252bb3`.

All fixtures are synthetic and local. No hosted migration, scheduler
flag, provider account, paid subscription or owner-device action was changed.

## Remaining work

Browser recovery is committed as `650ac9ce0`. Finish matching native stop controls
and current-head CI, then evaluate
started/no-show/fee policy with frozen previews and exact fee execution. Dispute,
Connect/debt, support resolution of retained unknown operations, actual end-to-end
provider/emulator journeys and workload/capacity checks remain release gates.
The separate paid-tip flow still needs exact server-receipt/session acceptance;
repairing its old FIFO iOS test fixtures does not prove that payment journey.
All paid subscriptions remain deferred together to final launch preparation.
