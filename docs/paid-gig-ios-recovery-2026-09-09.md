# iOS paid-bid recovery — September 9, 2026

This source milestone is part of draft PR #34. It does not deploy an API,
apply a hosted migration, authorize a provider payment or replace the completed
saved-card acceptance in PR #31.

## Behavior

Gig detail, received Offers and the active mailbox gig detail now use one
`GigBidAcceptanceCoordinator`. They pass the exact selected gig/bid to the
owner-authorized API. PaymentSheet completion alone never assigns the work:
the client requires the exact accepted bid in the finalization receipt.

The server retains pending payment identity. Returning to the gig, Offers or
mail exposes resume/cancel controls. A verified authorization resumes the same
finalization without presenting another sheet. If assignment committed but its
response was lost, a failed accept/cancel can read the exact accepted bid and
request the same finalization receipt. Neither a different accepted bid nor a
stale mail payload establishes completion. Unknown cancellation remains
retryable until the exact pending-bid receipt arrives. A cancellation retry
that discovers completed assignment reports acceptance instead of cancellation.

Paid responses must identify the selected bid, a pending payment, supported
positive USD cents and a PaymentIntent rather than a SetupIntent. The backend
owns equality between the agreed bid, provider amount and durable operation;
the client does not use the advertised gig budget as payment proof. Free
acceptance requires the exact accepted-bid response and skips PaymentSheet.

The coordinator binds account, login session and API origin when its screen is
created. It checks that identity after every API/SDK suspension and before any
dependent finalize/abort request. Legacy sessions without a server session ID
use a memory-only credential fingerprint; token changes conservatively require
returning through a fresh screen. No client secret or pending payment identity
is persisted by this coordinator. A shared in-process gate prevents two screen
instances from starting payment actions for the same session and gig together.
Bid rows disable their actions while an operation is in progress.

## Verification

- First compile and simulator test checkpoint: 65 tests pass across coordinator,
  gig detail and Offers. This precedes the final cold-recovery and account-race
  additions.
- Final expanded simulator suite: **101 tests pass**, including 12 coordinator
  and five entry-point regressions. These cover cold committed-finalization recovery, wrong gig/bid receipts,
  delayed accept/final responses after account/session change, concurrent
  screen instances, mailbox pending/retry/cancel behavior and agreed-counter
  availability and preservation of gig identity through local bid updates.
- SwiftFormat passes. Strict SwiftLint passes all 2,085 source/test files after
  the expanded test fixture repair. An earlier expanded compile caught a missing
  injected presenter in that new fixture; it was fixed before the passing run.
  Final changed-file lint/format and the 101-test rerun pass after the last
  bid-copy identity correction.
- Independent review of the first coordinator and all three active callers
  found no blocking identity or payment-continuation issue. The follow-up uses
  the same identity fences for read-only recovery and finalization.

These tests use controlled API responses and an injected PaymentSheet presenter.
They establish client behavior, not actual Stripe authorization, capture,
refund, notification delivery or device payment acceptance.

## Remaining work

Android parity now passes its [source milestone](paid-gig-android-recovery-2026-09-09.md).
Integrate current master and pass all checks for the
final PR head. Then finish durable refunds and legacy assigned authorization,
and exercise a fresh synthetic test-mode paid-gig lifecycle through worker
completion, capture, exact notification return, refund and cleanup.

The old `MailboxItemDetailViewModel.acceptGigBid` still contains an optimistic
placeholder. Its corresponding view has no application caller (only its own
preview); it is a retired shell, outside the three active entry points above.
Do not count that placeholder's existing unit test as payment acceptance.
Instant-accept, scheduling, wallet, Connect and subscriptions are separate
remaining payment boundaries.
