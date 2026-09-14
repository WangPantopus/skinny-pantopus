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

**Next:** verify background/return behavior, reconcile the legacy request API's
queued-original boundary using existing records, then verify remaining installed
lease-verification consumers. Saved-status recovery does not prove cancellation
of an unseen request; first establish what the existing flow actually offers.
Do not build speculative command/renewal tables. The separate proposed renewal
migration remains paused. R05 stays open; the [80-row inventory](REMAINING_WORK_2026-09-11.md)
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
still requires CI after push. See [the current native evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-submission-error-follow-up).

**Verification limits:** browser evidence uses actual components, SDK, HTTP and
SQL with synthetic authentication in an isolated renderer. Full AppShell/login,
background lifetimes and installed lease-verification consumers are not claimed.
Accepted native Leave Home source is unchanged and its evidence is reused. Actual
provider delivery, combined populated adoption and hosted rollout remain open.
The schema-only lease DB, REST18089 and private Next18110 remain exclusively leased
to `/private/tmp/pantopus-lease-transaction-r1`; inspect its private runtime lease
before reuse. Synthetic fixtures are cleaned after checks. No provider/production
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
