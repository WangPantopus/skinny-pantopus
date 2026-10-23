# Messages / Chat performance and reliability handoff — October 23, 2026

**Final handoff checkpoint: October 23, 2026, approximately 23:45 UTC.** The founder requested this handoff after the resumed repair/verification session. This is a continuation checkpoint, not a release approval.

The original **63 stacked draft PRs (#2665–#2727)** were preserved. This effort now has **131 open draft PRs: the original 63 plus 68 resumed slices, including documentation and integration PRs, through #2801**. The complete current register below excludes six intervening PRs belonging to other sessions. All implementation source is committed and pushed; generated artifacts and private operator evidence stay local. No chat-stack PR was merged or deployed by this session.

Read AGENTS.md, NEXT_STEPS.md and the current mobile pilot brief. Then read this latest checkpoint and the private operations companion at `~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md`. The appendix preserves the original broad audit verbatim. Earlier dated observations are retained at the end as history; **this checkpoint supersedes their backlog, artifact and runtime status**. Inspect live Git/PR/CI/process state before acting.

There is no measured basis for WeChat/WhatsApp parity. We have substantial local correctness evidence, implemented performance bounds and working recovery paths; incomplete integrated-artifact checks, CI failures, physical-device/provider verification and controlled performance measurements remain.

## 1. Scope, decisions and non-negotiable constraints

- Preserve the existing screens, layouts, navigation and launch flags. No redesign or launch-cut activation.
- Do not write test code, unit tests or coverage work. Run relevant existing checks. Do not silently alter tests to make the stack green. Unchanged upstream tests were imported by master integration; no test code was authored by this effort.
- Verify through the real web app, iOS simulator and Android emulator against the owned local API/database. Include sender and recipient, reload/relaunch, offline/reconnect, accepted-but-lost responses, account changes, access loss and attachments. API probes and CI are supporting evidence, not substitutes.
- Encrypted account-scoped history, ChatPushDelivery and the local ChatTopicRead implementation are approved. New tables still require founder approval.
- Every applied migration is immutable, including the 17 original chat migrations through 20261023235000, approved topic-read migration 20261024001000, and imported upstream migrations 20261023072000/20261023072100.
- New migration **20261024002500 in #2801 is committed but UNAPPLIED**. Do not mistake successful transactional DDL creation followed by rollback for application or functional verification.
- No hosted configuration/database/provider changes, real-person messages, store submissions or auto-deploying backend-stack merges without founder release authorization. The repository is public: keep credentials, env files, raw device tokens, operator logs, database dumps and personal data out.
- Reuse existing worktrees/branches/artifacts and inspect other open branches before adding anything. Three client agents in separate existing worktrees are authorized; backend/integration stays centrally owned. Do not recreate the retired workstream/lease system.

## 2. Exact source, artifact and runtime state

| Area | Latest source | Artifact/runtime actually verified | Next distinction to preserve |
| --- | --- | --- | --- |
| Backend | #2801 `7239311c2`, branch `codex/chat-topic-room-binding` | Both owned APIs run #2790 `ba1a00e3d` from worktree 3d6c | #2801 route/DB guard is not running; its migration is absent locally. |
| Web | #2800 `90d453f1d`, master integrated with final context/receipt fixes | Production build passed: 170 pages, BUILD_ID `9R4aZTW63x2FC4liFBdwo`; isolated probe passed and stopped. Dev 63109 runs this revision. | Production 63107 intentionally remains older `d561bb25e` to preserve a genuine false-Read cache for upgrade verification. Latest production UI pass is incomplete. |
| iOS | #2799 `3837b1f96`, includes #2791/#2794/#2797/#2798 | Installed/preserved `299f5e233`; combined 383 signed simulator build is running at freeze | Latest source adds topic caches, bounded history, durable retirement and receipt/inbox fences. None is yet proved by the installed 299 artifact. Check final build outcome in private notes. |
| Android | #2789 `7c2dcb7d9` | Exact APK built in 27m6s, preserved and installed on emulator 5590; SHA256 `4bfd78325f80d3404e1301e8c99fb058d99248cc1754538a3558997948606394` | Topic selected/lost-ACK checks passed. Reply08/photo, interruption during retirement and remaining receipt checks stopped before starting. |
| Documentation | #2747 `codex/chat-resume-checkpoint` in d378 | This document and the private recovery notes | d378 is the documentation checkout at handoff. Do not restart APIs from it. |

Master integration used `fc3223d3f` on all four platform stacks. Other sessions continue working: do not assume it is still the remote tip. Source worktrees and separate native build worktrees are preserved. The older verified artifacts are deliberately retained for regression comparison.

## 3. Original audit findings, repairs and current evidence

This matrix reconciles the original audit with actual implementation. “Implemented” does not mean released, and older-artifact evidence does not automatically verify later source.

| Problem found or audited | Repair / approach | Evidence and remaining limit |
| --- | --- | --- |
| A person-level read cursor cleared unseen messages in other rooms. | Explicit visible `throughMessageIds` per room; compatible legacy single cursor. | Actual web/iOS/Android masks showed two visible rooms Read and hidden room Sent; offline scoped unread projection checked. |
| Selected-topic reads could mark other topics read. | Approved ChatTopicRead boundaries; separate route/event; unify unread, receipts, push suppression, delete reconciliation. | Web and native selected-topic masks verified. Android lost accepted read response survived termination/retry without clearing the other topic. |
| Topics could be attached to unrelated rooms. | #2801 validates displayed sender, direct/task room and both current members; transactional DB guard. | Reproduced 201 in a group lacking the topic peer. Source committed; migration/app/race verification unfinished. Probe message soft-deleted through normal API. |
| An older transaction inserted behind an accepted read boundary. | Assign omitted server creation time after the room revision lock. | Two-transaction reproduction and repair verified locally. Applied migration unchanged. |
| Reconnect recovery missed edits/deletes or repeatedly refetched full history. | Commit-ordered revisions, bounded changes pages, explicit reset/removal, canonical fallback. | Missed mutations recovered in apps; large scopes use POST and per-page access retirement. Production held-success-after-revocation race still needs final proof. |
| Large membership intersections and result caps truncated conversations/identities/reactions. | SQL pair filtering, keyset pages, batched identities, paged reaction aggregation using Map. | 1,031 unrelated memberships; 1,032-member group response; 1,600/1,601 reaction groups with literal toString; actual reaction controls on all clients/counterpart reload. |
| Cursor maps overflowed URLs; room joins flooded the server/client. | POST JSON recovery, bounded GET compatibility, bounded joins and retry/cancellation ownership. | 532-room browser/native recovery; browser URL shrank from 24,055 characters to a 90-character POST URL. Deliberately delayed join ACK/exhausted retry cases remain. |
| Inbox refresh dropped loaded tail pages or replayed stale head responses. | Keyset paging, generation ownership, authorized revalidation and account-level invalidation. | Web 67 business rows; Android 67 business rows; iOS 105 personal rows and live refresh. iOS final inbox memory fence is source/build pending. |
| Business inboxes stayed stale until navigation or reconnect. | Committed invalidation for current authorized staff and live client refresh retaining depth. | Web and Android incoming/edit/delete/retry/relaunch checked. iOS 67-row business check still pending. |
| Sending as a business exposed or substituted the human actor. | Explicit represented sender; private actor persistence; deny conflicting task identity. | API/browser send/edit/delete/reload and native business inbox evidence. Complete delegated native send/reply topic matrix remains. |
| Retried sends could duplicate, lose linkage, block workers or cross account boundaries. | Stable IDs, scoped idempotency, accepted-worker release, current-session fencing and ordered durable outbox. | Lost response and once-only logical message checked on all clients; no unconditional exactly-once transport claim. |
| Never-sent drafts/attachments vanished on restart or promotion interruption. | Existing encrypted stores, durable intent, atomic draft promotion, preserved file IDs. | Android draft/media/account cleanup and iOS interrupted promotion/PDF delivery proved; quota/expiry/failure cleanup matrix remains. |
| Aggregate-person replies silently chose another room and dropped their quote. | Preserve original authorized room/audience, revalidate before upload/send, retain/refuse intent rather than strip quote. | iOS corrected quote checked; web PDF refusal/explicit retry/original context checked. Android old defect confirmed, final 7c reply08 not yet checked. |
| Offline reply from anchored history navigated into an error page or vanished after acceptance. | Local transition to latest; preserve query scope and pending intent without network navigation. | Intermediate failure reproduced; latest cache-present path stayed visible offline and after acceptance. No-latest-cache case and exact integrated production check pending. |
| Group/task read events falsely displayed direct Read; stale cache could preserve it. | Add explicit directReceiptEligible, conservative per-message canonical recovery and queued refresh ownership. | Backend false task event/dev web stayed Sent. Genuine old production false Read is preserved for upgrade proof; newest web/native correction still needs complete artifact checks. |
| Revoked histories or late responses could resurrect encrypted copies. | Access generations, per-page retirement and durable epoch/tombstone work. | Web production first-page/cross-tab/offline reload denial passed. iOS 299 affected room retired while unrelated retained. Final iOS whole-account epoch crash safety and Android sequential-file interruption remain unverified. |
| Native plaintext inbox caches retained message previews. | Reuse account-scoped encrypted chat stores; reject/purge legacy copies. | Android upgrade and native logout/account isolation checked. iOS final generic memory/in-flight inbox fence awaits new artifact. |
| Offline selected-topic metadata/history was absent. | iOS keyed topic windows/metadata within existing encrypted limits. | iOS source frozen in 383, not installed. Android exact 7c gap reproduced and repair not implemented. |
| Offline badge totals were stale after authoritative live updates. | Persist scoped read projection separately from authoritative global/unmuted totals. | Scoped counts checked; Android global authoritative total is still memory-only in one path, requiring account/generation-safe persistence. |
| Long histories grew and scrolling jumped/stalled. | Web virtualization; bounded Android timeline/anchors; iOS 600 accepted rows and bounded delta staging. | Android 600-message repeated prepend/Retry/continuation/Latest passed with 0px measured non-boundary anchor shift. iOS final bound is source only. |
| Media reads/processing were costly or unbounded. | Stream attachments, bounded/coalesced private thumbnails, processing admission, background file reads. | Photo/PDF exchange and PDF viewer checks passed; incoming photo after offline force-kill failed. Persistent encrypted received media, quota/expiry/orphans remain. |
| Socket updates, presence, typing, mute and badges diverged across processes. | Committed signals/authorized fanout, scoped presence, private preference signals, authoritative totals. | Cross-process messages/reactions/topic receipts and foreground preference behavior checked. Failure/scale/provider matrix remains. |
| Push retries could be lost or target the wrong account. | Approved durable ChatPushDelivery jobs, stable eligibility, generic preview/account binding, topic metadata. | Local worker and synthetic account-routing evidence only; physical APNs/FCM and real provider crash/retry boundaries remain unverified. |
| Metric storage and snapshot work grew without bounds. | Fixed 4,096-slot rings with five-minute retention. | Functional bounds checked; production aggregation and p50/p95/p99 measurements are not complete. |
| Security/retention/operations audit had broad unchecked assertions. | Reconcile current code and other sessions before implementing; preserve authorization on every path. | Original audit below is traceability, not proof every feature is missing or authorization for new tables/hosted changes. |

### Backend/database work completed

The stack now includes precise read boundaries, topic-selective reads, mutation recovery, server search/context, paginated personal/business inboxes, complete identity/reaction retrieval, query/badge bounds, cross-process events, room subscription lifecycle guards, private push delivery, explicit business identity, active membership fields and truthful receipt eligibility.

The approved topic protocol was verified with interleaved selected/unselected messages, explicit boundary validation, no room-global event, both read/delete transaction orders, cross-process socket delivery and business-colleague access. Temporary concurrency/staff fixtures were restored/removed. New topic binding #2801 is the remaining newly reproduced gap, not a completed repair claim.

### Web work and real-browser evidence

- Original production tip and later d26/b900/d561 artifacts built successfully. Final 90d production compilation/lint/types and 170-page generation passed with independently traced dependencies and correct local API rewrite.
- Production large-map POST recovery, old-server fallback, search/context, personal/business paging and live refresh were checked. 67 business rows survived head refresh; revoke 67 to 66 and restore 67 retained authorized tail rows.
- Revocation checks included another tab with API blocked, offline cold reload, unrelated history retention, draft retention/recovery and first-page removal in a 532-room recovery (200-message first page, 531 remaining room cursors). Exact temporary membership/message fields were restored.
- Closed-view live inbox previews, delayed older HTTP head versus newer live message, delete reconciliation and delayed old-account response after logout were checked on development source.
- Reply/PDF scenario16: offline queue survived, temporary audience refusal produced no persisted send, explicit Retry after exact restoration produced one message in its original room with quote/PDF. Sender reload and recipient PDF viewer passed; unloaded quote could open bounded original context.
- Anchored offline context17 reproduced the accepted-bubble disappearance; context18 on its repaired cache-present path retained Queued and accepted Read in the latest window. Final missing-latest-cache guard is included in 90d but not app-verified.
- A real task-room read caused old d561 production to cache false Read. That exact browser/cache state is intentionally preserved for upgrading to 90d and proving authorized canonical correction, including held-response and queued-refresh ordering.

### iOS work and real-simulator evidence

- Initial 61f artifact passed sequential sends while HTTP acceptance was held, offline pending restart, counterpart photo/PDF, reactions and read/badge transitions. It remains preserved.
- Later c3/51/299 artifacts progressively verified per-room read masks, encrypted inbox/drafts, atomic promotion interruption with one PDF upload/message, account logout isolation, reply linkage, topic-specific receipts and history retirement.
- Exact 299: vertical scrolling alongside horizontal Mute/Hide actions, 105 loaded inbox rows through live head refresh and offline kill/relaunch, affected-room access removal with unrelated history retained, normal 532-room recovery, accepted-lost response followed by a second send, missed incoming/read recovery and return to the original account all passed. A 32.6-second idle sample made two requests with no history/topic/delta/read/socket-upgrade traffic; it is not a benchmark.
- Final 383 adds encrypted topic metadata/windows, 600-row accepted timeline plus separate pending/failed rows, bounded 1,200-row delta staging, durable cache epochs, Keychain fallback tombstone, explicit receipt eligibility and generation-fenced inbox restoration. Parser/lint/format checks pass; signed build is in flight at handoff and none of these new paths is yet app-verified.
- Epoch retirement intentionally invalidates the whole account's recent history/inbox cache; drafts/outbox remain. Measure the loss of unrelated offline availability. Simultaneous filesystem and Keychain failure is an explicit limit. The planned interruption proof has not started.
- A 720-row older-history fixture was seeded only in the existing owned read-map room for the next timeline check. No new rooms/memberships; manifest is private. Incoming-photo offline retention and native 67-row business QA remain.

### Android work and real-emulator evidence

- Original 806 artifact passed encrypted text/photo/reply/edit draft recovery, atomic promotion, discard/account cleanup, server mute relaunch and older server search. An accepted photo with response/socket/history held recovered as one logical peer message with one upload.
- Later ce/e9/8e artifacts verified responsive 532-room recovery without observed ANR, live/missed edits, 67-row business inbox incoming/edit/delete/Retry/relaunch and improved scoped preview retention.
- Exact 8e: 600-message paging, held prepend, failed page/Retry, continuous continuation, eviction/Latest, offline restart and scoped edit/delete counterpart reload passed. Non-boundary anchor measurements were 0px. Earlier 46px heading shift/stall was repaired separately.
- Exact 7c includes original-room reply preservation, active membership audience checks, per-page access retirement and topic reads. Selected Beta read left Alpha unread; sender full reload preserved Sent/Read.
- Lost topic ACK: one accepted Beta read response was held, app force-stopped, response released after termination; offline relaunch plus metadata-only restoration displayed cached Beta once with history/socket blocked; one topic-read retry, zero global reads, same boundary and one unrelated unread. Sender full reload showed Alpha03 Sent and Beta04/Beta05 Read.
- Stop point: still in Beta with empty composer, no draft/outbox intents, all proxy faults off/no held requests, no debugger attached. Reply08/photo, Android sender-side topic/receipt recovery and interruption during cache retirement have not started.
- Known remaining Android source gaps: encrypted offline topic list/windows, persisting authoritative live global badge totals, explicit false receipt correction (old readAt retention), and durable retirement across process death during sequential file deletion.

## 4. Prioritized remaining work

### P0 — Resume safely and finish the preserved exact-artifact checks

1. Read private operations and per-client handoffs. Inspect Git/worktrees, PR heads/checks, owned ports/processes and local schema. Restore only owned APIs if needed. Current APIs are ba1, not #2801; do not run the docs checkout.
2. Recover the iOS 383 build outcome; preserve its signed artifact with hash if successful, then install without wiping account state. Run topic offline reopen, 600+ timeline/Latest, durable retirement/late inbox response, receipt eligibility, and 67-row business checks. Preserve 299 comparison.
3. Keep web 63107 d561 until the genuine false-Read cache is recorded. Coordinate the isolated 90d replacement at the same origin, then verify cached old Read, held authorized canonical response, correction to Sent, queued older-delta ordering, and reload. Also check anchored offline send with no latest-window cache. Do not use API-only evidence as the UI pass.
4. Continue Android 7c original-room reply08 with photo/PDF, recipient and reload; explicit refusal and recovery; sender-side selected-topic and missed-receipt correction; per-page access loss and process interruption. Keep all fault/membership restoration explicit.
5. #2801: review locking/compatibility, inspect the successful exact CI schema replay/function lint, apply only locally after review, verify invalid room/pair/represented sender and membership races, then valid actual web/iOS/Android topic flows. Migration 20261024002500 is currently absent. Existing migrations must not change.

### P1 — Complete the reproduced reliability/privacy repairs

- Android offline topics and authoritative badge persistence; explicit false receipt/canonical null clearing; crash-durable cache invalidation using existing store/namespace.
- iOS epoch retirement including deletion failure, relaunch and Keychain fallback; reject in-flight pre-retirement inbox results. Measure whole-account offline-cache loss rather than claiming selective retention.
- Web production successful-history-response arriving after access retirement, older-version tab behavior, no-latest-cache pending sends and canonical receipt request ordering. Earlier invalid/inconclusive probes are not passes.
- All clients: queued intent when audience/access changes during a long upload, account changes during recovery, and reply-room revalidation. Preflight alone does not prove a transactional audience guarantee.
- Finish normal and delayed join/leave ownership cases: stale ACK after unsubscribe, immediate resubscribe, exhausted busy retry, permanent denial, overlapping mini/full/business readers. Large normal-scope responsiveness is already established and need not be restarted from scratch.

### P2 — Media, delivery and operational completeness

- Encrypted received-image/media persistence: incoming photo failed after offline force-kill. Verify original/thumbnail authorization, quota, expiry, corrupt/missing file, orphan upload cleanup, cancel/progress/retry and logout purge without exposing another account.
- Outboxes currently recover with foreground execution. Android WorkManager, iOS OS scheduling and browser background sync/service-worker behavior are not complete. Preserve truthful queued/failed states and OS restrictions.
- Durable recipient-device Delivered acknowledgements are not implemented. Server acceptance is Sent. Multi-device delivery semantics and any schema needs must be designed/reviewed; do not invent Delivered from a socket event.
- Push: physical APNs/FCM registration, terminated/background delivery, duplicates, wrong-account delayed notification, tap routing, mute/read/revocation, retry/expiry and crash after provider acceptance. Founder owns hosted credentials/config and physical release steps.
- Reconcile remaining original security audit with current implementation and separate security PRs: reply/topic reference integrity, blocks/revocation on all paths, represented-author ownership, closed task policy, direct RPC grants, media retention, spam/moderation and access-sensitive audit logging. New table/hosted changes need appropriate approval.
- Operations: useful privacy-safe production metrics, aggregation, alerting and incident/rollout/rollback runbooks. Existing rings are bounded local samples, not complete monitoring.

### P3 — CI, integration and release

CI failures remain explicit blockers. Fix actual regressions, distinguish old-contract assertions from product faults, and ask only if necessary work conflicts with the no-test-code instruction. Do not waive a failure merely because an older slice also had it.

Review stacked bases in order, avoid duplicating already-integrated master changes, and preserve older artifact evidence. No stack is authorized to auto-deploy. Hosted migration, provider configuration, physical-phone checks, store release and release authorization remain founder/external gates.

### P4 — Evidence required before a WeChat/WhatsApp-level claim

Do not treat feature count or PR count as parity. At minimum, measure stable builds on representative physical devices and controlled networks, separated from compiler/emulator contention:

| Capability | Evidence still needed |
| --- | --- |
| Instant interaction | Warm/cold thread first useful content and send-to-local-bubble p50/p95/p99; report stalls, device, build and sample count. |
| Delivery speed/reliability | Server acceptance and recipient visibility measured separately; duplicates/loss/order across disconnect, process death and multiple devices. |
| Recovery | Time/bytes/requests for small and large backlog; edits/deletes/reactions/read state converge; no revoked history resurrection. |
| Scale and smoothness | Large inbox/history and attachment bursts; bounded memory/storage/DOM, frame timing, stable scroll anchors, query plans and reconnect storms. |
| Offline/background | Durable drafts/outbox/received media, selected-topic navigation, account boundaries, OS background constraints and truthful failure UI. |
| Privacy and security | Authorization/revocation on every view/download, business identity, retention, notification privacy and review of current threat model. Encrypted local storage is not end-to-end encryption. |
| Product capability | Inventory expected messaging features and identify gaps before adding scope. Calls, E2EE, multi-device history/backup or other competitor features are not proved or promised by this performance/reliability effort. |

Earlier proposed latency targets were hypotheses, not measured results or founder-approved promises. Do not claim the “best chat” or parity until the relevant evidence and product scope exist.

## 5. Contracts to preserve

- Reads use explicit visible per-room boundaries; maximum 500 boundary entries. An empty map reads nothing. A legacy single cursor affects only its room. Invalid/out-of-scope cursors are rejected.
- Topic reads use the separate topic route/event with a visible boundary map. They never emit a room-global ACK. ChatTopicRead, unread totals, per-message receipts, push suppression and deletion reconciliation share the same namespace. Private read_topic_id is omitted from serializers.
- Direct Read requires an eligible direct room and the other member's actual boundary. `directReceiptEligible: false` requires canonical correction; missing flags must remain conservative. Group/task Sent must not imply everyone read it.
- Changes routes support POST with cursor/until maps and optional receipt IDs; use bounded compatibility fallback for older servers. Respect removedRoomIds on every page, resetRequired and current authorization.
- Message revisions recover mutations; immutable creation/read order is distinct. Default insertion time follows the room revision lock.
- Stable retry IDs are bound to room, represented sender and actor. Preserve the reply's original room/audience. Logical deduplication evidence is not an unconditional exactly-once guarantee.
- Current staff access is checked for business fanout; actor identity remains private. Generic push text still requires recipient/account/room authorization.
- Source generation/account checks must fence late network, disk and outbox completions. Preserve pending/failed intent through valid context changes; never silently move it to another account/audience.
- Local encryption is account-scoped storage protection, not E2EE. Do not claim otherwise.

## 6. Applied migrations and the unapplied draft

The local schema is preserved, not reset. The original 17 chat migrations are:

| Version | Purpose |
| --- | --- |
| 20261023120000 | Read boundaries |
| 20261023120100 | Read event time |
| 20261023130000 | Notification preferences |
| 20261023140000 | Incremental revisions/changes |
| 20261023150000 | Search/context |
| 20261023160000 | Committed realtime signals |
| 20261023160100 | Trigger-record follow-up |
| 20261023170000 | Unified inbox pages |
| 20261023180000 | Preview seeks |
| 20261023190000 | Badge/message counts |
| 20261023200000 | Inbox search |
| 20261023210000 | Approved private push-delivery jobs |
| 20261023220000 | Unmuted badges |
| 20261023230000 | Private preference signals |
| 20261023233000 | Room/business pagination |
| 20261023234000 | Insert timestamp after room lock |
| 20261023235000 | Per-room read wrapper |

Also applied and immutable: **20261024001000** approved topic-read state; unchanged upstream **20261023072000** auth-session change signal and **20261023072100** PostGIS client-write guard. Private manifests record hashes and application.

**20261024002500_chat_topic_room_binding.sql (#2801) is UNAPPLIED.** JavaScript syntax, diff and migration policy passed. Function/trigger creation succeeded in a transaction that was rolled back; local plpgsql_check was unavailable. Exact CI run40040499880 subsequently passed fresh schema replay, function lint and SQL contracts, privacy, Docker and safeguards; Jest remained red with 31 failures/6,602 passing/16 skipped. No local runtime behavior or functional race pass is claimed.

## 7. Complete current PR register

The following is a live GitHub metadata snapshot, replacing the old 63-row register. All 131 rows were open drafts at handoff; none was merged/deployed by this session. Exact base/head relationships matter. “Red + running” means failures already exist while other jobs continue. Check results can change after this snapshot.

CI headline:
- Backend ba1 (#2790), run40036282110: **31 failed / 6,602 passed / 16 skipped**, same 31 named failures as cdf; privacy, Docker, schema/SQL contracts and safeguards passed. Integration locally showed four additional nonchat transport failures that all passed a focused 104-case rerun; do not erase the full-run failure.
- Web later slices: **one stats-call expectation failure**, 122 suites/2,382 assertions passed; exact newest #2800 additionally runs integrated backend/native jobs and already has backend/web failures. Exact #2800 classification: web notificationStreams.test.tsx:114 expects two stats calls/observes one; integrated backend authStepUp.test.js:116 rejects a damaged signature inconsistently (341 suites/6,632 passing, 16 skipped). Identity/safeguards passed; native/schema were pending. No repair attempted after freeze.
- Android exact7c (#2789): **14 unique failures / 42 including retries, 5,074 cases, 76 skipped**; same named failures as #2775/#2783/#2785; emulator job passed.
- iOS exact299/#2782 run40033322510: 11 named runtime failures, the same as51 (four conversation attachment/refresh/reply expectations, mute filtering and six old search expectations). Bundle/lint/schema/safeguards passed; runtime/CI failed. Private exact logs classify them. New383 jobs were still running/queued at freeze; never inherit an earlier CI result.
- #2801 run40040499880 completed: 31 failed/6,602 passed/16 skipped, exactly the same failure names as ba1. Privacy, Docker, complete schema replay/function lint/SQL contracts and safeguards passed. Local application/races/apps remain unverified. This updated docs commit still requires fresh check inspection. No tests were written or modified.

| PR | Title | Head / revision | Base | CI snapshot |
| --- | --- | --- | --- | --- |
| [#2665](https://github.com/WangPantopus/skinny-pantopus/pull/2665) | Preserve unseen chat messages and recover precise read receipts | codex/chat-reliability-backend @ 68ce25ea7 | master | Red |
| [#2666](https://github.com/WangPantopus/skinny-pantopus/pull/2666) | Persist chat mute settings and give reads their own request budget | codex/chat-preferences-performance @ 7b917c164 | codex/chat-reliability-backend | Red |
| [#2667](https://github.com/WangPantopus/skinny-pantopus/pull/2667) | fix(ios): merge live chat events and recover complete loaded history | codex/chat-ios-reliability @ b30a2995d | master | Red |
| [#2668](https://github.com/WangPantopus/skinny-pantopus/pull/2668) | fix(android): recover chat gaps and mark only visible messages read | codex/chat-android-reliability @ c6378a091 | master | No failure reported |
| [#2669](https://github.com/WangPantopus/skinny-pantopus/pull/2669) | Fix web chat recovery, deduplication, and visible read receipts | codex/chat-web-reliability @ 899307f41 | master | No failure reported |
| [#2670](https://github.com/WangPantopus/skinny-pantopus/pull/2670) | Catch up cached chat history with commit-ordered message changes | codex/chat-incremental-sync @ 359e62a8e | codex/chat-preferences-performance | Red |
| [#2671](https://github.com/WangPantopus/skinny-pantopus/pull/2671) | Retain encrypted web chat outbox and recent history | codex/chat-web-outbox-cache @ f8f4ac344 | codex/chat-web-reliability | No failure reported |
| [#2672](https://github.com/WangPantopus/skinny-pantopus/pull/2672) | Search complete chat history and open older messages directly | codex/chat-search-context @ 9f2cda8dc | codex/chat-incremental-sync | Red |
| [#2673](https://github.com/WangPantopus/skinny-pantopus/pull/2673) | Stream chat attachments with bounded upload and image processing | codex/chat-streamed-media @ 4113905a8 | codex/chat-search-context | Red |
| [#2674](https://github.com/WangPantopus/skinny-pantopus/pull/2674) | Recover web chat incrementally and bound timeline rendering | codex/chat-web-incremental @ 652225590 | codex/chat-web-outbox-cache | No failure reported |
| [#2675](https://github.com/WangPantopus/skinny-pantopus/pull/2675) | feat(ios): keep encrypted recent chat history and recover outgoing sends | codex/chat-ios-outbox @ b70be8997 | codex/chat-ios-reliability | Red |
| [#2676](https://github.com/WangPantopus/skinny-pantopus/pull/2676) | Deliver committed chat changes across API processes | codex/chat-cross-process-delivery @ 9545b0cd0 | codex/chat-streamed-media | Red |
| [#2677](https://github.com/WangPantopus/skinny-pantopus/pull/2677) | Page chat inboxes without truncating memberships | codex/chat-inbox-pagination @ 45ec1330b | codex/chat-cross-process-delivery | Red |
| [#2678](https://github.com/WangPantopus/skinny-pantopus/pull/2678) | fix(chat): search full history and save notification preferences | codex/chat-web-search-preferences @ 6a22765a3 | codex/chat-web-incremental | Red |
| [#2679](https://github.com/WangPantopus/skinny-pantopus/pull/2679) | Preserve chat cache through authorization outages and seek room previews | codex/chat-query-resilience @ d15414c44 | codex/chat-inbox-pagination | Red |
| [#2680](https://github.com/WangPantopus/skinny-pantopus/pull/2680) | Reconcile chat badges across processes without recounting message history | codex/chat-badge-reconciliation @ 5ac4870a6 | codex/chat-query-resilience | Red |
| [#2681](https://github.com/WangPantopus/skinny-pantopus/pull/2681) | feat(android): encrypt recent chat history and synchronize mute preferences | codex/android-chat-storage @ dbaf96578 | codex/chat-android-reliability | Red |
| [#2682](https://github.com/WangPantopus/skinny-pantopus/pull/2682) | Paginate and bound both web conversation lists | codex/chat-web-inbox-pagination @ bb117ca31 | codex/chat-web-search-preferences | Red |
| [#2683](https://github.com/WangPantopus/skinny-pantopus/pull/2683) | Search conversations beyond the loaded inbox page | codex/chat-inbox-search @ cad45f630 | codex/chat-badge-reconciliation | Red |
| [#2684](https://github.com/WangPantopus/skinny-pantopus/pull/2684) | Preserve cookie host for local web chat sockets | codex/chat-web-loopback-socket @ 3ebd17a00 | codex/chat-web-inbox-pagination | Red |
| [#2685](https://github.com/WangPantopus/skinny-pantopus/pull/2685) | Enable edit and delete in existing web chat controls | codex/chat-web-message-actions @ 031208a91 | codex/chat-web-loopback-socket | Red |
| [#2686](https://github.com/WangPantopus/skinny-pantopus/pull/2686) | feat(android): persist encrypted outgoing chats and ordered retries | codex/android-chat-outbox @ 0c12aff4f | codex/android-chat-storage | Red |
| [#2687](https://github.com/WangPantopus/skinny-pantopus/pull/2687) | Recover chat push delivery after server interruption | codex/chat-durable-push @ f7b996bd8 | codex/chat-inbox-search | Red |
| [#2688](https://github.com/WangPantopus/skinny-pantopus/pull/2688) | fix(web): queue shared chat cards through the durable outbox | codex/chat-web-share-outbox @ 70c3a2521 | codex/chat-web-message-actions | Red |
| [#2689](https://github.com/WangPantopus/skinny-pantopus/pull/2689) | Compute muted chat badges across the complete inbox | codex/chat-muted-badges @ 87fd7bc2f | codex/chat-durable-push | Red |
| [#2690](https://github.com/WangPantopus/skinny-pantopus/pull/2690) | Bind delayed chat pushes to the intended account | codex/chat-push-account-binding @ e2fe0b460 | codex/chat-muted-badges | Red |
| [#2691](https://github.com/WangPantopus/skinny-pantopus/pull/2691) | fix(android): deduplicate chat pushes and enforce recipient scope | codex/android-chat-push @ 045f6a992 | codex/android-chat-outbox | Red |
| [#2692](https://github.com/WangPantopus/skinny-pantopus/pull/2692) | fix(web): preserve newer reactions across delayed acknowledgments | codex/chat-web-reaction-recovery @ 11ea75ae9 | codex/chat-web-share-outbox | Red |
| [#2693](https://github.com/WangPantopus/skinny-pantopus/pull/2693) | fix(ios): bind chat notifications to their recipient account | codex/chat-ios-notification-account @ ea7d1177a | codex/chat-ios-outbox | Red |
| [#2694](https://github.com/WangPantopus/skinny-pantopus/pull/2694) | fix(web): exclude muted chats from the global unread badge | codex/chat-web-muted-badge @ aa4e7222b | codex/chat-web-reaction-recovery | Red |
| [#2695](https://github.com/WangPantopus/skinny-pantopus/pull/2695) | Reuse private thumbnails and bound image processing | codex/chat-thumbnail-cache @ 63ff8dca2 | codex/chat-push-account-binding | Red |
| [#2696](https://github.com/WangPantopus/skinny-pantopus/pull/2696) | perf(android): recover chat revisions and stream queued attachments | codex/android-chat-recovery @ 2f81e2f3a | codex/android-chat-push | Red |
| [#2697](https://github.com/WangPantopus/skinny-pantopus/pull/2697) | perf(web): use bounded previews for chat images | codex/chat-web-image-previews @ 7d3bba85b | codex/chat-web-muted-badge | Red |
| [#2698](https://github.com/WangPantopus/skinny-pantopus/pull/2698) | Keep delayed chat push previews private across account switches | codex/chat-push-private-previews @ b812789d8 | codex/chat-thumbnail-cache | Red |
| [#2699](https://github.com/WangPantopus/skinny-pantopus/pull/2699) | Keep older person conversations accessible beyond 1,000 memberships | codex/chat-person-room-scope @ 3ae0768bd | codex/chat-push-private-previews | Red |
| [#2700](https://github.com/WangPantopus/skinny-pantopus/pull/2700) | fix(android): encrypt inbox previews and page unread conversations | codex/android-chat-inbox @ 66c94ad0e | codex/android-chat-recovery | Red |
| [#2701](https://github.com/WangPantopus/skinny-pantopus/pull/2701) | Relay typing across API processes with current chat authorization | codex/chat-typing-relay @ a56d8cc8f | codex/chat-person-room-scope | Red |
| [#2702](https://github.com/WangPantopus/skinny-pantopus/pull/2702) | Coordinate chat retry recovery across browser tabs | codex/chat-web-outbox-coordination @ b05536bf2 | codex/chat-web-image-previews | Red |
| [#2703](https://github.com/WangPantopus/skinny-pantopus/pull/2703) | feat(android): search chat history and open older message context | codex/android-chat-search @ 5b83229b8 | codex/android-chat-inbox | Red |
| [#2704](https://github.com/WangPantopus/skinny-pantopus/pull/2704) | fix(android): synchronize chat preferences and clarify queued status | codex/android-chat-session-polish @ d209698c7 | codex/android-chat-search | Red |
| [#2705](https://github.com/WangPantopus/skinny-pantopus/pull/2705) | Synchronize private chat mute settings across devices | codex/chat-preference-signals @ c3d9dc90c | codex/chat-typing-relay | Red |
| [#2706](https://github.com/WangPantopus/skinny-pantopus/pull/2706) | Bound chat latency metric memory and snapshot work | codex/chat-metrics-bounds @ 63378f186 | codex/chat-preference-signals | Red |
| [#2707](https://github.com/WangPantopus/skinny-pantopus/pull/2707) | Synchronize chat typing and mute controls across devices | codex/chat-web-live-preferences @ 37f286575 | codex/chat-web-outbox-coordination | Red |
| [#2708](https://github.com/WangPantopus/skinny-pantopus/pull/2708) | Keep outgoing chat workers isolated across account sessions | codex/chat-web-session-worker @ d2a86ab2e | codex/chat-web-live-preferences | Red |
| [#2709](https://github.com/WangPantopus/skinny-pantopus/pull/2709) | fix(ios): preserve authoritative chat badges and live presence | codex/chat-ios-live-state @ 2077e39fd | codex/chat-ios-notification-account | Red |
| [#2710](https://github.com/WangPantopus/skinny-pantopus/pull/2710) | fix(ios): unblock queued sends after socket acceptance | codex/chat-ios-outbox-flow @ fc88a6058 | codex/chat-ios-live-state | Red |
| [#2711](https://github.com/WangPantopus/skinny-pantopus/pull/2711) | feat(android): preserve encrypted chat drafts and selected files | codex/android-chat-drafts @ bee7190a3 | codex/android-chat-session-polish | Red |
| [#2712](https://github.com/WangPantopus/skinny-pantopus/pull/2712) | Keep chat presence accurate across devices and API processes | codex/chat-presence-relay @ d8be1ea7d | codex/chat-metrics-bounds | Red |
| [#2713](https://github.com/WangPantopus/skinny-pantopus/pull/2713) | fix(android): clear stale chat presence after disconnect | codex/android-chat-presence @ 206530f2c | codex/android-chat-drafts | Red |
| [#2714](https://github.com/WangPantopus/skinny-pantopus/pull/2714) | perf(ios): use bounded chat previews and background file reads | codex/chat-ios-media-latency @ 61fdfbabf | codex/chat-ios-outbox-flow | Red |
| [#2715](https://github.com/WangPantopus/skinny-pantopus/pull/2715) | perf(android): bound chat timeline memory while preserving scroll position | codex/android-chat-window @ e5a91ced2 | codex/android-chat-presence | Red |
| [#2716](https://github.com/WangPantopus/skinny-pantopus/pull/2716) | fix(android): promote encrypted drafts with an atomic folder move | codex/android-chat-draft-promotion @ 806a45c35 | codex/android-chat-window | Red |
| [#2717](https://github.com/WangPantopus/skinny-pantopus/pull/2717) | Keep active older conversations in paginated room and business inboxes | codex/chat-room-pagination @ cbd4ff797 | codex/chat-presence-relay | Red |
| [#2718](https://github.com/WangPantopus/skinny-pantopus/pull/2718) | Keep delayed chat inserts beyond earlier read boundaries | codex/chat-insert-order @ a64ce681e | codex/chat-room-pagination | No failure reported |
| [#2719](https://github.com/WangPantopus/skinny-pantopus/pull/2719) | Retain encrypted web chat drafts and attachment intent | codex/chat-web-composer-drafts @ fa7570d07 | codex/chat-web-session-worker | Red |
| [#2720](https://github.com/WangPantopus/skinny-pantopus/pull/2720) | fix(ios): encrypt saved conversation list previews | codex/chat-ios-encrypted-inbox @ 795f9ada6 | codex/chat-ios-media-latency | Red |
| [#2721](https://github.com/WangPantopus/skinny-pantopus/pull/2721) | Keep unseen chat rooms unread with per-room visible boundaries | codex/chat-room-read-boundaries @ 1bd0f282b | codex/chat-insert-order | Red |
| [#2722](https://github.com/WangPantopus/skinny-pantopus/pull/2722) | Preserve explicit business identity when sending group messages | codex/chat-business-sender @ 360302925 | codex/chat-room-read-boundaries | Red |
| [#2723](https://github.com/WangPantopus/skinny-pantopus/pull/2723) | Page existing web business inboxes with authoritative totals | codex/chat-web-business-paging @ 586caddba | codex/chat-web-composer-drafts | Red |
| [#2724](https://github.com/WangPantopus/skinny-pantopus/pull/2724) | fix(ios): synchronize chat mute preferences and unread badges | codex/chat-ios-server-mute @ 9221185ef | codex/chat-ios-encrypted-inbox | Red |
| [#2725](https://github.com/WangPantopus/skinny-pantopus/pull/2725) | Keep large person conversations within history and sync transport limits | codex/chat-large-conversation-sync @ 04561fef6 | codex/chat-business-sender | Red |
| [#2726](https://github.com/WangPantopus/skinny-pantopus/pull/2726) | Acknowledge visible room boundaries and show direct room receipts | codex/chat-web-visible-room-reads @ acc62f25b | codex/chat-web-business-paging | Red |
| [#2727](https://github.com/WangPantopus/skinny-pantopus/pull/2727) | Return complete reaction summaries across REST, sockets and reconnects | codex/chat-reaction-pages @ 10499de4d | codex/chat-large-conversation-sync | Red |
| [#2728](https://github.com/WangPantopus/skinny-pantopus/pull/2728) | fix(ios): acknowledge visible chat rooms independently | codex/chat-ios-visible-room-reads @ 96e30c481 | codex/chat-ios-server-mute | Red |
| [#2729](https://github.com/WangPantopus/skinny-pantopus/pull/2729) | Retain room counterparts and mute preferences across large chat scopes | codex/chat-room-people-pages @ 3450b928c | codex/chat-reaction-pages | Red + running |
| [#2730](https://github.com/WangPantopus/skinny-pantopus/pull/2730) | Keep reconnect room-join bursts from exhausting chat API capacity | codex/chat-join-admission @ bcc86e65d | codex/chat-room-people-pages | Red + running |
| [#2731](https://github.com/WangPantopus/skinny-pantopus/pull/2731) | fix(android): mark only visible rooms read in person conversations | codex/android-chat-visible-room-reads @ d0c14af57 | codex/android-chat-draft-promotion | Red |
| [#2732](https://github.com/WangPantopus/skinny-pantopus/pull/2732) | fix(android): recover chat changes without oversized cursor URLs | codex/android-chat-post-sync @ 9cb0b88a1 | codex/android-chat-visible-room-reads | Red |
| [#2733](https://github.com/WangPantopus/skinny-pantopus/pull/2733) | Bound web chat reconnect and move cursor recovery to POST | codex/chat-web-bounded-reconnect @ 2ea811177 | codex/chat-web-visible-room-reads | Red |
| [#2735](https://github.com/WangPantopus/skinny-pantopus/pull/2735) | Page group membership for complete chat delivery | codex/chat-large-group-delivery @ 77b6a3726 | codex/chat-join-admission | Red + running |
| [#2736](https://github.com/WangPantopus/skinny-pantopus/pull/2736) | fix(android): page existing business inbox conversations | codex/android-chat-business-paging @ 1d7d76971 | codex/android-chat-post-sync | Red |
| [#2737](https://github.com/WangPantopus/skinny-pantopus/pull/2737) | fix(android): preserve encrypted inbox navigation after chat writes | codex/android-chat-inbox-offline-retention @ e3fdd7d1d | codex/android-chat-business-paging | Red |
| [#2738](https://github.com/WangPantopus/skinny-pantopus/pull/2738) | Read complete large-group members and their public identities | codex/chat-identity-batches @ b5d780d05 | codex/chat-large-group-delivery | Red + running |
| [#2739](https://github.com/WangPantopus/skinny-pantopus/pull/2739) | Bound business identity lookups when opening web chat rooms | codex/chat-web-business-access-bounds @ 4c4d50e4b | codex/chat-web-bounded-reconnect | Red |
| [#2740](https://github.com/WangPantopus/skinny-pantopus/pull/2740) | Use the current authorized inbox reader for chat socket startup | codex/chat-socket-startup-page @ d080afd82 | codex/chat-identity-batches | Red + running |
| [#2741](https://github.com/WangPantopus/skinny-pantopus/pull/2741) | Bound room history previews while retaining complete conversation access | codex/chat-web-bounded-room-preview @ ae993decf | codex/chat-web-business-access-bounds | Red |
| [#2742](https://github.com/WangPantopus/skinny-pantopus/pull/2742) | fix(ios): recover chat changes through bounded POST snapshots | codex/chat-ios-post-delta @ f30d52514 | codex/chat-ios-visible-room-reads | Red |
| [#2743](https://github.com/WangPantopus/skinny-pantopus/pull/2743) | fix(ios): load older inbox conversation pages | codex/chat-ios-inbox-pages @ af9e5d6a8 | codex/chat-ios-post-delta | Red |
| [#2744](https://github.com/WangPantopus/skinny-pantopus/pull/2744) | Refresh business inboxes after committed chat changes | codex/chat-business-invalidation @ a5efe49c1 | codex/chat-socket-startup-page | Red + running |
| [#2745](https://github.com/WangPantopus/skinny-pantopus/pull/2745) | fix(android): preserve older-history anchors and return to the latest message | codex/android-chat-prepend-anchor @ 228b6d393 | codex/android-chat-inbox-offline-retention | Red |
| [#2746](https://github.com/WangPantopus/skinny-pantopus/pull/2746) | Preserve loaded inbox depth through authorized window revalidation | codex/chat-web-authorized-inbox-window @ d26d57c5e | codex/chat-web-bounded-room-preview | Red |
| [#2747](https://github.com/WangPantopus/skinny-pantopus/pull/2747) | Record resumed chat repairs and exact artifact verification gaps | codex/chat-resume-checkpoint @ 393ae9a77 | codex/chat-business-invalidation | No failure reported |
| [#2748](https://github.com/WangPantopus/skinny-pantopus/pull/2748) | fix(ios): search older chat messages with bounded context | codex/chat-ios-server-search @ 26ea5d864 | codex/chat-ios-inbox-pages | Red |
| [#2749](https://github.com/WangPantopus/skinny-pantopus/pull/2749) | fix(ios): preserve encrypted inbox paging snapshot | codex/chat-ios-inbox-cache-pages @ 411d64bc5 | codex/chat-ios-server-search | Red |
| [#2750](https://github.com/WangPantopus/skinny-pantopus/pull/2750) | fix(android): persist confirmed scoped unread counts | codex/android-chat-saved-read-projection @ 96fe3a077 | codex/android-chat-prepend-anchor | Red |
| [#2751](https://github.com/WangPantopus/skinny-pantopus/pull/2751) | feat(ios): retain encrypted composer drafts and promote sends atomically | codex/chat-ios-encrypted-drafts @ 38aae7fbe | codex/chat-ios-inbox-cache-pages | Red |
| [#2752](https://github.com/WangPantopus/skinny-pantopus/pull/2752) | feat(ios): page and revalidate business inbox depth | codex/chat-ios-business-inbox-pages @ 6452b4abe | codex/chat-ios-encrypted-drafts | Red |
| [#2753](https://github.com/WangPantopus/skinny-pantopus/pull/2753) | fix(ios): revalidate loaded personal inbox depth | codex/chat-ios-inbox-refresh-depth @ 3357edcad | codex/chat-ios-business-inbox-pages | Red |
| [#2754](https://github.com/WangPantopus/skinny-pantopus/pull/2754) | Bound iOS chat room subscription recovery | codex/chat-ios-bounded-room-joins @ d185f2e4f | codex/chat-ios-inbox-refresh-depth | Red |
| [#2755](https://github.com/WangPantopus/skinny-pantopus/pull/2755) | fix(android): bound room joins and batch chat backfill projection | codex/android-chat-bounded-room-joins @ ce782760d | codex/android-chat-saved-read-projection | Red |
| [#2757](https://github.com/WangPantopus/skinny-pantopus/pull/2757) | Retire revoked chat history across cached web views | codex/chat-web-revoked-history @ 21f52cb56 | codex/chat-web-authorized-inbox-window | Red |
| [#2758](https://github.com/WangPantopus/skinny-pantopus/pull/2758) | fix(chat): cancel room subscriptions without leaving newer joins | codex/chat-room-subscription-lifecycle @ 9cf832b64 | codex/chat-business-invalidation | Red + running |
| [#2759](https://github.com/WangPantopus/skinny-pantopus/pull/2759) | fix(android): refresh visible business inboxes without losing loaded pages | codex/android-chat-business-live-refresh @ e9e39afd4 | codex/android-chat-bounded-room-joins | Red |
| [#2760](https://github.com/WangPantopus/skinny-pantopus/pull/2760) | Persist accepted iOS conversation read counts offline | codex/chat-ios-saved-read-projection @ c3e42208f | codex/chat-ios-bounded-room-joins | Red |
| [#2762](https://github.com/WangPantopus/skinny-pantopus/pull/2762) | Keep topic read boundaries separate across unread, receipts and push | codex/chat-topic-read-protocol @ a542ab8db | codex/chat-room-subscription-lifecycle | Red + running |
| [#2763](https://github.com/WangPantopus/skinny-pantopus/pull/2763) | Release shared web chat room subscriptions safely | codex/chat-web-room-subscriptions @ 0f98a177e | codex/chat-web-revoked-history | Red |
| [#2764](https://github.com/WangPantopus/skinny-pantopus/pull/2764) | Retire revoked chat history on every recovery page | codex/chat-web-delta-access-retirement @ d2554a0a7 | codex/chat-web-room-subscriptions | Red |
| [#2765](https://github.com/WangPantopus/skinny-pantopus/pull/2765) | Acknowledge visible chat topics and recover selected receipts | codex/chat-web-topic-read @ b900547c6 | codex/chat-web-delta-access-retirement | Red |
| [#2766](https://github.com/WangPantopus/skinny-pantopus/pull/2766) | fix(android): retain unaffected offline inbox after chat edits | codex/android-chat-scoped-preview-retention @ 460de982c | codex/android-chat-business-live-refresh | Red |
| [#2768](https://github.com/WangPantopus/skinny-pantopus/pull/2768) | fix(android): continue chat paging after prepend settles | codex/android-chat-prepend-continuation @ 8e4fe7ad0 | codex/android-chat-scoped-preview-retention | Red |
| [#2769](https://github.com/WangPantopus/skinny-pantopus/pull/2769) | fix(ios): preserve reply linkage without changing audience | codex/chat-ios-reply-audience @ f25522709 | codex/chat-ios-saved-read-projection | Red |
| [#2770](https://github.com/WangPantopus/skinny-pantopus/pull/2770) | fix(ios): allow vertical inbox scrolling alongside row actions | codex/chat-ios-inbox-scroll @ 7cc500012 | codex/chat-ios-reply-audience | Red |
| [#2771](https://github.com/WangPantopus/skinny-pantopus/pull/2771) | fix(ios): activate chat delta recovery with history cursors | codex/chat-ios-history-sync @ db58024a3 | codex/chat-ios-inbox-scroll | Red |
| [#2772](https://github.com/WangPantopus/skinny-pantopus/pull/2772) | fix(ios): acknowledge visible topics and recover message receipts | codex/chat-ios-topic-read-scope @ 51cddb638 | codex/chat-ios-history-sync | Red |
| [#2773](https://github.com/WangPantopus/skinny-pantopus/pull/2773) | Include current topic in generic chat push metadata | codex/chat-push-topic-metadata @ b59767d2c | codex/chat-topic-read-protocol | Red + running |
| [#2774](https://github.com/WangPantopus/skinny-pantopus/pull/2774) | Keep chat inbox previews current while views are closed | codex/chat-web-account-inbox-events @ 4a688552f | codex/chat-web-topic-read | Red |
| [#2775](https://github.com/WangPantopus/skinny-pantopus/pull/2775) | fix(android): preserve original room for queued chat replies | codex/android-chat-reply-room-preservation @ 56aba3e02 | codex/android-chat-prepend-continuation | Red |
| [#2776](https://github.com/WangPantopus/skinny-pantopus/pull/2776) | fix(ios): recover aggregate room read receipts conservatively | codex/chat-ios-aggregate-receipts @ bb96ad896 | codex/chat-ios-topic-read-scope | Red |
| [#2777](https://github.com/WangPantopus/skinny-pantopus/pull/2777) | Expose active membership for safe reply-room validation | codex/chat-room-active-members @ cdfb189ab | codex/chat-push-topic-metadata | Red + running |
| [#2779](https://github.com/WangPantopus/skinny-pantopus/pull/2779) | fix(ios): retire history on receipt access changes | codex/chat-ios-receipt-access @ 79a9d848a | codex/chat-ios-aggregate-receipts | Red |
| [#2780](https://github.com/WangPantopus/skinny-pantopus/pull/2780) | Keep aggregate chat replies in their original authorized room | codex/chat-web-reply-original-room @ d561bb25e | codex/chat-web-account-inbox-events | Red |
| [#2781](https://github.com/WangPantopus/skinny-pantopus/pull/2781) | fix(ios): require active membership before preserving replies | codex/chat-ios-reply-active-membership @ 00e5d40e3 | codex/chat-ios-receipt-access | Red |
| [#2782](https://github.com/WangPantopus/skinny-pantopus/pull/2782) | fix(ios): reject vertical motion before inbox swipe recognition | codex/chat-ios-directional-swipe @ 299f5e233 | codex/chat-ios-reply-active-membership | Red |
| [#2783](https://github.com/WangPantopus/skinny-pantopus/pull/2783) | Retire Android room access on each recovery page | codex/android-chat-delta-revocation @ 5504566cd | codex/android-chat-reply-room-preservation | Red |
| [#2784](https://github.com/WangPantopus/skinny-pantopus/pull/2784) | Keep unloaded reply context visible and permit reviewed retries | codex/chat-web-reply-context-retry @ e93d1b61f | codex/chat-web-reply-original-room | Red |
| [#2785](https://github.com/WangPantopus/skinny-pantopus/pull/2785) | Scope Android topic reads and recover message receipts | codex/android-chat-topic-reads @ b43fa3598 | codex/android-chat-delta-revocation | Red |
| [#2786](https://github.com/WangPantopus/skinny-pantopus/pull/2786) | chore(ios): integrate current master into chat reliability stack | codex/chat-ios-master-integration @ c3cf94647 | codex/chat-ios-directional-swipe | Running |
| [#2787](https://github.com/WangPantopus/skinny-pantopus/pull/2787) | Integrate current master security with chat recovery | codex/chat-master-security-integration @ 0de454155 | codex/chat-room-active-members | Red |
| [#2788](https://github.com/WangPantopus/skinny-pantopus/pull/2788) | Require direct-room eligibility for live chat receipts | codex/chat-web-direct-receipt-eligibility @ a38026ce1 | codex/chat-web-reply-context-retry | Red |
| [#2789](https://github.com/WangPantopus/skinny-pantopus/pull/2789) | Integrate master before the next Android chat artifact | codex/android-chat-master-integration @ 7c2dcb7d9 | codex/android-chat-topic-reads | Red + running |
| [#2790](https://github.com/WangPantopus/skinny-pantopus/pull/2790) | Identify direct-pair read events for truthful client receipts | codex/chat-direct-receipt-eligibility @ ba1a00e3d | codex/chat-master-security-integration | Red + running |
| [#2791](https://github.com/WangPantopus/skinny-pantopus/pull/2791) | fix(ios): retain encrypted topic history for offline reopening | codex/chat-ios-offline-topics @ 8391341fc | codex/chat-ios-master-integration | Running |
| [#2792](https://github.com/WangPantopus/skinny-pantopus/pull/2792) | Keep queued context replies visible while offline | codex/chat-web-context-send-offline @ daf7a7e25 | codex/chat-web-direct-receipt-eligibility | Red |
| [#2793](https://github.com/WangPantopus/skinny-pantopus/pull/2793) | Revalidate ineligible receipts with queued canonical history | codex/chat-web-canonical-receipt-recovery @ e406daca8 | codex/chat-web-context-send-offline | Red |
| [#2794](https://github.com/WangPantopus/skinny-pantopus/pull/2794) | Bound iOS retained chat history and reconnect staging | codex/chat-ios-bounded-timeline @ 8956664c0 | codex/chat-ios-offline-topics | Running |
| [#2796](https://github.com/WangPantopus/skinny-pantopus/pull/2796) | Keep context replies visible through offline send acceptance | codex/chat-web-local-context-transition @ 5fc637139 | codex/chat-web-canonical-receipt-recovery | Red |
| [#2797](https://github.com/WangPantopus/skinny-pantopus/pull/2797) | Durably retire revoked iOS chat cache epochs | codex/chat-ios-history-retirement @ 68c28abdd | codex/chat-ios-bounded-timeline | Running |
| [#2798](https://github.com/WangPantopus/skinny-pantopus/pull/2798) | Honor explicit iOS chat receipt eligibility | codex/chat-ios-receipt-eligibility @ 045fc9d20 | codex/chat-ios-history-retirement | Running |
| [#2799](https://github.com/WangPantopus/skinny-pantopus/pull/2799) | Fence retired iOS inbox memory and in-flight snapshots | codex/chat-ios-retired-inbox-fence @ 3837b1f96 | codex/chat-ios-receipt-eligibility | Running |
| [#2800](https://github.com/WangPantopus/skinny-pantopus/pull/2800) | Integrate current master with the chat reliability web build | codex/chat-web-master-integration @ 90d453f1d | codex/chat-web-local-context-transition | Red + running |
| [#2801](https://github.com/WangPantopus/skinny-pantopus/pull/2801) | Bind chat topics to their displayed pair and current room | codex/chat-topic-room-binding @ 7239311c2 | codex/chat-direct-receipt-eligibility | Red |

## 8. Worktrees, runtime recovery and private evidence

| Ownership | Existing worktree suffix | Handoff role |
| --- | --- | --- |
| Root documentation / next backend draft | d378/skinny-pantopus | `codex/chat-resume-checkpoint`; #2801 branch preserved separately. |
| Running backend | 3d6c/skinny-pantopus | Clean `codex/chat-direct-receipt-eligibility` ba1; APIs63100/63102. |
| Web | chat-web-reliability/skinny-pantopus | Tracked source clean at `codex/chat-web-master-integration`90d; generated .next-* directories intentionally untracked. |
| iOS source | chat-ios-outbox/skinny-pantopus | Clean `codex/chat-ios-retired-inbox-fence`383. |
| iOS build | chat-ios-reliability/skinny-pantopus | Detached383 signed simulator build; preserve299 installed. |
| Android source | android-chat-storage/skinny-pantopus | Clean `codex/android-chat-master-integration`7c. |
| Android build | chat-android-reliability/skinny-pantopus | Detached7c, successful APK and emulator5590. |

All suffixes are beneath `~/.codex/worktrees/`. Do not touch unrelated worktrees or processes.

Private directory: `~/.config/pantopus/chat-reliability-20261023/`. Read **HANDOFF-OPERATIONS.md** first. It contains exact launch commands, ports/PIDs, local fixture/auth locations, fault-control state, artifact paths, restoration manifests and chronological evidence. Per-client final handoffs are WEB-HANDOFF-20261023-90d.md, ios-final-handoff.md, and android-handoff-current.md; each includes exact PR bases/heads/CI and recovery details. Never copy raw private files to Git or PRs.

Runtime at freeze: local Supabase API63001/database63002/mail63004; owned APIs63100/63102 ba1 with hosted providers/cron/pgboss disabled; iOS proxy63105 and Android proxy63108 with faults off; old production web63101 d26 and63107 d561; dev63109 latest90d. Temporary90d production probe63110 was stopped. Check process ownership and health before restart.

Important preserved checkpoints:
- Old production false-Read cache in the peer's browser tab at63107, deliberately API-blocked. Do not log out, clear storage, or replace origin prematurely. Exact tab/current synthetic markers and upgrade procedure are private.
- Web original-room PDF refusal/retry16 and context18 evidence; final no-cache and held-history races remain pending.
- Android lost topic ACK05 finished with sender reload mask Alpha03 Sent/Beta04+05 Read. All fault flags off, no held responses, empty composer/outbox/drafts.
- iOS383 source frozen; planned permissions/interruption QA was **not started**. Existing720-row fixture is data for later QA, not proof.
- Exact temporary memberships/staff and prior message edits were restored. The malformed topic probe message was soft-deleted via existing API. Large synthetic fixtures remain intentionally for reuse.
- Passive root receipt observer was disconnected at final handoff; no hosted provider delivery is active.

## 9. Copy-paste prompt for the next session

~~~text
Resume the Pantopus Messages/Chat performance and reliability work. Do not start over.

Read AGENTS.md, NEXT_STEPS.md, the current mobile pilot brief, and the latest handoff at:
 /Users/yingpengwang/.codex/worktrees/d378/skinny-pantopus/docs/chat-performance-handoff-2026-10-23.md
Read the local-only recovery notes:
 ~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md
Follow their final per-client handoffs and private artifact/fixture manifests.

Reuse the existing worktrees, artifacts and 131 stacked draft PRs (original63 plus68 resumed, through#2801; the register excludes other sessions' PRs). Inspect current Git, PR, CI, process and database state first. d378 is the docs checkout; APIs63100/63102 currently run ba1a00e3d from3d6c.

Preserve current design, navigation and launch flags. Do not write test code, unit tests or coverage work. Verify actual browser, iOS simulator and Android emulator flows against the real local backend/database, including the other person's view, reload/relaunch, offline recovery, lost responses, account/access changes and attachments. Keep secrets, raw logs, tokens and personal data out of Git/PRs/chat.

Start at the final checkpoint, not the original startup list: recover the iOS3837b1f96 build and verify its new cache/topic/timeline/receipt behavior; preserve the old63107 false-Read cache and finish the90d453f1d production upgrade/canonical-receipt and no-latest-cache checks; continue installed Android7c2dcb7d9 reply/media/access-interruption checks. Finish and verify #2801 topic/room binding, whose migration20261024002500 is committed but UNAPPLIED. Then follow the prioritized remaining repairs, media/background/delivery work, CI resolution and controlled measurements.

Encrypted account-scoped history, ChatPushDelivery and ChatTopicRead are approved. Applied migrations through20261023235000,20261024001000, and upstream20261023072000/20261023072100 are immutable. Do not change hosted services or merge an auto-deploying backend stack without founder release authorization. New tables still require approval.

Commit/push coherent changes and open/update small stacked drafts. Keep CI failures and verification gaps explicit; distinguish source implemented, exact artifact verified, CI green and released. You may use three parallel client agents in separate existing worktrees. Continue the remaining authorized repairs and real-app verification; do not claim WeChat/WhatsApp parity, durable Delivered, or end-to-end encryption without measured/implemented evidence. Keep this handoff current and identify concrete founder-owned/external blockers rather than silently treating them as complete.
~~~

## Historical resumed checkpoints — superseded by the final checkpoint above

These dated observations preserve the investigation sequence. Their old “next” instructions, counts, runtime state and source-only labels are historical; use sections1–9 above to resume.

## Resumed checkpoint — October 23, 19:51 UTC

This checkpoint records ongoing work, not completion or release approval. The existing worktrees, original 63 drafts, database and built artifacts were reused. The fetched master revision was `1ea400a117b1f9321f1b901e691b9e7436c9a061`. All 17 recorded chat migrations remain unchanged. Both owned local API processes are healthy on backend source `a5efe49c1`. No hosted database/configuration change or backend merge was performed.

### Recovered baseline and actual-app evidence

- **Reaction checkpoint #2727:** the consolidated helper returned all 1,600 reactions through REST and room-join backfill. Adding/removing a literal `toString` value produced 1,601/1,600 entries with correct requesting-person state. Cross-process/reconnect delivery and native iOS, Android and browser reaction controls were checked, including counterpart reload/relaunch.
- **iOS `61fdfbabf`:** preserved, installed and verified the already-completed signed artifact. Three sequential sends completed while accepted HTTP responses were held; socket acceptance released each outgoing worker. The browser received each once. Offline pending work survived force-kill and recovered once. PDF and photo counterpart checks, reaction persistence and the visible-read/badge transition passed. A 37-second foreground idle observation produced no history/topics/send/upload requests; this is a local observation, not a performance benchmark.
- **Android `806a45c35`:** encrypted text/photo/reply/edit draft recovery, atomic media promotion, discard and account cleanup passed in the actual emulator. A photo accepted while responses and socket/history delivery were held survived force-stop/retry: two send requests, one upload and one logical message in the peer browser after reload. Logout removed the account's outbox and screen copies; switching accounts and returning did not resurrect discarded or pending work. Server mute survived relaunch. Actual search found an unloaded old message in a 600-message conversation.
- **Web `acc62f25b`:** the complete original tip built successfully for production with 170 pages. Later fixes through `d26d57c5e` have real-browser checks on the development runtime; that exact production build is in progress at this checkpoint.
- **Large recovery:** the old browser path reproduced a 24,055-character changes URL and an uncontrolled room-join burst. The new browser recovered a 532-room scope using a 90-character POST URL, paged 200/200/131 changes, recovered an edit and removed a deleted message. Browser joins were bounded to four. Old-server 404/405 fallbacks were exercised with faults removed afterward.
- **Large groups:** the repaired room response included all 1,032 members. Both browser accounts sent, edited and reacted, and agreed after reload; a member beyond the former cap retained the Local Profile alias. The UI does not expose a member list, so the exact member count is response evidence rather than a UI count. A prior missed-delivery claim was not reproduced reliably and is not asserted.
- **Business/personal inboxes:** the browser retained 67 business rows through live messages and refresh, removed revoked membership, and canceled delayed work during logout/account change. Personal loaded depth and revocation were also checked. A business live-invalidation defect was reproduced and repaired: after the fix a peer message updated the open preview without reload/reconnect while all 67 rows stayed visible.
- **Room preview:** the existing preview now requests 50 messages, within the server limit. Its existing full-conversation link remains available even when the current room occupies the preview page, and server search opens older history outside that preview.

### Regressions found during verification

- Android `806a45c35` discarded its encrypted inbox copy after an ordinary read/send, leaving no inbox navigation on an offline cold launch. `e3fdd7d1d` retains stale encrypted rows for ordinary changes while revalidating authorization. Destructive edit/delete still retire the copy to avoid persisting obsolete previews; that offline-navigation limitation remains explicit. Its exact APK build is in progress after successful Kotlin/Java compilation.
- Android older-history loading anchored a shared date divider, jumping from message 501 to 401; further paging could stall until moving away and back. Returning from search fetched the latest page but left the viewport at its oldest message. Source repair `dbba20b64` anchors a visible bubble and requests an explicit newest-message scroll. It is not in the currently building `e3fdd7d1d` artifact and needs repeated prepend, eviction and failure/retry checks.
- The first iOS per-room-read head failed Swift type inference in CI. `96e30c481` corrected it and built the CI test bundles. The local `9221185ef` build initially used a stale generated project; regenerating through the existing XcodeGen flow included the new source. That exact baseline build is still running. Do not attribute later source behavior to the installed `61fdfbabf` app.
- Review of both native and browser pagination found a refresh/load-more race. The source repairs reject a tail load while a head refresh owns the generation. Browser held-response checks passed; native artifact checks remain pending.

### New draft slices after the original register

Each row is a separate stacked draft. The original 63 remain open drafts. At this snapshot these 18 additional implementation drafts bring the chat total to 81; this documentation checkpoint and later work may add more. Bases remain the preceding slice in the same platform stack; inspect current remote metadata before retargeting.

| PR | Area / behavior | Source checkpoint |
| --- | --- | --- |
| #2728 | iOS visible per-room read maps | `96e30c481` |
| #2729 | Complete room counterpart and preference reads | `3450b928c` |
| #2730 | Bounded socket join admission and retry signals | `bcc86e65d` |
| #2731 | Android visible per-room read maps | `d0c14af57` |
| #2732 | Android POST changes with bounded fallback | `9cb0b88a1` |
| #2733 | Web POST changes and bounded reconnect joins | `2ea811177` |
| #2735 | Complete group delivery membership paging | `77b6a3726` |
| #2736 | Android business inbox paging | `1d7d76971` |
| #2737 | Android encrypted inbox retention | `e3fdd7d1d` |
| #2738 | Complete large-group identities and room members | `b5d780d05` |
| #2739 | Bounded web business identity probes | `4c4d50e4b` |
| #2740 | Current authorized inbox reader at socket startup | `d080afd82` |
| #2741 | Bounded web history preview and full-history access | `ae993decf` |
| #2742 | iOS staged POST change recovery | `f30d52514` |
| #2743 | iOS keyset inbox paging and refresh ownership | `af9e5d6a8` |
| #2744 | Live business inbox invalidation for current staff | `a5efe49c1` |
| #2745 | Android prepend anchor and return-to-latest scroll | `dbba20b64` |
| #2746 | Web authorized refresh of the loaded inbox depth | `d26d57c5e` |

### Current CI and remaining verification

No test code or migration was changed during this resumed work. CI failures remain release blockers, not waived expectations:

- Backend `a5efe49c1`: 31 failing / 6,602 passing Jest assertions, with the same 31 failure names as the preceding backend slices. The failures cover old room/read/send contracts, direct relay mocks and attachment mocks; real attachment checks do not turn these checks green. Privacy gates, complete schema replay, migration/deployment safeguards and production image checks passed.
- Web `d26d57c5e`: one failure at `notificationStreams.test.tsx:114` (two stats calls expected, one observed); 122 suites and 2,382 assertions passed. Identity Firewall, schema replay and safeguards passed.
- Android earlier resumed heads: seven unique existing search/local-mute assertion failures (21 reported including retries); instrumented checks passed. Exact current retention/window heads still need fresh classification when their runs finish.
- iOS `96e30c481`: CI bundle compilation passed; 4,826 tests, 164 skipped and two failures. The history-refresh fixture expects an omitted older row to survive despite a response saying no more rows; the local-mute fixture asserts before an unstubbed server preference response. These are exact-run diagnoses, not permission to alter tests or a substitute for app checks.

Next: finish the current Android, iOS and web artifacts and check their exact changes; build/check the Android window fix and later iOS read-map/delta/paging slices; complete iOS server search/context, business paging, encrypted never-sent drafts and timeline bounds. iOS head refresh still drops loaded inbox tail pages. Newer-range accumulation in the iOS delta reader is not an absolute timeline-memory bound. Native-to-native pairings and final quota/expiry/revocation cases remain incomplete.

The topic-read guard stays on. Durable recipient-device delivery receipts, OS background send scheduling, physical APNs/FCM proof, hosted release steps and controlled device/network performance measurements remain unfinished. Server acceptance remains Sent; it is not a durable Delivered receipt. No WeChat/WhatsApp parity claim is supported.

### Follow-up — October 23, 20:05 UTC

- A fresh remote check found master `9c3c402f1`, from the other session's #2734 web Pulse-header keyboard-focus repair. Its two feed files do not overlap chat. The merged PR's checks passed; no separate workflow run was returned for the merge commit. Frozen chat artifacts were preserved rather than rebuilt for this unrelated change.
- **Web `d26d57c5e` production build and verification are complete:** 170 pages, then actual browser POST recovery of an offline edit/deletion, a captured HTTP 200 with 532 cursor rooms and a 90-character URL, full-history search/context/older paging, personal loaded-depth preservation and business live preview updates. Business revocation changed 67 rows to 66 with the revoked row absent and tail preserved; restoration returned 67. Native read/delete/image counterpart checks also passed. The exact CI polling-count failure remains unresolved.
- **Android `e3fdd7d1d` built and is installed without wiping data.** Actual per-room reads advanced both visible rooms while leaving the hidden room unread; the production browser showed the corresponding Read/Read/Sent states. Immediate offline force-stop/relaunch preserved inbox navigation after a read and a send. A newly exposed limitation is stale cached unread counts after a read. Only scope-row counts can be projected from the existing authoritative read response; it does not supply an authoritative global/unmuted total. A follow-up is in progress. Deletion retired the obsolete preview, but currently also retires the whole inbox copy until revalidation, limiting offline navigation. Account/business/large-map checks continue.
- Android #2737's exact CI run has the same seven unique failures: six search expectations and one local-mute expectation, 5,060 cases with 21 reported failures including retries and 76 skipped. Instrumented checks passed. No test changes were made.
- **iOS search/context is source-only in #2748, `c1fc9be7f`.** It replaces per-conversation recent-history scans with authorized server search, opens bounded old-message context and offers an explicit return to latest. Review caught old context overwriting the latest-history cache; the repair requires a successfully recalled/fetched latest window before saving under that key. Parser/lint/format checks pass; exact native checks remain pending. Encrypted never-sent drafts and inbox cache paging metadata are still being implemented.
- A temporary large-group business-membership probe confirmed the old implicit access reader still caps at 1,000 rows, but did not reproduce a denied business access because that business was among the returned rows. The temporary membership was removed, restoring the original 1,032-member fixture. No repair or successful denial reproduction is claimed from that probe.

### Follow-up — October 23, 21:51 UTC

This is a checkpoint during active repair, not a release decision. The original drafts and artifacts remain preserved. The owned local APIs now run `a542ab8db` from #2762. The founder approved local implementation of `ChatTopicRead`; additive migration `20261024001000` was applied and recorded locally and is now immutable, alongside all previously applied migrations. No hosted service, launch flag, production configuration or backend merge changed.

- **Topic protocol #2762:** selected-topic reads require explicit visible boundaries on a separate route/event. Unread arithmetic, per-message receipts, push eligibility and deletion/restoration use the same boundaries. Local API verification left two interleaved unfiltered messages unread, returned the selected-only receipt mask and emitted no global read. Two concurrent database sessions exercised acknowledgement/deletion in both commit orders without decrementing unrelated unread twice. A socket read through one API process reached the sender through the other. Authorized business colleagues recover receipts for business-authored messages; removing temporary staff access returned 403. Temporary concurrency and staff fixtures were removed.
- **Web topic adoption #2765, `b900547c6`:** actual development-browser sender and recipient views showed a selected message Read while an unselected message remained Sent; sender reload preserved that distinction. Two accepted topic-read HTTP responses were dropped, then topic re-entry acknowledged again with 200; both unrelated messages remained unread and the room-wide boundary did not advance. The exact production build is running. This is not yet a production-artifact or native-topic pass.
- **Web revoked-history repair #2757, `21f52cb56`:** its complete production build passed with 170 pages. After an authoritative room denial, another tab with REST blocked lost the affected person history; blocked cold reload kept it absent while unrelated group history remained. Restoring the exact membership recovered history and the unsent draft. Development verification also held old successful history responses across denial and confirmed they could not repopulate the retired cache. That held-response race still needs the production artifact. An older open tab without the new retirement fence remains a mixed-version release gap.
- **Web subscriptions #2763, `0f98a177e`:** rapid room/person navigation stayed responsive. With REST blocked, a live reaction reached the mini chat, then its removal reached the full conversation after expansion. After all chat views closed, online inbox re-entry recovered the latest preview and unread count. With REST blocked, the closed inbox preview stayed stale: its message reducer currently lives in the mounted chat screens. An account-level repair is in progress. Deliberately delayed join acknowledgements and simultaneous business-drawer/mini ownership remain unverified. #2764 retires removed-room history on every delta page; its multi-page revocation UI case remains pending.
- **Android `ce782760d`:** the normal 532-room open remained responsive for more than two minutes with no ANR, fatal error or input timeout. A live edit arrived once with no history/delta refetch. After socket/history interruption, a reconnect recovered another edit through one POST containing 532 cursor keys; no ANR was observed. Basic background/re-entry also passed. This replaces the older `e3fdd7d1d` normal-socket failure, not the need for deliberately delayed-ACK coverage.
- **Android window/read cache:** repeated prepend, retained history after failed paging, Retry, bounded-window eviction context and return to Latest passed on the recorded artifact. A residual 46-pixel shift at the oldest sender-heading boundary and a top-edge paging stall were measured; #2768 is a separate repair whose combined build is running. Scoped unread projection survived offline relaunch on `96fe3a077`, preserving other rows and the last authoritative global total. #2766 narrows destructive preview retirement to the affected row; its artifact check is pending. `e9e39afd4` is now installed for the previously failing business live-inbox case; verification continues.
- **iOS `c3e42208f`:** the combined signed build completed, was preserved and installed without wiping data. Visible per-room acknowledgements cleared the two seen rooms and left the unseen room unread. A canonical unread row survived offline relaunch; after history/read alone were restored, an accepted read projected that row to zero, and a second offline force-kill/relaunch retained zero while another row stayed unread. The global total intentionally remained the last authoritative value. Never-sent text/reply/PDF restored offline without uploading. An actual process interruption after sealing the intent but before moving its draft directory recovered one outbox item; reconnect/Retry accepted one send and one upload. The recipient saw one message and rendered its PDF.
- **New reply defect:** that recovered iOS message lost its quote even though the offline queue showed it. The existing aggregate-person send path selected a different canonical direct room and silently removed cross-room reply linkage. Read-only review found the same behavior in web and Android. Separate repairs are in progress: preserve the original authorized room for the same direct audience/identity, and never silently redirect a reply into a group or send it without its quote. Promotion recovery and once-only PDF delivery passed; reply preservation did not.
- **Native pair and account checks:** iOS `9221185ef` and Android `96fe3a077` exchanged text, edit, reaction, photo and PDF, then agreed on deletion after relaunch. A dropped accepted iOS send response still produced one logical message. iOS offline logout removed its sealed chat files; account switch and return did not expose the other account's history. Synthetic wrong-recipient push injection did not open the old conversation; a matching synthetic push did. This does not verify physical APNs/FCM. A previously opened incoming photo failed to render after offline force-kill; encrypted received-media persistence remains a gap.

Additional draft slices since the earlier register include iOS #2748–#2749, #2751–#2754 and #2760 (search/context, inbox storage, drafts, business/personal loaded depth, subscriptions and saved read counts); Android #2750, #2755, #2759, #2766 and #2768 (read projection, subscriptions, business live updates, scoped preview retirement and prepend continuation); web #2757 and #2763–#2765; and backend #2758/#2762. Inspect live heads and bases because the iOS stack was restacked after a real Swift capture error. No test code was written or changed.

**CI remains red.** Exact backend `a542ab8db` has the same 31 named Jest failures as its predecessor (6,602 passing, 16 skipped); privacy, image, complete schema replay/SQL contracts and safeguards pass. Web #2764 still has the notification stats-call failure; 122 suites/2,382 assertions pass. Android #2755/#2759 have eight unique failures, 24 reports including retries, with instrumented checks passing; the additional failure concerns the changed join-emission signature. The iOS combined head fixed the actual Swift capture compile error, but exact test-run classification continues; one schema job failed before replay because its local Supabase port was occupied. None of these failures is waived.

Next, finish the current production/native artifacts and the newly reproduced reply/inbox defects; adopt and verify topic reads on both native clients; repeat lost-response, account/access-change, loaded-depth and attachment cases on final artifacts. Absolute iOS timeline bounds, offline incoming-media policy, abandoned upload cleanup, OS background outbox scheduling and durable recipient-device Delivered receipts remain unfinished. Keep Sent tied to server acceptance. Hosted release, physical push and measured competitor-level performance remain unverified.

### Follow-up — October 23, 22:36 UTC

- **Backend `cdfb189ab` is running on both owned local APIs.** #2773 adds the current topic identifier to the existing generic push payload after authorization; #2777 exposes existing active/left membership fields in authorized room details so clients can verify a reply's audience. No new migration was added for either slice. Local startup now explicitly verifies that APNs, FCM and Expo are disabled, along with cron/background jobs. Earlier local Expo configuration was implicit and is not claimed as an explicit disablement.
- **Web `d561bb25e` built all 170 production pages and is now running.** Its original-room reply repair was verified in the development browser: an offline reply with PDF and quote survived an API-blocked reload, then accepted exactly once in the original direct room. The other person rendered the PDF, and both full reloads retained the quote and attachment. A preceding revision incorrectly used the storage namespace as the actor ID and refused that reply; the successful result belongs to the corrected revision. Repeat the relevant cases on the new production artifact.
- **Web closed-inbox recovery #2774:** with all chat views closed and REST blocked, a socket message updated the mini inbox when reopened. A held older inbox response did not replace a newer live preview/unread count. Deletion and fresh refresh did not resurrect that preview. An old-account response released after logout could not populate the next account's blocked inbox; the release occurred before the new login, so this is not a delayed-response-after-login claim.
- **Web first-page access retirement #2764 passed on production `b900547c6`:** a captured first delta page contained 200 changes, another page pending and a removed room. Releasing that page while blocking subsequent requests immediately retired the affected history in the person view and another open tab; blocked cold reload kept it absent. The exact temporary membership and message edits were restored. A separate attempted production late-history race selected a Document response rather than the API response and was discarded; that race remains unverified on production.
- **Android `8e4fe7ad0` is installed.** Business live preview, HTTP-only edit recovery, deletion and relaunch passed on its preceding artifact. On the new artifact, editing and deleting an owned message cleared only the affected cached preview; offline force-stop/relaunch retained other rows. The peer saw the edit/deletion live, and reload did not resurrect the deleted message. The 600-message prepend continuation is still being checked. Reply preservation, immediate first-page access retirement (#2783), and topic adoption are separate later source slices awaiting a combined artifact.
- **iOS `51cddb638` is installed.** The same-audience reply retained its original quote and Read state after native relaunch and peer browser reload. An unsupported task-room reply retained its composer/quote across relaunch without send/upload and displayed an explicit original-conversation instruction. The app now emits POST change recovery; the observed request covered four rooms, not yet more than 500. Vertical scrolling from ordinary inbox rows still failed on this artifact while dragging the AI row worked. A direction-gated gesture repair and later receipt/access/reply-validation slices are in another signed build. Native topic verification is next.
- **CI is still red:** exact backend `cdfb189ab` and push metadata `b59767d2c` retain the same 31 named failures as `a542ab8db`, with 6,602 passing and 16 skipped; the other backend privacy/image/schema/contracts/safeguard gates pass. Exact web `d561bb25e` retains the one notification-stats expectation failure, with 122 suites/2,382 assertions passing and Identity Firewall/schema/safeguards green. Android #2768 has 11 unique failures (33 reports with retries), including three old edit/delete scope mocks beyond the prior eight; instrumented checks pass. iOS `c3e42208f` has nine unique failures involving old search/history/mute/attachment fixtures; bundle compilation and the rerun schema gate pass. Actual PDF checks do not waive the attachment assertion. No test code was edited.
- **Master moved to `fc3223d3f` during this work.** Other sessions merged security #2663, logout #2761, refresh #2778 and link-preview #2756/#2767. These overlap the socket and native chat files. The verified artifacts remain preserved while integration is inspected separately. The merged security migrations are not yet applied to this local database, and the running API does not yet include those master changes. This session did not merge or deploy those PRs.

Remaining work includes native topic-read/lost-response checks, final artifact recovery/access/account cases, the iOS gesture/large-inbox and absolute timeline bound, Android 600-message anchor proof, offline received-media policy, abandoned-upload cleanup, background outbox scheduling and durable recipient-device Delivered receipts. Hosted release, physical push and comparative performance measurements remain outside the verified evidence.

### Follow-up — October 23, 23:07 UTC

- **Backend integration is now running locally.** Draft #2787 (`0de454155`) combines the chat stack with master `fc3223d3f`, preserving both the current session-revocation checks and bounded authorized chat startup. Existing upstream migrations `20261023072000` and `20261023072100` were applied only to the owned local database and are now immutable. Source/test files imported from master were not rewritten. Both local APIs subsequently moved to #2790 (`ba1a00e3d`); all push providers, cron and background jobs remain explicitly disabled.
- **Read-event eligibility #2790 / web #2788:** a real task-room read had briefly stamped Read in the aggregate browser although reload returned Sent. Events now identify an eligible direct pair using the current room type and complete active membership. A real iOS task-room read emitted `directReceiptEligible: false`; the current browser remained Sent. Direct reads emitted true and recovered Read. Retiring an already-persisted false stamp still needs the separate authoritative browser refresh repair and its artifact check.
- **Web production `d561bb25e`:** an offline original-room PDF reply survived reload and reached the recipient exactly once with its quote; both reloads retained it and the recipient rendered page 1 of 1. The frozen production artifact now runs from its isolated traced dependency tree, preserving its build while newer source adopts master dependencies.
- **Web `a38026ce1` retry/context proof:** a queued PDF reply survived an offline navigation failure. With the original recipient temporarily inactive it showed Not sent and explicit Retry, with zero accepted messages. After restoring the exact participant row, Retry accepted one message in the original room with the original reply ID and one attachment. Sender reload retained Read; recipient reload showed one message and opened the PDF. The unloaded-original affordance opened the original context, which survived direct reload. The initial send still navigated away from an offline anchored view; a separate minimal repair is being checked. All temporary membership changes were restored.
- **iOS `299f5e233`:** ordinary inbox-row scrolling, horizontal mute/hide actions and normal taps passed. All 105 loaded conversations survived a head refresh and offline force-kill/relaunch. Revoking one owned room removed its history immediately while another room's history remained, including after offline relaunch; exact membership was restored. In a 532-room person conversation, POST recovery carried all 532 cursors. A send whose accepted HTTP response was dropped appeared once, then a missed incoming message and read receipt recovered after reconnect and persisted through offline relaunch. Returning to the original account showed its own inbox without the large fixture's messages. A 32.6-second idle observation produced no history/topic/delta/read calls or join loop; this is not a latency benchmark.
- **Native topics:** iOS `51cddb638` rendered and acknowledged only the selected Beta messages while interleaved Alpha messages stayed unread; peer live/reloaded receipts matched and room-wide boundaries did not advance. Offline topic selection/history was still missing on `299f5e233`; #2791 (`9677cc20a`) reuses bounded encrypted history keys and optional topic metadata, with source checks but no artifact proof yet. Android `8e4fe7ad0` rendered Beta alone but deliberately left both topic messages unread under the old guard; the combined topic-aware artifact is still building.
- **Android `8e4fe7ad0` 600-message proof is complete:** prepend and failed-page Retry preserved measured bubble coordinates, continuous paging reached the oldest row, and Latest returned to the newest page after window eviction. Offline relaunch retained the latest inbox/thread. Scoped edit/delete retired only affected previews and the peer reload did not resurrect deletion. A legacy cross-room reply still lost its quote; the upcoming combined `7c2dcb7d9` artifact includes the repair, immediate per-page access retirement, topics and master integration. These later slices are not yet emulator-verified.
- **CI remains a release blocker.** Exact backend `ba1a00e3d` has 31 failures, 6,602 passes and 16 skips, with precisely the same failure names as `cdfb189ab`; privacy, image, complete schema and migration safeguards pass. Integration additionally passed 11 session-revocation assertions and 63 privacy assertions. Four extra non-chat failures in a local full run passed unchanged on a focused 104-assertion rerun. Exact web `a38026ce1` retains the one stats-call failure with 122 suites/2,382 assertions passing. Android reply/topic heads have 14 unique failures (42 reports including retries), 5,074 cases and 76 skips; instrumented/schema checks pass. iOS `51cddb638` has 11 runtime failures while bundle/lint/schema/safeguards pass. No test code was authored or edited by this work.

Next: finish the combined native artifacts and current web integration, including topic loss/recovery, original-room attachments, access retirement and account changes. Keep the invalid production held-response experiments separate from the valid first-page retirement proof: the newer attempt observed a preferences denial with a departure timestamp that intentionally preserves historical access, so it did not prove late history retirement. Absolute iOS timeline bounds, offline received-media policy, orphan-upload cleanup, OS background sending, durable device Delivered receipts and controlled performance measurements remain unfinished. No hosted changes, backend merge, physical push proof or parity claim is implied.


## Appendix: original broader audit, preserved verbatim

The following was stored under “Historical inventory” in docs/message-chat-plan.md. It includes the original security, functionality, performance, operations and validation backlog, followed by the repeated release/workstream breakdown. Some assertions describe old code and are not current verified findings. Requests to add automated tests are superseded by the founder's no-test-code instruction. Removed-member policy wording must be reconciled with intentional read-only history for people who left, rather than deleting that behavior indiscriminately.


This is the full production-readiness backlog for the current chat/message stack, based on backend/routes/chats.js, backend/socket/chatSocketio.js, backend/database/schema.sql, backend/routes/upload.js, frontend/apps/web/src/hooks/useChatMessages.ts, and frontend/apps/mobile/src/hooks/useChatMessages.ts.

1. Access Control And Data Exposure

Revoke direct anon and authenticated execution on chat-related SECURITY DEFINER RPCs and raw chat tables unless they are explicitly safe for client-side use.
Move sensitive chat RPCs to a non-exposed schema, or bind them to auth.uid() internally so callers cannot pass arbitrary user IDs.
Fix all chat RLS policies so room/message/participant access always requires is_active = true.
Ensure removed participants immediately lose message, room, and participant visibility everywhere, including canonical person-conversation queries.
Audit every business-identity path so authorization is explicit and revocable; do not silently grant durable room access unless required.
Add server-side blocklist enforcement so blocked users cannot create chats, fetch history, send messages, react, or upload chat files.
Add abuse controls for spam, harassment, flooding, and repeated unsolicited direct-chat creation.
Add admin/moderation access rules separately from normal user access; do not piggyback on service-role reads.
2. Media And Attachment Security

Replace public file_url chat attachments with authenticated downloads or short-lived signed URLs.
Ensure S3/CloudFront is not publicly readable for chat media.
Add malware scanning for uploaded chat files before they become accessible.
Add MIME sniffing and extension validation; do not trust only file.mimetype.
Strip EXIF/location metadata from images unless there is an intentional product reason to preserve it.
Add per-room attachment authorization checks on download, not just upload.
Add content-size, file-count, and storage-quota enforcement specifically for chat.
Add retention and deletion handling for attachments tied to deleted/redacted messages.
3. Realtime Contract And Delivery Semantics

Pick one source of truth for message delivery semantics and align REST, Socket.IO, and DB contracts to it.
Remove or replace dead/drifted socket paths that rely on missing or mismatched RPCs.
Fix the current socket payload mismatch between get_user_chat_rooms output and what the socket server expects.
Make reconnect deterministic: on reconnect, fetch missed messages since the last acknowledged cursor before resuming live events.
Add idempotent send semantics with a client-generated message UUID or idempotency key.
Add explicit delivery states: queued, sent, persisted, delivered, failed.
Add server acknowledgements that include canonical message ID, server timestamp, room ID, and any transformed fields.
Deduplicate server events by canonical message ID on both server and client.
Make read receipts precise and consistent; if message-level receipts are supported, persist a true cursor rather than just zeroing unread count.
Keep typing events ephemeral and rate-limited, and verify room membership before every typing broadcast.
4. Data Model Hardening

Add a canonical direct-conversation uniqueness model so two concurrent creates cannot produce duplicates.
Persist both actor_user_id and sender_identity_user_id for business messaging; today the human actor is lost when sending as a business.
Validate reply_to_id belongs to the same room and is visible to the sender.
Validate topic_id belongs to the same allowed conversation pair and room context.
Store a monotonic room-local ordering key or sequence for stable pagination and replay.
Move room summary fields into durable server-maintained state: last message ID, last message time, preview, participant counts, unread counts if needed.
Make message insert, room summary update, unread update, and topic activity update transactional.
Define and implement a real deleted-message retention job instead of doing redaction work on read paths.
Decide whether person-grouped conversations are the canonical model or just a derived inbox view; remove the current hybrid ambiguity.
5. Inbox And Message Query Performance

Replace the current “fetch N recent rows across all rooms and hope coverage is enough” strategy for inbox previews with per-room summary state or a proper ranked query.
Remove the per-room exact-count N+1 query pattern from unified conversations.
Use cursor pagination with (created_at, id) or a sequence key, not timestamp alone.
Add/verify indexes for the actual hot paths: (room_id, deleted, created_at desc, id), (user_id, is_active, joined_at), reaction lookups, and room-summary lookups.
Run EXPLAIN ANALYZE for room list, unified conversations, room message fetch, conversation fetch, reaction fetch, and mark-read.
Add pagination response cursors from the server rather than inferring hasMore from length === limit.
Keep deleted-message redaction off the critical read path.
Cache or precompute inbox totals and badge counts instead of recomputing full exact counts on every open.
6. REST API Hardening

Add chat-specific write rate limits for send, react, edit, delete, participant changes, and direct-chat creation.
Add payload validation for all cross-object references, not just UUID shape.
Standardize error codes for auth failure, rate limit, blocked user, invalid attachment, stale cursor, duplicate send, and business-identity auth.
Make all room-fetch endpoints consistently enforce active membership and business-identity authorization.
Remove API surface that exists in the client package but has no backend implementation, or implement it fully.
Ensure edit/delete permissions are correct for represented business messages and audit requirements.
Make mark-read APIs consistent across REST and sockets; right now the signatures and semantics drift.
7. Client Reliability

On web and mobile, actually use the room:join callback payload and/or force a post-reconnect refresh.
Stop trusting local unread increments for inbox state; reconcile from authoritative server badge/inbox payloads.
Add resend/retry handling for transient failures without creating duplicate messages.
Persist unsent drafts and pending attachments across refresh/app background if chat is a core feature.
Handle offline mode explicitly: queue or block sends cleanly, surface failure state, and replay safely.
Make optimistic sends use the same idempotency key the server understands.
Ensure business-identity message ownership is rendered consistently in thread view, inbox view, reactions, edits, and deletes.
Add upload progress, cancel, and failure UI for attachments.
Refresh thread state after foreground resume on mobile, not only when the socket happens to reconnect cleanly.
8. Moderation, Privacy, And Compliance

Add message reporting, moderation queueing, and reviewer tooling for abusive content.
Define retention, redaction, legal hold, and export policies for chat data.
Define who can view deleted messages and for how long.
Add audit logging for participant adds/removes, business-identity sends, moderation actions, and access-sensitive operations.
Add privacy review for attachment URLs, logs, notification payloads, and admin tooling.
Ensure chat notifications do not leak sensitive message content on lock screens or shared business devices without policy.
9. Observability And Operations

Add request IDs and socket session IDs to logs so a send can be traced across API, DB write, socket broadcast, and client receipt.
Instrument p50/p95/p99 for send latency, thread load, inbox load, reconnect recovery, upload latency, and badge refresh latency.
Track duplicate-send rate, reconnect-miss rate, unread drift rate, socket auth failure rate, and attachment upload failure rate.
Add alerts for elevated send failures, socket connect failures, DB query regressions, and unexpected 403/500 spikes on chat endpoints.
Create runbooks for message-delivery incidents, media-access incidents, unread-count drift, and moderation escalation.
Load test reconnect storms, noisy-room inboxes, concurrent direct-chat creation, attachment bursts, and mark-read churn.
10. Test Program

Add real integration tests against actual Postgres/Supabase with RLS enabled; mocked unit tests are not enough.
Add socket end-to-end tests for connect, join, send, reconnect, duplicate event handling, read receipts, and reactions.
Add security tests for removed participants, blocked users, unauthorized business impersonation, and direct DB/RPC bypass attempts.
Add concurrency tests for duplicate direct-chat creation and simultaneous sends from multiple devices.
Add pagination tests that cover same-timestamp messages, backfill after reconnect, and no-gap/no-dup guarantees.
Add attachment tests for private download authorization, signed URL expiry, malware failure, and MIME mismatch.
Add performance regression tests for inbox list and message fetch queries at realistic production cardinalities.
Launch Bar

No unauthorized history access in integration/security tests.
No duplicate message creation under retries/reconnect.
No lost messages after reconnect in end-to-end tests.
Inbox and thread queries must be bounded, indexed, and benchmarked at realistic scale.
Attachment access must be private and auditable.
REST, socket, and database contracts must match exactly with no legacy drift paths left.





Release Blockers
These have to be closed before any real production traffic.

Owner: Security + DB + Backend

 Revoke direct anon/authenticated access to chat SECURITY DEFINER RPCs and any exposed chat tables/functions that let callers pass arbitrary user IDs.
 Move sensitive chat RPCs out of exposed public API surface, or bind them strictly to auth.uid() internally.
 Fix RLS so only is_active = true participants can view rooms, messages, participants, and typing state.
 Ensure removed participants immediately lose access everywhere, including person-conversation aggregation endpoints.
 Replace public chat attachment URLs with signed/authenticated download flow.
 Confirm S3/CloudFront is not publicly readable for chat media.
Owner: Backend + DB + Realtime

 Unify REST, Socket.IO, and DB contracts; remove drifted socket paths that depend on missing or incompatible RPCs.
 Fix the socket/server mismatch around room payload shape and read-receipt RPC signatures.
 Add reconnect backfill so clients fetch missed messages after reconnect before resuming live events.
 Add idempotent send support with client message IDs or idempotency keys.
Owner: Backend + QA

 Add real integration tests with actual Postgres/Supabase + RLS enabled for send/read/remove/reconnect/access-control paths.
 Add socket end-to-end tests for connect, join, send, delete, react, read, reconnect, and duplicate-event handling.
Workstreams

1. Auth, RLS, and Data Exposure
Owner: Security + DB + Backend

 Audit every chat table, view, and function grant.
 Restrict get_or_create_direct_chat, get_user_chat_rooms, and similar RPCs so they cannot be abused outside the backend.
 Ensure business-identity access checks are explicit, revocable, and consistently enforced in all room/message endpoints.
 Add blocklist enforcement to chat creation, fetch, send, react, upload, and participant changes.
 Separate moderator/admin access from normal participant access.
 Add audit logs for sensitive chat access and business-identity actions.
2. Message Delivery and Realtime Semantics
Owner: Backend + Realtime + Frontend

 Define one canonical delivery model for send, persist, broadcast, ack, and read.
 Return canonical message ID, server timestamp, sender identity, and room ID on every successful send.
 Make sends idempotent under retry, reconnect, and double-submit.
 Persist actor identity separately from represented sender identity for business messaging.
 Ensure delete/edit/reaction events use the same message identity and room authorization rules as REST.
 Make read receipts precise; if message-level read is supported, persist a cursor rather than only resetting unread count.
 Rate-limit typing events and verify membership on every typing broadcast.
3. Data Model Hardening
Owner: DB + Backend

 Enforce direct-conversation uniqueness under concurrent creation.
 Validate reply_to_id belongs to the same room and is visible to the sender.
 Validate topic_id belongs to the right conversation pair/context.
 Add stable pagination keying using (created_at, id) or a room-local sequence.
 Maintain durable room summary state: last message ID/time/preview and participant summary metadata.
 Make message insert, unread update, topic activity update, and room summary update atomic.
 Replace read-time deleted-message cleanup with background retention jobs.
4. Inbox and Query Performance
Owner: DB + Backend

 Replace current “global recent rows across many rooms” preview logic with per-room summary state or a proper ranked query.
 Remove per-room exact-count N+1 queries from unified conversations and badges.
 Benchmark GET /rooms, unified conversations, room message fetch, canonical conversation fetch, reaction fetch, and mark-read queries.
 Add/verify hot-path indexes for room fetch, room message pagination, reaction lookup, unread lookup, and topic filtering.
 Return real pagination cursors from the API instead of inferring hasMore from length === limit.
 Keep expensive redaction/counting work off synchronous request paths.
5. Attachment and File Security
Owner: Backend + Security + Infra

 Serve chat files via signed URLs or authenticated proxy endpoints.
 Add malware scanning and quarantine workflow for uploaded chat files.
 Validate actual MIME/content, not just client-reported mimetype.
 Strip EXIF/location metadata from images unless intentionally retained.
 Enforce per-user and per-room quotas for chat storage.
 Add download authorization checks tied to room membership.
 Define retention/deletion behavior for files on soft-deleted and redacted messages.
6. API Hardening and Abuse Controls
Owner: Backend + Security

 Add chat-specific rate limits for send, react, edit, delete, direct-chat create, participant changes, and attachment upload.
 Standardize machine-readable error codes for blocked, unauthorized, duplicate send, stale cursor, invalid attachment, and rate-limit states.
 Remove or implement any client-exposed chat API methods that do not exist server-side.
 Ensure all endpoints consistently require active membership, not just membership row existence.
 Add spam/flood controls and suspicious-behavior detection for chat abuse.
 Add content/reporting endpoints and moderation queue integration.
7. Web and Mobile Client Reliability
Owner: Frontend Web + Frontend Mobile

 Use room:join responses or force thread refresh on reconnect.
 Reconcile unread state from authoritative server payloads instead of local increments.
 Persist drafts and pending uploads where product requires it.
 Handle offline/airplane mode explicitly with failed/pending send states.
 Use the same idempotency key on optimistic messages that the server understands.
 Add attachment upload progress, retry, cancel, and failure UI.
 Refresh thread state on app foreground/resume, not only on socket reconnect.
 Ensure business-identity rendering is consistent in inbox, thread, reactions, edits, and deletes.
8. Moderation, Privacy, and Compliance
Owner: Trust/Safety + Legal + Backend

 Add message reporting and moderation workflows.
 Define retention, deletion, redaction, export, and legal-hold policy for chats.
 Define what deleted messages remain available for disputes/admin review and for how long.
 Ensure notifications and lock-screen surfaces do not leak sensitive message content by default.
 Review logs, analytics, and error payloads for PII leakage.
9. Observability and Operations
Owner: Infra + Backend

 Add request IDs and socket session correlation IDs.
 Instrument p50/p95/p99 for send latency, inbox load, thread load, reconnect recovery, upload latency, and badge refresh.
 Track duplicate sends, missed-after-reconnect, unread drift, auth failures, and attachment failures.
 Add alerts for send failure spikes, socket connect failure spikes, DB latency regressions, and unexpected 403/500 rates.
 Write runbooks for message delivery failures, unread drift, attachment exposure, and moderation incidents.
 Load test reconnect storms, noisy-room inboxes, concurrent chat creation, and attachment bursts.
10. Test Matrix
Owner: QA + Backend + Frontend

 Integration test: active participant can fetch/send/read.
 Integration test: removed participant cannot fetch room, messages, conversation history, or files.
 Integration test: blocked users cannot create or continue chats.
 Integration test: business delegate can act only where authorized.
 Integration test: reconnect recovers missed messages with no gaps/duplicates.
 Integration test: duplicate send retries collapse to one persisted message.
 Integration test: same-timestamp pagination has no skip/dup behavior.
 Integration test: attachment upload/download respects privacy rules.
 Socket E2E test: join, send, edit, delete, react, read, reconnect.
 Performance test: inbox and thread endpoints at realistic room/message cardinalities.
Definition Of “Production Ready”

 No unauthorized chat or attachment access in integration/security tests.
 No missing messages after reconnect in E2E tests.
 No duplicate persisted messages under retry/reconnect.
 Inbox/thread queries are indexed, benchmarked, and bounded.
 REST, socket, and DB contracts match exactly.
 Attachments are private and auditable.
 Monitoring, alerts, and incident runbooks exist.
