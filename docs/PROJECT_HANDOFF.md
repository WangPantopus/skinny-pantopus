# Pantopus project handoff

Updated September 13, 2026 after current-claims integration and design restoration. This is the
current entry point. The [80-row inventory](REMAINING_WORK_2026-09-11.md) remains
the ordered backlog; dated reports preserve source-specific evidence.

## Current direction, state and next action

**Preserve working implementations and existing screen designs.** Follow the
new rules in [AGENTS.md](../AGENTS.md) and the
[reconciliation and inventory map](VERIFICATION_FIRST_2026-09-13.md).
An open acceptance row does not authorize a rebuild. Locate existing code and
establish a defect or concrete unmet requirement before application changes.

**Next: verify and reuse the existing reactivation path before extending R03.**
`occupancyAttachService._reactivateOccupancy` already exists and is called by
landlord invite acceptance and tenant approval in `landlordTenant.js` through
`landlordAuthorityService`. Its service/pipeline tests and shared SDK endpoints
also exist. Trace current authority, persisted dates and recovery through those
entrypoints before proposing an ordinary-household re-entry extension. Existing
protected Home submission/review routes refuse ended membership; this does not
mean the entire app lacks reactivation code. Keep the proposed renewal tables paused.

PR #36 is integrated here from `a68e8f0e52d8f2739e5a49279ae3495956d073ee`.
Its exact [CI 34785056441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34785056441)
passes all 15 executed checks, with one unchanged Seeder skip. The six-view
presentation repair restores the distinct web layouts and native illustrated
empty states; the accepted reader, API, SQL and recovery controllers are unchanged.
See [the accepted report](home-current-claims-wip-2026-09-13.md) for rendered web
checks and source-specific native limits. Inspect CI for the integration commit
independently; it adds no application changes beyond the accepted candidate.

Primary is `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
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
