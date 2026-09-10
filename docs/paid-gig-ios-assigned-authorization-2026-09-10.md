# iOS assigned-payment recovery — September 10, 2026

The assigned task's payment card now opens a real authorization flow. A current
poster or authorized business manager can check the existing payment or explicitly
continue it. The screen binds the displayed task, linked payment, payer, assigned
worker, USD amount, opening account and server session before payment work starts.

## Behavior and recovery

- The cold screen reads status only. An explicit Continue sends the exact displayed
  terms and opening server-session proof to the protected historical authorization
  endpoint. The business payer remains distinct from its acting manager.
- Immediately before Stripe presentation, a read-only probe must confirm the same
  authorization operation, provider intent, financial terms and server session.
  Already-authorized and pending results do not open a payment sheet.
- Stripe completion is followed by another read of that exact operation. Only a
  server-confirmed authorized hold reports readiness. Decline, dismissal, unknown
  HTTP outcome or a replaced intent cannot claim success or cancel the task.
- Scheduled authorization and cancellation-in-progress have explicit waiting copy.
  Checking after an unknown result recovers the current payment without blindly
  creating a new provider operation. Secrets remain transient in memory.
- A retained screen cannot rebind to another account, replacement session or API
  origin. Dismissing the flow or leaving its owning route retires its lifetime;
  late network and SDK callbacks cannot present or complete afterward. Duplicate
  screens share one in-flight provider admission for the same actor/task/origin.
- The detail entrypoint decodes `Gig.payment_id` and checks it against the current
  payment, including task-price cents, payer, worker and currency. Workers, denied
  managers and stale/mismatched terms do not get authorization controls. Existing
  refund and other owner-only actions keep their separate permission boundaries.

## Verification

The final simulator app build passes **67 selected checks**: 17 assigned-payment
flows, the existing 39 detail behaviors and 11 refund recovery flows. New checks
exercise the actual detail entrypoint for a poster and distinct business manager,
wire-encoded expected terms/session, unknown outcomes, changed account/session,
replaced provider operation, scheduled/cancel-pending states, duplicate screens,
and dismissal during both network work and SDK presentation.

All eight changed Swift files pass SwiftFormat and strict SwiftLint. Independent
source review found no remaining blocker in the exact payment binding or screen
lifetime handling. The first app run exposed a request-body test helper that did
not read URLSession's streamed body; the helper now reads it and the same exact
wire assertions pass. No product permission or assertion was weakened.

This uses controlled network/SDK responses in the compiled app on the iPhone 17
simulator running iOS 26.5. It does **not** prove a fresh Stripe provider journey,
physical device delivery or the final integrated release. Those remain separate
acceptance work. The previously completed physical Beacon and saved-card checks
are unchanged and should not be repeated.

## Next work

Finish Android parity, fresh complete sandbox paid-gig journeys, cancellation,
dispute/Connect/debt handling, durable attention delivery and realistic capacity
checks, followed by checked integration. Draft PR #34 is unfinished. No hosted
migration, paid dependency or provider operation was performed for this checkpoint.
All paid subscriptions remain deferred together to final launch preparation.

Private operator logs remain outside Git at
`/private/tmp/pantopus-gig-assigned-ios-r4.log`. The backend and browser contracts
are described in the [backend authorization report](paid-gig-legacy-authorization-2026-09-10.md)
and [browser report](paid-gig-web-assigned-authorization-2026-09-10.md).
