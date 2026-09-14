# Pantopus project handoff

Updated September14,2026. The user resumed verification and development with full
permission: inspect existing implementations, repair demonstrated bugs/security
issues, preserve working behavior and screen designs, then cover the remaining
features. The [80-row inventory](REMAINING_WORK_2026-09-11.md) is the ordered backlog;
its8 locally closed/72 partial or open rows are not an effort/completion percentage.
Follow [AGENTS.md](../AGENTS.md). R05 and the app remain incomplete.

## Current state and next action

**Active worktree:** `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/landlord-unit-tools`, starting from the accepted local lease checkpoint
`c51740fce`. Draft [PR39](https://github.com/WangPantopus/skinny-pantopus/pull/39) connects the existing controls through shared Home creation;
73 backend/90 rendered tests and actual browser/HTTP/SQL recovery checks pass.
See [the unit evidence](VERIFICATION_FIRST_2026-09-13.md#existing-unit-import-and-range-generation). The preserved
`codex/lease-approval-dates` branch backs draft [PR38](https://github.com/WangPantopus/skinny-pantopus/pull/38)
against `codex/home-permission-boundaries`. Owner checkout edits and all unrelated
worktrees are preserved. The separate renewal/two-table draft remains paused.

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

**Git/CI:** lease checkpoint c51740fce is pushed to PR38. Its fresh
[CI34840961607](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34840961607)
has passed its database and web/backend jobs; native jobs were still running at
last inspection. Prior [CI34836085491](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34836085491)
failed the generated SQL wrapper synchronization gate; other nonaggregate jobs
passed except the unchanged Seeder skip. The existing wrapper was regenerated
and passes actual pgTAP. Do not relabel that failed run green. After any contract
edit run the existing wrapper sync and --check; all54 currently synchronize.
PR39 initial CI34843214305 failed the immutable-migration gate. The original
migration is now restored and the unchanged function update is in a forward file.
Its corrected CI remains pending; recheck its PR/CI before
integration. Last complete green source40866ab85 passed15 applicable checks/one
unchanged Seeder skip in [CI34831886732](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34831886732).

**Next:** finish CI/review of existing unit tools, then trace the existing private
lease attachment/storage path before extending it. The unit repair reuses Home,
canonical validation, protected HomeCreateCommand recovery and existing encrypted
browser storage. It adds one forward migration updating the existing function, with no table or
replacement screen. The original migration stays immutable. Confirmed
parent authority never becomes verified unit authority. Import and Generate now
report partial progress and retry the same original after Close/reload. Afterwards
finish R05 native invitation links, installed Android/provider criteria and the
remaining inventory. No speculative replacement/renewal schema.

**Native evidence/limits:** unchanged request/display source passes50 iOS/49
Android focused/rendering tests and static checks. Installed iOS covers Back/
Discard, saved-request/account/foreground recovery, correct calendar/status,
truthful unavailable Attach feedback and invalid-date rejection/corrected save.
Live forms no longer insert sample files/data or promise email delivery. Real
private lease upload remains unfinished. Installed Android app-flow control was
unreliable after APK installation; acceptance remains open. Reuse the retained
products; one heavy native build at a time. Provider identity/delivery, combined
populated adoption and hosted rollout remain open. Notification recovery is
best effort and requires retry after a lost process; no eventual-push claim.

**Owned runtime:** private root `/private/tmp/pantopus-lease-transaction-r1`;
Next18110 remains active. Unit API18117 and notice API18116 are stopped.
The unit fixture has zero remaining owned Home, User, address or command rows;
source/evidence and exact cleanup are recorded in the private checkpoint. Earlier unit/invitation/sharing/building/
creation/retention/native API fixtures are stopped with exact row cleanup. The
owned iOS simulator, Android AVD and Android Studio are stopped; owner iPhone17,
Bill Acceptance and Home Recurrence Acceptance devices remain untouched. The
schema-only `home_landlord_verify_20260913_r1` database/REST18089 remain reserved;
direct PostgreSQL64522 responds. Its existing Home-create function includes the
unit candidate body, with unchanged signature and passing generated SQL contract. Docker control stalls: use the private direct-SQL
helper that verifies the exact database, not repeated Docker calls/global restart.
Inspect the private current-checkpoint/runtime leases before reuse; clean exact
owned fixtures afterwards. Credentials, tokens, archives and operator logs stay
outside Git/chat. Evidence is mirrored to the owner's private
`.pantopus-recovery/audits/20260913-lease-transaction` directory.

**Other PRs:** draft [PR32](https://github.com/WangPantopus/skinny-pantopus/pull/32)
was7f2a5e6d6 with16 checks passing and includes35/36/37. Draft
[PR34](https://github.com/WangPantopus/skinny-pantopus/pull/34) was conflicting against
master at e9ef2decbb; paid/provider acceptance remains incomplete. Master was
6a1013784d. These are recorded context, not current integration authorization or
fresh remote inspection. The user authorized continued repairs; preserve unrelated
work and verify current state before integration.

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
