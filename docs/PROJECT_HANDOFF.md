# Pantopus project handoff

Updated September 13, 2026 after existing landlord-flow verification. This is the
current entry point. The [80-row inventory](REMAINING_WORK_2026-09-11.md) remains
the ordered backlog; dated reports preserve source-specific evidence.

## Current direction, state and next action

**Preserve working implementations and existing screen designs.** Follow the
new rules in [AGENTS.md](../AGENTS.md) and the
[reconciliation and inventory map](VERIFICATION_FIRST_2026-09-13.md).
An open acceptance row does not authorize a rebuild. Locate existing code and
establish a defect or concrete unmet requirement before application changes.

**Active draft: `codex/lease-approval-dates`, PR #38.** The date repair now uses
an atomic database decision over the existing lease, invitation, resident,
occupancy and audit tables. It rechecks current authority and the authenticated
actor under locks, preserves independent current membership, applies reviewed
lease bounds on admission/reentry, and binds completed retries to the existing
membership generation. Approval and denial cannot both commit. There are no
new tables or screen/layout changes. See [the transaction evidence](VERIFICATION_FIRST_2026-09-13.md#existing-lease-decision-transaction--september-13-draft).

The end/move-out follow-up now makes lease termination and bound access
withdrawal atomic too. It preserves independent/replaced membership, reports
failures in the existing Leases UI, and restores the history its Ended filter
already expects. A reproduced co-resident bug is repaired using the accepted
self-removal helper: only the departing person loses access, the primary lease
stays active, and an old request cannot remove restored membership. No table,
screen, markup, layout or CSS class was added or changed.

Current local checks: 125 service/route tests, ten rendered web/SDK tests, real
SQL lifecycle and final-write rollback, five end HTTP/SQL comparisons, a separate
co-resident HTTP/SQL baseline/candidate, seven multi-session SQL races and three
actual browser end/retry cases pass. Six earlier actual browser approval/denial
cases retain their source-specific evidence. Fresh standalone web TypeScript
and application-function lint pass; scoped ESLint has one existing warning.
See [the end evidence and limits](VERIFICATION_FIRST_2026-09-13.md#existing-lease-end-and-move-out-follow-up).

Transaction source `81cf3bef8` passes all eight executed checks in
[CI34793608043](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34793608043),
with three unchanged scopes skipped. Browser source `695a1cfb3` failed CI on two
test-only unsupported role-query options, now removed. An intermediate chained
local command masked that TypeScript failure; the report corrects it. The end
follow-up requires CI against its pushed head. Home integration `7f2a5e6d6`
passes all 16 checks in
[CI34790255357](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34790255357).

End source `1f526de0d` now passes all eight executed checks in
[CI34796831599](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34796831599),
with three unchanged scopes skipped. The legacy protected removal → end retry
and later admission composition also passes four actual HTTP/SQL groups. Both
native Leave Home screens already use the accepted removal controller; relevant
native source is unchanged and its evidence is reused.

**Current follow-up: connect the existing tenant status and cancellation flow.**
Actual browser/HTTP verification found missing status/cancel routes behind the
existing controls. The route module now projects only the actor's own lease and
basic landlord availability; cancellation extends the same unmerged transaction
and existing records. Six actual tenant browser/HTTP/SQL groups, two additional
SQL cancellation/approval races, 128 backend tests, 13 rendered web tests, fresh
TypeScript and application SQL lint pass. Existing error/retry views handle failed
reads, denial reasons match saved data, and future approvals no longer promise
full Home access. No table, additional migration or replacement screen was added.
See [the source-specific evidence](VERIFICATION_FIRST_2026-09-13.md#existing-tenant-status-and-cancellation-follow-up).
This follow-up requires CI against its pushed head; #38 remains draft.

**Next: verify existing request submission and uncertain-reply recovery, then
remaining native lease-verification consumers and stale-response/account
boundaries.** The actual components/SDK/HTTP/SQL run in an isolated renderer;
full AppShell/login and installed-native lease verification are not claimed.
Provider delivery, combined populated adoption and hosted rollout remain open.
R05 remains open and proposed renewal tables stay paused. The schema-only lease
database and REST are exclusively leased to `/private/tmp/pantopus-lease-transaction-r1`;
fixtures are cleaned after every check. Inspect the private runtime lease before
reuse and preserve other runtimes.

The integrated [PR #37](https://github.com/WangPantopus/skinny-pantopus/pull/37) repair checks the invitation
issuer's current verified authority before writes. Baseline SQL granted access
after revocation; candidate SQL denies without consuming the invitation, while
a valid invitation still works. All 279 focused service/route tests pass. See
[the verification and limits](VERIFICATION_FIRST_2026-09-13.md#existing-landlord-flow-verification--september-13).
The active worktree is `/private/tmp/pantopus-home-permission-boundaries`;
the integrated Home branch is `codex/home-permission-boundaries`. The previous Home integration `e6e3c65f8`
passes all 16 checks in [CI 34788091570](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34788091570).
The landlord candidate `968e145a7369e69f48638c7d16b06bcaa88aaff7` passes all six
executed checks in [CI 34790034952](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34790034952),
with five unchanged scopes skipped. Check the new merge's integration CI
separately. No screen or migration changed. A rendered React component probe also
confirms the existing lease-date modal drops edited dates before the SDK call;
include that concrete failure in the same lease repair, preserving its design.
Owned landlord-verification REST is stopped, fixtures are cleaned, and the
schema-only database is retained with its private lease released.

PR #36 is integrated here from `a68e8f0e52d8f2739e5a49279ae3495956d073ee`.
Its exact [CI 34785056441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34785056441)
passes all 15 executed checks, with one unchanged Seeder skip. The six-view
presentation repair restores the distinct web layouts and native illustrated
empty states; the accepted reader, API, SQL and recovery controllers are unchanged.
See [the accepted report](home-current-claims-wip-2026-09-13.md) for rendered web
checks and source-specific native limits. Inspect CI for the integration commit
independently; it adds no application changes beyond the accepted candidate.

The Home integration branch is `codex/home-permission-boundaries`, [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
The earlier primary application checkpoint was
`4e966835fd6c2c9b51e1cd4d34ecaa8fb30372c8`, with
[CI 34777977420](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34777977420)
passing all 16 checks. Documentation checkpoint `a1d278e33` records the verification-first rules.
The integrated #36 source and its passing CI are recorded above. [PR #35](https://github.com/WangPantopus/skinny-pantopus/pull/35)
is already merged into #32 at `f1a92f45ad8c79ef88e89a2882a584898d3f8017`, not master.
Its exact source `8cfcbf2b28d95587a70fe784c81b913de688dd52` passes the executed
checks in [CI 34775715928](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34775715928).

PRs #32 and [#34](https://github.com/WangPantopus/skinny-pantopus/pull/34) remain drafts.
[PR #36](https://github.com/WangPantopus/skinny-pantopus/pull/36) is integrated into
the Home branch, alongside the previously integrated #35.
#34 is conflicting against master at `e9ef2decbb7ec435589bb3b92639041cfc4618a6`;
its selected CI scope passes, but paid/provider journeys remain incomplete.
Master was `6a1013784db69bf339535a2f4b33b328f2bbf40c` at inspection.
No production or provider activation has occurred. **8 of 80 acceptance areas
are locally closed; 72 remain partial/open.** These are not implementation or
remaining-effort percentages.

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
