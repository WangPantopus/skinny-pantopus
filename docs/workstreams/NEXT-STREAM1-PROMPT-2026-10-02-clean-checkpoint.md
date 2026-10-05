# Stream 1 successor prompt — October 5, 2026 final mobile handoff

You are the Stream 1 successor: Support Trains, coordinator and sole merge owner. Continue the unfinished work assigned to this stream through working mobile flows, integration and the remaining release-readiness boundaries. The user's priority is to build and finish NEXT_STEPS features on **iOS and Android**, following the applicable designs in `docs/design/exports/`. Supporting backend/API/persistence work is in scope. New web feature buildout, speculative replacement architectures and another verifier/controller project are not.

Use the user's requested **GPT-6 Astra / Extra High** configuration. Preserve the seven existing specialist lanes. Do not create new chats, subagents or automations. Coordinate with the current human-resumed owners; older stopped chats and old reservation files are not fresh authority. Only Stream 1 integrates shared source/status and merges.

This prompt replaces the stale pre-resume starting point in this existing file. Its earlier contents remain in Git history. Historical ACTIVE/STOPPED sections below the live handoff's current block do not override this checkpoint or a later human instruction.

## Read once, then advance an unfinished outcome

1. Live coordination checkout **C**: `/Users/yingpengwang/pantopus-coordination`, branch `codex/workstream-coordination`. Read the current tops of `docs/PROJECT_HANDOFF.md`, `docs/workstreams/README.md`, and `docs/workstreams/01-trains-coordination.md`.
2. Product checkout **W**: `/Users/yingpengwang/.codex/worktrees/s1-pilot-contracts/skinny-pantopus`. Read its `NEXT_STEPS.md` section 3 and `docs/mobile-pilot-build-brief-2026-10-03.md`; consult each owner's current handoff before touching that owner's files.
3. Read the relevant exported design before implementing a feature. Reuse the accepted implementation, native navigation and components. Preserve the user-approved visual treatment.
4. Refresh current branch/status, remote PR/head and relevant CI once. An open checkbox or old report is not proof of missing code. Locate the existing caller, endpoint, service and persistence contract, reproduce an actual defect or identify an explicit unmet requirement, then make the smallest repair.

The previous resumed session did deliver application repairs and real local journeys. Preserve those results. Do not repeat the old claim that this session delivered zero code or zero flows; that statement described the earlier stopped session.

## Exact Git and review state

| Item | Handoff state |
|---|---|
| Product branch | `codex/s1-pilot-products-20261004-r2` in W |
| Current product HEAD | `132f1134ff0cb4679a76501f2f5677af02d259b1`, clean and pushed; only `NEXT_STEPS.md` differs from the tested application commit below |
| Fully tested application commit | `74327981051c1fd19393f3f2d2534b0003e421cb` |
| Integration PR | [1533](https://github.com/WangPantopus/skinny-pantopus/pull/1533), draft and unmerged |
| Accepted application CI | [37375810539](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37375810539): all 16 checks successful at `743279810`; three iOS simulator jobs, Android lint/unit/snapshot/assembly and 61 instrumented tests, backend, seeder, web compatibility, database replay and safeguards |
| Backend result | 6,566 Jest tests passed, 16 skipped; separate privacy checks passed |
| Documentation-only checkpoint | `132f1134f` reconciles NEXT_STEPS and uses `[skip ci]` to avoid repeating unchanged application CI. Do not describe that new documentation head as having its own 16-check run. Application bytes are unchanged. |
| Remote master | Last refreshed `d8c9fb1c803e714a48b8745faa36951b8be10193` |
| Merge queue | Next sole batch **360**. No merge was made in this resumed session. |
| Existing merged work | PR1499 merged in batch 358; PR1509 pilot events/Hub gate, PR1512 Train reminders and the reused PR1495 schema prerequisite merged in batch 359 |
| Protected checkout | `/Users/yingpengwang/skinny-pantopus` remains read-only; do not reset it or overwrite unrelated work |
| Original chat checkout | `/Users/yingpengwang/.codex/worktrees/2a60/skinny-pantopus` was left untouched |

The current checklist explicitly checks completed implementation/local-acceptance subitems. All eight WP parent rows remain open. Package completion, merging and pilot readiness are separate claims. NEXT_STEPS section 2 founder/provider/distribution items and section 5's evidence gates remain in force. Do not start parked/dropped features or post-pilot designs simply because a provider-dependent check is unavailable.

## What was actually completed

The canonical detailed checked/unchecked list is W/`NEXT_STEPS.md`; this table explains the handoff and points to the accepted scope.

| Package | Completed source or accepted actual result | Remaining boundary |
|---|---|---|
| WP1 | Curator publisher-voice/question/SKIP guards and safe provider-error logging; 119 focused/507 seeder checks. Native chip layout repaired. Actual rebuilt iOS chip/readability and ordinary-author attribution; Android exact retained curator/ordinary accessibility attribution and non-author report/mute menu. Existing organic/Hub work is merged. | Five genuine provider outputs; named remaining native/cold/cancellation checks in WP1 handoff; Android pixel readability is unverified. No new detail chip is authorized. |
| WP2 | iOS retained Save → Today/chip → Not now → reentry → remove → resave → process-cold restoration, with persisted stamp and both briefings off. Both confirmations implement See Today. Failed-stamp Not now recovery implemented/tested. Actual signed-in Android entry/error/fresh Retry/Cancel with no save. iOS synthetic Home precedence. | Successful Mapbox lookup/save/new See Today CTA; Android full saved-place flow; actual failed-stamp and Turn on/timezone edges; genuine Google/Smarty Add Home and private-setup/public-only behavior. The accepted baseline iOS flow does not separately prove the newly added CTA. |
| WP3 | Actual iOS no-city editor, Tuesday garbage/alternating recycling persistence/reopen, stable primer, Remind me/OS Allow, evening-only opt-in and unchanged resave without repeated primer. Holiday recurrence source repair. Actual whole-producer evening combined pickup and morning pickup exclusion previews, with no delivery writes. | Android counterpart; actual quiet/severe/unconfirmed/dedup/authority/holiday resave/private-setup cases not already accepted; local schedule/DST, push landing and OS Bins out/event; real provider/physical delivery. |
| WP4 | Actual iOS No/not sure → dated radon task → ordinary task-detail Done → persisted completion/Today Done. Both native date edit/save/reopen at selected 09:00 local. Notification date-editor routing and recipient-capability categories implemented/tested. | Actual OS Done/Not now, Yes/date/result, 30-day dismissal, Today Change date, Android/private-setup/member/original-create/cold edges, genuine eligible-recipient scheduled delivery. |
| WP5 | iOS synthetic Home's initial two rows, Set pickup focusing the editor and pickup row removal after save. | Explicit radon-row/card disappearance, Later/reentry/cold, private setup and Android/full both-platform flow. Pristine Android two-row capture was missed; never reset/recreate the Home/tasks to manufacture it. |
| WP6 | Actual iOS owner invitation/assignment → Android household member acceptance/completion → owner Android generic notice opening the exact Done task. iOS creation/detail/list lifecycle repaired; 45 focused final tests and actual one-row creation without Retry. Both platforms' truthful mailbox copy; Android invited-member letter/pass/RealRent/RateWatch restrictions. | Reciprocal invited-member iOS completion/notice; remaining F3b consumers, roles, recipients, decline/neighbor and address/legacy/populated-backfill cases; external invitation/push/hosted delivery. The assigned task was a retained household test task, not a reset of the already-Done radon task. |
| WP7 | Merged authenticated event/report/activation backend. Actual safe iOS/Android organic events and iOS radon decisions. Android real 1,880.927-second background return: one event; short return: zero additional events; same process, no clock change. | iOS actual ≥30-minute return; push-origin and callback/refusal edges; actual OS action-event/report joins and delivery-qualified reminder_sent with genuine delivery. |
| WP8 | Merged independent Train-local evening/day-of reminders and guest email. Accepted normal API → DB → whole jobs → local SMTP across seven simulated clock phases, ten accepted messages and one deliberate refusal; repeat/retry/privacy/no-start cases. Fifteen captured temporary rows were cleaned in that accepted run. Existing normal Train native journeys remain reusable. | Natural scheduling, signed-in native pushes, actual external inbox and physical delivery. Concurrent exactly-once and atomic cancel/send were never established. |

Synthetic local Home setup was clearly labeled and retained. It proves downstream behavior only. It does not prove real address onboarding, address attestation or production geography. Generic in-app notices and simulator banners do not prove external push delivery.

## Important repairs now in the assembled branch

Do not cherry-pick older topic files over the current union. These are integrated commits, not an instruction to reapply them.

| Integrated commit(s) | Result |
|---|---|
| `f37c4ced3`, `04da6ef7d`, `608ec4297` | Non-sports publisher guards, bounded provider-error logging and readable curator chip. |
| `f826f468e`, `47d5072a3`, `61fcb00b7`, `8dff6c787` | See Today confirmations and reviewed Android snapshot; reachable signed-in first-save/error/retry path, with equivalent lint-safe factoring. |
| `c4afa9fb6`, `b52644546`, `8b4c79afa`, `3acc717d1`, `de0b29a79` | Morning-prompt stamp recovery and stable first-save pickup primer; equivalent lint fixes. Actual failed-stamp fault-path acceptance remains open. |
| `83c881afa` | Recurring pickup anchor preserved through holiday-aware saves; actual holiday fixture acceptance remains open. |
| `0eb6d64a2`, `cccb94f68`, `9f03b85bd` | Native reminder due editors; paired local-day/09:00 dates; recipient-capability action categories. |
| `70c049d3e`, `09e139d7f`, `6a359eae9`, `9f0249df6`, `73efa1266`, `cf039ab3d` | iOS task complete/reopen, refreshed lists, atomic save navigation and model-owned detail read shared by temporarily overlapping mounted views; diagnostic cleanup. |
| `42c3c479d`, `86ca92f88` | Mailbox verification derives from recorded postcard proof; backend/private no-store and per-endpoint client cache bypass prevent stale false verification. |
| `f78430f36` with its focused tests | Newest native Emergency access result wins against stale completions. Source/tests accepted; the owner's remaining actual native AFTER is still open. |
| `743279810` | One existing hubContext test now pins its intended morning fixture and restores real timers. The previous afternoon timeout was reproduced; all 52 focused tests and final CI pass. No application logic or assertions were weakened. |

The final iOS task fix retains one model-owned detail read while any mounted view still needs it. Last departure, scene inactivity and access retirement still cancel/clear private state. Earlier Group→ZStack and route-`.id` attempts failed and were removed; temporary diagnostic traces are removed. Preserve their failed receipts; do not reintroduce those candidates or “fix” tests by weakening their assertions.

Reminder categories are exact: editors/completers receive `TASK_REMINDER` with Done and Not now; complete-only recipients receive `TASK_REMINDER_DONE_ONLY` with Done; malformed/unknown capabilities get no action buttons. Recheck live authority before mutations. Do not grant due-date editing to a complete-only member.

## Start the remaining work in this order

1. **Reconcile current source and ready integration once.** Keep PR1533 draft until its actual remaining gates are resolved; use queue 360 for genuinely ready work. Inspect existing drafts before coding. Reuse the recorded inventory in the WP8 handoff; its old virtual compositions are planning, not accepted products. The native AFTER for existing PR1500 belongs to 3-1; PR1496 Custom behavior is not established merely by an older binary or the old inventory.
2. **Finish independently available native flows.** Give 3-1 reciprocal invited-member iOS completion/notice and its named remaining gates; 4-1 the unverified Today/radon/first-use cases; 4-2 the actual OS actions and iOS elapsed-session case; 3-2 the remaining privacy consumers/roles/native AFTER. Keep file ownership explicit. Start iOS's ≥30-minute interval alongside other useful work, not as a reason to idle all lanes. Every concrete failure should lead to a focused repair of the existing flow, then that flow and affected regressions.
3. **Complete action-to-persistence-to-report behavior.** In the existing dispatcher/AppDelegate/task access paths, exercise actual Bins out, Done and eligible Not now; verify Today versus legacy briefing routing, current recipient authority, one mutation/event, finished-task refusal and safe event summary joins. A unit test, direct API call, ordinary task-detail button or injected banner alone is not an OS-action result.
4. **Use genuine provider configuration when available.** Existing first-save calls need Mapbox; normal Add Home validation needs Google/Smarty; five genuine humanizer outputs need the intended provider. These were unavailable, and earlier optional configuration questions were unanswered. Do not invent outputs or treat elapsed time as approval. Keep credentials in private configuration; request only the missing setup/path when needed, then continue independent work. Complete lookup → preview → save → new See Today and same-session Add Home on both platforms, including private setup. Reuse accepted iOS baseline evidence.
5. **Finish scheduled/provider boundaries.** WP3 owns actual pickup timing/holiday/DST/history cases. WP8 owns genuine email/native reminder delivery. Founder-owned hosted services, signing/TestFlight/Play, physical devices and real external inboxes are separate prerequisites. Do not claim them from simulator/debug/local SMTP results.
6. **Integrate and close earned checklist items.** Run changed-scope checks and applicable CI; reuse unchanged accepted suites/journeys. Update NEXT_STEPS and the existing acceptance catalogs with exact source, behavior and limits. Merge only completed, reviewed work through the existing queue. Distinguish merged source, local actual acceptance and hosted/physical acceptance.
7. **Continue all remaining Stream 1 rows below.** An unavailable external boundary does not prevent independent implementation or acceptance work elsewhere. Stop only at a genuine missing input/authority boundary, with the exact next action recorded; do not silently abandon the rest of the workstream.

## Stream 1's broader backlog remains authoritative

Read the existing **Scope**, **Acceptance rows owned**, **U03/U04** and **U05** sections in C/`docs/workstreams/01-trains-coordination.md`; keep their evidence and counts. Do not create a replacement tracking system.

- **Support Trains:** list/search; create/publish/detail/share; helpers' signup/cancel/leave; delivery/organizer confirmation; organizer dates; updates/roster/address privacy; lifecycle/co-organizers. Current owner comparison found the relevant native/API/job source unchanged from accepted Train evidence. Reuse normal and failure/cold/lost-reply journeys; do not interpret an older row's wording as a new defect. AI Remind helpers, real money, hosted distribution and genuine delivery retain their separate boundaries.
- **G01–G05:** preserve the dedicated closed G02 Git evidence and accepted CI. Remaining original Home/payment acceptance, canonical hosted-ledger adoption/preservation and final combined release dependencies remain scoped in the existing rows. Never rewrite applied migration history.
- **O01–O06:** named hosted ledgers; external-store recovery/backup objectives; production Auth/Storage/queue/provider configuration; current source/product release manifest; routing/TLS/observability/rollback; distribution signing and production APNs/FCM/capacity. Local debug/simulator success does not close these.
- **L01–L04:** real account/vendor/traffic/policy inputs for release pricing; approved provider TEST/release matrix; separately approved production cutover and post-deploy checks; consenting users and actual pilot outcomes. Do not purchase services, move real money or deploy merely to check a row.
- **U05 assembly:** reconcile later accepted repairs with the existing screen catalogs and release manifest, respecting each owner's cells. Preserve accepted Train/source bindings. Exclude the eight launch-flagged interiors; do not reopen cut features or add web versions.
- **NEXT_STEPS sections 4–7:** pilot, interviews, strategy reconciliation and later mobile roadmap follow their stated dependencies. Section 5 is after the pilot's first read; Street Organizer/Agent stages have explicit gates. Web versions, dropped F6/F11 and parked features remain outside this mobile build.

## Owner routing and successor files

Paths below are existing owner-maintained records. Read their current top; older paragraphs can describe superseded runs. Current chat IDs identify this resumed session, not immutable future assignments.

| Owner | Current chat | Existing successor / handoff |
|---|---|---|
| 3-1 household/access | `01a10d32-6919-7c93-820b-379868d9f1dc` | C/`docs/workstreams/NEXT-STREAM3-1-PROMPT-2026-10-02.md`; `03-1-home-access-ownership.md` |
| 3-2 privacy/security | `01a10d31-a60d-74d3-a56d-53549f1fc7c2` | C/`docs/workstreams/NEXT-STREAM3-2-PROMPT-2026-10-02.md`; `03-2-home-security-privacy.md` |
| 4-1 Today/pickup/radon/first use | `01a10d31-852a-72c0-a72d-e115491bc169` | C/`docs/workstreams/NEXT-STREAM4-1-PROMPT-2026-10-02.md`; `04-1-place-home-records-money.md` |
| 4-2 native actions/events | `01a10d32-2e86-7a30-8a87-76feed6ca2c6` | C/`docs/workstreams/NEXT-STREAM4-2-PROMPT-2026-10-02.md`; `04-2-mailbox-mailday.md` |
| WP1 curator/seeder | `01a10d30-4867-7870-90b3-87aadb50e686` | `/Users/yingpengwang/.config/pantopus/stream1-wp1-curator-seeder-20261004/WP1-SUCCESSOR-PROMPT-2026-10-05.md`; `WP1-RESTART-HANDOFF-2026-10-05.md` beside it |
| WP3 pickup backend | `01a10d33-f5c0-76e1-8e8e-37470dff3080` | `/Users/yingpengwang/.config/pantopus/wp3-backend-source-20261004/WP3_SUCCESSOR_PROMPT_CURRENT.md`; `WP3_HANDOFF_CURRENT.md` beside it |
| WP8 Trains / assigned saved-place entry | `01a10d34-1ef1-72c0-aef4-fd21aecd3ffe` | `/Users/yingpengwang/.config/pantopus/wp8-source-20261004/WP8_SUCCESSOR_PROMPT_2026-10-05.md`; `WP8_RESTART_HANDOFF.md` beside it |

Root alone writes shared NEXT_STEPS and the three coordinator headers. Owners write their own status/prompt files. The coordination worktree is shared: preserve others' unstaged/staged files and commit only your named paths. No outgoing owner has been assigned a new runtime in this handoff.

## Existing implementation entry points

Resolve paths in W; follow the current code rather than stale line numbers.

- Today/save: iOS `Features/Place/Detail/AddressTodayTabView.swift` and `Features/Place/Launch/PendingPlaceView.swift` under `frontend/apps/ios/Pantopus/`; Android `ui/screens/place/today/TodayTabViewModel.kt`, `TodayTabScreen.kt`, `ui/screens/place/launch/PlaceLaunchViewModel.kt` and `PendingPlaceScreen.kt` under `frontend/apps/android/app/src/main/java/app/pantopus/android/`.
- Existing server contracts: `backend/routes/savedPlaces.js`, `backend/routes/hub.js`, `backend/routes/placeIntelligence.js`, `backend/services/context/locationResolver.js`; `SavedPlace`, `UserNotificationPreferences`, Home/calendar/task contracts.
- Household/task actions: both native `HomeTaskAccess` implementations and existing household task screens; `backend/routes/home.js` and `backend/routes/mailboxV2Phase3.js`; existing HomeTask/capability and invitation/verification RPCs.
- Notifications/events: iOS `Pantopus/App/AppDelegate.swift`, Android `push/NotificationDispatcher.kt` and its existing receiver/routing files; `backend/services/funnelReport.js`, existing internal briefing routes and `pantopus-seeder/src/handlers/briefing.py`.
- Curator and Train: `pantopus-seeder/src/pipeline/humanizer.py`, existing native PulsePostCard; `backend/jobs/supportTrainReminders.js`, `backend/services/emailService.js`, existing Train routes/screens. Use the retained fixtures once; do not rerun their producers.

## Retained runtime and safety facts

**Nothing is running under this Root's ownership.** iOS was shut down at 14:13 PDT; Android/ADB/backend and exact reservations were returned by 14:31 PDT on October 5. Build/test/install callers and the final CI watcher joined. Original emulator exit 0, ADB exit -15, backend exit 1 after normal SIGTERM are preserved; process/listener absence and device/runtime release succeeded. The backend's exit 1 is not rewritten as success.

- Retained iOS: `1C8C7C10-C078-4DE1-A1A1-46D1A96546AE`, installed final iOS source `cf039ab3d`, account/data preserved. iOS source is unchanged between that build and application `743279810`.
- Retained Android: AVD `pantopus_root_ea566a52d70b`, **emulator-5584 only**, isolated ADB **16438 only**. Installed Android source `9f03b85bd`, APK SHA prefix `23172dec`; Android source is unchanged through application `743279810`. Do not reinstall/reset just to obtain a clean-looking start.
- The human explicitly answered **“Yes—use ADB/Maestro on that emulator.”** That authorization is limited to this Android emulator/isolated port. iOS Maestro authorization was not supplied; follow the available tool's control rules and do not transfer Android permission to iOS.
- Retained shared database API **64553**, SQL **64554** is not an owned child to stop. Last recorded metadata: 353 tables, 112 migration registry versions; six approved forwards applied. The merged nullable-Maintenance prerequisite from PR1495 is still not locally applied. Consult its existing record before any dependency requires it.
- Current retained data includes the saved place/preferences, clearly synthetic Home context, household acceptance/history, pickup rules, radon Done task and six real test task rows. Keep them; no Auth/User/parent reset, deletion, rewind, blanket cleanup or fabricated pristine-first-use state.
- Do not read/hash/apply the held **20260926100000** migration body or run the general migration checker against this protected local state. Do not touch foreign emulator5554, iOS E85…/founder EB5…, physical phone/watch, founder API/DB64521/64522/:8000, or foreign DB64601/64602.
- Fresh execution requires current ownership/reservations under the successor's actual identity, using the existing runtime/device/heavy helpers. Old PIDs, labels, receipts and ACKs are historical facts, not current grants. Do not impersonate the outgoing Root.
- Existing helpers remain under `/Users/yingpengwang/.config/pantopus/stream1-studio-resume-20261004/` and `/Users/yingpengwang/.config/pantopus/stream4-1-studio-pilot-20261004/`. Reuse safe resource control, not the old multi-attempt verifier campaign.
- Last backend used port18142 with scheduled jobs disabled; its process is stopped. Existing private local backend configuration is N/`backend-local-private.env`; retained account/database configuration is under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/runtime/`. The last successful standard backend used Node24 at `/Users/yingpengwang/.nvm/versions/node/v24.13.0/bin/node`. Reuse the existing setup and readonly dependencies rather than building another controller. Preserve private configuration without copying credentials into source, chat or the prompt.

## Evidence to reuse

Private evidence root **N** is `/Users/yingpengwang/.config/pantopus/stream1-mobile-delivery-20261005/`. Files remain 0600/directories 0700. Read only the bounded receipt needed; do not publish raw database rows, device tokens, auth responses or operator logs.

| Evidence | N-relative path or owner path |
|---|---|
| Accepted application CI | `ci-743-final-private.json` and public CI link above |
| Complete resource return | `runtime-return-private.json`, `ios-combined/device-return-private.json` |
| iOS saved-place baseline | `ios-saved-place-journey.json`, `saved-first-private.json`, `after-remove-private.json`, `after-resave-cold-private.json` |
| iOS actual creation repair | `ios-combined/native-create-shared-read-acceptance.json`, linked one-row/trace receipts; `ios-combined/task-final-after-result.json` |
| Pickup/date/radon persistence | `ios-combined/pickup-persisted-private.json`, `ios-combined/radon-task-date-fixed-private.json`, `ios-combined/radon-task-done-private.json` |
| Household flow | `ios-combined/household-invitation-private.json`, `ios-combined/household-task-assigned-private.json`; `android-native/invitation-accepted-private.json`, `android-native/household-task-completed-private.json` and existing owner notice/detail XML |
| Android date/first-save | `android-native/owner-date-edited-private.json`, `android-native/owner-date-reopened-private.xml`, `android-native/first-save-entry-result-private.json` |
| Android attribution and timing | `android-native/curator-parity-acceptance.json`, `android-native/session-timing-acceptance.json` and their adjacent native/SQL receipts |
| Actual safe event rows | `native-measurement-safe-events-private.json`; `ios-combined/session-open-short-return-private.json` |
| Whole pickup previews | `/Users/yingpengwang/.config/pantopus/wp3-backend-source-20261004/producer-preview-20261005/result.private.json` |
| WP8 API/jobs/local SMTP and retained Train scope | Existing WP8 handoff and Stream1 U03/U04 evidence links; accepted temporary cleanup already happened, so there is no WP8 fixture set to replay |

Before finishing each meaningful milestone, update the existing handoff, NEXT_STEPS and owner status with: the user-visible outcome, exact application/documentation head, actual versus source-only verification, remaining boundary and one concrete next action. State failed attempts honestly and retain their evidence. Never use an overall readiness percentage or check count as a substitute for completed user flows.
