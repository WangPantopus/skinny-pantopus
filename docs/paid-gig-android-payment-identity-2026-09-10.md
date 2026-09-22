# Android payment opening identity — September 10, 2026

Final local checkpoint verified. The JDK17 R4 build executed the current unit tests and
completed successfully in 3 minutes 19 seconds. Fresh XML from September 10 at
13:43:50–53 UTC records 193 passing tests across fourteen selected classes, with zero
failures, errors or skips. KtLint formatting, Detekt, Android lint and debug APK assembly
passed. The Detekt report is empty. Android lint reports zero fatal errors or errors;
its 212 repository-wide warnings and 16 informational findings include only existing
locale warnings in the touched Gig detail file, outside the identity changes.
Independent review of the opening identity, anonymous proof, suspended-read retirement
and SDK reservation boundaries passed.

The earlier bid checkout, payer refund and assigned authorization screens now capture
an immutable opening account, published token marker and actual injected API origin
before the first asynchronous credential read. A shared identity source verifies an
atomic stored credential snapshot against the current published account and token.
Replacement credentials cannot become the identity of an existing screen. Every
continuation rechecks the opening scope, and a suspended read cannot undo permanent
retirement after another check has already invalidated the screen.

An unavailable identity is distinct from permission to read anonymously. Anonymous
reads require affirmative sign-out, no published token, no stored access credential,
and a current state/marker check after that storage read. Signed-in credential
mismatch, missing storage or read failure cannot become public-read permission. An
unresolved opening principal cannot later adopt anonymous permission. Actual signed-out
and coherent legacy-session reads remain available. Bid checkout retains its existing
requirement for a nonblank authenticated session; refund and assigned authorization
retain their supported token-derived legacy identity.

The actual Gig detail, Offers and Mail detail bid entrypoints use this shared source.
Refund and assigned authorization factories use the same source and observe account
and token changes. Exact provider receipts, authorization preflight and callback proof,
server session proof, payment terms and refund policy remain unchanged. Retiring a bid
screen preserves its claimed SDK reservation until the original callback; another
screen cannot reuse that reservation while the original sheet is active. No raw token,
SDK secret or new recovery identity is persisted by this change.

Verification covers delayed initial reads across replacement accounts and same-account
sessions, actual production identity/factory wiring, injected API origin, contradictory
stored credentials, storage failures, affirmative anonymous and legacy reads, a
suspended scope check after retirement, and the original SDK callback reservation.
The fourteen classes include bid checkout (24), assigned authorization (26), refunds
(17), refund factory (2), shared identity (8), production opening (3), token storage
(13), saved Gig detail (28), Stop entry (5), existing tips (9), Offers (19), and Mail
detail/variants/ceremonial projection (14/16/9). Existing workflow assertions remain.
Intermediate R2 stopped at Detekt and R3 at test-fixture compilation; neither executed
the final tests. Only the fresh R4 task and XML establish this checkpoint's 193-test
result.

Limits: this checkpoint verifies local Android source, synthetic identity/HTTP/storage
behavior and a debug build. It does not install an owner-phone update or claim new
emulator/provider acceptance. Durable tip creation/recovery and exact tip receipts are
next, followed by the full provider/emulator journey and remaining started-work, fee,
dispute, Connect/debt and capacity work. All paid dependencies remain deferred to final
launch preparation. Completed physical Beacon and saved-card acceptance should not be
repeated.

The earlier [bid checkout](paid-gig-android-recovery-2026-09-09.md),
[refund](paid-gig-android-refunds-2026-09-10.md),
[assigned authorization](paid-gig-android-assigned-authorization-2026-09-10.md) and
[task Stop](paid-gig-android-stop-recovery-2026-09-10.md) reports retain the original
journey and verification details.

The verified command ran from `frontend/apps/android` with Temurin JDK 17:

```sh
./gradlew --no-daemon --max-workers=2 \
  :app:ktlintFormat :app:testDebugUnitTest \
  --tests 'app.pantopus.android.data.auth.TokenStorageTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigDetailSaveViewModelTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigDetailStopEntryTest' \
  --tests 'app.pantopus.android.ui.screens.contentdetail.GigTipViewModelTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationCoordinatorTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.checkout.GigBidCheckoutCoordinatorTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.checkout.GigPaymentIdentitySourceTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.checkout.GigPaymentOpeningTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.refunds.GigRefundCoordinatorTest' \
  --tests 'app.pantopus.android.ui.screens.gigs.refunds.GigRefundFactoryTest' \
  --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.CeremonialVariantsProjectionTest' \
  --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailVariantsTest' \
  --tests 'app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailViewModelTest' \
  --tests 'app.pantopus.android.ui.screens.offers.OffersViewModelTest' \
  :app:detekt :app:lintDebug :app:assembleDebug
```
