# Android paid-bid recovery — September 9, 2026

## Scope and behavior

This source checkpoint connects the three routed Android owner-bid entrypoints
(`GigDetailScreen`, `OffersScreen`, and `MailDetailScreen`) to one
`GigBidCheckoutCoordinator` and one PaymentSheet/recovery host. It depends on the
[backend recovery and durable delivery checkpoint](paid-gig-recovery-delivery-2026-09-09.md).
No hosted migration, runtime, provider fixture, charge, or device session was
changed for this checkpoint.

- Paid acceptance uses the exact returned bid ID, `gig_id`, status, integer
  `amountCents`, USD currency, and PaymentIntent configuration. The amount comes
  from the durable server receipt rather than an earlier offer snapshot.
- Verified `authorizationReady` plus authorized payment status proceeds directly
  to same-bid finalization without reopening PaymentSheet. An SDK completion
  still requires the server's exact accepted bid receipt before any accepted UI.
- Pending owner rows offer Resume payment; accepted counters remain actionable.
  Gig detail restores a single exact pending bid from its authorized server list.
  Multiple candidates are never guessed. Offers and mail carry their exact bid
  selection back to the server, which owns the durable attempt. No pending IDs,
  client secrets, or SDK configuration are persisted by the coordinator.
- Lost acceptance/finalization/cancellation responses remain explicit recovery
  states. Confirmation and cancellation can retry the same bid. An accept or
  abort conflict can read the exact accepted server bid and then obtain the
  idempotent finalization receipt; an accepted list row alone is not completion.
- Dismissing the recovery UI or leaving the screen preserves server progress.
  In-flight owner mutations disable all affected row actions. Other bids cannot
  replace an unresolved coordinator selection until the UI is dismissed.
- Each operation checks the current account, login session, API origin, and local
  generation before and after asynchronous responses. Each screen binds one
  initial identity before fetching its data and retains it across dismissal.
  Stable anonymous/legacy sessions may still read; changed identities receive a
  reopen error, and payment admission requires a complete authenticated session.
  Login identity is read from one preferences snapshot; token refresh preserves
  it while a new login replaces it. A sheet callback captures its immutable presentation token, so
  callbacks from an old sheet/account cannot finalize or cancel a later one.
  Screen disposal invalidates pending work without sending an implicit abort.
  A shared SDK admission gate prevents another screen from presenting the same
  account/session/API/gig while an older SDK launcher remains active. The old
  callback releases only its own lease even when its assignment result is ignored.
  Android Retrofit and the identity scope use the same fixed BuildConfig API URL;
  no runtime API override exists in the application network module.

## Evidence

Validation passed on the final Android source over parent `339f03238`:

- **148 focused JVM tests across 13 suites**, zero failures, errors or skips.
  This includes 21 coordinator tests and three exact-receipt/offer decoding tests.
- `:app:ktlintFormat`, `:app:ktlintCheck`, `:app:detekt` and
  `:app:assembleDebug` pass using JDK 17 and two Gradle workers.
- `git diff --check` passes. Main/test Kotlin and generated Hilt/Moshi sources
  compile. Existing AGP/SDK compatibility and unrelated deprecation warnings
  remain; this checkpoint does not upgrade the toolchain.

The final combined invocation used `:app:testDebugUnitTest` filtered to
`GigBidCheckoutCoordinatorTest`, `GigDetailSaveViewModelTest`,
`OffersViewModelTest`, the `mail_detail` test package, `TokenStorageTest`, and
`GigBidReceiptDecodingTest`, followed by the checks above. The first local runs
exposed new overlong lines/compound guards and a synthetic TokenStorage fixture
missing its session ID; all were corrected before the final passing run.
Independent review also identified and closed the initial-screen identity and
anonymous-read regressions before this frozen checkpoint.

The focused regressions cover authorized resume without SDK, exact receipt and
amount decoding, SDK completion with a lost finalization response, unknown abort,
committed-finalization recovery after cold navigation or cancellation conflict,
foreign/incomplete receipts, duplicate taps/callbacks, same-user relogin, logout,
API changes, delayed responses, one-time presentation claiming, multiple pending
bids, accepted-counter navigation, mail acceptance only after a final receipt,
session persistence across token refresh, unused/dismissed old screens, delayed
old-account lists, SDK admission across two screen instances, signed-out/legacy
Gig reads, and a changed-account screen's recoverable reopen state.

Primary source:

- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/checkout/GigBidCheckoutCoordinator.kt`
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/checkout/GigBidCheckoutHost.kt`
- `frontend/apps/android/app/src/main/java/app/pantopus/android/data/api/models/gigs/GigDtos.kt`
- `frontend/apps/android/app/src/test/java/app/pantopus/android/ui/screens/gigs/checkout/GigBidCheckoutCoordinatorTest.kt`
- `frontend/apps/android/app/src/test/java/app/pantopus/android/data/api/GigBidReceiptDecodingTest.kt`

## Verification limits and next work

This is local source/JVM/build coverage. It does not prove PaymentSheet activity
restoration, real Android notification delivery, a provider authorization or
capture, worker completion, Connect transfer eligibility, or a payer refund.
Native device/provider acceptance must run after the matching backend and SQL
candidate are installed. The parallel iOS and existing web reports record their
own evidence.

Instant acceptance, assigned legacy off-session authorization, scheduling,
refunds, and marketplace offers remain separate work. The retired
`MailboxItemDetailScreen` has no routed main-source caller; its old
`MailboxItemDetailViewModel.acceptGigBid` still contains an optimistic local
acceptance and must not be reintroduced as a live entrypoint. This checkpoint
changes the currently routed `MailDetailScreen` instead. The legacy mail Counter
and Decline placeholders are also outside this paid-acceptance slice.
