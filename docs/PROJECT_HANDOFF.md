# Pantopus project handoff

Updated September 13, 2026 after existing landlord-flow verification. This is the
current entry point. The [80-row inventory](REMAINING_WORK_2026-09-11.md) remains
the ordered backlog; dated reports preserve source-specific evidence.

## Current direction, state and next action

**Preserve working implementations and existing screen designs.** Follow
[AGENTS.md](../AGENTS.md) and the [reconciliation](VERIFICATION_FIRST_2026-09-13.md).
Trace the existing screen, caller, route, service and SQL before changes. An open
acceptance row does not authorize a rebuild. Reuse unchanged accepted evidence.

**Active worktree:** `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/lease-approval-dates`, draft [PR #38](https://github.com/WangPantopus/skinny-pantopus/pull/38)
against `codex/home-permission-boundaries`. It repairs demonstrated lease date,
admission, end/move-out, tenant status/cancellation and request-submission defects.
The same service-only transaction uses existing lease/invitation/resident/occupancy/
audit records, current authority and Home locks. It preserves independent membership,
makes access changes atomic, and binds completed retries to membership generations.
Self move-out reuses the accepted removal policy. No tables or replacement screens
were added; the only migration is still unmerged. Request creation is serialized,
and the existing form recovers matching saved requests after lost replies.

**Last pushed tenant privacy source:** `0f54be50a6fc55b13b7425686d6f3c202ef3723c`
passes all eight applicable checks in
[CI34799934365](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34799934365),
with three unchanged native/Seeder skips. Its 41 rendered checks, fresh types/lint,
three actual browser/SDK/HTTP/SQL account-boundary cases and tenant lifecycle/recovery
compatibility pass. Old Home/account responses and cancellation callbacks retire
without exposing prior request data or erasing the new account's draft. See
[tenant privacy evidence](VERIFICATION_FIRST_2026-09-13.md#existing-tenant-homeaccount-boundaries).

**Completed landlord Home/account privacy follow-up.** Actual Chrome reproduced an
old authorized response restoring tenant details and approval controls after the
new account received HTTP403. The existing property component now retires reads,
validates Home identity, and gates action callbacks with the current lifetime.
Late approvals cannot refresh the new view; retired end failures cannot alert it;
a denial prompt cannot send after an observed account change. Property-detail
responses are private/no-store. Existing markup, layout, styles and navigation are
preserved. All 46 relevant rendered checks, 66 route checks, standalone TypeScript,
scoped lint (one pre-existing warning), actual stale-read/committed-approval browser
cases and six approval/three end browser compatibility cases pass. Current landlord
source `1a17a22a9fe5e4490e56290f1d51f50af1d0fa39` passes all eight applicable checks
in [CI34800605686](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34800605686),
with three unchanged native/Seeder skips. See [landlord privacy evidence](VERIFICATION_FIRST_2026-09-13.md#existing-landlord-homeaccount-boundaries).

**Queued-request web follow-up:** actual HTTP/SQL and Chrome reproduced a delayed
original creating a second pending lease after its retry was canceled. The existing
status response/form now carry the actor's latest lease ID and stored state; the
same Home-locked transaction rejects a stale observation. Actual HTTP and browser
retry → cancel → release-original checks pass, as does an explicit fresh request.
122 backend/48 rendered tests, types, scoped lint and the full lease SQL contract
pass. The existing unmerged migration is updated; no new tables or screen designs.
See [queued-request evidence](VERIFICATION_FIRST_2026-09-13.md#existing-queued-tenant-request-follow-up).
Application source `25c6a5c01` at checkpoint `1e4d5a644` passes all 15 applicable
[CI34806113797 checks](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34806113797), with 1 unchanged Seeder skip.

**Native and second web caller follow-up:** the existing iOS/Android request
controllers and separate web details page now read current status and submit its
Home/actor/lease observation. Native omitted nil fields are normalized by the
existing route. Failed/malformed status prevents submission; failures retain the
form. The second web caller also retires account/Home/unmount work. 27 focused iOS,
26 Android, 51 rendered web and 122 backend tests pass, with web types/lint and
Swift checks. Actual second-page browser/SDK/HTTP/SQL checks pass for failed reads,
a delivered old-account preflight and a persisted request. Actual HTTP/SQL also
accepts omitted nil fields and rejects the queued original. See [caller evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-and-second-web-request-context).

**Android departure follow-up:** a focused baseline reproduced a held status
read still sending POST after Back/Discard. The existing controller now cancels
pending work; the repository checks cancellation before POST, and the controller
checks again before applying a late result. All 28 focused Android tests and
formatting pass, including deliberately noncancelable old responses. This is
model/repository evidence, not installed UI acceptance.

**iOS departure follow-up:** a delayed-status baseline reproduced submission
and Sent after Back/Discard. The existing controller/view now retire owned work
and reject late results. All30 focused tests and Swift checks pass. Actual installed
iOS Back → Close → Discard against real tenant routes/isolated SQL cancels the
held status with zero POSTs, leases or notifications and returns to Hub. Login and
shell responses are synthetic; provider identity/delivery are not verified.
Actual UI also proves the attachment button inserts a sample lease without upload,
and the Home chip uses a sample address. See [current evidence](VERIFICATION_FIRST_2026-09-13.md#existing-ios-request-departure).

**CI correction:** exact10c68a906 CI34808888971 failed Android Detekt's condition
complexity limit; all13 other non-aggregate jobs passed, with one Seeder skip.
The equivalent simplified condition passes local full detekt/ktlint and28 focused
Android tests. New remote CI is required before integration.

**iOS saved-request recovery:** the installed app reproduced a committed request
whose reply timed out; restart reopened an empty Start screen. The existing DTO now
reads the status endpoint's existing lease, and the existing wizard restores its
pending/active confirmation with saved dates/message using GET only. It reuses
HomeClaimSessionScope to retire old-session reads/submissions and clear the draft.
All36 model/network tests and7 existing screen checks pass, with Swift lint/format.
The installed candidate recovers the same pending lease without another POST.
Normal Settings logout → second synthetic login → same Home shows no prior tenant
confirmation/message. These checks use synthetic auth/shell and actual tenant SQL.
See [recovery evidence](VERIFICATION_FIRST_2026-09-13.md#existing-ios-saved-request-recovery).

**Next:** check the existing Android recovery path, complete native background/
foreground behavior, then repair the demonstrated attachment/Home-label/provider-copy
defects using existing upload and status paths. The API still accepts older clients without context. The separate
submitted page's notification/time estimate and native email claims remain open.
Do not build speculative command/renewal tables; the separate renewal draft stays
paused. R05 stays open; the [80-row inventory](REMAINING_WORK_2026-09-11.md)
remains **8 locally closed / 72 partial or open**, not a completion/effort percentage.

**Current native candidate:** actual HTTP/SQL confirms HTTP 400 responses
for frozen Homes, unresolved units and invalid dates, HTTP 404 for a missing Home, and HTTP 400
for the distinct no-landlord case. The existing Android/iOS models incorrectly
treated every HTTP 400/404 as mail fallback and every HTTP 409 as a saved lease. Android's new
baseline regression failed; the focused candidate suite now passes. Both existing
models now distinguish the known responses and keep other failures in the form.
The existing detail screens also did not bind submission errors; they now reuse
their existing error banner. Android's three detail snapshots pass, with the normal
and validation-error goldens unchanged; only the new submission-error variant has
a new test PNG. SwiftLint/SwiftFormat pass for the changed Swift files.

All 32 focused iOS tests pass, including a screenshot/OCR check of the actual error
banner. Both native error renderings were visually checked. One baseline build
stopped with exit73 during disk
exhaustion before tests ran. Removing old disposable Pantopus compiler intermediates
restored 9.94 GiB free while preserving source, compiled products and evidence. The
next build found an ignored, stale generated Xcode project omitting existing native
files; it was backed up and regenerated without changing environment overlays.
The focused iOS retry passed on a newly created, exclusively owned simulator, now
shut down and deleted; its `native-error-runtime-lease.json` is released. Compiled
products and result bundles are retained. Check available disk space before another
heavy native build, and run only one at a time. No physical device was involved.
Local acceptance is source-bound under `native-errors-r1`; this native candidate
at `29603b01a9151705c44456950e0d46dfb7bf40f6` passes all15 applicable checks in [CI34803605947](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34803605947), with one unchanged Seeder skip. See [the current native evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-submission-error-follow-up).

**Verification limits:** browser evidence uses actual components, SDK, HTTP and
SQL with synthetic authentication in an isolated renderer. Full AppShell/login,
background lifetimes and installed lease-verification consumers are not claimed.
Accepted native Leave Home source is unchanged and its evidence is reused. Actual
provider delivery, combined populated adoption and hosted rollout remain open.
The schema-only lease DB, REST18089 and private Next18110 remain exclusively leased
to `/private/tmp/pantopus-lease-transaction-r1`; inspect its private runtime lease
before reuse. Docker control calls currently stall, but the owned REST18089 and direct database64522 respond. The private direct-SQL helper verifies the exact database before use; avoid repeated stalled Docker exec calls or a global restart. Synthetic fixtures are cleaned after checks. No provider/production
activation occurred. Owner checkout edits and unrelated worktrees are preserved.

**Other verified Git state:** Home integration [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32)
is draft at `7f2a5e6d6afe18c69c646320aa13e70a2f81b999`, with all16 checks passing
[CI34790255357](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34790255357).
It includes accepted #35 reviewer history, #36 private queue/presentation and #37
current invitation-issuer authority repairs. Preserve their source-specific native
and SQL acceptance; detailed chronology is in linked reports. Draft
[PR #34](https://github.com/WangPantopus/skinny-pantopus/pull/34) was conflicting
against master at `e9ef2decbb7ec435589bb3b92639041cfc4618a6`; paid/provider journeys
remain incomplete. Master was `6a1013784db69bf339535a2f4b33b328f2bbf40c` at inspection.
Recheck remote state before integration. Earlier failed CI and the corrected
masked local TypeScript failure remain recorded in the verification report.

**Device cleanup requested by the user:** six completed iOS test simulators and
two inactive Android AVDs were removed, plus a tiny unregistered AVD folder. Free
space increased by about 6.5GiB at measurement. The owner's running iPhone17,
iOS Bill Acceptance and Android Home Recurrence Acceptance remain, along with
shared runtime/SDK images and saved products/evidence. The finished lease-context
simulator lease is released. Use the retained devices for the next relevant work.

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
