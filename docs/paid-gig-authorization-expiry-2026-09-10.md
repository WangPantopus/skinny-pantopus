# Paid-gig authorization expiry — September 10, 2026

The former daily job could cancel an assigned task after the payment provider's
cancellation failed or had an unknown result. It also treated a locally estimated
expiry as provider proof. The new service reserves the current task/payment,
provider intent, Charge and actual `capture_before` before any cancellation.
A pending operation blocks worker start, completion, capture, payment replacement,
legacy authorization mutation and competing refund/release admission. The barrier
survives process death and lease expiry.

Only a fresh, exact canceled-intent receipt with zero received/captured money can
commit the Payment and still-assigned, unstarted Gig cancellation. Original payer,
worker, amounts, fees, currency and provider identity remain fixed. The same
transaction creates the two stored notifications and durable delivery identities.
Unknown provider or database responses recover the original operation/key. A
provider cancellation already observed on a later read needs no new cancel call.
A dispute arriving during a provider call retains its exact terminal evidence for
review without overwriting the dispute, closing the task or claiming no charge.
Cold recovery of that pending state is read-only.

In-progress tasks receive a durable payment-attention notice based on actual
provider proof. They are never auto-cancelled, charged again or prompted to confirm
unfinished work. Rechecking the same expiry does not create another notice.
A verified extended deadline, changed task/payment parties or deleted/changed
notification suppresses an old delivery. Every delivery uses the same stored
notification ID and checks current global/gig push preferences. Suppression does
not remove the in-app notice or replay an alert when preferences are restored.
Unknown transport and lost acknowledgement retain durable recovery.

Candidate discovery includes current assigned/in-progress authorized payments and
payments already marked canceled by an earlier provider webhook, plus unresolved
operations. It does not exclude a hold using the old estimated local deadline.
A protected last-checked cursor rotates candidates fairly, with up to 1,000 checks
per run and a capacity warning at the limit. Gig reconciliation runs every 15
minutes; its separate notification relay runs every minute, at most 25 events per
run. Both have pg-boss ownership and cron fallback exclusion. Discovery failure
cannot prevent the independent relay. The existing booking sweep and its daily
schedule remain separate; its helper was preserved unchanged.

The actual current test-account provider probe using Stripe Node SDK 18.5.0 confirmed a manual Visa hold can
be canceled with PaymentIntent received/capturable amounts both zero, Charge
`captured=false`, `amount_captured=0`, refund fields false/zero and an unchanged
capture deadline. The synthetic hold was released, its customer deleted and no
funds captured. This was provider-shape verification, not an application paid-gig
journey. The private probe/log remain outside Git.

Stripe also documents older cancellation reporting that represented authorization
release as a refund. Canceled proof supports either false/zero refund fields or
true/exact-full-authorization fields, while still requiring zero received money,
`captured=false` and an explicit zero captured amount. Partial/contradictory
refund fields, captured money or missing/null capture evidence remain unresolved.
Authorized proof keeps the strict unrefunded shape. See the
[Stripe cancellation reference](https://docs.stripe.com/api/payment_intents/cancel)
and [Stripe's reporting change](https://support.stripe.com/questions/changes-to-balance-transaction-behavior-for-partial-capture-and-payment-cancellation-flows).

Final verification passes **82 focused checks**, including actual scheduler exports,
provider receipt shapes, interrupted cancellation and existing notification
preference/delivery behavior. The complete Node 22 backend run had **4,950 passing
checks, 16 existing skips and one unrelated HTTP socket-hang-up** in
`gigBrowseSections.test.js`. All 18 unchanged checks in that affected suite passed
on the immediate focused rerun. No assertion, timeout or skip was relaxed. This
evidence does not claim that the complete run had zero failures; final integrated
CI remains required. All privacy gates pass.

The final fresh application-schema replay passes **20 migrations, 26 raw SQL
contracts and 26 generated pgTAP wrappers**, with 184 checked PL/pgSQL functions,
85 trigger bindings, zero errors and three unchanged baseline warnings. All 17
new function bodies match the final source replay. The actual production service
and current SQL pass interruption/concurrency checks across **104 database
connections**, including worker-start races, overlapping cancellation, current
terms, disputes before/during cancellation, cold terminal-evidence recovery,
provider/database acknowledgement loss, webhook-first auto-expiry, notification
replay and current recipient context. The initial harness run exposed SQL NULL/
boolean JSON-decoding in the test adapter; that adapter was fixed before the
successful real-service runs. A final unused SQL declaration was removed without
changing behavior; the full fresh replay, service harness and body proof were
then repeated against the final migration.

The populated upgrade preserves exact rows across nine task/payment/notification
tables, including an existing legacy authorization operation, and creates no
historical expiry operations, scan rows or notices. Exact fixtures are cleaned.
Migration policy, generated-wrapper verification and `git diff --check` pass.
Independent review of provider proof, transaction barriers, delivery and scheduler
ownership is complete.

Final migration SHA-256:
`ba856d44366fbf35c77e1e04ef64e6275fb84d4901043fef9184d19fe1c3e21d`.
The 17-body aggregate is
`e3dfa01264bb27b653488606e977548378ab50b532814c0bc3c9dce2638b91b4`.
Private verification evidence remains outside Git:
`/private/tmp/pantopus-gig-expiry-backend-full-r1.log`,
`/private/tmp/pantopus-gig-expiry-browse-r2.log`,
`/private/tmp/pantopus-gig-expiry-privacy-r1.log`,
`/private/tmp/pantopus-gig-expiry-replay-r2.log`,
`/private/tmp/pantopus-gig-expiry-service-r3.log`,
`/private/tmp/pantopus-gig-expiry-upgrade-r2.log` and
`/private/tmp/pantopus-gig-expiry-body-proof-r2.json`.

This checkpoint requires migration `20260910140000` and matching runtime deployed
together after checked integration. It does not complete manual cancellation/fee
policy, dispute resolution, operator resolution of contradictory provider evidence,
Connect/debt workflows, cancellation-pending client UX, capacity/retention validation
or a fresh complete provider/browser/native paid-gig journey. Bookings and other
non-gig payment lifecycles retain their separate policies. No hosted application
migration, scheduler flag, production payment or device acceptance ran here.
All paid dependencies remain deferred to the owner's final combined launch step.
