# Android paid-gig refund recovery — September 10, 2026

The owner payment card now opens confirmed refund/authorization-hold release
requests and read-only status/history. Entry binds the exact payer, gig, payment,
USD total and injected API origin. The current account/session is checked at
every operation and response; identity changes hide old payment content and
prevent retained callbacks from completing another session's flow.

Before POST, the original request UUID, nullable amount and reason code are
written atomically to storage excluded from backup. Provider secrets and another
client's description are not persisted. A failed save prevents sending. Cold
recovery only reads history; an empty result preserves an unconfirmed local
operation. Retry retains its original terms, and only explicit `REFUND_ACTIVE`
can replace that identity with the competing protected request.

Exact payment and request receipts determine completion. The server's
caller-specific retry permission and explicit held-worker projection gate the
available actions. Released/uncertain earnings retain history access with an
explanation. Legacy exact wallet credit without a fabricated settlement receipt
remains supported. Hold release is distinguished from captured-charge refund,
the platform fee is labeled included, and tips remain separate from the original
task amount.

Closing/reopening the sheet and changing targets cannot transfer an old request
or history into a new payment. Independent review found one invalid-target
reopen that retained the previous target; clearing it before asynchronous
validation now prevents the error screen from loading old history.

## Verification and limits

- Final **56 behavioral checks pass**, including real disk-store recreation,
  HTTP wire encoding/decoding, interrupted response/restart, exact original
  identity and terms, active conflicts, current-session changes, invalid-target
  reopening, caller retry restrictions and released-worker states.
- Final `ktlintCheck`, Detekt, Android lint and debug APK assembly pass. Detekt
  has zero findings; Android lint has zero errors, with 212 existing/app-wide
  warnings and 16 informational items. Earlier static findings were resolved
  through smaller validation expressions, named constants and formatting.
- Root independent review is complete. The exact 19-file source manifest was
  frozen for final verification. Detailed logs remain outside Git; final output
  is `/private/tmp/pantopus-gig-refund-android-r5.log`.

These JVM/HTTP/disk checks and app assembly use synthetic responses. They do not
certify an actual provider refund, full emulator walkthrough or physical-device
delivery. Complete the fresh sandbox paid-gig journey after historical assigned
authorization recovery and the remaining cancellation/settlement/dispute work.
No hosted migration, provider operation or device update ran for this checkpoint.
Paid subscriptions remain deferred to final combined launch preparation.
