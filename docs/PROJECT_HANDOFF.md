# Pantopus project handoff

Updated September 13, 2026 after native reviewer-history integration. This is the
current entry point. The [80-row inventory](REMAINING_WORK_2026-09-11.md) supplies
the ordered backlog; dated reports preserve detailed evidence and limitations.
The [earlier frozen checkpoint](SESSION_HANDOFF_2026-09-13.md) is historical.

## Current state and next action

**Next: finish current-claims privacy acceptance in PR #36, then continue the
ordered backlog.** Work in `/private/tmp/pantopus-home-current-residency-claims`,
branch `codex/home-current-residency-claims`. Both browser and native consumers
are implemented there, but actual populated HTTP/SDK/browser/native acceptance
is unfinished. Primary still has the known raw-claims exposure until this repair
is accepted and integrated. Do not substitute unit checks for the real workflows.

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

## Current-claims candidate and verification limits

The separately pushed browser source at `52fa96c65` has both consumers. Current
uncommitted native work is undergoing product checks and installed acceptance.
The isolated browser package binding resolves this candidate's API/types/utils;
all 1,324 browser checks and zero-error web type checking pass. Standalone API
package checking reports the same 39 existing diagnostics as primary, with no
candidate-only diagnostics.

The iOS candidate passes signed r1/r2 builds, 31 focused checks and full regression
(4,471 passed / 168 skipped / zero failed). Its observed protected originals remain
empty and its test simulator is stopped with userdata retained. Android formatting
and Detekt pass; product and focused checks are running. These are source/product
gates, not populated native queue acceptance.

The additive claims migration passes a populated upgrade in one outer rollback:
all 366 retained tables, functions, permissions and prepared originals are preserved,
with zero SQL lint issues. A separate schema/reference candidate and REST runtime
are prepared; this is not permanent adoption of the retained database. The private
operator index identifies the active current-claims HTTP fixture and its lease.
Startup metadata/port guard failures are retained separately from application results.

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
