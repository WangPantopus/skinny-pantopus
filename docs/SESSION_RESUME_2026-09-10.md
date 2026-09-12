# Fresh-session continuation checkpoint — September 10, 2026

### Invitation decision backend accepted; protected client recovery next

The [ordinary invitation decision protocol](home-invitation-decision-recovery-2026-09-12.md)
adds account/session-bound context and immutable submit/read/cancel receipts.
Actual HTTP/SDK/SQL passes lost replies, historical replay after access removal,
wrong account/session, changed terms, failed reads, receipt rollback, concurrent
accept/decline/cancel, viewer-only open-link decline and history after Home
deletion. Current Home access remains separate. No client uses this contract yet.

Backend regression: **5,170 passed / 16 skipped**, privacy gates pass. Populated
upgrade preserves every value in **366 tables**, with zero function lint issues;
rehearsal DDL rolls back. All three owned harness runs are cleaned, restoring
complete role rows, full ledger and exact schema/function provenance. New source
migration `20260912020000` is additive; no permanent adoption occurred.

**Continue now:** browser protected original decisions, then native resolver/
decision recovery, complete invitation delivery and ordinary-member onboarding;
then legacy compatibility and the full backlog. H07/H08 remain partial, with
**7 of 80 rows closed and 73 partial/open**. Notification delivery is still a
separate best-effort boundary; the command proves the saved decision only.

Browser predecessor `2da002ae8fd17cd7bb175843c80f0a37c12c920e` has every job passing in
[CI 34710572692](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34710572692).
Backend source milestone `30958f8420cf0b50e66cae8ea950bbe5e0a41afb` is committed
and ready to push with this checkpoint; verify that new head independently.
The protected browser candidate is uncommitted and is undergoing final actual
UI/storage/HTTP acceptance. Private-first-use `ff4c82609` is fully green. #32 remains a draft, #34 an unfinished conflicting draft. No merge.
Migrations now total **44 Home / 21 paid / 53 combined**, with 12 identical shared
versions and zero collisions; combined replay/adoption remains open. Paid services
remain one final launch bundle. iPhone remains 1.0.0 (2), with owner work/data/
devices and private evidence preserved.

### Browser invitation recovery accepted; full decision recovery next

The [browser invitation milestone](home-browser-invitation-recovery-2026-09-12.md)
passes real Chrome/HTTP/SDK/SQL unavailable and malformed preview retry,
nullable legacy metadata, missing/revoked/expired states, failed decline,
wrong-recipient denial, lost acceptance reply, future-dated access and retirement
of a held old preview. Success describes saved acceptance and offers My Homes;
there is no unconditional dashboard redirect or full-access promise. Session and
visibility changes retire stale reads, confirmations and result displays.

Final browser r3 and narrow visual review pass. Web regression is **1,193 passed**;
final types/style and privacy gates pass. All three owned fixtures are cleaned
with complete role rows, full ledger and exact function provenance preserved.
No native build/device update or new migration. iPhone remains 1.0.0 (2).

**Continue now:** full account-bound invitation decision recovery, current access,
both native resolvers/failed declines and truthful invitation delivery; then
ordinary-member onboarding, legacy submission compatibility and the full backlog.
This bounded milestone does not close H07/H08: **7 of 80 rows closed; 73 partial
or open**. These counts do not measure app completion or remaining effort.

Predecessor `ff4c82609e37203031df32daa3a3a9378723b2d3` has every job passing in
[CI 34708716883](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34708716883).
Browser milestone `9a10a7dd47329300faa26f40fa4e248fb73ea8d7` is committed and ready to
push with this checkpoint; verify the pushed head independently. An additive
invitation command migration is an uncommitted candidate, with transactional
syntax/rollback preservation checked; it is not accepted or permanently installed.
#32 remains a mergeable draft; #34 a conflicting draft. No merge. Migrations
remain 43 Home / 21 paid / 52 combined, 12 identical shared, zero collisions;
combined replay/adoption remains open. Paid services remain one final launch
bundle. Owner work, devices/data and all private evidence remain preserved.

### Private Home first use accepted; invitations next

The [private first-use repair](home-private-first-use-2026-09-12.md) connects
browser/iOS/Android private Home status to ordinary selected-address submission.
Native lists keep My tasks and add Check status. No-request status offers the
joining wizard before mail; ownership remains separate. Native status/postal
routes keep the selected Home immutable through address editing and submission.
Wrong existing and unknown apartments cannot continue; correction preserves the
fields. The iOS unit label no longer crowds the adjacent City field.

Actual browser final r3 and installed native journeys pass production HTTP/SDK/
SQL status failure/retry, wrong-apartment correction, explicit submission, lost
reply, restart and acknowledgement. Each creates one pending request/occupancy,
with no duplicate Home, verified occupant or postcard request. Android's
confirmation-label driver continuation is documented; production and fixture
sources are unchanged. Its encrypted creation/joining slot is empty after native
acknowledgement. Final iOS r3 passes in 137.285 seconds with source/production
image binding; final iOS regression is **4,379 passed / 168 skips / zero failures**.
Browser regression is **1,193 passed**. Android final regression passes 515
suites per variant: **4,545 passed / 80 skips / zero failures** in both Debug and
Release. Types, source style, Detekt, full Lint, privacy, Debug/Release signing
and installed binary bindings pass. Completed fixtures
preserve full ledger rows/columns and exact function definitions/properties;
all six are cleaned. Both owned native runtimes are stopped with userdata and
accepted products retained. The physical iPhone remains 1.0.0 (2).

**Continue now:** invitations and ordinary-member first use, then legacy
submission compatibility and the full backlog. Native invitation previews turn
temporary failures into expired/used messages, and decline screens currently
ignore failed responses. Reproduce and fix those recoveries, account binding,
current access after acceptance and truthful delivery. Home invitation scope
must preserve the separate business-seat and guest-pass flows. H07/H08/R02 and
broader R03–R06 remain partial/open; **7 of 80 inventory rows are closed and 73
remain**. These counts do not measure whole-app completion or remaining effort.

Predecessor `40773d491c9d3c2dedec3341517d9ecdeee0a0d2` has every check passing in
[CI 34706049139](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34706049139).
Verify this milestone's pushed-head CI independently. #32 remains a mergeable
draft; #34 remains a conflicting draft with passing checks at
`e9ef2decbb7ec435589bb3b92639041cfc4618a6`. No new migration: 43 Home / 21 paid /
52 combined, 12 identical shared versions, zero timestamp collisions. Combined
replay/adoption remains open. No merge, hosted release, physical-device update or
paid activation. Paid services remain one final launch bundle. Owner work/data/
devices and private evidence are preserved.

### iOS joining and personal status — accepted locally; Android next

The [iOS milestone](home-ios-residency-recovery-2026-09-12.md) passes actual installed
UI/HTTP/SDK/SQL original-request recovery, cancellation, changed apartments,
rejected resubmission, personal history beyond 50 rows, failed/malformed reads
and retry, later removal and held-reply retirement. It also repairs the existing
Home modal's controls and truthful membership wording. Signed build, style,
privacy and all three installed creation regressions pass. Full iOS regression:
4,372 passed / 168 skipped; the report records its controlled-backend dependency.
All three exact fixtures are cleaned; final r8 products and private evidence are
preserved. The physical iPhone remains verified Pantopus 1.0.0 (2).

**Continue now:** finish the existing uncommitted Android joining/personal-status
candidate and installed acceptance, then both native postal/prepared-review flows.
H08 also needs a private-Home verification entry: ordinary users without a claim
must confirm a selected-address request before mail; ownership is separate.
Finish invitations/private first use, legacy compatibility and the full backlog.
H07/H08/R01/R02 remain partial; 6 of 80 inventory rows are closed and 74 remain.
That count is not a percentage of the whole app or remaining engineering effort.

Predecessor `022e3c086b60` has all checks passing in
[CI run 34683643763](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34683643763).
iOS milestone `a528c54a1060` also has every check passing in
[CI run 34687192433](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34687192433).
Android joining/status remains an uncommitted candidate. PR #32 remains a draft;
#34 remains a conflicting draft. No new migration: 43 Home / 21 paid / 52 combined,
12 identical shared migrations, no timestamp collision. Combined replay/adoption
remains open. No merge, hosted release, device update or paid activation. Paid
services and postal keys stay one final launch bundle; owner work/data/devices
and private evidence are preserved.

### Browser postal recovery — accepted locally; native joining/status next

The [browser postal milestone](home-browser-postcard-recovery-2026-09-12.md)
passes actual Chrome/HTTP/SDK/SQL initial-read recovery, explicit apartment binding,
original mailing resume, missing-key recovery, unknown delivery without resend,
code cancellation, lost wrong/success replies and protected proof-write repair.
Postal proof remains separate from household review and current Home access;
removed access and retired replies cannot restore navigation. Browser diagnostics
exclude Home requests/responses and codes. Narrow layouts were visually reviewed.

**Continue now:** native existing-Home submission and personal residency status,
then native postal/prepared review, invitations/private first use and the full
backlog. H07/H08/R02 remain partial; 74 inventory entries remain. Legacy mutation
compatibility and provider/device delivery still require acceptance. Paid services
and dedicated postal code keys stay one final launch bundle.

Browser regression: 93 suites / 1,193 passed. Final types, changed-surface lint and
privacy pass; full web lint has zero errors and existing warnings. All owned
fixtures/temporary schema are cleaned with exact review-definition/properties
restoration and unchanged ledger. Source migrations remain 43 Home / 21 paid /
52 combined with no timestamp collision; combined replay/adoption remains open.
Backend predecessor `d88c9efcc` has completed backend/database/web, iOS lint/build
and Android instrumented CI jobs passing in
[run 34682745853](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34682745853);
iPhone execution and Android lint/test/assembly remain unfinished at this checkpoint.
Verify the browser milestone's own pushed-head checks. #32/#34 remain drafts;
#34 conflicts. No merge, hosted release, paid activation or device change. iPhone
stays verified Pantopus 1.0.0 (2). Owner work, data/devices and artifacts are preserved.

### Personal residency status — accepted milestone; mail verification next

The [personal progress milestone](home-personal-residency-progress-2026-09-11.md)
passes actual Chrome/HTTP/SDK/SQL distinct submitted identities, household review,
rejected resubmission, failed/malformed reads and retry, current approval followed
by removal/freeze, retired replies and complete paginated personal history. My
Homes keeps personal requests after shared access ends. The older my-claims API
also stops joining current private Home details. Saved review and current access
remain separate; checking status sends no mail. Full joining and owner/renter
creation recovery regressions remain green. Backend: 317 suites / 5,170 checks
(16 skips); browser: 93 suites / 1,193 checks; types/lint/privacy pass. All owned
fixtures and temporary command schema are cleaned, preserving the ledger.

**Continue now:** repair mail verification's initial status read, selected mailing
address, delivery-unknown and lost-reply recovery, and truthful current admission
after code confirmation. The current postal screen remains unaccepted. Then
finish both native submission/status clients and prepared review, invitations/
private first use and the full backlog. R02/H07/H08 remain partial; 74 inventory
entries remain. Broader lifecycle/provider/accessibility/version combinations
and mounted-update delivery remain bounded acceptance limits.

Browser predecessor `92c4d8072` has completed backend, database, browser, iPhone
and Android instrumented CI jobs passing in
[run 34676301600](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34676301600);
its Android lint/test/assembly job is still running at this checkpoint. Verify
this new milestone's own pushed-head CI independently. #32/#34 remain unfinished
drafts; #34 conflicts. Source migrations remain 41 Home / 21 payment / 50 combined.
No new migration, permanent adoption, merge or hosted/paid activation. The iPhone
remains on verified Pantopus 1.0.0 (2); all owner work, devices/data and private
artifacts are preserved. Paid services stay one final launch bundle.

### Browser existing-Home submission — accepted milestone; first use next

The [browser joining milestone](home-browser-residency-submission-2026-09-11.md)
passes actual Chrome/HTTP/SDK/SQL lost replies, restart/cancellation, changed
apartments and corrected new UUIDs, rejected resubmission, protected proof-write
repair and current My Homes refresh. Creation and joining share a fenced,
encrypted slot while retaining version 1 creation compatibility. Unsupported
optional join fields are removed; all three browser entry points use explicit
address confirmation. Edited address/units, pagehide and controlled geolocation/
property replies retire stale results. Fast unit entry during street resolution
still works. Actual owner/renter creation regression also passes. Full browser
regression: 93 suites / 1,193 checks; types/privacy pass; lint has zero errors and
two existing legacy warnings. All owned fixtures/SQL/functions are cleaned.

**Continue now:** fix applicants' current personal residency status and next-step
destinations. My Homes currently sends every residency applicant to document
upload and renders indistinguishable verification cards. Use the applicant's own
submitted identity without exposing current private household details. Keep
household review, evidence, postal intent and unknown delivery truthful. Then
finish both native submission flows, prepared residency review, invitations/
private first use and the full backlog. R02/H07/H08 remain partial; 74 inventory
entries remain. Browser lifecycle/provider/accessibility and client-server
compatibility acceptance remain bounded, not app-wide certification.

Backend predecessor `2f8625be0` has every CI job green in
[run 34673934859](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34673934859).
Verify this browser milestone's own CI. #32/#34 remain unfinished drafts; #34
conflicts. Source migrations remain 41 Home / 21 payment / 50 combined. No merge,
permanent adoption, hosted/paid activation or physical-device change. The iPhone
remains on verified Pantopus 1.0.0 (2). Owner work, devices/data and private
artifacts are preserved. Paid services stay one final launch bundle.

### Existing-Home submission — backend milestone, R02 remains open

The [atomic submission command](home-residency-submission-recovery-2026-09-11.md)
passes real HTTP/SDK/SQL recovery, eleven observed lock races, selected street/unit
fencing, current ownership routing, cancellation and late-write rollback. Rejected
resubmission preserves occupancy/age/dates/denies and retires old postcard access
without erasing dispatch evidence. Dedicated per-actor limits preserve recovery
and postcard allowance. Historical proof grants no current access or delivery.
Final backend regression passes 317 suites / 5,170 checks (16 skips); privacy,
web types and portable SQL pass. Populated upgrade preserves all row values in
365 tables; function lint has zero issues. Exact fixtures/schema are cleaned.

**Continue now:** wire retained existing-Home submission, correction and truthful
next steps into browser/iPhone/Android; retire the legacy partial-write path only
after compatibility acceptance. Then invitations/private first use, native
residency review and the full backlog. R02/H07/H08 remain partial. No merge,
permanent migration adoption, hosted release, device update or paid activation.

Browser predecessor `0813f56f6` has every CI job green in
[run 34671902925](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34671902925).
Verify this new backend milestone’s own CI, including fresh full-schema replay.
#32 remains an unfinished mergeable draft; #34 is an unfinished conflicting
draft. Fetched master is `6a1013784`; all worktrees and owner changes are preserved.
Source inventories are **41 Home / 21 payment / 50 combined**, with 12 identical
shared migrations and no timestamp collision. Combined replay/adoption remains
open. The physical iPhone remains on verified Pantopus 1.0.0 (2); paid services
remain one final launch bundle.

### Browser Home creation recovery — September 11

The [browser creation milestone](home-browser-create-recovery-2026-09-11.md) now
passes real Chrome → HTTP/SDK/SQL reload/cancellation fencing, committed lost-reply
recovery, atomic optional-setup rejection/correction, explicit renter creation,
unavailable protected storage and failed terminal-proof persistence. Encrypted
original commands keep their UUID/JSON; only confirmed retained outcomes permit
editing or current My Homes navigation. Both same-named units and their private
Tasks destinations are correct. Full browser regression passes 93 suites / 1,186
checks, eight focused fault checks pass, and types/lint/privacy pass. Exact SQL
and temporary functions/table are cleaned; migration ledger is unchanged. Private
browser profiles, source digests, screens and earlier failed driver runs remain.

**Continue now:** transactional existing-Home claim submission/cold-start and
resubmission (R02), ordinary member/invitation/private first use and primary
eligibility, then native residency review and the full backlog. H07/H08 remain
partial; 74 inventory entries remain. Broader session/provider/offline/browser/
accessibility and old/new client-server acceptance are still bounded limits.

Android predecessor `3ebbf4789` is pushed. Its [CI run 34671037286](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34671037286)
has passed instrumented Android and other completed jobs; iOS build and Android
lint/test/assembly are still running at this checkpoint. Verify that run and the
new pushed head separately. #32/#34 remain unfinished drafts; #34 conflicts.
Migrations remain 40 Home / 21 payment / 49 combined, with integration/adoption
still open. No merge, hosted release or paid activation; paid services stay one
final bundle. Owner checkout, databases/devices and all accepted artifacts are
preserved. The physical iPhone remains on verified Pantopus 1.0.0 (2).

### Android Home creation and unit identity — September 11

The [Android creation milestone](home-android-create-recovery-2026-09-11.md) passes
installed original-command restart/cancellation, committed lost-reply recovery,
atomic optional-setup refusal/correction and distinct Home-unit cards against
production HTTP/SDK/SQL. Encrypted original-command storage, lifecycle/session
fences, current My Homes refresh, accessible optional fields and truthful review
are implemented. Both variants pass 4,531 regression checks (80 skips), full
lint/style/snapshots/build and final instrumented-source compilation pass, and
privacy gates pass. Exact fixture SQL/functions are cleaned; protected commands
were acknowledged through UI before cleanup. Accepted APK/source digests and
screens are preserved privately.

**Continue now:** browser retained creation, existing-Home admission, primary and
private first use/invitations, then native residency and the full backlog. Native
storage-failure/cross-account, client-server version combinations and broader
physical/provider/accessibility acceptance remain bounded limits. H07/H08/R02/U01
remain partial; 74 inventory entries remain. Keep paid services one final bundle.

Predecessor `1565c8190` has all CI green in
[run 34669307089](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34669307089).
Verify this new pushed head separately. #32/#34 remain unfinished drafts; #34
conflicts. Source migrations remain 40 Home / 21 payment / 49 combined. No merge,
permanent adoption or hosted/paid activation. The physical iPhone remains on the
verified build 2; owner checkout/data/devices and accepted products are preserved.

### Owner-requested physical iPhone refresh — September 11

The [latest committed iOS build is installed](physical-iphone-refresh-2026-09-11.md)
on the existing iPhone 16 Pro: Pantopus 1.0.0 (2), source `139868c1d`. Staging
device build, strict signature verification and installed-version check pass;
existing integration/Keychain/app-group/APNs identities are preserved. No app
data clear, hosted release or repeated physical Beacon acceptance occurred.

Continue uncommitted Android creation/unit work: compile, Debug assembly,
instrumented test compilation and 29 focused checks pass; actual installed
acceptance is in progress on owned emulator 5556. The owned creation fixture on
18084 needs exact cleanup afterward. Then browser creation, join/private first
use/invitations, native residency and the full backlog. Paid services remain
one final launch bundle. See the handoff for current Git/CI verification limits.

### Home unit identity in lists — September 11

The [unit-label repair](home-list-unit-identity-2026-09-11.md) fixes the actual
first-use defect found during iPhone creation: different units at one street
looked identical. Authorized list projections retain `address2`; personal
verification still hides it, and malformed units cause retryable failure.
Actual HTTP/SDK/SQL, narrow browser cards and installed iPhone creation → current
My Homes pass. Backend 5,170, web 1,178 and iPhone 4,369 regression checks pass,
plus privacy/types/style/signed build. Exact fixture SQL/functions are cleaned.

**Continue now:** finish Android unit labels and protected creation. Its core
compiled earlier; wizard/recovery UI integration is in local WIP and is not part
of this checkpoint or accepted yet. Then browser retained creation, existing-Home
join, primary/private first use and invitations, native residency and the full
backlog. H07/H08/R02/U01 remain partial; 74 inventory entries remain. Preserve
accepted products and private evidence; paid services stay one final bundle.

Creation predecessor `d08a26a33` is pushed; inspect its remaining native CI and
this new head separately. #32/#34 remain drafts; #34 conflicts. Migrations remain
40 Home / 21 paid / 49 combined; no permanent adoption, merge or paid activation.
The old local web process was absent; its task-owned replacement runs on 18080.
The prior stopped REST container and all database/device/owner resources remain
preserved. Ledger remains `20260910220000`.

### iPhone Home creation recovery — September 11

The [iPhone creation milestone](home-ios-create-recovery-2026-09-11.md) passes
installed original-command recovery after a lost committed reply/app restart,
server-confirmed cancellation before a delayed worker can create, and atomic
optional-access refusal → correction → fresh request. Current My Homes reloads
show private Tasks without inventing residency or ownership. Protected Keychain
storage retains the original command; optional access commits in the same request.
Input accessibility and inline validation are repaired. Final regression passes
4,369 checks (168 skips), signed build/style/privacy pass, and exact synthetic SQL
and temporary functions are cleaned. Accepted iPhone products are preserved.

**Continue now:** actual visual review found that two units at one street look
identical in My Homes because `address2` is omitted. Fix safe unit projection and
client labels, then finish Android/browser retained creation, existing-Home join,
primary/private first use and invitations, native residency and the full backlog.
Android command/codec/encrypted-store components are local WIP and compile; their
wizard integration and installed acceptance are not complete and are not included
in this iPhone checkpoint. H07/H08/R02 remain open; 74 inventory entries remain.

Backend predecessor `c0d474989` has all checks green in
[run 34663479661](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34663479661).
Verify this new pushed head separately. #32/#34 remain unfinished drafts; #34
conflicts. Source migrations remain 40 Home / 21 paid / 49 combined. No merge,
permanent adoption or paid activation. The disk-full Docker interruption was
repaired without deleting data; the original stopped REST container and private
configuration snapshot remain preserved. The local ledger remains `20260910220000`.

### Atomic Home creation backend — September 11

The [creation repair](home-create-recovery-2026-09-11.md) passes actual production
HTTP/SDK/SQL rollback, duplicate/concurrent requests, retained outcomes, lost replies,
cancellation fencing and pending-owner/private access setup. Backend regression
passes 317 suites / 5,170 checks (16 skips); privacy gates and SQL/function checks
pass. A populated upgrade preserves all row values in 365 existing tables. Exact
fixture rows, temporary functions and fault trigger are cleaned; no ledger changed.
Location predecessor `af28df271` has every CI job green in
[run 34660624151](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34660624151).
Verify this backend checkpoint's own pushed-head CI, including empty-schema replay.

**Continue now:** protected original create/join commands on native and browser,
lost-reply/restart/cancel UI, optional setup in the same command, truthful primary
eligibility and private first use; then native residency and the full backlog.
H07/H08/R02 remain open. Legacy clients without a retained UUID, existing orphan/
duplicate Home admission and best-effort notification delivery are explicit limits.
There are still 74 open inventory entries; counts are not effort percentages.
Source migrations are 40 Home / 21 paid / 49 combined with no shared-content
conflicts. #32/#34 remain unfinished drafts; #34 conflicts. No merge, permanent
adoption or paid activation. Owner work, devices, databases, accepted native
products and private evidence remain preserved; paid services stay one final bundle.


### Native device location recovery — September 11

The [location milestone](home-device-location-recovery-2026-09-11.md) passes
installed iPhone and Android denial → Settings grant → actual device location →
revocation → manual validation. It fixes uncancellable iPhone waits, Android's
unbounded fallback and GPS-only acquisition, stale/denied caches and Settings
recovery. Full iPhone regression passes 4,363 checks (168 skips); each Android
variant passes 4,524 checks (80 skips). Final builds, style/lint/snapshots and
privacy gates pass. Exact r6 fixture SQL cleanup passes; prior products and
owner resources remain preserved. Physical location and paid providers remain
outside this local acceptance.

Address-entry predecessor `b40b2ba5b` has every check green in
[CI run 34658007186](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34658007186).
Verify this location milestone's own pushed-head CI. H07/H08/R02 remain open.
**Continue now:** atomic retained Home create/join, restart/lost-reply recovery,
truthful primary eligibility and private first use; then native residency and
the full backlog. No migration, permanent adoption, merge or paid activation.
#32/#34 remain unfinished drafts; #34 conflicts. Migration inventory remains
39 Home / 21 payment / 48 distinct combined versions.


### Native Home address entry — September 11

The [native address-entry milestone](home-native-address-entry-2026-09-11.md)
replaces sample search with real search/resolve, editable manual input, canonical
validation and explicit ZIP correction. Both installed platforms pass search,
partial-draft keep/discard, validation/refusal/retry, unit editing and background
retirement through production HTTP/SDK/SQL. Keyboard reachability, Android system
Back/current chrome and the iPhone confirmation's missing safe action are fixed.
Final Android Debug/Release/style/lint/snapshot checks pass; iPhone regression,
final signed build, affected installed flows and changed-file style pass. Exact
fixture SQL cleanup is confirmed. Private evidence and owner resources are preserved.

H07/H08/R02 remain open: finish actual device-location acquisition/cancellation,
atomic retained create/join with lost-reply/restart recovery, primary eligibility
and truthful first use, then native residency and the full inventory (74 entries
remain; not an effort percentage). Creation is still multi-write and is not
accepted by address-entry evidence. No migration or paid activation. Source
migrations remain 39 Home / 21 paid / 48 combined; #32/#34 remain unfinished drafts
and #34 conflicts. Fetch and verify the next pushed head's own CI. Predecessor
`4b2b9a0e2` has all checks green in
[CI run 34647390851](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34647390851).


### Address lookup failure and recovery — September 11

Following native milestone `f66c0b3a8`, the [onboarding lookup repair](home-onboarding-recovery-2026-09-11.md)
returns retryable failure when a canonical address, Home or occupancy read is
failed, interrupted, missing or malformed. It considers active Homes and keeps
private/no-store responses. Actual HTTP/SDK/SQL acceptance passes canonical,
hash and legacy-field matches, archived duplicates, twelve fault/recovery cases
and exact cleanup. Full backend regression passes 317 suites / 5,169 checks
(16 skips), and privacy gates pass.

H07/H08 are still open. Native Add Home currently uses sample search results,
manual/current-location actions do not finish the promised flow, and the wizard
expects coordinates from a lookup endpoint that never returns them. Continue
real search/manual/location entry and canonical validation, then atomic retained
create/join commands and useful first-use navigation. Preserve correct roles,
private Tasks, explicit denies and the distinction from verified membership.
Then continue native residency and the full inventory without stopping here.

The member-view migration's final bounded-lock version also passes a fresh
populated/idempotent local upgrade rehearsal, with every change rolled back.
No permanent migration adoption, provider activation or real message. Verify
this new head's CI; `f66c0b3a8` had no failed checks when inspected, with native
jobs still running. #32/#34 remain drafts; #34 is conflicted. Source migrations
remain 39 Home / 21 paid / 48 combined. Owner work and private evidence remain
preserved; paid services remain one final launch bundle.

### Native Home identity and private first use — September 11

The [native list milestone](home-native-list-first-use-2026-09-11.md) completes
H05's separation of saved Home, private setup, current role, residency and
ownership. Installed Android r9 and final iOS r4 pass the production SDK/SQL
list → dashboard/private Tasks journeys, applicant destinations, unavailable/
malformed retry and retirement of delayed replies after current denial. Reviewed
screens show the distinct identities. The fixture's complete history has zero
errors, and all exact synthetic SQL cleaned up on graceful shutdown.

Full Android regression/style/lint/snapshot checks pass (4,514 passed, 80 skips);
iOS full regression passes (4,345 passed, 168 skips), final signed build and
installed journey pass. Detailed failed attempts and limits are in the report.
A partly clipped iOS list floating action remains U01/U02; final Tasks controls
are fully visible. Verification destinations safely report unavailable in this
bounded fixture; completed native verification remains R01/R02.

H01–H06 are locally verified; 74 of 80 inventory entries remain open, not an
effort percentage. H07/H08 remain partial. **Continue now:** the
[onboarding repair](home-onboarding-recovery-2026-09-11.md): native clients expect
coordinates from a lookup that never supplies them, and creation/admission still
needs atomic original-command recovery. The lookup's failed-read/archived-Home
repair is locally in progress, separate from this native commit. Then finish
native residency and the full backlog without a routine milestone stop.

Predecessor `69eaebea1` passes CI safeguards and complete schema replay; its
other checks were still running at this checkpoint. Verify the next pushed
head's own checks. #32/#34 remain unfinished drafts; #34 conflicts with master.
The full source inventory remains 39 Home / 21 paid / 48 distinct migrations.
No merge, permanent database adoption, hosted mutation or paid activation.
Owned devices, prior products, databases, owner changes and private evidence
are preserved. Port 18083 is free after native fixture r4's exact cleanup.

### Ordinary invitation defaults — September 11

The [member overview default repair](home-member-view-defaults-2026-09-11.md)
adds only missing `home.view` role defaults and preserves existing role decisions
and individual denies. All 44 SQL contracts, populated/idempotent upgrade,
actual invitation → SDK/SQL → Home list/detail, lost-reply recovery and privacy
gates pass. Local fixture rows and original role policy were restored exactly.
The migration is source only; no permanent adoption or ledger rewrite occurred.

Pushed `9c758865e` exposed missing migration compatibility/lock-bound metadata
in CI. The insert is unchanged; both safeguards are supplied and the local
policy gate passes. Verify the corrective head and its fresh database replay.

H07 remains partial: create/save/join UI and transactional onboarding still need
work. The native H05/H08 candidate remains in installed acceptance. Continue
those flows without stopping at this milestone, then native residency and the
full backlog. The final native build and Android recovery run are underway.
Pushed parent `b0097a41a` now has every CI check green in
[run 34638384517](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34638384517);
verify this milestone's own head separately. #32 remains draft and mergeable;
#34 remains draft and conflicted at `e9ef2decb`. Master remains `6a1013784`.

The owner authorizes branches, PRs and merges as needed for completed scopes,
subject to passing checks and reconciled migrations. The source inventory is
now 39 Home / 21 payment / 48 distinct combined versions. Paid services remain
one final launch bundle. Preserve unrelated checkouts, data, devices and evidence.

### CI follow-up for the detail milestone

The pushed `afd231655` run [34636714349](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34636714349)
caught a redacted-public-preview regression: a helper removed during cleanup
still had a caller. That cleanup occurred after the earlier local full regression.
The flag-aware personal-claim predicate is restored; it grants only the existing
redacted preview, never shared Home data. All 18 focused address/claim checks and
full backend regression (317 suites / 5,169 passed, 16 skips, 90.682 seconds) now
pass. Evidence: `/private/tmp/pantopus-home-detail-projection-preview-fix-r2.log`,
`/private/tmp/pantopus-home-detail-projection-backend-r3.log`; failed CI log remains
private at `/private/tmp/pantopus-home-detail-projection-ci-backend-afd231655.log`.
A first focused invocation used the repository root instead of backend and could
not resolve its test mock's express import; the backend invocation passed.

The native H05/H08 candidate is in progress, not yet accepted; see the
[native list report](home-native-list-first-use-2026-09-11.md). Both apps compile
with the actual SDK list/detail fixture. Installed checks found a missing iOS
banner caused by generic protocol dispatch and Android packaging/driver startup
failures; fixes are being verified on the owned devices. Prior products remain
preserved under `/private/tmp/pantopus-home-native-artifacts-before-h05/`.
This earlier candidate checkpoint predates the member-view migration above.
Pushed `b0097a41a` now has all checks passing. The H07 role-default gap is
repaired in the newer milestone; the guest create path is already rejected before occupancy
creation, despite an unreachable old guest branch later in the route.

### Home detail projection and browser property recovery — September 11

Continued from pushed `c4a22858f` on `codex/home-permission-boundaries` in
`/private/tmp/pantopus-home-permission-boundaries`. The [detail projection report](home-detail-projection-2026-09-11.md)
records H03/H04: explicit per-field Home/owner/occupant responses, safe native-shaped
household identity, current roster versus managed history, held-subject retirement,
and actual browser property error/retry/session/lifecycle recovery. Edit controls
omit unreadable instructions; contact navigation uses the permitted verified owner.

Actual SDK/HTTP/SQL r5 and Chrome r3 pass with exact fixture cleanup. Backend r2
passes 317 suites / 5,169 checks (16 existing skips); web regression passes
92 / 1,178. Privacy gates and strict web types pass. Affected lint retains eight
existing warnings, no errors. The report preserves failed attempts and verification
limits. No native or real provider acceptance is inferred from these checks.

**Continue without a routine milestone stop:** H05 native Home identity and
verification, H07 real create/save/join/invite defaults (verified-member home.view
gap), H08 native useful first use; then native residency and the full backlog.
H01–H04/H06 are locally verified: 75 of 80 tracked entries remain open, not an
effort percentage. Broader mutation/settings/member-page privacy and failure
behavior remain D01/D05/D07; vendor validation is I05; live invalidation is I07.

Prior head `c4a22858f` CI [34634628047](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34634628047)
has green backend/web/schema, Android instrumented checks and iOS bundle build;
iOS simulator tests and Android assemble were still running. Check the new pushed
head separately. #32/#34 remain drafts, #34 conflicted. Reconcile 38 Home / 21
payment / 47 distinct combined migration dependencies before merging. No migration,
merge, deployment, paid activation or real message. Preserve owner checkout, paid
worktree, databases, devices, artifacts and private evidence. Paid services stay
in one final launch bundle.

### Home list authority and browser private first use — September 11

Resumed from `943b08cc4` in `/private/tmp/pantopus-home-permission-boundaries`,
branch `codex/home-permission-boundaries`. The paused head now passes every check,
including CI OK, in [run 34630614602](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34630614602).
Origin master remains `6a1013784`. #32/#34 are unfinished drafts; #34 is conflicted
and its existing head checks pass. Verify the next pushed milestone's own CI.

The [Home-list repair](home-list-authority-2026-09-11.md) replaces three divergent
list readers with current JavaScript/SQL admission, safe card fields, actual
occupancy or null, effective role, separate personal/private setup entries and
guarded deletion eligibility. Frozen/archived/revoked/expired/future/denied Homes
cannot return shared cards. Applicants receive only personal progress; exact
private creators can enter Tasks without invented household membership or primary
residency. Read errors remain retryable, and held cards/claims/eligibility retire
when authority or personal claim state changes.

HTTP/SQL/SDK r4 passes the authority/failure/recovery matrix and exact cleanup.
Browser r3 verifies current roles/deletion, unavailable and malformed Retry,
revocation, held account changes, lifecycle retirement, applicant privacy and
real private setup list → Tasks with creation controls, including settled narrow
layout. Login, ancillary APIs and lifecycle signals remain controlled. This does
not prove native lists, real signup/join/invites or a new provider journey.
The report preserves the invalid-enum fixture attempt, earlier incomplete resize
capture, and backend logout transport failure/recheck. Final backend r3 passes 317 suites / 5,169 checks (16 existing skips); web r3
passes 92 / 1,178. Strict types/lint and privacy gates pass. Detailed evidence
and limitations are recorded there.

**Next:** H03/H04 remaining detail/identity projections, H05/H07 real native
verification and onboarding defaults (including the verified-member home.view
gap), and H08 native list/detail/private-first-use acceptance; then native
residency and the full remaining inventory. H02/H06 are locally verified; 77 of
80 tracked entries remain open. Counts are not effort percentages. Reconcile the
38 Home / 21 payment / 47 combined migration stream and final-head checks before
merging. Paid services remain one final launch-preparation bundle.

No migration, hosted mutation, merge, deployment or paid activation. Owner
checkout remains on `939878b4` with its modified handoff and two untracked Place
design files; paid worktree is clean at `e9ef2decb`. Owned SQL/API, web 18080,
Android/iOS devices, signed products and private evidence are preserved. Both
list fixtures clean their exact SQL; no persistent new listener is needed.

### Requested pause checkpoint — Home detail authority and full inventory

This session is paused at the owner’s request for a fresh-session handoff.
The next session should continue from this checkpoint after refreshing Git/CI.
Worktree:
`/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`. Verified source milestone is
`53ce8200d42c75728764dfc37e7c544b2e989eda`, followed only by this documentation
checkpoint. Both are pushed together on the same branch. The milestone contains the
[Home-detail repair](home-detail-authority-2026-09-11.md) and consolidated
[remaining-work inventory](REMAINING_WORK_2026-09-11.md): 80 tracked entries,
one now locally verified, 79 still open. Counts are not an effort percentage.

Detail and property-detail current authority, safe errors and delayed-result
retirement pass real production HTTP/IAM/SQL through the actual Supabase SDK:
thirteen authority changes on both routes, nine held replies, minor-owner limits,
legacy/v2 claim selection and unavailable-data/provider recovery. Every SQL
fixture cleaned exactly. Privacy gates pass. Final backend r3 passes all 317 suites / 5,169 checks (16 existing skips),
70.326 seconds on the already-installed supported Node 20 runtime.
The report preserves the earlier fixture mismatch and aborted wrong-directory
rerun. Native iOS/Android card/receipt and health work was already pushed in
`42accb732`; its earlier CI had completed checks green and native jobs pending before this
push. The paused head’s CI is not certified here; inspect the
[latest PR checks](https://github.com/WangPantopus/skinny-pantopus/pull/32/checks).
Superseded runs can be cancelled by workflow concurrency; their aggregate is
not final passing evidence. Recheck the newest pushed head next session.

**Next:** H02-H08 — fix actual Home lists/primary/root stale access, truthful
roles/deletion eligibility and safe identity projections; separate saved Home,
property/address verification, residency and ownership; verify real onboarding/
invites/private first use. Then native residency and the full inventory, including
health/checklist lag, writes/settings/privacy/sharing, Place finance, Mail/guests,
UI/accessibility, payment recovery, provider/device and upgrade/release gates.
The detail repair does not close list/identity/raw occupant exposure findings.

#32/#34 remain unfinished drafts; #34 conflicts with master. Master last fetched
is `6a1013784`; combined 38 Home / 21 payment / 47 migration dependencies/replay
remain open. The reserved tip migration is not implemented. No PR merge, hosted
change, production deployment, new migration or paid activation occurred.
All paid services stay one final launch-preparation bundle.

Preserve owner checkout on `939878b4` with its modified handoff and two untracked
Place-design files. Paid worktree is clean at `e9ef2decb`; do not copy/reset it.
Docker/owned Supabase project `pantopus-home-gig-replay` is healthy (API 64521,
DB 64522); all ddc236 fixtures are cleaned and port 18083 is free. Existing owned
web PID 63192 listens on 18080. Owned Android 5556 and iOS F9BBAB33 remain booted;
owner iOS EB5AD759 remains untouched. Preserve SQL, private logs/screens, derived
products and the restored signed Sentry artifact. Disk has about 22 GiB free;
no cleanup of owner files or database copies is authorized by this checkpoint.

### iOS and server intelligence acceptance complete — next: Home identity

Android milestone `892c2f51dde5034d54aac2efe53adf6e41fb4935` is pushed. Its
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34627675231)
has no failed checks; native build/device jobs are still running at this
checkpoint. All checks on parent `611032282` pass. Refreshed origin is master
`6a1013784`; #32/#34 remain unfinished drafts, #34 conflicted. No merge is due.
The 38 Home / 21 payment / 47 combined migration dependencies remain a merge gate.

This checkpoint includes verified iOS card/receipt validation, stronger bill-
denial acceptance, and the server health-data repair. Installed iOS r2 passes
both journeys in 765.238 seconds: ten malformed-card rejection/Retry cases and
four committed-but-unconfirmed checklist saves, each exactly one PATCH, actual
SQL completion, Retry and cold return. HTTP evidence has zero fixture errors;
finished error, completion, property recovery and corrected 35/100 score pixels
are reviewed. Signed build r3, strict lint/format and 13 affected model checks
pass. The separate full iOS bill-denial/recovery r2 also passes.

Server HTTP/SQL/SDK r2 passes overdue/multiple/paid/past/future bills, cleared
optional text, malformed dimension/count/coordinate data, uncached failures and
recovery. Existing summary and twelve held-authority regressions, privacy gates,
and the final supported Node 20 full backend run pass (317 suites / 5,169 checks;
16 existing skips). Two earlier local Node 24 transport failures are retained in
the detailed report; no established cause or default-runtime change is claimed.
Native fixture r10 and all server replays completed exact SQL cleanup; 18083 is
free. Owned devices/SQL/products and restored Sentry artifact remain available.
Owner source work and devices are untouched. No new migration, hosted action,
merge or paid activation. See the [dashboard report](home-dashboard-current-summary-2026-09-11.md)
for private evidence and earlier failed harness attempts.

**Next:** verify the next pushed head, then actual Home-list/detail/Verified
identity, current access, private first use and real onboarding role defaults;
continue native residency and the entire ordered backlog below. The controlled
Home shell above does not prove those routes. Receipt screenshots also expose a
health score lag after checklist creation/recovery (30 while the checklist is
populated); reconcile generation, cache invalidation and cross-card reloads in
the checklist follow-up. Home-local bill dates, deeper history/write/provider,
platform/payment and upgrade/release work remain. Paid services stay one final
launch-preparation bundle. No overall completion percentage is established.

### Native account and delayed-response acceptance — September 11

Android account r1 passes normal A → B → A login/logout, cold B denial and
original-account restoration: three sign-ins, two sign-outs, four current B
403s, no B aggregate request and zero fixture errors. iOS account/retirement r1
passes both installed journeys (315.454 seconds), including normal account
switching, cold denial, restoration and all four held authority/health/checklist/
property replies after foreground revocation. Denied screens and restored Android
summary pixels are reviewed. iOS restoration proves current aggregate data; its
capture still includes ancillary loading, so it is not new full-card visual proof.
Signed iOS account build r3, strict lint/format r2 pass. Android bill currency r2
passes six format-2 reads and fully visible oldest/latest rows across 24 months;
full recovery r4 passes 21 reads with actual Retry responses and finished denial.
See the [dashboard report](home-dashboard-current-summary-2026-09-11.md) for
private evidence, earlier failures and verification limits.

Both accounts use controlled login/provider/Home-shell responses with production
Home HTTP/IAM/SQL. This does not prove real OAuth/revocation, Home-list identity,
role defaults, or the remaining residency/write/provider/release workflows.
#32 and #34 remain unfinished drafts; #34 is conflicted. All required checks on
pushed Android `6a2a1d380` and iOS `661e5fea1` pass. Verify each new pushed head.
Master remains `6a1013784`; combined 47-version dependencies/replay remain.

Bill-authority fixture r1 and dashboard fixture r6 completed exact SQL cleanup.
Owned iOS F9BBAB33 and Android 5556 are on; bill-denial fixture r2 now owns
18083 for the pending iOS replay. The standalone intelligence and summary HTTP
fixtures completed exact cleanup. Owned SQL and web remain. Preserve restored Sentry artifact/products/evidence and all owner work.

**Next:** finish strengthened iOS bill-denial recovery, then malformed nested
intelligence, checklist receipts, real Home identity and native residency, followed
by the full ordered backlog. The reproduced frozen-Home intelligence bypass is
repaired with before/after authority and no-store responses. Full backend, privacy,
direct HTTP/SQL/SDK (twelve held results) and existing summary/checklist/settings/
bill recovery checks pass. No new
migration, hosted action or paid activation. Paid services stay one final launch
preparation bundle.

### Android current-Home acceptance — September 11

Installed Android dashboard r3 passes the full current/denied/applicant,
summary/card Retry, foreground held-summary retirement and private Tasks journey
(232 recorded Home HTTP requests, zero fixture errors). Reviewed screens confirm
safe activity identity, finished recovery and private first use. Build r5,
affected validation/lint r2 and all three reviewed Home snapshots/quality r2 pass.
The Documents shortcut split mid-word on the real screen; it now says Docs.
Final build/quality/lint r6 passes and is installed. Retirement r1 passes all
four held authority/health/checklist/property cases and restoration; the Docs
shortcut pixels are reviewed. Android `6a2a1d380` is committed/pushed; all required checks now pass in
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34616978020). Bill currency/history r1 passes amounts/order
and six format-2 reads, but its latest-row screenshot is clipped. The stronger
viewport check still needs full currency r2. Full bill recovery r4 passes 21 format-2 reads with real-response/visible-Retry
checks and finished denial/restoration, after two harness findings and a separate
pre-app startup timeout. Stronger currency/history r2 is now running; see the report. iOS account/held-intelligence/finished
bill-denial test candidates pass formatting/strict lint; build r3 is running.
The pinned Sentry artifact has been restored with checksum/signature/links verified. A two-account fixture/journey draft is prepared, not yet run. See the [dashboard report](home-dashboard-current-summary-2026-09-11.md)
for earlier failures, capacity/Docker recovery, private evidence and limits.

All required checks on pushed iOS `661e5fea1` pass. #32/#34 are the only open PRs,
both unfinished drafts; #34 remains conflicted. No new migration, hosted action
or paid activation. Combined 47-version dependencies/replay remain. Owner source
and devices remain untouched. Owned Android 5556, bill-authority fixture r1/18083, owned
Gig SQL and web 18080 remain; owned iOS F9BBAB33 is off. Native dashboard fixtures
r4/r5 completed exact SQL cleanup and are stopped. The generated Sentry artifact is restored; preserve it for the pending iOS run.

**Next:** finish both Android bill replays and verify the new pushed head. Then
close actual account switching, remaining iOS held intelligence and malformed
intelligence/direct server authority gaps, real Home identity and
native residency, followed by the entire ordered backlog. Paid services stay one
final launch-preparation bundle; this is not a claim that all Home writes or the
app are complete.

## iOS current-Home read milestone — September 11

The iOS current-Home milestone now passes signed build r8, full SwiftLint and
changed-file SwiftFormat r8, and 33 affected model/auth checks r3. Installed Home
r3 passes all three journeys; focused r4 strengthens card recovery with positive
finished-content assertions and passes. Applicants, explicit finance denial,
private creator Tasks, foreground revocation and an already-produced obsolete
aggregate are covered. Both bill currency/history/recovery journeys also pass
against the adapted production-authority fixture. See the
[dashboard report](home-dashboard-current-summary-2026-09-11.md) for evidence and limits.

Backend authority `1341aea5e` passes every required check in
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34606114320).
The next pushed iOS milestone needs its own CI. #32/#34 remain unfinished drafts;
#34 is conflicted and combined 47-version migration dependencies/replay remain.
No new migration, hosted change or paid activation. Paid services stay one final
launch-preparation bundle.

**Next: finish the Android current-Home candidate.** Access DTO/reader, session/
lifecycle retirement, strict aggregate and UI repairs are now uncommitted drafts;
build, quality and installed acceptance are still required. Then finish actual
account switching, held intelligence, broader first-use/identity and native
residency recovery, followed by the entire ordered backlog. Do not mistake this
bounded read milestone for every Home write, provider or launch workflow passing.

Owned native dashboard r3 and bill-authority r1 fixtures completed exact SQL
cleanup and are stopped; owned iOS F9BBAB33 is shut down, owned Android remains
off. Docker/owned Gig SQL and web 18080 remain. Resource cleanup removed only
owned generated iOS intermediates/module cache/index; products, source, private
evidence and databases remain. Owner checkout/files/devices stay untouched.

## Current populated dashboard checkpoint — September 11

Read the top of [PROJECT_HANDOFF](PROJECT_HANDOFF.md) and the
[dashboard report](home-dashboard-current-summary-2026-09-11.md). Actual HTTP/SQL/
SDK r7 and Chrome r6 pass with exact cleanup: populated records, currency/date
amounts, issue/package shortcuts, active maintenance, keyboard cards, denied
collections, truthful failures/retry and account/lifecycle/held responses. Backend
regression, final web r3 and final types/lint/privacy pass. Initial failures and
limits are retained.

Next: native whole-Home current access/lifecycle, strict aggregate/identity,
applicant/private-first-use entry and captured UI findings, then the full backlog.
Verified-member home.view defaults need real onboarding reconciliation; the browser
no longer bypasses denial. Native identity edits remain an uncommitted draft.
`60228da3d`/`9d603c68c` are pushed; completed CI on the latter passes, two jobs
were still running. Refresh each head. #32/#34 stay drafts (#34 conflicted),
combined migrations remain unresolved and paid providers stay one final launch
bundle. Owner source/devices/data remain untouched. Older checkpoints are historical.

## Most recent native bill checkpoint

Read the top of [PROJECT_HANDOFF](PROJECT_HANDOFF.md) and the
[native report](home-native-bill-comparison-2026-09-11.md). iOS currency/history
build r5, both installed r5 journeys and final Swift quality pass, pushed as
`3c95d77db`; its native CI was still running without failures. Android currency
build r2, installed currency/history r2 (six reads) and full recovery r3 (22 reads)
all pass; pixels reviewed. The shared r5 fixture completed exact cleanup and is
stopped. Both owned native devices are shut down. Docker/owned Gig SQL/web 18080
remain; older replay containers stopped with data retained. Generated resource
cleanup and initial failed runs are preserved in the report. Owner files/devices
are untouched. Next implement and actually verify native Home current-access/
lifecycle/held-read/session retirement, preserving private first use and applicant
verification, then summary UI repairs and the full ordered backlog. #32/#34 stay
unfinished drafts; #34 conflicted, combined migrations still unreconciled. Paid
services remain one final launch bundle. New pushed heads need their own checks.

## Latest continuation — September 11, live bill comparisons

Read the current top of [PROJECT_HANDOFF](PROJECT_HANDOFF.md) and the
[bill report](home-bill-comparison-continuation-2026-09-11.md). They supersede old
bill-cache and migration counts below. Current candidate source has 38 Home /
47 combined migrations, with real SQL/HTTP, fresh replay, populated preservation
and browser work. Native amount/order/currency and old-client compatibility
remain explicit next gates; PRs #32/#34 remain unfinished drafts. Final browser
r3 passes; the next pushed exact-head CI must be checked separately.
The owner asks for ongoing work and practical workflow evidence, not unit
coverage. Docker recovery remains authorized; paid services stay one final bundle.


September 11 next milestone: [Place bill access/error boundaries](home-bill-comparison-continuation-2026-09-11.md)
requires current Home view, prevents personal bill reads without finance.view,
keeps read errors explicit and preserves missing coordinates. Real production
HTTP/SQL and full backend/privacy pass. This does not fix the still-confirmed
currency, monthly aggregation, stale contribution and derived rebuild findings;
those are next, followed by all existing native/Home/Pulse/Beacon/release work.
No new migration; 37/46 dependency reconciliation and final paid bundle remain.


Newest September 11 continuation: [Home summaries and preferences](home-summary-boundary-continuation-2026-09-11.md)
repairs summary failure/empty states, current permission gates, exact checklist
changes and an actual HomePreference schema mismatch. Settings/typed preferences/
audit commit together. Real Chrome r3 (pointer/keyboard and visible switch state), HTTP/SQL r5, eight checklist/seven settings
lock races, 37-version fresh replay, all 42 SQL/pgTAP, SDK/lint and preserved-data
upgrades pass. Final color-state browser r3 passes; pushed as `a6d879664`, with exact-head CI started. Next reconcile
bill currency/monthly comparisons/stale cohorts, then native summaries/residency
and every existing backlog item. PRs #32/#34 remain unfinished drafts; combined
46-version dependency/replay work remains. All paid services stay one final
bundle. The report preserves detailed limits, initial findings and evidence.


Newest September 11 continuation: [dashboard current access](home-web-dashboard-access-retirement-2026-09-11.md)
repairs stale private data/Owner/Invite/security controls and open panels. Final
actual Chrome/production IAM/helper/SQL passes revocation, stale reads, account
and lifecycle changes, current permission denial, fallback, pending verification
without private data, later approval/update, current timeline and narrow keyboard
recovery. Residency-specific pending copy does not offer ownership actions. Next
fix ancillary intelligence outage/empty/retry states exposed by the same UI pass,
then native residency and the full existing backlog. Both feature PRs stay drafts;
35/44 migration dependencies remain and paid services stay one final bundle.
Older next steps below are historical; preserve their linked unresolved findings.

Newest September 11 milestone: [browser residency review/recovery](home-web-residency-review-recovery-2026-09-11.md)
passes both entries and continuous actual Chrome/HTTP/SQL acceptance: 8 POSTs,
4 receipts, Cancel, current/historical separation, storage/lifecycle/authority
failures, role ceilings and empty-list recovery. Types/lint and 1,178 web checks
pass. Next resolve stale surrounding dashboard access state found during visual
review, then iOS/Android residency parity and submission/cold-start/resubmission.
Owned web/Gig DB runtimes remain; exact fixtures are cleaned. Native jobs on
backend `e0ea36284` were still running; refresh the new exact head. Both feature
PRs stay drafts and paid services stay one final bundle. Older next steps below
are history; preserve the full linked findings and remaining backlog.

Latest September 11 milestone: [residency review receipts](home-residency-review-receipts-2026-09-11.md)
now pass actual HTTP/service/SQL, 13 observed lock races, 35-version pinned fresh
replay, all 40 SQL/pgTAP contracts, function lint, six SDK/PostgREST cases and a
populated upgrade preserving 15,117 original rows / 364 tables. Final full backend
and privacy pass; initial CLI and transient socket observations remain documented.
Next are both browser entries with encrypted recovery and Cancel/list repairs,
then native parity and submission/cold-start/resubmission. Docker recovery was
authorized and succeeded; source/owner runtimes/data are preserved. PRs #32/#34
remain drafts, combined 44-version dependency/replay work remains, and paid
services stay one final bundle. Refresh the new exact head's CI. Older candidate
and infrastructure notes below are historical, not current blockers.

September 11 continuation: PR #7 at `8c2eaa110` passed all required checks and
merged as `6a1013784`; integrated into the Home branch with current routing and
handoff preserved. Verify this new integration head. Residency HTTP/session
adapters now pass 42 affected checks; candidate SQL remains unapplied/unverified.
Docker stopped under local resource pressure; the owner authorized restoring the
existing engine. Recover it without deleting containers, volumes or owner work,
then execute actual SQL/HTTP/races/fresh and populated verification. No paid
service activation. The older status below is a historical checkpoint.

This is a source-preservation checkpoint requested by the owner so work can
continue in a fresh session. It includes unfinished implementation. It is not a
release, completed acceptance, or permission to merge failing/unfinished PRs.
The newest [Android relationship report](home-android-claim-relationship-recovery-2026-09-10.md)
records installed app/Keystore → production HTTP/service → SQL: five POSTs/three
receipts, cold/current recovery, corruption/restoration, stale review, current
revocation and background interruption pass. A UIAutomator capture timed out at
the final empty state; remaining evidence and denied-list checks passed in a
resumed segment on the same fixture. Normal Profile navigation and the shared
Material field-label crash are repaired; final builds/quality/lint, 12 affected
model cases and two installed typography cases pass. The report retains private
pixel, native fault-matrix, physical/provider and automation-load limits.

Next: residency review receipts (candidate migration/service/SQL contract exist
locally, unverified and unapplied), then submission/cold-start/resubmission and
ownership/lease/resource work. The candidate is excluded from the Android source
milestone. Committed migrations remain 34 Home/43 combined; it would make 35/44.
Both feature PRs stay drafts. Paid #34 stays `e9ef2decb`, green but unfinished.
Preceding iOS `3393baa18` passes required CI; refresh the new exact head. Design
PR #24 merged as `cd764458f`; diagnostics PR #7 at `8c2eaa110` has fresh CI pending
after its old test-hook repair. Android is committed/pushed at `ca2d6e378`; master `cd764458f` is now integrated
with current handoff and design history preserved. Verify this integration head
and integrate #7 after its required checks and merge. Paid services stay one final
launch bundle. Exact native fixture cleanup passes; owned emulator/listener are
stopped; the owned Gig database remains for residency. Owner files/runtimes are
preserved. Earlier next-action and CI notes below are historical.

The preceding [iOS relationship report](home-ios-claim-relationship-recovery-2026-09-10.md)
completes prepared review and actual Keychain original/confirmation recovery.
Installed normal navigation → production HTTP/service → SQL passes five POSTs,
three receipts, two restarts, later rejection, stale review, revocation/restoration,
background preflight interruption and permanent recovery after the queue empties.
Six final screens were reviewed; navigation, accessibility and current-phase
status findings are repaired. Signed build, full Swift quality and 27 affected
checks pass. The report retains physical/provider and native fault-matrix limits.

Next is Android relationship integration and installed acceptance; its new
API/models/store/controller/dialog and backup exclusions are local work in
progress, not yet compiled or part of the iOS commit. Then continue residency
receipts and ownership/lease/resource work. Browser `330254adf` passes every
required job except iPhone 16's fixed 500 ms media wait; the bounded observable
repair passes three local repetitions. New-head remote CI is still required.
Both PRs stay drafts, #34 remains `e9ef2decb` and unfinished, combined 43-version
migration dependencies/replay stay open, and paid services remain one final
launch bundle. Exact iOS fixtures are cleaned; listener and owned simulators are
stopped. The owned Gig database stays running for Android. Owner files and
runtimes are preserved. Older next-action/CI notes below are historical.

The preceding [browser relationship report](home-web-claim-relationship-recovery-2026-09-10.md)
completes explicit browser review and encrypted original/confirmation recovery,
including access through a permanent link after the claim leaves pending review.
Actual Chrome → production HTTP/service → SQL passes six submissions/three
receipts, lost replies, later rejection, stale review, competing tabs, key/draft
write failures, ciphertext corruption/restoration, current revocation/account
changes and held preflight/background recovery. Keyboard/narrow acceptance and
seven visual captures pass. Stale claims-list retention/false empty states are
fixed. Types/lint and all web checks pass; full backend/privacy pass on CI's
Node 22 line. The separate Node 24 socket observation remains documented.

Next is iOS relationship review with Keychain original/confirmation recovery and
installed HTTP/SQL acceptance, then Android, residency receipts and remaining
ownership/lease/resource work. Backend `3e421b5c3` still has three iOS device jobs
and Android lint/test/assemble running; other reported jobs pass. Refresh the
new exact head. Older Android CI was superseded/cancelled, not fully green.
Both PRs stay draft, paid #34 stays `e9ef2decb` and unfinished, combined 43-version
dependencies/replay remain open, and paid services stay one final launch bundle.
Exact fixtures/listeners are cleaned; the owned web and Gig database are stopped
with the local backup retained. Owner files and runtimes remain untouched.
Older next actions below are historical.

The preceding [relationship decision report](home-claim-relationship-decisions-2026-09-10.md)
records atomic decline/flag decisions, current authority and original/current
receipt recovery. Actual production HTTP/service/SQL and 12 observed races pass.
Pending/untrusted evidence no longer creates a property dispute. Final fresh
34-migration replay, all 39 SQL/pgTAP contracts, reviewed function lint and full
backend/privacy gates pass. Final populated upgrade preserves 15,114 original
rows across 363 tables. A deletion-policy dependency found by the complete SQL
gate is fixed in the final additive migration.

Next is browser prepared relationship review and encrypted original/confirmation
recovery with actual UI/HTTP/SQL acceptance, followed by native parity, residency
receipts and remaining ownership/lease/resource work. This is a backend checkpoint;
explicit client recovery remains unfinished. Legacy identical requests acknowledge
one historical intent, never a new decision after a later claim change. Android
`05c678efe` has all reported jobs passing except Android lint/test/assemble still
running; refresh the next exact head. PRs #32/#34 stay drafts, paid #34 stays
`e9ef2decb` and unfinished, combined 43-version dependencies/replay remain open,
and every paid service stays in one final launch bundle. Exact fixtures are
cleaned; the fresh relationship database is stopped with backup; the owned Gig
database remains for immediate browser work. Owner files/runtimes remain untouched.
Older next actions below are historical.

The preceding [Android conversion report](home-android-task-gig-publication-2026-09-10.md)
completes core native public review and encrypted original/receipt recovery with
installed app → production HTTP/service → SQL acceptance. Final r5 passes stale
review, lost replies, cold recovery, ciphertext corruption/restoration, exact
current Gig navigation, ten V1/V2 status screens and current revocation/recovery.
It preserves one Gig/receipt after three POSTs and a later cancellation/$30 price.
Visual and accessibility review verified the shared disabled-dock repair. Final
local build/quality and affected checks pass. Core task-to-Gig now has browser,
iOS and Android implementation and local workflow evidence, with advanced modes,
physical/provider and release-level acceptance still explicitly open.

Next is claimant relationship decline/flag transaction/recovery and residency
receipts, then ownership transfer/challenge and lease/resource cleanup. The current
relationship route still separates authority, mutation and audit; preserve the
completed invitation/evidence transactions while repairing it. Predecessor iOS
`f0230fe29` is fully green in CI, including SE. Refresh the next exact head.
Both PRs remain drafts; paid #34 `e9ef2decb` stays green but unfinished, combined
migrations stay open, and paid services remain one final launch bundle. Preserve
native GigDetail/web CompletionFlow changes from both branches at integration.
Exact SQL fixtures are cleaned; the owned listener and emulator are stopped; the
owned Gig database is stopped with its local backup retained. Owner files
and runtimes are unchanged. Older next actions below are historical.

The preceding [iOS conversion report](home-ios-task-gig-publication-2026-09-10.md)
completes core native public review and Keychain original/receipt recovery with
installed app → production HTTP/service → SQL acceptance. It also repairs false
Open/bidding/verified-address states discovered during visual review. Ten V1/V2
status screens and the full stale/relaunch/replay/revocation journey pass. Final
Swift build/quality and affected checks pass. Next is Android conversion (initial
API/models/encrypted-store work is in progress), then remaining ordered scope.
The browser head's only failed job was the SE filter timing check; its repair is
locally verified, while final-head remote CI remains required. Paid #34 is
unchanged/green but unfinished. Preserve native GigDetail and web CompletionFlow
lifecycle fixes alongside paid changes during eventual integration. Both PRs
stay draft, combined migrations remain open and paid services stay one final
launch bundle. Owned web/native listeners and simulator are stopped, exact SQL
fixtures are cleaned, and the owned Gig database remains for Android work.
Owner files/runtimes are unchanged. Older next-action notes below are historical.

The preceding [browser conversion report](home-web-task-gig-publication-2026-09-10.md)
completes core public review and encrypted original/receipt recovery in Chrome
against production HTTP/service/local SQL. Actual recovery, stale/cancelled states,
storage failure, competing tabs, current access/account changes and narrow/keyboard
journeys pass. Types, focused lint and 1,178 existing web checks pass. Next is iOS
conversion and installed acceptance, then Android and the remaining ordered scope.
Advanced composer options/provider acceptance remain explicit limits. Retain the
terminal cancellation guard when reconciling paid #34's `CompletionFlow`. Backend
`b08e280d5` passed all three remote iOS jobs; Android lint/test/assemble was still
running. Refresh the current browser head separately. Both PRs stay draft, combined
migration dependencies remain open and paid services stay one final launch bundle.
The owned Gig SQL/web runtimes remain available; owner files/runtimes are preserved.

The preceding [task-to-Gig publication report](home-task-gig-publication-2026-09-10.md)
records the verified atomic backend and exact HTTP/SQL recovery. The next action
is browser composer/recovery and actual Chrome acceptance, followed by native
conversion controls and installed journeys. Those UI workflows are unfinished.
The real rehearsal also repaired the missing Gig task-format schema contract and
source timestamp precision. Final 33-migration replay, 38 SQL/pgTAP contracts,
eight observed races and original-row preservation pass. Two predecessor iOS CI
wait failures have locally verified synchronization repairs (17 cases repeated
three times); final remote CI and the documented backend HTTP flake remain gates.
The dedicated simulator is stopped; the owned Gig replay project remains ready
for browser work. Both PRs remain drafts, combined dependencies are unreconciled,
and all paid services remain one final launch bundle. The owner explicitly wants
actual features, UI, transitions and failures verified, not unit-coverage targets.
Older next-action/CI notes below are historical where this checkpoint supersedes them.

The latest [Android recurrence report](home-android-task-recurrence-2026-09-10.md)
completes native controls, schedule projections and encrypted original recovery.
The installed workflow passes cold/background replay, later-pause preservation
and current denial. A rendering crash found by that journey is repaired and
verified under the actual theme. Full local gates pass (4,511 Debug checks, 80
existing skips), plus two installed theme/Keystore checks. Browser/iOS/Android
recurrence is now complete within the linked local/synthetic-provider limits.
Next is task-to-Gig, followed by the remaining ordered Home/payment scope.
Predecessor `8eacea7c8` is green in required CI; check the new milestone separately.
The dedicated recurrence HTTP fixture and emulator are stopped. Both PRs remain
unfinished drafts; combined migrations and final paid dependencies remain open.
The latest [iOS recurrence report](home-ios-task-recurrence-2026-09-10.md)
records explicit native controls, actual schedule status, protected original
recovery and passing installed simulator acceptance. The account-change cleanup
finding is fixed; 14 affected tests pass, with 136 related checks passed earlier.
Final build/Keychain verification and full Swift quality gates pass. Native
acceptance uses synthetic HTTP; real generation remains the earlier service/SQL
and browser proof. Android recurrence and its installed acceptance are now next,
then task-to-Gig and the remaining ordered Home/payment scope. The owned 18083
fixture and dedicated iOS recurrence simulator are stopped. Required CI on the
new exact head, combined migrations and final paid dependencies remain open.
The latest [browser recurrence report](home-web-task-recurrence-2026-09-10.md)
records completed browser activation/pause and protected original recovery,
actual Chrome with production service/local SQL, and the additive task status
projection. iOS/Android controls, native filters/copy and installed recurrence
acceptance are next. Engine `2a6f0b3ba` now has green required CI; check the new
browser milestone's exact head separately. Final combined migrations, remaining
Home/payment scope and all paid launch dependencies remain open.
The latest [recurrence engine report](home-task-recurrence-engine-2026-09-10.md)
records completed backend/API/worker generation and recovery. Explicit browser
and native controls are next; old saved rules stay inactive. Predecessor
`e4069f244` now passes all required CI. Refresh the next head's CI separately.
The [resumed native recovery report](home-native-ci-recovery-2026-09-10.md)
records the subsequent origin/PR refresh, iOS simulator-signing repair and
passing protected-store checks. Its newer observations supersede those specific
CI findings below; Android/browser/installed-journey gates remain open.
The subsequent [browser access report](home-web-task-access-recovery-2026-09-10.md)
closes browser findings 1 and 2 below with actual Chrome evidence. The
[confirmed recovery report](home-web-task-confirmed-recovery-2026-09-10.md) closes
finding 4 with actual encrypted IndexedDB, reload, competing-tab and corrupt-slot
acceptance. The [upload reselection report](home-web-task-upload-reselection-2026-09-10.md)
closes finding 3 with actual encrypted Chrome recovery, exact reselected bytes,
competing tabs, current metadata/retirement, corrupt storage and account changes.
All four browser findings below are now historical; remaining Home scope is open.
The resumed [installed iOS journey](home-ios-task-installed-journey-2026-09-10.md)
now passes end to end after repairing the blank attachment sheet and the test
workflow. Its newer evidence supersedes the original failed execution below.
The resumed [Android attachment report](home-android-task-private-media-2026-09-10.md)
closes the draft compiler/formatting, cancellation/temporary-file and stale image
findings. Local full gates, emulator controls/PDF and the installed complete
attachment journey pass. Remote required CI on the final head remains a separate
gate. Older failed/unbuilt observations below are retained only as history.
The latest handoff checkpoint lists all six pushed continuation milestones and
the next remaining scope. The new synthetic servers and dedicated simulators
were stopped after acceptance; existing owner sessions remain untouched. Refresh
current PR #32 CI rather than relying on a superseded run.
Read this document and the top of `PROJECT_HANDOFF.md` first; consult older
reports only for the next concrete task. Refresh Git and CI before relying on
the observations below.

## Working directories and source state

| Workstream | Worktree | Branch / PR | Last verified milestone before this checkpoint |
| --- | --- | --- | --- |
| Home and browser/native tasks | `/private/tmp/pantopus-home-permission-boundaries` | `codex/home-permission-boundaries`, draft PR #32 | `502de726f` iOS private task media |
| Paid task workflows | `/private/tmp/pantopus-staging-paid-gig` | `codex/staging-paid-gig`, draft PR #34 | `48afcc68f` Android payment opening identity |
| Production adoption planning | `/private/tmp/pantopus-staging-adoption-plan` | `codex/staging-adoption-plan`, no PR | `71473ed5a`; older report context must be reconciled with final source |
| Owner checkout | `/Users/yingpengwang/skinny-pantopus` | local `master` | `939878b4f`; intentionally not updated over owner edits |

The two active draft branches now preserve the additional work described below.
Use `git log -1`, `git status --short`, `git fetch origin`, and current PR checks
to resolve their actual checkpoint commit IDs. Do not infer that a branch has
been merged or deployed because it was pushed.

The main checkout has an unrelated modified `docs/PROJECT_HANDOFF.md` and two
untracked owner files: `docs/designs/pantopus-place-page-concept-2026-09-09.html`
and `docs/pantopus-place-social-design-2026-09-09.md`. Those were preserved and
must not be swept into these commits. PR #24 and other unrelated work remain
separate. Recovery logs, credentials, raw tokens and database archives stay out
of Git. The private operator continuation lives under the main checkout's
`.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.

## Completed milestones to preserve

- The full Beacon publish → notification → exact permitted post journey passed
  live staging/API and recorded device checks. The owner confirmed physical
  iPhone foreground, background and closed-app delivery, old blocked-link denial,
  mute/resume, global push off/restore, and the repaired Beacon-specific saved
  preference off/restore with no replay. Android emulator delivery, permission
  denial/restoration and expired-session exact return also passed within their
  documented limits. Do not repeat these completed fixtures or owner checks.
- Native saved-card setup, default/removal, account boundaries and cleanup are
  complete. Mail-code/multi-unit verification and recorded fixture cleanup are
  complete within their reports' synthetic/provider limits.
- Home role/record authorization, transactional task creation receipts, private
  documents/claim evidence, native task browse/create/edit, and durable assignment
  notifications have committed checkpoints. Current assigned recipients and
  preferences govern delivery; exact metadata routes to current permitted tasks.
- Recent Home milestones: `f24785404` iOS retained forms; `92a35b7f9` assignment
  outbox; `848bf28c6` Android retained forms; `c1cac2a30` iOS task routing;
  `9df1e4934` browser task routing; `f5ca4acfd` Android task routing;
  `502de726f` iOS private task attachments. Each has a linked dated report.
- Recent payment milestones include durable refunds, assigned authorization,
  hold-expiry recovery and stop/cancel/release actions across clients.
  `d2b9b42a6` keeps saved browser actions reachable, `4dec19088` adds Android
  stop recovery, and `48afcc68f` binds payment actions to their opening identity.
  These are source milestones, not certification of every payment journey.
- Production database backup was restored locally: all 299 archived COPY
  sections matched. Canonical fresh replay and populated upgrade rehearsals
  have passed their recorded checkpoints. External object bytes and final hosted
  ledger/Auth/storage adoption remain separate unfinished gates.

Evidence entry points: [Beacon journey](beacon-full-journey-2026-09-08.md),
[preference acceptance](beacon-push-preference-2026-09-08.md),
[platform notifications](notification-platform-verification-2026-09-09.md),
[Home assignment delivery](home-task-assignment-delivery-2026-09-10.md),
[browser task routing](home-web-task-notification-routing-2026-09-10.md),
[Android task routing](home-android-task-notification-2026-09-10.md), and
[iOS task attachments](home-ios-task-private-media-2026-09-10.md).
Payment reports live on `codex/staging-paid-gig`.

## First priority: close the known Home gaps

### Current PR #32 CI failures

Run [34484769214](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34484769214)
at `502de726f` passed backend, privacy, database replay, web, web E2E, iOS build
and Android instrumentation. It failed the following native checks. These are
diagnosed observations, not failures introduced by every draft file below.

1. All three iOS simulator jobs fail the old footer assertion in
   `PantopusTests/Features/Homes/ClaimUploadStepSnapshotTests.swift:58`. The
   approved current copy in `ClaimUploadStep.swift:15` describes current
   authorized claim reviewers; the assertion still expects the older assigned-
   reviewer wording. Update the assertion to the actual reviewed product policy.
2. All three also fail
   `HomeTaskSavedRequestTests.testProtectedStoreRoundTripUsesExactScopeAndMatchingClear`
   with missing Keychain entitlement `-34018`. `.github/workflows/ios-ci.yml:124`
   disables signing and clears entitlements in the shared build. Supply a properly
   entitled simulator test host for actual protected-store verification. Do not
   hide this test failure or infer a production Keychain defect from it.
3. Android's five `AddHouseholdTaskFormSnapshotTest` images are stale following
   the reviewed “Saved recurrence” copy and truthful scheduling disclaimer in
   `AddHouseholdTaskFormScreen.kt:472`. Differences are 1.513019–1.740916%,
   repeated on all retries. Review and refresh these five baselines. Formatting,
   static analysis, lint and compilation passed; this CI run stopped at JVM
   tests before APK assembly.

Private evidence: `/private/tmp/pantopus-pr32-ci-34484769214/failed.log`, adjacent
iOS logs and downloaded Android reports/deltas. Do not commit operator artifacts.
Refresh CI after fixes; the new checkpoint itself has not inherited a green CI.

### Browser task forms — draft implementation, review findings open

Seven new modules in `frontend/apps/web/src/components/home/tasks/` provide the
typed task model, current-session client, encrypted IndexedDB retained command,
create controller, shared form lifecycle, task collection and dashboard action
bindings. `TaskSlidePanel.tsx`, the Home dashboard and standalone task page use
the shared form. Creation saves an original UUID/payload before POST; edits send
only changed fields and preserve untouched timestamp/recurrence/zero budget.
Attachment retries retain original per-file IDs in the live panel, with explicit
retired-upload acknowledgment. No credentials or server session proof are stored
in the encrypted recovery payload.

Current verification: 20 rendered workflow checks pass in
`tests/homeTaskAttachments.test.tsx`; final checkpoint typecheck passes with zero
errors and focused source lint has zero warnings/errors. Those checks use a
storage test double. The actual encrypted IndexedDB browser journey and the full
web suite have NOT run for this draft. Earlier 1,145 passing web checks belong
to `9df1e4934`, not this new form implementation.

Independent source review found four required follow-ups, not browser-reproduced
yet. Address these before calling this milestone complete:

1. A fresh task detail 403/404 during save leaves the prior private fields and
   readiness visible. Clear rendered private task state and invalidate readiness
   on current read denial in `useHomeTaskForm.ts`.
2. `uploadHomeTaskMedia` internally awaits a session preflight before POST. The
   form can close/background during that await, yet the helper starts the POST
   afterward. Carry the lifecycle guard into the helper and check just before
   dispatch; distinguish this from an upload already sent.
3. Closing/reopening clears unknown per-file UUIDs. Reselecting the same bytes
   can create another upload after a lost committed response. Design explicit
   recovery/reselection of the unresolved identity; do not claim cold file replay.
4. `HomeTaskCreationController.finish` clears the retained command before its
   final lifecycle check and UI completion. Background/close after the IndexedDB
   delete is queued can suppress success after recovery state has gone. Retain
   confirmed recovery until it can be safely consumed, including competing tabs.

Then run focused failure/race cases, type/lint/full web gates and actual Chrome
acceptance: create → lost reply → close/reopen → exact original recovery, sparse
edits/clears, current denial, account change, corrupt/competing storage, and
attachment retry/reselection. Inspect encrypted stored envelopes and verify no
replacement POST. Use localhost synthetic HTTP and keep logs/screenshots private.

### Android task attachments — unbuilt draft

The 22 Android files add API DTO/service/repository/DI, exact-task attachment
access/controller/ViewModel/dialog/picker, shared private preview and focused
checks. The detail screen opens the media dialog. Explicit retired-upload
acknowledgment binds the original failed POST ID and current stored credentials;
it issues no replacement POST/DELETE. No Gradle, compiler, app build or installed
journey has verified this candidate yet.

Source review identified a cleanup gap: `HomeTaskMediaRepository.kt:54–60` and
`HomeTaskMediaPicker.kt:13–23` return private byte arrays through cancellable
`withContext(IO)`. Cancellation on dispatcher return can discard bytes before
the caller can erase them. Close this ownership/cleanup boundary. PDF preview
uses a temporary `cacheDir` file; normal cleanup does not cover process death.
Do not describe it as strictly memory-only. Pending file bytes/UUID survive only
ViewModel lifetime, not process death.

After fixes, run formatting, Detekt, lint, JVM checks and app builds. Include new
`HomeTaskMediaApiTest`, `HomeTaskMediaAccessTest`, `HomeTaskMediaControllerTest`
and `HomeTaskMediaTerminalTest`, plus the existing Home task/access/detail/list
and private claim-evidence suites touched by the shared preview. Run
`HomeTaskMediaControlsTest` on the emulator, then the full installed picker →
preview → revoke → removal/recovery journey. Two control tests alone are not
full journey acceptance.

### Installed iOS task journey — build passed; first execution failed

The [installed journey report](home-ios-task-installed-journey-2026-09-10.md)
and committed UITest/loopback fixture preserve the exact plan. Both actual build
attempts passed. The first installed execution reached one synthetic login
request, then timed out awaiting the signed-in UI at UITest line 146. The fixture
recorded no task, creation receipt or media. An inspected screenshot remained on
the login screen. It did NOT establish create/picker/preview/removal acceptance.
The unsuccessful run was interrupted for this owner-requested checkpoint.

Next diagnose login-response decoding/session persistence and the entitled test
host before retrying; the observed result does not establish the cause. Make
failed waits stop the remaining journey. The dedicated synthetic simulator is
`A7714AC8-6F53-4DCD-A233-3028B19275C6`; keep the owner's other simulator/phone
sessions untouched. Fixture binds `127.0.0.1:18081`; existing port 8000 is a
separate SSH listener. Private build/run scripts and evidence are listed in the
operator handoff. Use a fresh synthetic simulator or ordinary logout for repeat
acceptance, never erase another account's Keychain.
The unsuccessful runner and loopback fixture were stopped, and this dedicated
simulator was shut down for the checkpoint. Other simulators/listeners were left
alone. Restart the fixture deliberately before resuming its tests.

## Payment continuation on PR #34

All CI at the last completed milestone `48afcc68f` passed. The new checkpoint
adds only `backend/contracts/gig-tip-contract.md` and `backend/stripe/gigTipProof.js`
plus documentation. The proof helper passes syntax checking, but has no executed
behavioral verification and is not wired into the tip routes. No durable tip
migration, reservation, service or client implementation is complete.

Next implement durable tip requests before repairing optimistic client success:
reserve original UUID/Payment/immutable amount+terms+method before provider work;
retain the same provider key; verify exact payer/payee/customer/currency/metadata,
mode, fee/destination and charged amount. `check` performs provider reads only;
`cancel` needs durable proof of zero charge. SDK completion or HTTP success is
insufficient. Unknown/historical pending tips block new charges; reconcile them
without inventing an old confirmation time. Preserve payer-only completed and
owner-confirmed Gig policy, minimum 50 cents, maximum three successful tips,
full tip to worker and current Connect account-record requirements. Verify the
contract and existing financial conventions before using the draft helper.

Migration `20260910190000_paid_gig_tip_receipts.sql` is RESERVED, not implemented.
Home already owns `170000` task receipts and `180000` assignment outbox; reserve
Home additions at `200000` or later after coordination. Audit all older cross-
branch timestamp collisions and dependencies before combining PR #32/#34.

Finish tip backend SQL/concurrent replay/populated upgrade and service proof,
then browser/iOS/Android retained recovery and SDK lifecycle. Continue remaining
started-work/no-show/fee/completion/reopen/dispute/Connect/debt behavior and
durable attention, followed by actual sandbox/provider and installed journeys.
Preserve balances, receipts and historical financial records; no live charges.

## Remaining sequence through launch

1. Resolve the concrete CI and draft review findings above, verify and commit
   each meaningful milestone. Keep PRs #32/#34 draft until their final combined
   scope, migration ordering and current checks are ready for integration.
2. Complete Home task recurrence client controls and actual acceptance (the new
   backend engine is verified; old stored rules remain inactive),
   task-to-Gig, relationships/residency exact receipts, ownership challenge/
   transfer, lease and resource/derived-data cleanup. Inventory reachable Home,
   Pulse, mailbox and marketplace workflows and finish their remaining gates.
3. Complete payment paths above and remaining notification/account lifecycle
   coverage. Existing physical Beacon/native saved-card checks stay complete;
   physical Android delivery and other explicitly unverified OS/provider paths
   must retain their limits. Browser notification cache/account lifetime needs
   separate review beyond exact-task routing.
4. Complete real OAuth callbacks and real email delivery/recovery verification
   using existing capacity where possible. Controlled SMTP/API tests do not
   certify external delivery. Keep vendor-dependent cases clearly pending.
5. Combine the release source and final migration stream. Rehearse empty replay,
   populated upgrades and preservation of original records/entitlements; reconcile
   hosted ledgers, managed Auth/storage, external file backup/restore and schema
   differences. Produce concrete deploy/rollback/version/flag/candidate plans.
6. Verify release candidates across web, iOS and Android with integrated Home/
   Pulse/Beacon and adjacent workflows, meaningful access/error/retry checks,
   accessibility and capacity/load/retention observations. Review final CI and
   use the exact reviewed head when merging. Earlier PR #14's CI waiver does not
   waive the current release checks.
7. After all work achievable without new spend is ready, present ONE consolidated
   owner launch-preparation list of every paid dependency/subscription, including
   Smarty. The owner will purchase/activate them together. Smarty's existing
   reminder remains paused; do not create duplicate reminders or buy a plan.
8. Run the newly enabled provider acceptance, resolve findings, then carry out
   reviewed production cutover/post-deploy/rollback readiness and a small pilot.
   Local/CI passes alone are not evidence that every feature is complete or that
   production has been upgraded.

The owner prioritizes working, maintainable, scalable workflows over unit-test
counts. Use tests as evidence for consequential failure modes and spend remaining
acceptance effort on actual journeys. Do not promise zero bugs, fabricate a
completion percentage, repeat completed owner checks, or spend money now.
