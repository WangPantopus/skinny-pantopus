# Messages / Chat — consolidated continuation handoff

## Continuation in progress — October 24, about 07:40 UTC

The founder resumed work in the same four drafts with one priority: chat that is actually fast and smooth on the main paths (open, send, receive, read, reconnect, photos), measured, not more bookkeeping. No new PRs; nothing merged, deployed or released. Sections 1–9 below remain the 05:15 UTC checkpoint until this section is folded in.

- **Master integrated into all four drafts** with ordinary merge commits (no force-push): #2807 native trace headers, #2808 home quorum, #2809 chat access removal and deleted-message files answering 410, #2810 web returnTo/OAuth CSRF/CSP, #2811 1 MB JSON bodies read after the write limiters, #2813 business access fails closed. Backend `019510a77` took master's superset of the shared fail-closed `businessPermissions.js` change; the chat sync cursor stays a flat room map well inside the new body limits. Web merged as `54ab102e0`, iOS `6781c70bb`, Android `120f7cbf3`.
- **Backend send path, `588d741de`.** The send route's independent permission reads now start together and are still applied in the original order, so refusals are unchanged; the inserting transaction still re-decides membership, blocks, topic and reply admission. A message announced by its own insert is fanned out immediately (no 10 ms coalescing, no reaction read for a brand-new message), and acceptance no longer waits for the badge read and push hand-off. Interleaved local A/B under the same host load: counterpart sees the message p50 81 → 47 ms (p95 120 → 80), sender acceptance p50 65 → 40 ms, no loss or duplicates. Live checks: non-member and missing room still 403, retried and concurrent same-key sends return one message. Chat suites keep exactly the 31 known expectation failures.
- **Server baselines on `588d741de`** (local, host load 10–18 from native builds; not production numbers): typing indicator 14 ms; read acknowledgement 18 ms, sender sees Read 45 ms; inbox first page 36–60 ms; 50-message history 40–55 ms; socket connect 11 ms; a 730 KB photo uploads in 114 ms, reaches the counterpart's socket 156 ms after upload start, first 512 px thumbnail 89 ms, cached 25 ms. The synthetic 532-room conversation opens in 112 ms; its no-change catch-up costs 128 ms and 89 KB of read receipts (a worst case worth trimming later).
- **Runtime.** APIs 63100/63102 run `588d741de`, started detached from the agent session; 63103 is a measurement-only API on the same code. The preserved older web artifacts (63107 d561 with the genuine false-Read cache, 63110, 63111, 63112) proxy to 63102, and pages in the earlier session's browser still hold sockets to it; the original 63107 tab itself remains unavailable to this session.
- **Backend heartbeat, `01bdc6e8c`.** Socket.IO now pings every 10 s with a 10 s answer window. Freezing a measurement-only API under a connected client, the client noticed the dead connection after 43.5 s with the defaults and after 18.5 s with this setting (two trials each). Both owned APIs run `01bdc6e8c`. Quiet-window server numbers on this code: acceptance p50 35 ms (p95 60), counterpart socket p50 41 ms (p95 66, p99 78) in the same process, p50 80 ms when the recipient is connected to another API process (production runs one API container per environment). Backend CI on `588d741de`: the same 31 classified failures, nothing new.
- **Web, #2805 head `2e758fdc3`** (artifact build `-E9GCfaX8bYaWSi8Er0fo`, measured in headless Chrome with isolated profiles against API 63100, interleaved with baseline `6cc654fb9`). Sent bubble on screen p50 31.7 → 6.7 ms (first send in a fresh page 144–155 → 7–14 ms); missed messages after the browser returns online p50 7.0 s → 0.10–0.15 s; cold Messages rows p50 407 → 327 ms; first conversation paint p95 380 → 241 ms; scrolling 650–1,000 messages with no long tasks; counterpart sees text p50 76–82 ms, no duplicates or reordering. Repairs: immediate bubble and online/foreground reconnect, early storage open and an on-demand emoji picker (550 KB out of every page), offline threads open at the newest message, load failures say so instead of "No messages yet", a 404/410 file now removes only its own saved copies (previously a deletion made offline could reappear after reload), newest-rows-first rendering with 8× faster sorting, and the outbox no longer cancels a saved inbox restore. Passed on exact artifacts: verified-profile bootstrap then full offline (inbox, conversation, photo, PDF, topic link, back, offline send and reply seen once by the counterpart with quote, sender Read), sign-out and account switch, deletion reloads at 50/200/1,500 ms, a held successful response after access removal, and the 410 purge. Follow-up head `a1a815187` (own artifact, headless Chrome, backend `01bdc6e8c`): the saved inbox is re-saved after a confirmed deletion or room denial, so an offline reload shows the inbox without the deleted text or denied room (previously "No saved inbox"); a first open no longer waits on a profile lookup and the emoji table parse moved out of the open, giving first-open paint p50 110 / p95 178 ms (n=16) with the pointer already over the page; the remaining 73–117 ms first-hover wait in traces is headless Chrome's own hover update, not chat work. Cold Messages rows p50 375 / p95 457 ms, mostly framework evaluation, shell hydration and the app shell rendering under a fallback then remounting (which restarts the inbox request); chat's share is about 58 ms for the saved-inbox read and 27–35 ms for rows. A safe-looking 25 ms cut (skipping the storage cleanup write when the session matches) was left for security review. Upload failure/retry, cancel, reload during upload and corrupt received photos pass. A 10 s server outage with the browser online reconnects in p50 4.2 s, governed by the socket client's back-off rather than the heartbeat. Not run: quota/expiry media; the 63107 upgrade (blocked on the founder). CI: only `notificationStreams.test.tsx:114`.
- **Android, #2806 head `522f3cd56`** (installed `android-chat-522f3cd56.apk`, debug on a 2-vCPU emulator with software rendering). Tap → local bubble p50 544 → 144 ms (p95 723 → 555); the peer browser shows a message 12–28 ms after server acceptance; restored threads and switched topics open at the newest message; a peer's read in a shared task room no longer wipes the encrypted cache. Passed: offline upgrade from 7c's encrypted history with the old plaintext image cache removed, topic metadata and offline chips, global badge across process death, the reply08 photo quote, received PDF/photo offline reopen and offline cold relaunch, missed Read recovered by bounded POST, background outbox (offline queue + normal kill + network restore delivered once, lost upload response, kill during upload, logout purge), canonical Read clearing, interrupted cache retirement, 403 retirement. Not run: explicit ineligible-Read fixtures (no shared task room). In progress: the ~170 ms from tap to the request leaving the device, a possible cold-start slowdown (6.0–7.0 s vs 3.9–5.7 s, uncontrolled), and showing a pending photo's image immediately. CI: the same 33 unit failures; the 19 newer ones are strict mocks without stubs for `conversationTopicsCopy` and `scopedEventsOf`, with no production defect found.
- **iOS, #2803 head `889486707`** (installed `Pantopus-889486707.app` over `09680b5f9` without a wipe; Debug simulator build against API 63105 → 63100; peer in the browser). Before → after (`b502bec72` → `889486707`, p50/p95 ms): own bubble 110/129 → 61/77; peer sees a sent message 579 → 301/349; peer's message drawn 272/367 → 156/203; a missed message after a 65 s outage 27,375 → 2,259 (1,299 after foregrounding); an offline launch now re-reads the inbox 4.3 s after the network returns (previously never). Host load was lower in the final runs, so part of the gain is load; the halved timeline rebuilds per send confirm the repair independently. Repairs: only changed rows re-render, immediate reconnect on foreground or network return with a 5 s cap, offline-launch catch-up (Socket.IO's failed first connection was never treated as a reconnect), queued offline sends say "Sending…" instead of inviting a duplicate Retry, one fewer timeline rebuild per send. Passed: offline-launch catch-up, background delivery after network return, expired background allowance resent exactly once on foreground, edit/delete seen by the peer after relaunch, retirement with a read-only history directory and the Keychain fallback with a read-only store root, received PDF offline from the encrypted cache with no plaintext on disk. Not run: the 67-room business inbox (needs a fixture that does not sign out the iOS account and purge its store), topic → All after deep paging with Retry, media sign-out isolation and the over-limit file. In progress: newest-rows-first conversation open (cached open is 330/414 ms because every row renders on open), own-bubble time and an immediate pending-photo preview. CI: the same 11 classified expectations.
- **Founder decisions this continuation cannot make.**
  1. *Existing tests that contradict approved behavior* keep CI red on all four drafts: backend 31 (send no longer clears unseen unread, old RPC/mocked-trigger/committed-signal assumptions, five sequential tests that exhaust the real limiter, old presence/typing assumptions, streamed-attachment expectations), web 1 (a 5 s poll where 15 s plus jitter was approved), iOS 11 (synchronous search where debounced server search was approved, immediate mute, reply audience and cross-room quote fixtures, an attachment endpoint fixture, a paginated-refresh assumption), Android 33 (the earlier 14 plus 19 strict mocks without stubs for calls the new code makes). Either authorize updating those existing tests in these drafts, or keep them red; no test was changed and no runtime behavior was weakened.
  2. *Delivered ticks.* There is Sent (server accepted) and Read, but no recipient-device Delivered. A WhatsApp-style Delivered state needs a product decision (a new bubble state and its privacy meaning) and an additive per-participant delivered boundary (columns on the existing participant row, acknowledged by the recipient's app on receipt), not a new table.
  3. *Notification text.* Chat pushes deliberately say "New message — Open Pantopus to read it" with no sender or preview; WhatsApp shows both by default. Changing that is a privacy/product choice.
  4. *Hosted and devices.* The three new migrations apply to staging/production only at release; APNs/FCM delivery, background and terminated-app behavior, cold start, scroll smoothness and network handover need real phones and release builds. The push worker claims four deliveries at a time, so large groups fan out in sequence; revisit with real providers.
  5. *The original 63107 tab* now lives only in the closed ChatGPT/Codex app's profile: reopen it there for the upgrade check, or release the preservation.
- **Environment.** The earlier ChatGPT/Codex app exited around 07:35 UTC, taking its child processes with it: the preserved web servers (restarted at 08:03 UTC from their exact artifacts), both emulators (only the chat emulator 5590 was restarted, without a wipe; 5586 belongs to another session) and the native proxies (restarted by their owners). Its in-app tabs, including the original 63107 false-Read tab, are closed; the profile remains on disk inside that app.

**Checkpoint: October 24, 2026, approximately 05:15 UTC (October 23 local). The founder requested this handoff; implementation and app verification are paused at the recorded state. This document supersedes the runtime, PR and backlog status in the October 23 handoff. Nothing was merged, deployed or released.**

The stack is now four draft PRs. Consolidation is complete; the reliability/performance program is not. Substantial behavior has been repaired and exercised in real apps, but the newest client sources are ahead of their verified artifacts, CI is not green, and physical-device/provider/performance evidence remains incomplete. There is no measured basis for WeChat/WhatsApp parity, durable recipient-device Delivered, or end-to-end encryption.

Read AGENTS.md, NEXT_STEPS.md and the current mobile pilot brief first. Then read this checkpoint, the [complete 131-to-four preservation map](chat-consolidation-map-2026-10-23.md), and the local-only `~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md`. Its latest per-client handoffs and artifact/fixture manifests contain the operational details. Do not publish private manifests, raw logs, tokens, credentials, screenshots containing personal data or database archives.

## 1. Four active PRs; preservation is complete

| Area | Active draft / branch | Latest implementation checkpoint | What it contains |
| --- | --- | --- | --- |
| Backend/database + integration docs | [#2804](https://github.com/WangPantopus/skinny-pantopus/pull/2804), `codex/chat-consolidated-backend` | `495493f56a092fccf59a38453e9f2612001528e1`; this handoff is a later documentation commit | 39 backend implementation originals plus latest #2747 documentation; subsequent topic/writer admission, media privacy and integration evidence |
| Web + shared TypeScript chat API | [#2805](https://github.com/WangPantopus/skinny-pantopus/pull/2805), `codex/chat-consolidated-web` | `52bcf5ab7c4c5fde068c0c1820e92a8958a76970` | 33 originals; encrypted received media, receipt reconciliation, offline shell/inbox, session binding and deletion retirement |
| iOS | [#2803](https://github.com/WangPantopus/skinny-pantopus/pull/2803), `codex/chat-consolidated-ios` | `aed5ac09875cce108b081da4fbac9a78e5e8ba40` | 32 originals; canonical retirement, viewport/account fences, encrypted received media, finite background sends and shared media viewers |
| Android | [#2806](https://github.com/WangPantopus/skinny-pantopus/pull/2806), `codex/chat-consolidated-android` | `5732fc834270fd9fb8618be3c73bae35db7d78d4` | 26 originals; topic/badge/receipt/epoch/media-reply repairs, account capture, encrypted received media and bounded background scheduling |

These are the only four PRs created in this continuation. All 131 earlier drafts (original 63 plus 68 resumed, through #2801) were reconciled. Other sessions' PRs are excluded. The full map lists every old PR, exact captured head, replacement and historical CI state; the [October 23 register](chat-performance-handoff-2026-10-23.md#7-complete-current-pr-register) preserves their old titles/stack relationships.

Consolidation used common master `4e7582831e1aa71e03c50f28728e324a57ebaf7a`, still the remote master when rechecked at this handoff. Effective trees from backend `7239311c2`, web `90d453f1d`, iOS `3837b1f96`, Android `7c2dcb7d9` were preserved instead of blindly replaying stacked commits. All 130 implementation heads are ancestors of their corresponding preserved candidate tips. This ancestry is the preservation proof for the old stacks; the new consolidated commits carry their effective trees on the common master baseline. The one unique head, latest #2747 documentation `926a044d42ece42ca00c437fa7962c0140b5d9be`, was retained. Shared API changes belong to web. Upstream native URL-query redaction remains present.

All originals were closed **only after** replacements were pushed, cross-linked and checked for preservation. Their original branches, commits, PR descriptions and failure history remain; cross-link notices were prepended without discarding the old descriptions. Local `refs/archive/chat-consolidation-20261023/pr-N` pin all 131 captured heads. Final recheck found zero archive-ref mismatches and zero byte mismatches across all 223 original migration files. No original ref was deleted or force-pushed. Use the four consolidated heads as the active CI targets. The historical checks remain available for diagnosis.

### Coherent commits created in the four drafts

The original PR-by-PR inventory remains in the preservation map and October 23 handoff. These are the consolidation and repair commits added in this continuation, in order; the final handoff is a later documentation commit in #2804.

| Draft | Commit sequence and purpose |
| --- | --- |
| #2804 | `876a83ef2` effective backend tree and handoff; `b5baf5cab` complete mapping/crosslinks; `c87f88fb0` runtime/evidence checkpoint; `f97585aff` transactional writer/reply admission; `d9eaa0b3f` existing actor-denial precedence; `495493f56` private media HTTP caching/logging |
| #2805 | `df32b360a` effective web/shared API tree; `e96b65004` encrypted photos/PDFs; `b14c4e2ca` deletion retirement; `6c653b0b7` canonical receipt merge; `f92061cac` offline shell; `2e45d3cf6` offline PDF module; `52bcf5ab7` verified session bootstrap, encrypted inbox and committed deletion retirement |
| #2803 | `a0a7ab22d` effective iOS tree; `79757dcd1` canonical recovery/account fences; `d95f68202` encrypted media/background time; `564639aee` background expiration capture correction; `aed5ac098` shared viewer access protection |
| #2806 | `13c57dd87` effective Android tree; `6ff8ecbd4` durable topics/badges/receipts/retirement/media quotes; `c81993992` supported directory sync and restored receipt revalidation; `5732fc834` account capture, encrypted received media and bounded scheduled outbox work |

## 2. What this continuation accomplished

### Backend/database

Both owned APIs moved from the recorded 3d6c `ba1a00e3d` runtime to the consolidated e0bb backend after inspecting listeners/checkouts and coordinating native fault state. d378 remains the historical documentation checkout; do not run its old API. The current APIs run `495493f56`; local jobs, cron and all push providers remain disabled.

The formerly unapplied topic/room guard was reviewed and applied locally. Invalid group, wrong conversation pair and invalid represented sender were rejected. Concurrent membership revocation and send were exercised in both lock orders; revocation winning rejected the insert, and temporary fields were restored. Valid topic sends passed in the actual web `90d453f1d`, iOS `3837b1f96` and Android `7c2dcb7d9` apps, including peer/read/reload evidence.

A separate normal-send race was reproduced: after API preflight passed, membership revocation committed while insertion waited, and the old runtime still returned 201/persisted a message. That synthetic probe was soft-deleted normally and membership restored. New transactional writer admission locks/rechecks the displayed sender's active membership. The same API race then returned 403 with zero messages. A reply target deleted after preflight likewise returned 400 with zero messages. A valid browser reply reached the peer once with its quote and retained Read after reload. This does **not** prove every represented-business permission or recipient-audience change is transactionally fenced.

The first writer guard changed an existing actor-denial error's precedence. CI exposed it. A second additive migration orders the existing actor/block admission before writer admission, preserving all guards. The existing SQL contract then passed locally and in fresh CI. Applied files were never edited.

Chat image/thumbnail HTTP responses now remain `private, no-store` for token clients as well as cookies, so generic OS/HTTP caches are not invited to retain plaintext outside account/epoch-controlled encrypted stores. Private provider error strings and file/user identifiers were removed from this download error logging path. Syntax, five static privacy guards, 63 existing privacy assertions and diff checks passed. This newest header/logging change still needs exact browser/native media verification; source and CI are not that proof.

### Web

- Exact preserved `90d453f1d` production build: entered anchored history with **zero latest-window cache**, queued an offline reply while keeping the shell/pending row, reconnected to one peer message with original quote, then verified peer reload and sender reload/Read. This completes that specific old checkpoint.
- Exact `90d453f1d` valid topic-binding send: peer once live and after reload; sender/selected topic Read after canonical recovery.
- The `e96b65004` received-media build: PDF rendered online; a saved PDF and received Android photo reopened after chat API/media/socket requests were blocked and the page reloaded. Original photo decoded at 1080×2400. Full-network offline reload failed at the app shell; that was recorded as a failure, not an offline-cold-launch pass.
- Exact `2e45d3cf6` combined artifact: service worker controlled the page and a full-network offline reload served the fixed anonymous shell, but no account/history restored. Diagnosis: existing cross-port cookie flag, absent origin-local auth-change marker, present encrypted session binding. Final `52bcf5ab7` initializes the marker only after a verified profile, retaining strict matching-marker checks. **The final `52bcf5ab7` source has not been built or browser-verified.**
- Exact `2e45d3cf6` media retirement: a new synthetic PDF rendered for the recipient. Sender deletion closed the recipient's open viewer, removed the row and its encrypted received-media record. With chat APIs blocked, recipient reload retained unrelated history and did not restore the deleted message. This was seconds after deletion, not a sub-400 ms interruption proof.
- Exact `2e45d3cf6` normal selected-topic canonical recovery showed six Read stamps matching six positive server receipts, supporting the join/history receipt merge repair. A held 200 response experiment expired/cancelled during the handoff; release returned Invalid InterceptionId and UI temporarily showed an empty state. No access mutation occurred. This is **inconclusive**, not delayed-success/access-retirement proof. Interception was cleared; normal reload restored six Read.
- Received photos and PDFs use the existing encrypted browser store with a 50 MiB/100-file budget, seven-day expiry, a 25 MiB file cap, four concurrent downloads and a 30-second timeout. Final `52bcf5ab7` adds a bounded encrypted 50-row personal inbox using the existing store/UI, offline navigation, and awaited history/inbox/media retirement before deletion success. Affected snapshots may be unavailable until their normal rewrite; interruption continuity remains unverified. Videos remain network-only; closed-browser background sending is absent.

The old 63107 d561 server and genuine false-Read cache remain untouched. Its original browser tab was not accessible in this chat. The founder said they would bring it; no tab reference arrived before this handoff. Preserve that state, including cross-port cookies, until the upgrade is recorded. Do not manufacture an old-cache pass by seeding a new cache.

### iOS

The already-running `3837b1f96` build was recovered successfully, signed/hash-preserved and installed without wiping account data. Exact `3837b1f96` passed All/Alpha/Beta encrypted offline switching and cold relaunch; paging beyond 600 rows and Return to latest; valid topic send; and a controlled missed selected-topic receipt recovering Read after offline cold launch. The earlier missing Alpha stamp was grouped-bubble presentation, not a receipt bug.

Exact `3837b1f96` defects were reproduced: topic-to-All could land at an arbitrary older viewport; canonical selected-topic access removal could drop the room from the active list before durable retirement, allowing five old sealed files to survive and revoked history to reappear offline. In a separate All-delta case, epoch retirement did work despite a non-writable history directory: five old files remained byte-identical but cold offline launch rejected the old inbox, including unrelated cached rows. These two paths must not be conflated. Membership and directory permissions were restored.

Source `79757dcd1` fixes canonical per-page retirement before applying history, intersects authorized rooms across pages, routes scope changes through latest navigation, and captures account session for download completion. Later source adds encrypted received-media chunks in the existing account/epoch store (10 MiB per file, 25 MiB total, seven-day expiry), bounded UIApplication background time around the existing outbox, explicit chat download/cache bypass, and shared PDF/video viewer retirement. The ephemeral chat URL session has no URL cache; requested legacy generic copies are removed, but unrequested legacy cache files have not been globally migrated. The Live Photo video path still needs review. Finite OS background time is best effort, not guaranteed suspended/terminated delivery.

Build `d95f68202` failed a Swift capture diagnostic; `564639aee` fixed it and **built successfully**, with strict signing and hashes preserved. It was **not installed or flow-verified**. Final `aed5ac098` adds shared gallery/PDF/video changes after `564639aee` and is **source only**, with parser/format/strict lint checks. Installed app is still exact `3837b1f96`. No iOS build remains running at freeze. Next session should build final `aed5ac098`, preserve the `564639aee` comparison build, then install without a wipe and verify the repaired paths.

### Android

Exact installed `7c2dcb7d9` the recorded photo-reply case passed offline queue/relaunch and accepted-but-lost response recovery: one upload, two send/accept observations and one database message. The peer showed the original-room quote and decoded the original photo once after reload; native recovered Read. The native accepted-media bubble itself omitted its quote, a real rendering defect repaired in newer source. Valid Beta topic send/read passed. A received PDF opened online but failed offline reopening on `7c2dcb7d9`; this is the baseline received-media gap.

New source carries encrypted topic metadata/windows, authoritative badge persistence, canonical false-receipt clearing and revalidation, account/event ownership, crash-durable cache retirement, media reply preview, encrypted received media and bounded JobScheduler work around the existing encrypted outbox. Final `5732fc834` captures the socket account before publishing signed-in state, adds one persisted network job with a 30-second bounded drain and no account/message/token/path in job metadata, and uses account/generation checks when hydrating the existing encrypted outbox. Received media uses the existing Keystore-backed store: 5 MiB per file, 15 MiB/40 media files within the overall 20 MiB page budget, and seven-day expiry. Downloads check the server first; only transport/server failures permit an encrypted fallback, while definitive 401/403/404 denial retires the account chat namespace. Larger files stream without an offline copy. Chat image loading bypasses generic Coil memory/disk reuse, and the upgrade retires old generic thumbnail copies. The scheduled job is best effort; force-stop delivery is not guaranteed.

The `6ff8ecbd4` build failed because an Android SDK constant was unavailable; `c81993992` repaired directory fsync usage. Its next local compile failed with a Compose compiler stack overflow because the local JVM override omitted the repository's required `-Xss16m`. Preserve both failures; no new APK resulted. The next build must retain the repository JVM stack/GC/encoding settings. Final changes have scoped source checks but no successful exact APK or emulator proof. Original `7c2dcb7d9` remains installed; no Android build/debugger or pending outbox/draft remains.

## 3. Original audit reconciled with implementation

The full original audit is reproduced verbatim in the appendix. It is an inventory of risks and proposals from old code, not evidence that every item remains missing or authorization for unrelated features. Its old request to write tests is superseded by the founder's no-test-code instruction. Reconcile current source and security work before changing anything. In particular, intentional read-only history after voluntary departure must not be confused with revoked access.

| Original problem / risk | Implemented or preserved work | Remaining proof or decision |
| --- | --- | --- |
| Room intersections silently truncated above database caps | SQL pair filtering and paged scope/identity reads | Existing 1,031 unrelated-room and 1,032-member evidence retained; production-scale plans still need controlled measurement |
| Global recent-message sampling, N+1 counts and unstable pagination | Keyset inbox/history/search, durable counts, bounded projections and reaction aggregation | Representative EXPLAIN ANALYZE and mixed-load measurements |
| Lost edits/deletes/read state after disconnect | Commit-ordered revisions, bounded POST changes, resets/removals and canonical recovery | Final successful-late-response access races; delayed/exhausted joins |
| Socket payload/RPC drift and process-local state | Canonical REST send/recovery, committed database signals, authorized cross-process fanout, bounded typing/presence/preferences | Complete delayed join/leave/resubscribe ownership matrix and storms |
| Retry duplicates and outbox loss | Stable scoped retry identities, durable encrypted draft/outbox promotion, acceptance reconciliation | Final artifact interruption/account/upload matrix; no unconditional exactly-once claim |
| Sending cleared unseen room/topic unread | Explicit visible per-room boundaries and approved ChatTopicRead | Exact latest-artifact false-eligibility/missed receipt checks |
| False direct Read in task/group or cached old UI | Eligibility flags, conservative canonical correction, separate topic boundaries | Genuine 63107 old-cache upgrade and delayed canonical ordering |
| Reply silently moved rooms or lost quote | Preserve original authorized room/audience and refusal/retry; transactional target check | Android final accepted-media quote and audience changes during long uploads |
| Topic bound to unrelated room/pair | Transactional topic/sender/pair membership guard | Valid app checks completed; latest combined client regression still required |
| Membership changed between API check and insert | New locked writer admission, existing block/actor/plan gates preserved | Business permission and complete audience concurrency audit remains |
| Business staff identity/access leakage | Private actor and represented sender; current staff fanout; pagination | iOS 67-row business inbox and delegated native send/reply/topic matrix |
| Revoked encrypted history or late results reappeared | Access generations/epochs, first-page retirement, account fences | New iOS canonical repair, Android interrupted retirement and web held successful response proof |
| Native plaintext previews / OS image caches | Encrypted inbox/history stores and new explicit received-media stores; HTTP no-store | Latest installed cache purge/upgrade/account/denial proof, including legacy copies |
| Offline topic/inbox navigation missing | iOS `3837b1f96` topic proof; Android topic source; web final encrypted inbox/shell source | Latest build checks across full offline cold launch, back/navigation and drafts |
| Long timelines grew or jumped | Web virtualization, Android bubble anchors/bounds, iOS 600 accepted rows/1,200 delta staging | Native final viewport, memory/frame timing and recovery measurements |
| Unbounded media processing/network work | Disk-stream upload, admission bounds, coalesced bounded thumbnails | Quota/expiry/corrupt/missing/cancel/progress/retry and burst matrix |
| Media privacy and deletion | Authenticated download, content validation/image metadata stripping, provenance/reference fencing, tombstone recovery | Hosted bucket policy, malware quarantine, general abandoned-upload cleanup/retention policy not proved complete |
| Background outbox execution absent | Final native bounded execution/scheduling source | Exact OS scheduling/relaunch/stop/account checks; physical-device limits; web closed-browser delivery absent |
| Durable Delivered was inferred from server/socket | Kept Sent tied to server acceptance; private ChatPushDelivery work preserved | Recipient-device ACK semantics/persistence design and review before implementation/new-table approval |
| Push privacy, retries, expiry and wrong-account callbacks | Generic authorized push jobs, read/mute checks and metadata hardening | Real APNs/FCM devices, terminated delivery, duplicate/crash/tap routing and hosted configuration |
| Direct RPC/table authorization, blocks, moderation and abuse | Existing security integrations and chat rate/admission limits retained | Re-audit current grants/RLS and represented permissions; reporting/moderation/retention/legal-hold/product policy not silently marked complete |
| Observability/production readiness | Bounded 4,096-sample local metric rings and some private-safe logs | Aggregation, alerts, incident/rollout/rollback runbooks and controlled measurements; no hosted changes authorized |

Earlier actual evidence is preserved: 532-room recovery replaced a 24,055-character URL with a 90-character POST endpoint; large reaction aggregation returned 1,600/1,601 groups including a literal `toString`; web/Android 67-row business and iOS 105-row personal loaded-depth checks; Android 600-row repeated prepend/Retry/Latest with 0 px measured non-boundary anchor drift; cross-process reactions/typing/read/mute; earlier native account/logout/draft interruption cases. Do not repeat these baselines without a reason or attribute them to newer artifacts automatically.

## 4. Exact runtime, artifacts and immutable migrations

Source worktrees are reused:

| Owner | Existing worktree |
| --- | --- |
| Backend/integration | `/Users/yingpengwang/.codex/worktrees/e0bb/skinny-pantopus` |
| Web/shared TS API | `/Users/yingpengwang/.codex/worktrees/chat-web-reliability/skinny-pantopus` |
| iOS source / build | `chat-ios-outbox/skinny-pantopus` / `chat-ios-reliability/skinny-pantopus` under `~/.codex/worktrees/` |
| Android source / build | `android-chat-storage/skinny-pantopus` / `chat-android-reliability/skinny-pantopus` under `~/.codex/worktrees/` |
| Historical checkouts | 3d6c previous API source; d378 original docs; preserved |

| Runtime / artifact | Exact state at freeze |
| --- | --- |
| Local Supabase / DB / mail | 63001 / 63002 / 63004; database preserved, no reset |
| Primary / secondary API | 63100 / 63102, source `495493f56` in e0bb; only owned listeners restarted; jobs/providers disabled |
| iOS / Android fault proxy | 63105 / 63108; all native faults false, holds zero; agent manifests are authoritative |
| Old web production | 63101 d26 preserved; 63107 d561 preserved for genuine false-Read upgrade |
| Web `90d453f1d` | 63110, build `9R4aZTW63x2FC4liFBdwo`, 170 routes |
| Web `e96b65004` | 63111, build `Pv0PLslL-Rv35PqfmNm95`, 170 routes |
| Web `2e45d3cf6` | 63112, build `TsBTeAFMwUFWiY38UL-u4`, 171 routes; `f92061cac` compiled artifact plus sole `2e45d3cf6` public worker change; both preserved |
| Web `52bcf5ab7` | Pushed/source checks passed; no production build or UI verification |
| iOS installed | `3837b1f96`; exact signed artifact recovered/preserved and exercised |
| iOS newer build | `564639aee` signed successful/uninstalled; final `aed5ac098` unbuilt; older 61f/922/c3/51/299 retained |
| Android installed | `7c2dcb7d9` APK, SHA256 `4bfd78325f80d3404e1301e8c99fb058d99248cc1754538a3558997948606394`; newer source unverified |

Tracked client source changes are committed and pushed. Web also has preserved untracked `.next-*` build directories; these are generated artifacts and must not be committed or removed casually. Android’s build checkout contains an older APK even when its Git checkout is newer: use artifact hashes, not the checkout name. The unsent iOS draft is deliberately preserved for interruption checks; do not clear app data.

Use `consolidated-runtime.json` and per-client final manifests for PIDs, commands, ports, hashes and build logs. Recheck actual listeners/cwd/HEAD before changing any checkout. Do not infer a successful build from files merely existing in DerivedData or Gradle output. Serialize heavy native builds and separate them from performance measurements.

All 223 original migration files retain their bytes. The original 17 chat migrations through `20261023235000`, approved `20261024001000` and upstream `20261023072000`/`20261023072100` remain immutable. These three migrations were applied **only locally** during this continuation and are now immutable too:

| Migration | Local application / purpose |
| --- | --- |
| `20261024002500_chat_topic_room_binding.sql` | 04:12 UTC; existing candidate now applied, topic/room/pair guard |
| `20261024010000_chat_writer_membership_admission.sql` | 04:39 UTC; sender membership and same-room live reply admission |
| `20261024011500_chat_writer_admission_order.sql` | 04:49 UTC; preserve established actor/block denial precedence |

The migration tracker advanced from 221 to 224 entries; all previous versions remain. No new table was introduced. Applied migration hashes/application evidence are private. Any future correction must be another additive migration, not a rewrite. Hosted application remains founder-owned and has not happened.

Final browser state: parent tabs 1/2/4/5/6 are preserved for continuation, with normal connectivity and no active interception/request blocks; tab 5 shows six selected-topic Read stamps. Diagnostic tab 3 remains an isolated offline browser error document from the earlier full-offline failure; URL policy prevented its reset/closure. Do not call it restored or use it as evidence of a working shell. The genuine original 63107 tab remains unavailable. No parent-owned membership/permission mutation is outstanding.

### Local-only recovery index

The private operations file points to these authoritative companions: `ROOT-FINAL-HANDOFF-20261024.md`, `web-final-handoff-20261024.md`, `ios-final-handoff.md` and `android-final-handoff-20261024.md`. Read their exact artifact/fixture manifests before any mutation. The old iOS handoff remains separately preserved. Root evidence includes `consolidation-final-preservation-audit.json`, `web-parent-final-browser-state.json`, the three migration application records, and the successful/failed writer-admission probes. Each client companion names its artifact hashes, directory permissions, restored membership fields, proxy state and still-pending cases. These files are local only and must not be added to a PR.

## 5. CI: explicit failures and what they mean

Do not change test code or required checks to manufacture green. Do not use a mock/API/CI result as a replacement for real-app evidence.

- **Backend implementation `495493f56`:** [run 40064354749](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40064354749) completed red: 31 failed, 6,602 passed, 16 skipped; four failing suites. Fresh database replay, function lint, SQL contracts, PostgREST/Following verification, privacy, Docker/readiness/queue and migration/deployment safeguards pass. d9e run 40063839982 also passed the repaired SQL contract. f975 run 40063274188's actor-error precedence failure is retained, not erased.
- The 31 backend assertions include obsolete send-clears-unseen-unread behavior; old RPC/mocked trigger/committed-signal assumptions; five sequential tests exhausting the real limiter; old socket presence/typing assumptions; and streamed-attachment expectations. An unchanged attachment-only diagnostic with Node ESM support passed 5/7; the remaining two expect four simultaneous uploads despite admission limit 2, and hash a Buffer although production now streams. This diagnostic does not make standard CI green. Local initial full-suite 34 failures included three non-chat failures whose unchanged focused rerun passed 172 assertions. Keep all outcomes.
- **Web:** final `52bcf5ab7` [run 40064594907](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40064594907) completed red with the same one notification timing failure (2,382 assertions passed); Identity Firewall, schema and safeguards passed. Prior `2e45d3cf6` run 40063446905 failed one `notificationStreams.test.tsx:114` expectation, with 122 suites/2,382 assertions passing and Identity Firewall/schema/safeguards green. It expects a second poll at 5 s; approved behavior uses 15 seconds plus jitter only when disconnected, visible and online. Final source direct TypeScript/scoped lint passed; no final build.
- **iOS:** final `aed5ac098` [run 40064481599](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40064481599) was still building its iOS bundles at the snapshot, with lint, schema and safeguards passed; runtime/aggregate results were not yet known. Earlier consolidated a0a runtime retained 11 known failures while bundle/lint/schema/safeguards passed. They include missing new room/audience/history stubs, old search request assumptions, immediate mute expectations and the old strip-cross-room-reply assertion. Final source lint/parser/format checks pass; final artifact proof remains absent.
- **Android:** final `5732fc834` [run 40064901018](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40064901018) was still running at the final snapshot: schema and safeguards passed; lint/test/assemble and instrumented emulator jobs were running. Initial consolidated `13c57dd87` run 40060890919 retained 14 unique runtime failures (42 retry reports, 5,074 cases, 76 skips); instrumented emulator/schema/safeguards passed. Preserve the two subsequent local build failures and the source-only state. Current agent classification is in the private final manifest.

No test was authored or modified. The standalone privacy wrapper initially could not spawn missing `node`/`npx`; rerunning its five static guards with the correct runtime and its three existing Jest suites directly passed all 63 assertions. The invalid wrapper runs are retained as environment failures, not product failures or passes. Current CI disagreements remain blockers until actual regressions are repaired and the founder resolves any necessary existing-test update that conflicts with the no-test-code direction.

## 6. Resume in this order

1. **Recover exact state, do not reconsolidate.** Read all current handoffs/manifests; inspect Git/remote PR/CI/listeners/schema and preserve any newly completed build. Reuse these four branches/worktrees. No new tiny PR stack, no original-branch force-push/deletion, no database reset.
2. **Build latest client sources safely.** Web `52bcf5ab7` in a new isolated output/port; iOS final `aed5ac098` while preserving successful `564639aee`; Android final head with repository JVM flags, including `-Xss16m`. Retain exact artifacts/hashes. Coordinate API/CORS centrally. Install native builds without wiping the old cache/drafts that need upgrade checks.
3. **Close reproduced privacy/reliability gaps.** Web verified-profile bootstrap→full offline reload/inbox/thread/topic/media; immediate deletion reload; original 63107 false-Read upgrade; bounded held canonical/delta ordering and held successful history after retirement; timeout-empty-state behavior. iOS canonical topic retirement interruption/Keychain fallback, draft preservation, whole-account unrelated-cache loss, viewport latest behavior and late inbox response. Android topic cold relaunch, badge account return, explicit false receipt correction, media quote and file-deletion interruption. Reuse recorded fixtures and restore every temporary field/mode/fault.
4. **Complete real-app matrix against real local API/DB.** Sender and peer, reload/relaunch, offline recovery, accepted-lost response, long upload/access/audience changes, reply-room refusal/retry, account switch/logout, original/thumbnail/PDF authorization, missing/corrupt/expired/quota/cancel/retry media, closed task and represented business. iOS 67-row business proof remains open. Verify new backend no-store responses and native encrypted-cache upgrades explicitly.
5. **Finish bounded background behavior and security/operations work.** Exercise new native scheduling/expiration/cancellation/durable retry. Do not promise delivery when the OS prevents it. Review delayed join/leave/resubscribe/stale ACK/permanent denial. Reconcile RPC grants, blocks, represented permissions and file references with existing security PRs. Existing file tombstone recovery does not prove general abandoned-upload cleanup; design safe retention/fencing before adding cleanup. Malware/moderation/legal-hold policies and hosted service work need concrete founder/provider decisions.
6. **Resolve CI on only the four active heads.** Keep source repairs coherent, preserve failure history, and leave conflicting tests explicit under the no-test-code instruction. A green bundle is not a runtime pass; instrumented emulator success is not physical-device push proof.
7. **Measure controlled performance after builds settle.** Use exact source/artifact/device/network/sample counts; measure warm/cold inbox/thread useful-content, local bubble, server acceptance and recipient visibility separately. Report p50/p95/p99, stalls, duplicates/loss/order, bytes/requests and memory/DOM/storage/frame bounds. Include small/large backlog, message mutations, 532-room recovery, same-time pagination and attachment bursts. Existing idle samples and 0 px anchors are useful observations, not comparative latency benchmarks. Do not invent target guarantees or competitor results.

## 7. Review and eventual merge/release procedure

**No merge or deploy is currently authorized, even after green CI.** The request for handoff/merge instructions did not revoke that limit. The next session must stop at a reviewable four-PR candidate unless the founder separately authorizes release actions.

Review the preservation map first, then the effective diff of each consolidated PR against master. Historical PRs are traceability references, not 131 independent merge targets. Review backend migrations/contracts/admission/privacy and client shared protocol as a unit; assign shared TypeScript API to web and each native subtree to its owner. Review coherent follow-up commits inside each draft without reopening/replaying their old stack. Check the combined contract first: send/retry identity, original reply room/audience, topic eligibility and read boundaries, canonical/reset/removal responses, and attachment authorization. Then inspect each platform’s account ownership, durable retirement and lifecycle behavior. A retained old commit is traceability; a passing exact-artifact case is behavioral evidence. Keep those two review questions separate.

Before requesting release approval: fetch current master, integrate any newer relevant security/auth/navigation work without discarding these changes, rebuild the exact four candidate heads, run existing required checks, and complete the combined actual-app matrix. Record both preserved artifact proofs and outstanding physical/provider gates. Update pushed branches with ordinary coherent commits or compatible merges; preserve original branches and avoid force-pushing. After each eventual merge, refresh the remaining PR bases/diffs and their required checks so an earlier green run is not mistaken for validation of a new integration state. New tables still need approval; do not silently substitute schema designs.

After explicit founder merge/release authorization and required green checks, the safe dependency order is backend/database additive contracts and migration rollout first, then web/shared API, then native clients (iOS/Android order may follow actual release readiness). Recheck the project's current CI/deploy automation before any merge: a backend merge can trigger deployment, so merge permission must cover the actual consequences. Hosted migrations, production/provider configuration, secrets, store submission and physical release actions remain founder-owned. Preserve backward compatibility for older installed clients; keep rollback to earlier application artifacts distinct from immutable migration history. Never roll back by deleting/reordering applied migrations.

## 8. Concrete blockers and unproved claims

- Founder/browser access: genuine old 63107 tab must be referenced or made accessible for the preserved-cache upgrade proof.
- Founder decision: some required CI expectations conflict with approved behavior; existing-test edits remain forbidden. Do not weaken correct runtime behavior, skip checks or label them green.
- Source/artifact work: newest web, iOS and Android changes still require exact builds and actual-app verification. This is pending engineering, not an external blocker.
- Founder/infrastructure/device access: hosted migration/provider setup, physical APNs/FCM devices, background/terminated delivery, release/store actions and representative physical performance are not completed by local simulators.
- Product/security decisions: durable recipient-device Delivered semantics, any new schema, malware/quarantine service, moderation/admin tooling and retention/legal-hold policy need defined ownership/review. Calls, E2EE and multi-device history/backup are not implemented or promised by this effort. Treat them as separate product/security programs with explicit scope and review, rather than interpreting a competitor-parity aspiration as approval to add them. Encrypted account-scoped local storage is not E2EE.

## 9. Copy-paste continuation prompt

~~~text
Resume Pantopus Messages/Chat from the completed four-PR consolidation. Do not start over, reconsolidate the 131 originals, create another stack of tiny PRs, merge any PR, or deploy yet.

Read AGENTS.md, NEXT_STEPS.md, the current mobile pilot brief, and these files:
/Users/yingpengwang/.codex/worktrees/e0bb/skinny-pantopus/docs/chat-performance-handoff-2026-10-24.md
/Users/yingpengwang/.codex/worktrees/e0bb/skinny-pantopus/docs/chat-consolidation-map-2026-10-23.md
~/.config/pantopus/chat-reliability-20261023/HANDOFF-OPERATIONS.md
Follow the latest per-client handoffs and private artifact/fixture manifests. The latest public handoff preserves the complete original audit and separates historical findings from current evidence.

Continue in these four existing drafts: #2804 backend/database/docs, #2805 web/shared TypeScript API, #2803 iOS, and #2806 Android. All 131 originals are mapped, cross-linked and closed as superseded; their branches, commits, archive refs and failure history are preserved. Use only the four active heads as CI targets. Keep coherent repairs in these drafts and keep the handoff/map current. Do not force-push or delete original refs.

Inspect current Git, remote PR/CI, process, artifact and database state before changing anything. The recorded APIs on 63100/63102 run 495493f56 from e0bb; 3d6c and d378 are preserved historical checkouts. Local jobs and push providers remain disabled. Migrations 20261024002500, 20261024010000 and 20261024011500 are now applied locally and immutable, along with all earlier applied migrations. New tables still require approval. Do not change hosted services, design, navigation or launch flags. Do not write test code, unit tests or coverage work.

Build the latest combined client sources into preserved artifacts, after checking for newer work: web 52bcf5ab7 is unbuilt; iOS aed5ac098 is unbuilt while signed 564639aee is preserved and uninstalled, with 3837b1f96 still installed; Android 5732fc834 is unbuilt with 7c2dcb7d9 still installed. Retain Android’s repository JVM settings, including -Xss16m. Reuse the existing source/build worktrees. Preserve old caches, drafts, APKs and signed builds before upgrading; never infer an artifact’s source from its directory or checkout alone.

Preserve web 63107 and its genuine false-Read cache until the original browser tab is accessible and captured. Finish that upgrade and canonical/delta ordering, held successful responses after retirement, full offline identity/inbox/shell, and immediate deletion recovery. Verify final iOS canonical topic retirement, media/account interruption, viewport behavior and the 67-row business case. Verify final Android topic/badge/account/receipt retirement, accepted media reply quotes, encrypted media and actual background scheduling. Reuse the completed web 90d no-latest-cache, iOS 383 scope/timeline/missed-receipt, and Android 7c reply/photo evidence without claiming it verifies later source.

Continue the remaining authorized repairs and real browser/iOS simulator/Android emulator checks against the real local backend/database. Include the other person’s view, reload/relaunch, offline recovery, accepted-but-lost responses, account/access/audience changes and attachments. Restore temporary faults, membership fields and directory modes. Keep secrets, raw logs, tokens, private manifests and personal data out of Git, PRs and chat.

Resolve CI without weakening requirements; retain failure history and report any test-contract conflict under the no-test-code instruction. Finish the remaining media/background/delivery and security/operations work, then run controlled performance measurements with compiler contention removed. Distinguish source implemented, exact artifact verified, CI green and released. Do not claim WeChat/WhatsApp parity, durable recipient-device Delivered or end-to-end encryption without implemented and measured evidence.

You may use three parallel client agents in separate existing worktrees, with backend/integration centrally owned. Commit and push coherent work to these four drafts. Follow the handoff’s review and dependency order, but do not merge or deploy even after green CI until I explicitly authorize it. Identify concrete founder/provider/device blockers and remaining engineering work instead of calling them complete.
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
