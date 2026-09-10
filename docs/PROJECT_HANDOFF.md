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

### Browser exact task notification journey — September 10

Browser notification entry points now open an exact Home task through a current
permission read. Delayed taps cannot navigate after a session/view change;
reopening denied tasks hides their content. Browser OS alerts use the separate
preference-checked event. The [browser report](home-web-task-notification-routing-2026-09-10.md)
records full browser checks, current backend/privacy evidence, independent review
and actual Chrome exact-task/revocation/cross-tab acceptance against synthetic
HTTP replies. One broad backend HTTP failure passed its unchanged affected
recheck; no cause or hosted/provider acceptance is claimed.

**Next:** bring the existing browser task forms onto stable create receipts and
sparse edits; finish native attachments, Android exact notification routing and
installed household journeys. Android retained forms are pushed as `848bf28c6`,
iOS routing as `c1cac2a30`; payment opening-identity repairs continue after
`4dec19088`. Notification-list cache lifetime, automatic recurrence,
relationships/ownership and remaining payments/release work stay open. Both PRs
#32/#34 remain unfinished drafts. All paid services remain one final launch-
preparation step. Completed physical Beacon and saved-card acceptance must not
be repeated. No owner-phone installation, hosted data or paid service changed.

### Android retained task creation and sparse editing — September 10

Android task forms now preserve one protected original create request and exact
receipt across interruptions. Sparse edits preserve untouched fields and explicit
clears. Current access and view lifetime govern completion. The
[Android form report](home-android-task-create-edit-2026-09-10.md) records the
passing app/build checks, two actual emulator recovery-control checks and
independent review, with precise process-recovery and acceptance limits.

**Next:** Android exact task notification routing, native private task attachments
and complete installed household journeys. iOS exact notification routing is
pushed as `c1cac2a30`; browser parity is under final regression and browser
acceptance. Android payment identity repairs continue after stop recovery
`4dec19088`. Both PRs #32/#34 remain unfinished drafts. Automatic recurrence,
relationships, ownership, remaining payments and release preparation stay open.
All paid services or subscriptions remain one final launch-preparation step.
Completed physical Beacon and saved-card acceptance must not be repeated. No
owner-phone installation, hosted data or paid service changed.

### iOS exact task notification routing — September 10

Task notifications now open their exact Home task from validated metadata,
including an interrupted login/arrival. Current account, recipient and task
access govern opening; marking a notification read preserves its exact target.
The [routing report](home-ios-task-notification-routing-2026-09-10.md) records the
passing actual app build and 132 executed checks, strict source quality and
independent review. Installed notification acceptance remains separate.

**Next:** private native task attachments and complete installed household
acceptance. Android retained forms now pass their current behavior/static checks
and both APK builds; two Compose recovery checks are running on the emulator.
Browser exact task routes and preference-aware alerts are receiving final
session/navigation verification. Android paid-task stop recovery is pushed as
`4dec19088`; earlier payment coordinator identity edges are under repair in #34.
Both PRs #32/#34 remain unfinished drafts. Automatic recurrence, relationships,
ownership and remaining payment/release work stay open. All paid services remain
one final launch-preparation step. Completed physical Beacon and saved-card
acceptance must not be repeated. No owner-phone installation or hosted data changed.

### iOS retained task creation and sparse editing — September 10

Both iOS Home task entry points now retain one original create request across
interrupted responses and reopen the exact saved task after a verified receipt.
Editing sends only changed fields, including intentional null clears. Current
access, screen lifetime, protected-storage comparisons and a completed-form guard
prevent stale completion or another queued create. The
[iOS form report](home-ios-task-create-edit-2026-09-10.md) records the final passing
app checks, independent review and precise persistence/acceptance limits.

**Next:** exact notification-to-task routing, private task attachments and installed
household acceptance. The durable assignment outbox is pushed as `92a35b7f9`;
browser routing and preference-aware browser alerts are in progress. Android
retained forms compiled but need their remaining static/build/behavior checks;
no new Android form test success is claimed yet. Android paid-task stop recovery
also continues in draft PR #34. Automatic recurrence, relationships and ownership
lifecycles remain open. Both PRs remain unfinished drafts. All paid dependencies
stay together for final launch preparation. Completed physical Beacon and
saved-card acceptance must not be repeated. No hosted data or owner-phone
installation changed.

### Recoverable task assignment notifications — September 10

Home task saves and assignment changes now commit their in-app notification and
recoverable delivery together. Reassignment, lost access, completion and deletion
stop stale queued alerts; a disabled-at-assignment preference cannot replay after
push is restored. The [assignment delivery report](home-task-assignment-delivery-2026-09-10.md)
records the real database interruption/concurrency checks, clean complete replay,
exact populated-upgrade preservation and independently reviewed locking repairs.
One broad HTTP socket failure passed its unchanged affected-suite recheck; no
cause is claimed. Provider delivery remains at least once.

**Next:** finish retained native task forms and private attachments, then exact
notification-to-task navigation and hosted/provider household acceptance.
Automatic recurrence, relationships and ownership lifecycles remain unfinished.
iOS retained forms are in their final app/review cycle; Android form/recovery
repairs are underway. In draft PR #34, iOS stop recovery and browser saved-action
entry are pushed as `687d07cf8` and `d2b9b42a6`; Android stop parity continues.
Both PRs remain unfinished drafts. All paid services stay together for final
launch preparation. Completed physical Beacon and saved-card acceptance must not
be repeated. No hosted data, paid service or owner-phone installation changed.

### iOS task browsing and current actions checkpoint — September 10

Both iOS task roots now open exact read-only detail. Collection and record
capabilities govern the current actions; create/edit navigation rechecks access
before opening, completion rereads its result, and deletion requires its exact
receipt. Backgrounding or leaving clears content and invalidates suspended
work. The [iOS task report](home-ios-task-detail-2026-09-10.md) records the passing
final app build, current-session and queued-navigation checks, formatting, strict
lint and independent review. Android browsing is pushed as `e015b77f0`.

**Next:** retained task creation and receipt recovery, sparse editing with
intentional null clears, private attachments and durable assignment notices.
The existing forms do not yet preserve the new access contract throughout their
own lifetime. Complete native household acceptance and automatic recurrence
remain separate from browsing. Paid-gig native cancellation recovery continues
after its browser/backend milestones in draft PR #34. Both PRs remain unfinished.
All paid services remain one final launch-preparation step. Completed physical
Beacon and saved-card acceptance must not be repeated. No hosted data or paid
subscription changed.

### Android task detail and permission checkpoint — September 10

Android task rows now open actual read-only detail. Create, edit, completion and
deletion controls use current collection/record capabilities, exact task/Home
identity and the opening session. Screen disposal clears metadata and prevents
late permission reads from navigating. Deletion requires its exact response.
The [Android task report](home-android-task-detail-2026-09-10.md) records passing
behavior, formatting, static analysis, lint and APK assembly with independent
review. This verifies the built app; emulator journey acceptance remains separate.

**Next:** finish retained native creation, sparse editing with explicit field
clears, private task attachments and the durable assignment-notification outbox.
The matching iOS browsing candidate passed its final app verification and is being
committed separately. Existing recurring-task data is displayed; automatic task
recurrence is not implemented or certified by this checkpoint. Paid-gig stop
backend/browser milestones are pushed in draft PR #34, with native recovery
continuing. Both PRs remain unfinished. All paid dependencies remain together
for final launch preparation. Completed physical Beacon and saved-card acceptance
must not be repeated. No hosted migration or paid service changed.

### Recoverable task creation checkpoint — September 10

Task creation can now retain one exact request and recover its saved task after
an interrupted response. Changed input is rejected; deleted or inaccessible
tasks cannot be recreated by retry. The receipt shares the task transaction,
current permission checks and explicit Home deletion policy. The
[creation report](home-task-create-recovery-2026-09-10.md) records observed
concurrency races, full local SQL checks, exact function-body verification,
independent review and synthetic fixture cleanup. Assignment notification
enqueue remains best-effort and needs its own durable delivery checkpoint.

**Next:** native task detail, current capability controls, retained creation and
private attachments, then durable task assignment notifications and the remaining
household relationships/ownership lifecycles. Android task detail is compiling;
iOS task integration is in progress. Native private evidence is pushed on both
platforms (`cec7bb9a2`/`f6ebd1050`), with installed-app visuals and full household
acceptance still open. In draft PR #34, all three remote iOS jobs now pass the
tip fixture correction; stop receipts and browser recovery continue there.
Both PRs remain unfinished. All paid dependencies stay together for final launch
preparation. Completed physical Beacon and saved-card acceptance must not be
repeated. No hosted migration or paid service changed.

### Android private claim evidence checkpoint — September 10

Android now connects the claim wizard, My Claims and Home/platform reviewers to
private evidence upload, inspection, verification and retirement. Unknown
outcomes keep the original request; session and authority changes clear private
previews. The [Android report](home-android-private-evidence-2026-09-10.md) records
independent review, the final passing app checks and APK assembly, zero static
findings and zero lint errors. Existing project warnings remain documented.
iOS parity is pushed as `cec7bb9a2`.

**Next:** native task detail and attachments with current server capabilities,
plus stable task-create recovery before attaching files. The collection
capability is pushed as `d21192200`; its complete local SQL/HTTP checks pass.
The next creation receipt will preserve the exact task after an interrupted
response without duplicating it. Installed-app evidence visuals, relationships,
ownership lifecycles and full household acceptance remain open. Draft PRs
#32/#34 remain unfinished; durable paid-task cancellation/reopening/release and
browser recovery controls continue in #34. All paid subscriptions remain together
for final launch preparation. Completed physical Beacon and saved-card acceptance
must not be repeated. No hosted migration or paid service was activated.

### Current task collection permissions — September 10

Task lists now return an explicit creation capability from the same locked
authorization that governs task writes, including empty lists and the existing
private first-use path. Supplied stale sessions are rejected before reads, and
task list/detail responses are non-cacheable. The
[collection report](home-task-collection-capabilities-2026-09-10.md) records
independent review, passing HTTP checks, all local SQL contracts and application
function checks, unchanged role defaults and zero remaining synthetic fixtures.

**Next:** stable task-create recovery and native task detail/attachments using
these server capabilities. Native iOS evidence is pushed as `cec7bb9a2`;
Android now passes its final behavior, static, lint and APK assembly checks and
is being documented for commit. Installed-app visual evidence and full household
acceptance remain open, as do relationships and ownership lifecycles. Draft PRs
#32/#34 remain unfinished. Payment cancellation/reopening/worker-release receipts
and their browser controls continue in #34. All paid dependencies remain together
for final launch preparation; completed physical Beacon and saved-card checks
must not be repeated. This was a disposable local database check, with no hosted
migration or paid service activation.

### iOS private claim evidence checkpoint — September 10

The iOS claim wizard, Home/platform reviewers and My claims now use exact
private upload, inspection, verification and retirement records. Interrupted
uploads keep their original file identity; interrupted decisions keep only the
same receipt until retry. Access or session changes hide document content.
The [iOS evidence report](home-ios-private-evidence-2026-09-10.md) records the
final passing app build, independent review, bounded native rendering and
transport checks. Installed-app visual acceptance remains separate.

**Next:** finish Android evidence quality/assembly, then native task detail,
server-derived action capabilities and private attachments. Android behavior
checks pass; final lint and assembly are running. A task collection capability
contract is being added under the existing locked permissions, with stable
task-create recovery to follow. Household relationships, ownership lifecycles
and full Home acceptance remain open. Draft PR #32 remains unfinished. PR #34
has expiry protection pushed as `05676d6a5` and the iOS tip CI fixture correction
as `0037a3115`; durable cancellation/reopening/worker release is in progress.
All paid dependencies stay together for final launch preparation. Completed
physical Beacon and saved-card acceptance must not be repeated. No hosted
migration, provider setting or paid service changed.

### Browser private document preview repair — September 10

The sandboxed claim-evidence PDF viewer failed in an actual Chrome check. Its
replacement now renders the document through a validated, explicitly typed
preview, with escaped plain text and a same-file download fallback. Access
failures clear prior bytes, and interrupted verification retains its exact
receipt without letting another Open action discard it. The
[browser preview report](home-claim-evidence-browser-preview-2026-09-10.md) records
the real renderer reproduction and repair, independent review, complete browser
regression, and clean type/lint checks.

**Next:** finish native private evidence upload/read/verification/retirement and
task attachments, then remaining relationships, ownership lifecycles and full
household acceptance. Both native evidence candidates are under final app
verification; this browser milestone does not certify those journeys. PR #32
remains draft and unfinished. In PR #34, assigned-payment recovery is pushed on
both native platforms and provider-derived hold deadlines are pushed as
`9ef31ba7c`; durable expiry reconciliation and delivery continue. A fresh Stripe
test-mode hold was released with zero capture and its synthetic customer was
cleaned up; the complete provider lifecycle remains open. All paid dependencies
stay together for final launch preparation. Completed physical Beacon and
saved-card acceptance must not be repeated.

### Private Home evidence and task attachments — September 10

Private uploads now retain exact file identity through interrupted writes,
current-access checks, reviewer inspection and cleanup. Claim evidence requires
explicit verification before separate claim approval. Task attachment retries
retain the saved task and upload identities. Withdrawing an ordinary claim now
allows its claimant to retire pending evidence without granting household access.

The [evidence report](home-claim-private-evidence-2026-09-10.md) and
[task attachment report](home-task-private-media-2026-09-10.md) record independent
review, actual private Storage API journeys, concurrent SQL operations and a
clean sorted migration replay. The combined backend/browser passes are complete;
a final metadata cache-header repair passed its affected HTTP suite. These are
local source and workflow checks, not hosted or native acceptance.

**Next:** native private evidence upload/view/verification and task attachments,
claimant document retirement, remaining household relationships and ownership
lifecycles, then full household acceptance. Draft PR #32 remains unfinished;
complete-current-head CI is still required. Payment recovery backend/browser
checkpoints are pushed in draft PR #34; iOS/Android parity and the remaining
provider lifecycle work continue there. No hosted migration or paid dependency
was activated. All paid services remain together for final launch preparation.
Completed physical Beacon and saved-card acceptance remains complete.

### Android claim review and iOS runtime verification — September 10

Android now submits the exact displayed claim/evidence snapshot and accepts only
matching decision or retained-history withdrawal receipts. Session replacement
retires the old screen before another read or write, including collector lag.
The [Android report](home-android-claim-review-2026-09-10.md) records final app
assembly, formatting/static checks, zero lint errors, 47 focused behavior checks
and independent review. The source is ready for this milestone's commit/push.

The dashboard repair at `a68bbc5a8` now passes all three affected iOS 18.5
simulator jobs in [CI run 34455246057](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34455246057).
The [runtime report](home-ios-dashboard-concurrency-2026-09-10.md) preserves the
original failures and final evidence. Android quality CI is still running at
this observation; a complete final-head pass remains required before integration.

**Next:** finish trusted private claim evidence and task attachments, then native
evidence controls, relationship/residency receipts and complete household
acceptance. Draft PR #32 remains unfinished. Paid-gig recovery continues in draft
PR #34. All paid dependencies stay together for final launch preparation; completed
physical Beacon and saved-card acceptance remains complete. No hosted policy,
provider, subscription or production setting changed.

### Remaining iOS dashboard concurrency repair — September 10

The repeated iOS 18.5 crash still points to async-let cleanup in dashboard core
loading. Its three remaining async lets now use a typed task group, preserving
concurrent requests and publishing only after joining. The [runtime report](home-ios-dashboard-concurrency-2026-09-10.md)
records the second crash evidence, unchanged assertions, independent review and
13 passing final local dashboard checks with no new warnings. Current-head
remote iOS 18.5 verification remains required; draft PR #32 is not merge-ready.

The iOS claim checkpoint is committed/pushed as `9035329a1`. Android validation
found that its API error type extends Throwable directly; review catches now
handle those errors while preserving cancellation and fatal-error behavior.
Its full focused/static/build checks are running. **Next:** verify the dashboard
on CI, finish Android claims and private task attachments/evidence, then complete
the remaining Home workflows and household acceptance. PR #34 has both native
refunds committed/pushed (`61501a3c5`, iOS summary `296ce1b8b`); historical assigned
payment recovery and browser alert preference handling continue there.
Paid dependencies remain deferred together until final launch preparation.

### iOS claim review and withdrawal checkpoint — September 10

The native Home/platform review screens now submit the exact displayed evidence
snapshot and verify the returned claim, actor, Home, action and resulting access.
Interrupted decisions preserve their original token for retry. Withdrawal requires
an exact receipt and retains history. The [iOS claim report](home-ios-claim-review-2026-09-10.md)
records 47 final simulator checks, strict formatting/lint, no new warnings and
independent review. Android parity is closing a same-account session-replacement
race; private task attachments and trusted evidence remain in progress.

Current remote CI on `c315267a6` passes backend, database, web and Android, but
all three iOS 18.5 test jobs failed again in [run 34451266542](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34451266542).
The dashboard runtime repair is not yet confirmed; root is investigating the
new failure evidence. Local iOS 26.5 passes do not replace that required check.
**Next:** finish Android claims, repair the iOS runtime failure, then private
claim evidence and task attachments, remaining Home journeys and household
acceptance. Draft PR #32 stays unmerged. Refund controls and durable wallet notices
are committed in PR #34; historical assigned-payment recovery continues there.
All paid services remain deferred together until final launch preparation.

### Ordinary claim review transaction checkpoint — September 10

Ordinary Home/platform claim review and withdrawal now bind the displayed
snapshot to current authority and exact evidence in a guarded transaction.
Resident/admin roles remain intact. A lost successful response can recover its
protected receipt without granting access or notifying twice. Withdrawal retains
history and rejects competing acceptance. Untrusted legacy evidence references
are quarantined; trusted private evidence delivery remains the next milestone.
The [claim review report](home-claim-review-transactions-2026-09-10.md) records
24 clean migrations, 30 SQL contracts/wrappers, 32 observed races, six SDK checks,
zero application SQL lint errors and exact fixture cleanup. Final backend checks
pass 4,946 with 16 existing skips and one local chat socket hangup; all 26 checks
in that unchanged suite pass separately. Privacy gates pass. Final-head remote CI
remains required before merge; no hosted Home policy or default role changed.

**Next:** native claim snapshot/withdrawal controls, then trusted private claim
evidence; private task attachments proceed independently. Complete task-to-gig,
ownership/lease/challenge flows, derived views and full household acceptance
remain open. Native payment refunds continue in draft PR #34. Android bill
permission/recovery controls are committed/pushed as `399ac1c3b`; dashboard repair
`5c959a64a` still needs iOS 18.5 CI proof. Paid dependencies remain deferred to one
final launch-preparation step. Completed Beacon/saved-card device checks stay
complete and must not be repeated.

### Android bill permission checkpoint — September 10

Android now preserves bill viewing while enforcing current effective finance
permissions for changes. Screens and success/navigation callbacks stay bound to
the opening account/session/API. Split-read failure preserves the verified bill
with an explicit retry, and mutation responses must match the exact record and
requested status. The [Android bill report](home-android-finance-access-2026-09-10.md)
records 62 focused checks, formatting/static checks, zero Android lint errors,
debug assembly and independent review. Full household acceptance remains open.

The iOS follow-up is committed/pushed as `2f3e6cac4`. Final ordinary claim-review
SQL verification now passes 24 migrations, 30 contracts/wrappers, 32 races and
6 SDK checks; its final backend regression is being completed before commit.
Then integrate native claim snapshot controls, trusted private evidence and task
attachments, followed by the remaining Home workflows. Native refunds continue
in PR #34. Paid dependencies remain grouped at final launch preparation.

### Bill-detail recovery follow-up — September 10

The iOS bill detail now distinguishes unavailable split data from an empty
allocation list, and confirms the requested status before marking a change
successful. Fourteen focused access/detail checks and independent review pass;
see the [bill report](home-ios-finance-access-2026-09-10.md). Android parity and
its static checks remain in progress. Dashboard runtime repair `5c959a64a` is
pushed; iOS 18.5 CI remains the required verification for its crash repair.

Claim review is in final transaction/replay validation, including an actual NULL
platform-role denial repair, exact lost-response receipts and protected private
withdrawal provenance. Private evidence and attachments follow. Native refund
controls are being implemented separately in PR #34. Paid services remain
scheduled for one final launch-preparation step; no purchase or owner action is
needed during these source checkpoints.

### iOS dashboard runtime repair — September 10

The previous Home CI failure is traced to ten dashboard-loading crashes on iOS
18.5, with Swift async-let cleanup in the captured crash stack. The dashboard
now retains concurrent reads in a structured task group and gathers core results
before publishing observed state. The [runtime report](home-ios-dashboard-concurrency-2026-09-10.md)
records the evidence, independent review and 13 passing final local dashboard
checks. The required iOS 18.5 CI proof is still pending; do not merge or mark the
crash resolved based only on the newer local simulator.

iOS bill controls are separately committed/pushed as `ca2a602c1`. Continue
Android parity, current claim-review/withdrawal recovery and protected evidence,
then private task attachments and complete Home workflows. The task/calendar
source's local socket-failure limit remains recorded below. Paid dependencies
remain deferred together until final launch preparation.

### iOS bill permission checkpoint — September 10

Read-only Home members can view bills without mutation controls. Direct bill
entry, retained actions and each save/remove/mark-paid operation recheck current
effective permissions and the original account/session/API scope; response
identity must match the exact Home and bill. Failed removal keeps the detail open.
The [iOS bill report](home-ios-finance-access-2026-09-10.md) records 59 focused
simulator checks, formatting/strict lint and independent review. API fixtures do
not replace actual household acceptance. Android parity continues independently.

The Home record transaction is committed/pushed as `14f98c115`; the report below
retains its explicit local HTTP socket verification limit. Claim review/withdrawal
and trusted private evidence remain active. A separate Home dashboard async
cleanup crash on CI's iOS 18.5 runtime is being repaired; that runtime must pass
before merge. Native Home claim review snapshot binding, private attachments,
derived views and complete household acceptance remain next. Paid dependencies
stay deferred to the final combined launch-preparation step as requested.

### Home task/calendar transaction checkpoint — September 10

Home task and calendar reads/writes now apply the current effective permission,
visibility, creator/assignee restrictions and source-mail access in guarded
transactions. Mail conversion and deletion keep the exact backlink consistent;
assignment notifications use the current assignee and title. Derived Home lists
and scheduling paths use the same record boundary. Direct client table bypasses
are closed. The [record report](home-record-authorization-2026-09-09.md) records
**128 final focused checks**, all privacy gates including **15 E2E checks**,
**29 SQL contracts/wrappers**, **17 observed races**, **6 SDK checks**, zero SQL
lint errors and exact fixture cleanup on a fresh 23-migration replay.

The pre-notification full backend run passed 4,906 checks with 16 existing skips.
Three final full runs each passed 4,907 with one socket failure in different
HTTP suites; all 47 unchanged affected-suite rechecks pass. The cause remains
unproven and final-head remote CI is required. Separately, previous-head iOS CI
crashes in Home dashboard async loading are under active investigation; no
merge or full Home acceptance is claimed.

**Next:** finish private task attachments and task-to-gig conversion, ordinary
claim review/withdrawal plus trusted private evidence, remaining native/web
controls and derived views, then full household acceptance. Existing task-media
upload and task-to-gig shortcuts return explicit unavailable errors until their
complete workflows are implemented; this checkpoint does not mark them done.
Native iOS bill controls have passed focused verification and independent
review and await a separate source checkpoint; Android parity is active.
Paid-gig residual wallet settlement is committed/pushed as `fbac89ef1` in draft
PR #34, with provider/native workflow acceptance still required.

The owner defers **all paid subscriptions and paid dependencies** to one final
launch-preparation step after other development and available validation.
The prior timed Smarty reminder is paused. Track activation and real-provider
acceptance together; do not buy or activate subscriptions now. Prioritize
complete, recoverable user workflows, maintainable code and realistic capacity
validation; unit test counts alone do not establish launch readiness. Completed
physical Beacon and native saved-card acceptance must not be repeated.

### Claim invitation transaction checkpoint — September 9

Claim-bound invitation issuance and acceptance now commit the exact claim,
identity evidence, membership, ownership proof, invitation receipt and audit in
one guarded transaction. Resident/admin claims retain their roles; co-owner
acceptance preserves the existing primary owner, age, dates and restrictive
overrides. Revoked access cannot be restored by replaying a completed invitation.
The [claim invitation report](home-claim-invitation-transactions-2026-09-09.md)
records **4,861 backend tests passing (16 skipped)**, all privacy gates including
**15 E2E checks**, **28 SQL contracts and wrappers**, **20 observed lock-wait
races** and **6 SDK/PostgREST checks**. Final function lint has zero errors and
five unchanged warnings; all exact fixtures are removed. The final migration's
six function bodies match the checked runtime byte for byte.

This milestone and native navigation `115c238ac` are in draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32). Final-head CI
and full household acceptance remain required. **Next: guard the ordinary claim
review, withdrawal and evidence lifecycle atomically.** That legacy review can
still promote a resident/admin claim to ownership, and stale withdrawal can
delete evidence after a competing acceptance. Task/calendar/resource work
continues independently in `20260910060000`; private attachment delivery,
remaining native/web finance controls, derived data, ownership/lease flows and
ordinary-default review remain unfinished. No hosted Home policy, ordinary role
grant or production runtime changed. Paid-gig web/backend refund checkpoints
are separately committed/pushed in draft PR #34; residual worker settlement is
its next active source milestone. Completed Beacon and saved-card acceptance
are not repeated.

### Native Home navigation checkpoint — September 9

Both native clients now require the effective permission list for Home tab and
quick-action navigation, including member management and document entry.
`finance.view` opens Bills without granting changes; absent access and recorded
owner/admin roles do not bypass a deny. Refreshing after access loss resets an
unavailable selected tab to Overview. The [native report](home-native-effective-navigation-2026-09-09.md)
records **53 iOS and 54 Android focused tests passing**, formatting, static analysis,
Android debug assembly and independent review. Native bill forms/FABs, other entry points and derived overview data remain
unfinished; this is a bounded source milestone, not household acceptance.

The previous Home invitation/sharing plus master-integration head `269128f31`
passed every applicable [CI check](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34441879676).
Continue the active claim-bound invitation transaction (`20260910045000`) and
task/calendar/media boundary (`20260910060000`) slices, then the remaining
ownership/lease lifecycle, private attachment delivery, native/web controls and
household acceptance. PR #34 separately has native paid-bid recovery and accurate
charge-summary checkpoints pushed; durable refunds and settlement serialization
are under implementation. No paid-gig provider acceptance or hosted Home rollout
has run.

### Home invitation and exact-resource sharing checkpoint — September 9

Home source milestone `0c973b8df` is committed and pushed from
`/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
The [invitation/sharing report](home-invitation-sharing-2026-09-09.md) records
transactional invitation creation/acceptance/decline, household requests and
current-permission lists, plus exact guest/scoped resource sharing. Targeted
invites bind to the verified Auth identity; open links require their token.
Policy, age, status, access windows and restrictive overrides are rechecked
atomically. One-time document receipts preserve single-view quotas and recheck
access after storage fetch. Invalid supplied credentials cannot become anonymous
access. Web forms now show real QR codes for the exact created token URLs and
send unambiguous access dates.

The final combined Node 22 suite passes **4,827 backend tests (16 skipped), 299
suites**, with all privacy gates including **15 E2E checks**. Final sharing review
repairs have **85 focused backend checks passing**, invitation routes/evaluator
checks **128**, and combined web invitation/date/sharing/QR checks **15**. The web
type gate reports zero errors. All **27 raw SQL contracts and 27 pgTAP wrappers**
pass; **36 real PostgreSQL lock-wait races** pass (15 invitation, 21 sharing), with
exact fixture cleanup. A further fresh disposable replay passes all **21 migrations**, with **158
application functions/75 trigger bindings**, zero lint errors and five existing
warnings. Its 321-table/499-policy schema has no leftover user/Home/receipt
fixtures. All **6 real SDK/PostgREST checks** pass on the fresh replay and leave
those counts at zero. The new receipt history is included in the conservative
private Home deletion guard. The final complete backend rerun passes; earlier
intermittent HTTP socket/timeout observations and their passing 75 focused
rechecks are recorded without claiming a cause. Current master `390091cdb` is now integrated; only the handoff conflicted,
and both source milestones/reports are preserved. No hosted Home migration,
ordinary role grant, verification-age rollout or release ran.

**Next:** finish the distinct claim-bound invitation transaction
(reserved Home migration `20260910045000`; paid-gig refund work owns
`20260910050000`), then claim submission/challenge and ownership/lease lifecycle.
Continue task/calendar/attachment/derived data access and
mutations, remaining web/native permission and finance read-only controls,
storage retirement/deletion, and ordinary-default review only once every
alternate path is protected. The resource slice may reserve `20260910060000`.
Invitation delivery remains best effort; lost-create-response revoke/reissue UI
acceptance is still required. Hosted storage-provider and native Home sharing
acceptance remain untested in this bounded checkpoint. The dedicated claim-merge service remains a known
ownership release blocker, including its unsupported `HomeInvite.updated_at`
write. This checkpoint is not full Home acceptance.

Native sensitive-auth [PR #33](https://github.com/WangPantopus/skinny-pantopus/pull/33)
merged after all final-head CI checks passed (run `34437250525`) at 05:01:17 UTC
September 10, producing master `390091cdbfb12c3f2a2b7ce331453433d6344e80`.
That master is integrated into the Home worktree at `269128f31`. Completed
physical Beacon and native saved-card acceptance are not repeated here.

### Home access-secret and residency admission checkpoint — September 9

The next bounded source checkpoint is complete in
`/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, for draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
The [Wi-Fi/access-secret report](home-access-secret-transactions-2026-09-09.md)
and [residency-admission report](home-residency-admission-2026-09-09.md) record
**4,713 backend tests passing (16 skipped), all privacy gates including 15 E2E
checks, 24 raw SQL contracts plus 24 pgTAP wrappers and 27 concurrency checks**.
SQL lint has zero errors and five existing warnings. Independent review caught
and closed a secret-type relabel read-deny bypass before this source freeze.

Wi-Fi/code metadata and values now write atomically, read permissions include
type and visibility, and private creators retain only exact own-setup access.
Manager attach and residency approval/rejection now lock and recheck current
authority and target state; they preserve age, dates and restrictive overrides,
and cannot silently restore revoked membership. No ordinary role grant,
verification-age rollout or hosted Home migration ran. This remains a source
checkpoint, not full Home acceptance or a release.

Source checkpoint `0362ba8f2` is committed and pushed. Current master has been
integrated as `4e0ecaa3e`, retaining the completed payment changes and both
handoff records. The combined backend suite passes **4,766 tests (16 skipped),
295 suites**. A fresh disposable Supabase 2.116.0 replay passes all **19 committed
migrations**, **25 raw SQL contracts and 25 pgTAP wrappers**, all **6 real
SDK/PostgREST baseline checks**, and payment concurrency assertions across 32
connections. Application lint covers **142 functions and 75 trigger bindings**
with zero errors and five existing warnings. Existing databases were untouched;
all exact test fixtures are removed. The payment concurrency harness now removes
its independent public.User fixture as well as auth.users and asserts that the
exact user/card/removal records are gone. Pending invitation/sharing sources
were not included in this combined checkpoint's replay.

**Next:** finish
invite creation/acceptance/decline and household-request conversion. Follow with
claim submission/challenge and remaining ownership/lease lifecycle paths,
guest/scoped exact-resource sharing, task/calendar/attachment access and derived
data filtering, storage retirement and web/native permission controls. Direct
invitation DML and old alternate admission paths remain release blockers. Review
ordinary defaults only after those paths are protected, then run integrated Home
acceptance. Keep updating this handoff after each milestone.

Payment [PR #31](https://github.com/WangPantopus/skinny-pantopus/pull/31) merged
after all final-head checks passed (run `34434288893`), producing master
`d7be416b872a31ceb53094d7d19c3f114185831f` at 04:15:08 UTC September 10.
The prior Home head `7f6b59ba3` also has all CI checks green; this new head must
pass again after integration. Native sensitive-auth source is independently
reviewed and locally validated in [PR #33](https://github.com/WangPantopus/skinny-pantopus/pull/33),
head `b85febb8c`, with CI pending at this observation. Completed Beacon physical
device and native payment acceptance must not be repeated. Earlier payment
pending notes below are historical where they conflict with this entry.

### Home authority/deletion source checkpoint — September 9

The next bounded Home checkpoint is complete in
`/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, for draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
The [authority/deletion report](home-authority-transactions-2026-09-09.md)
records **4,661 backend tests passing (16 skipped), privacy gates including 15
E2E checks, 22 raw SQL contracts plus 22 pgTAP wrappers, and 24 real concurrency
checks**. Independent review and root review accept this bounded core; SQL lint
has zero errors and five existing warnings. Current-head CI must pass before
integration; continue the remaining Home work from this checkpoint.

Member role/preset/override/removal and Home deletion now use service-only
transactions with current authority, age/window/rank and explicit-deny checks.
Direct client authority DML and the unsafe legacy preset/transfer shortcuts are
closed. Exact private creator cleanup and legitimate primary-owner transfer
requirements remain; a proven stale revoked-owner pointer can clear atomically
when its exact subject leaves. Attached file/evidence history blocks Home
deletion until storage retirement exists. No hosted Home migration, new ordinary
role grant or verification-age rollout ran. This remains a source checkpoint,
not complete Home acceptance or a final release.

**Next:** finish transactional admission/invite/claim lifecycle gateways while
repairing the reproduced WiFi-secret creation trigger defect. Then finish exact
resource/guest sharing, task/calendar records and attachments across alternate
routes, dashboard/notification filtering, storage retirement and web/native
permission controls. Only then review ordinary role defaults and run integrated
household acceptance. The report separates these remaining gates from completed
core work. Payment final-head checks/integration continue separately; completed
Beacon physical-device acceptance should not be repeated.

### Home finance RLS source checkpoint — September 9

Draft [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32) now adds a
separate finance RLS repair after the effective-permission checkpoint. All 20
local SQL contracts pass; a ten-actor/three-table matrix and populated migration
rehearsal prove explicit denies and row preservation. Ownership, home.edit and
split assignment no longer bypass finance permissions through legacy policies.
The first checkpoint `2fabe0c94` passed full CI; this new head must pass again.
No hosted Home changes or ordinary role grants ran. Continue transactional
IAM/deletion, task/calendar record and attachment access, then client navigation
and reviewed defaults. Details remain in the linked effective-permission report.

Android real PaymentSheet acceptance/provider checks pass; iOS acceptance and
exact payment cleanup continue independently in PR #31. Do not rerun completed
Android card setup, mail or physical iPhone Beacon journeys.

### Current Home authorization checkpoint — September 9

The first bounded Home repair is in `/private/tmp/pantopus-home-permission-boundaries`,
branch `codex/home-permission-boundaries`, based on merged PR #30 (`c262b84afe`).
The [effective-permission report](home-effective-permissions-2026-09-09.md) records
4,620 backend tests passing (16 skipped), privacy gates, 63 focused authorization
cases, 29 web hook tests, web TypeScript, 19 SQL contracts and independent review.
Effective membership, time/age ceilings, explicit denies and narrow private pickup
now agree across the repaired JS/SQL paths. A reproduced finance read-to-write
regression is repaired and tested with real RLS roles. No role grants or hosted
Home changes ran. This is a source checkpoint, not full Home acceptance.

Next continue direct IAM/deletion and legacy RLS boundaries, task/calendar record
and attachment visibility, recipient limits and finance read-only navigation.
Only then review ordinary role defaults and run the integrated household journey.

In parallel, draft [PR #31](https://github.com/WangPantopus/skinny-pantopus/pull/31)
remains at `2e7b04293` with full CI passing (run `34428681238`). Its payment
migration is applied only to Free staging, preserving existing records and the
absent ledger. The private candidate is `2e7b04293`/`2e0a32e8b0e2`, with the prior
candidate retained stopped. Native SDK acceptance and exact cleanup are active;
do not rerun fixture initializers or the migration. Public/browser/production
runtimes are unchanged. PR #29/#30 are merged; the older checkpoint below is
historical where it conflicts. Physical iPhone Beacon acceptance is complete.

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

1. Mail-code and native saved-card acceptance are complete. Continue Home
   ownership/lease and task/calendar/resource/derived-data boundaries in PR #32.
   In parallel, PR #34 native paid-bid recovery is committed at `59b9cff7b`,
   integrated with master at `6b3559d42`, and passes 101 iOS/148 Android tests;
   final-head CI is running. Durable refunds, assigned authorization and actual
   paid-gig sandbox acceptance remain next. Real OAuth callbacks and activated
   Smarty coverage remain vendor prerequisites. Use existing/free capacity.
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
