# Stream 3 — Accounts, social and notifications

Updated September20, 2026, 22:57 UTC. **Stream incomplete; verification continues.**
Sole live status: this neutral coordination file. No new unit tests requested/written.

## Current safety handoff — frozen for coordinator review/publication

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. [Draft PR64](https://github.com/WangPantopus/skinny-pantopus/pull/64)
final safety head **f387cd480**, committed and pushed. Includes separately reviewable
`e83eaac91` chat actions, `b414ad6f6` cookie-login state retirement,
`72823e366` stale-request retry guard, `f387cd480` pending refresh cancellation.
Coordinator reviewed final source without a further finding; **exact-head CI still
pending**. Prior728 CI35542480186 passed all6 applicable checks, not finalhead proof.
No merge/integration claim. Safety/N04 and whole Stream3 remain open.

| Reproduced problem | Existing implementation repaired | Actual candidate evidence |
| --- | --- | --- |
| Existing chat-details Report/Block had no handler. | ConversationView uses existing ReportModal, confirmStore, SDK/routes and UserReport/UserBlock. No layout/new screen/service/schema. | Real browser→SDK→HTTP→PostgREST/SQL: report, write failure/retry, block cancellation/failure, lost successful reply/retry one row, Settings find/unblock, pending departure. Earlier phase uses synthetic sign-in; persistence real. |
| Cookie login skipped session-change notification; old tab retained Bob identity/draft and disabled safety. | Existing SDK auth/client + mounted QueryProvider publish existing nonsecret marker, retire cached queries and remount account state. | Real local GoTrue two-tab Bob→Alice login replaces identity and unsaved Private setting with Alice Public default. Same-account protected401→real cookie refresh200 preserves unsaved draft/open drawer. |
| Bob's delayed401 retried under newly signed-in Dana and saved Dana→Evan block without Dana confirmation. | Existing web client binds request to originating session marker; rejects stale response/refresh/retry/cleanup. | Baseline22:37 wrong persisted actor; candidate22:40 no block/no refresh/retry. Same-account Dana401→refresh200→retry200 saves one rightful block. |
| Old successful refresh overwrote new login cookies: fresh Settings returned Bob email under Dana shell. | Existing client AbortController cancels pending web refresh on local/cross-tab account transition; mutex completion belongs to its own promise; stale apply/event/cleanup checks. | Real GoTrue refresh with all4Set-Cookie intact: baseline945ms rollback; candidate920ms preserves Dana fresh protected read. New Dana401→refresh200 also succeeds before canceled old reply release. Old400 + newDana refresh leaves Dana signed in. Two earlier >10s client-timeout attempts excluded. |

No backend/socket/native source change in PR64. Web TypeScript passes on final
source (`refresh-cookie-candidate-types.log`); focused lint0errors (one existing
Settings ts-nocheck warning in separately held A02 page). CI remains distinct.
Expired/failed responses and delay schedules were injected privately. Local auth,
HTTP handlers and PostgreSQL were real. No hosted OAuth/provider or installed
native acceptance. Cross-tab cancellation depends on browser storage events;
unavailable storage, frozen-tab event delivery and other browsers are unverified.
No unauthorized message or Notification rows in these safety fixtures (both0).

Detailed private evidence, source hashes and actual timing:
`/private/tmp/pantopus-stream3-20260920-r1/real-auth-ui-results.json`,
`real-auth-http.jsonl`, `real-auth-persistence.json`, `full-backend.log`,
`cookie-race-baseline-release.json`, `cookie-race-candidate-release.json`,
`cookie-race-new-refresh-release.json`, `stale-refresh-failure-candidate-release.json`.
Durable private mirror:
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`
(60 files at preceding refresh; MANIFEST SHA binds each file). Credentials/operator
logs remain private, not Git/chat. CUA interaction history is in this Stream3 task.

## Separate A02 candidate — verified, uncommitted

Preserve existing changed web Settings page and SDK users.deleteAccount optional
X-Step-Up, plus new coordinator-granted forward
`supabase/migrations/20260916012000_user_block_account_deletion.sql` (only2 UserBlock
FK CASCADE rules). Do not include in safety merge. No users.js change. Existing
StepUpPasswordModal/native purpose/header contract reused; no redesign/new screen.
Canonical sibling UserProfileBlock/UserReport CASCADE compared; applied migration
history unchanged. Migration applied only to owned SQL64532, not hosted.

Actual real-auth UI baseline: Delete→DELETE confirmation sent no stepup, rejected.
Admitted direct HTTP login200→password stepup200→DELETE500 reproduced UserBlock FK.
Candidate UI: cancel restores Delete; incorrect password shows retry; valid Alice
stepup/DELETE200 removes public/authAlice plus2 outgoingblocks; Charlie stepup/
DELETE200 removes public/authCharlie plus incomingBobblock. Both tabs retire to
sign-in. Evidence `deletion-stepup-baseline.json`, `delete-api-baseline.json`,
`real-auth-ui-results.json`/source hashes and HTTP/SQL. Publish separate commit/PR
against fresh master after safety disposition, then required CI/coordinator review.
Broader nontransactional deletion cleanup/provider failure and installed cases remain open.

## Runtime, fixtures and continuation

HTTP18130/web18131; real full backend/app.js, local GoTrue/Kong API64531, SQL64532,
mail UI64534; additional64535–37 reserved. Project `pantopus-stream3-block-r1`,
private workdir `/private/tmp/pantopus-stream3-auth-r3`. Browser
`stream3-auth.localhost:18131`, separate from other streams' cookies. No hosted
provider activation. Email log mode is not delivery. Own Next `.next-stream3/` and
generated tsconfig remain uncommitted; preserve application edits when retiring them.

Original synthetic phase stopped/cleaned0 (`cleanup.json`), bareREST removed.
Current private auth-fixtures.json has5 exact owned Auth/public IDs: Alice/Charlie
deleted by real UI; **Bob, Dana, Evan active**, one legitimate Dana→Evan block,
0ChatMessage/0Notification. Do not rerun seeds blindly; exact remaining cleanup
is required after continued verification. No unrelated database/container changed.
Native slot free, but current iOSSimulator failure/AndroidCUA window attachment
prevent installed acceptance; physical Android unavailable in recorded setup.

Adopted merged PR51/6055bc2b9 transaction gate and later real PostgREST/socket replay
within synthetic auth/READ COMMITTED/single-counterparty limits. PR51 mergec14657e35,
CI35137410491 green; restored missing own worktree and advanced documentation-only
master38f00dcc8 before current repairs. September15 mirror76files hashes verified;
September16 raw temporary artifacts were lost, so later reports remain source-bound
accepted evidence, not newly recovered raw proof. No duplicate large-suite replays.

Continue whole-stream N01–N05/A01–A05 mapping below. N03 current step: existing
My Beacon setup on Dana, preview reached, **not yet published**; local development
identity/persona/broadcast defaults enabled, release cohort/provider unverified.
N01/N02 provider/device, N03 public/private/follow/mute/post/old-link, N04 remaining
access/moderation, N05 delivered reminders, A01 recovery/OAuth/onboarding, A03 storage,
A04 providers and A05 reachable-action acceptance remain open. Route Home/payment
findings to their owners. New shared/schema/runtime work goes to active coordinator
`01a0c0d1-0703-70c3-b842-6d01bc8ca48b`; old coordinator remains retired.

**The historical sections below retain their original evidence. This current
snapshot supersedes their stale draft/paused/no-migration/next-race instructions.**

## Source and reconciliation

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. **PR #51 merged to master as `c14657e35`**;
branch fast-forwarded to that base, tree clean, nothing unpushed. Backend suite
green on the merged base (326 suites /5473 tests /0 failures). The transactional
block admission work (`6055bc2b9`) is now in master. Initial inspection found clean `fc99f8ee7`
with no later changes, PR or CI. Current master `0616d6e79` was integrated as
shared documentation only. Current pushed milestones: **`dfc860bfe`** (initial safety repair), **`41588bbec`** (native lifetime/web navigation), **`8d31d452f`** (N05 reminder failure contract), **`bf16f6f50`** (message retry privacy), **`22adc7285`** (existing retry test fixture models SQL NULL actor defaults), **`6055bc2b9`** (transactional direct-message block admission).
Merged [PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51);
[CI35054358217](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35054358217) for current HEAD **`22adc728512b8dd0f261c0aaf02e255123dc7f50`**
has since **completed successfully** (confirmed 2026-09-16 on resume; it was still
in progress at the cutoff inspection). Earlier runs were superseded; initial Android
indentation failure was repaired. Green CI is not acceptance: the reproduced
concurrent block/send race below is still open, so N04 does not close. No merge or
integration approval.
Application worktree is clean: owned generated tsconfig restored to HEAD and Next
cache moved to private evidence storage after stopping the server.

The prior `fc99f8ee7` router journey used **in-memory Supabase mocks, synthetic
x-test-user-id authentication and in-process Supertest**. It exercised no
browser, native screen, PostgreSQL, RLS, PostgREST or socket transport. Its
post-unblock send returned500, so restored delivery was not proved. Historical
11 iOS/11 Android/1459 web/5430 backend totals were reported by the prior writer;
they were not recovered raw-output evidence in this resumed run. Its broad web
suite did not cover the changed blocked page or Block control. These limits are
not superseded by later evidence for a different source/scope.

## Current bounded milestone — existing N04 safety controls

Implementation repaired in `dfc860bfe`:
- Existing three-platform blocked loaders distinguish incomplete/unavailable
  results from confirmed emptiness, retaining successfully loaded rows. Native
  partial rows use the existing footer; existing screen/layout files unchanged.
- Existing block service throws `BLOCK_CHECK_UNAVAILABLE`, instead of false, on
  failed/malformed count reads. REST/chat socket and neighbor-message callers
  keep unavailable distinct from confirmed blocks. Every active participant in
  a business direct room is checked; an invalidated in-flight query cannot
  publish/cache an earlier allow. Existing room reading/admission policy remains.
- Web Report profile opens the **existing ReportModal**, SDK reportUser and
  existing `users.js`/UserReport endpoint. No replacement reporting system.
- Web list/confirmation responses retire across session changes/unmount; the
  relationship list reads the server-selected counterparty. Browser verification
  additionally reproduced a repeated current-profile-fetch loop, repaired in place.
- Existing excluded chat-access suite is now in the normal Jest runner.

Comparison/reuse: original files, archived UserBlock/UserReport contracts and open
paid socket delta were inspected. The paid delta is its independent private-gig
helper/export; no conflict or edit to that implementation. Existing native model,
chat-access and socket-session tests were extended. Two new focused web regression
files were necessary because existing privacy-preview/Beacon tests cover different
surfaces. The earlier `fc99f8ee7` adds the SDK `endpoints/blocks.ts` application file and export: existing users.ts had no UserBlock client; privacy/relationships clients address different contracts and cannot substitute. It wraps the existing blocks.js HTTP routes using the existing client; no replacement service, screen, table or migration. This resumed milestone adds only two test files.
UserBlock, UserProfileBlock, PersonaBlock and Relationship remain distinct.

## Evidence by class (do not combine these into end-to-end completion)

| Class | Current evidence and limitations |
| --- | --- |
| Baseline reproduced | New web blocked-page6/6 and report/session3/3 failures; repeated-profile read1 additional failure. Backend original21 pass/new5 fail: unavailable create/send201, second participant bypass201, delayed stale allow, missing count treated empty. Android2 distinct partial-list failures, retried to6 recorded failure executions. |
| Local regressions | **42 backend**, **12 rendered web**, **20 Android JVM**, **17 iOS model** pass. Web TypeScript passes; scoped ESLint has warnings/no errors. iOS scoped SwiftLint/SwiftFormat pass. Android formatter fixed the CI indentation defect; final full static/CI remains pending. Native screen wrapper changes are lifecycle hooks only, without layout changes. Mocked/stubbed persistence/auth applies to these tests. |
| Browser → HTTP → persistence | Actual existing profile Report submitted harassment to one pending UserReport; profile Block succeeded; Settings → Blocked Users displayed Social Bob; Unblock removed the UserBlock; failed personal list + successful empty relationship list showed unavailable/Retry, then confirmed empty after recovery. Actual SDK, HTTP, PostgREST and PostgreSQL; synthetic authentication, older retained schema, local Debug/development runtime. |
| Actual HTTP/PostgreSQL | **9/9** focused cases pass: owner list/removal isolation, bidirectional direct-create denial, duplicate blocks, reverse block after unilateral unblock, warm-cache unblock/create/send with a saved message, existing-room member reads/nonmember denial/bidirectional send denial, unavailable block read503 with no intercepted delivery effects, browser report persistence and retry. |
| Native installed | New owned simulator installed/launched with API18130. Initial preview-auth launch was insufficient (401); the accepted run used the real installed sign-in UI backed by a synthetic local sign-in fixture. Actual installed normal sign-in → Hub → Settings → Blocked users displayed persisted Social Bob; Unblock removed the UserBlock (SQL confirmed). Failed personal list + empty profile list displayed existing error/Try again; recovery/Try again displayed confirmed empty. Synthetic sign-in, local PostgREST/SQL; block creation/report/chat and session races remain unverified on installed screens. |
| Socket/provider | **6/6 actual loopback Socket.IO → HTTP/PostgREST/SQL cases pass**: both-direction denial, warm-cache transition, existing-room membership/nonmember denial, reconnect, reverse block, DB-unavailable acknowledgments/no message/notification effects, one saved/broadcast message after lost-reply retry with outsider excluded. Synthetic exact-fixture socket identity; provider calls intercepted and unrelated global typing cleanup disabled in harness. Initial3-second harness acknowledgment cutoff timed out; rerun with10-second cutoff passed. No provider/device claim. |
| CI / integration | PR51 draft/current HEAD22adc7285; CI35054358217 in progress at final inspection. Earlier Android indentation repaired. No integration/merge; N04/N05 and Stream3 remain open. |

Private detailed scripts, before/after logs, XML, SQL schema snapshot, runtime and
captured persisted rows: `/private/tmp/pantopus-stream3-20260915-r2`.
Key files: `backend-baseline.log`, `backend-final.log`, `web-baseline.log`,
`profile-baseline.log`, `profile-repeat-baseline.log`, `web-final.log`,
`android-baseline.xml`, `android-partial-candidate.xml`, `ios-partial-candidate.log`,
`http-sql-results.json`, `browser-report-persistence.json`,
`browser-unblock-persistence.json`, `ios-unblock-persistence.json`, `socket-sql-results.json`, `android-lifetime-final.xml`, `ios-lifetime-gate-baseline.log`, `ios-lifetime-candidate.log`, `android-lifetime-baseline.log` (two distinct failures retried3 each;19 executions/6 failures). Browser/simulator interactions are also in the
current **Resume Stream 3 verification** task transcript. No raw logs, fixture
credentials or device tokens belong in Git/chat. Coordinator integrates detailed
contributions into the existing report; this is not a new backlog.

## Remaining N04 work and immediate next action

Native delayed-list/late-rollback/account/leave/reopen guards now pass focused model tests. Web navigation baseline reproduced a stuck pending Block action;6 profile +6 blocked-page regressions pass after retiring route controls and updating target profile. iOS reused the exact paid branch `41c75d49a` SequencedURLProtocol gate helper with coordinator assignment. Original delay-based test was nondeterministic and is not accepted; gate baseline failed, candidate17 passed. New native lifetime code is **not yet installed-screen verified**.

Next: remaining existing profile/chat/report entry points and session/departure journeys; full-stream source binding and N05 partial-delivery/preference/destination checks. Native slot released to Stream1. New native model coverage establishes controlled session/departure behavior only; installed account switching remains open.

**RESOLVED at `6055bc2b9`** (was the open blocker at 8d31). Reproduced failure:
delaying the outbound ChatMessage insert after
REST authorization, committing B→A UserBlock first, then releasing the insert
returned201, persisted one message and delivered one `message:new` to B over the
actual socket. No Notification/provider attempt. Evidence:
`concurrent-send-baseline.json`, `verify-concurrent-send.cjs`. The six accepted
socket cases do not cover this interleaving. Existing membership-only ChatMessage
RLS/service-role insertion is not transactional block authorization. Coordinator subsequently granted the exact forward schema/test scope and isolated
migration-test DB listed in the cutoff handoff below. Repair applied within that exact grant, on isolated
SQL64532 only; no retained/shared schema changed.

`6055bc2b9` adds a BEFORE INSERT trigger on ChatMessage that, for direct rooms
only, takes deterministic unordered-pair advisory locks per active counterparty
and re-reads UserBlock. plpgsql VOLATILE gives that re-read a fresh READ
COMMITTED snapshot after the lock wait, so a block committed while the sender
waited is seen and the send is refused PT403. A matching BEFORE INSERT OR UPDATE
OR DELETE trigger on UserBlock takes the same keys. chats.js maps PT403 ahead of
the legacy insert fallbacks; the two participant system-message inserts now
record a denial instead of discarding it.

Two corrections were made to the first implementation after adversarial review,
both verified on SQL64532: (a) the UserBlock trigger's `lock_timeout='5s'` was
removed — a block waiting behind a held send was **aborting at 5002ms**, so
blocks.js returned500 and the block did not exist; it now waits and succeeds
(measured 7063ms). A timed-out send is retryable; a timed-out block is a safety
failure. (b) UPDATE now locks the OLD pair as well, so repointing a block cannot
leave the vacated pair unguarded.

Evidence: migration applies cleanly; generated pgTAP contract passes with
`scripts/db/sync-sql-contracts.cjs` unchanged (56 wrappers verified); two-connection
harness confirms denial PT403, INSERT/UPDATE/DELETE coverage, re-admission after
unblock, and the block-waits fix; backend **326 suites /5473 tests /0 failures**,
chatAccessControl **37/37** (was31/31). Fixtures cleaned (0 remaining).

**Owed live PostgREST smoke check: DONE, passing.** Real PostgREST v16.1
(cached image) on owned API64531 against owned SQL64532; retained64522 untouched.
Results:

| Check | Result |
| --- | --- |
| Control, no block, insert via supabase-js | `error: null`, 1 row inserted — legitimate traffic unaffected |
| Blocked insert, raw HTTP | **403**, body `{code:"PT403", message:"DIRECT_MESSAGE_BLOCKED", details:…}` |
| Blocked insert, supabase-js | `error.code === "PT403"`, `error.message === "DIRECT_MESSAGE_BLOCKED"` |
| The exact `chats.js` branch predicate | **fires (true)** |
| Rows persisted on refusal | **0** |
| Fixture cleanup | 0 remaining |

So the mapping does not rest on documented behaviour any more; it is observed
through the real client. The PostgREST container was removed and 64531 released.
Harness note: supabase-js builds `${url}/rest/v1/...` while bare PostgREST serves
at root, so the transit URL was rewritten in the harness; the client's own error
parsing — the thing under test — was untouched.

**End-to-end socket replay: DONE, the fix holds.** The existing 103-line fixture
runtime and `verify-concurrent-send.cjs` were copied and repointed at the owned
stack (SQL64532, own PostgREST on64531, app18140); the r2 originals are
byte-unchanged. One deliberate substitution: the original read its JWT secret from
Stream1's private file, replaced with an own secret so nothing depends on another
stream's assets.

Same script, same interleaving, same three fixture actors:

| | BEFORE `8d31d452f` | NOW `6e1758234` |
| --- | --- | --- |
| HTTP status | 201 | **403** |
| ChatMessage rows persisted | 1 | **0** |
| `message:new` delivered to B | 1 | **0** |
| Notification rows / provider attempts | 0 / 0 | 0 / 0 |
| held before insert / block committed first | true / true | true / true |

The denial is proven to come from the persistence gate, not the route pre-check
(the route returns a byte-identical body from both): direct psql INSERT raises
`DIRECT_MESSAGE_BLOCKED` at `direct_message_block_admission()` line42, and raw
PostgREST returns `403 {code:"PT403"}`. Four extra interleavings also ran:
control (201/1/1, happy path intact), reverse-direction block during the hold
(403/0/0), unblock-then-send (201/1/1, the DELETE branch does not wedge), and a
block-read fault case.

Independently audited by two agents against the live catalog: both agreed. The
installed `pg_get_functiondef` was diffed against the committed migration and
matches.

**Caveats recorded rather than smoothed over.** Authentication is synthetic
(`x-fixture-actor` header, `db.auth.getUser` stubbed) — the authorization decision
is real, the identity is not. The retired stack reached PostgREST through Kong,
which strips `/rest/v1`; this replay talks to bare PostgREST, so the harness
rewrites that prefix — a deviation the baseline run did not have. The race is
forced, not natural: the insert is parked inside the client fetch shim, before the
request leaves the process. Providers are intercepted, so `providerAttempts:0`
proves the route did not call them, not that a real pipeline would stay silent.
Single-counterparty rooms only, so the multi-key lock ordering, the
`DIRECT_MESSAGE_ACTOR_INVALID` spoofing guard and the `is_active IS NOT FALSE`
divergence are still unexercised end-to-end. READ COMMITTED only. The audit also
correctly flagged that "ran twice, byte-identical" is unverifiable from the
artifacts, that `heldBeforeInsert`/`blockCommittedBeforeMessageInsert` are
asserted-then-hardcoded literals rather than measurements, and that the
`persisted` counts are filtered rather than table counts.

Cleanup: fixture rows created14, removed14; exhaustive count over every base table
in `public`, `auth` and `storage` shows only canonical seed data remains. PostgREST
container removed,64531 released; 64532 left running. One leftover of this
stream's own making was found by the audit and reaped: a backgrounded smoke-check
process had errored without closing its `pg` client and held a session for ~63
minutes; its fixtures were already removed and0 rows of either prefix remain.

N04 still does not close: the ChatParticipant activation race, ungated message
edits (`PUT /api/chat/messages/:messageId`, outside the sends-only grant),
installed native block/report/chat lifetime and the account-deletion `UserBlock`
FK lead all remain open.

Still open: all existing block entry points, installed native socket/reconnect,
concurrent block versus already-authorized send (cache invalidation is not a SQL
transaction), multi-process cache boundaries, lost successful replies/retry,
actual offline and navigation/account transitions, PersonaBlock cascade lifetime,
report moderation and old/shared/deep-link authorization. Separate scopes retain
existing policy; do not invent profile/bid/message policies from existing UI copy.
The prior account-deletion/UserBlock FK lead remains to reproduce. Home/gig findings
are routed through the coordinator, including the gig chat-room block path.

## Reproduced: account deletion is blocked by UserBlock (A02 / N04 lead)

**Reproduced at the database level on isolated SQL64532**, not inferred. Both
`UserBlock` foreign keys to `"User"` are NO ACTION and the deletion handler in
`backend/routes/users.js` never touches the table (`grep -n UserBlock` there
returns nothing), so:

| Case | Result |
| --- | --- |
| Delete a user who has blocked someone | `ERROR: violates foreign key constraint "UserBlock_blocker_user_id_fkey"` |
| Delete a user **someone else** blocked | `ERROR: violates foreign key constraint "UserBlock_blocked_user_id_fkey"` |
| Delete after the block row is removed | succeeds |

The second case is the serious one: a third party who blocks you can prevent your
own account deletion. All fixtures were created inside a transaction and rolled
back; 0 rows persisted.

**`UserBlock` is the lone outlier among the sibling contracts** — this is a
consistency repair, not a new policy:

| Table | FKs to `"User"` |
| --- | --- |
| `UserProfileBlock` | both ON DELETE CASCADE |
| `UserReport` | both ON DELETE CASCADE |
| `Relationship` | requester/addressee CASCADE (`blocked_by` NO ACTION — same class, likely masked because the blocker is also requester or addressee) |
| `UserBlock` | **both NO ACTION** |

**Grant requested before any edit.** Two candidate repairs, both outside the
current grant:
1. Forward migration aligning the two `UserBlock` FKs with the CASCADE precedent
   its siblings already use. Smallest and consistent; no applied history rewritten.
2. Clearing the rows in the `users.js` deletion handler, matching how that handler
   already treats other tables.
Recommend (1), with (2) only if the handler must stay the single point of truth.
`backend/routes/users.js` and FK-altering migrations are not in this stream's
current assignment, so nothing has been edited. `Relationship_blocked_by_fkey`
should be assessed at the same time by whoever owns it.

## Whole-stream coverage reconciliation (existing inventory rows)

| Rows | Existing implementation/evidence to preserve | Remaining acceptance |
| --- | --- | --- |
| N01–N02 | Notification routes/dispatcher/DeepLinkRouter/AuthManager; [platform report](../notification-platform-verification-2026-09-09.md), [iOS continuation](../ios-notification-continuation-2026-09-09.md), [chat continuation](../chat-notification-continuation-2026-09-09.md), existing Home Task routing reports. Reported Android FCM emulator permission and exact post/chat return are distinct from iOS synthetic installed navigation and owner-confirmed physical iPhone Beacon preferences. | Bind unchanged source/config before reuse; remaining foreground/background/cold-start, token/account/unread/preferences matrix. Physical Android unavailable in recorded setup; no new hardware granted. Provider-delivered versus saved records must remain separate. |
| N03 | Nearby → Pulse/Beacons/Connections, directory/following/profile/post routes; [social discovery](../social-discovery-2026-09-06.md), screen-parity/native wiring catalogs. | Current cohort flags, posting eligibility, reply/conversation return, mute/unfollow, identity/access-change/old-link boundaries. Historical local fixtures do not establish release/provider acceptance. |
| N04 | Current milestone and limitations above; existing blocks/privacy/relationships/persona/report/chat contracts. | Complete the remaining matrix above; current milestone does not close row. |
| N05 | Existing calendar editor, calendar service/RPC/briefing signals and reminder jobs; [calendar reliability](../calendar-reliability-2026-09-06.md). Saved pickup rules deliberately no longer promise night-before push. | Trace each still-promised reminder through worker, retry/preferences and actual authorized destination/delivery. A saved schedule is not delivery. Coordinate Home calendar ownership. |
| A01–A02 | Existing auth forms, users/auth routes, provider callbacks, session/device stores; [sensitive auth](../native-sensitive-auth-2026-09-09.md), [form hydration](../web-auth-form-hydration-2026-09-12.md), notification continuation and accepted Home account-lifetime reports. | Real signup/verification/recovery/OAuth/provider failures and remaining session expiry/revocation/logout/account switching/local retirement. Current synthetic sign-in does not satisfy provider acceptance. Shared auth edits need assignment. |
| A03 | Existing upload/storage/document paths; accepted file-picker PR44, document/upload reports linked in verification reconciliation. | Hosted Auth/Storage/quotas/permissions and native chooser/provider boundaries. Obtain shared-file ownership before edits; no storage change assigned here. |
| A04 | [Provider report](../staging-provider-acceptance-2026-09-09.md): historical Google premise success, Smarty402/no active subscription, Google/Apple OAuth disabled in staging, Lob test request/outage evidence. | Read-only current configuration/source reconciliation first; activated residential/provider/OAuth capability unverified. No purchases, subscriptions or provider activation authorized. |
| A05 | Existing screen-parity/mobile wiring catalogs, current web page/component routes, Root/Hub/Settings/feature navigation, Calendarly inventory. | Reconcile reachable actions against current source and actual UI. This pass already verified profile safety and found/fixed the profile read loop. Marketplace/subscription/booking/wallet/mail/search remain to trace; Home/payment findings go to owners. |

These are coverage mappings to the authoritative N/A rows, not new acceptance
closures. Loading/error/retry, accessibility and session lifetime accompany each
journey. Native/web appearance remains protected.

## Coordination and active resources

Granted: blockService.js, direct-chat socket handlers, chats.js and bounded Jest
suite inclusion. Broader auth/notification/shared SDK/schema/storage edits need
new coordinator assignment. Coordinator notified of baseline/final evidence and
owns shared report publication and eventual review/merge.

Final cleanup at **2026-09-15 21:13:58 PDT**: stopped owned HTTP18130/PID91147
and web18131/PID93370; process inspection confirmed both absent. Exact three synthetic
User IDs `f9150300-0000-4000-8000-000000000001` through `...0003` and their owned
rooms/block/report/relationship/notification/audit rows were retired by the runtime's
transactional cleanup. Correct UserProfileBlock ownership column is `user_id`.
Fresh `cleanup.json` reports **0 remaining fixture users**; `final-cleanup-state.json`
binds cleanup time and source. Earlier wrong-column cleanup had rolled back and is
not final evidence. No REST18089 access, retained SQL64522 schema/reset/container
mutation or another stream's fixtures. HTTP18130/web18131 are released.
Heavy native slot **released to Stream1** after final20 Android/17 iOS runs; no new local native build/install until coordinator releases it. New simulator
**Pantopus Stream3 Social R2**, ID `0AE16FA0-E244-414F-86C8-24893BDFD979`, iOS26.5.
App build uses explicit API/socket18130 settings; no existing simulator/physical
phone was installed or changed. Owner's iPhone17 remains untouched. Owned simulator shut down after the run. Android JVM
run finished; no Android AVD acquired. Generated products and logs are private.


## N05 bounded milestone — booking reminder failure contract

Source `8d31d452f`: existing scheduling UI/API/BookingPage.reminder_minutes →
`jobs/bookingReminders.js` → `services/scheduling/bookingNotifyService.js` →
existing Notification/emailService. Worker already releases BookingReminderLog
when delivery throws. Baseline existing schedulingLogic suite23 passed/new3 failed:
email `{success:false}` and personal Notification null both resolved as success,
and the worker kept its sent-log row. The granted service-only repair checks these
results and throws; unchanged worker now retries then deduplicates the accepted
receipt. All26 tests pass with mocked database/provider responses. No schema,
provider activation, worker or notificationService edit. This is not real delivery.
Partial-recipient retry duplication, lost provider acknowledgments, exact timing,
preferences and authorized destination still need verification. Detailed private
`n05-booking-baseline.log`, `n05-booking-worker-baseline.log`,
`n05-booking-candidate.log`. N05 remains open.


## N04 follow-up — message retry privacy

Actual8d31 HTTP/PostgreSQL baseline: fixture C (not a member of A/B room)
submitted A/B's known client_message_id in its authorized C/A room and received200
with A/B's private message/author/room. Existing chats.js lookup filtered only the
global unique client ID, contrary to its same-room/sender comment. Inbf16f6f50 the
existing lookup and23505 recovery bind authorized room, sender and human business
actor; wrong-scope collisions return409 without content/effects. No new schema.
68 existing focused backend cases pass (one first-run socket-hang-up in chatRoutes
passed on the affected repeat). Actual HTTP/PostgreSQL3/3: outsider409, original
actor authorized retry200, concurrent same-scope200/201 with one saved row. Business
actor separation is model-tested only. Existing excluded delivery suite's two retry
cases initially failed because its fake insert omitted PostgreSQL's NULL actor
default; the existing fixture now models that default and both cases pass. A CLI
ignore-pattern override initially selected unrelated suites and is not acceptance;
the corrected private config ran exactly the two delivery cases.

Evidence: cross-room-retry-baseline.json, retry-scope-baseline.log,
retry-scope-final.log, retry-scope-results.json, retry-delivery-focused.log,
retry-delivery-final.log. This repair does **not** fix the transactional block race.

## Cutoff handoff — exact next action and reservations

User requested immediate wrap-up; no further implementation or tests were started.
All application changes are pushed in draft PR51 at22adc7285. Coordinator's prior
review covers onlydfc860bfe; newer lifetime, reminder and retry milestones still need
coordinator review. Coordinator also paused on user request; heavy native slot was
released, but recheck live reservations before any new build/install.

**Done on resume (2026-09-16):** the concurrent admission failure is repaired at
`6055bc2b9` and pushed. **Next action:** stand the fixture API back up on an owned
port against an owned database, replay `verify-concurrent-send.cjs` against the
fix, and confirm the PT403 → HTTP403 mapping through real PostgREST. Then continue
the whole-stream coverage table; do not stop at N04.

Coordinator already granted these exact files (no need to request the same grant again):
- `supabase/migrations/20260916010000_direct_message_block_admission.sql` (forward migration).
- `scripts/db/contracts/direct-message-block-admission.sql` (new source SQL contract).
- `supabase/tests/direct-message-block-admission.test.sql` (generated with existing
  `scripts/db/sync-sql-contracts.cjs`, leave generator unchanged).
- Existing `backend/routes/chats.js` denial mapping and existing
  `backend/tests/integration/chatAccessControl.test.js` focused regressions.

**No files in that new migration/SQL-test scope have been created yet.** Existing
application baseline, archived034/037/072 and open branch work were compared: no
transactional UserBlock admission contract exists. Applied history must remain
unchanged; use existing tables/columns, no replacement service/table/screen.
Scope is **direct-room sends only**, current human actor versus all active
counterparties. Do not widen gig/group/read policy or direct-create RPC scope.
Current send uses human request identity for authorization and stores business
sender separately in `user_id`, human in nullable `actor_user_id`. Current
`get_or_create_direct_chat` has no SQL block guard; its race is separate, unverified.

Proposed approach, **not implemented or validated**: deterministic unordered-pair
locks shared by UserBlock mutations and direct ChatMessage admission, with a fresh
block check after waiting. Inspect participant roster stability and all active
counterparties; do not assume cache revision solves SQL concurrency. Preserve the
existing no-counterparty behavior and room-read policy. Required contract evidence:
real two-connection wait/commit orders, rollback, reverse blocks, business actor,
empty/no-member cases, service-role trigger enforcement, grants/search_path, and
isolation limits. In particular test snapshot behavior beyond READ COMMITTED,
roster changes, lock order/deadlocks, and actor spoofing. Avoid accidentally invoking
chats.js legacy insert fallback through error text containing actor_user_id or
check-constraint patterns. SQL errors must fail closed without message/socket effects.

Owned isolated DB is **left running for the next agent**, canonical schema only;
no fixture phase or new migration began:
- Workdir `/private/tmp/pantopus-stream3-block-db-r1`.
- Project/container prefix `pantopus-stream3-block-r1`;
  container `supabase_db_pantopus-stream3-block-r1` healthy, SQL64532.
- API64531/shadow64533 remain reserved; API runtime was not started.
- Supabase PostgreSQL17.6.1.165/PostgRESTv16.1 cached locally. Existing canonical
  migrations replayed successfully. Initial config without auth bootstrap failed
  and CLI removed its own failed container; restored canonical bootstrap passed.
- `supabase/migrations` and `supabase/tests` symlink to application canonical paths.
  Config differs only for isolated project/ports. Never reset SQL64522, use
  Stream1'sf9150410 fixtures, touch REST18089, or activate hosted migrations/providers.

Owned simulator `0AE16FA0-E244-414F-86C8-24893BDFD979` remains shut down. The installed
run predates the native lifetime repair; installed lifecycle acceptance remains
open. No Android installed or physical-device acceptance was obtained.

**Durable evidence:**
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260915-stream3-social-r2/`
contains **76 files** refreshed at cutoff, including final cleanup, retry/privacy
and isolated DB bootstrap evidence. `MANIFEST.json` SHA256:
`f5ac697ba9f06552aeda14b1bbfa01f4b795779817bcf4f9bbe1e368956bac13`.
Individual evidence retains its actual source/config; manifest current HEAD does
not mean every earlier check was rerun. Directories700/files600; private scripts
and operator logs stay out of Git/chat. Original private runtime/scripts remain at
`/private/tmp/pantopus-stream3-20260915-r2`. Large ios-derived and retired Next cache
were intentionally excluded from the durable mirror. Browser/simulator action
history remains in task `01a0a824-301b-74e3-a1d9-b205714ed7a1`.

After the transactional milestone, continue the whole-stream coverage table above;
do not stop at N04. N01/N02 historical Android evidence at699c531a predates changed
AuthRepository/PendingDeepLinkStore source253d5c6cf; bind newer accepted evidence
before reusing those session claims. N05 SupportTrain's shared last_reminder_sent
24-hour/day-of behavior is a source lead, not a reproduced defect; new worker edits
need assignment. Native chat block/report lifetime and account-deletion UserBlock
FK are also unverified leads. Route Home/payment findings to owners. This file is
the sole live Stream3 status; coordinator owns detailed shared-report publication.
