# Three-stream coordination

Updated September 16, 2026. The user authorized three concurrent streams. This
folder coordinates their next bounded milestones; it does not replace the existing
backlog, acceptance evidence, or verification-first instructions.

## Active sessions and runtime ownership — September 20, 2026

This table supersedes historical session/runtime rows below. No work is dispatched
to the retired September16 coordinator or older Stream1 session.

| Stream | Active task | Current work / sole writer | Local browser and API | Database |
| --- | --- | --- | --- | --- |
| 1 / coordinator | `01a0c0d1-0703-70c3-b842-6d01bc8ca48b` | Actual Stripe TEST tip/paid capture milestones complete on9ae1edb3b; combinedsession/actualstop verified; OffersPanel stale status repair8825c1928; CI pending | `localhost:18133` → HTTP18132 | Isolated `pantopus-stream1-tip-ui-r1`, API64561/SQL64562 |
| 2 | `01a0c0d4-2278-71d3-bc23-a9d789d2afeb` | PR60 merged as ebeea43d5; combined browser check and CI accepted; runtime released | `[::1]:18141` → HTTP18142 | Adopt existing `pantopus-stream2-guest-r1`, API64551/SQL64552; ports64550–64559 granted |
| 3 | `01a0a824-301b-74e3-a1d9-b205714ed7a1` | PR64 safety merged as2d6ff2069; author owns separate granted Settings/SDK deletion and UserBlock forward migration | `stream3-auth.localhost:18131` → HTTP18130 | Existing `pantopus-stream3-block-r1`, API64531/SQL64532 |

Stream3 runtime extension64534–64537 is granted for local GoTrue/Kong/mail only.
Stream3 single-writer grants: existing Settings deletion UI and SDK users endpoint;
`frontend/packages/api/src/client.ts`, `endpoints/auth.ts` and mounted web
`lib/query-provider.tsx` for reproduced cookie-login cross-tab account retirement
(preserve same-account refresh/drafts). Extension granted after admitted held401
replayed Bob's block as new Dana after refresh: bind shared interceptor requests
to session generation, recheck across awaits, prevent stale retry/session cleanup. Intact delayed old refresh200 then new login
reproduced browser cookie rollback; granted same client AbortController and
origin-bound mutex repair, with intact-header UI acceptance required.
Existing `UserBlock` incoming/outgoing
NO ACTION FKs caused admitted real-auth/step-up DELETE500: forward migration
20260916012000 is granted for only those two CASCADE constraints, after canonical
comparison. No applied migration rewrite or auth/socket redesign. Stream3 also owns a separate,
reproduced N03 follow404 repair in existing `backend/routes/personaBlocks.js`:
move auth/feature guards onto its actual three block routes so the supported
flag-off legacy follow route can run. Verify follow persistence and block denial;
no feature-flag activation, backend policy widening or new application file.
The same separate N03 scope includes existing `personas.js` DELETE-follow only:
repeated unfollow passed a non-UUID sentinel to SQL and returned500. Use a checked
membership read, preserve paid-tier guards, return success only for confirmed
absence and failure for an unavailable read. Stream3 reports
exact paths and real UI/API/SQL proof before integration.
Subsequent N03 privacy grant: existing personas.js owner followers GET/PATCH must
reuse canonical serializeFanForCreator after actual creator UI exposed protected
local identity; existing frontend/packages/types/src/identity.ts follower display
shape may narrow to safe handle/displayName/avatarUrl. Preserve layout, no new
profile system/schema. Commit follow/retry separately before this repair. Existing
post detail page and PostDetailModal caller may subsequently repair the reproduced
Beacon author destination using the canonical typed href; preserve personal/business
destinations, exact caller is frontend/apps/web/src/components/feed/PostDetailPanel.tsx
(not Modal); no shared UserIdentityLink rewrite. Subsequent persona-comment privacy
grant: existing backend/routes/posts.js four comment response paths and comment/reply
notifications, plus existing frontend/apps/web/src/components/feed/CommentThread.tsx.
Use canonical fan/Beacon identities per protected-fan policy; preserve internal
recipient/self/duplicate handling and ordinary personal/business posts. Confirm own
versus other-actor edit controls and native DTO/caller compatibility before choosing
redacted id shape; no schema/new identity system. Separate milestone after owner-fan repair. Narrow iOS/Android PulsePostDetailViewModel
mapper grant maps intentionally blank safe author IDs to nil/null, preventing invalid
private-profile actions while preserving layout/personal navigation. Existing post
page/Panel/CommentThread submit-success contract may retain composer text/files/reply
after reproduced SQL500; inspect all void/boolean callers, no newfile/schema.

Browser hostnames deliberately differ because cookies are shared across ports.
No shared cookie clearing, retained database mutation, cache cleaning or physical
device use. Native slot **released** after Stream1's iOS and Android attempts. Android AVD
boots but current computer-use cannot attach its qemu window; no native tip
acceptance claimed. Owned emulator stopped; no rebuild/install. exact
owned simulator shut down. Local Simulator became unavailable after an external
shutdown/XPC/display failure; no build or system-service reset. Recheck actual
availability before reserving. Stream1 HTTP18132/web18133 and isolated64561/64562
project stopped after both actual Stripe TEST phases. Combined-session project `pantopus-stream1-session-integration-r1` replayed77migrations
and verified account-switch recovery onf0a98a974; exactrows0. Stream1 now reserves
18132/18133 and64561–64567 for isolated `pantopus-stream1-stop-stripe-r1` actual
TEST authorization release via existing reopen/cancel UI finished/cleaned0. New
`pantopus-stream1-refund-stripe-r1` uses the same ownedports for actual captured-payment
partial/full refund UI completed. All Stream1 exact rows0 and ownports released;
five actual test captures fully refunded, five unpaid intents cancelled, four owned
customers deleted across the session. No native build or retained DB mutation. Exact owned rows0; four test
captures fully refunded, two intents canceled, two owned customers deleted. Provider
history remains.
Stream3 and Stream2 own their dirty live status files; coordinator stages
only handed-off snapshots. Stream1 source changes remain confined to its assigned
paid worktree, Stream2 to its Home worktree, Stream3 to its accounts/social worktree.

## Where to start

| Document | Purpose | Writer |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Rules for preserving existing work and designs | Coordinator, when an agreed rule needs recording |
| [Project handoff](../PROJECT_HANDOFF.md) | Current integrated state and next decisions | Coordinator |
| [Remaining work](../REMAINING_WORK_2026-09-11.md) | Authoritative requirements and acceptance rows | Coordinator, using stream evidence |
| This guide | Ownership, dependencies, integration and shared resources | Coordinator |
| [1. Gigs/payments](01-gigs-payments.md) | Current gig/payment milestone and handoff | Stream 1 |
| [2. Home/household](02-home-household.md) | Current Home milestone and handoff | Stream 2 |
| [3. Accounts/social](03-accounts-social.md) | Current account/social/notification milestone and handoff | Stream 3 |
| [Verification report](../VERIFICATION_FIRST_2026-09-13.md) and linked reports | Source-bound results, failures and limitations | Coordinator integrates stream report contributions |

The coordinator is also Stream 1; there is no fourth implementation stream.
Each stream owns the affected backend, database contract and clients for its
milestone. Platform boundaries do not split ownership of one user journey.

Backlog ownership: Stream 1 handles P (gigs/payments); Stream 2 handles H/R/I/D/F/M
(Home, residency, intelligence, records, bills, mail/guests); Stream 3 handles N/A
(social, notifications, accounts/providers). A03 shared storage changes require
explicit ownership, and A05 routes each feature-specific finding to its domain
owner. U (UI/accessibility/lifetime) checks accompany each affected journey; G/O/L
(integration, operations and launch) stay coordinated centrally with stream input.
These categories assign responsibility, not permission to reopen accepted work.

## Shared publication, live location and Git branches

Shared instructions and coordination snapshots belong on `master`, published
through documentation-only PRs from `codex/workstream-coordination`. They do not
depend on approval or integration of the gigs application branch. Each application
stream receives those instructions by integrating current master into its branch.

The live coordination folder on this Mac is:
`/Users/yingpengwang/pantopus-coordination/docs/workstreams/`.
All three agents read that exact directory, even while editing application code
in another worktree. A copy in a different branch is a committed snapshot, not a
live message channel. This is a neutral documentation worktree of the same
repository, on `codex/workstream-coordination`; it is not a fourth application
stream. The owner's main checkout remains separate. The previous live folder in
the gigs worktree is retired after this transfer; do not update status there.

| Stream | Application worktree | Branch / starting state |
| --- | --- | --- |
| 1 | `/private/tmp/pantopus-paid-gig-integration` | `codex/paid-gig-integration`; current source/CI in Stream1 status |
| 2 | `/private/tmp/pantopus-workstream-home` | `codex/workstream-home`; PR53 merged into master `4cc9d3787`; branch re-based on master |
| 3 | `/private/tmp/pantopus-workstream-accounts-social` | `codex/workstream-accounts-social`; PR51 merged into master `c14657e35`; integrate master before the next milestone |

Streams 2 and 3 compare relevant pending Stream 1 changes before editing shared
code. They start from master because their first scoped implementations are
unchanged in the paid candidate. This permits small independent PRs to master.
The coordinator then integrates merged master into the paid candidate and checks
the combined behavior. Do not merge the entire unfinished paid branch into a new
stream just to obtain its status documents.

One writer per application worktree. Two Stream 1 sessions shared
`/private/tmp/pantopus-paid-gig-integration` on September 15/16; the older session
(`pantopus-paid-gig-integration-c8`) is retired from writing and the coordinator session
is the sole Stream 1 writer. No WIP commits on a branch with an open PR.

Feature branches carry `docs/workstreams/*`, `docs/PROJECT_HANDOFF.md` and
`docs/REMAINING_WORK_2026-09-11.md` only as merged from master, never as their own
edits: a branch whose copies diverge becomes a conflicting PR, GitHub cannot build its
merge ref, and pull_request CI silently never schedules (PR47 lost all checks at
`f437dfd20` until master was merged in). Publish through the coordination branch only.

Each agent writes only its own status file in the live folder. It commits code
only from its own application worktree. The coordinator commits/pushes shared
status snapshots from the neutral documentation worktree after the author finishes
an update and publishes them through a separate PR to master; no blanket `git add .`.
Before publishing, verify the diff contains only the intended instructions and
status changes. Do not copy a feature branch's complete handoff or backlog over
master: link branch-specific evidence and carry over only the relevant updates.
Remote workers must send their source-bound handoff to the coordinator instead
of treating a stale local copy as the live folder.

## Working agreement

The user's clarified priority is accuracy and efficient reuse. All three streams
must preserve mobile (iOS/Android) and web screen designs, layouts and appearance.
Verify existing journeys before application edits; repair demonstrated failures
and repeat the affected end-to-end checks until they pass within an explicit scope.
Use the new-file/database comparison rule in [AGENTS.md](../../AGENTS.md): missing
evidence or disliked code is not permission to rebuild. Document why existing work
cannot meet the requirement before adding or replacing implementation. Preserve
accepted evidence and clearly label any unverified runtime/provider boundaries.

1. Select one bounded milestone from an existing inventory row. Locate its screen,
   caller, endpoint, service and database contract. Read relevant accepted evidence
   and compare source/configuration before choosing verification to repeat.
2. Record the milestone, exact candidate files, reused evidence, unknowns, next
   verification and completion criterion in the stream file. Source suspicion is
   not a reproduced bug; an open row is not a missing implementation.
3. Before changing a shared file or acquiring a shared runtime, send the coordinator
   a request identifying the purpose and affected streams. The coordinator records
   one owner here and acknowledges it before work starts. An empty row is not a
   lock that multiple workers may independently claim.
4. Reproduce the failure or document a concrete unmet requirement. Repair the
   existing implementation, preserve layouts and reuse existing services/schema.
   New tables, migrations, services or screens require the comparison in AGENTS.md.
5. Verify affected behavior and meaningful regressions. Actual UI/HTTP/persistence
   evidence is required where the milestone calls for it. Label synthetic auth,
   provider responses and transport; do not equate saved state with delivery.
6. Commit/push a reviewable milestone and hand off its SHA, changed paths, baseline,
   final evidence, limits, cleanup and remaining decisions. The coordinator reviews,
   reconciles shared changes/migrations and runs required CI before merging.

Update status when starting, changing scope/ownership, reproducing a defect,
finishing verification, becoming blocked, or handing off. Do not append a diary of
every command. Keep the current snapshot short; link detailed evidence/history.
Notify an affected peer through the coordinator when a finding changes its contract
or priority. Merely writing a note in another branch does not notify anyone.

Use states: discovery, verification, repair, ready for review, CI, merged, blocked.
Record the blocker and independent work that can continue. Local acceptance of a
small milestone does not close a broad inventory row or establish launch readiness.
No fixed completion percentage follows from row counts or numbers of tests.

## Shared ownership and requests

The current stream status files name candidate ownership for their first milestones.
These cross-cutting files/contracts require coordinator assignment for each edit:

- Authentication/session helpers; notification services, workers and sockets;
  generic File/upload/storage; shared navigation and SDK exports; CI/build manifests.
- `backend/routes/gigs.js` and payment services are initially Stream 1's scope.
  Home-related callers must coordinate before changing them.
- Migration versions, replay/adoption, shared permission/RPC contracts and release
  configuration are coordinated centrally. Never rewrite applied migration history.

| Request / decision | Owner | Status / next action |
| --- | --- | --- |
| Transactional direct-message block admission | Stream 3 | Granted `supabase/migrations/20260916010000_direct_message_block_admission.sql`, source `scripts/db/contracts/direct-message-block-admission.sql`, generated `supabase/tests/direct-message-block-admission.test.sql` through existing sync pipeline, and existing chats.js denial mapping. Apply/test only isolated64532; details below |
| `frontend/apps/ios/PantopusTests/Support/SequencedURLProtocol.swift` | Stream 3 | May import the exact already-tested paid-branch gate/release delta from41c75d49a for deterministic lifetime tests; no competing helper design |
| N05 booking reminder failure contract | Stream 3 | Sole writer for `backend/services/scheduling/bookingNotifyService.js` after2 reproduced failures/23 passes. `backend/jobs/bookingReminders.js` may change only after a separate worker regression proves need; preserve retry/partial-recipient limits. No notificationService/emailService/schema/provider changes; Home UI/fixtures remain coordinated with Stream2 |
| `backend/jest.config.js` chat-access regression inclusion | Stream 3 | Granted only for the existing excluded chat-access suite; run regressions, no broad CI rewrite |
| `backend/routes/chats.js` block/retry repairs | Stream 3 | Sole writer; includes reproduced cross-room clientMessageId leak: scope initial/recovery lookup to authorized room, sender and human business actor; reported repair awaits coordinator review |
| SDK guest-pass status type / block exports | Streams 2 / 3 respectively | Additive candidates reviewed for conflict; no Stream1 overlap; broader SDK/auth changes still require assignment |
| `backend/services/blockService.js` error/cache repair | Stream 3 | Sole writer granted after baseline reproduction; verify all callers before changing the error contract |
| `backend/socket/chatSocketio.js` direct-chat admission/send checks | Stream 3 | Overlap reviewed: paid branch only adds `emitPrivateGigUpdate` plus its export; preserve that helper, `connectedUsers`, revocation and gig tracking behavior |
| Start Work displayed-terms binding: `backend/routes/gigs.js` start handler, `frontend/packages/api/src/endpoints/gigs.ts` `startGig`, iOS `GigsEndpoints.startGig`/`GigDetailViewModel.startTask`, Android `GigDetailViewModel.startTask` and its repository call, web `CompletionFlow.handleStartWork` | Stream 1 (coordinator), sole writer | Delivered at `a65411758` (detail entry, all three clients + SDK) and `4ad88ec11` (my-bids card + list projection guard), draft PR47; verified locally, over real HTTP/SQL and on the installed iOS and Android candidates. Additive optional expected-assignment body; clients that send none keep current behavior. Streams 2/3 do not touch these paths |
| Stream 2 PR for `70e079543..88d076e56` | Coordinator | **Merged** as `4cc9d3787` after coordinator source review and green CI (branch updated with master first). Streams integrate current master before further web share edits. Stream 2's SQL 64552 disposable project is reported stopped; its Emergency-page value finding is routed to Home ownership (Stream 2) as a separate bounded row |
| Direct-message block admission implementation | Stream 3 | **Merged** as `c14657e35` (PR51 at `6e1758234`) after coordinator source review, the author's passing PostgREST smoke check and green CI on the master-updated head. N04/N05 rows remain open per Stream 3's status |
| Cancellation/no-show fee payer and recipient | Product decision, recorded by Stream 1 | Still unspecified; independent Start Work verification can proceed |
| Home Emergency form-type migration (Stream 2 request, 2026-09-16 evening) | Coordinator → Stream 2 | **Granted version `20260916011000_home_emergency_form_types.sql`** (not `030000`): it sorts after master's newest `20260916010000` and *before* the paid branch's unmerged `20260916020100..022100` block, so a Stream 2 merge does not force another paid renumbering under the migration policy. Scope as proposed: drop and re-add `HomeEmergency_type_chk` with the nine current values plus the six form categories, `SET lock_timeout`, "backwards compatible: yes", `HomeEmergencyType` in `@pantopus/types` widened to match; contract source under `scripts/db/contracts` synced through the existing pipeline; apply/test only in Stream 2's own disposable project. No server-side type mapping. |
| User's Place redesign, PR #46 | User's separate scope | Preserved outside these verification milestones |

Transactional admission grant evidence: actual socket/HTTP/SQL baseline allowed a
message to persist and broadcast after the counterparty's block had committed.
Existing UserBlock/ChatMessage tables, archives034/037/072, membership-only RLS and
unread trigger do not enforce this boundary; service-role writes bypass RLS. No
existing direct-message SQL contract can safely substitute. Use existing tables
and an additive forward migration; no applied history rewrite or parallel table.
The scoped proposal uses unordered-pair transaction advisory locks for UserBlock
INSERT/UPDATE/DELETE and BEFORE ChatMessage INSERT in direct rooms, checking
COALESCE(actor_user_id,user_id) against active participants. Verify deterministic
old/new-pair ordering and actual two-connection commit/wait/rollback, reverse,
business/nonmember/service-role, grants/search_path and isolation boundaries.
Deny before side effects. No gig/group/read-policy or direct-create RPC changes
without separate reproduction/assignment. Preserve the paid private-gig socket
helper/export. This is permission to implement and verify, not merge approval.

## Runtime reservations

One heavy native build runs on this Mac at a time. Remote CI uses its own runners.
Acquire a reservation before a build, simulator install, shared cache write,
database fixture/migration or server bind. Record process/lease and evidence paths
privately; never put credentials, raw device tokens or operator logs in Git/chat.
Check actual processes and the existing private leases before reuse. A stale note
or elapsed time is not proof a resource is free.

| Resource | Current reservation | Rule |
| --- | --- | --- |
| Local heavy native build | **Released** by Stream1 at 11:02 PDT September 16 after the Android APK build and installed emulator journeys; own Gradle daemon stopped; no xcodebuild/Gradle/emulator running at release | Reacquire before the next heavy native build; check actual processes, not this note |
| iOS/Android test devices | Stream3 retains `0AE16FA0-E244-414F-86C8-24893BDFD979` (Shutdown); Stream1 isolated `Pantopus Stream1 Start R2`, iOS26.5, `C2BCF36A-F300-48C1-9BA7-876CA9F61E55` (Shutdown; candidate app left installed) and new owned Android AVD `Pantopus_Stream1_Start_R2` (android-34, stopped; candidate APK left installed). The existing `Pantopus_Home_Recurrence_Acceptance` AVD was not used | Preserve owner iPhone17 (currently Booted, untouched) and all existing acceptance devices; no physical-device install granted |
| Databases / fixture ports | Stream3 reports exact `f9150300` cleanup zero and HTTP18130/web18131 stopped at cutoff. Stream1 `f9150410` (September 15), `f9150420` and `f9150430` (September 16) rows cleaned to zero by direct SQL; HTTP18132 stopped. Stream2 reports its disposable SQL 64552/API 64551 project stopped | Stream3/Stream2 cleanup is author-reported; retain their evidence. No retained schema/reset/container mutation; preserve other fixtures; 18089 is not granted |
| Stream3 isolated transactional-block database | New private `/private/tmp/pantopus-stream3-block-db-r1`, project/container prefix `pantopus-stream3-block-r1`, SQL64532/API64531 (64533 reserved) | Docker responsive at grant; replay canonical schema into empty owned database. No retained data copy or existing container changes. Canonical-empty SQL64532 retained healthy; API not started. Exact forward migration/contract assignment granted above, but no repair files written before cutoff; never apply to retained64522 |
| Stream 1 full-schema completion/reopen project | Private `/private/tmp/pantopus-stream1-complete-r1`, project/container prefix `pantopus-stream1-complete-r1`, SQL 64562 / API 64561 (64563-64567 reserved), taken 2026-09-16 ~17:00 PDT, **RELEASED 17:20 PDT** | Created with `supabase start --workdir` from the paid branch's 75 migrations (the retained 64522 database predates the paid functions). Only db, kong, postgrest, gotrue, storage started. Fixture prefixes `f9150450`/`f9150460`; exact cleanup verified 0 before `supabase stop --no-backup`; no container remains, ports free, retained 64521-64527/64532 containers still up. Workdir kept for cheap recreation. |
| Existing SQL port 64522 and REST port 18089 | Retained prior rehearsal resources | Never assume available or change their schema from another stream |
| Physical iPhone | Owner's installed build 3 | No test install or device mutation without a concrete authorized task |

Dependencies and accepted products are reused after checking their contracts.
Do not run three package installations or cache cleans. Low disk space is a reason
to sequence builds and request precise cleanup, not erase another stream's evidence.
Streams release resources on handoff after verifying processes and exact cleanup.

## Integration and completion

Only the coordinator updates shared handoff/backlog disposition or merges these
streams' PRs. A handoff includes source SHA/base, current PR/CI, reused and new
evidence, remaining limits, shared impacts and runtime cleanup. Run current-head
required checks; additional end-to-end repeats need a changed contract or identified
integration risk. Batch documentation-only publication to avoid canceling useful CI.

At setup, PR #34 is still draft at `c9cb69825` with
[CI34998717315](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34998717315)
passing 15 applicable jobs/one Seeder skip. Integration `3e93cd167` only adds the
verified iPhone-install documentation. Green CI does not finish the paid scope.
PR #46 (`place-design`) is a separate open user PR. Refresh live state before action.
PR #47 (`codex/paid-gig-integration`) also contains unfinished gigs application
changes. Neither paid PR is the vehicle for publishing the shared instructions.

This setup creates no recurring background automation. Status files distinguish
completed discovery from running verification; agent work is dispatched in bounded
milestones. The first milestones are assigned in the three linked status files.

Stream1 released18132/18133 and64561–64567 after isolated
`pantopus-stream1-offers-race-r1`: held real offers GET across existing free-bid
acceptance ended accepted with11 entity counts0. Identical reads serialized in this
browser; no reversed-response or new app-repair claim. No Stripe transaction/native build.

September21 bounded Stream3 grants after actual UI/API failures:
- N05 `backend/services/scheduling/bookingNotifyService.js` remains sole-writer:
  SMTP outage/retry duplicated host notices and reminder host link404. Existing
  notification idempotency/readback and canonical destinations only. Existing
  `backend/services/scheduling/schedulingShared.js` authorization-error construction
  may also carry status403 alongside statusCode403 for the actual mounted handler;
  no global error-handler change. Verify owner200, otheractor403/no data.
- N03 sole writer for existing `backend/utils/identityProfiles.js` ensureLocalProfile
  persisted canonical columns/checked error/concurrent duplicate reread; existing
  `frontend/apps/web/src/components/feed/PostComposer.tsx`,
  `frontend/apps/web/src/hooks/useFeedData.ts`, `frontend/apps/web/src/app/(app)/app/feed/page.tsx`
  and `frontend/apps/web/src/components/AppShell.tsx` global composer submission callback: propagate failure
  and preserve draft, reset only on success.
  Same feed page may consume only compose query parameter, retaining surface and
  other parameters after reproduced modal Connections→Place diversion. Preserve
  read-only legacy profile behavior, current UI and all unrelated session code.
  Separate PR from70 and N05; no new schema/profile system/files/tests.

September21 N05 follow-up: Stream3 is sole writer for existing scheduling.js
GET/PUT notification-preferences and schedulingNotifyPrefs.js getPrefs, now
committed5e3a8b963 in dependent draft PR75. Actual denied reads/writes must surface
errors while genuine absence retains defaults. Existing UI/API/worker proof and
restored fixture/grant limits are in the live03 snapshot; CI still required.

Next bounded timing repair grant: only existing web
`components/scheduling/automations/RemindersQuickSetup.tsx`,
`components/scheduling/automations/WorkflowList.tsx`, and
`components/scheduling/hub/NotificationPrefsForm.tsx` reminder section, under
frontend/apps/web/src. Reuse SDK get/updateBookingPage(owner) and canonical
reminder_minutes already used by native, after real web save/read mismatch.
Preserve presentation, unrelated channels/pause, explicit[]/0 and existing5/43200
route limits. Bound timers/replies to the originating owner/mount and verify UI
save/reload, error/retry, rapid edits and owned owner transitions. No new storage,
helper/service/schema/test. Worker0/empty handling remains a separate verified
requirement and needs its own exact-file grant. Existing PR70/72/73/75 refs remain
separate; this is not approval to merge unfinished scopes.

## Current integration batching — September21

Master **e8b49c963** includes the final documentation batch through PR78. The
repository requires `CI OK` with strict up-to-date branches. PR70 at07827d2b0
passed every applicable check but was behind only on documentation. Stream3 owns
a single merge of this master into its isolated PR70 checkout and normal push,
completed as21b93aa62. Coordinator verified only five documentation files changed,
zero backend/frontend/supabase diff. Reuse unchanged application UI evidence while
required current-head CI runs.
**Hold further documentation merges while70→72→73→75→77 integrate.** Publish live
status/grants as unmerged documentation drafts meanwhile; do not invalidate another
long native run with status-only master changes. Coordinator alone merges feature
PRs after exact updated-head checks and bounded acceptance.

New N05 worker grant: Stream3 sole writer in existing backend/jobs/bookingReminders.js
and only formatLead in existing bookingNotifyService.js. Actual UI-saved[] sent a
reminder,0 omitted due delivery,43200 omitted long-offset delivery under controlled
owned booking timestamps. Honor explicit[], accepted integer0..43200 and30-day scan;
include recently-started only for zero, never send zero early. Preserve120-minute
catchup/completion/dedupe/retry-release. Check page/event-type read errors instead
of treating unavailable data as absence; label zero as now. No cron/schema/newservice/
provider/new tests. Verify actual worker/SQL/localSMTP/no duplicate receipts and
restore exact original settings/timestamps/new rows; manual cadence is not scheduler
or external delivery acceptance. Keep this separate from PR77 timing UI.

Stream1 reserves18132/18133 and isolated64561–64567 for
`pantopus-stream1-refund-session-r1`, source8825, owned f9200250 fixtures. Verify
retained/refund response ownership across logout/login using existing UI/API/SQL
and Stripe TEST, synthetic local identity/ancillary transport. No live funds or
native build. Preserve peer18130/18131/64531/64532/SMTP and shared caches. Release
only owned resources after exact cleanup. Current docs remain unmerged per gate.

Current sole heavy-native slot: Stream3 may use exact owned simulator
0AE16FA0-E244-414F-86C8-24893BDFD979 for bounded N04/N03 existing screens. A new
read-only capability check found simctl available, no booted devices. Verify CUA
control first; only if usable build/install existing current app for18130 using
private owned derived output. No other simulator/device/cache/system-service
changes or native source edits. Release after the bounded result. Stream1 browser
refund-session verification does not use the native slot.
