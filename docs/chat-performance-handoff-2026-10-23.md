# Messages / Chat performance and reliability handoff — October 23, 2026

The founder originally requested a handoff, then authorized resuming implementation and real-app verification with three client agents. Read AGENTS.md, NEXT_STEPS.md and the current mobile pilot brief first. The founder's current instructions remain authoritative. The resumed checkpoint below supersedes the historical status in sections 1–7 where they differ; the original PR register remains intact.

**Original handoff outcome:** substantial reliability, privacy and performance repairs were implemented across backend, web, iOS and Android in **63 draft PRs, #2665–#2727**, including the reaction/handoff checkpoint. **None was merged or deployed by this session.** The original register below records exact titles, branches, bases, implementation revisions and CI snapshots.

This is not a claim that all issues are fixed, all final artifacts were tested, CI is green, or production performance matches WeChat/WhatsApp. Source revisions, installed artifacts and running backend revisions sometimes differed. Keep those distinctions. The three agents stopped before the original handoff and were resumed for the checkpoint below; inspect current processes rather than assuming their state.

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

## 1. Decisions and constraints

- Preserve the current screens, layouts, styling and navigation. Launch-cut features stay behind their flags. Do not enable hidden features just to claim verification.
- Verify the actual web app, native iOS simulator and native Android emulator against a real local API/database. Check the other person's view, reload/relaunch, failure and recovery. API/socket/database probes supplement app checks; they do not replace them.
- **Do not write test code, unit tests or coverage work.** Existing CI ran. Do not hide failures or remove checks to manufacture green results. Inspect failures for actual product regressions; a conflict requiring test-code changes needs a separate founder decision.
- The founder approved an **encrypted, account-scoped recent-history cache** on device, superseding the earlier no-received-history-storage decision. Persist unsent messages and originals securely, bound storage, reconcile changes, clear account data on logout/revocation.
- The founder approved one private **ChatPushDelivery table** for durable push retries, covering code/local database work. This does not authorize arbitrary new tables or hosted changes.
- The earlier approval to add safeguards to a then-new local migration was used. All migrations recorded locally are now applied and immutable. Future fixes must be additive.
- Generic lock-screen chat text was adopted as a stated privacy-preserving assumption after an unanswered optional preference question. It is not an explicit founder preference answer. Full previews remain inside the app.
- This is a public repository. Keep credentials, env files, raw device tokens, database archives, private logs and real personal data out of Git, PRs and screenshots. Verification used synthetic local identities.
- Only the founder changes hosted databases/configuration, enters console credentials, spends money, sends to real people or submits store builds. Backend merges can auto-deploy/migrate production; **do not merge this stack as a substitute for founder-owned release steps**.
- Parallel work was authorized. Use separate named worktrees/branches and one owner per area. Preserve other sessions' work and services. Do not revive the retired coordination/workstream system.
- Local cache encryption is **not end-to-end message encryption**. The server still processes content. No end-to-end encryption, voice/video calling or full competitor feature parity was implemented or promised.

## 2. Audit findings, solutions and current status

This consolidates the initial performance/reliability audit and issues reproduced during repair. The original broader repository audit is preserved verbatim in the appendix. Some original assertions were already stale; they are not all newly proven defects.

| Problem / effect | Repair or proposed solution | State |
| --- | --- | --- |
| Joining or sending cleared unseen messages. | Explicit visible-message read cursors; join/send never imply reading. | Backend/client base slices implemented; final native checks incomplete. |
| Read timestamps did not prove actual viewing. | Separate read event time from message boundary; monotonic locking; direct receipts from the other member's cursor. | Implemented; recorded API/app checks passed. |
| One person-level cursor cleared another room's unseen history. | Per-room throughMessageIds map with single-cursor compatibility. | Backend #2721 and web #2726; web two-visible/one-hidden-room check passed. Native adoption remains. |
| An older transaction inserted a new message behind an existing read boundary. | Fill omitted creation time from the DB clock after acquiring the room revision lock. | #2718; two-transaction reproduction/repair verified. |
| Timestamp-only pagination skipped ties. | Composite timestamp/UUID cursors, both before/after bounds, microsecond precision. | Implemented; tie/gap checks passed. |
| Live events, optimistic echoes, stale responses and reconnect snapshots duplicated or overwrote state. | Canonical IDs, stable client send IDs, revision/generation guards, gap/delta recovery. | Implemented in client/backend stacks; final artifact matrix incomplete. |
| Lost send/upload replies caused duplicate or lost outgoing work. | Encrypted durable outbox, stable message/upload IDs, ordered workers, atomic promotion. | Web/iOS recovery checks passed on recorded builds; Android final media/draft checks unfinished. |
| iOS accepted messages could keep a worker occupied and block the next send. | Release the exact accepted/discarded worker; protect replacement workers from late completions. | Reproduced on older artifact; #2710 is in newer signed build, not yet app-verified there. |
| Browser tabs/account changes overlapped workers. | Web Locks, account/session ownership, late-acceptance guards, quota-safe promotion. | Actual browser checks passed within the limitations below. |
| Cold opens required network and offline recent history was unavailable. | Bounded encrypted local history with server reconciliation. | Implemented all clients; some newest cache slices not yet device-verified. |
| Never-sent drafts lost text, files, reply/edit intent. | Encrypted composer drafts scoped by account/conversation/topic; atomic draft-to-outbox move. | Web verified; Android implemented/pending full QA; iOS missing. |
| Native inbox previews used plaintext generic screen caches. | Encrypted chat-store reuse; purge/refuse legacy plaintext. | Android upgrade verified; iOS #2720 source only. |
| Device-local mute disagreed with push/global badges. | Server preferences, authoritative unmuted totals, private cross-device invalidation. | Backend/web verified; Android in combined artifact; iOS #2724 not built/verified yet. |
| Stale badge reads replaced newer state or produced false zero. | Authoritative totals, generations, single-flight/coalescing, bounded counts and failure-preserving cache. | Implemented; iOS's earlier badge gap needs new-artifact confirmation. |
| Inbox queries truncated rows or favored join date over current activity. | Filter before stable paging, indexed previews, complete totals, paginated clients. | Large API fixtures and web paging passed; native business paging remains. |
| Person queries intersected capped membership lists. | Filter both active members in SQL before keyset paging. | #2699; 1,031-unrelated-room reproduction fixed and ordinary app flows checked. |
| Many shared rooms overflowed internal/client URLs; cursor maps stopped at 500. | 100-room batches, bounded global history merge, POST JSON sync maps. | #2725 verified with 531 rooms; client transport adoption remains. |
| Search covered only loaded rows/messages. | Authorized server inbox/message search and old-message context. | Backend/web and Android source; Android latest QA and iOS work remain. |
| Long histories rendered/retained too much and jumped on prepend. | Web virtualization; Android 500-row anchor window; bounded reconciliation and pending-row retention. | Web checked; Android final stress/anchor QA pending; iOS audit remains. |
| Buffered/full-size media delayed UI and used excessive memory. | Streaming, bounded processing, private thumbnails, off-main file reads, encrypted upload streams. | Backend/web passed; newest native media paths need final artifact QA. |
| Concurrent thumbnails repeated expensive work. | Bounded cache/coalescing and processing admission, authorization before cache response. | #2695 verified; persistent derivatives remain optional. |
| Delivery, typing and presence depended on one API process. | Committed PG notifications, bounded queues/current authorization; ephemeral typing and leased presence. | Multi-process checks passed; actual typing all platforms and Android presence checked. |
| Push work disappeared on process failure or reached a later account. | Durable delivery jobs, leases/retries/expiry/current access/mute/read checks, recipient-account binding. | Code/local checks; physical APNs/FCM/hosted verification missing. |
| Lock-screen previews leaked content across account changes. | Generic OS text plus native recipient/tap/logout guards. | Implemented; physical push proof missing. |
| Business group messages displayed the staff member's identity. | Honor explicit business sender, keep actor private, reject conflicting task identity/unpublished non-task sender. | #2722 API and browser send/edit/delete/reload passed; native business flow pending. |
| Reactions stopped at 1,000 rows; valid text such as toString crashed history. | Paged reads, bounded identity queries, Map grouping shared across REST/socket/backfill. | #2727 checkpoint; REST proof before consolidation, final socket/app QA pending. |
| Metric arrays and snapshot costs grew with traffic. | Fixed 4,096-slot rings, five-minute retention. | #2706 functional checks passed; not a production benchmark. |
| Topic-filtered reading cannot safely advance a global cursor. | Retain no-topic ACK guard until a proper topic-read protocol covers counts/receipts/push/deletes. | Guard retained; full protocol missing. |
| Foreground outboxes do not send while the OS suspends/kills the app. | Account-scoped OS background scheduling with honest foreground fallback. | Android WorkManager, iOS scheduling and browser background sync/push not implemented. |

## 3. Completed implementation and evidence

### Backend/database

The stack adds read state, indexed history/inbox/search, revision reconciliation, room-scope paging, mute/badge rules, private streamed media, multi-process events, durable push, typing/presence and late business/read/sync repairs. Existing tables/routes/services were reused; ChatPushDelivery is the newly approved table.

Important evidence:

- Join/send preserved unseen messages. Reading the first of three left two unread; repeating the cursor did not clear them. Direct history showed Read only inside the recipient boundary.
- Equal-time/microsecond pages had no gaps/duplicates. Two real DB transactions reproduced delayed insertion behind a cursor; the fix retained unread count one.
- A person with 1,031 unrelated rooms retained a shared conversation. Separate 531-personal/531-business-room fixtures recovered every room once, prioritized the active older room, retained totals, rejected bad cursors and denied nonowners.
- Per-room reads rejected wrong-room/out-of-scope cursors and retained later arrivals. A real PostgREST response contained all 1,031 empty room rows. Actual web verification left an unseen third room unread.
- The 531-shared-room fixture reproduced history HTTP 500 and GET cursor HTTP 431. Fixed history returned 200/200/131 messages in exact microsecond order. After edits and deletion, POST changes returned 200/200/131 changes once, then empty.
- Multiple local API processes delivered committed changes. Typing access/revocation checks passed. Presence found already-online peers, retained online while another device remained, emitted final disconnect, and expired a crashed process after 52 seconds.
- Private preference signals reached the account/current authorized business staff, not peers or revoked staff. Ordinary reads/messages did not trigger preference refetches.
- Thumbnail checks covered 20 concurrent cold requests coalescing into one generation, hits, 304, denied 403 and removed-file 410; authenticated originals remained available.
- Business checks covered stored business sender/private actor, peer actor omission, same-key retry once, unauthorized/revoked staff denial, personal identity preservation, author edit/delete and unpublished/published behavior.
- Before final reaction helper consolidation, old history returned 1,000 of 1,600 reactions. The repair returned all 1,601 with a literal reaction, preserved own reaction state, and accepted/removed literal values. A separate one-message toString case returned 500 before and 200 after.
- The final consolidated reaction socket probe's result was lost during interruption. It is **unverified**, even though the fixture was cleaned up.
- Seventeen chat migrations were rehearsed/applied locally. Function lint/schema replay passed on the migration slices. Syntax, migration policy and identity-select checks were used. They do not substitute for remaining app checks.

### Web

Current source: **acc62f25b, #2726**. Last confirmed full production build: earlier **d2a86ab2e**, with successful compile/lint/typecheck and 170-page build, followed by production-browser send/read/reload. Later draft/paging/read-map slices passed targeted checks and CI typecheck/lint, but need a new combined production build.

Recorded real browser checks:

- Recovery/deduplication, optimistic/accepted sends, direct Sent→Read, offline/reload outbox, lost-response retry, one logical accepted message for tested retries.
- Encrypted history/outbox, multiple tabs, quota failures preserving data, account switch and old-room denial. Full navigation destroys the old JS environment, so that scenario does **not** prove all in-memory overlapping account transitions.
- 230 equal-time messages, edits/deletions and 200+32 delta recovery; virtualized timeline.
- Full message search/context, inbox search beyond page one, 50+17 inbox pages.
- Server mute, row/global badges, live private preference invalidation, typing refresh around three seconds and idle stop around 4.5 seconds.
- Thumbnail/full-view/download; edit/delete reaching the peer/native client; offline errors preserving intended work.
- Never-sent text/image/reply/edit context restored after reload without auto-send. Draft→outbox accepted once; stale tab writes did not replace newer text; logout/account return cleared draft.
- Three business inbox surfaces paged 50+17, retained loaded rows on transport failure, retried and cleared revoked membership. Business send/reply/reload passed.
- Group business label survived recipient reload; edit propagated; delete disappeared on both views and stayed absent after reload/older-history load.
- Per-room read maps omitted unseen history. Topic Alpha emitted no read request. Business direct Sent→Read persisted after reload.
- Browser counterpart supported Android Combined01 / Peer Combined01 and native attachment checks.

Shared-card outbox wiring exists, but launch-gated screens were not force-enabled to claim verification.

### Android

Source/build: **806a45c35, #2716**. Combined APK succeeded in about 33 minutes and was installed **without clearing data**. It includes storage/outbox, push guards, encrypted streaming, inbox/search, mute/typing, drafts, presence and timeline-window slices.

Confirmed on that exact APK:

- Existing login/account/unread badge survived upgrade.
- Old plaintext MESSAGES_LIST was removed and an encrypted inbox copy created.
- Recent history and previous Read stamps loaded.
- Native Android Combined01 arrived once in the real peer browser and became Read.
- Peer Combined01 arrived once in Android; native viewing made the browser reply Read.
- Accepted outbox files were removed.

Earlier artifact checks covered 125 same-time reconnect messages, edit/delete/retry/read/relaunch, bursts, own-send preserving unread, image/full-view, continuous typing and presence. Those **do not prove newly installed draft/storage/window changes**.

Pending on 806a45c35: encrypted text/image/reply/edit draft force-stop recovery; atomic draft→outbox media promotion; offline queue/restart/lost-ack recovery; discard/logout/quota/expiry; search/context/paging; >500-row anchor/window; final mute/preference/notification-account checks.

The original draft hard links were rejected by the actual emulator's SELinux policy. #2716 uses atomic directory rename with the original authenticated encryption scope. Filesystem rename capability passed; the full app promotion flow did not finish before handoff. Physical push remains unverified.

### iOS

Source: **9221185ef, #2724**. Frozen build worktree: **61fdfbabf, #2714**. **Its signed build completed successfully during the interruption**; the final success marker was checked at handoff. Installation/verification of that artifact is not confirmed. The last known installed/verified cache/outbox artifact was the older **c19ab9e62** lineage.

Real checks on the earlier signed artifact:

- Encrypted recent history and three pending texts restored offline after force-kill.
- Reconnect accepted those texts once/in order; native and real browser agreed; pending records removed.
- A queued sealed photo survived force-kill and rendered on native/web.
- Native Files picker sent a 602-byte PDF; web viewing/download passed.
- Discard removed its pending record. Settings→Log out→Sign out removed pending/history sealed files.
- A held response plus socket acceptance reproduced the worker stall. #2710 repairs it, but its artifact still needs the same check.
- A PDF uploaded once, its accepted send response was held, and the app terminated. Relaunch retried the message without another upload; accepted queue bytes were removed. Final counterpart confirmation for that last case was requested but not recovered; confirm it.
- Earlier typing/send/reply passed. A visible-read/badge gap was found and repaired in source; resolution is not yet confirmed in the new artifact.

The completed 61fdfbabf build contains newer visibility reads, badge/live state, recipient notification guards, worker fix and media changes. It **does not include #2720 encrypted inbox or #2724 server mute**. Build those after checking this artifact.

The mute slice migrates legacy local-muted keys once per account/server to server false, records completion after success, retries at most eight keys per bounded 30-second foreground/reconnect attempt, and lets a manual change win over a legacy in-flight write. Remote unmute must remain canonical afterward. This is source-checked, not native-verified.

## 4. Remaining work, in execution order

### A. Recover the verification baseline

1. Inspect current worktrees, branches, remote PRs and CI. Reuse the existing work. Master was 1ea400a117b1f9321f1b901e691b9e7436c9a061 at handoff; recheck it.
2. Read the local-only operations companion below. Local DB is reachable. APIs 63100/63102/63103 are **not listening at handoff**; web 63101 and iOS proxy 63105 still listen. Restart only owned local services.
3. Preserve the already-applied database. Do not edit or reapply its recorded migrations. Fresh replay belongs on a separate disposable database.
4. Install/check the successfully built iOS 61fdfbabf artifact before another build. Finish Android 806a45c35 draft/media/restart/window checks.
5. Finish #2727 after helper consolidation: REST/socket parity, room-join backfill, add/remove, reconnect, >1,000 rows, and actual app reaction controls on all three platforms. It is a checkpoint, not a finished release slice.
6. Build the complete web tip and check it in the browser. Do not commit generated .next-build output.
7. Inventory/remove only this effort's fixtures when no longer needed. At handoff, 67 business fixture rooms and three read-map fixture rooms remain; their private manifests identify them. The business manifest also records a separate direct room. The interrupted socket fixture has zero remaining rooms. Never delete unrelated data.

### B. Complete client adoption

| Area | Next work |
| --- | --- |
| Web | POST changes transport (#2725) with safe older-server fallback; actual large-map reconnect; review ChatRoomView's unnecessary limit-1000 preload and per-participant business probes; preserve older inbox pages without retaining revoked data; full production build after #2726. |
| Android | Per-room visible reads (#2721); POST changes (#2725); business paging (#2717); complete latest artifact QA. OS background outbox scheduling was proposed, not implemented. Scheduler metadata must not contain message content or secrets. |
| iOS | Verify the completed artifact; then build/check encrypted inbox and server mute. Implement delta sync, server message/inbox search and context, paginated inbox/business readers, per-room visible reads, POST changes, never-sent encrypted drafts, and needed timeline bounds. Reuse current stores/screens. |
| Every platform | All sender/recipient pairings; send/read/edit/delete/react/reply/media; foreground/background; missed mutations; multiple devices/tabs; account/logout; denied/revoked membership; cache cleanup/quota/expiry; retry/rate limits. Preserve truthful Sent/Read semantics. |

### C. Protocol/backend gaps

- **Topic reads:** selected-topic ACKs remain guarded off. A correct protocol must cover topic-specific read state, unread totals, receipts, push suppression and delete reconciliation. Do not simply remove the guard.
- **True delivery receipts:** no new durable recipient-device acknowledgement protocol exists. Server acceptance is Sent, not Delivered. Decide whether to add device-delivery receipts and verify their multi-device semantics.
- **Remaining query caps:** room-page counterparty reads can still exceed a batch row cap in very large groups; the legacy two-argument socket startup room RPC has old limits; inspect reaction query plans and identity batches. New sync maps are bounded at 10,000, not unlimited.
- **Inbox invalidation:** safe web head refresh can discard loaded tail pages. Keeping them requires reliable membership/block/business/task invalidation, not only message events.
- **Background sends:** no WorkManager implementation, iOS OS send scheduler, browser service worker push or background-sync path was completed. Outboxes currently recover when foreground execution resumes. Be honest about OS restrictions.
- **Media:** thumbnails are a bounded memory cache, not persisted derivatives. Finish actual upload cancel/progress/retry, original quota/expiry and abandoned-upload cleanup. Retain download authorization on every original/thumbnail request.
- **Push:** verify real APNs/FCM registration, wrong-account delayed notifications, logout/tap routes, duplicates, worker crash after provider acceptance, retry/expiry, mute/read/revocation, background and terminated apps. Local worker proof is insufficient. Founder owns hosted credentials/configuration and physical-phone release steps.
- **Security:** reconcile the original audit with current code and separate security work, including #2663, before editing that area. Recheck direct RPC grants, block/revocation on all paths, reply/topic binding, represented-author ownership, media retention and closed-task access. Some old audit items already exist; do not rebuild them.
- **Operations:** current metrics are bounded process-local samples. Production aggregation, alerts, useful crash/error telemetry and runbooks remain. Never log content, tokens or private identities to obtain them.

### D. CI and release

Most drafts are **red**, not release-ready. Fresh handoff metadata showed overall green on #2668, #2669, #2671, #2674 and #2718. The register preserves that snapshot; recheck all current heads.

Specific earlier CI observations: backend #2712 had 6,607 passing and 26 failing old-contract/mock expectations; web later slices retained a stale polling-interval expectation while 122 suites/2,382 assertions passed; Android later slices retained seven search/local-mute expectations while compilation/lint/instrumented checks passed. These are **observations for specific runs**, not a blanket explanation for all current failures. Latest iOS CI failures still need classification. Never assume every failure is stale or waive it. Do not write tests against the founder's instruction.

Finish exact integrated-artifact checks, fix actual product regressions, reconcile check-policy conflicts with the founder, and prepare rollout/rollback. Review stacked dependencies in order; each tip includes earlier slices. Retarget/rebase carefully. No hosted migration, production deployment or store release happened here.

### E. Measure before claiming competitor-level performance

Current evidence establishes many correctness improvements, not production latency or competitor parity. Measure stable builds under controlled network/device conditions, separately from compiler/emulator contention.

Suggested targets to agree on—**not measured results or promises**:

| Metric | Proposed validation |
| --- | --- |
| Send to optimistic bubble | p95 under 100 ms in a warm thread; no main-thread attachment reads. |
| Cached thread first useful content | p95 under 300 ms on representative devices; do not wait for network. |
| Acceptance and recipient visibility | Separate p50/p95/p99/failure rate. Initial controlled-good-network goals: p95 under 500 ms server acceptance and under 1 s recipient visibility. |
| Reconnect | No missing/duplicate messages or missed edits/deletions; report time/bytes for small and large backlogs. |
| Scroll/memory | Normal device frame budget, bounded DOM/timeline/cache/storage, stable anchors during prepend/eviction/return-to-latest. |
| Large inbox/history | Stable pages/totals, no URL/result-cap errors, bounded indexed queries at realistic cardinalities. |
| Failure recovery | Lost ACK, disconnect, process death and account changes preserve or explicitly reject intent; never silently send under another identity. |

Use actual app actions, fault controls and read-only timing observations. Do not turn this into a test-code/coverage project. Physical devices, hostile networks, providers and hosted load remain unverified.

## 5. Contracts the next session must preserve

- Room/person read and socket read accept optional **throughMessageIds**, mapping room UUID to newest visible accepted message UUID, maximum 500 entries. **throughMessageId** remains compatibility fallback; if both are sent it must be a map value. Empty map changes nothing. Invalid/wrong-room/out-of-scope entries are rejected. Returned unread totals cover the full authorized scope.
- A legacy single cursor updates only its own room; cursorless older clients use request time separately for each room. Topic-filtered views still do not emit global read ACKs.
- Both existing changes routes accept GET and new POST: /chat/rooms/:roomId/changes and /chat/conversations/:otherUserId/changes. POST body has cursor map, optional until map, limit and asBusinessUserId. Response retains messages/tombstones, syncCursors, untilCursors, hasMore, removedRoomIds, resetRequired and readReceipts. Prefer POST. Older-server GET fallback should be limited to 404/405 with a small URL; otherwise safely refresh history.
- Room/business inboxes return hasMore/nextCursor and complete total/totalUnread. before is timestamp plus room UUID; default limit 200, max 500; filter/authorize before paging.
- chat:preferences_changed carries only an at timestamp to the account/current business staff. Foreground/reconnect refresh remains necessary for missed ephemeral events.
- Direct Read requires the other member's real boundary. Group Sent must not imply everyone read it.
- Mutable sync_version is for mutation recovery, not immutable creation/read order.
- Retries preserve stable message/upload IDs and account/represented-sender scope. Tested logical deduplication is not an unconditional exactly-once transport guarantee.
- Delayed pushes include intended recipient identity; native display/tap must check it. Generic text does not replace authorization.

## 6. Applied local migrations

All 17 are recorded locally and **must not be edited**:

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

Backend contracts must be available before clients rely on them. Rehearse fresh replay and the exact final artifact combination before founder-owned hosted rollout.

## 7. Complete PR register

Every row was an open draft at capture. Red indicates a failing check, not its diagnosis. Green indicates the captured overall check succeeded. Pending needs a fresh check. The head SHA is the implementation checkpoint; subsequent handoff-document commits can change the latest head.


### Backend/database

| PR | Change | Head branch @ revision | Base | CI snapshot |
| --- | --- | --- | --- | --- |
| [#2665](https://github.com/WangPantopus/skinny-pantopus/pull/2665) | Preserve unseen chat messages and recover precise read receipts | codex/chat-reliability-backend @ 68ce25ea7 | master | Red |
| [#2666](https://github.com/WangPantopus/skinny-pantopus/pull/2666) | Persist chat mute settings and give reads their own request budget | codex/chat-preferences-performance @ 7b917c164 | codex/chat-reliability-backend | Red |
| [#2670](https://github.com/WangPantopus/skinny-pantopus/pull/2670) | Catch up cached chat history with commit-ordered message changes | codex/chat-incremental-sync @ 359e62a8e | codex/chat-preferences-performance | Red |
| [#2672](https://github.com/WangPantopus/skinny-pantopus/pull/2672) | Search complete chat history and open older messages directly | codex/chat-search-context @ 9f2cda8dc | codex/chat-incremental-sync | Red |
| [#2673](https://github.com/WangPantopus/skinny-pantopus/pull/2673) | Stream chat attachments with bounded upload and image processing | codex/chat-streamed-media @ 4113905a8 | codex/chat-search-context | Red |
| [#2676](https://github.com/WangPantopus/skinny-pantopus/pull/2676) | Deliver committed chat changes across API processes | codex/chat-cross-process-delivery @ 9545b0cd0 | codex/chat-streamed-media | Red |
| [#2677](https://github.com/WangPantopus/skinny-pantopus/pull/2677) | Page chat inboxes without truncating memberships | codex/chat-inbox-pagination @ 45ec1330b | codex/chat-cross-process-delivery | Red |
| [#2679](https://github.com/WangPantopus/skinny-pantopus/pull/2679) | Preserve chat cache through authorization outages and seek room previews | codex/chat-query-resilience @ d15414c44 | codex/chat-inbox-pagination | Red |
| [#2680](https://github.com/WangPantopus/skinny-pantopus/pull/2680) | Reconcile chat badges across processes without recounting message history | codex/chat-badge-reconciliation @ 5ac4870a6 | codex/chat-query-resilience | Red |
| [#2683](https://github.com/WangPantopus/skinny-pantopus/pull/2683) | Search conversations beyond the loaded inbox page | codex/chat-inbox-search @ cad45f630 | codex/chat-badge-reconciliation | Red |
| [#2687](https://github.com/WangPantopus/skinny-pantopus/pull/2687) | Recover chat push delivery after server interruption | codex/chat-durable-push @ f7b996bd8 | codex/chat-inbox-search | Red |
| [#2689](https://github.com/WangPantopus/skinny-pantopus/pull/2689) | Compute muted chat badges across the complete inbox | codex/chat-muted-badges @ 87fd7bc2f | codex/chat-durable-push | Red |
| [#2690](https://github.com/WangPantopus/skinny-pantopus/pull/2690) | Bind delayed chat pushes to the intended account | codex/chat-push-account-binding @ e2fe0b460 | codex/chat-muted-badges | Red |
| [#2695](https://github.com/WangPantopus/skinny-pantopus/pull/2695) | Reuse private thumbnails and bound image processing | codex/chat-thumbnail-cache @ 63ff8dca2 | codex/chat-push-account-binding | Red |
| [#2698](https://github.com/WangPantopus/skinny-pantopus/pull/2698) | Keep delayed chat push previews private across account switches | codex/chat-push-private-previews @ b812789d8 | codex/chat-thumbnail-cache | Red |
| [#2699](https://github.com/WangPantopus/skinny-pantopus/pull/2699) | Keep older person conversations accessible beyond 1,000 memberships | codex/chat-person-room-scope @ 3ae0768bd | codex/chat-push-private-previews | Red |
| [#2701](https://github.com/WangPantopus/skinny-pantopus/pull/2701) | Relay typing across API processes with current chat authorization | codex/chat-typing-relay @ a56d8cc8f | codex/chat-person-room-scope | Red |
| [#2705](https://github.com/WangPantopus/skinny-pantopus/pull/2705) | Synchronize private chat mute settings across devices | codex/chat-preference-signals @ c3d9dc90c | codex/chat-typing-relay | Red |
| [#2706](https://github.com/WangPantopus/skinny-pantopus/pull/2706) | Bound chat latency metric memory and snapshot work | codex/chat-metrics-bounds @ 63378f186 | codex/chat-preference-signals | Red |
| [#2712](https://github.com/WangPantopus/skinny-pantopus/pull/2712) | Keep chat presence accurate across devices and API processes | codex/chat-presence-relay @ d8be1ea7d | codex/chat-metrics-bounds | Red |
| [#2717](https://github.com/WangPantopus/skinny-pantopus/pull/2717) | Keep active older conversations in paginated room and business inboxes | codex/chat-room-pagination @ cbd4ff797 | codex/chat-presence-relay | Red |
| [#2718](https://github.com/WangPantopus/skinny-pantopus/pull/2718) | Keep delayed chat inserts beyond earlier read boundaries | codex/chat-insert-order @ a64ce681e | codex/chat-room-pagination | Green |
| [#2721](https://github.com/WangPantopus/skinny-pantopus/pull/2721) | Keep unseen chat rooms unread with per-room visible boundaries | codex/chat-room-read-boundaries @ 1bd0f282b | codex/chat-insert-order | Red |
| [#2722](https://github.com/WangPantopus/skinny-pantopus/pull/2722) | Preserve explicit business identity when sending group messages | codex/chat-business-sender @ 360302925 | codex/chat-room-read-boundaries | Red |
| [#2725](https://github.com/WangPantopus/skinny-pantopus/pull/2725) | Keep large person conversations within history and sync transport limits | codex/chat-large-conversation-sync @ 04561fef6 | codex/chat-business-sender | Red |
| [#2727](https://github.com/WangPantopus/skinny-pantopus/pull/2727) | Checkpoint complete reaction summaries and chat performance handoff | codex/chat-reaction-pages @ 97d7e8cc1 | codex/chat-large-conversation-sync | Pending |

### Web/shared TypeScript API

| PR | Change | Head branch @ revision | Base | CI snapshot |
| --- | --- | --- | --- | --- |
| [#2669](https://github.com/WangPantopus/skinny-pantopus/pull/2669) | Fix web chat recovery, deduplication, and visible read receipts | codex/chat-web-reliability @ 899307f41 | master | Green |
| [#2671](https://github.com/WangPantopus/skinny-pantopus/pull/2671) | Retain encrypted web chat outbox and recent history | codex/chat-web-outbox-cache @ f8f4ac344 | codex/chat-web-reliability | Red |
| [#2674](https://github.com/WangPantopus/skinny-pantopus/pull/2674) | Recover web chat incrementally and bound timeline rendering | codex/chat-web-incremental @ 652225590 | codex/chat-web-outbox-cache | Red |
| [#2678](https://github.com/WangPantopus/skinny-pantopus/pull/2678) | fix(chat): search full history and save notification preferences | codex/chat-web-search-preferences @ 6a22765a3 | codex/chat-web-incremental | Red |
| [#2682](https://github.com/WangPantopus/skinny-pantopus/pull/2682) | Paginate and bound both web conversation lists | codex/chat-web-inbox-pagination @ bb117ca31 | codex/chat-web-search-preferences | Red |
| [#2684](https://github.com/WangPantopus/skinny-pantopus/pull/2684) | Preserve cookie host for local web chat sockets | codex/chat-web-loopback-socket @ 3ebd17a00 | codex/chat-web-inbox-pagination | Red |
| [#2685](https://github.com/WangPantopus/skinny-pantopus/pull/2685) | Enable edit and delete in existing web chat controls | codex/chat-web-message-actions @ 031208a91 | codex/chat-web-loopback-socket | Red |
| [#2688](https://github.com/WangPantopus/skinny-pantopus/pull/2688) | fix(web): queue shared chat cards through the durable outbox | codex/chat-web-share-outbox @ 70c3a2521 | codex/chat-web-message-actions | Red |
| [#2692](https://github.com/WangPantopus/skinny-pantopus/pull/2692) | fix(web): preserve newer reactions across delayed acknowledgments | codex/chat-web-reaction-recovery @ 11ea75ae9 | codex/chat-web-share-outbox | Red |
| [#2694](https://github.com/WangPantopus/skinny-pantopus/pull/2694) | fix(web): exclude muted chats from the global unread badge | codex/chat-web-muted-badge @ aa4e7222b | codex/chat-web-reaction-recovery | Red |
| [#2697](https://github.com/WangPantopus/skinny-pantopus/pull/2697) | perf(web): use bounded previews for chat images | codex/chat-web-image-previews @ 7d3bba85b | codex/chat-web-muted-badge | Red |
| [#2702](https://github.com/WangPantopus/skinny-pantopus/pull/2702) | Coordinate chat retry recovery across browser tabs | codex/chat-web-outbox-coordination @ b05536bf2 | codex/chat-web-image-previews | Red |
| [#2707](https://github.com/WangPantopus/skinny-pantopus/pull/2707) | Synchronize chat typing and mute controls across devices | codex/chat-web-live-preferences @ 37f286575 | codex/chat-web-outbox-coordination | Red |
| [#2708](https://github.com/WangPantopus/skinny-pantopus/pull/2708) | Keep outgoing chat workers isolated across account sessions | codex/chat-web-session-worker @ d2a86ab2e | codex/chat-web-live-preferences | Red |
| [#2719](https://github.com/WangPantopus/skinny-pantopus/pull/2719) | Retain encrypted web chat drafts and attachment intent | codex/chat-web-composer-drafts @ fa7570d07 | codex/chat-web-session-worker | Red |
| [#2723](https://github.com/WangPantopus/skinny-pantopus/pull/2723) | Page existing web business inboxes with authoritative totals | codex/chat-web-business-paging @ 586caddba | codex/chat-web-composer-drafts | Red |
| [#2726](https://github.com/WangPantopus/skinny-pantopus/pull/2726) | Acknowledge visible room boundaries and show direct room receipts | codex/chat-web-visible-room-reads @ acc62f25b | codex/chat-web-business-paging | Red |

### iOS

| PR | Change | Head branch @ revision | Base | CI snapshot |
| --- | --- | --- | --- | --- |
| [#2667](https://github.com/WangPantopus/skinny-pantopus/pull/2667) | fix(ios): merge live chat events and recover complete loaded history | codex/chat-ios-reliability @ b30a2995d | master | Red |
| [#2675](https://github.com/WangPantopus/skinny-pantopus/pull/2675) | feat(ios): keep encrypted recent chat history and recover outgoing sends | codex/chat-ios-outbox @ b70be8997 | codex/chat-ios-reliability | Red |
| [#2693](https://github.com/WangPantopus/skinny-pantopus/pull/2693) | fix(ios): bind chat notifications to their recipient account | codex/chat-ios-notification-account @ ea7d1177a | codex/chat-ios-outbox | Red |
| [#2709](https://github.com/WangPantopus/skinny-pantopus/pull/2709) | fix(ios): preserve authoritative chat badges and live presence | codex/chat-ios-live-state @ 2077e39fd | codex/chat-ios-notification-account | Red |
| [#2710](https://github.com/WangPantopus/skinny-pantopus/pull/2710) | fix(ios): unblock queued sends after socket acceptance | codex/chat-ios-outbox-flow @ fc88a6058 | codex/chat-ios-live-state | Red |
| [#2714](https://github.com/WangPantopus/skinny-pantopus/pull/2714) | perf(ios): use bounded chat previews and background file reads | codex/chat-ios-media-latency @ 61fdfbabf | codex/chat-ios-outbox-flow | Red |
| [#2720](https://github.com/WangPantopus/skinny-pantopus/pull/2720) | fix(ios): encrypt saved conversation list previews | codex/chat-ios-encrypted-inbox @ 795f9ada6 | codex/chat-ios-media-latency | Red |
| [#2724](https://github.com/WangPantopus/skinny-pantopus/pull/2724) | fix(ios): synchronize chat mute preferences and unread badges | codex/chat-ios-server-mute @ 9221185ef | codex/chat-ios-encrypted-inbox | Red |

### Android

| PR | Change | Head branch @ revision | Base | CI snapshot |
| --- | --- | --- | --- | --- |
| [#2668](https://github.com/WangPantopus/skinny-pantopus/pull/2668) | fix(android): recover chat gaps and mark only visible messages read | codex/chat-android-reliability @ c6378a091 | master | Green |
| [#2681](https://github.com/WangPantopus/skinny-pantopus/pull/2681) | feat(android): encrypt recent chat history and synchronize mute preferences | codex/android-chat-storage @ dbaf96578 | codex/chat-android-reliability | Red |
| [#2686](https://github.com/WangPantopus/skinny-pantopus/pull/2686) | feat(android): persist encrypted outgoing chats and ordered retries | codex/android-chat-outbox @ 0c12aff4f | codex/android-chat-storage | Red |
| [#2691](https://github.com/WangPantopus/skinny-pantopus/pull/2691) | fix(android): deduplicate chat pushes and enforce recipient scope | codex/android-chat-push @ 045f6a992 | codex/android-chat-outbox | Red |
| [#2696](https://github.com/WangPantopus/skinny-pantopus/pull/2696) | perf(android): recover chat revisions and stream queued attachments | codex/android-chat-recovery @ 2f81e2f3a | codex/android-chat-push | Red |
| [#2700](https://github.com/WangPantopus/skinny-pantopus/pull/2700) | fix(android): encrypt inbox previews and page unread conversations | codex/android-chat-inbox @ 66c94ad0e | codex/android-chat-recovery | Red |
| [#2703](https://github.com/WangPantopus/skinny-pantopus/pull/2703) | feat(android): search chat history and open older message context | codex/android-chat-search @ 5b83229b8 | codex/android-chat-inbox | Red |
| [#2704](https://github.com/WangPantopus/skinny-pantopus/pull/2704) | fix(android): synchronize chat preferences and clarify queued status | codex/android-chat-session-polish @ d209698c7 | codex/android-chat-search | Red |
| [#2711](https://github.com/WangPantopus/skinny-pantopus/pull/2711) | feat(android): preserve encrypted chat drafts and selected files | codex/android-chat-drafts @ bee7190a3 | codex/android-chat-session-polish | Red |
| [#2713](https://github.com/WangPantopus/skinny-pantopus/pull/2713) | fix(android): clear stale chat presence after disconnect | codex/android-chat-presence @ 206530f2c | codex/android-chat-drafts | Red |
| [#2715](https://github.com/WangPantopus/skinny-pantopus/pull/2715) | perf(android): bound chat timeline memory while preserving scroll position | codex/android-chat-window @ e5a91ced2 | codex/android-chat-presence | Red |
| [#2716](https://github.com/WangPantopus/skinny-pantopus/pull/2716) | fix(android): promote encrypted drafts with an atomic folder move | codex/android-chat-draft-promotion @ 806a45c35 | codex/android-chat-window | Red |

## 8. Worktrees and runtime recovery

Public documentation omits machine-specific paths, credential values and fixture identities. The local-only companion is **~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md**. It contains paths/recovery notes, not secret values, and must not be committed.

| Area | Existing worktree directory name | Current source |
| --- | --- | --- |
| Backend/root | d378/skinny-pantopus | codex/chat-reaction-pages; #2725 plus #2727 checkpoint |
| Web | chat-web-reliability/skinny-pantopus | codex/chat-web-visible-room-reads, acc62f25b |
| Android source | android-chat-storage/skinny-pantopus | codex/android-chat-draft-promotion, 806a45c35 |
| Android build | chat-android-reliability/skinny-pantopus | Detached 806a45c35, built/installed |
| iOS source | chat-ios-outbox/skinny-pantopus | codex/chat-ios-server-mute, 9221185ef |
| iOS build | chat-ios-reliability/skinny-pantopus | Detached 61fdfbabf, signed build succeeded, install/QA unconfirmed |

Web has untracked generated .next-build output; do not commit or blindly delete it. Other client source worktrees were clean when inspected. Root unfinished code is saved in #2727. Local database remains alive; APIs need restart. Build concurrency was bounded: Android used two workers and the signed iOS build one job. Reuse derived/build output. Do not stop unrelated simulator daemons or emulators.

Earlier sections of docs/message-chat-plan.md describe progress at their writing time. The artifact/verification distinctions in this handoff supersede those progress statements. The original audit below remains a traceability record, not authorization to redo existing work or write tests.

## 9. Copy-paste next-session prompt

~~~text
Resume the Pantopus Messages/Chat performance and reliability work from the existing worktrees and stacked draft PRs. Read AGENTS.md, NEXT_STEPS.md, the current mobile pilot brief, docs/chat-performance-handoff-2026-10-23.md, and the local-only ~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md. Use docs/message-chat-plan.md as supporting history. Inspect actual Git/worktree/PR/CI/runtime state before trusting recorded state.

Do not start over. Preserve current design, layouts, navigation and launch flags. Do not write test code, unit tests or coverage work. Verify actual web, native iOS simulator and Android emulator flows against the real local backend/database, including the other person's view, reload/relaunch, offline/reconnect, lost responses, account changes and media. Keep secrets, raw logs, tokens and personal data out of Git/PRs/chat.

The founder already approved encrypted account-scoped device history and the private ChatPushDelivery table. All 17 chat migrations through 20261023235000 are already applied locally and immutable. Do not edit them or change hosted databases/configuration. No PR from this effort has been merged/deployed. Do not merge an auto-deploying backend stack without founder release authorization.

First restore owned local API processes and verify saved artifacts. Android 806a45c35 is installed and passed bidirectional send/read; draft/media/restart/window checks remain. Signed iOS 61fdfbabf succeeded during interruption: install/verify before another build. iOS source 9221185ef adds encrypted inbox/mute not in that artifact. Web acc62f25b needs a combined production build/final browser pass. Finish the partially verified reaction checkpoint #2727, including REST/socket/backfill and actual app reactions.

Then complete the handoff's prioritized work: native per-room visible reads; POST delta transport; iOS delta/search/paging/drafts and latest inbox/mute QA; Android business paging/background outbox and recovery QA; web query/invalidation follow-ups; proper topic-read semantics; physical push/provider verification and measured latency/recovery. Audit current code before assuming historical checklist items are missing. Distinguish implemented, app-verified, CI-green and released. Do not claim WeChat/WhatsApp parity without measurements and complete verification.

Commit/push coherent changes and open/update small stacked PRs. Keep CI failures visible and fix actual product regressions. Flag conflicts requiring test-code changes instead of overriding my no-test-work instruction. You may use up to three parallel client agents in separate existing worktrees, with backend/integration centrally owned. Continue until the authorized work and verification are complete, or identify a concrete founder-owned/external blocker. Keep the handoff current.
~~~

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
