# Native Home list identity and first use

Candidate on `codex/home-permission-boundaries`, based on `b0097a41a`.
Implementation and installed acceptance are in progress; H05/H08 are not yet
closed by this report. No migration or hosted data changes belong to this
native milestone.

Both native Home lists consume the explicit list authority contract. Shared
household access, exact private setup and personal verification have distinct
labels and destinations. Roles use the current effective role; ownership and
residency have separate chips. Verified ownership without an occupancy does
not invent residency. Private setup opens the real Tasks collection; an
applicant continues the appropriate verification flow. A missing authority
contract produces a retryable error rather than an empty or permissive list.
Deletion controls use current server eligibility.

List content and delete confirmations retire on departure, backgrounding and
account changes. Refresh clears old content before the read and checks its
current session/generation before publishing the result. Shared Place and
household selectors filter explicit current shared access. The Profile Home
identity no longer counts saved Homes as household members or presents a
generic verification badge based on ownership. Other mounted selector/session
flows and unrelated IAM/mutation screens remain within the broader backlog.

The installed iOS journey found that the shared list renderer ignored a
concrete screen's banner: the property existed only as a protocol-extension
default. Making the banner a protocol requirement restores dispatch to the
screen's current banner. The list test also checks that protocol dispatch;
installed rendering is being rerun after the fix.

The native fixture optionally uses the real Supabase SDK for production Home
list, detail, IAM, dashboard and task reads against the owned replay database.
Authentication, application-shell services and unavailable property providers
remain controlled. Its modes mutate only the exact synthetic fixture. Scenario
history and evidence stay outside Git. These checks do not claim actual
onboarding, generic-member defaults, paid-provider behavior or production
session invalidation.

Private evidence and unsuccessful attempts, retained for diagnosis:

- `/private/tmp/pantopus-home-first-use-ios-build-r4.log`: app and test bundles
  compiled. The earlier r1–r3 compiler failures were fixed before this build.
- `/private/tmp/pantopus-home-list-first-use-ios-r1.xcresult`: installed rows
  showed separate role/ownership/residency chips; the journey failed on the
  missing banner. Attachments were exported beside the result. The subsequent
  runner restart is not a passing journey.
- `/private/tmp/pantopus-home-first-use-android-build-r7.log`: complete rebuild
  passed. The earlier incremental APK failed before sign-in with a missing
  generated Hilt injector; r1 crash evidence is retained. Rebuild attempts r5
  and r6 exposed formatting and import errors, subsequently corrected.
- `/private/tmp/pantopus-home-list-first-use-android-r2/`: installed app reached
  the controlled Place error shell; the driver omitted the existing back step
  before Profile navigation. The corrected driver is being rerun.
- `/private/tmp/pantopus-home-first-use-native-events-r1.json` and `-r2.json`:
  previous native fixtures stopped gracefully and cleaned up exact fixtures.
  The active r3 fixture preserves histories across scenario resets.

Before building, prior iOS and Android products were preserved with APFS
clones under `/private/tmp/pantopus-home-native-artifacts-before-h05/`. The
owner checkout, other worktree, databases, owner simulator and private evidence
remain preserved. No PR is ready to merge from this candidate.

Updated local checks (candidate still under installed acceptance): iOS focused
regression passed all 26 tests in 0.348 seconds
(`/private/tmp/pantopus-home-list-first-use-ios-unit-r1.xcresult`). Android full
JVM regression passed in 1m57s after correcting the scheduling test fixtures
(`/private/tmp/pantopus-home-first-use-android-regression-r2.log`). Earlier full
r1 failed five tests (each retried three times) because the old mocks did not
carry the new list contract. The installed Android r4 validated current and
owner-role-only list states; its header assertion did not scroll back into
view. r5 was interrupted when the owned emulator exited. The same AVD was
restarted without wiping user data; iOS installed r2 is now exercising the
banner fix. None of those interrupted runs is counted as a complete journey.

iOS installed r2 confirmed the banner, role-only shared dashboard, verified owner
without residency, minor effective role/no deletion menu and both distinct
verification routes. The route fixture does not serve the ownership-claims
session endpoint: the verification destination correctly remained unavailable
with document/submit controls disabled. This proves navigation and separation,
not a completed verification flow; H08/R01/R02 remain open. The r2 journey
stopped at the list-error assertion because the actual button is “Try again”
and the driver asked for “Retry”; r3 will use the observed label. The screenshots
and HTTP evidence are in `/private/tmp/pantopus-home-list-first-use-ios-r2-attachments/`.
Android full regression totals: 510 suites, 4,591 tests, zero failures/errors,
80 skipped (4,511 passed).

The full installed iOS unit regression also passes: 4,513 tests, 168 skips,
zero failures (4,345 passed), 47.347 seconds,
`/private/tmp/pantopus-home-list-first-use-ios-regression-r1.xcresult`.
All runs used the owned F9BBAB33 simulator. Android lint and ktlint are complete;
see `/private/tmp/pantopus-home-first-use-android-lint-r1.log` for the exact result.

Installed iOS r3 passes the complete bounded list journey in 220.823 seconds
(`/private/tmp/pantopus-home-list-first-use-ios-r3.xcresult`). Reviewed final
screens include separate identities, current denial after a held list reply,
unavailable/malformed Retry and private list → real Tasks. Its preserved HTTP
history has zero fixture errors. The Tasks empty screen's bottom floating action
is partly clipped on this simulator; the main Add a task control is visible.
That existing layout issue remains U01/U02, not an accepted full UI inventory.

Android r7 reached the applicant destination and exposed a real sample-identity
fallback (`412 Elm St`) after unavailable preview. The driver also incorrectly
expected a Compose tag that was not exposed in the device hierarchy. The
candidate now uses a neutral Home label, requires a current server claim session
and exact permitted preview before document selection, rejects held/foreign
previews, and shows unavailable Retry. Ownership instructions match the supported
manual document types and distinguish residency. The focused claim-context regression
passes (`/private/tmp/pantopus-home-first-use-android-claim-context-r1.log`);
the installed replay and updated screenshots are pending.

All current-head checks on pushed `b0097a41a` pass in
[run 34638384517](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34638384517).
The uncommitted native candidate needs its own pushed-head checks.
