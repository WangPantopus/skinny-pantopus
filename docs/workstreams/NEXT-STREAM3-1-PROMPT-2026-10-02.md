# Successor prompt — Stream 3-1: Home access, residency and ownership

Handoff: October 5, 2026. The human explicitly stopped this session. This prompt supersedes the older operational instructions in this file's Git history.

## Latest human direction — highest priority

Use **GPT-6 Astra / Extra High**, one main agent, no subagents. The human will start the successor chat; do not create one yourself.

The outgoing session spent too much effort reviewing verification machinery and delivered no new user-facing features in its final review phase. The human explicitly requires the next session to **BUILD and finish the new features, functions and flows in the repository's `NEXT_STEPS.md`**. Make concrete product progress. Do not resume the sequence of harness reviews, hash checks, evidence repackaging or repeated failed journeys as the default task.

Also preserve the human's earlier requirement: inspect and reuse existing branch/PR implementations, integrate ready existing work into master through the coordinator first, and avoid duplicate work. An open acceptance row does not mean its implementation is missing. If code already exists, finish its missing integration or flow instead of rebuilding it; if no implementation work remains on that item, advance to the next active NEXT STEPS feature within this stream.

The current STOP means this outgoing agent does no more product, runtime, source, audit, test or merge work. It is saving/pushing this handoff only. The successor resumes when the human starts it with this prompt.

## Accountability for the outgoing session

Application-code changes completed in this successor session: **zero**. New user-facing features completed: **zero**. Feature acceptance rows closed: **zero**. WP6/PR1516 and the other existing application repairs were inherited work, not new output from this review session.

The session actually audited existing PR/branch reuse, reviewed WP1 query reuse and shared task/notification/timezone source contracts, inspected repeated iOS/Android failed-run and resource-return records, checked saved event/hash/process/database joins, wrote private intake receipts, sent coordination messages, and committed/pushed status and successor documentation. These are verification/support outputs, not shipped features.

Root assigned finite evidence/source reviews and retained exclusive runtime ownership. Harness failures, resource-return errors and sequential runtime windows created repeated review work. Those coordination choices explain the assignments but do not justify this stream's lack of product progress. This agent kept accepting and expanding that loop, used overly detailed checks/output/documentation, and failed to redirect or escalate the absence of feature delivery early enough. Missing Google/Smarty keys block real address-provider checks only; they did not prevent independent implementation. No policy required this volume of repeated process work.

The human reports22,000 credits consumed. There is no per-stream credit ledger in the available records, so this handoff cannot assign an exact share or invent a cost/time breakdown. The successor should spend effort on the first concrete unfinished NEXT_STEPS function/flow, reuse the existing1516 code, and restrict verification to what is necessary to deliver that changed behavior.

## Your role and scope

You are **Stream 3-1**, not coordinator Root. Own Home access, joining/admission, residency and ownership: H01–H08/R01–R05, assigned U02–U04, and the WP6 Household/F3b pilot. Review the existing WP4 task path only as necessary to finish WP6. Root coordinates shared source, exclusive resources, integration and the sole merge queue; 3-2 owns Home security/privacy; 4-1 owns Place/Today/HomeTask models and native callers; 4-2 owns lifecycle, deep links and notifications. Do not compete with those writers.

Read once, selectively:

1. Applicable `AGENTS.md`, `docs/PROJECT_HANDOFF.md`, and the repo-root **`NEXT_STEPS.md`** on the intended current development base.
2. Live coordination: `/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md` on `codex/workstream-coordination`. Master's copy is an older snapshot.
3. The current top of `docs/workstreams/03-1-home-access-ownership.md` and the ownership sections of `03-stream3-split-2026-10-02.md`. Detailed history stays there; do not reread the entire archive.
4. Existing parent `03-home-access-residency.md` only for the specific acceptance/screen row being implemented. Reuse its catalogs instead of creating another tracker.

Translate the active NEXT STEPS items in your scope into the first concrete missing function or unfinished user flow, reuse its existing screen/caller/API/service/database contract, and implement it. Preserve current iOS/Android/web appearance and navigation patterns. Make the smallest changes needed for the intended new behavior. Run affected checks and required CI, then verify the changed flow through its real caller/API/persistence when available. Do not build a unit-test coverage backlog or add speculative architecture, tables, services, screens or duplicate fixtures.

## Exact resume actions

1. Read the current NEXT_STEPS feature requirements and reconcile them against PR1516 and the integrated pilot source below. Select the first actual unfinished implementation in this stream and state the user-visible outcome you will deliver. Avoid a broad audit or re-review of already accepted source.
2. Coordinate only the necessary shared-file or runtime dependency with the current Root. Root is returning its seventeenth iOS run because of the human's stop; confirm its final disposition before any later runtime operation. No resource reservation transfers with this prompt.
3. Finish the assigned feature/flow. WP6 source already implements household provenance, invitation copy, T3 restrictions and safe task-completion notices. Do not recreate those. Complete any concrete gaps revealed by current NEXT STEPS requirements; advance another active feature while a runtime boundary is unavailable.
4. Reuse already prepared real-journey components when checking changed behavior. Root sequences the common saved-place prerequisites, then WP4/WP6. Do not create another controller or spend the session revising evidence wrappers. A remaining test limitation is not a reason to stop independent feature implementation.
5. Present completed, reviewable product changes, obtain the required CI/behavior evidence, and hand ready existing PRs to Root's queue. Never call green CI alone native acceptance, and never create a replacement PR for identical code already in an open branch.

## Working directories and Git state

Fresh read-only checks before the stop found:

| Purpose | Path / ref | State |
|---|---|---|
| Own WP6 code | `/Users/yingpengwang/.codex/worktrees/s3-1-pilot-household/skinny-pantopus`, `claude/stream3-home-31-pilot-household` | Clean, pushed, head `7fd2e5b4d542b8c1afec9ca1d2cbff7a2244e6b1` |
| Root's serving pilot union | `/Users/yingpengwang/.codex/worktrees/s1-pilot-contracts/skinny-pantopus`, `codex/s1-pilot-products-20261004-r2` | Clean, pushed, head `9e6bcbb22bd1ff0126a789f71889ddbd092b7f09`; Root-owned, read-only to you |
| Coordination | `/Users/yingpengwang/pantopus-coordination`, `codex/workstream-coordination` | Shared, peers also commit; only own status and this prompt were changed for this handoff |
| Outgoing chat cwd | `/Users/yingpengwang/.codex/worktrees/33ca/skinny-pantopus` | Clean detached HEAD; no application work was added there |
| Remote master | `WangPantopus/skinny-pantopus` | `d8c9fb1c803e714a48b8745faa36951b8be10193`, batch359/PR1535 |

Refresh Git/PR metadata once at successor start. Do not pull, switch or edit the serving union during Root's operation. Preserve unrelated work; no stash/reset/force push. Continue existing branches where suitable. New branches default to `codex/`.

Own recent coordination commits, all pushed before this final handoff update: `0b0f5ec84` WP1 query reuse, `ca19a53ab08427e08ca0c774a02051c0c2350dc2` sixteenth iOS intake, and `f88bb43f7` fifth Android intake. Find this prompt's final publication commit with `git log -1 --format=%H -- docs/workstreams/NEXT-STREAM3-1-PROMPT-2026-10-02.md`. Do not assume shared HEAD still equals your own last commit.

Commit explicit owned files, preserve automatic Git identity and the established footer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, push, and tell Root the exact commit. Root owns shared README/PROJECT_HANDOFF/queue changes. No new PR is needed for this coordination-only handoff.

## Existing PRs — reuse first

The latest remote inventory had 28 open PRs. The earlier branch audit covered 126 related refs/73 heads; 69 heads were already ancestors of master. Reuse that audit unless relevant heads or behavior changed. Old local Lockdown66e02's three changed files equal merged881; do not resurrect it.

| PR | Existing work | Last disposition and remaining gate |
|---|---|---|
| [1516](https://github.com/WangPantopus/skinny-pantopus/pull/1516) | Household access versus address verification; head7fd2e5b4 | Draft, mergeable, 13 SUCCESS/3 configured skips. Already integrated in1533. WP6 actual native/API/persistence and populated-backfill limits remain. |
| [1500](https://github.com/WangPantopus/skinny-pantopus/pull/1500) | Native ownership Waiting Room dates; headc3a90c5c94631ccf154ca66414d9fc6fef22f073 | Draft, mergeable, 11 SUCCESS/5 configured skips. Targeted iOS/Android AFTERs still pending; no address-provider dependency. |
| [1533](https://github.com/WangPantopus/skinny-pantopus/pull/1533) | Integrated pilot source; head9e6bcbb2 | Draft, mergeable, 16 SUCCESS. Real native gates remain. Reuse this union; do not rebuild its source stack. |
| [1496](https://github.com/WangPantopus/skinny-pantopus/pull/1496) | Sibling custom guest-pass date repair; head2892b78a | Draft, mergeable, native AFTERs pending; 3-2 owns it. |
| [1518](https://github.com/WangPantopus/skinny-pantopus/pull/1518) | Sibling Emergency privacy; head1f598539 | Draft, mergeable, already in1533; native gate pending; 3-2 owns it. |

PR1509/1512 are already merged via batch359/1535; 1498/1499 were merged via358. No repeat implementation or intake. Latest sole next queue is360, owned by Root. No own feature PR was merged at this handoff because its actual gates were not met; the later human STOP also precludes another merge campaign now. Do not impose an unrelated full-pilot or missing-provider hold on a genuinely ready, independently scoped PR.

## WP6 implementation already present

- Existing HomeOccupancy provenance uses forward `20261004104000_home_verification_source.sql`, SHA `743a82c017d1f67b3725b1219cd524d9fc09fb1628d5c9151cb777b35cd0e600`. Eleven existing admission/review/legacy writers are extended. Address proof wins; accepted legacy compatibility remains; fresh/default legacy cannot bypass household stamping.
- Sender helpers look up exact Home/user occupancy before verified-owner fallback, fixing the max_rows1000 lead. Household-only status cannot satisfy address-verification gates; malformed/foreign/inactive/error reads fail closed.
- Existing task completion paths carry generic lock-screen-safe text and exact task_id, preserve can_complete and done-transition/repeat behavior, and include Home task PUT/mailbox PATCH callers.
- Invitation copy distinguishes household access from address proof. Household-only remains T3/BandD locked; compatible address/legacy status remains T4; denied private_setup stays T1/publicBandA. Existing visuals are preserved.

Source/CI receipts in the private3-1 directory: `wp6-current-source-checks-r4.json` (102e2278), `wp6-source-checks-r1.json` (7940cf1d), `wp6-mail-owner-pagination-source-checks-r1.json`, and `wp6-place-tier-source-checks-r1.json`. 3-2 source reviewae369f56 is accepted. Do not rerun these unchanged reviews. The historical broad Place suite did not cleanly finish; do not relabel it as a success or turn it into a testing backlog.

Root/3-2 recorded all six authorized local forwards181/182/101/102/103/104 as applied. Occupancy was empty at104 application, so populated backfill is unverified. Remaining concrete WP6 flow: ordinary invitation→Close without acceptance→accept membership/provenance→Home/roster/T3 restrictions→address-only denial→allowed task completion/generic notice/task_id/repeat idempotence through both native callers. Existing WP4 observer and notification callers should be reused. Current due-day wire input must remain YYYY-MM-DD; any independently expected timestamp needs an actual API transaction timezone proof, not an assumed zone.

The synthetic Home SQL is prepared, not evidence of genuine address proof: private3-1 `wp6-synthetic-home-inputs-r1/synthetic-home-three-rows-r3.sql`, SHA99d188fd4fafc225f4f7d1ea68e9a9245f262192f0cc8cc03beaad46c0842814. It creates three fresh Home/owner/legacy-owner occupancy rows only, through Root after both saved-only case returns. Both first-use rows precede Pickup/Radon writes. No second fixture or synthetic-auth/destructive wrapper.

## Completed review work — reuse, do not repeat

These records explain the stopping point; they are not new feature completion:

- **Fifth Android:** private3-1 `root-fifth-android-failed-warm-external-return-intake-r1.json`, SHA `2b3921059d6a7a4b09df9f2ff763134ec09c855dd8a10370b440a092641c00b8`,17561 B/0600. Review complete and delivered to Root; separate Root acceptance was not received before the stop. All19877 events/12faults/3258 short returns and four original long returns join. Native profile200 is narrow evidence, not full restoration/warm/case acceptance. Root's bad providerc936 had null actor despite the current native profile; valid ACKf272 covers11 earlier faults, and return failure is fault12. Separate recovery2200 completed16:55:11.322139Z with seven waited children and D/H/runtime-last0. Original caller1/fullreturnfalse remains. All353 compared:346 business unchanged; FunnelEvent2→3, prior caches3/1 and all prior Auth PK histories retained. Fresh353 PID49765 is persisted; same finalf617 reused without another scan.
- **Sixteenth iOS:** `root-sixteenth-ios-failed-navigation-original-full-return-intake-r1.json`, SHA `8b6207cb41b32c4b03c48832d05918e251adc975f8001308b2a800ddd18df5f9`,13998 B/0600; personally accepted by Root. Restored native profile, first navigation failure, original resource return16:37:37.001936Z. Caller1/five faults remain. Only344 business tables unchanged; three normal warm tables changed. First full353 query's positivePID receipt is missing; do not fabricate it. No case/native acceptance.
- **WP1 query reuse:** `stream1-wp1-curator-seeder-20261004/wp1-current-baseline-proof-query-reuse-SOURCE-DATA-r1.json`, SHA13bd203ce66b51d273fb13d367b19329e17ddad0ca0560a89eb2f4ef5dcd4e83/24799 B, accepted source review. Existing17dec full353 SQL can supply four database proof facets from one actual matching current result. Nine actual bindings remained null. Do not add four queries or replay retained Post producers. Public identity/rendering/auth/permissions still need their own real evidence.

Other accepted Android/iOS product, installation, map, actor, source and failed-return records remain linked in the child status. Reuse accepted Android APKb3b76188/92937012 B and iOS3149 product through conserved9e6 inputs. Do not rebuild or rehash unchanged products as a handoff ritual.

## Resource and coordination boundary at stop

This Stream3-1 owns **zero runtime/device/heavy resources, live controllers, active leases or unfinished operators**. It performed no runtime, SQL, application change or new test/build in the final review phase. Its finite fifth Android review is complete.

Root had seventeenth iOS operation `0840559c-6b71-4c76-b5ee-b481776aa434`, setup3743f4ec, unchanged commonR20, controller57368, started16:59:45Z. Only redundant warm Place navigation was removed, leaving existing Hub→Explore. On the direct human STOP, Root explicitly said it was returning this active run and would make no further attempt. **Return completion is not yet confirmed by this handoff.** Read Root's final handoff/current state before any later execution; do not probe or stop historical PIDs yourself.

AndroidR13/source94906651 already has Root605fc076 and 3-2/Root-intake553651f9 source PASS. It changes only registered direct ps/lsof wait polling with bounded1ms exponential backoff/cap50ms. Actual performance/native success is unverified. Do not reopen its source review or start a sixth Android attempt merely because this prompt mentions it.

Current chats, subject to human-created successors:

- Root: `01a10a5f-1817-7c93-8faa-f72c50c0b221`.
- Outgoing3-1: `01a10a5f-4ab8-79b1-a779-e7b2a162fc95`.
- 3-2: `01a10a5f-8244-7722-8727-e53f8d0301d6`.
- 4-1: `01a10a5f-a40f-7141-bd95-25765c0e7b6b`.
- 4-2: `01a10a5f-d2c2-7773-bdd6-6c79a59187dc`.
- WP1: `01a10a5f-fdb8-7b43-a5c9-c4e579499336`.
- WP3: `01a10a60-428a-7ce2-bc4c-d44d1522f539`.
- WP8: `01a10a60-6c56-7661-b733-3a099ba07986`.

Human-authorized relevant owner coordination persists. Do not send unrelated messages or open new chats/automations. On successor start, use current identities; do not impersonate an old issuer or reuse old runtime ACKs.

## Progress, remaining scope and human dependencies

The inherited acceptance denominator is **8/13 fully closed (about62%), five partial (about38%)**: H07 joining/onboarding/lifecycle; H08 applicant/private setup/verification returns; R03 re-entry/occupancy/reviewer recovery; R04 ownership/transfer/device-auth recovery; R05 attachment account/lifetime/provider/rollout boundaries. H01–H06/R01/R02 and U01 remain accepted. Parent8/20 is a broader two-child count, not this stream's completion percentage.

This is **not** an overall completion percentage for the newer NEXT STEPS pilot. WP6 code exists, but its real two-platform flow and populated-backfill acceptance are unfinished. The final review session added no feature closures. Do not report the old16–32-hour estimate as a fresh forecast: repeated prerequisite/harness delays have made it unreliable. Build the active NEXT STEPS deliverables and report their concrete completion instead.

Most coding, integration and local regression/flow work can be done by agents with Root coordinating existing resources. The human confirmed Google Address Validation/Smarty credentials are missing or expired and will supply them later. Do not ask again or make that a blanket blocker. Genuine address-provider validation remains unverified. Real external delivery/hosted deployment, physical-device/OS authentication and signing/distribution proofs may need human access/configuration. There is no measured percentage for those external dependencies; do not invent one.

## Preservation and safety boundaries

- Preserve working screen appearance/navigation and all accepted evidence. Historical source-only/build-only/failure evidence is not native success.
- Never read/hash/compare/apply/unapply/rewrite the applied `20260926100000` migration BODY, or run/import the full migration checker. Filename/blob metadata only; no applied-history rewrite or parallel table for existing data.
- Keep credentials, raw device tokens, database rows/archives/Auth history, operator logs and raw sensitive images out of Git/chat. No database reset/dump or Auth-history cleanup. Preserve all six Auth histories and normal warm changes.
- No `/api/b/:username`, held LegalOwnerVM, real money, parent-account deletion or unapproved design change. Archived challenge/dispute/renewal/release proposals do not become active merely because they appear in old records; follow the actual current NEXT_STEPS scope and human direction.
- Private evidence root: `/Users/yingpengwang/.config/pantopus/stream3-1-resume-mac-studio-20261004`; Root evidence root: `/Users/yingpengwang/.config/pantopus/stream1-studio-resume-20261004`. Older transferred evidence maps through `/Users/yingpengwang/.config/pantopus/stream3-1-mac-studio-handoff-20261004/reference/bundle-manifest.json`; do not rerun old-host operators.
- If inspecting a genuinely necessary private record, inspect its type/keys first and output only safe aggregates. Never dump whole fingerprint lists or use rg to print an entire single-line SQL query. Distinguish canonical JSON hashes from whole-file hashes; concurrent child returns join by PID/status, not array position. These are narrow reading precautions, not another verification campaign.

Resume with concrete NEXT_STEPS implementation and reused branch work. Keep the user informed of shipped behavior, remaining product gaps and real blockers, rather than amounts of evidence processed.
