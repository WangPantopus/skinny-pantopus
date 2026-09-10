# Pantopus project handoff

Updated September 9, 2026. This is the continuing-work entry point. Detailed
reports below retain their original dates; their historical blockers must not
be mistaken for current status. Refresh Git, CI and infrastructure observations
before changing anything. A merged branch is not a production release.

## Current objective and first action

Finish the existing **Home, Pulse and Beacon** journeys, then the remaining
platform/account/vendor checks and production upgrade/release preparation in
the ordered backlog below. The owner now requests autonomous continuation and
authorizes iOS simulator use for remaining iPhone app checks. Preserve the
recorded distinction between simulator coverage and real APNs/device delivery.
Do not repeat completed physical iPhone Beacon preference acceptance.

### Inventory follow-up checkpoint — September 9

The [release inventory](staging-release-inventory-2026-09-09.md) now distinguishes
reviewed naming equivalence, missing columns/RLS, broader Home policies and
zero-row precondition findings. The [Home role audit](home-role-policy-audit-2026-09-09.md)
records the proposed defaults and required guards. No hosted reconciliation or
role grants ran. First Home effective-permission source is committed/pushed at
`2fabe0c94` in draft [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32):
4,620 backend tests, privacy gates, 29 web hook tests and 19 SQL contracts pass.
Direct IAM/deletion, legacy RLS and task/calendar record restrictions remain next.

Draft payment PR #31 is at `2e7b04293`, with all current-head CI passing.
Its additive migration is applied only to Free staging and private candidate
`2e7b04293`/`2e0a32e8b0e2`; native SDK acceptance and exact cleanup are active.
PR #29/#30 are merged. Final candidate replay, effect/version manifest,
external-object recovery and integrated acceptance remain unfinished. Older
checkpoint entries below are historical where they conflict.

### Current continuation and release inventory — September 9

The active feature priority is `/private/tmp/pantopus-staging-payment-sheet`,
branch `codex/staging-payment-sheet`: owned SetupIntent resume/reconciliation is
committed and pushed; native lifecycle checks and atomic default/removal repairs
are in progress. No live payment fixtures or candidate changes ran yet.
PR #29 merged as `3009eb0be78efc900c234cc8588a7206526f9626` after full final CI
at `76ada1aa1` (run `34425328329`); modern mail staging acceptance and exact cleanup
are complete. The private candidate remains `694a213e2`/`68e3e052a578`, with
`312b5a382fd6` retained stopped. Public/browser/production runtimes are unchanged.

The [read-only release inventory](staging-release-inventory-2026-09-09.md) is
isolated in `/private/tmp/pantopus-staging-adoption-plan`, branch
`codex/staging-adoption-plan`. Fresh Free staging catalog/reference/managed
inventories are captured privately. Comparison finds one missing grant table,
permission/RLS and three routine-definition differences requiring classification;
calendar reference behavior matches despite generated ID/timestamp differences.
No hosted reconciliation, ledger adoption or production query ran. The next
adoption task is an exact final-stream version/effect manifest and local clone
rehearsal, preserving records and existing IDs. Ordinary member IAM defaults and
external-object recovery remain unfinished. This audit can continue independently
while PaymentSheet acceptance remains the first active feature priority.

Rollback binding repair PR #30 (`8f7a6121a`) passes 47 local deployment tests;
full current-head CI remains required before its merge. No hosted rollback ran.
The older source checkpoint below is historical where it conflicts.

### Earlier source integration checkpoint — September 9

**Next active work:** `/private/tmp/pantopus-staging-mail-unit-binding`, branch
`codex/staging-mail-unit-binding`. The [modern mail report](staging-mail-unit-binding-2026-09-09.md)
records exact apartment/destination binding plus atomic confirmation, current
membership retry/status and legacy partial-proof recovery. Independent review
also repaired Home-only address changes, pending-owner/resident transitions,
rejected-claim status, and webhook/dispatch metadata races. All 4,554 backend
tests and privacy gates pass. The database has 17 passing SQL contracts and
124 application functions/73 trigger bindings. Real competing transactions
prove one membership, bounded guesses, concurrent-freeze/authority denial and
preservation of confirmation metadata during vendor updates.

Hosted multi-unit acceptance and exact cleanup now pass. Both additive functions
were applied only to Free staging; existing records and the absent ledger were
preserved. The private candidate runs committed `694a213e2`
(`68e3e052a578`), with `26102bfb2`/`312b5a382fd6` retained stopped for rollback.
One real Lob test card targets Unit 4 while Unit 5 has another resident. Three
concurrent HTTP confirmations produce one exact membership; wrong/foreign proof,
changed Home, frozen access, rejected claim and revoked member are denied.
Concurrent signed synthetic webhook processing preserves completion metadata;
same-code retries after expiry preserve the original member and proof count.
The exact postcard, temporary Homes/proofs/claims and callback are removed;
all fixture sessions are revoked, zero push tokens remain, and original Home
document IDs are unchanged. Public/browser/production runtimes are unchanged.

Next ready and integrate [PR #29](https://github.com/WangPantopus/skinny-pantopus/pull/29)
after fresh current-head CI, then finish the isolated PaymentSheet milestone.
[Full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34424933888)
passed at `694a213e2`, including the repaired migration safeguard and complete
database replay. No checks are waived. The modern printed web link, physical
mail and externally delivered Lob callbacks remain outside this acceptance;
the separate native postcard simulator journey is already complete.

[PR #28](https://github.com/WangPantopus/skinny-pantopus/pull/28) merged as
`2259b8ee912cee90f538b024aa3971df6fd33ff2` at 21:03 UTC after
[full current-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34401283503)
passed at `95842b119`, including all three iOS simulator jobs and Android
quality/build/snapshots/instrumented tests. Its [merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34404747901) also passed.
The prior native worktree and branch are preserved. All native simulator mail
fixtures are cleaned; no owner device check is pending.

The next native PaymentSheet repair is isolated in
`/private/tmp/pantopus-staging-payment-sheet`, branch `codex/staging-payment-sheet`,
from master `2259b8ee9`. Backend and native changes are in progress there:
reconcile the exact owned successful SetupIntent before claiming a saved card,
retain retry state and prevent duplicate presentation. This is separate from
PR #29; no payment provider calls or live fixtures have run for that milestone.

[PR #27](https://github.com/WangPantopus/skinny-pantopus/pull/27) merged at
19:15 UTC after [final current-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34393203339)
passed at `d24632cda`. Backend, web, database replay/contracts and image checks
passed; native jobs were correctly skipped because that PR did not change them.
PRs #23, #25 and #26 are also merged. PR #26's merged-master CI passed;
PR #27's latest merged-master CI also passed (run `34396663166`).

The [mail recovery report](staging-mail-recovery-2026-09-09.md) records real Lob
test lost-response and concurrent HTTP admission acceptance. Three keyed sends
produced one postcard; retries retained proof, foreign/wrong-code access was
denied, a signed synthetic webhook recovered the receipt, and exact confirmation
created one member occupancy. Atomic admission passes all 13 SQL contracts,
119 application functions/73 trigger bindings, nine competing PostgreSQL
connections, 4,480 backend tests and privacy gates. Its additive migration was
applied only to Free staging, preserving the absent ledger and existing rows.
All disposable mail/Home/proof fixtures are cleaned and fixture sessions revoked.
The private candidate runs `a00629db1` (`7cd158c515ed`); the last unit guard at
`d24632cda` is source-tested but not deployed. Public API/worker, browser API and
web remain separate, older runtimes. Externally delivered Lob callbacks remain
unverified; the signed synthetic callback is not that evidence.

The [native postcard report](staging-native-mail-2026-09-09.md) records atomic
request admission and confirmation: unit/receipt preservation, member role
ceiling, revoked/frozen/changed-address denial, rollback and retry safety.
Confirmation passes 4,509 backend tests plus privacy gates; a final request guard
passes all 29 focused mail tests. All 15 SQL contracts and 22 competing PostgreSQL
connections pass. iOS passes 44 focused tests; Android passes 40 plus formatting, Detekt and
assembly. Both clients now distinguish a temporary throttle from an exhausted
code and show live request metadata instead of sample tracking. The final native
mail link repair targets the exact Home without putting a code in its URL; it
is running in the refreshed private candidate; simulator acceptance is active.

The private candidate now runs `26102bfb2` (`312b5a382fd6`). Both additive native
mail migrations are applied only to Free staging, preserving existing records and
the absent ledger. Real Lob test/API acceptance passes: one postcard across
three lost receipts, own status/retry, signed synthetic receipt recovery, one
member across concurrent confirmations, and foreign/unit/revoked-access denial.
All disposable test mail/Home/proof/notification fixtures are cleaned, fixture
sessions revoked, and original document IDs preserved. Public runtimes are unchanged.

Native simulator acceptance is complete on iOS and Android: exact printed link,
real pending status/read-only refresh, cold launch, wrong-code denial, correct
confirmation, same-code retry and normal logout all pass. Each fixture produced
one member for only its Home and exactly two attempts. The Place menu repair
passes on both devices, keeping account settings reachable after auto-landing.
Both exact Lob test postcards and temporary Home/proof/claim/occupancy records
are removed; all fixture sessions are revoked, no push tokens remain, and the
original document IDs are preserved. Do not rerun these completed publishers.

[PR #28](https://github.com/WangPantopus/skinny-pantopus/pull/28) is integrated
after full CI, including the successful replacement for the earlier Docker Hub
HTTP 500. Continue modern mail acceptance, then the remaining payment/OAuth work.
No owner device observation is pending. Simulator proof is not physical mail or
an externally delivered Lob callback.

The [vendor report](staging-vendor-acceptance-2026-09-09.md) records completed
browser synthetic email entry/recovery, cookies/CSRF, session revocation and
saved-card sandbox API acceptance. Staging frontend DNS and trusted TLS now work.
The [provider report](staging-provider-acceptance-2026-09-09.md) records Google
validation, operational Lob test mail and fail-closed address-provider outage
handling. Google/Apple staging OAuth remains disabled; saved-card API proof does
not cover PaymentSheet, charges, Connect or subscriptions.

The owner confirmed no active Smarty subscription and plans to obtain one for
testing and launch. Activation plus real DPV/unit/eligibility/error/access retests
is a required prelaunch step. A one-time reminder is scheduled for September 10
at 9 a.m. Pacific. Continue independent work without purchasing a plan. Preserve
the unrelated main-checkout design work and PR #24. Detailed historical reports
below retain their original runtime/verification limits.

- PRs #9 and #10 are on master. PR #13 merged to master as
  `1d5a1d752f85e7409367a9b9246ea5dcc331b555`, bringing in the canonical baseline
  and large-baseline history checker repair; its full CI passed.
- PR #12 merged as `92593d4f68b7703355ba154f75ecb18d63157dc3` into
  `codex/database-baseline-adoption`, so it did not by itself deliver its Beacon
  preference changes to master. Its final CI passed at `d33a33c1a`.
- [PR #14](https://github.com/WangPantopus/skinny-pantopus/pull/14) merged into
  master at 07:59 UTC as `939878b4f6cd1c3084b1d2811cb98270ab38a440`, integrating
  #12's completed preference changes and the Android session-return repair.
  Only the handoff conflicted; application/migration bytes matched the tested
  branch. The owner explicitly waived waiting for CI. GitHub's administrator
  enforcement was temporarily lifted solely for this merge and the complete
  original protection was immediately restored and compared successfully.
- [Merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34326720080)
  subsequently passed in full, including all three iOS simulator jobs and
  Android quality/build/instrumented tests. The earlier waiver was not itself
  evidence of passing checks.
- [PR #15](https://github.com/WangPantopus/skinny-pantopus/pull/15) merged as
  `0e57e4f2a3517de386acf8e69f2218ca5f8bc8f1` after its
  [CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34331005965)
  passed, including all three iOS simulator jobs. It preserves iOS post
  destinations through session recovery. Its
  [merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34333762148)
  also passed.
- Both deployment and migration switches were freshly verified false in staging
  and production. Source integration is not a production deployment. Hosted
  canonical ledger adoption and production cutover remain separate work.

[PR #16](https://github.com/WangPantopus/skinny-pantopus/pull/16) merged at
11:20 UTC as `8e856dcd9619d4e42557a803619582fff76ec719` after its
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34341032792)
passed. It adds native Beacon acceptance and preserves chat destinations through
session recovery. The [chat report](chat-notification-continuation-2026-09-09.md)
records 220 iOS unit tests, four native post/chat expiry/revocation UI journeys,
190 Android tests, and live staging/FCM → security sign-in → exact chat return.
Unread clears; normal Android logout removes all fresh fixture tokens and its
global push is restored off. Its revoked sessions stay revoked; the owned
Android emulator is closed.

The [native Beacon report](beacon-native-acceptance-2026-09-09.md) records native
composer publication, audience notification, exact post/author, cold start and
logout. Natural expiry now also passes: after more than 3,605 seconds untouched,
the existing Staging app refreshed the same hosted session and opened exact N2
without login, rebuild or token replacement. N1/N2 and the single chat marker
must never be republished. Final native logout and scoped cleanup pass: two Beacon posts, their audience
notifications, the direct chat and beta enrollment are removed. The two
synthetic accounts and already revoked session records remain as evidence,
with zero push tokens and all their registry sessions revoked. The owned
iOS simulator is closed. No iPhone observation is pending.

Account evidence remains in `/private/tmp/pantopus-staging-account-delivery`, branch
`codex/staging-account-delivery`, [PR #17](https://github.com/WangPantopus/skinny-pantopus/pull/17),
now based on master including #16. The [account delivery report](staging-account-delivery-2026-09-09.md)
records the missing-SMTP repair: 4,338 backend tests and privacy gates pass;
strict Swift lint/format pass. A private SMTP capture service and an unexposed
API candidate run on the existing host. Synthetic signup, captured verification
and resend, single-use verification, and verified login pass. Live recovery
exposed an immediate-login timestamp boundary after reset; its repair and two new
regressions now pass all 4,340 backend tests. Two fresh live recovery cycles now pass immediate login/profile access while
old tokens remain denied. A live SMTP outage returned the same 503 for known and
unknown accounts without creating a user; restored delivery and login pass.
Two outdated Android email screenshots were inspected and updated; all seven
status-screen snapshots pass local verification. Final CI at `61139c1bd` passed
after rerunning an unrelated iPhone 16 search timing failure. PR #17 merged as
`82d57ee0f70d182776ec88af8aaab52d0317635d` at 12:44 UTC. The configured
`staging.pantopus.com` frontend hostname does not resolve, so real browser link
completion remains unfinished.

Staging web preparation is in `/private/tmp/pantopus-staging-web-delivery`,
branch `codex/staging-web-delivery`. The container build now accepts an explicit
public app origin as well as the API origin, keeping staging links isolated.
The image build passes; hostname/TLS setup is pending.

The [staging web report](staging-web-delivery-2026-09-09.md) records a successful
production image build and six entry/account pages served on the existing host,
loopback only. The image has verified staging origins and a sandbox Stripe key.
Cloudflare sign-in is pending before configuring the currently absent frontend
hostname and completing browser email links. PR #17 is merged with passing final CI.
PR #16's merged-master CI passed in full.

The [Home file access repair](home-file-access-2026-09-09.md),
[PR #19](https://github.com/WangPantopus/skinny-pantopus/pull/19), now enforces
both legacy file and current document permissions, manager/sensitive visibility,
and matching dashboard counts. All 36 new regressions, 76 targeted Home tests,
4,376 backend tests and privacy gates pass. The next concrete gap is native
Home document upload: both clients currently save metadata without bytes and
report success. Complete real scoped upload/retrieval on existing/free storage,
including retry and revoked-access denial. Hosted storage is not yet certified.
PR #19 merged as `0021cb59d6649f501a86bacd4d69edfc932c0e94` after its integrated checks passed. Its integration worktree is
`/private/tmp/pantopus-home-access-integration`.
The [byte-delivery report](home-document-storage-2026-09-09.md) tracks work in
`/private/tmp/pantopus-home-file-access`, branch `codex/home-document-storage`.
Both native upload test sets pass. All 22 iOS upload/preview/denial/export tests
and strict Swift lint pass. Android document tests pass (49, with five existing
skips), along with formatting, Detekt and lint. All 4,415 backend tests pass,
including a new repair that excludes restricted document metadata from the old
Home File list. An isolated private staging bucket and local-only API candidate
are now running. Live exact bytes, concurrent retry/quota, sensitive scope, old-link revocation
and legacy metadata isolation now pass. Native acceptance exposed missing Home
tools/Documents entry points; both clients now connect them with confirmed
document permissions. Android OS picker → upload → exact PDF preview/share and
iOS opening/sharing that same document now pass; both share copies match all
609 original bytes. Android foreground return after permission revocation hides
the content; fixture access is restored. All 47 focused Android tests, its Place
snapshot/quality checks, 18 iOS dashboard/access tests, ten list tests and strict
Swift lint pass. Delete/replace, abandoned-upload cleanup and quota concurrency
remain next; iOS picker upload itself has unit coverage, not a live picker run.
Android private HTTP logging is repaired. PR #19's merged-master CI passes.
See the byte-delivery report for exact limits. Staging lacks default
member IAM rows; fixture-only grants permit this test, without certifying the
unadopted global reference data. PR #18 merged with passing checks at 12:51 UTC
as `fd8a94eef727342340fc522f7196e6e64814ed08`.

[PR #20](https://github.com/WangPantopus/skinny-pantopus/pull/20) merged as
`7a440d61ded9b3338340c8dce3fe2da2d894d655` after its
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34361613124)
passed. Its merged-master checks are running. The
same worktree now uses `codex/home-document-lifecycle`. The
[lifecycle report](home-document-lifecycle-2026-09-09.md) records completed native
Delete wiring, atomic quota release/tombstones and direct database access guards.
All 4,425 backend tests, privacy gates, SQL contract, real concurrent deletion,
function lint, 33 Android and 17 iOS focused tests and native quality/build checks
pass. Live staging concurrent deletion and both native confirmation/list-refresh
journeys pass, including provider removal, quota release and old-content denial.
The compatible deletion migration is applied only to Free staging, preserving
existing rows and its absent migration ledger; public API/worker are unchanged.
Three disposable documents were removed and the temporary delete grant was
removed. Live iOS Files picker → upload → exact document/share now passes with
609 matching bytes and one quota increment. It exposed and fixed duplicate
success navigation: the upload form now closes once and remains on Documents.
The initial I4 fixture was removed before final I5 acceptance; I5 remains with
the original four documents. Next are replacement, abandoned upload cleanup,
quota enforcement across different upload IDs and stale native export cleanup.

The public staging API/worker still run `65d2cc2d9`; the candidate is separate.

[PR #21](https://github.com/WangPantopus/skinny-pantopus/pull/21) merged as
`c1f411c583e9375616e06570bdcea062f16bf532` after its
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34369706912)
passed. Its merged-master CI also passed. The completed recovery work is isolated in
`/private/tmp/pantopus-home-upload-recovery`, branch `codex/home-upload-recovery`.
The [upload recovery report](home-upload-recovery-2026-09-09.md) records passing
local quota/access SQL contracts and three real competing-connection checks for
storage, file-count and daily limits. The compatible migration is now applied
only to Free staging, preserving all existing rows and its absent ledger. Durable
reservation and the bounded abandoned-upload/deleted-object recovery worker now
pass 4,439 backend tests, privacy gates, the SQL contract, application function
lint and both real publication-versus-expiry races. Live private staging quota,
expiry/outage/retry and late-write reconciliation pass; original five documents,
exact bytes and quotas/limits are preserved. Native launch cleanup passes 35 iOS
and 34 Android tests plus lint/build checks. Both native share → process restart
checks pass with exact 609-byte copies removed on relaunch. The zero-cache
candidate follow-up also passes exact upload and immediate post-delete denial.
[PR #22](https://github.com/WangPantopus/skinny-pantopus/pull/22) merged as
`6fbdcce1203780b475bd209ed4f6fc5e03bfb487` after its
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34374779134)
passed at `134b25751`. Its merged-master checks are pending. Replacement work is isolated in
`/private/tmp/pantopus-home-document-replacement`, branch
`codex/home-document-replacement`; see the
[replacement report](home-document-replacement-2026-09-09.md). Initial replacement
backend/SQL work passes 4,453 backend tests, 12 contracts and the full function
linter in a separate owned local database. Explicit backend privacy gates and
three real replacement/expiry/deletion races also pass. The compatible migration and private staging candidate are now applied without
changing existing rows or public runtime. Two live API replacement cycles pass;
provider cleanup has the documented eventual-read limit. All 41 iOS focused tests
and signed simulator build pass. The live iOS picker → confirmation → same document → Share also passes, with all
1,292 bytes matching and its temporary copy removed on restart. Both native picker → confirmation → same document → Share journeys now pass,
with 41 focused tests per platform and matching 1,292-byte exports removed on
restart. Both disposable documents and the temporary manage grant are removed;
original five documents and quotas remain. [PR #23](https://github.com/WangPantopus/skinny-pantopus/pull/23) is ready with
all local checks passing, including final Android lint. Its CI/integration remain;
continue independent staging account/vendor work while checks run. The recovery report preserves
the earlier iOS unmarked temporary-copy limitation and provider-cache observation.
PR #20's merged-master CI passed in full; public staging API/worker stay unchanged.
No production changes or new paid resources were made. The earlier worktree
`/private/tmp/pantopus-database-baseline-adoption` and unrelated local work,
including the owner's design proposal, remain preserved. Update this handoff
after each meaningful milestone.

### Completed Beacon and platform evidence

The [full Beacon report](beacon-full-journey-2026-09-08.md) records live publish →
audience notification → exact permitted post, authenticated WebSocket fanout,
mute/resume, membership/revocation/block restrictions and draft/archive denial.
Physical iPhone foreground/background/closed-app taps, old blocked-link denial,
mute/resume and global push off/restore were owner-confirmed. Android emulator
foreground/background/process-absent return and old blocked-link denial passed.

The [push-only preference report](beacon-push-preference-2026-09-08.md) records
schema/API/web/iOS/Android preference support, global opt-out precedence,
retained in-app notifications and no replay. It also records the Android
first-run menu repair and iOS Socket.IO authentication/refresh-loop repair.
All 20 live staging API/access checks passed. Android native off/restore passed;
the owner confirmed repaired iPhone saves, I-off silence with exact in-app
return, and I-restored as the sole new alert opening the exact post. Both
preference fixtures were cleaned up; original device accounts/preferences,
prior iPhone notifications and its APNs registration were preserved. PR #12's
[final full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34322453803)
passed. The earlier iPhone SE timing failure was fixed by awaiting the save task;
16 settings tests passed five repetitions.

The [September 9 platform report](notification-platform-verification-2026-09-09.md)
records Android OS permission denial, retained in-app exact return, restoration
and no replay through live staging/FCM. It reproduced a revoked-session
notification losing its post after login. Fix `9c443b69a` binds unfinished post
arrivals to the original account and clears them after load/departure or manual
logout. All 148 targeted tests, formatting, Detekt, Android lint and the staging
build passed. A fresh live notification → security sign-out → same-account
login opened the exact emerald-harbor post and public Beacon author; the native
persisted destination was verified before login and cleared after load/logout.
Four test posts, five notifications, the fresh Beacon/membership and creator
were removed. Android is signed out with zero FCM tokens; its original account,
AuthDevice, preferences and OS permission remain. The owned emulator is closed.
Global/internal Beacon enablement remains false and beta is empty.

The [canonical baseline report](database-canonical-baseline-2026-09-08.md) and
linked [upgrade rehearsal](database-baseline-rehearsal-2026-09-08.md),
[empty replay](database-empty-replay-2026-09-08.md) and
[reference/lint evidence](database-reference-lint-2026-09-08.md) record unchanged
archived history, full schema replay, all 6,467 static reference rows, reviewed
function/ACL contracts and preservation of original values. Staging received
only the rehearsed compatible preference/security expansion, preserving its
hosted migration ledger. API and worker still run `65d2cc2d9`; earlier containers
are retained for rollback. Production and the old testing database are preserved.

### First unfinished work

1. Complete application mail-code dispatch/confirmation and uncertain-send
   recovery, then reachable sandbox payment UI/transactions and real OAuth
   callbacks. Browser signup/recovery and staging hostname/TLS now pass.
   Smarty needs an existing active subscription; Google/Apple staging OAuth
   remains disabled. Use existing/free capacity.
2. PRs #23, #25 and #26 are merged after their required checks passed. Continue
   monitoring merged-master CI. Home replacement, saved-card API retry and Lob
   mail-purpose acceptance are recorded in their reports; public runtime
   deployment remains separate from this source integration.
3. Complete the production upgrade/ledger, external-file recovery and
   deploy/rollback plan, then release-candidate Home/Pulse/Beacon and adjacent
   reachable-feature acceptance. Keep actual production cutover distinct from
   preparation and preserve records, balances and entitlements.

Beacon publication, mute/access/preferences, native post/chat return, natural
expiry and their fixture cleanup are complete within the recorded platform
limits. Do not repeat the completed iPhone observations. Physical Android remains
unverified; simulator/emulator results do not establish physical-device delivery.

Start each continuation by fetching origin, checking PR/master CI and staging
state, and reading the linked report for the next concrete case. Earlier physical
Beacon/device fixtures are cleaned up; never reuse their deleted creators,
Beacons or post IDs. The simulator fixture above is also cleaned. Read the
private operator checkpoint before sending or
mutating. No user device observation is currently pending.

## Decisions to preserve

- Home, Pulse and Beacon are all product pillars. Address-free social discovery
  and Beacon following must remain available; local posting eligibility remains
  enforced. Do not require a household simply to follow a publisher.
- Private home usefulness must work without recruiting neighbors. Saving a
  public address preview, household membership, residency verification and
  property ownership are separate facts. Entering an address grants no access
  to another household. Keep private/public identity boundaries explicit.
- Preserve authorized Home intelligence: supported ATTOM/property data,
  weather, air quality, alerts, sunrise/sunset and the visual daylight arc,
  environmental and civic/election sections. Existing provider coverage and
  verification/licensing restrictions still apply; availability is not certified
  merely because the UI code remains present.
- Keep setup progressive and destinations durable across login, signup and
  retry. A follow, save or post requires the relevant explicit action. Distinguish
  saved data from delivered reminders, physical mail or completed payments.
- The owner authorized staging recovery on the existing AWS host, designated
  synthetic-device tests, and feature-branch commits/pushes. Existing paid host
  operation was approved; creating new paid resources was declined. The new
  Supabase and Firebase staging projects use free plans. Do not treat that
  history as authorization for new spending or a production database/DNS cutover.
- Screenshots are not required for this milestone. Sanitized textual evidence
  is sufficient; keep secrets and private database contents out of reports.

The [v1 release brief](v1-release-brief-2026-09-06.md) and
[journey audit](v1-journey-audit-2026-09-06.md) define acceptance. Navigation
redesigns in those documents are proposals, not claims about the deployed UI.

## What is complete, and what the evidence proves

| Work | Latest evidence / limits |
| --- | --- |
| Entry continuity and private address saving | Web/native implementations preserve destinations and explicit private saves. Home access/redaction repairs and calendar continuity are integrated through PR #4. Real provider and device scenarios still need release-level coverage. See [web/shared entry](entry-continuity-implementation-2026-09-06.md), [native entry](native-entry-continuity-2026-09-06.md) and [master integration](master-integration-2026-09-07.md). The old six web type errors were fixed; do not reopen them solely from earlier notes. |
| Social discovery and Beacon return | Address-free discovery, following, publication and permitted Following updates exist. See [social discovery](social-discovery-2026-09-06.md), [Beacon return](beacon-return-journey-2026-09-07.md) and [activity reliability](following-activity-reliability-2026-09-07.md). The live API/access matrix and iPhone/Android emulator returns pass; remaining acceptance limits are recorded in the [full journey report](beacon-full-journey-2026-09-08.md). |
| CI and prior integration | PRs #1–#5 are merged, including contrast/brand work, entry/calendar integration and explicit staging configuration. Full CI passed for deployed backend release `9d1fe24dc`; final consolidated-branch CI must be checked separately. |
| Staging infrastructure | Current backend API and separate worker run on the existing AWS host, with isolated Free Supabase, HTTPS and verified renewal, sandbox Lob/Stripe settings, database TLS, real queue schedules and job consumption. No new instance was created. |
| Hosted API contracts | Authenticated API, secure cookies/CSRF, notification ownership/preferences/read state, Home/Hub/Following/identity/device queries, authenticated WebSocket, CORS and Lob webhook signature/replay checks passed. This does not certify email delivery, storage or real postcards. |
| Production preservation | Production backup captured and restored locally in isolation. All 299 archived COPY sections matched restored row counts/hashes. Upgrade rehearsal retained original records but exposed schema gaps. No production schema/ledger/DNS cutover occurred. External file contents are not included in the database backup. |
| Notification opt-out | Both native and legacy token registration preserve existing global opt-outs. Backend regression/privacy tests and real PostgREST checks passed; Android staging exercised opt-out, re-registration and restore. Raw APNs token logging was removed. See [lifecycle audit](notification-lifecycle-audit-2026-09-07.md). |
| Physical iPhone | iPhone 16 Pro, iOS 26.5.2, development-signed Staging build. Actual Beacon foreground/background/closed-app notifications opened the exact permitted post. Old blocked-notification denial, mute/resume and repeated global push off/restore passed with owner confirmation; provider acceptance is recorded separately. |
| Android emulator | Google APIs ARM64 Android 14/API 34. Real FCM chat notifications opened the exact conversation; Beacon foreground/background/process-absent notifications opened the exact post, and an old blocked notification denied access. Global opt-out persisted across registration, restored delivery worked, logout removed tokens, re-login registered again. Physical Android remains unverified; owner has no Android phone. See [Android report](android-staging-verification-2026-09-08.md). |
| Android fixes | `fd9a60dcd` fixes `+` in chat titles and a false security warning after voluntary logout. 98 routing/dispatcher tests and 93 auth/matching-view-model tests passed; lint/build and final emulator checks passed. This is targeted evidence, not final all-surface CI. |

## Environments and release identity

| Environment | Recorded state |
| --- | --- |
| Production database | Supabase `ankjdyvoduutkhhaxvhx`; existing users/data must be preserved. Resumed after pause; session-pooler TLS connection and backup verified. Current application schema is not ready for the new backend. |
| Existing testing database | Supabase `gzzdqechcbfpalfvgyro`, “Pantopus-backend”; preserve it. It is not production and is not the new staging runtime's database. |
| Isolated staging database | Supabase `ptudkfqdhqpkbkzqlabu`, “Pantopus-staging”; synthetic test accounts plus permitted reference data, no copied real user records. |
| Staging API | `https://staging-api.pantopus.com`; API and worker release `65d2cc2d9ab4857e044325315f0023a6d8f4bf54`. Image ID `sha256:c7d81368d0fac60b73134c0fd3d0243696de6fef4cb40ed6e32bf0c8f9a527f5`. Repository HEAD may be newer than this deployed image. |
| AWS host | Existing Oregon EC2; staging API binds `127.0.0.1:18001` behind nginx; worker has no public port. Container names `pantopus-backend-staging` and `pantopus-worker-staging`. Original production container is retained. Exact host/access details are in the private operator handoff. |
| Production DNS | Last inspected production API DNS points to the old address and times out. Fixing DNS alone would route users to an obsolete backend. Reconcile production first, then perform a planned cutover. |
| GitHub automation | On September 8, both production and staging have `BACKEND_DEPLOY_ENABLED=false` and `DB_MIGRATIONS_ENABLED=false`. Merging source does not deploy while these switches remain false. Re-read them before merging/enabling releases; do not enable deployment to make a source PR mergeable. |
| Firebase | `pantopus-staging`, free Spark; debug Android package `app.pantopus.android.debug`. FCM is used for Android push, not Firebase Auth/database. A narrowly scoped sender key exists privately. The approved temporary project-only key-creation exception was removed and the inherited block restored. |
| Apple push | Sandbox APNs, topic `app.pantopus.ios`; signed app entitlement is development. The supplied WeatherKit and Sign in with Apple keys could not send push. A separately approved APNs key is active; do not substitute the older `.p8` files merely because they parse. Distribution/TestFlight requires separately matching credentials/entitlement. |

Numbered migration 152's `PushToken.platform` / `provider` change was rehearsed
transactionally and applied only to staging. Earlier comparison against staging
missed this contract because both old databases lacked it. Include it in the
production gap audit; the historical migration ledger was not altered.

## Ordered backlog and exit criteria

| Order | Deliverable | Exit criterion |
| --- | --- | --- |
| 1. Integrate this branch — complete | PR #9 merged as `a373b1094`; final PR and merged-master CI pass. | Current work starts from merged master. Deployment/migration switches remain disabled. PRs #6–#8 remain separate review housekeeping; do not treat their state as a blocker to Beacon verification. |
| 2. Beacon end-to-end staging | Dedicated creator and address-free follower publish/read/follow/mute/return through the actual staging API and native UI. | One stored post ID matches Following, audience notification and opened post. No unrelated recipients. Mute/global/type opt-out and restore work; restricted membership and revoked/block access deny correctly, including old notification taps. Record every case in the linked matrix. Do not enable feature flags globally simply to populate fixtures. |
| 3. Finish released-platform notification coverage | Actual post/chat destinations, foreground/background/ordinary cold start, denied permission, expired session/login continuation, token rotation/logout and relevant settings UI. | Exact permitted destination opens on each released platform/state; unread behavior is coherent. Owner confirms physical iPhone observations; physical Android remains explicitly pending until hardware is available. Emulator results are useful but not physical acceptance. |
| 4. Finish isolated vendor/account flows | Safe staging signup/recovery/verification email and real OAuth callbacks; isolated media/document storage; reachable sandbox payments and address-verification states. | New user can authenticate/recover, upload/read only authorized files, and complete reachable test-mode actions. Failures/retries are visible and idempotent; no live charge or postcard is triggered by staging. Use existing/free capacity unless further spending is authorized. |
| 5. Make production upgrade reviewable | The [canonical baseline](database-canonical-baseline-2026-09-08.md) completes local gap repairs, object/reference/ACL comparison, fresh replay, function gates and original-value preservation. Remaining work is per-environment hosted upgrade/ledger adoption planning, external-file recovery and hosted Auth/storage configuration verification, plus deploy/rollback plans. | Preserve legacy production fields/tables and records; reconcile the final release's migrations and platform dependencies. Local replay and compatible staging expansion do not complete hosted ledger adoption. No hosted production write/cutover until the concrete plan is reviewed and authorized. |
| 6. Complete v1 journeys and reachable features | Run Home/Pulse/Beacon acceptance on release candidates; inventory adjacent mailbox, tasks, marketplace, payments and household actions. | Address-free paths, private-address boundaries, correct calendar outcomes, exact-content returns, error/retry/accessibility and real provider coverage pass. Finish or honestly constrain unfinished reachable operations; preserve records, balances and entitlements. |
| 7. Release/pilot | Tie exact web/iOS/Android builds, backend, migrations, flags and rollback together; configure deployment only after its prerequisites. | Approved production cutover and post-deploy checks pass; small consenting pilot measures actual first value and voluntary returns. Passing engineering tests alone is not product-market fit or proof every feature is finished. |

The owner has a separate, uncommitted proposal at
`docs/pantopus-next-stage-design-2026-09-08.md` in the main Mac checkout. It
explores coherent Home/Nearby/Following/Inbox destinations, a private note →
public question → private bookmark journey, and reviewed personal calendar
saves from Beacon events. It explicitly describes new work, not a release.
Preserve it and review it with the owner before treating its label choices,
personal-record contracts or implementation packages as approved scope. Do not
copy it into this recovery PR incidentally. The current v1 gates above remain
the immediate direction unless the owner changes priorities.

## Evidence index and local continuation

Public, versioned reports contain sanitized findings rather than raw secrets:

- [Recovery, backup/restore, schema gaps and runtime](backend-recovery-2026-09-07.md).
- [Local baseline prerequisite expansion and SQL contracts](database-baseline-rehearsal-2026-09-08.md).
- [Staging inventory, native setup and physical iPhone record](staging-notification-setup.md).
- [Android delivery, navigation, opt-out and logout record](android-staging-verification-2026-09-08.md).
- [Beacon live results and fixes](beacon-full-journey-2026-09-08.md) and
  [scenario matrix](beacon-staging-verification-2026-09-07.md).
- [CI/CD setup](ci-cd.md) and [migration adoption runbook](supabase-migration-automation-runbook.md).
- [Following query validation](following-activity-reliability-2026-09-07.md) and
  [notification lifecycle audit](notification-lifecycle-audit-2026-09-07.md).

On the owner's Mac, the private durable evidence root is
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/`.
Start with its `OPERATOR_HANDOFF.md`. It indexes backups, schema rehearsals,
operator logs, private test-account fixtures, push configuration and native test
evidence. Keep these materials private; some logs and SQL archives include
credentials or application records. They are not part of a Git clone. A new
machine needs a separately authorized private transfer and its own access.

The current Beacon checkout is `/private/tmp/pantopus-beacon-journey`; the
prior recovery checkout `/private/tmp/pantopus-current-backend-release` is retained. Temporary build files live in
`/private/tmp/pantopus-native-staging-build`; do not assume either survives a
restart. The branch is pushed and key evidence is copied to the durable private
root. If the checkout is gone, create a fresh feature worktree from current
master after confirming the integration state; never reconstruct code from logs.

Fresh September 8 inspection finds the main checkout
`/Users/yingpengwang/skinny-pantopus` clean on merged master. Preserve ignored
artifacts, the product-design proposal and all other worktrees. Do not reset,
clean, stash wholesale or incidentally commit unrelated files.

Native rebuild commands and environment selection are in staging setup. Android
uses ignored `.env.staging` and `app/src/debug/google-services.json`; iOS uses
the Staging scheme and generated private overlay. Operator scripts may send or
mutate when executed: inspect their intended action, recipient and idempotency
marker before reuse. The Android test app ended signed out with zero registered
tokens and its original push preference restored; the designated iPhone token
remains. Inspect fresh registration state before another send.

## Keep this handoff current

After each milestone, update the top next action, exact commit/deployment state,
results and remaining coverage. Add a dated report for substantial work and
link it here. Record blockers with the concrete next action and any required
owner input. Keep proposals distinct from implementation and device acceptance.
Refresh private operator state when credentials, server configuration or test
fixtures change. Do not append an unfiltered chat/tool transcript: the indexed
reports and private evidence are the durable record.
