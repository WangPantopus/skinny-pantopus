# Android Home invitation decisions and secure sign-in return

September 12, 2026. This bounded milestone follows the accepted
[backend command](home-invitation-decision-recovery-2026-09-12.md),
[browser recovery](home-browser-invitation-decisions-2026-09-12.md) and
[iOS recovery](home-ios-invitation-decisions-2026-09-12.md).

## Behavior

Ordinary Home invitations now retain an encrypted, account/origin-bound original
before accept or decline is submitted. Check, retry, cancellation and explicit
acknowledgement preserve that original identity across lost replies, failed
reads, process death, account changes and newer links. A historical acceptance
does not grant current access: entry requires a fresh server session and current
Home authority check. Backgrounding retires the previous confirmation and any
late result. A newer link cannot replace an unfinished original.

Deferred content arrivals now use Android Keystore-backed encrypted preferences,
excluded from backup and device transfer. Legacy plaintext arrivals migrate
after the protected write, retaining their original lifetime and account
binding. Account switching saves the invitation before local sign-out and
bounded server revocation. Failed protected writes leave recovery available;
there is no plaintext fallback or interpretation of corrupt storage as empty.

Unavailable or malformed invitation reads offer recovery instead of claiming
the invitation expired. Business-seat and guest-pass resolution remain separate;
a failed business decline stays visible. Their broader decision/delivery
acceptance is outside this Home milestone.

## Installed acceptance

Final candidate **r5** passes actual Android UI against production HTTP routes,
SDK calls and SQL. The older installed APK exactly matches the retained accepted
private-first-use predecessor. Normal UI stages a signed-out invitation before
an in-place update; the new app recovers it through normal sign-in and clears
the legacy plaintext handoff after migration. App data and authentication are
never replaced by the driver.

The final fixture records five commands: two completed acceptances, one completed
decline, one cancelled attempt and one rejection after expiry while confirmation
was open. Lost replies and cold read failures recover the same original.
Explicit retry preserves request identity and bytes; cancellation of an unseen
attempt creates no acceptance. Five account switches survive process death while
logout replies are held. Wrong accounts cannot read another account's original.
Explicit denial and later membership removal prevent Home entry. A held accepted
reply is retired when another link arrives; the earlier original remains first.
Every original is acknowledged through the native UI.

The initial candidate exposed a real navigation bug: deferred invitation
dismissal could race the explicit dashboard navigation and leave a blank
invitation screen. Home invitation dismissal now finishes before requesting
Home entry. The final installed run reaches the visible dashboard and the
matching Home's actual `dashboard` and `dashboard-access` routes, then confirms
that reopening the consumed link has no retained original.

Final evidence comprises `ui-r2`, `ui-continue-r3` and `ui-finish-r4` on the same
installed r5 APK and fixture. Driver continuations wait for durable
acknowledgement before opening the next link and verify visible dashboard
controls instead of an unexposed health-card tag. All 20 Android source/test
files remain unchanged across these segments. Earlier driver corrections use
visible dialog button labels. No continuation rebuilds the app, changes auth,
clears data or replaces protected originals.

Protected screen capture stays enabled. Native control hierarchies, enabled
actions, navigation and HTTP/SQL results are the acceptance evidence; the
zero-byte screenshot placeholders are not pixel-review evidence. Other display
sizes, text sizes, TalkBack and live provider/device delivery remain separate
verification limits.

## Verification and preservation

Full regression passes **516 suites per variant: 4,547 passed / 80 skipped /
zero failures** in both Debug and Release (4,627 total per variant). Ktlint,
Detekt, full Debug/Release Lint and final privacy gates pass. The installed Debug
APK signature verifies and its digest matches the retained build. The narrow
storage-failure checks prove that an original-save failure prevents a POST,
terminal-proof repair does not POST again, and a committed clear followed by a
lost callback reconciles correctly. Static-analysis refactors split the
resolver, codec validation, preference persistence and screen sections without
suppressing new rules.

The optimized Release APK also builds and its signature verifies. A separate
process on the owned emulator loads that exact retained APK and executes its
actual generated Moshi adapters for the invitation request, protected original
and account-bound login arrival. Every field survives decode/encode and a second
round trip. R8 merges the Moshi builder and inlines its build method; the probe
uses the constructor and discriminator from the actual optimized pending-link
initializer bytecode. No app change, Release installation or data replacement is
needed for this check. The final combined Gradle run passes in 25m 45s.

The owned Android emulator is stopped with userdata retained. Both exact
fixtures are cleaned. Complete role rows, every ledger row/column
and exact function definitions, owners, ACLs, configuration and provenance match
their recorded predecessors. All five final originals are acknowledged. No
permanent migration adoption, app-data clear, uninstall or physical-device
change occurred.

Private evidence is retained outside Git at
`/private/tmp/pantopus-home-android-invitation-decisions-r1/`. It includes final
source and installed-product bindings, predecessor migration evidence, native
segments and HTTP/SQL state, encrypted-preference inspections, complete
regression results, style/privacy/signing logs and both exact cleanup records.
The initial incomplete candidate and all driver/build corrections remain
separate. Intermediate r4 was cancelled for the reproduced navigation repair;
it is not final verification.

## Continuation

H07/H08 remain partial: **7 of 80 acceptance rows closed; 73 partial/open**.
These counts are not a percentage of app implementation or remaining effort.
Finish sender invitation management, resend/withdrawal, truthful delivery and
ordinary-member onboarding, then legacy submission compatibility and the full
backlog. Services outside the bounded dashboard fixture remain open.

No migration is added by Android. The inventory remains **44 Home / 21 paid /
53 combined**, with 12 identical shared versions and zero collisions; combined
replay/adoption remains open. No merge, hosted release or paid activation. Paid
services remain one final launch bundle. The physical iPhone remains 1.0.0 (2).
Owner work/data, devices, accepted artifacts and private evidence are preserved.

Predecessor `13bb557e72a3b6a02f6b50762509566c7a0d53be` has every job passing in
[CI 34716984061](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34716984061).
Verify the current pushed Android head independently before relying on its CI.
