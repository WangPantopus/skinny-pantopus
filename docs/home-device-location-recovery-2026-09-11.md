# Native Home device location recovery — September 11, 2026

Milestone after address-entry head `b40b2ba5b`. Both installed location journeys,
full native regressions, style/lint/snapshots and privacy gates pass.
No location or address result grants Home membership or ownership. H07/H08/R02
remain open for atomic retained create/join and truthful private first use.

## Resulting behavior

The old iPhone timeout raced an uncancellable OS continuation inside a task
group. A missing Core Location callback could keep the group waiting, and a
second caller could replace the first caller's continuation. The replacement
keeps independent cancellable waiters and deadlines, shares the OS acquisition,
and stops it when its last caller leaves. An unanswered permission prompt is
cancellable; acquisition deadlines begin after permission is answered. The
synchronous cache contract explicitly requires MainActor isolation.

Android puts both its fresh Fused Location request and last-known fallback
inside one timeout budget, and cancels the underlying SDK request on completion
or cancellation. Explicit acquisition requests high accuracy so GPS can supply
a fix when network location is absent. The OS still controls permission and
precision. Both platforms accept only currently permitted, recent coordinates
with valid geometry/accuracy: two minutes old, with five seconds of clock skew.
Denial clears the cache. An iPhone OS denial cannot resurrect a refused value
from the manager's separate cache.

Home entry offers Settings and manual recovery. The iPhone purpose text now
includes finding an address. Its system Settings URL opens the root Settings
page on the owned simulator, so the button says “Open Settings” and the screen
explains how to find Pantopus's Location setting. Installed acceptance follows
Apps → Pantopus → Location when needed. The direct destination on a physical
phone is not proven here. Resolved fields remain editable and require canonical
validation before the role step; existing edit, background and session
retirement still applies.

## Actual acceptance

Installed iPhone r2 passes in 71.519 seconds: real permission denial, Settings
navigation and grant, current position through production reverse geocoding,
editable address before canonical validation, real Settings revocation with no
new reverse request, and manual canonical validation after revocation. Its
actual reverse boundary receives the owned simulator's supplied coordinate.
The reviewed denial, resolved form, revocation and validation screens preserve
clear recovery choices. Final signed build r4 passes, including the packaged
permission purpose string. Full iPhone regression passes 4,363 checks with 168
intentional skips and no failures (4,531 total). All six changed Swift files
pass strict SwiftLint and final SwiftFormat verification.

Installed Android r3 passes denial, app Settings grant, GPS-capable acquisition,
editable fields, Settings revocation without another reverse request, and
manual validation. Its own reverse request matches the actual OS GPS/fused
record. This emulator emitted its default GPS fix before the supplied HAL route;
the acceptance proof matches the real OS record instead of assuming the route
was applied. Screens were reviewed. Five focused provider checks and final
build r4 pass. Final Android Debug and Release regression each pass 4,524 checks
with 80 intentional skips and no failures (4,604 total). Style, detekt, lint,
snapshot verification and assembly pass; the complete run takes 8m 44s.

Only the external geocoding/address providers and synthetic sign-in/shell are
controlled. Permission dialogs, Settings, location providers, app navigation,
production reverse/validation/lookup routes and local SDK/SQL are actual. This
does not certify paid providers or physical positioning. The completed r6
fixture has 239 request/response pairs, two reverse boundaries, two Google and
two Smarty boundaries, 15 SDK reads and three SDK inserts. No backend/fixture
errors or Home POST occurred. Graceful shutdown confirms exact namespace SQL
cleanup; port 18083 is free. No migration, permanent adoption, real message,
paid activation or merge occurred.

## Evidence and failed attempts

Private evidence remains outside Git:

- iPhone final build `/private/tmp/pantopus-home-location-ios-build-r4.log`;
  installed result `/private/tmp/pantopus-home-location-ios-ui-r2.xcresult` and
  exported screenshots in the corresponding `-attachments/` directory;
  full regression `/private/tmp/pantopus-home-location-ios-regression-r1.xcresult`.
- iPhone six provider checks `/private/tmp/pantopus-home-location-ios-focused-r2.xcresult`;
  strict style `/private/tmp/pantopus-home-location-swiftlint-r3.log`.
- Android build/provider checks `/private/tmp/pantopus-home-location-android-focused-build-r4.log`;
  installed screens/HTTP `/private/tmp/pantopus-home-location-android-ui-r3/`;
  independent OS correlation `/private/tmp/pantopus-home-location-android-ui-r3-os-binding.log`
  binds the evidence hashes and checks this journey's added request specifically.
- Android final regression `/private/tmp/pantopus-home-location-android-regression-r2.log`
  passes; privacy `/private/tmp/pantopus-home-location-privacy-r1.log` passes.
- Exact cleanup `/private/tmp/pantopus-home-address-entry-native-fixture-r6.log`;
  private complete events `/private/tmp/pantopus-home-address-entry-native-events-r6.json`.

Failed iPhone UI r1 exposed root Settings navigation. Android r1 exposed a
current system button's typographic apostrophe in the driver; r2 then exposed
the production low-power/GPS limitation. Both are preserved. The first driver
coordinate assertion could match an earlier iPhone event; it now isolates this
journey and matches its OS record. The independent verifier also passes the
retained r3 evidence with that stricter check. An obsolete Android regression
client was stopped after checking its exact command and working directory;
the shared daemon was preserved. Wrong-directory formatting/build invocations
changed nothing and retain their logs; corrected commands pass. Accepted prior
products remain in `/private/tmp/pantopus-home-native-artifacts-after-address-entry/`.

Address-entry predecessor `b40b2ba5b` now has all CI jobs green in
[run 34658007186](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34658007186).
Verify this milestone’s own pushed-head checks separately. The migration
inventory remains 39 Home / 21 payment / 48 distinct combined versions.
