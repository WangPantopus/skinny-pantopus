# Paid-gig web checkout recovery — September 9, 2026

## Result

Web bid acceptance now goes through one checkout for the exact selected bid.
The gig detail, alternate detail, offers drawer and My Gigs entries navigate
there without creating a payment. Chat opens the offers list so a person chooses
the intended bidder before acceptance or a counter-offer.

The checkout loads currently authorized owner bids. It can resume one server-held
pending bid after navigation or restart, or the exact selected bid after a
provider redirect. Multiple pending candidates or an unavailable selected bid
require review; the client does not guess. The backend remains responsible for
authority, current terms, payment proof and assignment.

## Recovery and scope

- Present the server's durable amount and currency, after checking the returned
  bid identity. The gig's advertised budget is never used as the checkout amount.
- A verified existing authorization proceeds directly to finalization without
  presenting PaymentSheet again. Free acceptance requires an exact accepted bid
  receipt. SDK success alone never reports assignment.
- A lost finalization response retains same-bid confirmation. Uncertain
  cancellation retains a retry action until the exact pending-bid receipt arrives.
- Remount checkout state when actor, gig or requested bid changes. Late responses
  and old SDK callbacks cannot finalize another screen's checkout.
- Keep payment secrets in memory. Retire the previous session-storage secret
  cache without reading it; strip provider intent, secret and redirect-status
  query parameters with history replacement while retaining the nonsecret bid,
  application return state and navigation state.
- Display pending payment resume actions in existing offer lists. Preserve the
  separate historical assigned-gig authorization-retry flow; its broader provider
  reconciliation remains a subsequent milestone. Operation-backed payment
  replacement through that legacy flow is fenced by the backend work.

## Verification and limits

The complete pre-review web suite passes: 77 suites / 1,019 tests. After independent
review, the additional redirect-secret regression passes with all 20 focused
checkout/SDK-redirect tests, plus 4 acceptance-entry-point tests. Web TypeScript
passes. Changed-file lint reports zero errors and existing legacy warnings.
Independent review accepts the final redirect cleanup and examined account,
gig and bid continuation guards. Current-head CI remains an integration gate.

The tests cover exact amount, delayed account/bid changes, same-bid recovery,
duplicate clicks, unknown finalization/cancellation, invalid terms, free
acceptance and provider return URL identity. These use controlled API and SDK
responses. No real provider transaction, hosted migration, native paid-gig
acceptance or refund is claimed by this report. The next milestones are native
checkout recovery, remaining assigned-payment/refund boundaries and the actual
synthetic sandbox paid-gig journey with exact cleanup.
