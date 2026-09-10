# Assigned-gig browser authorization — September 10, 2026

The existing “Complete Authorization” path previously fetched payment state
without displaying a form. Both gig detail layouts now expose a working shared
recovery panel for an assigned task, including a provider-confirmed ended hold
that can be replaced. A cancelled task does not offer authorization recovery.

The panel reads status before presenting any card action. Explicit Continue
resumes the exact displayed payment, payer, worker, amount and USD currency.
The signed-in actor is separate from the business payer. A server-issued
nonsecret session fingerprint is frozen from the first verified status response
and required before backend mutation. Neither a same-account replacement session
nor a changed account may silently replace that fingerprint. Same-tab and
cross-tab session signals also retire the old view and retained callbacks.

Immediately before submitting the actual Stripe form, the panel rereads the
server session and exact payment/attempt/intent. An already-authorized receipt
closes the form without another confirmation. SDK completion is followed by
another exact server receipt check; only a matching authorized manual hold
reports readiness. Pending, scheduled, cancellation-in-progress, missing and
mismatched results cannot report success. A lost response offers read-only
reconciliation, and closing the form does not cancel the task. Payment secrets
are never saved locally.

Temporary Stripe return parameters are removed at both page boundaries, even
if a webhook authorized the payment before the page loaded. The selected bid,
other navigation parameters, hash and browser history state are preserved.
Current business-manager permissions enable both layouts; permission refreshes
keep the current form mounted until the new decision arrives, while actor,
owner and session changes invalidate the prior result. The matching backend
emits a gig update only when payment status or provider identity actually changes.

## Verification

Final full web regression: 1,136 passing checks across 85 suites. The 51 focused
flow/entry/session/redirect checks exercise the actual React payment components
and SDK submit callback with controlled HTTP/provider responses. They cover
exact delegated payer terms, unknown outcomes, same-cookie session replacement,
pre-submit account changes, completed-elsewhere authorization, malformed
receipts, scheduled and cancelling states, duplicate submissions and revoked
business access. Existing completion action callbacks remain wired.

Type checking passes with zero errors. Changed-file lint has zero errors;
new payment and hook files are clean, with 43 existing warnings in adjacent
legacy detail/offer/completion files. The classic detail page's existing type
suppression remains technical debt. Independent review closed the pre-mutation
session, pre-SDK session, unconditional URL cleanup and refresh/remount findings.
Final private logs: `/private/tmp/pantopus-gig-assigned-web-full-r4.log`,
`/private/tmp/pantopus-gig-assigned-web-types-r5.log` and
`/private/tmp/pantopus-gig-assigned-web-lint-r5.log`.

## Integration and remaining acceptance

This source requires the protected historical-authorization backend/migration
committed as `e6f478891`; see the [backend report](paid-gig-legacy-authorization-2026-09-10.md).
It remains in draft PR #34 pending native parity, full provider/browser/emulator
acceptance and final-head CI. The controlled Stripe responses do not establish
real bank/3DS behavior or a deployed update. New bid-acceptance payments retain
their separate operation; future scheduling, authorization expiry, cancellation,
dispute, Connect/debt and durable attention flows remain explicit release work.
No hosted migration, provider payment, paid service or owner-device operation
ran during this source checkpoint.
