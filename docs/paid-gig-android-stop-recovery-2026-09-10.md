# Android task action recovery — September 10, 2026

Final local checkpoint verified. The JDK17 R5 build executed the current unit tests and completed
successfully in 5 minutes 6 seconds. Fresh XML from September 10 at 12:54:41–44 UTC records 91
passing tests across eight selected classes, with zero failures, errors or skips. KtLint formatting,
Detekt, Android lint and debug APK assembly passed. The Detekt report is empty. Android lint reports
zero fatal errors or errors; its repository-wide warnings do not identify new Stop sources.
Independent review of the receipt, wire encoding, opening identity and storage lifetime boundaries
passed.

The existing Gig detail entry points for cancelling an unstarted task, reopening bidding, worker
release, and closing an unassigned task now share one coordinator. Explicit confirmation uses the
server preview and saves the original request UUID, nullable terms, permitted reason code and
rollback mode before POST. No payment secret, credential, free text or server-session proof is
stored. Recovery is scoped to API origin, actor and Gig; a freshly opened authenticated session can
resume the same actor's original request with its current server proof.

The production Moshi configuration includes a Stop-specific adapter that preserves explicit nullable
terms on POST and disk, rejects missing nullable terms/receipt proof on read, and leaves unrelated
DTO serialization unchanged. Raw Retrofit request JSON checks require all eleven frozen term keys.

Check status is read only. Lost replies retain the same UUID; a negative read cannot create a new
one, and retry uses the original fields. Only a verified STOP_ACTIVE conflict plus an exact read can
replace the saved operation, under an atomic compare-and-replace. Exact completed task/payment
receipts alone clear the matching saved operation and refresh the task. A competing saved record
remains visible for explicit recovery instead of being erased or hidden by another receipt.

Saved task action status is separate from ordinary action controls and remains reachable after
cancellation, a worker release, or unavailable task details. If its saved record disappears, that
entry cannot show a new-action preview or submit. Corrupt or unwritable storage is a visible error.
Before the first asynchronous credential read, the factory captures the current account and a
synchronous nonsecret credential marker; delayed reads cannot bind an existing screen to replacement
credentials. Local account/session/API replacement, HTTP access loss and changed opening server
proofs retire existing controls. Dismissal cancels active work; generation checks inside the store
lock preserve recovery when a queued deletion or replacement outlives its view.

Meaningful verification covers actual Retrofit paths and JSON decoding, disk persistence/recreation
and competing writes, all four Gig detail action entry points, lost replies/cold retries, exact
receipt rejection, saved status after terminal role/status changes, original reason retention,
conflict adoption, access retirement and late-response dismissal. The selected tests cover the Stop
API (6), persistent store (4), detail entry (5), coordinator (22), production factory (4), existing
saved-task detail (28), tips (9) and token storage (13). Earlier R2 output reached only main
compilation and stopped at Detekt; older retained XML is excluded from this checkpoint evidence.

Limits: this checkpoint contains synthetic HTTP/storage tests and an Android debug build. It does
not install an owner-phone update or claim real provider/notification/emulator acceptance.
Started-work, no-show and fee policy execution, tips, disputes/Connect/debt and capacity remain
separate work. The earlier bid-checkout, refund and assigned-authorization coordinators still need
the same initial asynchronous identity edge reviewed before final full paid-journey acceptance; this
checkpoint applies the synchronous marker only to task Stop. All paid services remain deferred to
final launch preparation.

This client follows the [durable backend stop contract](../backend/contracts/gig-stop-contract.md)
and the [backend verification checkpoint](paid-gig-unstarted-stop-2026-09-10.md). The [iOS
report](paid-gig-ios-stop-recovery-2026-09-10.md) and [browser recovery
report](paid-gig-web-saved-stop-entry-2026-09-10.md) record the corresponding clients.

The verified command ran from `frontend/apps/android` with Temurin JDK 17:

```sh
./gradlew --no-daemon --max-workers=2 \
  :app:ktlintFormat :app:testDebugUnitTest \
  --tests 'app.pantopus.android.ui.screens.gigs.stop.*' \
  --tests 'app.pantopus.android.data.gigs.GigStopApiTest' \
  --tests 'app.pantopus.android.data.gigs.PendingGigStopStoreTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigDetailStopEntryTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigDetailSaveViewModelTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigTipViewModelTest' \
  --tests 'app.pantopus.android.data.auth.TokenStorageTest' \
  :app:detekt :app:lintDebug :app:assembleDebug
```
