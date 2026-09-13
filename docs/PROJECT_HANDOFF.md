# Pantopus project handoff

Updated September 13, 2026 after current-claims local acceptance. This is the
current entry point. The [80-row inventory](REMAINING_WORK_2026-09-11.md) supplies
the ordered backlog; dated reports preserve detailed evidence and limitations.
The [earlier frozen checkpoint](SESSION_HANDOFF_2026-09-13.md) is historical.

## Current state and next action

**Next: verify final exact-head CI and integrate PR #36, then continue the remaining
R03 lifecycle and ordered backlog.** Current-claims local acceptance is complete in
`/private/tmp/pantopus-home-current-residency-claims`, branch
`codex/home-current-residency-claims`. Source `4d4183a79` includes primary
`4e966835f`; final acceptance documentation is being recorded. Both browser and
native consumers pass populated, denied, stale-read and confirmed-empty workflows.
All fixtures are exactly cleaned and owned servers/devices stopped. Primary still
requires this repair integrated to remove its known raw-claims exposure.

Primary is `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32).
[PR #35](https://github.com/WangPantopus/skinny-pantopus/pull/35) is merged into that
branch at `f1a92f45ad8c79ef88e89a2882a584898d3f8017`. Its exact source
`8cfcbf2b28d95587a70fe784c81b913de688dd52` passes all executed checks in
[CI 34775715928](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34775715928):
ten successful checks and five unchanged-scope skips. This is source-specific
history evidence; verify CI independently for later primary and current-claims heads.

PRs #32, [#34](https://github.com/WangPantopus/skinny-pantopus/pull/34) and
[#36](https://github.com/WangPantopus/skinny-pantopus/pull/36) remain unfinished
drafts. No production or provider activation has occurred. **8 of 80 acceptance
areas are locally closed; 72 remain partial/open.** These counts are not an
implementation percentage. Native history does not close the broader R03 lifecycle.

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

## Current-claims acceptance and verification limits

See the [acceptance report](home-current-claims-wip-2026-09-13.md). Nine actual
HTTP/source-loaded SDK cases, both populated browser consumers and both installed
native readers pass. Original serialized old 200 responses complete after newer 403s
without restoring retired rows on each client. Six real protected HTTP rejections
then drain the queue; both browser consumers and both native apps confirm empty
while preserving membership, ownership, submission and removal rows. Browser
lifecycle signals are explicit events; native background/foreground is actual.

The iOS signed product passes 31 focused and 4,471 full checks, with 168 skips. All 679 installed
app files remain unchanged and three observed original stores remain empty.
Android passes 44 focused and 4,661 full checks, with 80 skips for each Debug/Release variant,
Debug/Release build and lint, ktlint/Detekt, and an offline optimized twelve-record codec
probe. Its installed Debug APK is unchanged, all 16 preference files survive update,
and seven observed originals remain empty. Browser isolation, 1,324 full checks,
14 later focused checks and zero-error web type checking pass; standalone API
checking retains 39 baseline diagnostics with no candidate-only errors.

The populated upgrade preserves all 366 retained tables in an outer rollback.
Final fixture cleanup preserves all 374 candidate tables and all 366 retained tables,
roles, ledger, functions and catalog. The candidate database is retained, with its
REST/API/Next servers and both owned devices stopped. This is not retained-database
permanent adoption or production/provider activation. Migration reconciliation is
50 Home / 21 paid / 59 combined, with 12 identical shared versions and zero collisions; combined
paid/Home populated replay/adoption remains open. Private evidence archives and
released leases are indexed in the operator handoff.

Exact application source `4d4183a79` passes [CI 34779388555](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34779388555):
15 successful checks and one unchanged Seeder skip. Verify the final documentation
head independently before integration. The report preserves driver/preparation
failures and each product/screenshot limitation rather than treating them as passes.

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
