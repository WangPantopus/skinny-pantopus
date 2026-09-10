# Pantopus project handoff

Updated September 10, 2026. This is the continuing-work entry point. Detailed
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

### Historical assigned-payment recovery — September 10

Historical assigned payments now recover through one protected authorization
operation. Current actor/session and displayed payment terms are checked before
mutation; interrupted provider requests retain their original identity. New holds
respect the 24-hour window. Cancellation blocks worker start until its outcome
is reconciled, and unchanged status checks no longer reload the gig repeatedly.

The [authorization report](paid-gig-legacy-authorization-2026-09-10.md) records
independent review, the full backend pass, fresh database replay, actual service/
SQL interruption and concurrency checks, and populated-upgrade preservation.
No historical authorization is backfilled automatically. Provider/device
acceptance remains open; legacy attention notifications still need durable
recovery. The migration and matching runtime must be deployed together.

**Next:** commit the reviewed browser recovery controls, finish iOS/Android
parity, then complete new and historical paid-gig sandbox journeys, remaining
cancellation/dispute/Connect/debt and durable attention flows, capacity/retention
checks and checked integration. Draft PR #34 remains unfinished. Home Android
claims are pushed as `188801150`; the earlier dashboard repair passed all three
affected iOS 18.5 jobs. Private Home attachments/evidence continue in draft PR #32.
All paid dependencies remain deferred together to final launch preparation.
Completed physical Beacon and saved-card acceptance remains complete.

### Browser alert preferences and account changes — September 10

Browser popups now follow the server's push eligibility stream; in-app updates
remain available with alerts off. Restoring preferences does not replay old
alerts. Socket connections and retained popups retire on same-tab or cross-tab
session changes, including replacement cookie sessions with the same marker.
The [browser report](browser-notification-preferences-2026-09-10.md) records
1,089 web checks, zero type/lint errors, 4,833 backend checks (16 existing skips),
all privacy gates and independent review. Actual combined browser acceptance
and current-head CI remain open; no provider/device update occurred.

**Next:** complete historical assigned-payment recovery and its web/native
controls, including the existing continue-authorization button that currently
sets state without displaying a payment form. Then finish cancellation/dispute/
Connect/debt workflows, fresh full sandbox paid-gig acceptance, capacity/retention
checks and checked integration. Draft PR #32 has iOS claim review `9035329a1` and
a further dashboard runtime fix `a68bbc5a8` pushed; the affected iOS 18.5 CI proof
is pending, while Android claims and private evidence/attachments continue.
All paid dependencies remain deferred together until final launch preparation.
Completed physical Beacon and saved-card acceptance remains complete.

### Android refund recovery checkpoint — September 10

Both native clients now have source implementations for exact payer refund and
hold-release history, confirmation and interrupted-request recovery. Android's
[refund report](paid-gig-android-refunds-2026-09-10.md) records 56 passing
behavioral checks, formatting, static analysis, zero lint errors, debug assembly
and independent review. Invalid-target reopening no longer retains a previous
payment. Android is committed/pushed as `61501a3c5`. iOS refund recovery is
committed/pushed as `22d7ada36`; its payment-summary follow-up also passes the
50-check app build and independent review. It separates tips from the original
task amount, distinguishes holds from charges and leaves missing totals unavailable. Actual provider/emulator acceptance of
the full paid-gig journey remains open.

Wallet notification durability is committed/pushed as `3b862f2ba`, with complete
backend, fresh database, actual relay/SQL and populated-upgrade checks recorded
below. **Next:** historical assigned authorization recovery, remaining
cancellation/dispute/Connect/debt workflows and the full fresh sandbox paid-gig
journey, then capacity/retention checks and checked integration. Home native claim
review/withdrawal now passes 47 final iOS checks; Android current-session controls
and private task attachments/evidence continue in draft PR #32. All paid services
remain deferred to one final launch-preparation step; completed Beacon and
saved-card device acceptance stays complete.

### Wallet notification durability checkpoint — September 10

New paid-gig wallet credit now commits its two in-app notices and delivery events
with the money receipt. Process death, unknown transport and lost acknowledgement
recover the same event/notification identities. Deleted or suppressed notices
are not replayed, and historical/zero/reused credits create no new notice.
The [wallet delivery report](paid-gig-wallet-delivery-2026-09-10.md) records the
full 4,821-test backend pass (16 existing skips), privacy gates, 17 fresh
migrations, 23 SQL contracts/wrappers, zero SQL lint errors, 36 concurrent
connections, actual relay/SQL recovery and populated-upgrade preservation.
Independent review is complete. Transport remains at least once after an
uncertain provider acknowledgement; hosted/provider acceptance is still open.

iOS refund recovery is committed/pushed as `22d7ada36`; Android has passed its
56 behavioral checks and is finishing formatting/static/build validation before
its separate checkpoint. **Next:** historical assigned authorization recovery,
cancellation/dispute/Connect/debt workflows, the fresh full sandbox paid-gig
journey, capacity/retention checks and checked integration. Home native claim
review and private attachments/evidence continue in draft PR #32. Paid services
remain deferred together until final launch preparation. Completed Beacon and
saved-card acceptance stays complete and must not be repeated.

### iOS refund recovery checkpoint — September 10

The existing owner payment card now supports confirmed refund/hold-release
requests and read-only history. Interrupted operations retain their original
UUID, amount and reason across restart; exact server receipts, current account
scope and caller retry permission control recovery. The [iOS refund report](paid-gig-ios-refunds-2026-09-10.md)
records a passing simulator app build, 50 focused checks, strict formatting/lint
and independent review. These controlled responses do not replace the fresh
provider lifecycle acceptance. Android parity remains in validation.

**Next:** finish Android refund recovery, historical assigned authorization,
wallet notification durability and cancellation/dispute/Connect/debt workflows,
then the full fresh sandbox paid-gig journey and checked integration. Wallet
delivery source is currently uncommitted under local SQL/relay validation;
its first contracts prove atomic notice creation, rollback and exact retry.
Home ordinary claim review is committed/pushed as `c315267a6` in draft PR #32;
native claim controls and private attachments/evidence continue there. Final
current-head CI and household acceptance remain required. Paid dependencies
remain deferred together until final launch preparation. Completed Beacon and
saved-card device acceptance stays complete and must not be repeated.

### Residual worker settlement checkpoint — September 10

Worker wallet release now credits the verified amount remaining after refunds
in one transaction with its durable receipt. A later permitted refund recovers
only the additional worker share; original payment terms remain unchanged.
Exact wallet owner/currency and legacy credit proof are required, and duplicate
calls cannot credit twice. The [settlement report](paid-gig-wallet-settlement-2026-09-10.md)
records final **4,808 backend checks passing (16 existing skips)**, **22 SQL
contracts**, zero function-lint errors, **36 concurrent connections** and a
populated upgrade rehearsal preserving historical financial rows. Independent
review is complete; source is in draft [PR #34](https://github.com/WangPantopus/skinny-pantopus/pull/34).
The separately pushed web release display is `991b4f77d`. No hosted migration,
provider operation or full paid-gig device acceptance is claimed here.

**Next:** native refund controls, historical assigned authorization recovery,
remaining cancellation/dispute/Connect/debt and wallet-notification delivery,
then a fresh complete sandbox paid-gig journey and checked integration. The
report distinguishes held policy cases from completed settlement behavior.
Home task/calendar, claim review and native finance controls continue in draft
PR #32; its previous iOS CI failures are under investigation before any merge.
Completed Beacon and saved-card device acceptance is preserved.

The owner now defers **all paid subscriptions and paid dependencies** to one
final launch-preparation step after other development and available validation
are complete. The earlier timed Smarty reminder is paused. Track required
subscriptions and their remaining real-provider acceptance together; do not
purchase or activate them during this development phase. Complete user journeys,
failure recovery, maintainable code and realistic capacity checks are the
priority. Passing isolated tests does not establish full workflow readiness.

### Worker release display checkpoint — September 9

Web refunds now require an explicit held-worker state before starting a new
request. Worker summaries distinguish original expected earnings from the exact
historical wallet credit after refunds, including zero earnings and subsequent
adjustments. The [web report](paid-gig-web-refunds-2026-09-09.md) records **1,082
web tests**, **58 final focused checks**, zero TypeScript/lint errors and
independent review. Durable refund checkpoint `80d155b30` is committed/pushed;
the matching residual-settlement backend (`20260910070000`) is still under
local database/recovery verification in draft PR #34. Do not deploy the new
projection independently or treat source tests as provider acceptance.

Next finish and review that settlement transaction, then native refund controls,
historical assigned authorization and the complete fresh sandbox paid-gig
journey. Home claim invitation checkpoint `d35f7b844` is committed/pushed
separately in draft PR #32; task/calendar regression, legacy claim review and
iOS finance permission controls continue there. No owner device input is pending.

### Durable refund checkpoint — September 9

Payer/admin refunds and authorization-hold releases now retain one protected
request identity and reconcile exact provider receipts. Refund reservation,
provider lease and wallet credit recheck their current state under database
locks; a new dispute prevents a new refund mutation. Unknown outcomes retain
the same request, and a provider-confirmed refund remains distinct from any
unrecovered worker balance. The [refund report](paid-gig-refund-receipts-2026-09-09.md)
records **4,768 backend tests passing (16 skipped)**, **37 final focused tests**,
all privacy gates, **21 fresh SQL contracts**, zero function-lint errors and
**28 concurrent database connections**, plus populated-upgrade preservation.
Root's independent review of the final dispute/lease/state guards passed.

Web refund controls are committed at `13a8dc9b8`; their [report](paid-gig-web-refunds-2026-09-09.md)
records the separate client evidence. Both source checkpoints are in draft
[PR #34](https://github.com/WangPantopus/skinny-pantopus/pull/34); current-head CI
and integration remain required. No provider or hosted migration/runtime change
ran. **Next: release residual worker earnings after a pre-release partial
refund**, then historical assigned authorization, native refund controls and a
fresh complete sandbox paid-gig journey. Historical Connect/debt recovery and
broader dispute accounting remain explicit release gates. Completed saved-card
fixtures remain cleaned and must not be reused.

### Web refund recovery checkpoint — September 9

The existing payer payment section now has explicit refund/hold-release
confirmation and scoped history recovery. Unknown results keep the original
request identity and terms across restart; exact receipts determine completion.
Account, session and API changes fence the old screen. The [web refund report](paid-gig-web-refunds-2026-09-09.md)
records the full **1,060-test web pass**, **26 focused UI/shared-client checks**,
lint, zero-error typecheck and independent contract review. This source depends
on the same PR's durable refund backend/migration recorded above;
it must not deploy independently.

The subsequent backend checkpoint closes the dispute-at-provider-lease race. Remaining
paid-gig work includes native refund controls, historical assigned authorization,
residual earnings after partial refunds, complete test-mode completion/capture/
notification/refund/cleanup and applicable release checks. No provider operation
or hosted paid-gig migration/runtime change has run. Home native navigation is
committed/pushed separately at `115c238ac` with **53 iOS and 54 Android tests**;
the next claim invitation transaction is under isolated final replay/regression
checks, while task/calendar/resource work continues independently.

### Native paid-bid recovery checkpoint — September 9

The subsequent web summary checkpoint distinguishes authorization holds from
captured charges and does not label a pending hold release as a charge. Twelve
focused tests, changed-file lint and the zero-error TypeScript gate pass; see
the [web report](paid-gig-web-recovery-2026-09-09.md). Durable refund/release
receipts and wallet settlement serialization are now being implemented in the
isolated paid-gig branch. No provider acceptance is claimed yet.

The three active owner-bid entry points on both native clients now use shared
recovery coordinators. iOS passes **101 simulator tests**; Android passes **148
JVM tests**, formatting, static analysis and debug assembly. Independent review
closed old-screen account binding, anonymous/legacy read compatibility and
competing SDK presentation gaps. Exact server receipts control accepted/canceled
UI; lost responses resume the same bid without persisting payment secrets.
See the [iOS report](paid-gig-ios-recovery-2026-09-09.md) and
[Android report](paid-gig-android-recovery-2026-09-09.md).

Native milestone `59b9cff7b` is committed and pushed in draft PR #34. Current
master `390091cdb` is now integrated, including the completed
[sensitive-auth repair](native-sensitive-auth-2026-09-09.md) (19 iOS and 12
Android focused tests plus full PR #33 CI). Only this handoff conflicted; both
source milestones and their reports are preserved. Check final-head CI while
finishing durable payer/admin refund receipts and historical assigned
authorization before a fresh test-mode paid-gig lifecycle. No paid-gig
provider call, hosted migration or runtime change has run. The current private
saved-card acceptance remains completed and cleaned; do not reuse its fixtures.

Home invitation and sharing is committed as `0c973b8df`, with master integrated
at `269128f31`, in draft PR #32. Final local regression passes **4,827 backend
tests, 16 skipped**, privacy gates and 36 real database races. Every applicable
[CI check](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34441879676)
passed at that head. An earlier new-test mock-path mismatch was corrected;
intermittent HTTP socket/timeouts in payment/chat also occurred under Node 22,
so runtime version alone does not explain them. Ownership/claim-bound admission
and task/calendar/attachment boundaries are the next active source slices.
Ordinary role defaults and hosted Home grants are unchanged.

### Earlier paid-gig recovery and delivery checkpoint — September 9

**Native sensitive-auth integration is complete.** PR #33 merged as
`390091cdbfb12c3f2a2b7ce331453433d6344e80` at 05:01:17 UTC September 10 after
every [current-head CI check](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34437250525)
passed at `b85febb8c`, including all three iOS simulator jobs and Android
instrumented tests. No checks were waived and no hosted runtime changed.

Paid-gig work is now draft [PR #34](https://github.com/WangPantopus/skinny-pantopus/pull/34),
with web/backend checkpoints and master `d7be416b8` integration pushed, plus
exact test-profile cleanup `63d475474` carried from Home checkpoint `f76f16847`.
Root's combined backend run passes **4,730 tests, 16 skipped under Node 22**, the
CI runtime. Two earlier Node 24 runs encountered intermittent HTTP socket/timeout
failures in unrelated Home-file/intelligence tests; all 44 focused cases pass.
The Node 22 pass does not establish the cause of those intermittent failures.
Current iOS/Android paid-bid recovery is uncommitted and under test. Finish this
milestone before safely incorporating newer master into these active worktrees.

The first paid-gig backend checkpoint is committed/pushed as `fa3a70a43` and
fixture follow-up `15754b439`. Web exact-bid checkout and cold/redirect recovery
are committed/pushed as `68cb112a4`; its [report](paid-gig-web-recovery-2026-09-09.md)
records the checked client amount, authorization-ready, cancellation, actor and
redirect-secret boundaries. PR #31 merged after all final-head checks passed;
its merged master is `d7be416b872a31ceb53094d7d19c3f114185831f`. Source merging
has not enabled deployment or changed the private payment runtime.

The second backend/SQL checkpoint is committed/pushed as `4bc0e2d7d` in
`/private/tmp/pantopus-staging-paid-gig`. It discovers the exact existing provider
intent after a lost response, returns verified readiness and durable amount,
rechecks delegated business authority, and persists chat plus in-app notification
outbox alongside assignment. The relay retries unknown transport outcomes under
one notification ID, with current eligibility/preferences; external transport is
at least once. All 4,730 backend tests pass (16 existing skips), fresh canonical
replay passes 20 SQL contracts and zero-error function lint, and 56 concurrent
PostgreSQL connections pass with exact cleanup. Populated upgrade rehearsal
preserves original Gig/Bid/Payment/acceptance values and historical chat rooms.
See the [recovery/delivery report](paid-gig-recovery-delivery-2026-09-09.md) for
privacy-gate results, source evidence and explicit remaining limitations.

Current master `d7be416b8` has been integrated, preserving the completed payment
acceptance and its reports. Integrate the separate exact test-fixture cleanup
fix and pass current-head CI, then finish native paid-bid recovery and
real test-mode paid-gig acceptance. Historical assigned off-session renewal,
payer refund receipts, wallet/Connect paths and final provider/device journeys
remain. No paid-gig provider call or hosted migration/runtime change has run.

Home admission/access-secret source is committed in draft PR #32 at `0362ba8f2`,
with master integration `4e0ecaa3e` passing 4,766 backend tests. Invitations and
guest/scoped sharing are the next isolated Home slices. Native sensitive-auth
PR #33 (`b85febb8c`) is now merged after complete CI as recorded above.
Main-checkout design/handoff changes
and unrelated PR #24 remain preserved.

### Current source and acceptance checkpoint — September 9

**Saved-card PaymentSheet acceptance and exact cleanup are complete.** Draft
[PR #31](https://github.com/WangPantopus/skinny-pantopus/pull/31) contains the
owned-setup recovery, atomic preferences/removal, customer-binding protection and
native accessibility repairs. Both simulators pass cancel → cold restart → same
setup, two-card save/default/cold persistence, removal cancellation/fallback/empty
state and normal logout. Provider/API checks confirm exactly two successful
setups per actor, foreign/removed-proof denial, no charges and exact cleanup.
The [payment report](staging-payment-sheet-2026-09-09.md) records the staged iOS
reconciliation, 85 focused native tests, 4,607 backend tests (16 skipped), privacy,
18 SQL contracts and 32-connection concurrency coverage. Never rerun the completed
payment actors, SDK setup or cleanup. No owner device input is pending.

**Next integrate PR #31 only after all final current-head checks pass**, then
continue the isolated paid-gig and Home authorization work below. No CI waiver
applies to this PR. The private API candidate remains committed `2e7b04293`, image
`2e0a32e8b0e2`; its additive payment migration is applied only to Free staging,
preserving existing records and the absent ledger. Native app source includes
`9fbf548bf`; later acceptance-selector edits are test-only. The prior private
candidate is retained stopped. Public API/worker, browser API/web and production
runtimes are unchanged. Source integration does not enable deployment.

Home work is isolated in `/private/tmp/pantopus-home-permission-boundaries`,
`codex/home-permission-boundaries`, draft [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
First effective-permission checkpoint `2fabe0c94` and finance RLS checkpoint
`a248b15c1` pass current-head CI; the latter passes all 20 SQL contracts. Initial
full backend coverage is 4,620 tests, privacy gates, 29 web hook tests and web
TypeScript. Core IAM/deletion is in progress: the raw authority contract passes
and deletion passes 13 local races; final source review/full integration tests
remain pending. No hosted Home policies or new role grants ran. Continue enrollment,
scoped resources, task/calendar/attachment/dashboard/recipient boundaries, client
navigation, then reviewed ordinary defaults and actual household acceptance.

Paid-gig work is isolated in `/private/tmp/pantopus-staging-paid-gig`, branch
`codex/staging-paid-gig`, initially from `89662d8da`. Backend/SQL work addresses
concurrent acceptance, proof before assignment, exact capture and cancellation
recovery. No hosted migration or provider call ran there. UI pending recovery,
selected-bid amount and scoped refund follow the first backend checkpoint.

The adoption inventory/audit documentation is pushed at `71473ed5a` on
`codex/staging-adoption-plan`. Ledger reconciliation, final candidate replay,
managed Auth/storage and external-object restore remain unfinished. Native
sensitive-screen invalid-capability handling is a separate pre-release repair
found during payment diagnosis; normal simulator success does not cover it.
Smarty subscription activation/retest remains an owner launch prerequisite, with
its existing reminder retained. PR #29/#30 and mail acceptance are complete.
The older checkpoint below is historical where it conflicts.

### Earlier source integration checkpoint — September 9

**Next active work:** `/private/tmp/pantopus-staging-payment-sheet`, branch
`codex/staging-payment-sheet`. Complete account-scoped recovery of the same
owned Stripe SetupIntent through native navigation/restart, then actual
PaymentSheet acceptance on both simulators with exact sandbox cleanup. Backend
reconciliation tests and privacy gates pass; lifecycle expansion and native
checks are in progress. No provider calls or live payment fixtures have run for
this milestone. It remains separate from the completed mail integration.

The [modern mail report](staging-mail-unit-binding-2026-09-09.md)
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

[PR #29](https://github.com/WangPantopus/skinny-pantopus/pull/29) merged as
`3009eb0be78efc900c234cc8588a7206526f9626` at 01:29 UTC September 10 after
[full final-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34425328329)
passed at `76ada1aa1`, including the repaired migration safeguard and complete
database replay. Its merged-master CI is pending. No checks were waived.
The modern printed web link, physical
mail and externally delivered Lob callbacks remain outside this acceptance;
the separate native postcard simulator journey is already complete.

The isolated [rollback binding repair](release-rollback-binding-2026-09-09.md)
is in `/private/tmp/pantopus-release-rollback-binding`, branch
`codex/release-rollback-binding`. The rollback workflow now forwards the same
environment-specific API binding as deployment; all 47 deployment-script tests
pass. It must pass current-head CI before integration. No hosted rollback or
configuration change ran; a real staging deploy/rollback rehearsal remains in
release preparation.

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

1. Mail-code dispatch/confirmation and saved-card native acceptance are complete.
   Continue PR #34 durable paid-gig refunds, assigned authorization and actual
   sandbox lifecycle acceptance. In parallel, finish PR #32 Home ownership,
   resource and derived-data boundaries before household acceptance. Real OAuth
   callbacks and activated Smarty provider coverage remain vendor prerequisites;
   Google/Apple staging OAuth remains disabled. Use existing/free capacity.
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
