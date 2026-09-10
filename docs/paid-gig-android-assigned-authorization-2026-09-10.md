# Android assigned authorization recovery — September 10, 2026

The current task payment card now exposes historical assigned-payment recovery
for the payer and server-authorized business managers. Workers have no payer
controls. Exact Gig/payment/payer/payee fields are decoded and checked before
presenting the entry point; the server rechecks current authority and terms.

Opening the recovery dialog checks the current server receipt without creating
or confirming a provider intent. Continue is an explicit action with the opening
actor, server-issued session fingerprint, payer, worker, payment and integer USD
amount. The actor remains distinct from a business payer. The exact receipt,
not HTTP or SDK completion, determines whether the hold is authorized. Ready
receipts skip another SDK launch; scheduled, cancellation-pending and unknown
outcomes remain distinct and offer a status check. The dialog remains dismissible
while checking payment before checkout.

A shared coordinator binds its original account/session/API scope at construction.
It uses the injectable Retrofit origin and the reviewed Home atomic credential
snapshot. Registered token refresh preserves session identity; legacy tokens get
a conservative digest rather than being denied merely for lacking a session ID.
Session/account/origin changes hide previous financial state. Financial reads
require an authenticated opening snapshot; unrelated public Gig reads retain
their separate existing scope.

Immediately before PaymentSheet, another read-only status check must confirm the
original authorization attempt, provider intent, server scope and secret. An
already ready or now pending receipt prevents SDK presentation. After SDK
completion, only that same attempt/intent can trigger confirmed readiness; a
user-initiated cold status check can separately recover the current exact payment.
Cross-instance admission permits one SDK per account/session/API/gig. Closing
the dialog or disposing its route invalidates outstanding responses and releases
admission; late preflight or SDK callbacks cannot reopen or complete the screen.
No payment secrets or pending authorization IDs are saved to preferences or disk.

Final JDK 17 verification passes **76 tests with zero skips or failures**:
24 coordinator flows, three actual Retrofit/wire-contract checks, 28 existing
detail/save/public-scope checks, nine tip/payment-card entrypoint checks and
12 token-storage checks. Kotlin formatting, Detekt, Android lint and debug APK
assembly pass. Detekt has zero findings; lint reports zero errors and 212
unchanged/app-wide warnings. App and test compilation pass. Final independent
review of exact receipts, session scope, SDK operation identity and dismissal
is complete. `git diff --check` passes. Final host log:
`/private/tmp/pantopus-android-assigned-authorization-r4.log`.

The first two formatting runs exposed long lines; the initial
behavioral run passed the core recovery and API tests, while three new detail
entry tests lacked existing no-show/change-order fixture responses and were
retried by Gradle. Explicit fixtures were added, and existing payment-card test
receipts were updated with real identity fields. No assertion, timeout or skip
was relaxed. Independent review requested the exact pre/post-SDK operation fence;
its regressions now pass in the coordinator suite.

This is native source and controlled HTTP/SDK-outcome validation. It does not
claim a provider, hosted migration, emulator or physical-device full paid-gig
journey. Matching backend 110000 and native clients must be deployed together.
The fresh sandbox lifecycle, provider authorization deadlines, durable expiry/
cancellation and remaining dispute/Connect/debt flows are separate gates. Paid
dependencies remain deferred to the owner's final combined launch-preparation
step. Completed Beacon and saved-card acceptance remains complete.
