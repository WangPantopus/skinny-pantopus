# iOS paid-gig refund recovery — September 10, 2026

The owner's existing gig payment card now opens refund and authorization-hold
release history. New requests require an explicit confirmation and a current,
exact payment belonging to the opening payer, gig and API. A blank amount means
the remaining amount; releasing an authorization hold keeps a null amount and
does not claim that a captured charge was refunded or that the gig was canceled.

An interrupted request retains its UUID, original nullable amount and reason
code before sending. Recovery is scoped to account, API and payment, excluded
from backup and written atomically with device file protection. Provider secrets
and descriptions supplied by another client are not persisted. Storage errors
prevent a new request. Status reads never POST a refund and cannot discard an
unconfirmed local request merely because history is empty.

Retry preserves the original terms and honors the server's caller-specific
retry permission. A competing request can replace the local identity only for
the explicit `REFUND_ACTIVE` response. Same-ID changed terms and foreign receipts
cannot acknowledge or clear the original operation. Exact payment/request
receipts determine completion; an HTTP success flag alone does not. Concurrent
screens serialize the operation, and account/session/API changes hide the old
history and fence retained callbacks and actions.

New self-service refunds require the backend's explicit held-worker state.
Already credited, externally transferred or uncertain worker earnings show an
explanation while retaining status/history access. Exact historical wallet
credit with a null settlement receipt remains supported, as specified by the
[settlement projection](paid-gig-wallet-settlement-2026-09-10.md).

## Verification and limits

- Final app build and **50 focused simulator checks pass**: 11 refund recovery
  checks and 39 existing gig-detail checks. Recovery checks cover actual local
  file-store recreation, scoped history, interrupted response/restart, original
  UUID and terms, active-conflict recovery, changed terms, session changes,
  storage failure, mismatched receipts, hold-release wording and released-worker
  restrictions.
- All nine changed Swift files pass formatting and strict lint. Final compilation
  has no new warnings in the refund files. Initial verification corrected the
  file-protection writing option and Swift concurrency/type annotations.
- Independent review is complete. The final immutable nonisolated identity and
  explicit existential annotation remove compiler warnings without relaxing
  account checks.

These are simulator app builds with controlled HTTP responses. They do not
certify a provider refund, physical device delivery or the complete fresh paid-gig
journey. Those remain required after Android parity, historical assigned-payment
authorization recovery and the remaining settlement/cancellation/dispute work.
No hosted migration, provider operation or physical iPhone update ran here.
Detailed local logs remain outside Git; final verification is retained in
`/private/tmp/pantopus-gig-refund-ios-r3.log`.
