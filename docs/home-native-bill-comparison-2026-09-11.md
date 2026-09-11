# Native current bill comparison continuation — September 11, 2026

## Scope and current status

Continues the [live calculation/browser milestone](home-bill-comparison-continuation-2026-09-11.md).
Current native Home bill cards opt into format 2 and default to an explicit USD request.
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

**Currency/history continuation in progress:** both clients now select the
server's available currencies, show every monthly total, and retire an earlier
currency reply after a new selection. The Home-specific Create footer reserves
space instead of covering amounts. iOS additionally removes the duplicate host
Back control and contains dashboard accessibility children so Create retains its
identifier. Android has matching monthly accessibility descriptions.

iOS signed currency build r5 and affected final Swift quality pass. Currency UI
r4 passes currency/held-reply/24-month/overlap/Back but its recovery test failed
at legacy Retry when Docker stopped during the run. A direct HTTP read and
Docker CLI also hung; this is retained as failed environmental evidence, not a
passing app run. Docker recovery is described below. Complete iOS UI r5 passes both journeys against the recovered database: currency/history in 116.739 seconds and full recovery with 22 production reads. USD/CAD and oldest-history screenshots were reviewed. Android currency build r1 failed for a missing semantics import; r2 passes format/Detekt/compile/assemble/lint. Android installed currency r1 passed USD/CAD and held-reply retirement, but failed to find the oldest row while the disclosure was collapsed. Two focused installed probes (including cold return) expand it correctly. Full currency r2 now records before/after expansion and asserts its visible response; full recovery remains next. Android source/driver are still uncommitted, distinct from the completed iOS milestone. General Home lifecycle remains incomplete.

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

Android full currency/history acceptance remains; iOS currency/history r5 passes. Foreground
refresh, cancellation/held reads, account changes and retirement of the surrounding
Home summary/access controls require separate actual acceptance. The original captured
iOS duplicate Back and floating-button overlap are repaired and pass final r5
acceptance; Android equivalent layout needs its final full history check.
The same screenshots show truncated checklist instructions and a missing-value
message that attributes unavailable property estimates to address verification
without showing evidence for that cause. Verify and repair these native summary
states as part of the next actual UI pass. Place financial
overview/detail still needs equivalent native/web verification. Broader residency,
submission/recovery, ownership/leases/resources, settings/privacy, account/vendor,
payment and release backlog remains in the [handoff](PROJECT_HANDOFF.md).

PRs #32/#34 remain drafts. All required checks on predecessor
3fb62d564d7379a5d1969b89714aaba0a6b89e90 now pass. #34 remains conflicted.
Each new pushed head needs its own checks. The native changes add no migration.
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

Additional resource cleanup during this uncommitted scope removed only the
completed owned Android build's generated project_dex_archive, dex, classes,
and tmp directories and the owned Xcode Index.noindex. APKs, test reports,
source, UI evidence, database backups and device data were preserved. Gradle
will regenerate the missing intermediates on the next Android build.

During currency acceptance Docker again stopped and ignored normal restart.
The authorized recovery used normal quit/termination first; only one identified,
unresponsive Docker backend needed forced termination. Existing Docker 29.1.3
and the active Gig replay SQL recovered; a direct bill read returned HTTP 200.
Twenty-three containers from ten retained older Pantopus replay projects were
stopped after Docker automatically restarted them. No container/volume/database
was deleted. The r4 fixture then completed exact cleanup. The r5 listener adds
response status/duration evidence to distinguish pending replies from UI faults.

Android emulator r1 refused startup for low disk. Additional cleanup removed only
the owned Xcode ModuleCache.noindex and 20 regenerable arm64 object directories,
after confirming no compiler used them. Products, installed test bundles,
screenshots/results, app data and database backups remain intact. Android r2
startup uses only the named owned recurrence AVD. Owner devices remain untouched.

The final currency resource cleanup also removed the completed Android build's
intermediates/tmp/kotlin (APK/reports retained), and only inactive generated
intermediates from `/private/tmp/pantopus-link-privacy-ios-build`, whose recorded
workspace is the already merged link-privacy task. Its products/logs/source were
preserved. Android emulator startup r3 succeeds after r1/r2 low-disk refusals.
Final iOS `/private/tmp/pantopus-native-bill-ios-currency-ui-r5.xcresult` and its
attachments, signed `...-ios-currency-build-r5.log`, final format/lint logs,
`...-ios-currency-final-r5.json` and Android `...-android-currency-build-r2.log`
retain the evidence. Neither resource recovery nor local acceptance is a hosted
release or production disaster-recovery rehearsal.
