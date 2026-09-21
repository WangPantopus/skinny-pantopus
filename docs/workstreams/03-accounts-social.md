# Stream 3 — Accounts, social and notifications

Updated September21 — **Stream incomplete; ongoing verification.**
Sole live status remains this neutral coordination file. No new unit tests written.
Application `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/stream3-professional-housemate-verification`, local/pushed
**e729a516a87fb4e406b93462a86ff5b57d6a25d0**, tracked clean plus owned .next-stream3.
[Draft PR117](https://github.com/WangPantopus/skinny-pantopus/pull/117) stacks on frozen
PR115/e47. Automatic [CI35579542422](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35579542422)
queued exacte729. Bounded implementation/local HTTP-SQL verification complete;
CI/review/integration separate and pending. PR114 exact59b and PR115 exacte47 CI green;
refs frozen. No current public screen caller/native acceptance/whole-stream closure.
Coordinator captured prior6927 live03 in d4ce6c85a; current helper grant is in README.
Owned18130/PID68284,18131/PID14742,Supabase64531–37 retained, no native build/peer mutation.

## Private professional blocked-housemate repair — PR117 handoff

Granted only canViewProfessionalProfile after actual private active housemate200 under
either-direction blocked Relationship. Seven current/master/paid/staging/place/Beacon/
originalfc99 helper variants identical. Existing getProfileVisibility checks block before
shared-home access. Move existing professional block guard after self/inactive guards
and before public/private branches:1added/2removed lines, other helpers/scopes unchanged.
No new file/service/schema/middleware/UI/unit tests or presentation change. PR117 stacks
on115 because its actual viewer identity wiring is required; do not merge ahead of115.

Actual local GoTrue HTTP→PostgREST/SQL **10housemate cases pass**: legitimate active
private housemates200; both block directions403/error-only; blocked inactive/ended403;
Relationship SELECT denial500, restored retry403; unblock restores200; unblocked inactive
and ended occupancy403. Twenty focused affected owner/public/private/bearer/cookie controls
also pass after the guard relocation. Existing115 evidence retained separately; no broad
suite repeats. Existing2suites37tests, syntax/diffcheckpass. No new unit tests.

HTTP/SQL-only; temporary Home/occupancy/profile/relationship states SQL seeded, no screen
invented or native/provider/home-UI acceptance. Candidate artifact records precommit e47
plus working-tree helper; final3sourcehashes bind exacte729. Other helpers, shareHome query
failure semantics, session lifetime and safety-scope policy were not expanded.

Cleanup: candidate5exacttemporary rows removed, original Home/HomeOccupancy/
UserProfessionalProfile/Relationship counts0 restored, RelationshipSELECT restored,
auxlogout200. Affected20control phase2exactrows removed/originalprofile/relationship0,
6auxlogout200. ExactIDs/results in professional-housemate-candidate-results.json and
professional-housemate-affected-controls.json; earlier baseline separatelycleaned.
No original retained fixture or peer resource mutated. Owned runtime stays reserved.

Private professional-housemate-final-evidence.json binds3sourcehashes,7refcomparison,
baseline,10+20actualcases,checks/cleanup/limits. Durable **481files** hashverified;
MANIFEST **7393d99b7f073b66c75a9e54893a3ce0e0fa69ea4a799f278234a94770357ec9**
in existing accounts-social-r3 mirror. Earlier artifacts retain actualsource/runtime;
latest head is not blanket rerun. Coordinator owns review and eventual integration,
currently held behind paid fullCI. Next: exact117CI/handoff; preserve114/115 refs.
Broad N01–N05/A01–A05 native/provider/session/delivery limits remain open below.

## Professional public viewer identity — PR115 handoff

Separate README grant limited to professional.js GET /:username optional identity.
Six current/archive/open route tails identical, viewerId alwaysnull. Actual prior
blocked-public200 and accepted-private404 baseline already cleaned. Existing optionalAuth
middleware plus req.user identity now reach existing canViewProfessionalProfile; only
3added/2removed lines. No helper/middleware/global-auth/UI/schema/newfile/unit test change.
Branch independently based721d; PR114 source/ref untouched.

Actual local GoTrue bearer and cookie login→HTTP→PostgREST/SQL **20cases pass**:
blocked public both transports403, reverseblock403, owner200, anonymouspublic200;
Bearer blocked viewer wins over another owner's cookie. Relationship SELECT denial
returns500 for authenticated nonowner, owner/anonymous existing policy unaffected;
restore retry403. Private accepted connection both transports200, owner200, unrelated403,
anonymous404; relationship lookup500 then restore200. Inactiveowner404/missing404 unchanged.
No current public screen caller: explicitly HTTP/SQL-only; records SQL seeded, not UI
creation. Housemate/private helper-policy expansion and installed native remain unverified.

Two first cookie attempts accidentally used bearer-mode login (deliberately clears
cookies); not an app regression. Preserved attempts are excluded from cookie acceptance.
Corrected run requests x-token-transport:cookie, checks actual nonempty issued cookie and
absence of tokens in JSON; both transports then pass. Diagnostic and final sessions
logged out. Existing optionalAuth/visibilityPolicy suites37/37, syntax/diffcheckpass.

Final exact temporary IDs and six logout200 receipts are in
professional-auth-candidate-results.json; both original UserProfessionalProfile[] and
Relationship[] restored, RelationshipSELECT restored. Earlier failedattempt rows also
removed finally. No other fixture changes. Original retained profiles/posts/memberships
unchanged; owned runtime retained. No external provider/native activity.

Private professional-auth-final-evidence.json binds4sourcehashes/comparison/baseline/
corrected20cases/checks/cleanup/limits. Durable **470files**, all hashes verified; MANIFEST
**c5c01720b601f776e3aad1f26388d963530992261cf6ef3ac08076a5c8e694bc** in existing
accounts-social-r3 mirror. Includes final114CI; older artifacts retain own revision and
runtime, latest head not blanket rerun. Coordinator owns integration after current batch.
Next: exact115CI/review handoff; preserve114. No helper expansion without reproduced
case/assignment. Continue original whole-stream inventory; broad native/provider/session
and reminder-delivery limits remain open. Local expiry-origin/CORS lead stays separate.

## Professional self-editor load recovery — PR114 handoff

Exact README sole-writer grant: existing web professional/page.tsx load/error/retry only.
Actual prior saved-profile SELECT500 produced enabled create form; seven current/archive/
open variants had identical page/helper bytes and released721d page hash also matches.
Reuse page plus existing ErrorState. Add load error/retry before normal modes and a load
request counter retired by cleanup/new request; confirmed absence still enters create.
Current QueryProvider remounts component-local state on session generation change. No
new application file, backend/schema/service/unit test/public-route edit or redesign.
Normal view/edit/create forms and navigation unchanged.

Actual authenticated Bob browser→SDK→HTTP→PostgREST/SQL: saved fixture headline displays;
actual SELECT denial500 shows ErrorState/Try Again without creation controls; repeated
keyboard retry stays error; restore SELECT and keyboard retry200 restores same headline.
Full saved row compared unchanged. Exact fixture removal then fresh reload200 confirms
absence and preserves original creation form. No create/update/verification submitted.
Creation state itself was SQL seeded, not UI creation acceptance. Browser tab16closed.

Scoped ESLint passes0errors/4existing warnings. Direct installed TypeScript compiler
passes exit0/no output, diffcheck passes. Initial npx selected the wrong tsc package,
failed, and is excluded as validation; corrected direct compiler is the accepted run.
The pre-existing ts-nocheck remains, so no full static coverage claim for this page.
No new unit tests or repeated broad suites. Request retirement/session isolation is
source-reviewed here; intact held-response account-switch/native/offline acceptance
remains unverified. Public-profile optional-auth defect remains separate HTTP-only.

A local expired-session attempt redirected from stream3-auth.localhost to localhost
/session/refresh and hit CORS. Ordinary real login on the configured isolated origin
recovered and returned to /app/professional. No auth/config change; record this runtime
boundary separately from the profile loader and do not claim expiry continuation success.

Cleanup: exact candidate e3cd7ca0-7858-4f80-8c14-d68d327b5baf removed; original
UserProfessionalProfile[] restored and SELECT restored. Original retained fixtures intact.
Private professional-self-final-evidence.json binds5sourcehashes, released baseline,
actualUI/SQL/HTTP log, row comparison, checks and limits. Durable **461 files** all hashes
verified in existing accounts-social-r3 mirror; MANIFEST
**2e1e18fb7dd7503dfcd12bd8c974bdbb8f9c9e9517d6cc47e5db393580f05d81**.
Each older artifact retains its own revision/runtime; latest head is not a blanket rerun.
Next: finish exact CI/review handoff; coordinator holds merges during paid full CI.
No new public route/auth/shared repair without assignment. Continue independent coverage
reconciliation against the original inventory; provider/native/session limits remain open.

## Legacy Relationship read failure — PR111 handoff

Coordinator granted only existing getRelationshipStatus after actual Bob Beacon UI
exposed Dana under Relationship SELECT denial despite a saved blocked relationship.
Seven current/master/paid/staging/place/Beacon/original fc99 variants have identical
helper bytes: query errors ignored and exceptions converted to none. Reuse the existing
helper with maybeSingle, checked error propagation, and no catch-to-none. Preserve
successful absence, self/missing-input and existing status/direction mappings. No new
file/service/schema/UI/policy/unit tests. Fast-forwarded this separate branch to merged
PR107/master4e69 before repair; frozen earlier refs untouched.

Actual real local GoTrue/browser/Next18131/API18130/PostgREST64531/SQL64532:
saved blocked row hides Beacon; actual SELECT denial yields existing unavailable/Retry
search with no search result; restored permission and keyboard Return retry keeps it
hidden; exact block deletion plus fresh reload restores the original Beacon. Tab14
closed afterward. Relationship creation itself was SQL-seeded, not UI acceptance.

Eleven affected HTTP reads (public/local identity search, users search and three profile
variants, four LocalProfile variants, relationship status) return error-only500 under
lookup denial. Follow POST500 leaves full UserFollow and Notification table snapshots
unchanged; healthy blocked follow403. Actual SQL status transitions plus HTTP verify
blocked in both directions, accepted→connected, pending_sent/pending_received, successful
absence→none and self→none. Restored public search200 returns original result. Non-Beacon
callers are HTTP-only. Existing58 tests across3 suites pass; syntax/diffcheck pass.

Caller review: users profile/search visibility and identity/local search use existing
helpers; follow check occurs before insert/notification; relationship GET has existing
500 catch. relationships.js helper imports unused. Professional helper call currently
has always-null viewerId and is a separate unmodified source lead. Chat/socket use
separate blockService and are untouched. No installed native, socket, hosted provider,
offline, intact session-race or whole N03/N04 acceptance from this milestone.

Exact temporary **14e37cd2-5d12-45e7-a043-fcc123c037e7** removed, original Relationship[]
restored and SELECT restored; auxiliary real auth session logged out200. Original other
safety tables, profiles, posts and memberships retained. No failed-follow insert/notice.
Private relationship-read-final-evidence.json binds source hashes, comparison, actual
baseline/UI, HTTP mappings/effects, checks and cleanup. Durable **448 files** hash-verified
in existing `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`;
MANIFEST SHA256 **cca38fc28830dcfad59513da6062a496b44576974d61d032033de70cb7b1926a**.
Each older artifact retains its own source/runtime limits; latest review head is not a
blanket rerun. Coordinator review and exact-head CI/integration remain pending.

Next: finish PR111 gate/handoff without duplicating CI; continue independent existing
inventory journeys. Professional optional-auth source lead requires actual reproduction
and a fresh route grant before repair. Broader notification/provider/native/session and
reminder delivery limits in the whole-stream table remain open. Stream2 owns homes.ts
and HomeSettingsTab save contract; leave untouched. Root completion upload runtime
18132/18133/64561–67 and f9200360 fixtures are separate and untouched.

## Post-PR111 runtime-only professional findings

Coordinator captured prior live03 SHA9a4e4ece in05fa6f0b9 and released status writer.
PR111 exact36fb automaticCI35574234363 independently confirmed SUCCESS; private
relationship-read-ci-final.json records exact head/jobs. No new source change.

Granted isolated runtime-only follow-up reproduced existing self-editor failure:
actual Bob web /app/professional displays SQL-seeded active profile headline;
UserProfessionalProfile SELECT denial yields backend500 but UI switches to enabled
Enable Professional Mode/create form, with no load error or retry. Restore SELECT
and reload returns the same saved headline. No create/update/verification clicked.
Proposed existing-page load-only error/retry repair awaits coordinator assignment;
no new application edits. Backend /profile/me already propagates query error; current
iOS/Android source handles500 as error. Old catalog missing-native-enable/disable
claims are stale against current source; no rebuilding or new native acceptance.

Separate HTTP-only /api/professional/:username baseline: real authenticated Bob with
saved blocked Relationship still receives Dana public profile200; accepted relationship
with private profile incorrectly gets404. Anonymous public200/private404 controls.
Existing viewerId always null bypasses canViewProfessionalProfile. Web and iOS public
endpoint definitions found, no current public-screen caller found. Do not invent a
screen or claim UI coverage. Future route repair requires separate scoped grant.

Cleanup: Dana profile3e7c651d-85bb-4ae5-a6e1-9bb0c994514a and relation
dbb2ea03-9ec6-404c-ba56-0c0ac193378d removed; Bob self profile
e3cd7ca0-7858-4f80-8c14-d68d327b5baf removed. Both tables restored to original[];
UserProfessionalProfile SELECT restored, auxiliary session logout200, tab15closed.
Original retained fixtures untouched. Private professional-auth-baseline.json and
professional-self-baseline.json distinguish HTTP/UI/SQL-seeded boundaries.
Durable mirror now **453 files**, hashes verified; MANIFEST
**01efc9daef3b4b90cb94109517d811a1c7899ae399f6359f7b19db77b0c53e5d**.
Previous448 manifest remains the coordinator-reviewed PR111 evidence snapshot;
new files add finalCI and next baseline findings, not changed implementation.

Previous local branch codex/workstream-accounts-social preserved atafe8d2f4c; its remote
primary branch remains21b93aa62. Do not push later milestones into that old ref.
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

## N03/N04 unavailable scoped block check — PR107 handoff

Coordinator separately approved temporary UserProfileBlock search_only verification,
then granted only existing visibilityPolicy.js isScopedBlocked after actual exposure.
Normal real BobUI search hidDana's publicBeacon; denyUserProfileBlockSELECT and a new
search exposed it despite savedblock. Existing followingrow remains visible by current
search_onlypolicy. Five current/master/paid/staging/Beacon helperhashes identical and
ignored queryerror. Reuse existinghelper; destructureerror andthrow it. No newtable/service/
UI/policy/test or merging of UserBlock/UserProfileBlock/PersonaBlock/Relationship scopes.

Actual candidate realGoTrue/browser/API/PostgREST/SQL: identical deniedblockread produces
existing searcherror/0resultlinks; restoredgrant+Enterretry confirms0matchingresults while
blockpersists. Exactblockremoval thenfreshreloadsearch restorespublicBeacon.
Ten affected REST callers (identitysearchpublic/local, userssearch/id/username/compatibility,
localprofile/detail/activity/gigs/listings) underdenial all500 with onlyerror/no targetdata.
Restorednormalblock:3searches200empty,3userprofiles403,4localroutes404. Selfprofile200 and
anonymouslocal200 retain existingpolicy. Non-Beacon caller evidence is HTTP-only.
Reverse search_only0, business_context search1, reversefull0, removal1 confirmedHTTP;
no otherblockscope rowschanged. No socketcaller tothishelper found.

Existing3suites/58tests pass (visibilityPolicy,identitySearch,identityFirewallPrivacy),
syntax/diffcheckpass. No newunit tests. LegacyRelationship lookup error remains a
separate unverifiedlead; broadvisibilityrefactor/native/offline/provider/sessionrace
notaccepted. Source/publicpresentation/policy otherwiseunchanged. N03/N04 remainopen.

Cleanup: temporary7a00181d-f20e-45b0-bb22-6ce114f28985 removed both baselineandcandidate,
originalUserProfileBlocktable[] restored, SELECTrestored, auxiliarysessionslogout,
actualnormalUIrestored/tab12closed. Originalprofiles/posts/memberships/blockfixtures
preserved; authaudit/sessioneffectsretained. Private search-block-final-evidence.json
binds4sourcehashes, fivevariantcomparison, actualbaseline/UI/10route/scopedcontrols,
checks/cleanup. Durable440files hashverified, MANIFEST
**ba7611c262e30585b6a8ebb8ed5c8b4958fc344dce5dea1c078c661181bf20e8**
in existing accounts-social-r3 mirror. ExactCI35572584966queued; coordinator ownsreview,
retarget afterPR105integration and merge. Prior103/105/101refs remainfrozen.

## N03 Beacon/profile search errors — PR105 handoff

Actual Bob directory searchstream3 returned original publicBeacon. PublicPersonaSELECT
failure then newstream3-localquery returnedHTTP200/empty and false No public Beacons
matched. Five current/master/paid/staging/Beacon searchTableFields helpers identical:
Promise.allSettled rejections/queryerrors ignored. Coordinator granted only existing
identitySearch.js helper; replace two continues with throws, reusing route500 and existing
UIerror/Retrysearch. No UI/design/schema/service/newfile/tests or ranking/privacy change.

Actual candidate web→realGoTrue→HTTP→PostgREST/SQL: deniedPublicPersonaSELECT now500,
explicit unavailable/Retrysearch; restoregrant+Enterretry gives originalpublicBeacon.
Genuineabsentquery200 remainsNoMatches. One field's synthetic403 with otherqueriesreal
causeserror; Enterretry200 recovers. Earlier one-shot503 ended200 and is excluded from
error-state proof (transient recovery, not persistent field failure acceptance).
Unchanged following-list actual PersonaMembershipSELECTdenial shows expliciterror;
restore+Enterretry returnsoriginalBeacon, so no followingrepair. Prior follow/unfollow/
privateidentity/link evidence reused within source limits, not repeatedwholesale.

Affected scopes realauthenticatedHTTP: public200/onepersona, local200/oneLocalProfile,
combined200/both, genuineempty200; LocalProfileSELECTdenial local500+combined500,
restoreretrylocal200, shortquery400. Localprofile scope is HTTP-only, not new UIacceptance.
Existing identitySearch10/10, syntax/diffcheckpass. No newunit tests. Native/hostedprovider,
broader access-change/stale-session and other helper privacy-read errors remainoutside
this bounded repair. No wholeN03/A05 closure.

Cleanup: no applicationfixture rowscreated/modified; PublicPersona/PersonaMembership/
LocalProfile SELECTrestored, singlefieldfaultconsumed, auxiliaryauthsessionlogout200,
tab11closed. Originalprofiles/posts/membership retained; authaudit/sessioneffectsretained.
Private beacon-directory-final-evidence.json binds4sourcehashes, comparison/baseline/
actualUI/HTTP/fault/checks/cleanup limits. Durable429files hashverified; MANIFEST
**2f963c5541e66437d00b8bd1c569492f77e790a9eb025dda820e84b1df952551**
in existing accounts-social-r3 mirror. ExactheadCI35571949622running; coordinator review
and integrationpending. Do not alter frozenPR103/101 refs or repeat acceptedjourneys.

## Scheduling channel preference retention — PR103 handoff

Granted getPrefs-only in existing schedulingNotifyPrefs.js. Actual A4 host Reminder
sent—Email on →PUT200 at06:57:44.741→SQL scheduling.host.reminder_sent.email=true,
but actual reload off. Existing helper returned only three canonical fields, dropping
stored scheduling choices. Five current/master/paid/staging/Beacon comparisons confirmed
same omission. One-line spread preserves own stored keys before existing canonical
normalization; no new file/UI/schema/worker/channel-delivery policy or unit tests.

Actual candidate browser on real BobGoTrue/Next18131/app18130/PostgREST64531/SQL64532:
reload existingtrue shows on; saveCancellationEmailoff preservesReminderEmailtrue.
Actual UPDATE denial500 leavesSQLtrue, existing UI rolls back and repeated failure
shows explicit Unable to save notification preferences error. Restoregrant, Enterretry
savesfalse; reloadshows reminderfalse/cancellationfalse. Direct authenticated GET matches;
separate real EvanGET200 has no Bob scheduling data. Canonical defaults remain. No new
intact-held-response crossaccount UI claim; unchanged queue/lifetime source evidence reused.
Existing scheduling26/26 and syntax/diffcheckpass; no newtests.

Cleanup: originalBob snapshot was empty (no preference row), not an existingrow.
Removed exact UIcreated61338118-5cb8-4c59-8819-30b3a1fb2e97; Bobrowcount0 restored,
UPDATEgrantrestored, auxiliaryHTTPsessionsloggedout, tab10closed. First cleanup parser
assumed a row and failed before anywrite; corrected absence restoration is final proof.
Original booking/page/otherfixtures unchanged; no worker/provider/mail executed here.

Private scheduling-channel-final-evidence.json binds4sourcehashes plus comparison,
baseline/savedSQL/HTTPcandidate/denial/retry/cleanup/checks. Durable419files hashverified,
manifest **7d966c8b3261da236ed1e8196fc6810ace890192e01f708eac5537f3b3cd295a**
in existing accounts-social-r3 mirror. CurrentPR103CI35571103116queued; review and
integration pending. Persistence/readback only: hostemail/attendee/dailyagenda/pause
actual delivery and policy remain open; no native/hosted acceptance or N05 closure.

## PR101 final CI/integration disposition

Independently verified exacta5b CI35570564542SUCCESS6jobs/5pathskips and remotePR101
MERGED as **944489d5449286d2b362cd96334bcd771636f0fc** at2026-09-21T06:59:55Z.
Passed detection/safeguards/backend/Docker/schema/aggregate; web/identity/native/Seeder
skipped. Coordinator reviewed and merged; author did not self-merge. Earlier pending
wording below is historical. No repeat of accepted race journeys; actual UI/localSMTP
and after-final-read/provider/rearming limits remain unchanged. Frozena5bref preserved.

## N05 cancellation/reschedule stale reminder — PR101 review handoff

Coordinator granted existing bookingReminders.js only after actual failure. Compare
current/master/paid worker (samehash) and older staging/Beacon variants: none rechecks
booking byID between scan and claim. Reuse existing worker/table/notifications;15-line
in-place check, no schema/service/newfile/unit test/design change. Fresh read errors,
missing/terminal booking or changed start/end/host skip claim; later scan handles current
schedule. This does not atomically exclude cancellation after the final read/provider start.

**Actual baseline:** isolated Bob GoTrue browser existing host BookingDetail→More→Cancel,
Changed plans→Cancel persistedcancelled06:49:56.099. Real worker confirmed scan completed
06:49:31.536 but its reply deliberately held until06:50:08. Reminder log0ad13372 and
notice5fd60919 saved after cancellation, local SMTP reminder e5inJdnVoHHZjKzriyyT2m
arrived06:50:08.274 after cancellationANhcidg9 at06:49:56.202. Actual Mailpit UI showedboth.
Only real scan delivery delayed; no mocked row/auth. Temporary free bookingSQL-cloned,
not creationUI acceptance; original retained booking untouched.

**Candidate actual UI/API/SQL:** reset only temporary booking; keyboard host cancel
commits06:52:29.358 while real scan held, release produces0reminder logs/notices/newmail.
Reschedule screen selects09:00PDT available slot→Reschedule now→toast/time updated,
SQLstart16:00Z at06:53:21.692; released oldscan produces0reminder logs/notices.
Then temporary timestamp controlled due; actual BookingSELECT revoked after real scan
before fresh read:0claims/notices, grant restoredfinally. Fresh retry produces1log/1notice/
1SMTPQe6ugzjRXgGUbmJwFmrWyZ; repeat unchanged. Original baseline mail remains separately
identified, never counted as candidate send. Host/notification-only settings unchanged.

**Checks/limits:** existing schedulingLogic26/26, syntax/diffcheckpass; no new tests.
Manual worker real clock/localSMTP64535+Mailpit64536, not natural cron or hostedprovider.
No native/paidbooking/intact account-switch/provider-race acceptance. Existing receipt
key booking/kind is not rearmed after a previously delivered reminder and later move;
that policy/acceptance remains separate. Prior offset/0/empty/30day and destination
proofs retain their unchanged-source limits. N05 and wholeStream remainopen.

**Cleanup:** exacttemporaryeb013de4-a517-49f2-972c-45f744ba4e78 and its notices deleted;
BookingAttendee/BookingReminderLog/BookingToken/Payment/Booking/Notification all0 forID.
Original booking9c7f570c fullrowunchanged, BookingSELECTrestored; hold/releaseflagsremoved.
Five newlocal test emails retained as private evidence; no externalrelay/provideractivation.
Phase browser tabs8/9 closed; ownedruntime/originalfixtures retained. Otherstreamsuntouched.

Private `booking-lifecycle-final-evidence.json` binds revision and6 source hashes,
comparison/baseline/candidate/reschedule/readfailure/retry/cleanup artifacts and actual
UI versus synthetic boundaries. Durable407files hashverified in existing
`.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`; manifest
**92837977efcc7751f53e83a20f2707b05bd5db46a7be0f69aea5b42004927bfb**.
Current exact-headCI35570564542pending; coordinator review/integration separate.
Keepa5bfrozen while continuing read-only reconciliation for next bounded grant.

## Persona feed mute — final bounded handoff, September21 06:15UTC

**Implementation:** six files in1d8357330: existing posts.js route, feedService,
SDK posts.ts, PostCard, useFeedData, plus granted enum-only forward migration13000.
Existing/archive/open-branch comparison found no persona feed-mute implementation;
existing PostMute table/uniqueness and endpoint are reused. Existing enum needs one
additive value; no new table/service/index/screen, applied history rewrite or unit test.
Apply enum migration before persona writes. Applied only on owned local SQL64532.

**Baseline:** actual Beacon menu sent user/public-persona UUID; successful local
removal returned after reload. Repair uses public persona type/id and matches only
persona identity_context_id. Private owner remains redacted, user/business/topic and
notification-only membership mute retain their contracts. Actual followup found own
persona mute offered despite safe viewer.isOwner; reuse that flag to suppress it and
preserve own cards in optimistic cache removal, matching existing server own-post policy.
Warm alternate feed filters also restored the post; persona success now cancels and
updates all existing feed queries on the captured session's QueryClient.

**Actual UI/API/persistence:** real isolated GoTrue accounts, Next18131, full app18130,
PostgREST64531/PostgreSQL64532. Existing menu and keyboard confirmation, denied INSERT500
with usable cards/error, restored retry200, SQL persona/public-ID row, reload removal,
HTTP unmute plus actual reload restoration. No existing web unmute UI found or invented.
Lost successful POST reply changed to synthetic503 after real commit: error/cards remain;
retry converges to same single row. Dana own menu excludes mute; server own-post bypass
also verified directly. Isolation covers other-owner persona and same-owner personal post.
One-active-persona-per-user constraint preserved; no two-active-same-owner proof.

Thirteen direct HTTP/SQL groups cover owner-only deletion, another actor cannot delete
Bob's row, DELETE500/retained row/retry, repeated/concurrent POST with one saved row,
unauth401/invalid400, authorized fullpost/private-owner redaction and legacy user scope.
This matrix predates final cache edits; separate following proofs cover those changes.

**Ordering:** actual warm Updates cache retains only other persona after mute.
Held Questions304 at05:56:33.785, mute200 at41.791, intact release53.787 and finish53.788;
selecting Questions still excludes target. This is cached304 retirement, not a new200
body or cross-account proof. Earlier12s attempt finished before mutation and is excluded.
Server real SQL-read race baseline restored target in fresh final feed. Candidate mute
05:59:55.708, newer55.794 excludes target, older pre-mutation read06:00:07.701 retains
its earlier snapshot, final fresh07.761 correctly excludes target. pendingEntry ownership
prevents old database reads republishing after invalidation/replacement. Only transport
completion delayed12s; real SQL rows/auth unchanged. No claim that old in-flight HTTP
snapshots are retroactively changed.

**Session review:** feed keys omit actor IDs, but existing QueryProvider creates a new
QueryClient and keyed child generation on token/session storage changes. Both old hook
closures retain the old client; its all-feed cancellation/write cannot address the new
client. Existing SDK additionally rejects changed-session replies. Reviewed exact source
hashes, no speculative provider/shared-auth change. Intact held-mute account switch,
complete offline/reconnect and installed native journeys remain unverified.

**Local validation:** final backend cache source passed existing2suites/24tests;
web typecheck0errors and scoped ESLint0errors after final frontend cache repair;
backend syntax/diffcheck passed. No new tests. Final-source actual Bob menu mute/reload
kept target absent; after cleanup a fresh actual browser shows original Beacon post.
CI35567483902 running; CI success and integration are not yet claimed.

**Cleanup:** authenticated Bob/Dana DELETE200; exact temporary posts e16b4607 and
d924073b removed, other-owner persona fd7d431a with its temporary tier/channel/member
removed. Original seven table IDsets restored (PublicPersona/PersonaTier/BroadcastChannel/
PersonaMembership/Post/PostMute/Notification); target membership full row unchanged.
Eight existing post-related table counts0. PostMute SELECT/INSERT/DELETE all restored;
three fault flags absent. Original six posts, persona/membership, actors, block/booking
fixtures retained. Additive enum remains installed locally; auth/security audit/session
effects retained. No hosted/provider mutation or peer-runtime changes.

**Evidence:** private `persona-feed-mute-final-evidence.json` binds all6 source hashes,
three reused session sources, source revision/config, actual UI/HTTP/SQL and synthetic
limits. Supporting source comparison, migration preservation, fixture, HTTP13groups,
owner/cache baselines, excluded ordering attempt, server race baseline/candidate,
transport logs, existing checks and exact cleanup are in durable
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/`.
387files hash-verified; MANIFEST SHA256
**7697323376753b3a05d6a2711daae5d07cdc956b90db48c40fb069b06cdb4bf1**.
Artifacts retain their actual source/config; manifest head is not blanket retesting.
Private source/runtime directory `/private/tmp/pantopus-stream3-20260920-r1` retained.

**Handoff:** coordinator review frozen1d835/PR99 and automatic exact-head CI, then
integrate if accepted. No self-merge or new feature scope. Owned backend18130/PID13145,
Next18131/PID14742 and Supabase64531–37 remain for continuation; no active fault or
new native reservation. Original prior browser tabs ended with the previous turn;
new tab7 is the cleaned real Bob feed. The pre-existing stale Post-not-found sidepanel
is unrelated to this milestone and unchanged. N03/N04/A05 and whole Stream3 remain open;
use the current coverage matrix below with this persona-mute evidence replacing its
older ungranted/reproduced-only entry. Native enum/UI compatibility is not accepted.

## Final map integration disposition — frozen for coordinator capture

Independently verified remote PR97 **MERGED**, merge commit
**027afc13a361330f16539ea98133eb793367eb24**, at 2026-09-21T05:36:32Z.
Coordinator reports exact updated-head9b1fa0d43 automaticCI35564770177 passed with
CLEAN mergeability/source review. Earlier exact4c6f full-nativeCI35562416370 also passed;
its durable receipt and actual UI/API/SQL evidence remain separately source-bound.
Remote PR96 is also **MERGED**, at 2026-09-21T05:36:34Z, automatically closed by
combined integration; its head remainsd10e. Both repairs are integrated, not a whole
N03/A05 or Stream3 closure. Duplicate canceledCI35562211102 remains superseded, not passed.

Only this live status changed. Application checkout/runtime are untouched; do not
push old local4c6f over coordinator-updated remote9b. Paidc426 already contains identical
three map files and has its own pending integration gate. Persona feed-mute migration
sequencing remains coordinator review only; no new application grant. Freeze this
status for capture before coordinator merges master into the neutral worktree.

## Final map full-CI receipt

Independently fetched GitHub run35562416370: **SUCCESS** on exact
4c6f117712428452f041e997d76e007e0dbfb62a, including all native jobs.
Private map-final-ci-receipt.json preserves job conclusions and source revision.
Durable364files manifest **791cbe2b4a26c3ca932ba8706a5d9dd45ddb4a2c13686f6358db078838028947**; prior artifacts remain unchanged.

This is automated build/test evidence, not new installed-screen or physical-device
acceptance. Existing actual browser/API/SQL and cleanup evidence retains its separate
scope. Coordinator reports updated PR97 head9b1fa0d43 adds only documentation beyond
4c6f; its own automatic merge gate remains pending. No manual duplicate dispatch,
application edit, local branch overwrite or runtime change was performed here.
Master integration is still separate from this completed source-bound native run.

## Latest coordinator CI and integration disposition

Coordinator reports automatic PR96 exactd10e CI35562256054 passed changed surfaces;
automatic PR97 exact4c6f CI35562565822 also passed. PR97 is now retargeted to master
at unchanged4c6f117712428452f041e997d76e007e0dbfb62a and described as the combined
three-file map failure/order plus popup-destination repair, preserving both commits
and their separate evidence. Neither this report nor green CI establishes merge.

Duplicate manual PR96 CI35562211102 was canceled as superseded/redundant, **not passed**.
The final-tree combined map manual CI35562416370 remains the full-native gate;
d10e→4c6f native/workflow bytes are unchanged. Delayed automatic runs can appear
several minutes after PR creation; do not dispatch duplicate CI after a short absence.
Source remains frozen, no new application grant. Existing runtimes/retained fixtures
preserved. This disposition is coordinator-reported; earlier pending entries below
are historical checkpoints. Final integration/current native completion remains open.

## Current whole-stream acceptance reconciliation

Read-only reconciliation at 2026-09-21T04:53:25.682348+00:00 on4c6f11771. Existing
[screen catalog](../screen-parity-inventory.md), [mobile wiring](../mobile-wiring-audit.md)
and [notification inventory](../notification-template-inventory.md) remain discovery
sources; REAL_VIEW/rendered controls and May audit wording do not establish current
end-to-end success. No additional application edits during coordinator integration.

| Existing row | Current bounded evidence to reuse | Required acceptance still open |
| --- | --- | --- |
| N01 | Actual web saved-notification list/bell reads, mutations, keyboard removal, post/booking/listing destinations and preferences (PR75/81/85/86/91); exact UI/API/SQL evidence above. | Provider-delivered foreground/background/cold-start, denied permission, token lifecycle, login continuation and all destinations under current authority. Saved records alone do not establish push delivery. |
| N02 | Historical Android emulator FCM and owner-confirmed physical iPhone Beacon preferences retain their original source/device limits. | Physical Android unavailable; current installed iOS/Android interaction capability unavailable. CI simulator/emulator tests are not installed-screen or physical-device evidence. |
| N03 | Real local follow/unfollow/retry; fan identity/privacy, restricted oldlinks, posting/draft recovery, comments/replies, hide/filter failures and web maps under current milestones. | Persona feed mute is repaired and locally verified in PR99 above, awaiting CI/review/integration; release-cohort eligibility, broader access transitions, native discovery/posting/reply and remaining map layers unverified. Notification-only membership mute remains distinct. |
| N04 | Existing safety/report entry repairs, realGoTrue session retirement, persisted block/messaging denials and unavailable checks; distinct UserBlock/UserProfileBlock/PersonaBlock/Relationship scopes retained. | Remaining installed entry points, moderation processing, broad socket/provider side effects, full offline/reconnect/concurrent/lost-reply/session matrix across all scopes. Existing bounded evidence does not close whole row. |
| N05 | Actual booking UI/API/SQL, manual existing worker/local SMTP delivery, saved notices and owner/invitee destination boundaries, canonical timing/host choices. | Natural cron/timing, lost SMTP acknowledgement, partial delivery/concurrent cancellation or reschedule, individual invitee destination, remaining host-email/attendee/dailyagenda/pause contracts and native/provider delivery. Home calendar belongs to Stream2. |
| A01 | LocalGoTrue real login and recovery-email delivery/return-form evidence; isolated accounts provisioned for testing, no new public-signup acceptance claimed. Disabled Google/provider boundary recorded. | Complete signup/email verification remains open. Password-reset final credential change needs user takeover; Apple/Google success/cancel cannot run while providers disabled. No provider activation or native claim. |
| A02 | RealGoTrue account changes/cookie refresh, protected-data retirement, security records/global sign-out and two account deletions with exact block cleanup. | Broader native/other-browser expiry/revocation, unavailable storage/frozen-tab and provider-session combinations. Historical controlled proofs retain precise transport limits. |
| A03 | Existing shared upload/document evidence and implemented file picker remain reusable under their original versions. | Hosted Storage permissions/quotas/media lifecycle and native chooser capabilities unavailable/unassigned; no shared storage edits. |
| A04 | Existing provider report plus local OAuth capability check. | Activated Smarty/geographic/provider acceptance and paid activation bundle unavailable; address ownership remains coordinated with Stream2. |
| A05 | Recent actual Marketplace reporting, seller identity, Q&A, notification return, message/card destinations; map popup post destination now PR97. Existing catalog reused. | Remaining search/subscription/booking/identity and adjacent reachable actions; Home/mail/payment findings routed to owners. No claim that every catalog action works. |

Private exact-byte reconciliation has24 artifact/file bindings:16 unchanged,8 different.
Three marketplace-message baseline bindings intentionally predate repairedPR93; baseline
is not candidate acceptance. Marketplace blockService/chats/modal match accepted hashes;
useListingDetail delta changes only success destination, leaving denied/error paths intact.
Other changed files keep scoped earlier/later milestone evidence, not blanket retests.
Private current-evidence-source-bindings/current-coverage-reconciliation record details;
durable363files manifest **b0b1b7984397c8622e1da9d82a959b727f7294a6276365a406910de0996b197d**. No new runtime acceptance is implied.

## Current N03/A05 map popup destination milestone

[Draft PR97](https://github.com/WangPantopus/skinny-pantopus/pull/97), exact
**4c6f117712428452f041e997d76e007e0dbfb62a**, stacked on frozenPR96d10e.
Only existing DiscoverMap PostPinPopup href changes /app/posts/:id to canonical
/app/feed/post/:id. Six existing/master/paid/staging/Beacon/archive variants used
obsolete route. Reused existing full-post screen, SDK getPost/getComments, existing
posts GET/:id visibility checks/serialization; no new route/files/SDK/schema/tests.

Baseline actual popup opens Next404. Candidate actual Evan popup Enter opens saved
post title/content and canonical AuthBob profile. Browser focus command timed out
after navigation, but subsequentAX/DOM confirms destination; GETpost/comments200 at
04:48:02 and SQL1PostView. This is actual localGoTrue/HTTP/PostgREST/SQL, no auth or
persistence mocks. Fixture SQL-seeded publiclocal post at synthetic PDX defaultcenter;
post creation not retested. Stale popup mouseclick after exactSQLdeletion opens same
canonicalroute with bothGET404 at04:48:53 and existing Post not found, no stalecontent.

Exact fixtureec1f7bea-6314-4364-abd1-a1d066cb40fa and ten related counts0; original6
PostIDs preserved. No grant/fault changes in this milestone. Types0/ESLint0/diff0,
no newtests. CI dispatched because no automaticPR checks appeared; integration and
retargeting coordinator-owned. Native/provider and broader fullpost lifetime/error
acceptance remain open; no policy change or N/A rowclosure. Runtime retained on same
owned ports; browserEvan at missingpost. No additional feature scope before integration.

Private map-post-destination comparison/fixture/candidate/cleanup/types/lint/pr and
HTTP log; durable361files manifest **89693bdcf8a48bda6e394813b6a4ccc5d7f7e0c49c651dd646faa43e6b629db9**.
PR96 exactd10e manualCI35562211102 currently inprogress (backend/privacy/identityE2E
passed; other jobs pending). Do not treat source/localUI/CI/integration as interchangeable.

## Current N03/A05 map failure and response ordering milestone

[Draft PR96](https://github.com/WangPantopus/skinny-pantopus/pull/96), app7cebdd5d8,
review **d10e39b5e05d6ce85d27b40e010b3902b29300ba** after docs-only master merge.
Prior PR95 exact378c9ee passedCI35561104880 and coordinator merged4e58b0bc;
its four accepted source hashes/evidence are reused, not a blanket rerun.

Granted existing posts.js posts-only map catch, FeedMap and DiscoverMap posts feedback.
Baseline FeedMap Search this area under PostSELECT denial returned200/0 in view;
DiscoverMap actual ShowPosts returned500/blank without feedback. Intact old Askempty200
also replaced newer Updates1. Six-reference current/archive/open comparison confirms
reuse in place. Posts-only errors now reach existing500, both callers expose retry,
FeedMap retains known pins and retires old callbacks by request generation/token/unmount.
DiscoverMap uses existing abort flag, including turning posts off. No new files/tests/
SDK/schema/policy change; mixed-layer legacy partial success deliberately remains open.

Actual IAB Evan→local GoTrue/Next18131→full app18130→PostgREST/SQL64532: FeedMap warm
and cold500, repeated error and keyboard retry200; known1 pin retained and cold state
Unavailable. Intact old Ask200 release04:35:21.339 leaves newer Updates1. DiscoverMap
cold50004:42:59/repeated50004:43:02 show error/retry, restored Enter20004:43:13 restores
marker. Turning posts off during8s hold leaves layer off/no pins/error after intact
cached304 finish04:43:45.648. This is disabled-layer proof, not reverse-order200 proof
for DiscoverMap. No mocked authentication/persistence; SQL-seeded public post at synthetic
NYC then PDX default-map coordinates; SELECT fault and response delay are controlled.

Exact post45a9939c-5852-45e9-9d37-ddae11ca4f07 removed; Post/File/Comment/Hide/Like/
NotHelpful/Report/Save/Share/View counts0. Original six Post IDs preserved; SELECT
restoredtrue, responseflag consumed. Original fixtures/authaudit retained. Owned backend
session44858/Next60362 remain active; Evan browser at deleted popup404. Types0/lint0,
backend syntax/diff0; no newtests. Required CI pending; integration coordinator-owned.
Native/provider, broader map session transitions, DiscoverMap warm-failure/reordering
and mixed partial reporting remain unverified. No N/A row closure.

Private pulse-map-candidate/source-comparison/baseline/boundaries/fixture/types/lint/pr,
map-response-faults and real-auth-http artifacts; durable 354 files manifest
**52f815c85d345303a845dc112788b6702eca882dd35b8262affbab3bb7b82656**. Artifact-specific source/config remains authoritative.

Next separate assigned repair: actual DiscoverMap popup View Post used /app/posts/:id
and Next404. Confirm existing full-post route/API, compare references, then href only
and actual authorized/missing navigation. No new routes/identity/schema/persona scope.
Persona feed-mute extension still proposal-only; never repurpose notification mute.

## Current N03/A05 filter read and unmute failure milestone

[Draft PR95](https://github.com/WangPantopus/skinny-pantopus/pull/95), appff1917e15,
review **436a93c190b02cc740836759f37f75e807b472e0** includes masterb463ee385 after
PR94 exact1fb passedCI35560095912/coordinator merge. Granted existing posts.js DELETE
mute, feedService.getMuteAndHideFilters, useFeedData.ts and feed/page.tsx only. All
five filter reads checked before cache write; existing error responses/retry/ErrorState
reused. Known current-owner rows retained, falseempty/caughtup suppressed onerror,
automatic pagination pauses onerror. No policies/schema/newfiles/tests/design change.

Baseline real HTTPunmute DELETE denial returned200 but leftsame savedrow. ActualBob
feed under persistedhide+PostHideSELECT denial/coldservercache returned200 and exposed
hiddenpost. Independent PostSELECT denial GET500 x3 rendered Nothing here yet/noRetry.
Candidate realGoTrue/fullHTTP/PostgREST/SQL: each PostHide/PostMute/Relationship/
PersonaBlock/UserFeedPreference SELECTdenial gives list500/sports500; each restored
sameactor read200 respects savedhide. Unmute DELETEdenial500 retains1, restoredretry200
removesrow. Map service fails closed, but existing map-layer catch returns200empty;
APIlead only, separate scope/actualmapUI stillpending.

Actual browser cold500 shows ErrorState/TryAgain; failedretry remains error. Restored
SQL keyboardretry200 shows genuineempty with persistedhide. Exacthide cleanup and
ownedcache restart restore originalpost. Warm surface-switch/revisit500 retainsknown
post pluserror, restoredEnterretry200 clearserror/keepspost. Extra private injected503
then held realBob feed200 started04:24:40.078 (recorded postID2824...), logout200
04:24:48.792, Evanlogin20004:24:55.620. Oldrelease04:25:00.080 was destroyed/socketDestroyed
true, so **disconnected-response evidence only**, not intactcrossaccount delivery.
Evanfreshfeed20004:25:01.669 genuineempty/noBobrows. Existing QueryProvider generation
remount/cacheclear and API session guards unchanged; source-bound prior evidence reused.

Exact candidatehide1e1de420 and temporarymute removed; PostHide0/PostMute0. All six
SELECT privileges and PostMuteDELETE restored, extraresponseflag consumed, existing
post/membership/block retained. Authaudit/sessioneffects retained; Evanbrowseractive.
Owned backend current session31915; frontend unchanged. Matrix+UI persistence real;
only extra503/20s responsehold synthetic, not auth/database. Types0, lint0errors/3existing
warnings, syntax/diff0; existing feedService/postMute2suites24pass, no newtests.
RequiredCIpending/coordinatorintegrationseparate. PaginationfailureUI/intactdelayed
ordering/native/provider/mapUI/personaextension remainopen; noN/Arowclosure.

Private pulse-filter-matrix/candidate/read-baseline/types/lint/existingregression files,
pulse-mute-delete-baseline and feed-response-faults plus browserhistory. Durable344files
manifest **b77d30b23aa316790918ec06c219c336a8d26f1e280bde545373689b71e96598**.
Next afterfreeze: inspect actual existing map failure journey. Persona extension remains
read-only proposal: existing PostMute enum lacks persona; additive enum/SDK/API/filter/
caller extension could preserve public identity and legacy scopes, but not assigned.
No reuse of notifications-only membership mute or private author restoration.

## Current N03/A05 Pulse hide persistence milestone

[Draft PR94](https://github.com/WangPantopus/skinny-pantopus/pull/94), app39513752b,
review **1fb5a58adc576cddd4219e4921a3c1ad5c22b01c** includes reviewed mastere8ece6ebc
(PR93 exact e036 passed CI35559652324 and coordinator merged). Sole granted handler
backend/routes/posts.js /hide/:id checks existing post lookup and upsert errors;
maybeSingle preserves confirmed absent404, catch500 reused. No caller/policy/design/
schema/newfile/test change. Compared six existing/archive/open sources; all ignored
hide persistence error. Existing client already displays failure and retains card.

Baseline actual Bob Beacon feed Hide Post under PostHide INSERT denial returned200
at04:07:29.364, toast Post hidden and card removed, SQL0; reload restored post.
Candidate actual same failure500 at04:10:12.705 keeps card/Failed to hide post. Restore
and same-menu retry200 saves exact rowfbfa8bec; fullreload remains empty. Two concurrent
real authenticated HTTP retries200/200 preserve one row; absentpost404, unauth401,
Post SELECT denial500. AuxiliaryHTTPsession logout200. Browser uses existing local
GoTrue/HTTP18130/PostgREST/SQL64532, not synthetic authentication or mocked persistence.

Exact temporary PostHide fbfa8bec-87a2-4315-a51e-9cf7bc295339 removed; PostHide0/PostMute0,
original followerpost retained; INSERT/SELECT restored. Authaudit/session effects
retained. Direct cleanup may leave existing filtercache until TTL/restart; no recovery
claim beyond recorded UI. Backend owned restart session2461, Next unchanged. Syntax/
diffcheck pass; requiredCIpending, native/provider/delayedsession unverified, no rowclosure.

Private pulse-hide-baseline/sourcecomparison/candidate/boundaries files; durable332files
manifest **f5c94e6cc7b6a76c3a335d162bcc526cb3d9de922cb6df899b77d6acdb1dbe5f**.
Next distinct reproduced lead: PostCard MuteUser on Beacon sends canonical personaID
as user, persisted PostMute0b80d9dd, toast/cardremoval then reload restores post.
Exacttemporaryrow cleaned0. Existing persona muteFollowing is notifications-only;
reusing it for hide-from-feed would change policy. Preserve safe public identities,
no private author restoration or new table. Further contract comparison/assignment
needed before repair. Filter/unmute error handling remains sourcelead, unverified.

## Current A05 messaging destination milestone

[Draft PR93](https://github.com/WangPantopus/skinny-pantopus/pull/93), exact
**e036af696090b47d037cd0fad810c6fc31694a89**, base master9f14a638a after documentation
PR87 publication and explicit three-file coordinator grant. PR91 merged ef7382ea1
following exact CI35558601157. No application differences from ea8e to new base;
accepted evidence reused. Exactly existing useListingDetail send-success destination,
PublicProfileClient.handleMessage destination and ChatRichCard listing href changed.
Prior archive/open/master comparisons retained; no new files/tests/routes/design/policy.

Actual Dana baseline direct201/message201 persisted but navigated ignored roomquery
and inbox. Existing inbox row correctly opened conversation/Bob. Its ViewListing
link hit Next404. Hydrated public Bob Message repeated ignoredroomquery. Candidate
uses captured seller/recipient ID for existing conversation route and existing
marketplace detail href. Errors and other card types remain unchanged.

Actual candidate UI on Next18131/full app18130/local GoTrue/PostgREST/SQL64532:
scoped ChatMessage INSERT denial gave direct201/message500, zero messages, retained
draft/form and no navigation. Restoring INSERT then same-form retry gave message201,
exactly one persisted listing_offer and correct conversation/Bob with exact draft.
ViewListing opened authorized detail200. Seller publicprofile Message activated via
Enter returned correct conversation and saved message. After exact listing deletion,
keyboard ViewListing gave HTTP404/Listing not found with no stale detail. Source-bound
prior blocked Marketplace403/database503 and SDK/session checks reused; no new delayed
session/duplicate-tap/native/provider acceptance. UserIdentityLink remains source-only,
outside grant. Other card types unchanged by exactdiff, not broadly rerun.

Exact fixture listing4157ed45-9453-4432-b540-9c0184a030fe and roomc022a97f-4174-4b42-
9d4c-14d760e3fe79 retired. Listing/views/interactions/questions/room/messages/participants0;
original ChatRoom/ChatMessage/ChatParticipant/Notification ID sets unchanged. Original
DanaEvan block retained; INSERT restored; authaudit/session effects retained. Browser
Dana remains on deleted fixture's notfound page; owned runtimes unchanged.

Typecheck0errors, scopedESLint0errors/5existingwarnings; no newtests. Required CI pending,
coordinator review/integration separate. Evidence marketplace-message-baseline/source-
comparison/candidate-fixture/candidate/types/lint/pr files and actual HTTPlog; browser
action history in this task. Durable325files manifest
**4e1e6529b4315dcad5f2d22086e5081fa86371842a5429733cc6842bcbe8b266**.
Private artifact-specific sources/config remain authoritative, not blanket retests.

Independent N03 read-only reconciliation: actual own publicprofile Activity shows Dana's
two retained Connections posts and follower post, backed by GET200 and exact three SQL
Post rows. Connections source loads connected authors excluding self; existing parity
doc describes that scope, so no policychange inferred. Native My Posts remains untested.
No fixture changes. Next continue remaining N/A acceptance; this milestone closes no row.

## Current A05/N04 milestone — listing reporting

[Draft PR88](https://github.com/WangPantopus/skinny-pantopus/pull/88), application6ee007f7e,
review/pushed956dab1d1 includes current docs masterbc06d6b39; exactly two existing
files (useListingDetail.ts handleReport and shared ReportModal.tsx listing choice data).
Coordinator granted scope after actual failures; no new files/tests/schema/policy/design.
PR86 exactc5802b4a1 passed applicable CI35556598901 and coordinator merged3277477fc;
its prior bounded UI evidence is reused, not rerun or confused with native acceptance.

Baseline actual Bob UI created free remote fixture54f29656-3872-44a9-be3c-3cfcc5ef6953
on owned18131→18130/localGoTrue/PostgREST/SQL64532. Evan signed in through real UI.
Safety concern was offered but POST400; modal closed. Other/details under scoped
ListingReport INSERT denial returned500 and also lost draft. Hook source identical
SHA74196b1a7e69f8a871bcfc20f5b2ebcffe84a2c9e1866a021fac9d7bbb0226b4 across master,
paid, web staging and Beacon. Shared modal matches initial archive and already retains
rejected submissions; reuse suffices. All modal callers audited; other entities retain
original six choices. Existing API/SQL seven listing reasons reused without policy edits.

Candidate actual UI500 keeps Other/details and re-enables submission; sameform retry200
persists exact draft. Each offered spam/harassment/inappropriate/scam/prohibited/
counterfeit/other produces200 and one corresponding record. HTTP invalid/safety/
misinformation/oversized400 and unauthenticated401 leave exactly7reports. Profile
report modal still displays original six options; cancelled without submission.
Typecheck gate0errors; scoped ESLint0errors/2pre-existing warnings. Required current
CI pending at handoff; no new unit tests. Lost-success deduplication, moderation
processing, native/provider acceptance remain unverified. A failed request does not
prove no write; no report idempotency policy is invented here.

Exact fixture listing deleted through scopedSQL after evidence capture: Listing,
ListingReport, ListingView, ListingInteraction, ListingQuestion, ListingSave,
ListingMessage and ListingOffer counts0. Seven reports retired via existingFKcascade.
INSERT privilege restored, auxiliary HTTP session logout200; browser Evan remains
active and earlier fixtures/auth audit history retained. No broad cleanup claim.
Evidence marketplace-report-baseline.json/candidate.json/boundaries.json, source
comparison and private listing snapshot, lint/types logs. Durable private289files at
owner .pantopus-recovery/audits/20260920-stream3-accounts-social-r3; MANIFEST SHA
78b7d94c591173675bb63563585ce891dd852c2b6fdc6f74d190ba765b99aa63. Each artifact source
is authoritative, manifest head is not blanket retest evidence.

Next independent A05 finding: actual listing Seller is User/disabled ViewProfile
while real detail API returns canonical safe local identity displayName/handle/href.
SellerSection still reads removed legacy name/username/profile_picture_url. Existing
public href opens Auth Bob correctly. No repair yet; request bounded component
assignment and preserve typed safe contract (do not restore private legacy fields).

## A05 seller identity follow-up

[Draft PR89](https://github.com/WangPantopus/skinny-pantopus/pull/89), e3627adeb,
stacked on PR88; exact two existing files SellerSection.tsx and optionalhref only
in types/listing.ts. Coordinator granted both after actual detail User/disabled
ViewProfile versus correct canonical API identity. Both files unchanged across
master/paid/staging/Beacon/initialarchive. No backend privacy restoration or design
change; canonical fields/href reused, legacy fields left for other consumers.

Actual Evan UI detail→ViewProfile Enter→Auth Bob public page and sellername click
both pass. Separate SQLseeded free fixture9f6a46b8-7127-4e1b-a7d1-27e552a1020a
avoids repeating accepted creation. Controlled persisted empty ownerusername/local
handle made real API hrefnull; UI retained safe displayname and disabled navigation.
Both original handles restored exactly; reload recovered links. This is unavailable
publicdestination evidence, not proof of production redaction or completenullcreator.
Native/avatar-download/businessdestination unverified. Types0errors/scopedlint0;
no newtests. Current requiredCI/integration pending at handoff.

Exact sellerfixture deleted; Listing/View/Interaction/Report counts0, originalprofile
handles restored. Authaudits retained, Evanbrowseractive. marketplace-seller-candidate,
missing-href, identity-before/sourcecomparison and lint/types artifacts private.
Durablemanifest 73943dfb9040775b5651bbadd9c0e3cfeb2a4a3af691c0b8fb16b54b0185db23 (296files), source-bound as usual.
Next: existing marketplace Q&A/save/read journeys and existing broader N/A limits;
no stream closure.

## Current A05 Q&A read milestone

[Draft PR90](https://github.com/WangPantopus/skinny-pantopus/pull/90), app0ce235cfc,
reviewfdb37a904 includes currentmastera12610270. PR88 mergedcc28ddd3e after exactCI
35557360294; PR89 strict216e533af passed CI35557699093 and merged by coordinator
asa12610270. Source unchanged by branch updates; no blanket journey rerun.

Actual Evan question201 persistedae15b954 on SQLseeded listingaa065fb0-ed74-4846-
802b-2e0a2dff169a, but UIAnonymous/no link despite safe canonical asker fields. Real
ListingQuestion SELECT denial GET500 rendered Questions0/Noquestionsyet. Existing
QASection and caller identical across six archive/open/master variants. Granted
three-file in-place loader/error/Retry/canonical askernames+href repair; no mutation,
backend/schema/newfile/type/design change or newtests. Loader keeps knownrows and
checks listing/request/token/session marker; existing QueryProvider remount retained.

Actual cold/repeated500 explicitRetry/no falseempty, restoredSELECT sameRetry200
recovers question. Bob actual answer200 persisted and created exactlyone asker notice;
post-save read200 injected503 retained knownquestion/error; Retry200 recovered answer
without resubmission. Subsequent warmupvote/read503 and delayedRetry200 followed by
newerunvote/read200 left0. Older read held03:35:06.001, newerUI06.601, olderrelease
16.001/finish16.002 destroyedfalse/socketfalse/writableFinishedtrue; finalUI29.986
still0. Faultlog records questioncount, not full oldpayload; priorvote value follows
successful toggle sequence. Askerlink actually opens Auth Evan profile. Owner UI
Delete200 then GET200 yields genuineempty. Existing Save/reload/Unsave worksunchanged.

Generated seller question notice opened correct public/listing preview through bell.
OpenListing's native handoff was blocked by browsersecuritypolicy and not retried or
bypassed; native continuation unverified. Saved notification/webbell is not provider
push evidence. Intact crossaccount Q&A reply notnewlyexercised; existing account
remount/interceptor evidence reused, newhook guards source-bound only for thatcase.

Exact aa065 listing/question/save/view/interaction/upvote0; both generatednotices
4930ee07-eba1-49d6-8849-dfc9df8c45e2 and5b9d909c-22e2-4e45-b186-b4eba819e94c deleted.
OriginalnotificationIDs/readflags unchanged. SELECTrestored, faultflagconsumed;
Bobbrowseractive/authaudits retained. Backendrestartedowned session36821 appending
same log, Next18131unchanged; no otherstreamresources touched. Types0errors,
lint0errors/3pre-existing warnings; currentCIpending, integrationseparate.

Private marketplace-qa-baseline/candidate/sourcecomparison, workflow-before,
listing-questions-response-faults and lint/types logs; durable304files manifest
bd043a4acc666aac39a8343eae3f67461c68bfc5027a0d780b9155652f88b9fb. No broad N/A closure. Next read-onlynotification destination trace:
web resolver maps posts/Home but passes /listings through to publicpreview with no
Q&A; canonical authenticated listing screen is separate. Request assignment before
any sharednotification repair. Broader A05/native/provider/authorization stillopen.

## Current N01/A05 listing notification destination milestone

[Draft PR91](https://github.com/WangPantopus/skinny-pantopus/pull/91), appe23406bde,
reviewea8e8603c includes currentmasterfd04ae43c (PR90 exactfdb passedCI35558194245
and coordinator merged). Existing notificationRoutes.ts alone maps valid-ID
listing/listings/marketplace links to /app/marketplace while preserving suffixes,
URLvalidation and other mappings. Current/master/Home/paid had identical0deebaae;
archive/oldnotification branches also lacklistingmapping. No native/publicshare/
backend/provider/schema/newfiles/tests or permissions changes.

Earlier actual listing question notice reached publicpreview without Q&A; native
handoff was blocked/not retried. First uncommitted candidate had an accidental
UUIDregex suffix omission and still routed public; corrected to byte-identical
original regex before accepted checks/commit. Final actual fullnotification click
opens ownerAnswer, actual UIanswer200 persists; asker answer notice opens sameweb
listing without sellercontrols. Bell /marketplace alias preservesquery, fullpage
/listing alias preservesquery+fragment. 2aliasnotices SQLseeded; questionnotice from
existing authenticated HTTPquestion handler, accepted unchanged creationUI reused.
After exactlisting deletion, retainednoticenavigation→HTTP404/Listingnotfound/no
stalequestion. Explicitlogin?redirectTo returns Evan to correctauthorizedlisting.
Directloggedout listing route still follows existingmiddleware publicalias and
localredirecthostlocalhost; this is not fullguestcontinuation/native acceptance.

Exact d53498d0-9411-4a0b-b5ba-d4176f88cb34 listing/question/view/save/interaction0
and all4relatednotices0. OriginalnotificationIDs/readflags unchanged; auxiliary
HTTPsessionlogout200; Evanbrowseractive/authaudit retained. Types/lint0errors;
29existing routing/HomeTask cases pass2suites. CurrentCIpending/reviewseparate;
no provider/native/business/allaccess-change coverage claim.

Private marketplace-notification fixtures/persisted/candidate/sourcecomparison,
existing-regression/types/lint logs. Durable313files manifest
19dfb8b2c669141ee28c28974c3c1381344d290bae5e91cd4a8b4a5af1051fdc. Next independent N04/A05 existingMarketplace
MessageSeller blocked-entry verification, reusing accepted backendblock policy;
no new repair assignment or sharedfilechange. Other whole-stream limits remain.

## N04/A05 no-code Marketplace messaging extension and next findings

On ea8e8603c, actual Marketplace MessageSeller→existing createDirectChat denies
Evan→Dana403 and Dana→Evan403 under the retained DanaUserBlock. Both actualforms
retain unsentdraft/error. Revoked isolatedUserBlockSELECT and restarted onlyowned
API to ensure coldcache: sameform503. SELECTrestored, retry403; no sendMessage call.
ChatRoom/Participant/Message/Notification totals unchanged. Exact two disposable
listings d2a6286c-2687-4a56-a748-43c0b4fb08f1 and8af13f77-5bd9-457e-a17b-d590f5145938,
views/interactions/messages/offers cleaned0; originalblock unchanged. No source
change/newtests. This extends entry-point evidence, not independent socket/native
or unblock/concurrency acceptance. Backend now session94409 on18130, same private
launcher/log append; Next18131 unchanged. Dana browseractive/authauditsretained.

Independent successful-message baseline found next concrete defects, not repaired
while coordinator closes current integrationbatch. SQLseeded Boblisting6a18d868-
0aa9-410f-9c6c-e39ca84a597b; actual DanaUI direct201/message201 saved exactlyone
listing_offer in newroom eed0f38e-1a06-4d68-8039-a4c14c5b87e8. Existing caller sends
/app/chat?room=... but ChatList ignoresquery and opens inbox. Inboxrow opens existing
/app/chat/conversation/Bob correctly and shows persistedmessage. Its existing
ChatRichCard ViewListing uses /app/listings/id and actualNext404. Hydrated public
Bobprofile Message repeats sameignoredroomquery/inbox. UserIdentityLink has a third
samequery caller; sourcelead only, popoverUI not verified. No file edits/grant yet.

Exact positivefixture listing/newroom/message/participants cleaned0 via canonical
FKcascade; no newNotification rows in thisphase. Initial cleanup read used wrong
message_typecolumn, failed beforemutation; corrected canonical type query/cleanup
succeeded. OriginalroomIDs preserved, DanaEvan block retained. Evidence private
marketplace-block-before/results and marketplace-message-before/baseline/persisted.
Durable318files manifest 79012cecb848844bb52acbc910f6f578494dabbbcd0815b77e0fcc13bf753073. CurrentPR91 exactea8
passedCI35558601157; coordinator merging bounded route scope, author doesnotmerge.

Next after documentationbatch: obtain assignment for reproduced existing
useListingDetail send-success destination, PublicProfileClient.handleMessage and
ChatRichCard listinghref. Compare allopen/archive variants; reuse canonical existing
conversation and marketplace screens, preservestyles/policies; no replacementroutes
or tests. Continue other whole-stream limits; this is not Stream3 completion.

## Coordinator integration progress (read-only reconciliation)

PR70 merged358daaa; PR72 currentf2ea16704 merged703e7050867d4747db958dfda8a20bf2224d1991;
PR73 current806d64635 mergedae85bad599f87933ac00e3f76ca23ac5cb6daa53; PR75 current5edcaad6c
mergedcc560bce6c61d915d8a3c503a55b8c167270a43e; PR77 currentcc252a474 mergedb49dd59224d38c060d726a11bc45148f36404fcf.
Coordinator checked each strict update changed only docs/accepted clock fixture before
required CI. Accepted application bytes/evidence unchanged. Coordinator merged
PR80 ase92aeab69044ea3eeccbd6e2c4ebe096e26cb0cb and PR81 as6f4703065055f42a9def558e0e72c1e09024a03a.
PR82 strict914e68764 passed CI35553548674 and merged **01e842aef4b8877773712a17f1c5a545fc7f5081**
at02:20:58Z. All reviewed stack70/72/73/75/77/80/81/82 integrated. Author did not merge
or mutate coordinator-owned refs. Historical sections retain original source/limits.

## N04 post report retry — PR83, current milestone

[Draft PR83](https://github.com/WangPantopus/skinny-pantopus/pull/83), branch
codex/stream3-post-report-retry, headbf595fa80, base master01e842aef. Exactly two existing
handlers: useFeedData.handleReport and full feed/post/[id]/page.tsx handleReport now
rethrow after the existing error toast. Existing ReportModal already retains reason
and details on rejection; all feed-handler callers await it through this modal.
No shared modal/backend/schema/layout/new test change. Existing master, paid/Beacon
branch variants and modal were compared; no replacement was needed.

Baselineafe8: actual Bob full post Report and Nearby→Pulse→Beacons→card menu Report
both received500 under isolated PostReport INSERT denial, showed error then closed
modal and lost details. Candidate both actual browser entry points retain Other
and exact details on500; restoring INSERT and submitting the same form returns200,
closes with success, and persists exactly one report per UI journey. Real local
GoTrue cookies/HTTP/Express/PostgREST/PostgreSQL, no mocked identity/persistence.
Additional separate authenticated HTTP: visibleGET200, invalid reason400,1001char
input400, unauthenticated401, SQL-controlled inaccessible403, missing404; zero extra
reports. First fixture setup used an invalid audience enum and failed atomically;
finally restored, then rerun with canonical nearby audience and private visibility.
These are controlled access checks, not actual moderation-state lifecycle evidence.

Exact reportsa2032035-9d26-497c-a5ef-0fe662cb910c and8eba4713-8fd4-4beb-8a2d-966e645bae59
removed, target Bob/Post report count0. Post visibility/audience/distribution restored;
PostReport INSERT restored; both auxiliary HTTP sessions logout200. Current browser
and earlier fixtures remain. Local typecheck gate/focused ESLint pass. No new unit
tests. PR83 exactbf595 CI35554056362 all applicable/aggregate green. Coordinator merged PR83 as0fb600391ea6bd88c8f39e9f72bfa6b0b059f765.

Evidence post-report-baseline-results.json, post-report-candidate-results.json,
post-report-boundaries.json and setup-failed snapshot, post-report-types.log/lint.log.
Candidate SHA b53034572475e53547c01aab15e8db7eb1e7c2c97d4f9602d2741a9855b01c02.
Durable private mirror now243files; MANIFEST SHA
2c321c806b41ff73db8ac32fb90a8b357626654fdb9a957fe73dfa9264dc320e.
Artifact-specific source/config remains authoritative, not blanket rerun evidence.
Installed native, provider/moderator processing, report idempotency/concurrency,
account-switch/departure and whole N04 remain unverified.

A02 evidence qualification: repeated refresh500 in private operator logs corresponds
to rejected Origin http://localhost:18131 before auth/cookie parsing. Owned IAB uses
stream3-auth.localhost:18131; coordinator Chrome/IAB inventories have no localhost18131
tab. Exact originating client unknown. Coordinator requested no further unrelated
investigation/CORS broadening. Do not classify these as authenticated refresh failures
or claim all auth error handling verified.

## N03/N04 Beacon publication access — PR84

[Draft PR84](https://github.com/WangPantopus/skinny-pantopus/pull/84), c89949f62,
branch codex/stream3-post-visibility-fields, basePR83. Coordinator granted exactly
existing posts.js POST_VISIBILITY_SELECT additions archived_at/post_metadata. Shared
helper omitted the fields its existing canViewPost policy needs. Current/master/paid/
Beacon selector+helper variants identical, SHA f3434e6897e6bb48bd42026272765f19249900c1779a1a797a16d54b2c26cb24.
No replacement/schema/newtest; no phantom Post.status column added.

Actual baselinebf595: owner Dana HTTParchive200; follower postGET403 and real reload
Post not found, but standalonecomments200 exposed7/8 and likes200. Bob already-open
actual UI Send persisted1comment201 and1ownerNotification after archive. Exact both
removed, original7comments restored via ownerunarchive200. Candidate actual staleUI
Send403 retains draft, no persistedcomment/notice. Archived and SQL-controlled draft
matrices each cover11 follower reads/actions, all403; owner detail/comments/likes200,
seven effect-table counts plus Notification unchanged. Published restoration gives
reads200; retainedUIcomment first hits existing20/min content limiter429, draft still
retained, natural expiry retry201 yields1comment/1notice. No limiter override.
Baseline/candidate exact newcomments/notices removed, original7comments/published
metadata restored; auxiliary owner/fan sessions local logout200. Owner archive/
unarchive naturally updates updated_at; not rewound. Existing31cases/3suites pass.
Coordinator updated PR84 to strictf19349e38, unchanged accepted app bytes; CI35554806445 green and mergedc1c03a3c62944c0a07570db285f945a338c9f1c5. Personal policy unchanged/source+existingtests;
no new personal/native/provider/socket or atomic archive-versus-write race acceptance.

Detailed archive-visibility-results.json SHA
aaceb9644a6e5f8d04e7453bd194de4726e0b8964a7eec5e181f81d11c4a907f,
phase snapshots and candidate-matrix. Private mirror258files, MANIFEST
4c758ece1dc28343d3e0d74eb40c8e1b0127950d97a7a67dc492aeef669e217e.
Backend now PID8033/session61160 on18130; old log preserved from durable snapshot as
real-auth-backend-before-archive.log, current log begins candidate restart.18131 unchanged.

## N01/N02 notification read recovery — PR85

[Draft PR85](https://github.com/WangPantopus/skinny-pantopus/pull/85), headed5b4a8bb,
branch codex/stream3-notification-read-errors, base masterc1c03a3c6. Exactly two granted
existing web files NotificationBell.tsx and app/notifications/page.tsx. No backend,
BadgeContext/socket/SDK/provider/schema/newtest change. Master/paid identical before;
older Beacon differs only accepted guardedtap/route code. Existing QueryProvider
already remounts account-local state on session change; reuse it. Bell now rejects
outdated filter/closed/unmounted reads and token/marker changes; fullpage consumes
query cancellation and checks session. Existing lists use explicit error/Retry,
keep successful/known same-owner slice rows, and suppress false confirmed-empty.

Actual c899 baseline Bob bell11saved/7unread. Isolated Notification SELECT denial:
warmfullpage silently keeps cache; coldfullpage after HTTP500 says All caught up/No
notifications yet, bell likewise. Candidate real coldSQL500 both expliciterror/Retry;
known11warmbell/fullpage rows retained with error. Restored SELECT + actual Retry
recovers; unread filter failure truthful. ScopedPersonal fullpage repeated platform503
transport fault after real SQL keeps7personalrows+error; Retry recovers5unread. Failed
personal503+successful platform200empty gives incomplete/Retry, not empty. One-shot
initialfault was superseded by overlappinginitialreads and is not partialstate proof.

Warm ordering: old Personal500 held02:44:49.897, newer Business200empty UI50.358,
oldrelease59.898/finish59.900 destroyed/socketfalse; after02:45:09.612 stillconfirmed
Businessempty/noolderror orrows. Actual cross-tab Boblogout/Evanlogin whileoldBob
Personal200held02:45:27.797: newEvanUI48.176 beforeoldrelease52.798. Pendingtabretired
tologin, Evanbell/maininbox2ownrows. Oldresponse destroyed/sockettrue/no finish:
**retirement/disconnection only, not intact cross-account delivery evidence**.
Actual EvanAudience GET200empty at02:47:14 usesexisting Allcaughtup/Nonotifications.

All13original Bob/Evan notification IDs/context/readflags unchanged before/after.
No notification mutations; SELECTrestored, privatefaultflagabsent. Bobbrowserloggedout,
newEvanbrowseractive; authaudit/sessioneffectsretained. Earlierfixturesremain. Split
bellcohortoff; fullpagepersonal/platformpartial actual, bellall/legacyfiltersactual;
splitbell behavior only existingregressions, not installedacceptance. No providerpush,
native/physical, allmutationfailures, pagination-scale or frozen-tab delivery closure.
Typecheckgate0; focusedlint0errors/twopre-existingunusedwarnings.16existingcases/2suites
pass; no newtests. PR85 exacted5 requiredCI passed; coordinator merged **d2b83304922b28ff1f12ceaab70d284b1bec3682**. Initialtypenarrowingerror fixedbefore
commit; cleanup-refwarningremoved. Notifications/unreadcounteroutages remain distinct.

Evidence notification-read-baseline.json, notification-read-candidate.json,
notification-response-faults.jsonl, notification-records-before/after.json,
notification-read-types-final.log/lint-final.log/existing-regressions.log. Candidate
SHA8c83abe7d01b2251a09d815c7bebd1a1dce96e328482d8c2f35caa45509ec9e3.
Durable private268file MANIFEST30d163bb66f40b4c2cb8d59a5f1fc76692feeba5547a550e7576f2fb50676e87.
Owned18130 currentlauncher session91329 (private response-fault instrumentation only),
web18131 unchanged. No otherstreamruntime/cache/provider changed.

## N01/N02 notification actions and keyboard removal — PR86

[Draft PR86](https://github.com/WangPantopus/skinny-pantopus/pull/86), c5802b4a1,
branch codex/stream3-notification-actions, base masterd2b833049. Sole granted existing
NotificationBell.tsx, app/notifications/page.tsx, and narrowly added NotificationRow.tsx
keyboard/pending prop. Compare current/master/paid/Beacon: handlers all silent catch;
row identical hashfcf3d21253c71fc3014237d894ea0dbb48f35151d390980f891d72153d1381d8.
Existing selecteddetail and row Remove callers audited; sole NotificationRow caller
updated. No new files/tests/layout/backend/SDK/socket/schema/provider edit.

Actualed5baseline: Evan fullpage+bell MarkAll/Remove each500 under Notification
UPDATE/DELETE denial, no feedback. A SQL-created disposable notification Remove Enter
DELETE200 then unintended PATCHread500 and navigationSecurity. Candidate error toasts
truthfully say could notconfirm/tryagain; pending guards prevent duplicates; child
Remove Enter/Space stop propagation, ordinaryrowkeys remain. Successful same-account
commands invalidate existing notification cache family; reads started before committed
mutation retire. Markall uses authoritative rows instead of marking newly arrived
rows optimistically. Owner/view marker guards suppress obsolete completions/toasts.

ActualUIcandidate: scoped Audience(fullpage) and Business(bell) failure+retry succeed;
real UPDATE/DELETE grants restored.4keyboardremovals (Enter/Space eachsurface) exactly
DELETE200, no parentPATCH/navigation; ordinaryrowEnter/Space stillopenSecurity both
surfaces. Lostcommitted readall200→503 leaves uncertaintoast/knownunread, SQLflags true;
retry200 refreshes. Lostcommitted DELETE200→503 leaves knownrow/toast, SQL0; retry200
removes idempotently. No rollbackclaim. Disposables reused by exactID between phases,
recorded ledger; source createdrecords in SQL, UI/API mutations real, no deliveryclaim.

An initial candidate canceled an in-flight initial list on mutation start; rapid
MarkAll interrupted loading. Repaired by allowing initial reads and disabling initial
MarkAll, retaining success-time retirement. Another actual candidate failure: DeleteA
held10s, switch Read, oldresponsefinishes, returncachedAll<30s resurrectsdeletedA.
Existing cache invalidation fixes it. Finalhold03:05:59.804, Read00.376, intactrelease
03:06:09.806/finish09.808; returnAll19.909 showsAabsent. Doubleclick exactly1DELETE,
pendingRemove disabled. Cached-filter failure/repair evidence retained, not erased.

Accountswitch mutation: oldEvanDeleteheld03:08:15.569, Bobvisible27.509, oldrelease40.572
destroyed/sockettrue/nofinish. Pendingtabretiredtologin; nointactcrossaccountdelivery
claim. No socket/provider/newnotificationarrival matrix closure. All4disposable IDs
retired; finalSQLdeleted onlyremainingDbdcbad0a..., other3alreadygone. Original13Bob/Evan
notification IDs/context/readflags compareidentical; grantsSELECT/UPDATE/DELETE restored,
allnotificationfaultflagsabsent. Evanloggedout/currentBobleftactive; audit/sessionrows
and earlier acceptancefixtures retained. No broadcleanup claim.

Typecheckgate0; focusedlint0errors/twopre-existingwarnings;16existingcases pass onfinal
source. No newtests. RequiredCI/coordinatorintegrationpending. Source-bound private
notification-mutation-candidate.json SHA
d323a40aff2b9b5fd75b0d504e85adb1f0ec1d747ee20692893938f0bc953f46;
linked baseline/keyboard/fixture/transport/check artifacts. Durable280file MANIFEST
**a0d847a7a2d68b4a3fd00dc01572d90ce16e78193d7d4f175bf416e5c961c864**.
Ownedbackend18130 currentlauncher session71561;18131 unchanged. Private responsefault
instrumentation logs are not application edits. Next independent A05 marketplace
reachable-action verification from existing catalog/screens; route payment/Home toowners.

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

Owned HTTP18130 (current launcher session44858), Next18131 (60362); real app.js,
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


## Final persona-mute CI and integration disposition — September21 06:19UTC

Independently verified GitHub PR99 **MERGED** at2026-09-21T06:19:04Z as
**dd24f0029c58dd38e201a9fe6b349eda317361d7**, from exact
**1d835733025cf85cae00f000f61c1c45d509b642**. Automatic
[CI35567483902](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35567483902)
completed **SUCCESS:8 applicable jobs passed/3 path skips**. Passed: detection,
deployment/migration safeguards, backend privacy/Jest, web lint/typecheck/Jest,
identity E2E, backend image, complete schema replay/lint and aggregate CI OK.
Android, iOS and Seeder skipped; this supplies no new installed-native acceptance.
Coordinator reviewed and merged; author did not self-merge or activate hosted migration.

This supersedes the earlier pending-CI/review/integration wording for PR99 only.
Application checkout stays frozen1d835, clean except owned .next-stream3; no source
edit or repeated journey. The387-file private evidence manifest and exact cleanup
remain unchanged. Recorded real UI/API/SQL, controlled transport, session source-review,
unmute HTTP-only, one-active-persona, native/provider and broader row limits all remain.
Owned runtime and original retained fixtures preserved as recorded above; no new scope.
Whole Stream3/N03/N04/A05 are not closed by this integration.

Coordinator captured prior live03c09d8f4a in documentationPR100. This append is the
only Stream3 status change; coordinator owns publication. Paiddd0 fullCI35567323534
was still running native jobs at coordinator handoff and remains a separate gate;
no claim here about its completion or persona integration into that branch.

## PR115 final exact-head CI

Independently confirmed automaticCI35577904476 completed SUCCESS on exact
e47eb37de098f076b307d109ee20953b45b51307. Final job receipt is
professional-auth-ci-latest.json; durable mirror now471files, all hashes verified,
MANIFEST **a653476145474080a0f32bc48382d48ecc2fce31c79b163a4ea0cb3114d3afaa**. Source remains frozen;
no repeated runtime journeys, new fixture or policy expansion. PR114 exact59bCI also
passed. Coordinator owns review/integration; no broader/native/UI acceptance implied.

## Private professional blocked-housemate baseline — verification only

Coordinator granted actual HTTP/SQL verification, no helper edit. Separate branch
at e47 preserves114/115 refs. Read live canViewProfessionalProfile/shareHome and
Home/HomeOccupancy schema plus installed triggers before narrow fixture creation.
Actual private active-housemate read200 with no relationship; both viewer→owner
and owner→viewer blocked Relationship still200/profile returned. Mark viewer occupancy
inactive or ended yields403. Existing helper tests connection then shareHome without
private-branch block check. General getProfileVisibility already checks Relationship
blocking before shareHome. Proposed move existing professional block guard above
public/private split after self/inactive guards; assignment pending, no app edits.

Exact5temporary IDs and5responses in professional-housemate-baseline.json; cleaned
Home,HomeOccupancy,UserProfessionalProfile,Relationship back to original counts0,
auxiliarylogout200. No provider/UI/native claims, no borrowed Home runtime or policy
change. Existing115 owner/anonymous/public/connection evidence reused, not repeated.
Mirror now473files/hashverified; MANIFEST **1bd399a723dcd9af9c7ae063a05c3bcfe87111db455d740b753a52e86a45c214**.
Next: coordinator helper-scope review and existing/archive/open comparison before
any repair. Prior471 PR115 evidence remains source-applicable; current milestone
does not close N04/N03 or broad housemate authorization.
