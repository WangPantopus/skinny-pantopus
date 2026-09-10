# Unstarted task stop contract

Matching clients and backend must deploy together. Legacy mutations without the
opening proof return `409 STOP_TERMS_REQUIRED` before any provider operation.

`GET /api/gigs/:gigId/stop-preview?action=cancel|reopen_bidding|worker_release|close`
returns `{ actorId, sessionScope, action, terms, eligible, unavailableReason,
financialAction, activeRequestId }`. Both GET endpoints read local receipts only.
`terms` is the exact object to freeze and return on every retry:

```ts
type StopTerms = {
  gigId: string; ownerId: string; workerId: string | null;
  paymentId: string | null; amountCents: number; currency: 'usd';
  gigStatus: string; acceptedAt: string | null; acceptedBidId: string | null;
  policy: string; policyFeeCents: number;
};
```

`POST /api/gigs/:gigId/stop-requests` accepts `{ requestId, action,
expectedActorId, expectedSessionScope, expectedTerms, reason, rollbackMode }`.
`requestId` is an RFC UUID generated and durably retained before POST. `reason`
is an optional documented cancellation reason code (never local free text).
`rollbackMode` is null or `payment_setup_aborted`, valid only for reopening.
The three existing mutation routes, `/close`, and `DELETE /api/gigs/:gigId`
use the same strict command. The DELETE compatibility alias closes an unpaid,
unassigned task and retains its receipt; it does not erase the row. Generic
`PATCH /api/gigs/:gigId/status` requests for `open` or `cancelled` reject with
`STOP_TERMS_REQUIRED`; clients use the common stop command instead.
No query, preview, HTTP status or missing response establishes completion.

`GET /api/gigs/:gigId/stop-requests/:requestId` returns the saved request. Retry
uses POST with the **same UUID, action, reason, rollback mode and original terms**.
A freshly authorized session for the same original actor may resume it; the
command sends that screen's current server session proof. A stale screen's old
session proof fails before provider access, including same-account relogin.

Both commands and status return `{ actorId, sessionScope, requestId, action,
status, financialStatus, canRetry, request, receipt }`. `status` is `pending`,
`needs_review` or `completed`. `financialStatus` is `none`, `release_pending`,
`released`, `refund_pending`, `refunded` or `needs_review`. `request` contains
`requestId, gigId, actorId, action, terms, reason, rollbackMode` and the original
financial action. `receipt` is null until completion, then contains the exact
request/gig/payment/owner/worker/amount/action and resulting task status. Match
all of these before displaying success. An unknown response retains the local
request; GET never invents absence as permission to create a new UUID.

```ts
type StopRequest = {
  requestId: string; gigId: string; actorId: string;
  action: 'cancel' | 'reopen_bidding' | 'worker_release' | 'close';
  terms: StopTerms; reason: string | null;
  rollbackMode: 'payment_setup_aborted' | null;
  financialAction: 'none' | 'release' | 'refund';
};
type StopReceipt = {
  requestId: string; gigId: string; paymentId: string | null;
  ownerId: string; workerId: string | null; amountCents: number;
  currency: 'usd'; action: StopRequest['action'];
  gigStatus: 'open' | 'cancelled';
  financialStatus: 'none' | 'released' | 'refunded';
};
```

Only `STOP_ACTIVE` may identify a different active request; read its status and
honor its original actor and `canRetry`. Other conflicts must not adopt it.
Read/retry remains separate from starting a new stop request.

Reopen and worker release retain their existing pre-capture-only policy. A
captured zero-fee cancellation uses the existing protected full-remaining refund
request and remains pending until that exact refund succeeds. Nonzero fees,
started work, no-show execution, released worker earnings, disputes and unknown
historical provider attempts return explicit review restrictions. Fees are
never silently waived or labeled charged. Close requires an actually open,
unassigned task with no unresolved payment or checkout.
