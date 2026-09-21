# Stream 3 — Accounts, social and notifications

Updated 2026-09-21T01:33:20.261710+00:00. **Stream incomplete; bounded milestones under review.**
Sole live status is this neutral coordination file. No new unit tests written.

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, checked-out
branch `codex/workstream-accounts-social`, local HEAD **afe8d2f4c** (application source **57e495460**), application tree
clean. Only untracked owned `.next-stream3/` remains. Preserve it while Next runs.
Remote primary branch is **21b93aa62** after isolated reuse of the accepted iOS fixture correction; live runtime includes separate preference failure5e3a8b963 and canonical timingUI e11123328.
Coordinator requested explicit commit pushes for the later independent milestones:

| Milestone | Branch / head | Review / current CI |
| --- | --- | --- |
| Beacon comment/privacy/drafts | codex/workstream-accounts-social / 21b93aa62 | [Draft PR70](https://github.com/WangPantopus/skinny-pantopus/pull/70), base master. Prior CI35546207895 failed all three iOS test jobs; iPhone16 log confirms four assertions from the expired September17 booking fixture. Reused accepted paid9ecf66fc7/9ae1edb3b as b30f4b330/07827d2b0, identical final fixture bytes. Exact078 CI35547834908 all applicable green. Strict branch protection required docs-only master e8b49c963 merge in isolated checkout→21b93aa62. Diff exactly5docs, backend/frontend/supabase bytes unchanged. Exact21b required CI35549733796 all15 applicable/aggregate green. Coordinator merged PR70 as358daaa17068ebbb6c9591b13bf0378cea7d02b1 at01:39:03Z; no UI rerun for docs. Detached owned /private/tmp/pantopus-stream3-pr70-ci is clean; runtime checkout untouched. |
| Reminder receipt/destination | codex/stream3-booking-reminder-retry / cbfba3503 | [Draft PR72](https://github.com/WangPantopus/skinny-pantopus/pull/72), stacked on remote PR70 branch. Exact-head CI35547400223 CI OK/all applicable green; native/web skipped by paths. Two-file source reviewed by coordinator. |
| Personal posting/draft recovery | codex/stream3-personal-post-recovery / 423176969 | [Draft PR73](https://github.com/WangPantopus/skinny-pantopus/pull/73), stacked on PR72 branch. Exact-head CI35547412275 CI OK/all applicable green, including web/identity E2E; native skipped. Five-file source reviewed by coordinator. |

All three attached to this task. Author did not merge. Retarget master only after
prerequisites merge; do not push later commits into PR70 or conflate another stream's
CI with this one. Coordinator asked to finish these bounded handoffs before a new
application scope. Independent evidence/inventory continues.

## Coordinator integration progress (read-only reconciliation)

PR70 merged358daaa; PR72 currentf2ea16704 merged703e7050867d4747db958dfda8a20bf2224d1991;
PR73 current806d64635 mergedae85bad599f87933ac00e3f76ca23ac5cb6daa53; PR75 current5edcaad6c
mergedcc560bce6c61d915d8a3c503a55b8c167270a43e; PR77 currentcc252a474 mergedb49dd59224d38c060d726a11bc45148f36404fcf.
Coordinator checked each strict update changed only docs/accepted clock fixture before
required CI. Accepted application bytes/evidence unchanged. PR80 is now coordinator-owned
at05acf40319313d935edc682535623402386caa02, pending strict CI/integration. PR81 remainsdd805.
Author did not merge or mutate those refs. Historical milestone sections below retain
original source heads and acceptance boundaries. Local runtime remains the newer source.

## PR75 — preference database failures, ready for review / CI

Coordinator grants sole writer for existing scheduling.js GET/PUT notification-preferences
handlers and schedulingNotifyPrefs.js getPrefs only. Actual Evan UI Save of Atstart
stores nested[0] but resets to defaults with success; UPDATE denial likewise returns200
and success while SQL unchanged. SELECT denial renders defaults with200. All grants
restored; exact created Evan preference row retired, restoring original absence.
Source423, private reminder-prefs-baseline.json and before/after snapshots.

Committed/pushed **5e3a8b963** on codex/stream3-preference-failures in
[Draft PR75](https://github.com/WangPantopus/skinny-pantopus/pull/75), stacked on PR73
branch423. Coordinator reviewed exact two-file source; exact-head CI35548342100 all applicable green. No older
PR ref changed. Current repair checks database errors, preserving genuine absent-row defaults.
Actual candidate UI: failed GET500 shows Try Again; restored SELECT and Retry returns200.
INSERT/UPDATE denial500 shows safe error and retains selected15/30; sameformretry200
persists one row. Canonical HTTP save/read200; read and PUT readfailure500; worker
rejects before claiming and notice/log counts unchanged; recovery200/absentdefaults200.
Existing26 scheduling regressions pass, no new tests. Evidence prefs-ui-results.json,
prefs-http-results.json and prefs-existing-regressions-final.log bound to5e3a8b963.
Exact Evan preference row retired (0); SELECT/INSERT/UPDATE restored. Successful
web save still resets due to separate nested-field mismatch; no fulljourney closure.
Concurrent first inserts/updates, installed native and provider delivery remain open.
getPrefs consumers: HTTP GET/PUT; reminder worker reads before claiming delivery;
hostWants/hostWantsKey gate existing lifecycle/reminder notification service. Existing
lifecycle wrapper catches/logs notification failure; broader delivery retry remains open.
No new storage, test, schema or presentation change. Web lead-time alignment is separate:
existing native H1/A4 use BookingPage.reminder_minutes; webH1/A4/WorkflowList use nested
prefs. Master/paid/Beacon variants inspected; no replacement implementation needed.
Controlled ownerHTTP page[0] plus SQL booking start+2min and real-clock manual worker
produced0 reminder_0m logs/notices; original page/times restored in finally. This is a
controlled API/SQL reproduction, not natural timing or UI delivery acceptance.

## PR77 — canonical web reminder timing, ready for review / CI

Coordinator assigned exactly RemindersQuickSetup.tsx, WorkflowList.tsx, and
NotificationPrefsForm.tsx reminder section. Reuse existing SDK get/updateBookingPage,
canonical reminder_minutes already used by native/worker; preserve[]/0 and existing
five/43200 limits. Existing design/channel/pause policy stays. Scope async responses
and pending timers to originating owner/mount; serialize auto-saved reminder edits.
Committed/pushed **e11123328** on codex/stream3-reminder-timing-ui in
[Draft PR77](https://github.com/WangPantopus/skinny-pantopus/pull/77), base PR75branch.
Coordinator reviewed source. Exact-head CI35549296796 all applicable green; local finaltypes/lint pass,
no new helper/test/schema. ActualH1[0]save/reload,[]→WorkflowNoReminders→A4none;
rapidA4edits under2200msfirstreplyhold persist latest15/30/60; reloadmatches.
Five-choicecap and31days rejected;30days43200 saved. Readfailure500 across all3
surfaces is explicit/retryable. UPDATEfailure H1retains/A4rollsbackconfirmed; restore
and retry saves. H1doubleSave/lostcommitted503 with neweredit retainslatest/retry;
A4pendingdeparture retires queuedsecondwrite and latecompletion. SQLgrants restored.

Actuallogout during heldEvanPUT retiresoldtab. Boblogin and reopenedH1 show onlyBob
1day+1hour; BobSQL unchanged. **Newlogin occurred1.1s after oldreply release**, so no
new-login-before-old-reply claim. Home/business owners and native/provider/offline
remainunverified. Worker0/empty/30day delivery unchanged; channel/pause mismatch and
oldWorkflow helper copy remain separate. This is persisted timingUI acceptance only.
CreatedEvanBookingPage27c8a4f3-4e62-43ef-8c40-cd25c5ae6637 deleted0; Evanprefs0,
Bobpage1440/60 unchanged; all faultflags consumed. Otheroriginalfixtures retained.
Evidence reminder-alignment-ui-results.json, page-response-faults.jsonl,
reminder-alignment-types-final.log/lint-final.log, bound to committed3file hashes.
Prior PR75 failure repair remains separate at5e3a8b963; all existing PR refs intact.

## PR80 — reminder worker settings/delivery repair, review / CI

Actual H1 saved Bob[] through realUI/API/SQL. With one existing booking timestamp
controlled to+60min, real-clock manual worker emitted a hostnotice and SMTPemail,
shown in localMailpit receipt dZecpRLTpxrcGCngB5PCbX. User selectedNoReminders.
UI[0], start1minpast/endfuture:0zero logs/notices. UI[43200], start30daysahead:
0long logs/notices. Worker source ignores[]/0 and caps scan/offset7days despite
canonical route/native30day acceptance. Each booking timestamp restoredfinally;
Bob1440/60 restoredthroughUI. Exact new60m notice/log deleted so candidate[] cannot
pass using baseline dedupe; SMTPreceipt retained private. Coordinator now grants existing bookingReminders.js and bookingNotifyService.js
formatLead only: explicit[]; integer0..43200/30day scan; recentlystarted zero only,
no early-zero send; existing120mincatchup/completion/dedupe/release; checkedpage/eventtype
read errors. Committed/pushed **6e422bd91** on codex/stream3-reminder-worker-times in
[Draft PR80](https://github.com/WangPantopus/skinny-pantopus/pull/80), basePR77branch;
Exact-head CI35550052378 all applicable green. Candidate actualH1[]→no notices/logs with earlier60m dedupe
removed; zeroearly→none; duezero2concurrentrealworker calls→1log/1host/1SMTP then
repeatunchanged;30days→1/1/1 thenrepeatunchanged. Page/EventType readfailures leave
no newnotice/log; restoredreads allowretry. SMTPfailure→host1/log0; restoredSMTP
retry→hoststable/log1/email1; repeatunchanged. Existing26schedulingregressions pass.

Exact newcandidate3logs/3notices deleted; Bob1440/60 restoredviaUI, all controlled
bookingtimes restoredfinally and allgrants restored. SMTPhealthy; its controlled
restart cleared earlierinmemory receipts (recorded taskUI/private evidence);
latestretrymail nwcabv5XDV27ai4hDogox4 remains. Originalfixtures retained.
Sourcehash-bound reminder-worker-candidate-results.json and eight linked realworker
results include precise boundaries. PR72 destinations reused with unchangedbytes.
No naturalcron/exactstartguarantee, installednative, providerrelease, lostSMTPack,
or concurrentcancellation/reschedule/settingschange acceptance. N05 staysopen.
Granted existing worker plus existing formatLead zero-label;
no cron/provider/schema/newservice change. Evidence reminder-worker-{empty,zero,long}-baseline.json,
corresponding private logs and reminder-worker-baseline-cleanup.json. ControlledSQL
timestamps/manual invocation are distinct from natural schedule/cron/providerrelease.

## PR81 — canonical host push choices / response lifetime

Coordinator assigned two existing web files, hub/notificationPrefs.ts and
NotificationPrefsForm.tsx. Actual Bob Reminder sent/P off→PUT200 and success toast,
then immediate/reload reset on. SQL nested scheduling.host.reminder_sent.push=false
but canonical notify_me.reminder=true. Real manual worker created1hostnotice/1log
and actual dropdown displayed it. Same helper blob in master/paid/Beacon branches;
reuse native notify_me contract, no replacement service/schema needed.

Committed/pushed **dd80580e4**, codex/stream3-host-notification-choices,
[Draft PR81](https://github.com/WangPantopus/skinny-pantopus/pull/81), base PR80branch.
Exact-head CI35551218783 all applicable green. Map five supported host push rows to canonical notify_me
(reminder_sent→reminder), serialize saves, latest-response guards, confirmed rollback,
retire queue/timers on owner/mount departure; explicit accessible names, same layout.
Actual off save/reload persists; worker hostnotice delta0, attendeeSMTP/log delta1
under unchanged transactional policy. UPDATE500 rolls back; restore/retry200.
Rapid changes with8000ms earlier reply held persist latest choices/reload; committed
reply replaced503 rolls back and retry200 converges. Leave with15000ms held first
write retires queued second edit. **New login before server release established (not late response delivery)**: Bob PUT held
01:29:27.913Z; logout20001:29:41.254Z; Evan login20001:29:53.325Z; Evan screen01:30:02.532Z
has own defaults before old release01:30:12.913Z; after01:30:20.813Z remainsEvan defaults.
The45s hold exceeds SDK30s timeout, so late successful client delivery is unproven.
Bounded25s repeat: Evan UI01:37:28.091Z before release31.545Z, but response/socket
destroyed=true, no finish event. Navigation/session retirement disconnects the old
request. After55.558Z Evan remainsunchanged; NO intact late-response delivery claim.
Evidence channel-overlap-transport-results.json. New exact emptyEvanpage66629ef2-03c3-44c5-bd8f-f2e677c05514
and new Bobpreference row cleaned; no app change or broad rerun.
Bob queued cancellation never saved. Reschedule/no-show also actualsave/reload/SQL.
Type gate/focusedlint passed, no new unit tests. Source hashes in private
channel-candidate-results.json; baseline channel-baseline-results.json, linked worker
records and prefs-response-faults.jsonl. Real localGoTrue/HTTP/PostgREST/SQL; manualworker
with restored onebooking timestamp/localSMTP, no cron/installed/physicalpush claim.

Cleanup: baseline newhostnotice/log removed; candidate1log removed. Exact newly
created Bob/Evan preference rows removed, both0. Auto-created empty EvanBookingPage
604f23a8-c77a-4037-a1ec-e9275e887cdc removed after verifying0bookings/eventtypes. Bobpage
1440/60 and originalfixtures retained; grants restored, faultflags consumed.
Host email, attendee toggles, dailyagenda8am and pause remain separate unresolved
policy/wiring rows; no inventedpolicy. Non-reminder rows have UI/API/SQL evidence,
not full lifecycle delivery. Home/business switches, true offline/reconnect and
same-user multitab writes remain unverified. Stream and N05 remain incomplete.

## PR82 — Security records, refresh and session cleanup

Coordinator assigned existing authDeviceService.js list helpers, authSessionService.js
listActiveSessions/listSecurityEvents, and web settings/security/page.tsx loader and
lifetime behavior. Baseline dd805: actual Security Refresh during denied
AuthSecurityEvent SELECT returned GET devices200 and “No security activity recorded
yet,” despite previously visible history. Restored grant/Refresh recovered the events.
The same list helpers returned [] for device/session read failures. Native/current
master/paid implementations and all helper callers were inspected before editing.

Draft [PR82](https://github.com/WangPantopus/skinny-pantopus/pull/82), branch
codex/stream3-security-read-errors, current review head **afe8d2f4cab1c9cbda5558f5d067451fb4a69213**,
application source **57e495460e9aaacb6c50c062ef7dfee7b3f05632**,
stacked on PR81. Three application files plus one existing assertion file. Checked reads reuse route500 handling;
warm known rows remain usable with existing retry banner, cold failure is unavailable.
Loader ordering and session/mount guards retire old results and pending confirmations.
Successful refresh resets expanded history to the existing collapsed/Show more state:
baseline39→Refresh20/noShowMore; candidate ShowMore40, failedRefresh preserves40,
restoredRetry10+ShowMore→40. No layout redesign, new service/schema/provider or unit test.

Actual local GoTrue/CUA/HTTP/PostgREST/PostgreSQL verification: cancel/wrong password
leave auxiliary Evan session200 and Bob200; valid “sign out others” yields Evan401,
Bob200 and current browser still signed in. Registry revoked, GoTrue session removed.
Three individual table SELECT failures now return devices500; standalone events500;
all restored and recovered200. AuthDevice failure during revocation now reports500
AFTER earlier GoTrue/session revocation committed; restored UI retry succeeds with0
additional sessions. This is explicit partial failure, not atomic revocation.

Initial202a candidate global sign-out regression was caught by actual UI: endpoint200
revoked Bob, but strict token comparison after expected cookie removal left private UI
busy. Final57e permits token absence only for successful revoke-all with unchanged
captured marker/mount. Existing endpoint clears the same four cookies as logout;
removed redundant second logout and retained synchronous local cleanup/token-change
broadcast. Actual final Bob global action exits private UI to login01:58:18.275Z;
Bob auxiliary401, Evan200. Local Mailpit received the security email. No physical push.

Evidence ordering limits: old devices500 was held15s, released01:49:53.963/finished.964;
a newer refresh began51.159 but its200 finished54.021. This proves old failure after a
newer request began, not after newer success. Pending unsubmitted global confirmation
retired on Evan→Bob without POST revoke-all. A separate held global response from Evan
at02:02:02.000 preceded Bob login/UI03.835 and release27.002; response/socket were
destroyed, no finish. Bob actual authenticated reload56.636 succeeded. This proves
session retirement/disconnection; **no intact old-account response delivery claim**.
An earlier held attempt logged in only after release and is not overlap evidence.

Private security-read-baseline-results.json, security-read-candidate-results.json,
security-read-http-results.json, security-response-faults.jsonl, security-global-results.json
and global-response-faults.jsonl bind source, exact sequence and boundaries. Existing
2auth suites/100 tests passed before the client-only follow-up; backend bytes unchanged.
Final web type gate/lint pass. Initial CI35552276595 failed an old exact banner-text
assertion. Coordinator granted only the two existing assertion updates (banner wording and
absence of redundant logout; retained local-clear/navigation checks). Committed
afe8d2f4c, application bytes unchanged. All11 existing page cases pass; no new tests.
Current required CI35553113322 runs at afe8d2f4c. Earlier202a/57e CI failures are retained
as obsolete-assertion failures, not current application acceptance.

Cleanup: all AuthDevice/AuthSession/AuthSecurityEvent SELECT grants restored; extra
probe sessions revoked/GoTrue0, audit rows retained. Deliberate global/revoke-others
operations revoked earlier isolated-account sessions; no session resurrection. Current
Bob browser remains for continuing work. No device keys, resume grants, physical/native,
provider activation or hosted persistence acceptance. PR82 not integration-ready until
required final CI is green. Coordinator owns all older stack refs; do not push into them.

## Installed iOS capability attempt — slot released

Coordinator granted sole heavy-native slot and existing owned simulator
0AE16FA0-E244-414F-86C8-24893BDFD979 (Pantopus Stream3 Social R2, iPhone17/iOS26.5).
Boot succeeded. CUA rejected Simulator/name and discovered bundle ID. Xcode27
installation has DeviceHub.app instead of the former Simulator path; exact path
and discovered running com.apple.dt.Devices both timed out in CUA. No build or
install began because actual screen control could not be established. Owned
simulator shutdown succeeded; final booted inventory empty. Native slot released.
No other simulator, physical phone, service reset, provider or source change.
Private native-capability-results.json, native-owned-boot/shutdown.log and
native-after-release.json bind this capability attempt to6e422bd91. Installed iOS
N03/N04 and lifetime acceptance remain open; prior evidence is not promoted.
Continue independent browser verification of existing notification preferences;
channel/pause source leads remain unverified until actual UI/API/SQL reproduction.

## Current safety milestone — merged, broader verification continues

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. [Merged PR64](https://github.com/WangPantopus/skinny-pantopus/pull/64)
final safety head **f387cd480**, committed and pushed. Includes separately reviewable
`e83eaac91` chat actions, `b414ad6f6` cookie-login state retirement,
`72823e366` stale-request retry guard, `f387cd480` pending refresh cancellation.
Coordinator reviewed final source and exact-head CI passed; merged as **2d6ff2069**
at23:00UTC. Safety/N04 and whole Stream3 remain open.

| Reproduced problem | Existing implementation repaired | Actual candidate evidence |
| --- | --- | --- |
| Existing chat-details Report/Block had no handler. | ConversationView uses existing ReportModal, confirmStore, SDK/routes and UserReport/UserBlock. No layout/new screen/service/schema. | Real browser→SDK→HTTP→PostgREST/SQL: report, write failure/retry, block cancellation/failure, lost successful reply/retry one row, Settings find/unblock, pending departure. Earlier phase uses synthetic sign-in; persistence real. |
| Cookie login skipped session-change notification; old tab retained Bob identity/draft and disabled safety. | Existing SDK auth/client + mounted QueryProvider publish existing nonsecret marker, retire cached queries and remount account state. | Real local GoTrue two-tab Bob→Alice login replaces identity and unsaved Private setting with Alice Public default. Same-account protected401→real cookie refresh200 preserves unsaved draft/open drawer. |
| Bob's delayed401 retried under newly signed-in Dana and saved Dana→Evan block without Dana confirmation. | Existing web client binds request to originating session marker; rejects stale response/refresh/retry/cleanup. | Baseline22:37 wrong persisted actor; candidate22:40 no block/no refresh/retry. Same-account Dana401→refresh200→retry200 saves one rightful block. |
| Old successful refresh overwrote new login cookies: fresh Settings returned Bob email under Dana shell. | Existing client AbortController cancels pending web refresh on local/cross-tab account transition; mutex completion belongs to its own promise; stale apply/event/cleanup checks. | Real GoTrue refresh with all4Set-Cookie intact: baseline945ms rollback; candidate920ms preserves Dana fresh protected read. New Dana401→refresh200 also succeeds before canceled old reply release. Old400 + newDana refresh leaves Dana signed in. Two earlier >10s client-timeout attempts excluded. |

No backend/socket/native source change in PR64. Web TypeScript passes on final
source (`refresh-cookie-candidate-types.log`); focused lint0errors (one existing
Settings ts-nocheck warning in separately held A02 page). CI is distinct from browser acceptance.
Expired/failed responses and delay schedules were injected privately. Local auth,
HTTP handlers and PostgreSQL were real. No hosted OAuth/provider or installed
native acceptance. Cross-tab cancellation depends on browser storage events;
unavailable storage, frozen-tab event delivery and other browsers are unverified.
No unauthorized message or Notification rows in these safety fixtures (both0).


## Integrated A02/N03 milestones

PR65 **f30c7fe7a** merged by coordinator as **61080b399**, exact-head CI35544236662
all applicable green. Existing Settings StepUpPasswordModal and SDK optional X-Step-Up
repair missing-stepup deletion. Forward migration20260916012000 changes only two
UserBlock FKs to CASCADE, matching existing UserProfileBlock/UserReport precedent,
with lock_timeout and compatibility annotation. Actual local GoTrue UI cancellation,
wrong-password retry and valid Alice deletion removed Auth/publicAlice plus two
outgoingblocks; Charlie deletion removed incomingBobblock. Tabs retired to sign-in.
Migration only applied to owned SQL, not hosted. Broader cleanup/provider/native open.

PR66 **3a2b18be5** merged **2d12b85a7**, exact-head CI green. Existing personaBlocks
route-scoped guards fix real Follow404 with audience_profile=false; no flag activation.
Existing personas DELETE-follow checks membership/tier error versus confirmedabsence,
replacing invalid UUID sentinel. Actual UI Follow201/private membership, preference,
mute/refresh/unmute/unfollow work. Lost committed reply503 then stale retry formerly500,
now200 clears. Real HTTP duplicateFollow200/one row, repeatDELETE200, SQLread500 retains
row, blockflagoff404/unauth401. Synthetic paid marker409 restoredNULL. Existing3suites53pass.

PR67 **0e976ad84** merged **d69482d3f**, exact-head CI green. Existing owner follower
GET/PATCH reuse canonical fan serializer and safe membership fields, preserving
PersonaFollow rank1 view/counts. Actual UI formerly AuthBob/personalusername, now
fan_4e567960; mute/restore works. HTTP whitelist, nonowner403, SQLread500 verified.
Existing2suites31/webtypes pass; stale existing CI identity assertion corrected to
canonical fan fallback (7focusedpass). No new tests; native existing DTOs compatible,
no installed acceptance.

PR69 **62bc6dd61** merged **5eab68ab7**, CI35545384574 all applicable green. Existing
web post page and PostDetailPanel author links now use canonical /@stream3-local-r3.
Actual fullpage and feed-card panel clicks formerly opened missing personal profile;
now reach publicBeacon. Personal/business paths and visual treatment preserved.

## PR70 — comment privacy and failed draft evidence

Core3ea8f3495, combined6f45690a9, correctionc4cbb4138. Six existing files only:
posts.js four comment response paths/future comment+reply notifications; web
CommentThread/page/Panel submit contract; two native PulsePostDetailViewModel mappers.
Existing protected-fan policy and serializers reused. Private actor IDs omitted for
other viewers; ownactor ID remains for own controls. Blank safeauthor ID is mapped
to nil/null in native rows so private-profile navigation is unavailable. No schema,
replacement service or visual change.

Actual creator/fan UI replies save safe fan/Beacon names, ownDelete controls only;
creator reply notification click reaches exact authorized post and clears unread.
SQL AudienceIdentity readfailure500 saves no comment. Beforedraftrepair text cleared;
candidate failure retains text/reply target, SQL stays2, restoregrant sameformretry201
saves one (total3), clears. Real HTTP all4projections safe, ownedit200/owndelete200,
otheredit/delete403, outsider403; readfailure before create/edit500. Existing initial
2suites21pass, final webtypes/lintpass. Required currentCI distinct from this evidence.

Explicit controlled PersonaBlock fixture (direct SQL, no flagactivation/UIblockclaim)
plus real owner reply201 formerly saved1 notice to blockedBob; persona_id metadata
now activates existing suppression: same case0, unblockedreply1, selfreply0. Fixture
block removed in finally. Historical unsafe notices, like notification identity,
suppression-read-error behavior and native installed remain open. Ordinary personal
comment HTTP201/edit200 and actual detailUI still show local identity/owncontrols on
UI-created personal post; that post's creation used later independent helper repair.

Evidence: comment-ui-results.json, comment-http-results.json, comment-block-baseline.json,
comment-block-results.json, comment-metadata-results.json, comment-personal-results.json,
comment-final-types.log/lint.log. Relevant posts.js bytes bound to c4cbb4138 bySHA256.
Attachments/pending departure/newer response/provider/native screens not accepted.

## PR72 — real reminder delivery and destination evidence

Existing bookingNotifyService.js uses recipient-stable existing Notification key and
checked receipt after null return (duplicate and failedinsert both returnnull).
Host reminder uses existing /app/scheduling/bookings/:id with ownerquery; invitee uses
existing ownbookings list. schedulingShared preserves statusCode403 and adds status403
for actual app.js handler. No notificationService/schema/worker change.

Actual existing setup/slotpicker/form→HTTP/SQL confirmed bookings:
baseline af30791e-bf05-4e76-a9ba-63c1d1081574; retrycandidate
9c7f570c-852f-4f22-b32d-6a754555c639; registeredinvitee
7f8c6d81-1431-4328-9026-611a3b6810f6. Real SMTP confirmation receipts. Manual existing
worker at real clock, naturally due1440m offset: SMTPoutage host1/log0; baseline
retry guestemail1 but host2/log1. Baseline actualnoticeclick404. Candidate freshbooking
outage1/log0→retry1/log1/guestSMTP1; repeat keeps counts/readstate. Actual host notice
911b2828-a2b3-4ae7-9d44-fa54d41b7d88 opens correct4:15PMbooking, readtrue. Owner200,
other403(no data), signedout401. Existing26schedulingregressions pass.

Actual LogoutBob/LoginEvan→publicform matching email binds invitee_user_id Evan;
worker saves onehost/oneinvitee reminder. Evan click opens My bookings with only his
4:30PMconfirmedrow; unread2→1. This is authorized list acceptance, not exact individual
invitee detail. Local SMTP mailbox displayed real reminder and489BICS. Manualworker
is not cron cadence, externalSMTP/SMS/push or native evidence. Home/business, preferences,
lost email acknowledgement, concurrent newclaims/cancel timing remain open.
Read-only current UI/source leads: reminder UI writes scheduling.reminder_minutes,
getPrefs only returns canonical reminder_lead_times; Atstart0 is filtered by worker;
requiredphone helper promises SMS though this path sends app/email. No repair scope
started for these leads. Lifecycle notices retain old links and require separate work.

Evidence reminder-ui-results.json (baseline plus candidate/registered),
reminder-authority-results.json, reminder-candidate-*.log/json and mailbox evidence;
exact relevant service bytes bound to cbfba3503. New fixtures retained, not cleaned yet.

## PR73 — personal profile creation and three composer paths

Existing ensureLocalProfile inserted verified_resident absent from canonical table,
swallowed failure into legacy-local-*; Post UUID field rejected it. Actual Bob
Connections UI500/no post also discarded draft. Existing master and Beacon branches
share failing bytes; current table suffices, no schema/newsystem. Helper now uses
canonical fields, checkederrors and concurrent23505 reread; read-only legacyhandle
fallback preserved. Existing PostComposer, useFeedData, AppShell submission function
and feed/page wrapper return success before reset/close. Compose effect consumes only
compose after feed.user exists, preserving surface through initial shell mounting.

Actual inline/global/modal SQLread500 each retains text/form/audience with no post;
restoregrant sameformretry201 creates one/clears/closes. First post58c020b1-13f6-40cf-8b2c-8a4011e37ad4
uses realLocalProfile e18ee833-f979-4013-89e1-b3a0802bc32c. Cold Connections compose
link retains ?surface=connections and opens NewPost. Concurrent DanaHTTP201/201 yields
oneLocalProfile (unforced timing). EvanINSERTfailure500 yields0profile/0post; all grants
restored. Existing3backend suites26pass; finalwebtypespass; scopedlint0errors and
3preexistingwarnings. Personal post/comment realUI preserved local identity.

Ownposts appear optimistically but Connections reload omits them: separate unresolved
feed-reader gap, so fullposting/discovery acceptance is not claimed. Media/native,
pending departure/newer replies/duplicate browser taps remain open. Evidence
personal-post-ui-results.json, personal-profile-concurrency.json,
personal-profile-insert-failure.json, personal-post-final-types.log/lint.log,
personal-post-existing-regressions.log. Fivepersonalposts/twoLocalProfiles/owncomments
retained; exact IDs in evidence. No new unit tests.

## Runtime, retained fixtures and evidence

Owned HTTP18130 (current launcher session34592), Next18131 (60362); real app.js,
GoTrue/Kong64531/PostgREST/SQL64532 project pantopus-stream3-block-r1, private
workdir /private/tmp/pantopus-stream3-auth-r3. Host stream3-auth.localhost isolates
cookies from other streams. SMTP sink pantopus-stream3-mail-r3 binds127.0.0.1:64535
SMTP/64536UI, existing Mailpit image, only stream3-*@example.com/no relay. SMTPhealthy.
No hosted activation, retained64522 changes or anotherstream resource mutation.

Private auth-fixtures.json: Alice/Charlie deleted by actualUI; Bob/Dana/Evan active.
One legitimateDana→EvanUserBlock. Beacon persona b1cb6c08-76d3-4b30-90af-6380ee76fd25,
channel ea747ad3-ce3f-4f22-aafc-24b0868abda1, followerpost2824a813-f632-4ead-adb6-baa42e27e453,
currentBobmembership/fan_4e567960 plus comments/replies/notifications. Refollow changes
membershipIDs; fetch current IDs before cleanup. BookingPage530c443e-c3dc-4c70-884b-b9ca6cdbf8c4,
EventType0506244f-6c1e-4449-bd7e-47781154ae13 and threebookings above, related availability,
attendee/token/reminder-log/notice rows remain. Personal fixture IDs in private evidence.
AuthSession/AuthSecurityEvent/IdentityAuditLog and related records require exact cleanup.
LocalProfile SELECT/INSERT, AudienceIdentity SELECT, PersonaMembership SELECT restored;
synthetic paidmarkerNULL and temporaryPersonaBlocks removed. Mailpit memory resets on
its own restart; current candidate mailbox retained. No broad unrelated cleanup. Read-only fixture-inventory.json now records17 nonempty direct User-reference tables,3 auth users,3 reminder logs,3 booking tokens and5 availability rules. Initial read-only inventory failed on an assumed owner column; corrected to actual AvailabilitySchedule.user_id. This is an inventory, not cleanup.

Earlier synthetic phase cleaned0/stopped; current phase uses real local auth.
Adopted PR51/6055bc2b9 transactional gate and later realPostgREST/socket replay within
reported synthetic-auth/READCOMMITTED/single-counterparty limits; no duplicate rerun.
September15 rawmirror76files verified; September16 losttempraw remains source-bound
reported acceptance. iOSSimulator failure/AndroidCUA window attachment and unavailable
physicalAndroid prevent new installed acceptance; current native CI is not screen UI proof.

Primary private /private/tmp/pantopus-stream3-20260920-r1; durable private mirror
/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/
contains **234 files**, MANIFEST SHA256 **1140457cf2cec8a2497eb9c7f3995897b455d05737f6fc266ca20f992cd8348e**. Coordinator checked fourcandidate
hash bindings. Individual artifacts retain actual source/configuration, not a blanket
HEAD rerun. Credentials/tokens/operatorlogs stay private, outside Git/chat.

A01 partial recovery: realforgotUI→HTTP200→SMTPreceipt→actualemaillink opens resetform
and preserves original /@destination; SMTPoutage503 and restore/retry delivery pass.
Password entry/submission not performed (computer-use credential-change handoff boundary),
so full recovery unverified. ExternalOAuth/provider/native unavailable in currentsetup. Actual Google UI initiates
GET200 but IAB blocks exact local authorization URL (ERR_BLOCKED_BY_CLIENT); real
GoTrue HTTP400 says provider disabled. Local Google/Apple enabled=false; Apple UI
not exercised, no provider activation. Private oauth-local-boundary.json records
source/config and actual UI vs HTTP boundary; successful/cancelled OAuth remainsopen.

## Whole-stream continuation and exact next action

PR70 merged by coordinator; coordinator exclusively retargets72 and later stack; coordinator alone merges/retargets. No new
application scope before bounded handoffs known, per active coordinator. Then resume
existing N01–N05/A01–A05 coverage mapping in historical section below; no row is closed
by these milestones. N03 restrictedpost oldlink403 afterunfollow/refollowrestore and
actual notification destinations are bounded accepted evidence; UI Delivered1 is an
eligible-recipient count, not providerreceipt. N05 realSMTP now supplements prior mock
worker proof; remaining preferences/timing/individualinvitee/cancel/retry cases open.
N04 wider authorization/moderation/socket/platform cases, N01/N02 delivery/device,
A01 recovery/OAuth, A02 broader lifetime, A03 hostedstorage, A04 provider activation,
A05 remaining reachable actions remain open. Sharedschema/auth/socket/notification/
provider changes need assignment; Home/payment findings go to respective owners.

**Historical sections below retain original evidence and are superseded by this
current snapshot for Git/runtime/next-action disposition.**

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
