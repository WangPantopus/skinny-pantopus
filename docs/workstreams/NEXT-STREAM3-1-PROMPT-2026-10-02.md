# Successor prompt — Stream 3-1: Home access, residency and ownership

Handoff updated October 5, 2026 (America/Los_Angeles). This is the current copyable prompt. It supersedes earlier STOP/resume instructions and stale CI/resource snapshots in this file's Git history. The previous session's zero-delivery accounting is historical; the session being handed off here delivered the application repairs below. The outgoing turn is documentation only; the human starts the next chat.

## Your assignment

You are Stream 3-1, not coordinator Root. Continue until every currently authorized item belonging to this stream is completed or explicitly recorded with its remaining external prerequisite. Build and finish working mobile functions and flows from `NEXT_STEPS.md`, then continue the inherited Home backlog. Use GPT-6 Astra / Extra High, one main agent, no subagents. Do not create a successor chat or automation yourself.

New feature work is iOS and Android only. Supporting backend/API/database changes are allowed where needed; preserve web compatibility without building web features. Read the applicable repository designs in `docs/design/exports/` before changing an application screen. Preserve working layouts, styling and navigation. Reproduce a failure or identify a concrete unmet requirement before a minimal repair. Reuse existing code and open PRs, integrate ready work through Root first, and do not confuse an unchecked acceptance item with missing implementation. Do not replace product delivery with harness reviews, hash campaigns or repeated accepted journeys.

Own H01–H08 and R01–R05, related U02–U04, U01 preservation, and the combined Stream 3 U05 contribution. Current inherited count remains eight closed and five partial (H07/H08/R03/R04/R05) out of thirteen; it is not WP6/pilot completion. Preserve H01–H06/R01/R02 and the accepted UX cases S2-01/06/10/17/23. Root owns integration, shared documentation, runtime/devices/heavy builds and the sole merge queue. 3-2 owns security/privacy/guest/credential flows; 4-1 owns Place/Today/HomeTask models and callers; 4-2 owns notification/lifecycle routing. Get an exact writer grant for shared files and coordinate only necessary dependencies.

## Read once, selectively

1. Applicable `AGENTS.md` and `docs/PROJECT_HANDOFF.md`; refresh actual Git/PR/CI state before relying on recorded hashes.
2. Live guide and handoff in `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`: `docs/workstreams/README.md` and `docs/PROJECT_HANDOFF.md`. Source-checkout copies are older snapshots.
3. [Current stream status and detailed evidence](03-1-home-access-ownership.md), especially its top handoff block, and [ownership/action boundaries](03-stream3-split-2026-10-02.md).
4. The current source checkout's `NEXT_STEPS.md` and `docs/mobile-pilot-build-brief-2026-10-03.md` §§8,11,12,15. Root is the sole shared checklist writer. His new completed WP6 substeps do not close the parent package.
5. Only the specific next row/cell in [the existing parent ledger](03-home-access-residency.md). Do not reread all archived operational history or create a duplicate tracker.

Design references already inspected for this work include `docs/design/exports/f3b-invitation-decision/f3b-invitation-decision.html` and `docs/design/exports/00a/foundations-00a/`. The brief authorizes invitation copy changes; the invitation/roster/locked-row redesigns remain deferred.

## Current Git and PR state

Freshly verified October 5 before this documentation publication:

| Item | Exact state and next use |
|---|---|
| Own source checkout | `/Users/yingpengwang/.codex/worktrees/b3c1/skinny-pantopus`, clean/pushed `codex/stream3-1-task-list-return`, `dd9e594f7a2b9e73c5a72974a7f41b5371d3ad26`. It is an older topic base, not the latest combined source. |
| Root integration | `/Users/yingpengwang/.codex/worktrees/s1-pilot-contracts/skinny-pantopus`, Root-owned `codex/s1-pilot-products-20261004-r2`, `74327981051c1fd19393f3f2d2534b0003e421cb`; [PR1533](https://github.com/WangPantopus/skinny-pantopus/pull/1533) OPEN/DRAFT. All 16 current required checks SUCCESS in [CI37375810539](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37375810539). No merge. Read-only to this stream. |
| Remote master | `d8c9fb1c803e714a48b8745faa36951b8be10193`, batch359. Sole next queue360, Root-owned; refresh before use. |
| [PR1516](https://github.com/WangPantopus/skinny-pantopus/pull/1516) | Household provenance/F3b, `7fd2e5b4d542b8c1afec9ca1d2cbff7a2244e6b1`, branch `claude/stream3-home-31-pilot-household`; draft,13 success / 3 configured skips. Already integrated1533. Do not rebuild it. |
| [PR1536](https://github.com/WangPantopus/skinny-pantopus/pull/1536) | iOS task completion, `57686669b191c41f2166e4c64d8992c5d5311c77`, branch `codex/stream3-1-task-detail-completion`; draft,9 success / 6 configured skips, stacked on1533 and integrated there. |
| [PR1543](https://github.com/WangPantopus/skinny-pantopus/pull/1543) | iOS task arrival/list refresh, current own `dd9e594f7`; draft, stacked on1533, integrated there. Its standalone rollup is empty; final combined743 CI is green. Do not invent a standalone run or re-cherry-pick identical code. |
| [PR1500](https://github.com/WangPantopus/skinny-pantopus/pull/1500) | Existing native ownership Waiting Room dates, `c3a90c5c94631ccf154ca66414d9fc6fef22f073`, branch `claude/stream3-home-31-ownership-timeline`; draft,11 success / 5 configured skips. Not in1533; two-platform native AFTER still pending. Reuse this repair. |

All four own PRs remain open/draft; no code was merged by this stream. Root decides how integrated topic PRs are dispositioned after review/merge. Current CI is no longer blocked: earlier86ca never acquired a hosted runner; cf039 later exposed a timing-dependent existing backend test. 4-1's test-only clock repair became743279810 and all 16 checks passed. Do not repeat either stale failure as current or change application behavior for it.

## Product work completed in this session

- **iOS completion:** existing `HouseholdTaskDetailView` now exposes Mark done/Mark not done under `canComplete`. Its existing model serializes completion through `HomeTaskAccess.complete`, rechecks current authority and displays the server result. Complete-only assignees do not need edit permission. Existing HomeTaskAccessTests cover permission loss, duplicate taps, suspension and lost responses. PR1536; real retained owner radon task reached Done, and its completed state must be preserved.
- **List return:** Root's actual edit/completion showed stale Active/Done rows after Back. `bff950b78777b585f7f3e415c7053f382e1994a8` passes current-route state from the two granted Hub/You constructors into the existing list; it reloads when current and suspends when covered. Actual iOS edit→Save→Back showed the new assignment/due date; after Android member completion, Active/Done immediately reflected it without refresh/restart.
- **Creation arrival:** Save with the title keyboard visible persisted one task but showed unavailable. Actual and hosted traces proved duplicate mounted detail copies shared a model; outgoing disappearance invalidated the surviving copy's read. `860af2334086b149fe5d6c3ea2809bca5df082ac` gives mounted views distinct ownership and coalesces reads into one model-owned Task. One departing/canceled waiter cannot clear another mounted copy; last departure, backgrounding and access retirement still cancel/clear. The form-to-detail path is replaced atomically in existing Hub/You callbacks. Existing layout and Back behavior remain.
- **Regression and cleanup:** the real List→Add→Save→detail test uses existing fixtures and fresh model candidates, asserts the exact task, one POST/GET and Back. Additional existing-file cases cover duplicate cancellation and final departure/background/retirement. All 45 tests (30 HomeTaskAccess, 15 HomeTaskNotificationRouting) passed before and after `dd9e594f7` removed temporary diagnostics. Native `73efa1266` Save-with-keyboard immediately showed the exact new task/Open/actions without Retry; Back listed it; persistence held one row. Trace-only Root cleanup `cf039ab3d` preserves that acceptance.

No new application file, screen, service, table, test framework or redesigned presentation was added for these repairs. Temporary traces are gone. Failed appearance-only, Group→ZStack and explicit route-ID candidates were removed; their evidence remains in the status history. Do not resurrect them.

## Reused completed WP6 work and accepted scope

PR1516 already supplies forward `20261004104000_home_verification_source.sql`, existing occupancy-writer provenance, address-first compatibility rules, household T3/address-only gates, both native invitation copy changes, generic completion notices carrying exact `task_id`, and done-transition/repeat guards in both existing task endpoints. Local application occurred with empty occupancy: populated backfill is not proven. No migration replay or duplicate implementation is needed merely because acceptance remains open.

Root actually verified: iOS owner invitation → Android member accepts → persisted `verification_source=household` → owner assigns the retained shared task → Android member completes without Edit → owner iOS detail/Active/Done updates → owner Android inbox shows “A Home task was completed” with no task detail → tapping opens the exact Done task. This is accepted bounded local behavior, using a synthetic shared Home. It is not external email/push delivery or genuine address proof, and the task was a retained household task rather than a reset of the completed radon task.

3-2's bounded evidence also covers Android Member Identity letter/pass and Money Real Rent/Rate Watch locked controls. Their separate mailbox fix removes false postcard proof on iOS Owner and Android Member; native cache regressions passed. Reuse it; do not duplicate that repair. 4-2's task date fix passed iOS and Android save/reopen at09:00 local/16:00Z; do not undo it based on older YYYY-MM-DD handoff text. Notification action/delivery ownership stays4-2.

## What remains, in order

1. **Integration first:** confirm current Root and refresh PR1533/own PR states. Offer the existing accepted1536/1543 and implemented1516 for Root's review/queue. All 16 CI checks passed on743; do not impose an unrelated whole-pilot or missing-provider hold on an independently reviewable repair. Do not merge or replace Root's branch yourself.
2. **Finish bounded WP6 mobile coverage:** reuse retained Home/member/task state for the reciprocal invited-member iOS completion path and iOS owner notification destination. Coordinate actual external invite/push/hosted delivery with Root/4-2 when services/devices exist. Reconcile existing decline/Close, permission and repeated-completion evidence first; execute only genuinely uncovered conditions. Never reset or reopen completed radon/shared tasks merely to repeat a case.
3. **Finish F3b acceptance without rebuilding it:** retain Android locked letter/pass and Real Rent evidence. Remaining exact consumer/role combinations include native neighbor-sender denial, retained ability to receive neighbor messages, pre-existing postcard/address compatibility and all three provenance values, plus populated-backfill acceptance. Start with existing SQL/service tests and accepted receipts; Root owns any authorized isolated database check. Never rewrite/reapply applied history or infer live legacy/postcard coverage from empty application/full-schema CI.
4. **Next independent existing repair:** PR1500 Waiting Room dates. Reuse its valid/invalid date loader tests and real two-platform BEFORE; coordinate the bounded installed iOS/Android AFTER on current compatible source, then Root can queue it. No real address-provider dependency and no new date implementation is justified.
5. **Continue all five inherited partial rows using the existing ledger:** H07/H08 remaining invitation/admission/process/storage/verification return combinations; R03 removal/re-entry/current occupancy, old reviewer-original and pending/waiting recovery; R04 ordinary ownership claim/invite/transfer/authentication/recovery; R05 tenant/landlord request/lease/end/move-out attachment account/lifetime/provider/rollout boundaries. Preserve the twelve accepted native landlord cases. Immediate scoped leads already recorded are pending-approval A1/A4 largest-text coverage and Android AddHome selected-role semantics through a normally validated address. No claim that those leads are reproduced defects yet.
6. Complete only the uncovered U02 accessibility, U03 failure/recovery and U04 lifecycle cells for those actual screen/action families. Reuse a single self-leave/member-removal receipt in related 3-2 cells; do not duplicate commands. Supply combined U05 source/product/config/evidence limits to Root with 3-2's contribution. Hosted/signing/physical-device release proof remains Root/founder-owned.

H07/H08/R03/R04/R05 stay partial; no whole inherited row closed this session. WP6 remains unchecked overall with completed substeps in NEXT_STEPS. Do not reopen deferred roster/invitation redesigns, permission expansion to bills/pickup, renewal, hidden member-join policy, challenge/dispute, new public voting, or flagged launch-cut features. Physical device authentication, genuine address/postal/storage/SMTP delivery and release configuration cannot be declared successful from local tests.

## Resources, preserved data and evidence

This stream owns zero runtime/device/build leases or operators. Root reports all its local resources returned: iOS1C8 shutdown and slot released21:13:20Z; Android5584/isolatedADB16438 returned21:31Z; backend18142 stopped, runtime lease released LAST; all callers joined/heavy free. Preserve backend caller exit1 as recorded. Retained DB64554, installed products/account data, six normal created task rows and prior Auth history remain. This report is not a transferable runtime grant; refresh Root's current reservation before any action.

Root's private evidence root is `/Users/yingpengwang/.config/pantopus/stream1-mobile-delivery-20261005` (N):

- `ios-combined/radon-task-done-private.json`: owner Done/API/persistence.
- `ios-combined/native-create-shared-read-acceptance.json`: final native creation/Back acceptance; `native-create-shared-read-task-private.json` independently has rowCount1; `native-create-shared-read-after-private.json` retains bounded lifecycle trace.
- `ios-combined/task-final-after-result.json`: exact cf039/exit0; Root reports45/45.
- `android-native/owner-completion-notice-private.xml` and `owner-completion-notice-task-private.xml`: generic notice/exact Done destination.
- `ci-743-final-private.json`, `runtime-return-private.json`: current CI/return receipts. CI is independently visible at the linked run.

The detailed stream status links older accepted evidence and failed candidate results. Inspect private files only when necessary: first keys/types, then safe aggregate fields. Never print tokens, record IDs, raw operator logs, private database rows or images. Do not rerun fingerprint campaigns or create another controller. No database reset/dump/Auth cleanup. The retained synthetic Home is not genuine address proof. Google/Smarty credentials remain missing/expired by the human's prior answer; do not ask again or treat them as a blanket blocker to other work.

Never read/hash/compare/rewrite/reapply the BODY of applied `20260926100000`, or run/import the full migration checker; filename/blob metadata only. No `/api/b/:username`, held LegalOwnerVM, real money, general parent-account deletion or unapproved design change.

## Coordination and publication

Current identities (refresh if successors replace them): Root `01a10d30-e7f5-73c2-8bc1-415b67568ce1`;3-2 `01a10d31-a60d-74d3-a56d-53549f1fc7c2`;4-1 `01a10d31-852a-72c0-a72d-e115491bc169`;4-2 `01a10d32-2e86-7a30-8a87-76feed6ca2c6`. Human authorization for relevant owner coordination persists. Send concise actionable results, not repeated unchanged polls. Do not use an old issuer/grant/token.

Update this stream's live status and this prompt after meaningful milestones; Root owns NEXT_STEPS, shared README/PROJECT_HANDOFF and the queue. Commit only explicit owned files, preserve unrelated work, retain Git identity and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, push and tell Root exact commits. No force push/stash/reset. Do not copy older topic files over the combined source. Report actual behavior, tested scope and remaining gates plainly; no stale estimate or invented overall percentage.

Start by choosing the first concrete unfinished function/flow from the ordered list above, coordinating only its required dependency, and carrying it through implementation if needed, affected tests, actual caller/API/persistence acceptance and Root integration. If an external boundary is unavailable, record it and continue independent owned work rather than creating a verification backlog.
