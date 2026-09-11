# Home dashboard aggregate continuation — September 11, 2026

This continues PR #32 after native bill currency/history commit `983c93a919`.
It does not complete the Home branch, PR #34, or launch preparation. Paid
providers remain one final bundle; no hosted database or deployment was changed.

## Native intelligence validation — current candidate

Milestone `611032282` is pushed; [its CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34622136951)
passes every check. iOS
finished-denial r2 passes the complete recovery journey in 361.944 seconds,
21 bill reads, zero fixture errors. Its finished denial and restored
104.70/142.50 card are visually reviewed. Evidence:
`/private/tmp/pantopus-native-bill-ios-finished-denial-r2.{log,xcresult}` and
`-attachments/`. Exact SQL cleanup passes in `-fixture-r2.log`.

The next uncommitted candidate requires complete health dimensions/consistent
scores and Home action routes, explicit checklist fields, exact Home identity,
valid statuses/progress/unique rows, and valid property sources/numbers/ranges.
Missing data cannot become a successful zero or empty card. Checklist mutation
responses require matching Home/item/status and valid row metadata. Errors keep
Retry available; unknown committed replies require reload before another action.

Signed iOS intelligence build r3, strict lint r3 and changed-file format r3 pass.
Android build/quality/lint/affected models r3 passes; iOS affected model r1 passes
all 13 checks (1.033 seconds). Earlier Android r1 stopped
at three ReturnCount findings (split without weakening validation); r2 then found
one existing property fixture missing its real source field. The fixture now
supplies `source=cache`, and the final affected checks pass.

iOS installed r1 completed all ten malformed-card rejection/Retry recoveries
(420 recorded events, zero fixture errors, no PATCH) but **the suite failed**:
teardown attempted to screenshot the already-terminated app. The checklist receipt
case failed earlier because switching from freshly reset current mode changed the
actor's access revision: verified_at was initially null and access_end_at was
initially two days away. The app correctly retired access before PATCH; the
finished denial pixels and hierarchy confirm it. Reset now normalizes those fields
before any initial read; actual HTTP authority stays identical across all four
receipt fault modes and current. Teardown now records HTTP evidence even on failure
and only captures a running app. No production authority check was weakened.
Fixture r8's intermediate verified_at-only repair still failed equality because
access_end_at changed; retain that failed probe. r7/r8 exact SQL cleanup passes.

Android installed r1 completes all ten malformed-card rejection/Retry recoveries
and records `malformed-cards-fixture.json`, then fails before any PATCH: the
inherited form navigator times out before examining its last swipe's newly
visible HEPA control. Failure XML/pixels confirm a reachable enabled pending item,
zero PATCH and zero fixture errors. A bounded observed-viewport helper now checks
after each move; focused receipt r2 passes all four cases on owned 5556: one
PATCH each, real committed row, Retry and cold return show 1/2 done, zero fixture
errors. Error and completed pixels are reviewed. The earlier ten-card group has
459 recorded events, zero PATCH/errors. Evidence prefix:
`pantopus-home-intelligence-android-receipts-r2`. Android app is stopped; fixture
r9 completes exact SQL cleanup. iOS installed r2 is running on F9BBAB33 against repaired server fixture r10.
Existing native candidate app builds remain unchanged.
Private evidence prefixes: `pantopus-home-intelligence-ios-{project,build,format,lint}`,
`pantopus-home-intelligence-ios-installed-r1.{log,xcresult}` and `-attachments/`,
`pantopus-home-intelligence-ios-malformed-r1-fixture.json`,
`pantopus-home-intelligence-fixture-authority-baseline-r{1,2}.json`,
`pantopus-home-intelligence-fixture-authority-fixed-r3.json`,
`pantopus-home-intelligence-android-{format,build,installed}`, and
`/private/tmp/pantopus-home-intelligence-native-fixture-r9.{json,log}`.
Do not run another fixture with these SQL identities concurrently. Owner source/
devices stay untouched; no new migration, hosted change or paid activation.

Additional source finding for the next server follow-up: health scoreBills only
queries status `due` and ignores explicit `overdue` rows, including the current
fixture bill. Actual API/SQL baseline confirms one overdue row but 20/20 bill
points and no issue (`/private/tmp/pantopus-home-health-overdue-baseline-r1.json`).
A separate uncommitted server draft counts explicit overdue rows and rejects
missing/malformed dimension arrays/rows/document counts and Home coordinates.
Full backend r1 passes 316 suites but hits one notification test HTTP parse
error. The unchanged focused notification rerun passes all 18 checks; full
backend r2 passes 317 suites/5,169 checks. Preserve this transient failure without claiming a known
root cause. Actual SQL/HTTP/SDK r1 passes all cases and exact cleanup: explicit/multiple
overdue, paid restoration, past/future due dates; 20 malformed row-source cases,
four malformed counts, six missing/malformed/error/transport Home-coordinate
cases; each failure stays uncached and recovers through an ordinary read.
Actual Supabase SDK/PostgREST verifies dimension data, overdue and paid recovery.
Evidence: `/private/tmp/pantopus-home-health-data-http-r1.log`,
`pantopus-home-health-data-backend-r{1,2}.log`,
`pantopus-home-health-data-notification-regression-r2.log`, and
`pantopus-home-health-data-privacy-r1.log` (all privacy gates pass).
Existing summary/checklist/settings regression r1 and authority regression r1
also pass, including twelve held reads, actual SDK/PostgREST, current restoration
and exact cleanup. Private logs: `pantopus-home-health-summary-regression-r1.log`
and `pantopus-home-health-authority-regression-r1.log`. Native fixture r10 now
runs the repaired server for final iOS replay. Android overdue-score r1 passes
and its 35/100 pixels are reviewed (`pantopus-home-health-android-current-r1/`).
The known Android dashboard recovery expectation is updated from 45 to 35 in
the separate server candidate. No new app build is needed for that server value.

A final compatibility adjustment accepts cleared optional provider/avatar text
while still rejecting absent fields and wrong types; blank avatars do not earn
household-photo points. Its additional real SQL case remains pending until native
fixture cleanup. Full backend r3 hits an unchanged payment test socket hang-up;
preserve `/private/tmp/pantopus-home-health-data-backend-r3.log`. r2 passed before
this small addition. This is not evidence of a Home regression, nor proof the
transport failure is resolved. Android's 15 affected model checks and installed
acceptance are independent; its milestone can proceed while iOS/server candidates
finish. Do not include this draft in the native milestone
before its own verification. Due-date comparison still needs Home-local date
semantics; no timezone repair is claimed. Existing nested-row/checklist creation,
mutation, history and provider validation backlog remains. Do not treat native
wire rejection as proof of every server data calculation.

Next Home identity audit confirms the exact remaining sources: both native
ViewModels derive a Verified Home label from `detail.isOwner` or any verified
owner. The generic Home detail route returns wildcard Home/nested occupants after
only generic IAM access; property-details has the same generic gate. `/my-homes`
ignores owner-status query failures and omits access_start_at/access_end_at from
its occupancy projection; the older root list includes inactive occupancies.
These require actual SDK/SQL identity, current-access, applicant/private first-use
and native acceptance. The controlled Home-list/detail shell used above cannot
close them.

## Native account and stronger bill proof — September 11

Android account r1 passes real installed A → B → A navigation: three normal
sign-ins, two sign-outs, four current B denials, no B aggregate read, cold B
return and restored A summary. Zero fixture errors. The fully denied cold screen
and restored original-account summary are reviewed. Private evidence:
`/private/tmp/pantopus-home-dashboard-android-account-r1/` and matching log.

Android bill currency r2 passes all six format-2 reads, USD/CAD separation,
held CAD retirement, Back and 24-month history. Full oldest/latest monthly rows
and amounts are now reviewed within the viewport. Recovery r4 passes 21 reads,
real response-per-Retry, finished denial and restored 104.70/142.50. These supersede
the incomplete visual/harness attempts retained below. Private evidence:
`/private/tmp/pantopus-native-bill-android-authority-currency-r2/` and
`/private/tmp/pantopus-native-bill-android-authority-recovery-r4/` plus logs.

Signed iOS account build r3 succeeds after the pinned Sentry artifact recovery;
changed SwiftFormat/full strict SwiftLint r2 pass. Installed account/retirement
r1 passes both tests in 315.454 seconds. Account A was already signed in; two
normal additional sign-ins and two sign-outs exercise B denial, cold B return
and restored A. Four held production authority/health/checklist/property replies
cannot restore private data after foreground revocation. Zero fixture errors.
The denied screenshots are reviewed. The original-account capture shows current
aggregate bill data while ancillary cards are still loading; do not count it as
new finished-card visual proof. Private evidence:
`/private/tmp/pantopus-home-dashboard-ios-account-retirement-r1.{log,xcresult}`
and `-attachments/`, including both production event attachments.

Synthetic identity/login, Home-list/detail shell and provider responses remain
explicit limits; Home authority, services and SQL are production paths. Generic
verified-member home.view defaults and actual auth-provider/session revocation
are not closed. Finished iOS bill-denial recovery still needs replay. Both prior
bill-authority r1 and native account fixture r6 completed exact SQL cleanup.
Owned iOS F9BBAB33/Android 5556 remain booted with apps stopped; owner work/devices
remain untouched. Source, database, signed products and private evidence remain.

The server repair closes a reproduced gap: an actual frozen-Home probe
returned dashboard-access 403 but health/checklist/history/property 200. Evidence
is `/private/tmp/pantopus-home-intelligence-authority-baseline-r1.json`. Before/
after current SQL authority and no-store responses now gate those four reads;
missing season/history data no longer masquerades as success. Full backend
regression (317 suites/5,169 passes, existing 16 skips) and privacy gates pass.
Direct HTTP/SQL/SDK r1 now passes all four reads: current and cached health,
frozen/frozen-silent/archived/merged Homes, revoked/future/expired/unverified
membership, disputed/revoked ownership, explicit home/finance grants, SQL and
transport errors, and missing current season/history data. Twelve held SQL/provider
results reject frozen/revoked/changed authority. Actual SDK/PostgREST success,
frozen/revoked denial and restoration pass. Existing summary regression r1 also
passes checklist foreign-item/lost-reply/exact-repeat/revoked writes, history,
atomic settings, bill opt-in/out recovery, provider absence/error and stable first
checklist creation. Both fixtures complete exact SQL cleanup. Private logs:
`/private/tmp/pantopus-home-intelligence-authority-http-r1.log`,
`/private/tmp/pantopus-home-intelligence-summary-regression-r1.log`,
`/private/tmp/pantopus-home-intelligence-authority-backend-r1.log`, and
`/private/tmp/pantopus-home-intelligence-authority-privacy-r1.log`.
The native account/held-response journeys above ran against the earlier loaded
server, proving client retirement independently; the new server boundary has
separate direct HTTP/SQL proof. The strengthened iOS bill replay will use it.
This remains a bounded read repair; checklist creation/mutation receipts, nested
data, real identity/residency and the entire later backlog are still required.

## Android current-Home read milestone

The Android candidate now uses the same production current-authority envelope,
exact Home/permission agreement, captured account/session, and foreground/return
retirement as iOS. Explicit grants gate private cards and actions. Pending
residency and ownership have separate guidance, and an independently authorized
Tasks collection preserves private creator first use. Missing or malformed
aggregates cannot become successful empty Homes. Safe activity identity, local
calendar dates, wrapping checklist copy and truthful estimate/emergency states
match the iOS repairs. This does not finish deeper nested data or record writes.

Build r5 passes format/Detekt/compile/assemble. Validation r2 passes lint and the
20 affected dashboard/document checks. Snapshot/quality r2 passes all three Home
states plus ktlint and Detekt. Review of r1's two actual differences confirmed
only removed dead See all labels and the sample attention count 3 → 4; those two
baselines were updated, while the passing empty baseline was retained. The r1
report's six failures are retries of those two differences, not six distinct
screens. Private reviewed deltas and XML remain in
`/private/tmp/pantopus-home-dashboard-android-snapshot-review-r1/`.

Installed r1 could not reset SQL while Docker was unavailable; it is not app
acceptance. Installed r2 passed summary recovery, finance denial, both applicants
and revoked/frozen/denied states, then failed after the fixture's five-minute
sample event naturally left Upcoming. Its reset now seeds that event two hours
ahead, preserving the event assertion. Complete installed r3 passes: populated summaries, safe identity, all aggregate
failure/Retry cases, finance denial, both applicants, revoked/frozen/denied entry,
restoration, all three finished card recoveries, foreground revocation with a
produced held aggregate and the actual private creator Tasks destination. It
records 232 Home HTTP requests and zero fixture errors. Reviewed pixels confirm
readable safe identity, finished health/checklist/property recovery, distinct
applicant guidance, retired private content and reachable Add a task. Screen review also found the
five-tile Documents label split mid-word; the candidate now says Docs. Final build r6 passes ktlint/Detekt/assemble/lint (8m 9s) and is installed.
Focused retirement r1 passes all four produced held authority, health, checklist
and property responses, current denial and restoration; no fixture errors. The
Docs shortcut is reviewed and readable. Both Android bill compatibility replays
remain the next regression step; currency/history r1 is currently running.

Private proof prefixes under `/private/tmp/`:
`pantopus-home-dashboard-android-build-r5`,
`pantopus-home-dashboard-android-validation-r2`,
`pantopus-home-dashboard-android-snapshots-quality-r2`, and
`pantopus-home-dashboard-android-installed-r3/`,
`pantopus-home-dashboard-android-build-r6.log`, and
`pantopus-home-dashboard-android-retirement-r1/`. Native dashboard fixtures r4/r5
completed exact SQL cleanup and are stopped. Bill-authority fixture r1 now owns
loopback 18083 and the isolated SQL fixture. Owned Android emulator-5556 is running; owned iOS F9BBAB33 stays off.

Capacity/recovery evidence: Android validation r1 failed with No space left on
device, and two owned emulator launches failed for capacity. Only inspected
owned generated Xcode intermediates/module/index caches, Android intermediates/
tmp/Kotlin outputs and Sentry extraction/dependency caches were removed. Source
checkouts, signed products/APK outputs, test evidence, databases and owner work
remain. The next iOS build must resolve its Sentry package artifact again. Disk
later reported about 41 GiB free; the entire increase is not attributed to one
cleanup. Docker Desktop stayed stuck after capacity recovery. Its bounded CLI
restarts failed; only identified stuck Docker/owned diagnostic processes were
stopped, then Desktop start succeeded. Docker 29.1.3, the owned Gig database and
SQL reset are healthy again. No volume, database or owner emulator was deleted.
See private `pantopus-docker-recovery-after-disk-*` and build/validation logs.

Fresh origin/PR verification: iOS `661e5fea1` passes every required check in
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34610436649).
The only open PRs are unfinished drafts #32 and #34; #34 is still conflicted at
`e9ef2decb`; its required checks pass (Seeder is skipped). Green checks do not
complete its scope or reconcile the conflict/migrations. Owner checkout retains
only its recorded handoff edit and two design
artifacts; the paid-gig worktree is clean. No new migration or paid/hosted action.

Additional confirmed follow-up: direct health/checklist/property HTTP handlers
still use the general IAM check without the dashboard's SQL Home-state boundary
or final authority comparison. Native UI guards do not close that server scope.
Reconcile these routes alongside malformed nested intelligence and checklist
mutation receipts; retain actual account-switch UI, real Home identity, residency,
all other Home/Place/Pulse/Beacon/account/payment/release work and the 47-version
migration dependency/replay work. Paid providers remain one final launch bundle.

## Android bill replay and account follow-up — ongoing

Android read milestone `6a2a1d38049d75e86e09ddfd4e0c88ce0ae42751` is committed
and pushed. Every required check passes in [CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34616978020).
Bill-authority currency r1 passes six format-2 reads, USD/CAD separation, held
CAD retirement, 24-month amounts/order and Back. Pixel review found its latest
monthly row only 19 pixels high at the viewport edge, although the original
visibility predicate passed. This is not full latest-row visual proof. The
script now scrolls the target into the unobscured viewport; full currency r2 is
still required. Private evidence remains at
`/private/tmp/pantopus-native-bill-android-authority-currency-r1/`.

Bill-authority recovery r1 passed through legacy-format recovery, then its
one-way scroll missed the wrong-currency error heading above the viewport.
A single reverse gesture and focused capture confirmed the existing rejected
currency state was reachable; no app repair was needed for that observation.
The driver now reverses at an observed scroll boundary without weakening the
content assertions. Recovery r2 timed out before login while Activity Manager
showed app=null/INITIALIZING, no app PID and only a splash window. The crash log
was empty. A force-stop and clean relaunch succeeded (cold startup report 1,870
ms); the underlying cause is not established. Recovery r3 is currently running.
Retain r1/r2 logs, r1-followup screenshot and r2 startup diagnostics outside Git.
Failure capture now attempts to preserve fixture state before UI evidence.

Recovery r3 also exposed a clipped Retry control: the coordinate tap produced
no new bill HTTP request. A focused follow-up moved Retry fully into view and
confirmed both a new response and restored 104.70/142.50 values. The full r4
now checks a real new response for each Retry and searches for finished content
after layout changes. Full r4 now passes, recording 21 format-2 USD reads. Finished denial and
restored current-comparison screens are reviewed; currency r2 is now running
with the stronger full-row visibility condition. Preserve
r3 failure state/screens and `recovery-r3-followup/` alongside earlier evidence.

Matching iOS account-switch and four held-intelligence/authority tests are now
uncommitted candidates. Bill denial now positively waits for completed unavailable
estimate copy. Changed-file SwiftFormat r2 and full strict SwiftLint r2 pass;
lint r1 required moving helper methods out of the oversized test class. Build
r1 failed because the previously cleaned Sentry artifact was absent. The exact
pinned 8.58.4 archive was downloaded and SHA-256 verified. An initial Python
extraction lost its framework symlinks, so build r2 failed signature validation;
that generated artifact alone was replaced by a ditto extraction. All 12 internal
links and the framework's deep strict signature now verify. Build r3 is running;
no iOS UI acceptance of these new cases is claimed yet. No Sentry activation,
DSN, package-version change or paid service was introduced.

The next uncommitted fixture supports two explicitly synthetic identities and
per-account production Home authority/HTTP evidence. The second verified member
has an explicit home.view denial; this does not resolve generic role defaults.
The prepared Android account driver uses actual logout/login, cold second-account
return and original-account restoration. Its source parses, but it has not run.
The active bill fixture is unchanged; do not start a second fixture over its SQL.
After both bill replays, clean the bill fixture exactly, then run the account
journey before publishing this follow-up. iOS actual account/held-intelligence
acceptance, server/nested-contract gaps and the full backlog remain. No new paid
service, migration or hosted action.

## Current native authority checkpoint

`GET /api/homes/:id/dashboard-access` now provides a minimal no-store current
permission envelope and an opaque revision. Shared access uses the same production
IAM and SQL context as the aggregate, including frozen/archived Homes and disputed
ownership. The general navigation `/me` alone did not fence these states. Denied
responses expose no Home header, member data or permissions. Only a current own
pending occupancy can expose ownership/residency verification guidance; expired,
future, revoked and blocked contexts do not receive those controls. This response
is a read check, not a mutation capability or a globally atomic snapshot.

Production HTTP/SQL authority r1 passes current/changed grants, all membership
windows, frozen/frozen-silent/archived/merged Homes, disputed/revoked owners, both
applicant kinds and invalid/malformed/query/transport failures. Three held SQL
responses cannot restore obsolete authority or applicant controls. Actual
Supabase SDK/PostgREST success, frozen denial and both applicant envelopes pass.
Exact SQL cleanup passes. Full backend regression passes 317 suites / 5,169 checks
with the existing one suite / 16 skips. Private proof is
`/private/tmp/pantopus-home-dashboard-authority-http-r1.log` and
`/private/tmp/pantopus-home-dashboard-native-authority-backend-r1.log`.

The populated web milestone is pushed as `b926f74e2`; every required check on
[its CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34602544932)
passes. The predecessor `9d603c68c` run was cancelled by that push while Android
was running; its downstream CI OK failure is not a completed pass. Both feature
PRs remain unfinished drafts; #34 still conflicts. No migration or paid/hosted
change; combined 47-version dependency/replay work remains.

## iOS current-Home read milestone

The native Home now requires the production authority envelope before detail and
aggregate reads, validates their Home identities and permission agreement, and
rechecks authority before publication. There is no public-profile fallback or
successful zero summary for a missing/malformed aggregate. Explicit grants gate
cards, summary sections and actions. Own pending residency and ownership contexts
have different entry copy; a non-owner is not automatically offered ownership.
An exact independently authorized task collection preserves private creator
first use. These read checks do not substitute for record mutation capabilities.

Suspension/disappearance clears private summaries, cards, permissions and pending
controls. Foreground/return rereads authority; generation and captured account/
session checks retire earlier responses. Each intelligence card checks current
authority before and after its read. Ordinary service failure offers Retry;
unexpected denial or changed/unreadable authority retires the shared Home.
Checklist editing requires home.edit and confirms returned item/status; returned
Home identity and the broader mutation/recovery matrix remain next work.

Aggregate decoding requires the actual counts/today/roster/activity structure and
rejects negative counts. Safe display identity is preferred; date-only values
retain the local calendar day. Missing emergency data is unconfirmed rather than
silently unconfigured. Empty lists no longer claim everything is clear; dead
See all labels are removed. Checklist titles/descriptions wrap, unavailable
property estimates no longer promise verification will provide a value, and the
sample attention total matches its four listed items.

Verification:

- Signed iOS build r8 passes. Changed-file SwiftFormat r8 and full SwiftLint r8
  pass. Final affected model/API/auth step-up r3 passes 33 checks, including 401,
  opt-in typed 403 versus normal denial, and password step-up/retry/header behavior.
- Installed dashboard r3 passes all three journeys: populated real SQL summaries,
  safe identity, summary outage/malformed/wrong-Home recovery, explicit finance
  denial, both applicants, revoked/frozen/denied Home entry, restoration, foreground
  revocation, an already-produced obsolete aggregate, card Retry and private Tasks.
- Screen review found r3's card Retry predicate could pass while loading. Focused
  installed r4 now positively waits for a health score, an actual checklist item
  and completed unavailable-estimate copy. It passes all three recoveries plus
  private creator entry and the actual Tasks destination. Its evidence records
  71 production Home reads/responses, zero fixture errors. Final pixels reviewed.
- The bill fixture now uses production dashboard-access, aggregate and task reads.
  Both installed bill-authority r1 journeys pass (546.5 seconds): USD/CAD separation,
  matching monthly totals, held CAD retirement, 24-month cold history, reachable
  latest month/Back, comparison opt-out/unmatched, malformed/legacy/wrong-currency/
  service failure and retry, confirmed empty, denial and restoration. Recovery
  evidence records 21 format-2 USD reads. Final restored amounts and history pixels
  are reviewed. Its denial capture is still a loading skeleton; it is not finished
  visual denial proof. Dashboard r3 separately positively confirms loaded finance
  denial. Strengthen that bill-specific capture on its next native replay.
- Native dashboard r3 and bill-authority r1 exact SQL cleanup pass. Both listeners
  are stopped and owned iOS F9BBAB33 is shut down. Owner devices are untouched.

Initial failures are retained: installed r1 skipped due to a missing opt-in in the
v1 xctestrun; r2 exposed accessibility-container identifiers overriding Retry and
limited-entry child controls. Explicit containment repaired them before full r3.
Early builds exposed a missing limited-state switch and lint/format findings;
final r8 passes. Model/auth r1 had one bad reused URLProtocol route; r2 was stopped
because the replacement test invoked a real interactive shared-auth step-up
prompt. Final r3 uses isolated auth/password-prompt fixtures and passes. None of
those initial runs counts as completed acceptance.

Private proof: `/private/tmp/pantopus-home-dashboard-ios-installed-{r3,r4}.xcresult`,
matching attachment directories, `pantopus-home-dashboard-ios-lifecycle-{build,
format,lint}-r8.log`, `pantopus-home-dashboard-ios-model-auth-r3.{log,xcresult}`,
`/private/tmp/pantopus-native-bill-ios-authority-r1.{log,xcresult}` and attachments,
`pantopus-native-home-dashboard-ui-fixture-r3.{log,json}` and
`pantopus-native-bill-ui-authority-fixture-r1.{log,json}` under `/private/tmp/`.
Generated iOS intermediates/module cache/index were removed after test completion
to recover space; signed products, sources, logs, results and SQL remain.

Limits and next work: login, Home list/detail shell and unrelated provider replies
are controlled fixtures; production IAM/aggregate/tasks/intelligence use owned SQL.
Actual account-switch UI, held intelligence/authority replies, network timeout,
broader malformed nested data, generic-member role defaults, real Home detail and
Verified header identity, full residency submission/review/recovery, record writes,
small screens/Dynamic Type, physical devices and providers remain unfinished.
Android now has an uncommitted current-access/lifecycle/strict-aggregate/UI candidate;
quality/build/installed proof remain. Preserve the full Home/Place/Pulse/Beacon/
account/payment/release backlog below and the final paid-service bundle.

Backend `1341aea5e` now passes every required check in
[its CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34606114320).
The next iOS commit requires independent checks. No migration or hosted change;
#32/#34 stay unfinished drafts, #34 conflicted, and 47-version combined replay/
dependencies remain unreconciled.

## Populated browser and standalone list milestone

The browser now uses the aggregate's actual counts/today contract and reads
full task/issue/bill/package/document/event collections only with their explicit
view grants. The fictional aggregate arrays and permissive fallback are removed.
A failed aggregate performs no fallback collection reads. Required SQL failures,
missing arrays and wrong Home identities remain unavailable; optional card
failures have explicit Retry states. Refresh rechecks current access and totals.
Invitation refresh uses the safe current roster rather than reintroducing legal
names or counting pending invitations as members.

Actual populated UI exposed and repaired these functional defects:

- Stored tasks/events and outstanding counts were absent from the overview.
- Bills show their own major-unit currency and two decimal places. The overview
  counts bills due without adding USD to CAD. Calendar-only due dates keep the
  saved day in America/Los_Angeles; a bill due today is not prematurely overdue.
  Finance viewers lack Add Bill/Mark Paid controls. No bills due does not claim
  every historical bill was paid; rendering does not sort shared state in place.
- Today issue/package shortcuts now open Maintenance/Deliveries. Maintenance's
  default Active list includes open, in-progress and scheduled records; previously
  open/in-progress issues had no list. Preview cards support Enter/Space and focus.
- Future packages are pending rather than arriving, and vendor names render.
  The property preview no longer claims an ATTOM source without evidence.
  Document/package/calendar/expanded-card visibility uses current explicit grants.

Issue/package GETs now validate filters and rows, enforce current permissions and
visibility, send no-store, and recheck authority after reading. Owner pointers
cannot bypass a resource denial. Explicit standalone resource grants remain
usable without inventing a parent home.view grant. Writes/media/receipts are
separate unfinished scope.

HTTP/SQL **r7 passes**, including both list endpoints, valid/invalid/duplicate
filters, SQL/transport/malformed/cross-Home failures, visibility, denied reads,
two held replies after revocation and real SDK/PostgREST list filters, plus the
prior aggregate matrix. Chrome **r6 passes all 13 journey groups**, zero page
errors/mutations and exact cleanup. Core records and pets use production HTTP/
services/SQL; seven denied view sections issue no forbidden collection requests.
The previous account/access/lifecycle/applicant/held-reply matrix also passes.
Final overview, active maintenance and fractional-currency/date screens were
reviewed. Identity, ancillary/provider responses and deterministic lifecycle
signals remain synthetic; this is not complete write or native acceptance.

A policy finding remains: the owned baseline allows a verified generic member
to lack home.view. Browser r1's approved-member restoration used the old fallback
after aggregate denial; it was not proof of correct admission. Current acceptance
keeps that Home denied, then applies an explicit grant and verifies restoration
without owner controls. Reconcile role presets/defaults with actual residency
and invitation onboarding. No inferred grant or fallback bypass was introduced.

Full backend regression passes 317 suites / 5,169 checks (existing one suite /
16 skips). Final web regression r3 passes 92 suites / 1,178; final typecheck r3 passes,
affected lint r2 reports zero errors / 104 warnings across the wider edited set,
and all five identity/privacy gates pass. No migration or hosted/provider change.

Private proof: `/private/tmp/pantopus-home-dashboard-http-r7.log`,
`/private/tmp/pantopus-home-dashboard-production-web-r6/`, and
`/private/tmp/pantopus-home-dashboard-web-contract-{backend-r1,regression-r3,types-r3,lint-r2}.log`.
Browser r3/r4 failed ambiguous selectors after accessible cards were introduced;
r5 exposed the real missing active-maintenance destination. Final r6 passes after
repair. Web regression's old aggregate fixture was corrected to the real contract
without weakening denied-permission assertions. Earlier evidence below remains
historical; its web fallback and standalone GET findings are superseded here.

Next: native strict aggregate decoding, safe identity, current access, foreground/
return/account/held-reply retirement and proper applicant/private-first-use entry.
Native default DTOs still hide missing aggregates, core/intelligence reads remain
unscoped, and public-profile fallback is not shared Home authority. Claim ownership
must not be offered to every non-owner. Existing verification/waiting-room readers
also discard the 403 verification body and need actual residency review.

Other reachable findings remain: embedded issue/bill/package handlers discard
media and some write errors only log; standalone bill units/package states differ;
document sharing, Share Center, member/security and provider-list errors need
acceptance. Keep pets' missing-table fallback, mailbox privacy, guest redemption/
limits, Home-day timezone boundaries, pagination, narrow member/chat overlap and
property verification wording open. Native identity drafts remain uncommitted
without installed proof. Full Home/Place/Pulse/Beacon/account/payment/release
priorities, combined migrations and the final paid-provider bundle remain.

## Production contract repaired

`GET /api/homes/:id/dashboard` now delegates to `homeDashboardService`, validates
the Home id, sends `private, no-store`, and distinguishes confirmed empty data
from unavailable reads. SQL errors, rejected transport, missing/malformed counts
or lists, failed owner enrichment, deletion eligibility and requested health
failures cannot produce a successful zero/all-clear summary. The route returns
safe errors without SQL contents.

Current effective IAM and the existing SQL `home_record_context` must both
admit shared Home access. The SQL context also fences frozen/archived Homes and
disputed/revoked ownership pointers. The service checks current authority again
before publishing, comparing permissions, role, owner status and occupancy
identity/verification/access dates. A changed grant retires the batch with 503;
current Home denial returns 403. This is checked aggregation across reads, not
a new single-transaction data snapshot or a session-revocation mechanism.
Native foreground/account retirement still needs its own implementation.

Each resource uses its explicit permission: members, tasks, calendar, finance,
mailbox, packages, maintenance, documents, guest management and audit access.
Manager/sensitive visibility applies to document, issue and package counts.
Denied resource tables are not queried; their legacy numeric/list slots are
zero/empty alongside the current permission bag. Owner/manage flags cannot
restore a denied view grant. Pets retain the existing Home-view contract.

The actual database exposed several previously hidden source mismatches:

- There is no `HomeMail` table. Unread badges now query `Mail` with current
  verified mailbox authority, verification-age policy, Home identity, unread/
  unarchived state, expiration and addressee/privacy filters. Another person's
  personal or attention-only mail, limited-access envelopes, shredded mail,
  business mail and expired mail do not enter the count. No content is opened.
- Packages use `expected` and `out_for_delivery`; `ordered`/`shipped` were not
  valid HomePackage statuses. Expected totals and deliveries arriving today
  are now distinct. Overdue bills and scheduled maintenance remain outstanding.
- A future guest pass is not window-current. Pending, future, ended and
  unknown-role occupancy rows are not active household members.
- The Home header uses the established Home list projection, excluding entry
  instructions and Wi-Fi file references. Its deletion advisory remains the
  existing guarded eligibility RPC. The unchanged geography decoder is shared
  with the original Home routes; real zero coordinates remain valid.
- Member identities use the existing safe selection/serializer rather than
  forwarding raw legal names. Browser member rows/details consume the public
  identity fields and retain fallback for older endpoint responses. Native
  reader changes are a separate, still-unverified working draft at this point.

## Actual verification

Private operator evidence stays outside Git. Sources of the repeatable journeys
are `scripts/db/test-home-dashboard-http.cjs` and the upgraded
`scripts/web/test-home-dashboard-access.cjs`.

- HTTP/SQL r5 passes the full owned database journey. Final r6 additionally
  passes through the actual Supabase SDK/PostgREST transport, including nested
  identity serialization, compound Mail/package/date filters, fractional bills,
  geography, denied finance, a frozen Home and successful restoration.
- Populated records include real tasks, calendar, bills, maintenance, documents,
  packages, pets, guest passes, occupancy windows, audit and private Mail variants.
  The fixture checks every queried dependency's database/transport failure,
  malformed counts/lists, Home/enrichment/health failure and recovery.
- Five held, already-produced SQL replies are released after actual changes
  to finance permission, membership, expiry, Home freeze or disputed ownership.
  The old batch is withheld and each fresh recovery succeeds. Pending applicants
  do not receive the shared aggregate. Exact fixture cleanup passes after every
  run, including failed setup attempts.
- Chrome production-aggregate r1 passes member identity rendering, open-panel
  revocation, held aggregate/authority replies, account-marker retirement,
  changed permissions, background/return, authority and claim-list outages,
  pending-residency routing, timeline retirement, narrow layout and keyboard
  reload. Zero page errors and mutations. Wide/narrow screenshots were reviewed.
  Identity, ancillary/fallback endpoints and lifecycle events remain synthetic;
  the aggregate and IAM use production HTTP/helpers/services and real SQL.
- Full backend regression: 317 suites / 5,169 checks pass; the existing one
  suite / 16 skips remain. Full web regression: 92 suites / 1,178 pass. Final web
  typecheck passes; affected lint has zero errors and eight existing warnings.
  Privacy gates pass without extending an allowlist or disabling a gate.

Private evidence: `/private/tmp/pantopus-home-dashboard-http-r6.log`,
`/private/tmp/pantopus-home-dashboard-production-web-r1/`,
`/private/tmp/pantopus-home-dashboard-backend-r1.log`,
`/private/tmp/pantopus-home-dashboard-web-regression-r1.log`,
`/private/tmp/pantopus-home-dashboard-web-types-r3.log`,
`/private/tmp/pantopus-home-dashboard-web-lint-r1.log`, and
`/private/tmp/pantopus-home-dashboard-privacy-r2.log`.

Initial failures are retained: r1's invented Wi-Fi File reference violated its
FK; r2/r3's inconsistent Mail target fixtures violated real constraints. Those
fixtures were corrected without changing constraints. Populated r4 then exposed
an incorrect geography-helper import in the service; the shared existing decoder
fix passes complete r5/r6. Privacy r1 rejected the moved raw-name join; the safe
identity projection passes r2. Web types initially caught an identity-field
change applied to a still-legacy pending-invite type; that unrelated expression
was restored and final typecheck passes.

## Remaining findings and next action

The live browser connection exposed a client contract gap: `useHomeData`
expects entity arrays the aggregate never returned, so a populated overview
can appear empty. Its aggregate failure fallback also tolerates individual read
failures. Repair those states, totals, permission gates and recovery next, using
actual populated production responses. Do not treat the old fallback acceptance
as proof that unavailable data is displayed honestly. Review native equivalents
before claiming whole-dashboard acceptance. Mixed-currency overview totals must
not sum unlike currencies.

Continue native current-access/lifecycle/account/held-read retirement and safe
identity readers, preserving exact private-creator task first use and the correct
ownership/residency applicant entry. Fix captured checklist truncation and
unsupported property-estimate copy. Browser review also retains narrow member
label/badge and floating-chat overlap, plus the verified-member screen's separate
unverified-property label, for the UI pass.

Standalone issue/package routes still need their own explicit permissions,
visibility and mutation review; this aggregate repair does not fix them. Pets'
missing-table fallback, mailbox routes' independent privacy/error behavior, guest
link view-limit/redeemability, Home-timezone day boundaries and large household
pagination remain resource/workflow checks. Current dashboard guest counts mean
unrevoked passes within their time window, not guaranteed link redemption.

The remaining Home/Place/residency/ownership/leases/resources/settings, Pulse/
Beacon, account/vendor and payment/release backlog stays in PROJECT_HANDOFF.
There is no new migration: 38 Home / 21 payment / 47 combined source versions;
combined dependency and replay reconciliation is still a merge gate.

## Remote CI and native draft

All iOS jobs and Android instrumentation on `983c93a919` passed. Android's
lint/test/assemble job failed on the three HomeDashboard Paparazzi images (each
retried), after the intentional Create-footer change; 4,597 checks ran, nine
retry failures and 80 skips. All three differences were reproduced locally and visually reviewed: the last
viewport rows now scroll above the reserved Create footer instead of lying under
the floating action button. No other pixels changed. Only these three images
were copied from the reviewed renderer output to their baselines. Targeted r2
passes all three; quality, main compilation and test compilation passed in r1.
The failed run was not waived. Private original images, current images, deltas
and failure XML are under `/private/tmp/pantopus-home-dashboard-android-snapshot-r1/`;
final verification is `/private/tmp/pantopus-home-dashboard-android-snapshot-verify-r2.log`.
The old sample attention text says three items while listing four; retain that
existing sample/presentation mismatch for the native UI pass, independently of
this footer-only pixel repair.

Backend/browser milestone is pushed as `60228da3d`. Its newly running CI must be
checked independently; the baseline follow-up will also need its own checks.
Native safe-identity DTO/projection changes remain an uncommitted working draft.
iOS formatting passes; Android's initial formatter found a long new expression,
which was wrapped and passes final quality/compilation. No new native installed
acceptance or whole-Home lifecycle completion is claimed.
