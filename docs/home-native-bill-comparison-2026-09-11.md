# Native current bill comparison continuation — September 11, 2026

## Scope and current status

Continues the [live calculation/browser milestone](home-bill-comparison-continuation-2026-09-11.md).
Current native Home bill cards opt into format 2 and request USD explicitly.
They validate version/currency, chronological aligned monthly arrays, finite
amounts and the ten-household comparison floor before displaying values.
Amounts retain two decimals in major units. The latest personal month is used;
a peer comparison requires that exact month. Missing matching peer data is
explicit and does not hide the personal amount. Malformed/legacy/wrong-currency
responses are retryable unavailable states. A current finance denial hides the
bill card; confirmed absence has distinct paid-USD/24-month wording.

**Both native initial bill milestones pass:** iOS signed build r4 / complete
installed journey r2 / Swift quality, and Android build r2 / complete installed
journey r2 / formatting / Detekt / lint. Each final platform journey records
22 production bill reads through all listed cases. Neither milestone completes
currency choice, lifecycle, whole-Home, physical-device or release acceptance.

**Next uncommitted iOS work:** currency selection, monthly totals and a scoped
read identifier are implemented locally. Currency build r2 passes after fixing
Text-only typography modifiers; the initial build failed and is not a pass.
An added installed journey and held-earlier-reply fixture are running under
`/private/tmp/pantopus-native-bill-ios-currency-ui-r1.xcresult`. Inspect that
outcome before claiming acceptance. Keep these iOS/fixture changes out of the
verified Android milestone until their own full workflow passes.

The first installed iOS run passed current amounts and both missing-month/cohort
cases, then failed to find Retry by identifier. The visible button existed;
exported XCTest hierarchy confirmed the card identifier had overwritten child
identifiers. Explicitly containing the card's accessibility children repaired
that issue. The entire r2 journey then passed, rather than skipping the failed
step. Initial failures remain available in private r1 evidence.

Android's initial packaging attempt was interrupted after GC statistics showed
386 full collections / 333 seconds in the reduced 3 GB heap. Only that owned
wrapper/single-use daemon was stopped. Build r2 with the project's normal 6 GB
heap passes formatting, Detekt, assembleDebug and lintDebug. The interrupted
build is not counted as a pass.

## Installed acceptance method

The shared loopback fixture wraps the committed production Home bill HTTP/service
adapter and the owned PostgreSQL database. Normal app sign-in, Profile, My homes
and Home dashboard navigation are required. Identity, Hub and dashboard shell
responses are synthetic; financial access overrides, paid bills, cohort opt-out
and comparison-month changes use actual SQL. Fault injection supplies persistent
503, malformed data, legacy format and wrong currency. No hosted or paid provider
is involved. Fixtures clean only their exact synthetic rows.

The iOS XCTest journey and Android UIAutomator driver cover current fractional
amounts, matching/mismatching peer months, insufficient cohort, repeated error
and retry, malformed/legacy/currency mismatch, confirmed empty, current financial
denial and restoration through cold returns. Final iOS r2 passes all of these cases with **22 production bill reads**.
All reads explicitly request format 2 / USD; six are automatic/explicit attempts
through the persistent 503 case. Original sign-in is observed in r1; r2 continues
with the real simulator Keychain's existing synthetic session and normal
navigation. Screenshots of current amounts, cohort absence, invalid-currency
recovery, confirmed empty and current denial were visually reviewed. The Retry
control is separately accessible and was actually pressed. Android r2 also passes every listed case with 22 production bill reads, normal
sign-in/Profile/My homes navigation, explicit Retry and final restoration.
Android r1 reached the denial case but its case-sensitive locator missed the
uppercase ESTIMATED HOME VALUE heading. The captured hierarchy confirmed the
heading; case-insensitive matching (including absence checks) repaired the
driver, and the entire r2 journey passed. This was not an app-state failure.
Android accessibility hierarchies were retained; no Android pixel, dynamic-type
or physical-device acceptance is claimed here. Existing capture protections
are unchanged.

## Open work

Native currency choice and complete monthly presentation remain. Foreground
refresh, cancellation/held reads, account changes and retirement of the surrounding
Home summary/access controls require separate actual acceptance. The captured
iOS dashboard also shows duplicate Back controls and the floating Add button
overlapping a Recent activity action; these surrounding layout findings remain.
The same screenshots show truncated checklist instructions and a missing-value
message that attributes unavailable property estimates to address verification
without showing evidence for that cause. Verify and repair these native summary
states as part of the next actual UI pass. Place financial
overview/detail still needs equivalent native/web verification. Broader residency,
submission/recovery, ownership/leases/resources, settings/privacy, account/vendor,
payment and release backlog remains in the [handoff](PROJECT_HANDOFF.md).

PRs #32/#34 remain drafts. The current compatibility head is ca49d5ba4571e77bf5470384e08d9421d423691c;
all of its required remote checks now pass. Each new pushed head needs its own checks. The native changes add no migration.
Combined Home/paid dependency reconciliation and replay remain outstanding.

## Private evidence and resource limits

- Final `/private/tmp/pantopus-native-bill-ios-ui-r2.xcresult`, log and exported
  `...-attachments`; `/private/tmp/pantopus-native-bill-ios-final-r2.json`.
- Signed `/private/tmp/pantopus-native-bill-ios-build-r4.log`; full Swift quality
  `...-ios-lint-r1.log` and `...-ios-format-r1.log` (2,148 files); the subsequent
  containing-group change also passes affected Swift quality.
- Android `/private/tmp/pantopus-native-bill-android-build-r2.log` passes;
  final installed `/private/tmp/pantopus-native-bill-android-ui-r2` contains
  result.json, fixture-final.json, all state hierarchies and the complete log.
  Both platform scopes' exact SQL fixture cleanup passes in the shared
  `/private/tmp/pantopus-native-bill-fixture-r2.log`.


Evidence is outside Git under /private/tmp/pantopus-native-bill-*.
The owned iPhone 17 simulator is Pantopus Bill Acceptance,
F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8. Owner simulators, source, databases and app
data are untouched. Low disk space was relieved by removing only rebuildable
x86_64 object directories from the owned preceding build; products, UI evidence,
source and SQL backups were retained. The current build targets arm64. The owned iOS
simulator was shut down after its first milestone and has now been booted for
currency acceptance. The owned Android recurrence AVD is shut down after its
final pass. The loopback fixture was cleaned and restarted as r3 for currency
acceptance; no concurrent test changes the shared mode/SQL fixtures.
