# Pantopus project handoff

Updated September14,2026. The user resumed verification and development with full
permission: inspect existing implementations, repair demonstrated bugs/security
issues, preserve working behavior and screen designs, then cover the remaining
features. The [80-row inventory](REMAINING_WORK_2026-09-11.md) is the ordered backlog;
its8 locally closed/72 partial or open rows are not an effort/completion percentage.
Follow [AGENTS.md](../AGENTS.md). R05 and the app remain incomplete.

## Current state — September14

**Master:** `e775af9ae393c1e961df8f0043e3aed734326196` after authorized
[PR45](https://github.com/WangPantopus/skinny-pantopus/pull/45). All15 applicable
checks pass/one Seeder path skip in [CI34886464860](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34886464860).
The master tree exactly matches tested `a25b5df61`. This repairs existing expired
residency-letter projections and labels across web/iOS/Android. Historical PDFs
and screen layouts are preserved. R06 remains open; see the [expiry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-residency-letter-expiry-projection-and-labels).

The Home chain merged through [PR43](https://github.com/WangPantopus/skinny-pantopus/pull/43)
at `0cb4f3c600` (all16 CI checks passed). PR32 is also marked merged; PR38–42
were closed as incorporated, preserving source branches. Existing file-picker
repair [PR44](https://github.com/WangPantopus/skinny-pantopus/pull/44) merged at
`f6dbbe2eb` (six applicable checks/five path skips). Their reviewed trees exactly
matched master. No hosted deployment, migration adoption or provider activation ran.

**Remaining open PR:** [PR34](https://github.com/WangPantopus/skinny-pantopus/pull/34)
remains draft. Its isolated integration worktree is
`/private/tmp/pantopus-paid-gig-integration`, branch `codex/paid-gig-integration`;
the canonical PR branch is `codex/staging-paid-gig`. The current legacy recovery
checkpoint is `e700862f1`, following coordinated Android `c6b1f830e`, iOS `b98cc283c`,
web `1b9ff598e` and backend `410ae2767`. It incorporates actual PR43/44/45 master.
The preceding coordinated head `8203a3ea7db551cce24041815aa7cd4302a9502d` passes
all15 applicable checks/one Seeder skip in [CI34907347192](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34907347192).
Current `14b8c3ae5` CI34918875520 has passed backend, web, safeguards and complete
schema replay; native jobs are still running. The following cold-entry checkpoint
requires its own current-head CI.
Do not merge/deploy PR34 yet.

**Current original-tip behavior:** the existing Payment.id and financial fields
reserve one request before provider creation. Metadata retains missing original
terms and control state; `20260914040000_gig_tip_original.sql` adds no table or
column. The existing StripeService freezes provider parameters, serializes work,
retains the same provider key and rejects unsafe retries beyond23 hours. Fresh
matching PaymentIntent/Charge proof and a committed matching receipt are required
for success or zero-charge cancellation. A late initial submission cannot bypass
a same-UUID canceled receipt. Preview/local-read routes and the existing tip POST
use current actor/session and exact original terms. Previous clients without that
command are rejected before provider work; matching clients/backend deploy together.

Backend evidence passes86 focused assertions,12 actual-service/local-SQL scenarios
(129 queries with synthetic provider/notice transport),65 SQL contracts, generated
pgTAP and eight separate-connection cases. Function lint checks358 functions/107
bindings with zero errors/eight existing warnings. Full backend repeat passes5879
with16 skips; the later cancellation-before-admission case passes focused/SQL
checks. The first full run's unrelated Home socket interruption and successful
unchanged-file rerun remain recorded in the [verification report](VERIFICATION_FIRST_2026-09-13.md).
All schema work is limited to the owned local database; no hosted change ran.

**Current client evidence:** existing web/iOS/Android pickers and SDK flows now
retain one nonsecret original, keep its amount/UUID through lost replies/reopening,
and require current identity, stored original and receipt before cleanup/success.
No screen/layout is replaced. Web reuses encrypted IndexedDB and iOS the existing
KeychainStore. Android uses the existing platform encrypted-preference mechanism
through one narrow typed adapter; its existing Home/card/refund stores have other
contracts and are not repurposed. SDK credentials and server session proof are
never retained with the original.

- Web156 assertions and TypeScript pass; scoped lint has zero errors and the
  recorded warnings. Actual Chrome verifies encrypted reload, same-ID retry,
  exact cleanup and stale adoption denial across two tabs, with synthetic API/provider.
- iOS21 final tip tests plus29 unchanged authorization/bid checks pass (50 distinct
  selected checks across two runs). Real simulator Keychain persistence,
  this-device-only/unsynchronized attributes and cleanup pass; SwiftLint/SwiftFormat
  pass. This is not an installed tip UI or real-provider journey.
- Android `c6b1f830e` passes124 selected unit tests on R3, including existing bid,
  authorization, saved-task and stop-entry compatibility. R4 changes only the
  screen's retirement cleanup and its actual control test. R4 format/detekt and
  both APK builds pass. All5 emulator checks pass: four actual Compose control
  checks and one real Keystore/encrypted-preference check. Both installed APKs
  match the candidate hashes. Frozen amounts, retired-account clearing, scoped
  reopening and exact cleanup pass. Typed API/SDK outcomes remain synthetic.

See the [Android evidence](VERIFICATION_FIRST_2026-09-13.md#existing-android-tip-handler-original-recovery-and-controls),
[web evidence](VERIFICATION_FIRST_2026-09-13.md#existing-web-tip-confirmation-and-protected-original-recovery),
and [iOS evidence](VERIFICATION_FIRST_2026-09-13.md#existing-ios-tip-handler-and-protected-recovery).
Private source/product/run bindings are under `existing-tip-provider-proof-r1`.
Android format/static failures in R1/R2 are preserved; the corrected R3/R4 runs pass.

**Existing legacy-tip recovery:** `e700862f1` extends the same Payment/service
and three existing pickers. Local historical reads retain the existing Payment.id,
amount and worker with unknown confirmation time. Fresh matching provider evidence
and a locked unchanged Payment snapshot register that same row; legacy commands
can only check or explicitly cancel the existing intent. They never create another
intent or expose SDK confirmation. Historical currency, capture/cooldown, refund,
dispute and transfer fields are preserved. One forward function/index migration
`20260914050000_gig_tip_legacy_recovery.sql` adds no table or column; the preceding
reservation migration is unchanged. Multiple old pending rows stay recoverable and
continue blocking a new tip until each is reconciled.

Focused checks pass100 backend assertions,53 web assertions,24 iOS tests and41 Android
unit tests. Web types/scoped lint and native format/static checks pass within the
recorded warning limits. Actual service/local SQL passes19 scenarios with synthetic
provider/notice transport,10 separate-connection cases pass, all65 SQL contracts
pass and function lint has359 functions/107 bindings, zero errors/eight existing
warnings. See the [legacy evidence](VERIFICATION_FIRST_2026-09-13.md#existing-legacy-tip-recovery-without-replacement-charges).
Full installed/provider acceptance remains open. The next locally verified
checkpoint repairs cold historical discovery in the existing detail screens. A
fresh personal-payer session can reach an existing payment after the current
worker/confirmation disappears; an empty preview does not admit a new charge.
Web87 assertions, Android76 unit checks and iOS26 tests pass, with source-bound
static checks. Seven existing source/test files change; no migration or layout
change. See the [cold-entry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-tip-entry-without-a-saved-client-request).

**Other paid work preserved:** the existing cancellation Other explanation is
private in the original GigStopRequest and encrypted web recovery. Public receipts
carry only its hash; the forward14030000 function update removes public free text.
Its65 backend/57 web/38 Android/22 iOS checks and real local SQL/synthetic-provider
journeys pass within the report limits. The nine previously unmerged paid migration
versions moved byte-for-byte to14020100–14020900 after current Home master. No
master migration was rewritten; correct `MIGRATION_BASE_SHA` policy and prior
complete-schema CI validate ordering. Earlier failed attempts remain recorded.

**Next:** repair durable tip delivery using existing payment/notification and
worker implementations, then actual installed all-platform/provider journeys and
final current-head CI. Legacy commands and cold discovery are locally verified;
remaining acceptance limits are not a claim that the feature is missing. Recheck existing implementations before each change.
P01–P03/P07–P09, R05/R06 and the wider80-row inventory remain open within their
stated limits. After the paid scope, continue the remaining existing-feature
inventory; preserve accepted subjourneys and screen designs.

**Runtime/ownership:** owned Chrome tabs/servers, iOS simulator and Android AVD are
stopped; their data and accepted products are retained. The Android verification
used its private AVD home and created no global registration. Exact random tip
storage-key cleanup passes. Direct PostgreSQL64522 and the owned Home rehearsal
REST18089 remain reserved; inspect private leases before use. Owner checkout,
other worktrees and the paused renewal/two-table draft remain untouched. No hosted
deployment, migration adoption or provider activation ran.

## Earlier Home verification context

The details below retain accepted evidence and historical next-action wording.
The current state above takes precedence; do not repeat already accepted work
solely because an older paragraph says next.

**Current repairs reuse existing implementations.** The one existing unmerged
service-only lease transaction uses existing leases, invitations, residents,
occupancies and audit records. No replacement screens or tenancy tables were
added. Current Home/authority checks and atomic decisions protect approval,
acceptance, end/move-out, tenant cancellation and request/invitation creation.
Existing web/native callers preserve original dates, recover saved requests and
retire old Home/account/departure work. Reuse unchanged accepted evidence.

Recent follow-ups: existing unit vacancy reuses lease-end and per-unit authority;
old invitation URLs reach the existing recipient screen; the existing sharing
modal keeps the link; real multi_unit parent Homes cannot admit tenants. Creation
now rejects invalid dates/revoked authority, saves invitation/audit atomically and
recovers the same row from a retained random proof. Web closing/reloading uses the
existing encrypted recovery database, scoped to origin/account/unit, and POST
binds the observed actor. Notification recovery uses the existing Notification
idempotency column/index; duplicate retries do not re-emit or reset a read notice.

Detailed source-specific evidence is in the [verification report](VERIFICATION_FIRST_2026-09-13.md):
[creation](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-creation-boundaries),
[protected reload](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-retained-recovery),
[notice recovery](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-notification-recovery).
Latest bounded checks pass186 backend/notification tests,70 rendered web lease
tests, standalone web TypeScript/scoped lint, full lease SQL contract and generated
pgTAP wrapper. Application-function lint has266 functions/85 trigger bindings,
zero errors/eight existing warnings. Actual browser/SDK/HTTP/SQL and9 actual
IndexedDB/WebCrypto checks pass within their documented synthetic boundaries.

**Git/CI:** PR38 at c51740fce passes all15 applicable checks/one unchanged
Seeder skip in [CI34840961607](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34840961607), including both native platforms.
PR39 at461120fca passes all8 applicable checks/three path-based skips in
[CI34843857113](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34843857113).
Their commits are now in master through PR43; both stacked PRs are closed as
already incorporated. Preserve the earlier failed runs as failed: CI34836085491
had a stale generated SQL wrapper; CI34843214305 caught an immutable migration
edit. Existing generator synchronization and the forward function update fix those
issues. Before migration changes check the actual PR base; all54 wrappers synchronize.

**Next:** submit the bounded residency-letter expiry repair, check its required CI
and merge only if green. Continue PR34's existing cancellation presentation and
tip/recovery/provider gaps. R06 still needs its wider remaining lifecycle/device
acceptance; trace existing/archived callers before adding anything. Existing web
“Upload your lease” links use the separate residency-claim flow; do not merge
those contracts or invent screens from an inventory row. The existing iOS controls and web landlord reader are now locally verified within the [client evidence limits](VERIFICATION_FIRST_2026-09-13.md#existing-ios-lease-attachment-and-web-landlord-reader). Inspect each existing caller before editing; preserve screen design.
See [attachment evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-lease-file-storage-and-request-binding).
The request-controls follow-up is verified on draft PR42. The previously open installed Android request journey is now verified
within the [recorded limits](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-request-controls-and-calendar-validation).
Existing shell state binding fixes stale step/action controls; existing native
validators reject impossible calendar dates, and existing dirty-form guards cover
date-only, phone-only and message-only edits. Five existing product files change;
the only new file is an Android rendered regression test. Android passes74 final
checks and static checks; all52 final iOS request model/snapshot checks and
SwiftLint/SwiftFormat pass. No screen/layout/schema
replacement. Other wizard callers remain candidates for rendered verification.
Draft [PR41](https://github.com/WangPantopus/skinny-pantopus/pull/41) now includes
`1ed6f6793`, which fixes an existing Support Train test's shared FIFO response race
using the already available session-scoped route stubs. All13 selected tests pass.
Original [CI34851208086](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34851208086)
remains failed for that iPhone16 fixture; the other original applicable checks pass.
Replacement [CI34855898348](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34855898348)
passes all11 applicable checks/five path-based skips. No product Support Train
change or disabled assertion. PR42 at e16c0c499 passed all original applicable
checks except its iOS build: Sentry binary download hit a runner cache collision
before compilation. Original [CI34857194083](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34857194083)
remains a failed attempt; the failed build/dependent jobs were retried as attempt2
on the same source. Attempt2 now passes all11 applicable checks/five path skips, including all three iOS devices, Android and database replay. No app change or cache-policy workaround.
Draft [PR40](https://github.com/WangPantopus/skinny-pantopus/pull/40) at a1069e1de
repairs existing private document delivery and generic uploads; all6 applicable
[CI34845551425](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34845551425)
checks pass/five path-based jobs skip. Seven document and12 generic-upload actual
HTTP/SQL cases,115 selected tests and privacy gates pass, with exact fixture cleanup.
See [document evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-document-download-authorization)
and [upload evidence](VERIFICATION_FIRST_2026-09-13.md#existing-standalone-file-upload-compatibility).

Both native routers interpreted /invite/lease/<proof> as a token literally named
lease. The Android baseline reproduces it. The native candidate keeps
the complete proof and lease kind through the existing root navigation/invitation
screen. It calls only authenticated recipient-only preview/acceptance bodies and
validates the returned Home, actor and active membership. Not now closes without
a recorded decision. Existing recovery/session lifetimes and screen designs are
preserved. All134 selected Android routing/model/unchanged snapshot checks and
static checks pass. All88 selected iOS tests pass. Installed iOS verifies the
existing offer layout/dates, Not now without a decision, sign-in replay, and lost
acceptance response recovery with the same SQL lease/occupancy. Android also passes the installed offer, Not now, saved-response-loss recovery
and signed-out replay with no automatic acceptance or duplicate lease/occupancy.
The installed APK hash matches the candidate; an initial IDE snapshot restored an
older APK and was corrected before acceptance. See
[native evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-invitation-links).
No screen, schema or new tracked file is added by the candidate.

Private lease client coverage remains partial. Its backend reuses File,
HomeLease, homeDocumentStorage and the existing recovery worker; the new route
only supplies the missing applicant/current-authority boundary. One forward
migration extends existing functions and permits an ownerless File only for a
retired private lease upload. Parent deletion preserves immutable cleanup keys;
no new tables or screen/layout changes. An abandoned draft's Home-delete blocker
was reproduced and repaired in the existing eligibility function. All244 selected
backend tests/privacy gates, eight SQL contracts and16 actual HTTP/SQL checks pass.
The populated forward rehearsal preserves374 table fingerprints and all existing
function identities/grants; application lint checks270 functions/88 trigger
bindings with zero errors/eight existing warnings. Actual storage and login are
synthetic in these bounded checks; hosted provider/rollout criteria stay open.
The subsequent iOS-to-web journey and Android attachment journey are locally verified within their reports; web tenant entry, remaining native readers and real provider acceptance stay open. Legacy generic S3 direct URLs remain unaccepted private evidence.

The current client milestone passes248 selected backend tests,148 web tests,60 iOS tests and18 actual HTTP/SQL cases, plus types/lint/format/privacy gates. The existing iOS file picker/card/removal/Submit controls reuse the existing multipart uploader and session lifetime. Lost upload/request replies recover the same File/request. The existing web property query omitted request metadata; its safe projection now exposes message and File ID, and RequestsTab reuses the private byte renderer. An installed iOS request opens in the actual browser reader; revocation during delivery and account changes prevent old private content appearing. All679 installed app files match the final tested product. Drafts are in memory, not durable across restart. Login/object storage/notices are synthetic, with real local API/database behavior; hosted delivery and all-platform completion remain open.

The Android follow-up passes69 selected tests and static/build checks. Installed
Android verifies real picker selection with a Unicode filename, committed-upload
response-loss retry, explicit failed-removal retry and committed-request recovery
without a second lease. Its final caption-only correction passes three Details
rendering checks and static/build gates; the final installed APK hash matches.
The installed functional journey is the preceding candidate, with all other
application/test source identical. No new screen, migration or table. See
[the source-specific Android evidence](VERIFICATION_FIRST_2026-09-13.md#existing-android-lease-attachment-controls).

**Native evidence/limits:** unchanged request/display source passes50 iOS/49
Android focused/rendering tests and static checks. Installed iOS covers Back/
Discard, saved-request/account/foreground recovery, correct calendar/status,
the earlier unavailable Attach feedback and invalid-date rejection/corrected save.
Live forms no longer insert sample files/data or promise email delivery. iOS and Android Attach are now connected and locally verified within their reports; all-platform completion remains open. Installed Android now passes the actual request route/SQL journey and real
Compose control/discard regressions under the recorded native request limits. Reuse the retained
products; one heavy native build at a time. Provider identity/delivery, combined
populated adoption and hosted rollout remain open. Notification recovery is
best effort and requires retry after a lost process; no eventual-push claim.

**Owned runtime:** private root `/private/tmp/pantopus-lease-transaction-r1`;
Next18110 is stopped after restoring its private harness page. The invitation fixture on API18109 is stopped. Exact owned Home, HomeLease,
HomeOccupancy, HomeLeaseInvite, HomeAuthority, HomeAddress and User cleanup is zero
under native-invitation-r1. Unit API18117
and notice API18116 are stopped.
The unit fixture has zero remaining owned Home, User, address or command rows;
source/evidence and exact cleanup are recorded in the private checkpoint. Earlier unit/invitation/sharing/building/
creation/retention/native API fixtures are stopped with exact row cleanup. The
owned iOS simulator, Android AVD and this session Android Studio are stopped;
owned Android registration was released and device data/products retained.
Android request verification finished on the matching calendar candidate APK.
API18109/fb23 is stopped, with exact Home/lease/occupancy/invitation/authority/
address/User cleanup zero under android-request-r2. Owned Android AVD and IDE are
stopped; only its owned registration was released, retaining device data/products.
The owned iOS simulator is stopped after its final bounded regression suite. The
incomplete worktree-only Gradle accessor cache was quarantined; no shared/user
cache was cleared. Owner iPhone17,
Bill Acceptance and Home Recurrence Acceptance devices remain untouched. The
schema-only `home_landlord_verify_20260913_r1` database/REST18089 remain reserved;
direct PostgreSQL64522 responds. Its existing Home-create function includes the
unit candidate body, with unchanged signature and passing generated SQL contract. Docker control stalls: use the private direct-SQL
helper that verifies the exact database, not repeated Docker calls/global restart.
The private lease File candidate is now applied only to this owned rehearsal
database (including the existing Home-delete eligibility extension). All fb26
HTTP fixtures are cleaned. Subsequent attachment API18109, browser proxy18117 and owned simulator are stopped. Both installed-client fb27 cycles have zero remaining owned rows/objects. The exact synthetic picker file was removed. Build/test products and source bindings are retained privately.
Android fb28 attachment fixtures are also exactly cleaned (all eight row/object
counts zero), API18109 is stopped, the owned emulator is stopped and registration
released, and its exact synthetic picker file/reverse mapping are removed. R6/R7
products and evidence are retained. Inspect the private current-checkpoint/runtime leases before reuse; clean exact
owned fixtures afterwards. Credentials, tokens, archives and operator logs stay
outside Git/chat. Evidence is mirrored to the owner's private
`.pantopus-recovery/audits/20260913-lease-transaction` directory.

**PR disposition:** PR43 and PR32 are merged; PR35/36/37 were already merged into
the preserved Home chain. PR38–42 are closed as incorporated through PR43, not
individually marked merged. PR34 remains draft and needs the recorded fixes and
acceptance gates. Verify fresh remote state before further integration.

## Accepted native history

Both installed own-review history readers and both separate fresh native
applicant/reviewer cycles pass. Each fresh cycle retains two submissions, two
immutable decisions and one completed removal, followed by denied old Home-link
access. Current authority and historical decisions remain distinct. All history
fixtures are exactly cleaned; accepted products and private evidence are preserved.

The [iOS report](home-ios-residency-review-history-2026-09-13.md) binds the signed
product and all 679 installed app files, reader pagination/detail/account/retry
behavior, delivered old 200 responses after newer denials, and the fresh cycle.
Its lost rejection reply uses one UUID with canonical SQL replay; wire hashes differ.
The [Android report](home-android-residency-review-history-2026-09-13.md) binds Debug
and optimized Release products, installed readers and its fresh cycle. Android's
held reads cancel or abandon their sockets; they are not proof of delivered stale
bytes. Its lost rejection reply uses one UUID and one wire hash. Secure dialog
capture and driver-only interruptions retain their stated limits.

See [the integration report](home-native-history-wip-2026-09-13.md). Reader/product
source `9350896c4` also passed all 16 checks in CI 34768705945. The later iPhone 16
failure in CI 34774032459 was a global request-count assertion; the repaired test
filters history routes. It changes no accepted application or migration bytes.

## Preserved current-claims acceptance and paused work

The pre-restoration PR #36 acceptance checkpoint is
`1c5f7bb1bc4686ea41f411f6bf554dbf7dd2efe1`, preserved in
`/private/tmp/pantopus-home-current-residency-claims`. Final exact-head
[CI 34781479982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34781479982)
passes (15 successes and one unchanged Seeder skip). Its accepted
privacy/recovery application source is `4d4183a79111ba06f1df8e713dbcbc4dd9502ad8`.
Read its [accepted report at the candidate head](https://github.com/WangPantopus/skinny-pantopus/blob/1c5f7bb1bc4686ea41f411f6bf554dbf7dd2efe1/docs/home-current-claims-wip-2026-09-13.md).

Recorded actual HTTP/SDK/SQL, both browser consumers and both installed native
queue journeys pass, including populated/error/retry, account/background/restart
and stale responses after newer denial. Protected rejection commands drain the
queue. Exact fixture cleanup, preserved products and three durable evidence
archives are recorded. Owned current-claims REST/API/web and native devices are
stopped with data retained and leases released. Inspect leases before reuse.

The additive migration creates a service-only reader over existing tables; it
creates no tables. Populated upgrade preservation passes, but combined paid/Home
adoption and hosted rollout remain open. Browser type checking has zero errors;
standalone API checking retains 39 baseline diagnostics and no candidate-only
errors. Android optimized codec verification is not Release UI acceptance. Preserve
all other report limitations. Primary now includes the privacy repair. Combined migration inventory is
50 Home / 21 paid / 59 combined, with 12 identical shared versions and zero
collisions at this source checkpoint; combined adoption remains open.

The uncommitted renewal worktree `/private/tmp/pantopus-home-residency-renewal`
stays paused at #36's head. Its proposed two-table renewal migration and contract
are neither applied nor pushed. Compare existing claims, occupancy, submission
commands and review receipts before deciding whether any new schema is needed.
Its small storage-check/test patch is also unaccepted; larger storage consolidation
was deferred and preserved privately. Do not treat this draft as an implementation
requirement. The reconciliation retains exact paths and dispositions. The supplementary
read-only reuse review is preserved in the owner checkout at
`.pantopus-recovery/audits/20260913-claims-presentation/R03_REUSE_REVIEW.md`.

The older documentation run 34784251075 at `a1d278e33` failed one iPhone SE
`HomeTaskMediaViewModelTests.testSessionReplacementDuringUploadCannotPublishOldCompletion`
setup wait: the attachment request did not start within the fixture's 100 × 5ms
poll. It failed before the session-change assertions. The current candidate
passes that test on all three iOS devices; do not relabel the older run green.
Keep a bounded test-stability follow-up in G05 instead of repeating unchanged
app journeys or assuming a production defect from that timeout.

## Preserve and continue

Keep owner work in `/Users/yingpengwang/skinny-pantopus`, every other worktree,
accepted products, database state, devices and private evidence intact. Before
using a device, API or database, inspect the current explicit lease. One heavy
native build at a time; never install loopback builds on a physical iPhone.
Credentials, tokens, database archives and operator logs stay outside Git and chat.

The private index is
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.
Durable evidence is under its linked `home-invitation-handoff-20260912` root.

Preserve accepted invitation, Task first-use and removal journeys instead of
repeating them. Their reports and the inventory retain each boundary. The
[previous primary handoff](https://github.com/WangPantopus/skinny-pantopus/blob/f149896378893c6e8308b8790085695c5dd9c449/docs/PROJECT_HANDOFF.md)
and [handoff history](HANDOFF_HISTORY_THROUGH_2026-09-12.md) retain detailed earlier
milestones. Paid/provider activation belongs in one final launch bundle; concrete
production release/rollback preparation precedes any required cutover authorization.
