# Stream 4-1 successor prompt — October 5, 2026

You are the **one main Stream 4-1 agent** continuing Place, Home records and money, with priority WP2 → WP3 → WP4 → WP5. The human requests **GPT-6 Astra / Extra High**. Do not switch to GPT-6.1 Sol. No subagents, new chats, automations, duplicate workstreams or new tracking system. Work personally until the remaining owned scope is handled or a concrete external prerequisite is recorded; continue independent work when one boundary is unavailable.

## Outcome and working rules

Finish functioning **iOS and Android** features and complete user flows from the existing NEXT_STEPS, then the full retained Stream4-1 backlog. Backend/API/persistence changes are in scope only to support those flows. Web feature expansion is out of scope. Preserve the designs in `docs/design/exports/`, existing layout/style/navigation and approved privacy cuts. Read the relevant exported mobile design before changing a screen. The user wants visible product delivery, not another controller, broad inventory, source-review campaign or test-count exercise.

Verify the existing real caller → endpoint/service → persistence first. Record a concrete defect or unmet requirement, then make the smallest in-place repair. Open acceptance boxes are not proof of missing code. Compare current/archive/open-branch implementations before adding application files, migrations, tables, services or screens. Reuse accepted evidence when source/configuration/behavior remain unchanged. Do not recreate the two fixes already delivered by this stream or other owners' integrated work.

This prompt replaces the old17:07 UTC handoff. **All old iOS17/controller startup instructions are historical; all local runtime resources were returned.** Do not resume a failed controller or use an old PID/lease as authority. The historical details remain in Git and the linked stream status, not a new execution plan.

## Read these current sources, in order

1. Applicable `AGENTS.md` in the selected authoring checkout.
2. `/Users/yingpengwang/pantopus-coordination/docs/PROJECT_HANDOFF.md` and `docs/workstreams/README.md`, current top sections only. The branch is `codex/workstream-coordination`; master's copies are old snapshots.
3. `/Users/yingpengwang/pantopus-coordination/docs/workstreams/04-1-place-home-records-money.md`, the current handoff at its top. It contains completed work, exact PR reuse table, evidence links and the complete original allocation. Historical CURRENT/ACTIVE paragraphs below it do not override it.
4. Canonical `/Users/yingpengwang/.codex/worktrees/s1-pilot-contracts/skinny-pantopus/NEXT_STEPS.md` and `docs/mobile-pilot-build-brief-2026-10-03.md`, WP2–WP5, §11/§12/§15. Root owns the canonical checklist. Published documentation-only commit`132f1134f` adds the October5 completion checkoffs;4-1 inspected its actual WP2–WP5 block (11 checked subitems). Parent WP2–WP5 boxes remain open. Brief §15 IDs differ from coordination IDs.
5. Relevant `docs/design/exports/` and `docs/VERIFICATION_FIRST_2026-09-13.md`; use the existing screen/acceptance catalogs.

Refresh actual Git branch/status and remote PR/CI before relying on the recorded snapshot. Do not reread all historical reports or repeatedly audit unchanged PRs.

## Source and resource snapshot

- **Accepted application:** `74327981051c1fd19393f3f2d2534b0003e421cb`, `codex/s1-pilot-products-20261004-r2`, in `/Users/yingpengwang/.codex/worktrees/s1-pilot-contracts/skinny-pantopus`. [PR1533](https://github.com/WangPantopus/skinny-pantopus/pull/1533) is OPEN/DRAFT, not merged. [Required CI37375810539](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37375810539) passed **all16 checks on this exact application head**, including all3 iOS devices, Android quality and61 instrumented tests, backend, seeder and complete database replay. Current documentation-only head is`132f1134f`; distinguish it from this tested application head.
- **Own repair checkout:** `/Users/yingpengwang/.codex/worktrees/d993/skinny-pantopus`, `codex/stream4-1-mobile-flow-repairs`, clean/pushed`1ba05f3577cd78d60adc01f86290408b427bb19a`, [PR1541](https://github.com/WangPantopus/skinny-pantopus/pull/1541). Its fixes are already integrated in1533. This older topic does not contain every later peer repair. Coordinate an authoring base from the current assembled source before new application edits; never copy old topic files over the union or edit Root's serving checkout concurrently.
- **Earlier own source:** `/Users/yingpengwang/.codex/worktrees/2ff0/skinny-pantopus`, branch`codex/stream4-1-radon-today`, retained783acdd7. Preserve it; it is not the current assembled application.
- **Coordination writes:** only `docs/workstreams/04-1-place-home-records-money.md` and `docs/workstreams/NEXT-STREAM4-1-PROMPT-2026-10-02.md` in `/Users/yingpengwang/pantopus-coordination`. Root owns shared handoff/README/queue and canonical NEXT_STEPS. Commit only explicit owned paths and preserve other agents' work.
- **Protected checkout:** `/Users/yingpengwang/skinny-pantopus` remains read-only. No reset, clean, stash, prune, force push or deletion of unrelated work.
- **No active resource transfer:**4-1 owns no process/device/runtime/heavy slot. Root returned iOS1C8 slot1 at14:13 PDT; Android5584/isolatedADB16438 and backend18142 were fully returned by14:31 PDT. Heavy is free; retained SQL64554 and app/account/Home/task/history data remain untouched. Root's return receipt is linked in current status. Get fresh current ownership through Root before any native/runtime/SQL work; do not start a second stack.

The current coordinator is chat`01a10d30-e7f5-73c2-8bc1-415b67568ce1`; this outgoing4-1 chat is`01a10d31-852a-72c0-a72d-e115491bc169`. Resolve current successors from the live guide. Human authorizes coordination with the existing coordinator. Root remains sole runtime/device/SQL/process/integration/merge-queue owner (next recorded queue360).

Shared owners:4-2`01a10d32-2e86-7a30-8a87-76feed6ca2c6` owns native notification actions/lifecycle/events; WP3 backend`01a10d33-f5c0-76e1-8e8e-37470dff3080` owns calendar/briefing producer work;3-1`01a10d32-6919-7c93-820b-379868d9f1dc` owns household task/invite flows;3-2`01a10d31-a60d-74d3-a56d-53549f1fc7c2` owns Home/privacy gates; WP8 successor`01a10d34-1ef1-72c0-aef4-fd21aecd3ffe` owns the selected WP2 save-entry/confirmation slice. Preserve those file boundaries. Today content remains4-1. Do not create another backend or notification writer.

## Completed work — reuse it

**Own application changes, PR1541:**

- `8821356ea`: iOS/Android morning prompt Not now recovers an unconfirmed failed display stamp using the existing true-only preferences PUT, hides only after server timestamp acknowledgment, and does not opt into either briefing. Confirmed display dismisses locally without another write. Existing session/authority guards remain.
- `6fcb83fbf`: iOS first pickup save keeps the reminder primer alive by deferring refresh until dismissal. Normal saves still refresh immediately. Same card/layout/API.
- `3d4eecbc6`, `c73f4ce8d`, `1ba05f357`: scoped lint-preserving callback/guard factoring; no suppression or removed predicate.
- Existing files changed: iOS `Features/Place/Detail/AddressTodayTabView.swift` and `PlaceTodayDetailContent.swift`; Android `ui/screens/place/today/TodayTabViewModel.kt`. New focused `TodayTabViewModelTest.kt` was justified because existing Hub Today tests cover a different caller. Five tests pass: retry/reentry/model recreation, acknowledged no-duplicate write, missing timestamp, repeated taps, stale reply. Native failure-path acceptance still open.

**Actual accepted slices:**

- iOS retained9e6 Save→Today saved-place chip/content→display stamp and both briefings false→Not now→real tab reentry/no re-ask→remove/no-place→resave→process-cold/no re-ask. Actual API/SQL joined. This baseline is not proof of the later error-recovery branch.
- iOS synthetic owner Home wins over retained Saved Place. No-city pickup editor autoopens, first-use pickup row focuses it, Tuesday garbage/alternating-Tuesday recycling persist/render/reopen. First-save primer stays visible; Remind me/OS Allow and evening-only preference persist; unchanged resave does not repeat it.
- The same saved schedule passes actual whole-producer previews: combined evening “Garbage and recycling tomorrow” / “Bins out tonight.”, correct October6/Home/Today link; morning leads with task_due and excludes pickup. Exactly two previews; no send/delivery-history/scoped-row mutation. This is not scheduled/provider delivery.
- iOS No or not sure creates a dated radon task. Task-detail Mark done persists and Today shows Done. Paired general task date editing now preserves the chosen local day at09:00 (16:00Z for the tested PDT date) and reopens without dirty state on both apps.
- Android signed-in first-save entry/error/Retry/Cancel works with no Home/saved place and location declined. Successful lookup/save still needs real Mapbox configuration; Add Home validation still needs Google/Smarty.
- iOS first-use initial two rows were captured before writes; saving pickup removes its row. Android later showed the remaining radon row. **Android's pristine two-row capture on that same Home was missed. Do not reset data or create duplicate tasks to fabricate it.**

Related integrated work belongs to its owners: holiday-safe recurrence`db3bd474d`/PR1540; paired task-form date`668ea27f9`→`cccb94f68`; Android first-save owner07dd→`61fcb00b7`; recipient-capability reminder categories`9f03b85bd`; iOS create→detail shared-read repair`73efa1266` and trace removal`cf039ab3d` (45 scoped tests and actual one-creation/native detail pass); test-only clock repair`743279810`. Owner/member assignment/completion/list refresh/notification body route and truthful mailbox verification also passed. Reuse that evidence; do not turn it into untested radon/OS-action coverage.

## Next steps: finish each remaining package

Begin with the first concrete unaccepted case whose prerequisites are available. Through Root, an existing Home's Android pickup/editor/primer path can progress independently of missing address lookup; use retained state and do not reset the already-shown primer. Where a true first-use case is no longer observable, retain the limit and select another legitimate outstanding case. Avoid another broad preparation loop.

### WP2 — Saved Place and private-setup Today

- Finish actual Android address lookup→explicit save→Today→Not now→reentry→remove/no-place→resave→cold when Mapbox is configured. Keep entry/error/Retry/Cancel acceptance; do not claim provider success from that.
- Verify1541's failed display-stamp retry through the native caller/API/persistence; preserve both preferences and existing timestamps. Do not reset an accepted account merely to force a prompt.
- Separate Turn on: actual device IANA timezone, existing opt-in fields and fresh server timestamp, warm/cold persistence. Verify saved-only delivery exclusions with legitimate delivery evidence, not just disabled SQL flags.
- Real same-session Add Home transition and private-setup Today with all household sections locked. Synthetic shared Home priority already passed; it is not private-setup onboarding or provider acceptance.
- Existing anchors: `AddressTodayTabView.swift`, Android `TodayTabViewModel.kt`, `backend/services/context/locationResolver.js`, `backend/routes/savedPlaces.js`, `backend/routes/hub.js`, `UserNotificationPreferences`. Reuse existing routes/contracts.

### WP3 — Pickup reminders

- Finish remaining Android editor/save/reopen/primer and both apps' relevant permission-denied/Open Settings paths; keep accepted iOS save/SQL/primer evidence.
- Confirm genuine scheduled evening delivery/accepted receipt, correct date/Home/link/category, Today landing and Bins out event. Preserve quiet/low-signal, pickup-over-bill priority, morning exclusion, dedup/retry and removed-access behavior.
- Finish actual holiday-moved pickup and local DST delivery boundaries only with legitimate schedule/provider setup. Official city Thanksgiving/Christmas/New Year rows require confirmed source rules; do not invent them. Reuse existing accepted calendar recurrence/DST regressions and holiday-safe editor fix.
- Private-setup counterpart remains separate. City defaults must stay visibly unconfirmed and never push. No new scheduler, table or replacement service.
- Existing anchors: native `PlaceTodayDetailContent`/`PickupScheduleEditor`, `addressCalendarService.js`, `providerOrchestrator.js`, `eveningBriefingService.js`, `internalBriefing.js`; use the existing WP3 owner for producer changes.

### WP4 — Radon and tasks

- Complete Yes (optional date/result, done task/no re-ask), device-local30-day Not now, Today Change date, overdue presentation and warm/cold persistence.
- Keep exact radon create contract: `details.suggestion=radon_test`, expected title/description, `visibility=members`, unassigned where required, selected09:00 local with actual offset. Capture the returned TaskID privately; no duplicate creation. Independently verify API/SQL expected timezone rather than deriving expected time from the stored value being tested.
- The accepted generic task form fix uses09:00 local with offset. Earlier Today due-update checks used a one-key date-only request. Preserve each existing caller contract unless its actual route/persistence proves a concrete defect; do not silently conflate the two paths or revert the accepted date repair.
- Finish genuine due-day reminder, done/canceled exclusion, recipient visibility, actual OS Done and Not now→date-editor actions, and events. Ordinary task detail Done/local generic banner are not proof of OS-action handling or scheduled delivery.
- Apply the current brief's capability exception: editors/completers get Done+Not now; complete-only assignees get Done only; unknown capability gets body navigation only. Do not grant due-date editing to an assigned member for visual parity.
- Shared and private-setup behavior remain separate.3-1 reviews task paths;4-2 owns notification handlers; use their integrated source rather than overlapping edits.

### WP5 — One first-use card

- Preserve accepted iOS initial two rows and pickup-focus/row removal.
- Finish explicit radon-row/card removal after answer, radon focus clearing its local dismissal, device-local Later and private-setup parity.
- Android initial two-row state on the same pristine Home is **unverified and no longer replayable without changing history**. Preserve that recorded gap; do not reset Home/tasks/flags to fake it. Root may select a legitimate independent future onboarding case, but it cannot retroactively prove the missed shared-Home observation.

WP1 curator native slices and WP6 household completion are already accepted within their recorded scope. iOS30-minute session timing remains the event owner's boundary. Do not let unrelated accepted slices consume the next4-1 runtime window.

## Finish the original retained backlog too

Use the existing17-row ledger: **I01, I02, I03, I04, I05, I06, I07, D01, D02, D03, D04, D09, F01, F02, F03, F04, F05. Four are closed within retained scope (I01/I02/I03/F01);13 remain partial/external/deferred.** Pilot substeps do not change this count. The current status has the exact residual mapping; the original parent table is in `docs/workstreams/04-place-records-money-mail.md`.

After available pilot cases, continue: (1) PR1495 Maintenance category/contact/protected attachments AFTER with existing eleven transported operators; accepted notes/vendor/next-due stay accepted. (2) Android Rate Watch real Remove failure/manual retry/cold with unchanged failed row, no PMMS cache seeding/deletion. (3) Civic natural unavailable/known-empty/error versus actual screen, no fake keys. (4) document picker and recent Home activity/current-authority/cut guards. (5) actual equity max(value−balance,0), no fabricated ATTOM data. (6) empty Emergency Share through its existing caller, no external share/dial.

Do not lose I07 concurrent authority/timezone, D01 remaining mutation/receipt/lifecycle, D04 competing readers/writers, D09 malformed-success/lifetime and F02 hosted/provider/access/currency residuals merely because they are not separate rows in that shortlist. F04/F05 hosted scale/eligibility/retention/migration-before-reader/worker retirement/released-client acceptance remains external until genuinely available. I05/I06 real ATTOM/AirNow/Civic/WeatherKit coverage remains provider-dependent.

Cuts remain cuts: I03 Hire, D03/F03 full bills/packages, D09 pets/polls and general Home calendar interiors. D02 issue media is deferred pending an approved private access/EXIF/type/scan/delete contract; text issues remain. Historical web Maintenance suggestion/Log is outside this mobile-only direction. Mail-linked Records and JustMoved mail are4-2 execution with4-1 contract review. Preserve former UX S2-09/14/15/20/21/24 and U05 ordinals1/2/3/23–30/34/36–38/42; Root owns integrated U05/release assembly.

PR1495's exact existing nullable forward`20261003180000` is merged to Git; Root must check its actual current application before dependent Maintenance execution. **Never read/hash/compare/apply/unapply held`20260926100000` migration BODY, use migration globs, rewrite applied history or add a duplicate migration/table.**

## Evidence and publication

Current private evidence: `/Users/yingpengwang/.config/pantopus/stream1-mobile-delivery-20261005/`; WP3 result: `/Users/yingpengwang/.config/pantopus/wp3-backend-source-20261004/producer-preview-20261005/result.private.json`. Exact per-flow links are in the current stream handoff. Retained source archives: `/Users/yingpengwang/.config/pantopus/stream4-1-studio-pilot-20261004`, `/Users/yingpengwang/pantopus-handoff/stream4-1-20261004-r1/stream4-1-mac-studio-handoff`; use them only when the next concrete case needs them, not to restart the old verifier campaign. Original source/failure/recovery evidence remains immutable.

All15 owned drafts remain open:1495,1502,1510,1514,1517,1519,1520,1521,1523,1524,1525,1529,1530,1532,1541. Their exact heads/holds are in the handoff. All prior pilot heads except1495 are already in1533;1541's repairs are integrated too. Reuse ready work through Root's queue instead of duplicate PRs. No merge/deployment happened during this session.

After each meaningful outcome, update the two owned continuity files with source, actual caller/API/persistence evidence, remaining limits and next action. Send proposed exact NEXT_STEPS checkoffs to Root, who owns that file; check a package parent only when its full acceptance is satisfied. Run only affected regressions plus required CI for an actual repair, then send the exact reviewable commit to Root. Preserve actual failed/superseded runs and distinguish code checks from device/provider/hosted delivery.

Keep credentials, device tokens, private actor/coordinate data, raw logs, archives and native binaries out of Git/chat. No account/Home/task/history reset, fixture rewind, global cache restoration, foreign resource action or manufactured provider/time/OS result. Preserve retained data, including real test task rows needed for shared journey evidence. State unavailable boundaries honestly and keep making independent product progress.
