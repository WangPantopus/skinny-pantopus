# Stream 2 — Home and household

## September 21 D05 atomic-save CI and next source-only proposal

Coordinator captured frozen candidate status64fabc in65a62c64e. Original PR137 **d225ff1e86e68ba6ff9e14c4ec43587760d0c65d** passed [CI35600568312](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35600568312), including fresh database replay/lint, backend and web gates. Coordinator updated PR137 to **bba09eefda263c1d8cdf8fc4c785fa18acfa67fe** with only five documentation files and reviewed SDK136 client change. Independently fetched and confirmed all four Home candidate paths unchanged; [updated CI35601168238](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35601168238) remains in progress. Original local branch/source/evidence and owned migration ledger56 remain fixed; no independent merge, CI rerun or application push.

Candidate durable bundle now has **36 files plus manifest**: original34 unchanged, with rollout-order.md and settings-atomic-pr-current.md added. PR body also records required rollout **migration, updated backend, then web caller**. Old backend ignores profile fields while saving other settings, so new web must not precede backend capability. No hosted rollout. All36 hashes reverified; historical frozen candidate section below retains its publication-time CI/count wording.

Completed next **source-only** reconciliation in owner `.pantopus-recovery/audits/20260921-stream2-settings-save-lifetime-source-r1/`:10 files plus flat manifest,8paths×7refs=56bindings/50present6historicalmissing. Compares current137/master/paid/staging/design/archive/accepted112, including existing Settings caller, conditional dashboard mount, useHomeData refresh, SDK/route/RPC and reusable CreateGuestPass/MemberDetail generation guards. All10 hashes verified. Existing settings read generation guards do not guard the awaited save continuation; it unconditionally schedules feedback and onHomeUpdate. Parent refresh clears ready state and unmounts panels. An old save response after leaving/reopening Settings may therefore retire a newer unsaved draft. **This is not a reproduced failure or accepted repair.**

Proposed bounded later runtime: after137 integration/final-master rebinding and coordinator assignment, hold only a real successful settings200 response after SQL commit on its original socket; navigate Share→Settings, load committed draftA, enter unsaved draftB, release oldreply, inspect B and extra reads while complete saved state remainsA/oneaudit. Use existing owned fixture/runtime, exact settingsPATCH allowlist and provider blocks; record delivery/socket status rather than fabricate success. Reuse accepted108/112/137 and mutation guards; no duplicate normal/error/atomic journeys, new helper/file/schema/unit test or design changes. If actualfailure is reproduced, propose in-place caller guard/timer cleanup. Late errors/session/Home transitions/concurrency/unknown commit remain separate.

Coordinator fixed next integration batch to136,137 and assigned Stream3 logout repair. This proposal stays outside that batch; **no new runtime or application edits until assigned**. Current application worktree remains clean at originald225; tab/API/Next closed, five owned containers stopped/preserved, fixture counts zero, migration retained. No new cleanup or peer resource changes. Coordinator owns shared handoff/backlog/merge/rollout disposition.

Updated September 20, 2026. Owner: Home stream.

## September 21 D05 atomic Settings — reviewable repair

**Published; required CI queued; stream incomplete.** Clean/pushed `codex/home-settings-partial-verification` at **d225ff1e86e68ba6ff9e14c4ec43587760d0c65d**, [draft PR137](https://github.com/WangPantopus/skinny-pantopus/pull/137), de0finalmaster base. [Exact CI35600568312](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35600568312) queued; no green claim. Exact4path/midtransactionprobe grants followed; separate from paid48702/priorpublication.

- Four paths: existing HomeSettingsTab.tsx sends one settings command containingname/type and existingdraft; safefailureMessage preserves APIerrors. Existing SDK homeProfile.ts addsoptionalname/type. Existing homeIam.js settingsPATCH validatescanonicalname string<=120/empty/null and exact10HOME_TYPES/no nulltype. One new `supabase/migrations/20260921010000_home_settings_atomic_profile.sql` CREATE OR REPLACEs same update_home_settings signature, addingprofilevalidation/assignments. ExistingHome/HomePreference/HomeAuditLog/authority/lock/clearing/defaults/preferences/audit logic preserved; Homeupdated_at triggerretained. NameDBlimitmatches existingJoi UTF16units, includingemoji.101additions/7deletions total. No newtable/service/paralleltransaction/newunit test/designchange; appliedhistory untouched. Forwardmigrationnecessary toextendalreadyappliedfunction safely; deploybeforecaller.
- Reused source11/56bindings, actualpartialsave baseline17 and accepted108/109/112withinlimits. No duplicatefullclearing/validation/UIjourney or unrelatedprofilecallers changed.
- Actual IAB23→SDK→realpermission/routes/RPC/PostgREST/SQL: original changedname/welcomedraft now sends one settingsPATCH. ExactRPC EXECUTEdenial→503 and completeHome/Preference/Audit/occupancy/ancillary unchanged, includingname/updated_at. Exactfunctionprovenancerestored; samecurrentdraftretry→onePATCH200/intendedfields+oneaudit.
- Approvedmidtransactionfault: absent-nameprecheck/fullHomeAuditLog owner/ACL/constraintdefinitions/validatedflags captured; addedonly NOT VALID CHECK rejecting ownedHome f0e51100-0000-4000-8000-000000000100 and home_settings_updated action. ActualUIchangedname/type/welcome/bills→503atfinalauditinsert; fullHome/Preference/Audit/ancillaryexactlyunchanged after earlierwritesrolledback. Droppedonlynamedprobe; completeoriginalcatalog/provenanceequal. SameUIretry→one200/all4intendedvalues+oneaudit. No broadtrigger/function/permissionfault for thisprobe.
- UI121charname400 and currenthome.edit403 eachretainoriginaldraft/show safeerror/leavefullstateunchanged; authorityrestore/retry200/fullreload showsname/Condo/welcome/billson. Existing112 explicitwelcomeempty verifiedthroughcontrolledDOMreadback/onePATCH200/SQL/reloadedsettings. Initialclearinteraction DOM.describeNode timeout thenstaleclick sentnowrite; freshread showedoldvalue, excluded. Only repeatedconfirmedclearaccepted. EightactualUI PATCHes:503,200,503,200,400,403,200,200; foursuccesses/fouraudits. No profilePATCH.
- ActualHTTP/SQL compatibility (labellednonUI):9invalidcasesatbothAPI/DB fullstateunchanged (longASCII/UTF16,numeric/object/array/boolname,null/unknown/numerictype);14validDBcaseswithinrolledbacktransactions (empty/null/maxASCII/maxUTF16name and10types); settings-onlyHTTPclears6fieldswhileomittedname/type/prefsremain;5validHTTPboundarycasesincltrailer thenoriginalvaluesrestoredviaHTTP.24totalsettingsPATCHreceipts,0providers/suppressed/blockedattempts. Existingauthority/preference/audit/clearingSQLbytesoutsideaddedprofilelogiccheckedunchanged. Settings-onlycompatibilitydoesnotclaimproviderdelivery.
- TypeScriptexit0, scopedlintexit0/0errors6existingwarnings, backendsyntax0, whitespaceclean. No newtests. Localforwardmigration committedwithcanonicalledgerrow55→56; samefunctionowner/ACL/signature. Fullfreshschemareplay/requiredCI pending; existingbroadertriggercontract not rerunlocally, approvednarroweractualUIrollbackprobe used. Hosted/native/session/concurrency/unknowncommit/save-lifetimeacceptance remainopen.
- Cleanupall12basecounts0 plusfullHome/Preference/request/invite/occupancy/audit/notification/capability/commands/override0; probeconstraint0. InstalledcandidateRPCprovenance andoriginalauditcatalog reverifiedaftercleanup. Forwardmigrationandledgerentryintentionallyretained inownedDB; nothosteddeployed. Tab23/API/Nextclosed,fiveowncontainersstopped/preserved,allreservedIPv4/6ports18141/18142/64550–59free; temporarylintsymlinkremoved. No peer/native/cachechanges.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-atomic-candidate-r1/`,34files+flatmanifest: exact4sources/binding,privatefixture/probes,realUI/API/fullSQL/validation/migration/provenance/rollback/compatibility/cleanup/PRbody. Baseline17/source11remainseparate. Credentials/rawoperatorlogs excluded. Identity/ancillarydashboardtask/events/counts synthetic; actualsettingsauthority/transaction/SQL.

**Frozen candidate for coordinator capture/review and CI/integration.** SharedSDK homeProfile.ts and homeIam settingsPATCH additivecontracteffects flagged; Stream3client.ts untouched. Coordinator owns merge/schema rollout/sharedbacklog. No broadD05closure or additionalruntimework.

## September 21 D05 changed-profile partial save — actual baseline frozen

PR133 merged **de0ac6ef3c051485b5800a288194ee563396a12a** after exactupdated78f137b72 [CI35597307862](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35597307862) passed. Coordinator captured prior live02b339 in a5357f314. Per runtime-only grant adopted finalmasterde0 on separate `codex/home-settings-partial-verification`, preserved133ref and rebound all8 relevant sources unchanged. Clean appsource/no edit/newtest/native/schema change.

Source11-artifact proposal remains at owner `.pantopus-recovery/audits/20260921-stream2-settings-partial-source-r1/`; all11 hashes checked, manifest SHA256e26b66358d33fc793a9f73d2441090912970d48e054ebad6b89338a55fdae032. Eightpaths×7current/master/paid/staging/design/archive/accepted112 refs=56bindings/52present4missing. Existingcomponent/exacttwohandlers/RPC equal112. Reuse108/109/112 acceptance;112's profile200/settings400 had unchangedprofileinputs, not changed-name atomicity.

Actual IAB22 dashboardSettings GET200 loaded originalname/welcome. Changed validname and welcome text, UIreadback confirmed. Captured fullHome/Preference/Audit/Occupancy plus request/invite/notification/capability/commandstate and exact update_home_settings definition/owner/ACL/effectiveEXECUTE. Transactional directservice_role EXECUTErevoke confirmed effectivefalse. SingleUI Save produced profilePATCH200 then settingsPATCH503. OnlyHome.name and updated_at persisted; oldwelcome/preferences/audits/allotherfullrows/counts unchanged. UI retained both intendeddraft values/enabledSave but showed only Failed to save; heading/sidebar retained oldname. Complete originalRPCprovenance restored immediately.

SamecurrentUI retry sent identical originalprofile/settings bodies→200/200, saved intendedname/welcome plusone home_settings_updated audit; fullreload showsbothvalues. Notificationpreferences/otherentities unchanged. Accepted112 behavior also normalizes pre-existing null local_tips to explicit empty on successfulsave; recorded rather than falsely claiming exactlytwofinalHomefields. Recovery works within this scope; initialpartialcommit violates atomic-save requirement and remains unrepaired.

Privatefixture limits: initial staticdashboardpermissions disagreed with realauthority; then unsupported task/eventstubs blocked load. Both attempts had zeroPATCHes/excluded. Aggregate now uses actualgetUserAccess; unrelatedtask/eventcollections explicitlysynthetic. Firstsetup exactcleaned; secondseedstate preserved. Identity/ancillarydashboard synthetic; actualprofile/settings/IAM/RPC/PostgREST/SQL. No providers/blockedattempts/newnative/hosted/session/concurrency/save-lifetime acceptance.

Proposed smallest atomic direction forreview: extend existing update_home_settings/route/SDK with canonicalname/home_type and send onecommand fromexistingHomeSettingsTab, preserving currentauthority/locks/clearing/preferences/design. No newtable/service/parallelrecords. Anyfunctionextension requires compatibleforwardmigration because appliedhistory must notbe rewritten; no migration/appedit isauthorizedyet. ExistingfailureMessage may convey safeerrors but copyalone doesnotestablishatomicity. Concurrency/unknowncommit/navigationretainedintent remain separate.

Durable owner `.pantopus-recovery/audits/20260921-stream2-settings-partial-baseline-r1/`,17files+flatmanifest: exactcomponent/finalbinding/privatefixture/SQL/HTTP/draft/fullstate/provenance/recovery/cleanup/scope. Cleanupbase12counts0 plus Home/Preference/request/invite/occupancy/audit/notification/capability/commands/override0, originalRPCprovenance verified aftercleanup. Tab22/API/Nextclosed, fiveowncontainersstopped/preserved; reservedIPv4/6ports18141/18142/64550–59 free. No peer/native/cachechanges.

**Actual baseline frozen for coordinator review before any application/schema repair.** Runtime released, no sourcecommit because this milestone changed noapplicationcode. Shared backlog remains open; no independent merge.

## September 21 D07 standalone Audit — reviewable repair

**Published; required CI running; stream incomplete.** Clean/pushed `codex/home-standalone-audit-verification` at **0e91b0cfd3d304762bb8a98031568081f0cd3196**, [draft PR133](https://github.com/WangPantopus/skinny-pantopus/pull/133), a165finalmaster base. [Exact CI35596780993](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35596780993) running; no green claim. Separate later work outside published131/132 and fixed paid48702bc9d. Exact topREADME page-only grant followed; prior baseline unchanged below.

- Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,6 additions/2 deletions. auditError reset by existing retire; rejected auditRes through already imported safe failureMessage; existing ErrorState/onRetry(fetchData) before empty Audit branch. Successful empty/row UI/styles/navigation, currentaccess/generation/Requests/mutation handlers preserved; handler and Requests result bytes checked identical. No new application file/helper/schema/service/unit test.
- Reused baseline15/source12/63bindings and accepted102 dashboard14-artifact evidence, plus source-bound standalone role/decline/approval/Requests work. No accepted dashboard or mutation journey replay.
- Actual IAB21→SDK→IAM/currentpermission→PostgREST/SQL: genuine audit200empty retains No audit log entries/noerror. Seed one explicitly synthetic auditrow, capture complete state and tableprovenance; directservice_roleSELECT revoke transaction confirms effective table/anycolumnSELECT false. Existing Refresh→actual500/error/no falseempty; keyboard Try Again→second actual500/error still usable. Restore exact owner/tableACL/columnACL/RLS/effectiveSELECT, keyboard retry→200/exactevent/actor rendered. Exact members.manage=false override→actual403/No permission to view audit log, rows and management tabs/Invite absent; removeoverride/keyboardretry→200/exactrow and controls. Fullrequest/invite/occupancy/audit rows and ancillary counts unchanged throughout reads. Zero application mutations/providers/suppressedtransports/blockedattempts.
- TypeScript exit0; scoped ESLint exit0/zero errors15existing warnings; diff clean. Synthetic identity/seeded event/localledger55; no new native/hosted/provider/session/stale-read acceptance. Broader D07 remains open.
- Cleanup base12counts0 plus exactrequests/invites/occupancies/audits/notifications/capabilities/commands/overrides0; completeoriginaltableprovenance verified aftercleanup. Tab21/API/Nextclosed, fiveownr1containersstopped/preserved; allreservedIPv4/6ports18141/18142/64550–59 free; temporary lintsymlinkremoved. No peer/native/cachechanges; runtime released.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-candidate-r1/`,20files+flatmanifest: exactpage/privatefixture/runner/SQL/initial/fault/denial/recovery/fullstate/tableprovenance/validation/cleanup/PRbody. Baseline15/source12 remain separate. Credentials and raw operator logs excluded.

**Candidate frozen for coordinator capture/review and requiredCI/integration.** No independent merge/sharedbacklog closure or additional runtime work.

## September 21 D07 standalone Audit — actual baseline frozen

Verified PR131 merged **a165506795b7d4919a1ec596d0cd5322de0c2388** after exact45c3 [CI35595309234](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35595309234) passed. Adopted finalmaster on separate `codex/home-standalone-audit-verification`; original131ref preserved, all9 source bytes unchanged from12-artifact Audit proposal. No application edit/newtest/native. Followed conditional runtime-only grant.

Actual IAB20 standalone Members→Audit Log rendered one explicitly seeded stream2.audit_fixture event through real SDK/homeIam/currentpermission/PostgREST/SQL GET200. Captured full request/invite/occupancy/audit rows and ancillary counts, HomeAuditLog owner/tableACL/columnACL/RLS/effective service_role SELECT. Transactional direct SELECT revoke confirmed both effective tableSELECT and anycolumnSELECT false (no inherited/column permission defeating fault). Existing Refresh members→actual audit500 Failed to fetch audit log with members/me/requests200. UI falsely displayed No audit log entries, no error/retry, while exact audit event and all full state remained unchanged. Restored original SELECT immediately; complete original provenance exactly equal. Existing Refresh→200/exactevent/actor rendered again, fullstate unchanged. Zero application mutations, provider calls, suppressed transports or unexpected blocked attempts.

Proposed smallest existing-page repair only: auditError state/reset in existing retire, record rejected auditRes through already-imported failureMessage, existing ErrorState with guarded fetchData retry before empty Audit branch. Preserve successful rows/layout/navigation, existing currentaccess/generation guards and every mutation handler. No replacementcomponent/service/schema/helper/applicationfile/unit test or dashboard replay. Actual candidate trueempty/repeated500/keyboardretry/200 and optional isolated403/restoration subject to exactrepair scope. No app edit yet.

Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-baseline-r1/`,15 files plus flatmanifest: exactpage/final9sourcebinding/privatefixture/runner/fullSQL/actualHTTP/UI/provenance/cleanup. Prior source12 and accepted102 dashboard14 reused within recorded limits. Synthetic identity/seeded audit/localledger55; no hosted/native/newsession/stale-read acceptance.

Cleanup all12 base counts0, exactrequests/invites/occupancies/audits/notifications/capabilities/commands/overrides0; original table/column/RLS/effectiveprivilege reverified after cleanup. Tab20/API/Next closed; fiveownedcontainers stopped/preserved, reservedIPv4/6ports18141/18142/64550–59 free. Runtime released; clean application branch at a165. Baseline frozen for coordinator review before any application edit; no sharedbacklog closure.

## September 21 D07 standalone Audit — source-only follow-up

PR131 original7d70f45f3 [CI35594780550](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35594780550) completed SUCCESS. Coordinator updated remote to45c3be38b4a8c67b33dbe6a2fdfcbe8bf7a4b6ec with five documentation files only and identical tested page; [updated CI35595309234](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35595309234) is running, not accepted green. Frozen prior live02 c0b4cc99 captured in coordinatorbc0a76357. Original local branch/source preserved; runtime remains released.

Permitted standalone Audit source comparison:9paths×7 current/master/paid/staging/design/archive/accepted102 refs=63 bindings,59present/4historicalmissing. All seven standalone variants assign only fulfilled auditRes and render No audit log entries for empty state. Actual SDK→homeIam.js /audit-log→members.manage helper→direct HomeAuditLog SELECT actorjoin/home/range produces403 on denial and500 on SQL failure. This is distinct from home.js /activity and Requests RPC. No standalone runtime failure has been reproduced yet.

Accepted102 dashboard MembersSecurityTab and exact audit route handler remain byte-identical. Reuse prior bounded14-artifact real500/retry/pagination/403/stale-page evidence; the standalone caller has different existing layout/navigation, so replacing it with dashboard panel is unnecessary. Existing ErrorState/failureMessage and guarded fetchData can support an in-place repair if failure is reproduced. No new application file/table/service/schema/unit test justified.

Durable owner `.pantopus-recovery/audits/20260921-stream2-standalone-audit-source-r1/`,12files plus flatmanifest:9sources/comparison/exactreusebinding/proposal. Coordinator verified12artifacts/63bindings and recorded conditional runtime-only grant in top README. After131merge, adopt finalmaster on separate follow-up and rebind source; only then use owned18141/18142/64550–59/existingfivecontainers. Seed one clearly synthetic auditrow/no business mutation/provider send, actual200/exactrow first. Capture tableowner/ACL/columnACL/RLS/effectiveSELECT; revoke directservice_roleSELECT transactionally only if effectivefalse, otherwise rollback. Existing Refresh→actualaudit500 with members/me/requests200/fullstateunchanged, restore exactprovenance immediately and recover200/exactrow. Clean exactfixtures/release runtime before reporting baseline. No application edits or new acceptance before baseline/exactrepair scope. No dashboard replay/native/hosted/provider/session claim.

**Next action waits for coordinator131merge/finalmaster notification.** Current original131 source, prior acceptance sections and released runtime preserved; no independent merge/shared backlog closure.

## September 21 D07 Requests list — reviewable repair

**Published; required CI queued; stream incomplete.** Clean/pushed `codex/home-request-list-verification` at **7d70f45f39b8602dde592c98cb45164d576e6e96**, [draft PR131](https://github.com/WangPantopus/skinny-pantopus/pull/131), final master747b45754 base. [Exact CI35594780550](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35594780550) queued; no green claim. Later batch outside fixed128/129/130. Prior frozen baseline remains below unchanged.

- Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,9 additions/3 deletions. Existing requestsError state/retire reset, rejected list through safe failureMessage, existing ErrorState and guarded fetchData retry, no misleading zero during error. Successful count/empty/pending layout, canManage, generation/session guards and navigation preserved. Role/decline/approval handlers byte-identical to base. No backend/schema/new application files or unit tests.
- Reused accepted16-artifact actual list503/falseempty/full-state baseline and12-artifact source/63binding comparison. Existing role/decline/approval/departure evidence remains source-bound; no broad replay.
- Actual IAB19→SDK→router/homeInvitationService→PostgREST/SQL: genuine list200 empty renders Requests(0)/No pending requests; real applicant requestcreation200; exact RPC direct service_role EXECUTE revoke makes effective permission false, subsequent list503 and keyboard Try Again→503 show existing error and no falseempty/zero/actions. Restore exact function definition/owner/ACL/effectiveEXECUTE, keyboard retry→200/exact pending applicant/Requests(1)/existing controls. Current exact members.manage=false override→actual403/access-denied error/no controls; remove override and existing Refresh→200/exact applicant. Full request/invitation/occupancy/audit rows plus notification/capability/command counts unchanged throughout reads. All original function provenance restored exactly.
- Only one application mutation: requestcreation200. One safe suppressed request-notification method record, zero real providers/unexpected blocked attempts. Three automatic initial successful empty reads precede503/503/200/403/200; an overly narrow aggregate count assertion was corrected against captured receipts without rerunning UI. No application defect inferred from that private evidence assertion.
- TypeScript exit0; scoped ESLint exit0/zero errors15 existing warnings; diff check clean. Synthetic local identity and suppressed transport; real service/SQL on localledger55. No new session-transition/stale-read/hosted/installed-native/provider acceptance. Broader D07 and Stream2 remain open.
- Exact cleanup: all12 base counts0, extra applicant User/auth0, requests/invites/occupancies/audits/notifications/capabilities/commands/overrides0. Original RPC provenance checked again after cleanup. Tab19/API/Next closed, five own r1 containers stopped/preserved; reserved IPv4/6 ports18141/18142/64550–59 free; temporary lint symlink removed. No peer/native/cache changes.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-candidate-r1/`,20 files plus flatmanifest: exact page, private fixture/runner, SQL/provenance, actual per-case and aggregate HTTP/full-row evidence, validation/cleanup/PR body. Credentials and raw operator logs excluded. Prior baseline16 and source12 remain separate frozen artifacts.

**Frozen candidate ready for coordinator capture/review and integration.** No merge/shared backlog closure. Runtime released; current-head CI pending.

## September 21 D07 Requests list — actual failure baseline frozen

After129merged, adopted **747b45754b24accce096898508e2de3355ed86a3** on separate `codex/home-request-list-verification`. Prior128refs preserved,9relevant sources unchanged from accepted12artifact/63binding map. Clean source/no appedit. Runtime-only grant followed, later work stays outside fixed128/129/docs130batch.

Actual requestcreation200/list200 rendered exact applicant inIAB18. Exact list_home_household_requests(uuid,uuid,text) functiondef/owner/ACL/effectiveprivilege captured; directservice_role REVOKE gave effectiveEXECUTEfalse (noinheritedgrant). Actual UIreload→list503 INVITE_UNAVAILABLE while occupants/me200, but UI said Requests(0) and No pending requests with noerror. SQL still pending; complete request/invite/occupancy/audit rows and notification/capability/commandcounts equalbefore. Restored only originalEXECUTE; fullfunctiondefinition/owner/ACL/effectiveprivilege exactlyequaloriginal. Existing Refresh members→list200/exactapplicant Requests1/fullstateunchanged. Earlier private stub503 remains excluded; this is actualservice/PostgREST/SQLfailure.

Proposed exactpage repair: requestsError state/reset onretire, rejectedreqRes via existingfailureMessage; existingErrorState with guardedfetchData retry before emptylist; omit misleadingzero count onlywhileerror. Preserve successfulscreen/controls/navigation/canManage/generation/otherhandlers/backend/schema. No appedit beforecoordinator review; no newfile/test/native orrole/invitation replays. Syntheticidentity/transport, deliberateownedRPCprivilegefault/localledger55; session/stale/hosted/deviceunverified.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-baseline-r1/`,16files+flatmanifest: exactpage/finalbinding/actualbefore-fault-recovery/fullSQL/functionprovenance/privatefixture/cleanup. Source12bundle reused. OnlyexactrequestcreationPOST;1suppressedrequestnotification,0provider/blockedunexpectedattempts. Cleanup12basecounts0+extraapplicantUser/auth/request/invite/occupancy/audit/Notification/capability/commands/override0. Fulloriginalfunctionprovenance restored beforecleanup. Tab18/API/Nextclosed,5ownedcontainersstopped/preserved,reservedIPv4/6portsfree. Runtime released; frozenbaseline readyforcapture.

## September 21 D07 Requests list — next source-only proposal

PR128 merged **b412b1b589bd9fa1755887e7c6afe26112c7c55e** after updatedd34ca7e341 [CI35592633526](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35592633526) passed. Coordinator captured prior frozen live02 hashd3c8ee7f in44d335145. Original local128dc130/source refs preserved; merged page bytes identical. Runtime remains released, no appedit/branchswitch.

Authoritative D07 still requires Members/Security error-versus-empty/current-access verification. Existing standalone Requests fetchData retires/clears requests, handles only fulfilled list results, then renders No pending requests for[] even when actual list rejects. Real SDKGET→home.js→homeInvitationService.listRequests→list_home_household_requests already returns safe503/authority403. This is source-only, not a reproduced production failure; earlier ancillary queue503 was a private service stub and stays excluded. Accepted sender invitation list recovery, audit panel,128approval/125decline/123role and current SQL contracts are distinct and reused.

Compared9paths×7current/archive/openrefs=63bindings (57present/6historicalmissing). Six refs use fulfilled-only clause; place-design has explicit else setAccessRequests([]), same empty-state outcome. Existing ErrorState/failureMessage and accepted MembersSecurityTab recovery patterns can be reused in this caller. SenderInvitationManager manages invitations, not access requests; replacement would change contract/navigation and is unnecessary. No new implementation/schema/screen/test justified.

Proposed runtime-only after separate finalmaster adoption and coordinator grant: own18141/18142/64550–59, actual requestcreation/list200/rendered applicant, no approval/decline. Capture fullstate/counts and exact list_home_household_requests(uuid,uuid,text) definition/owner/ACL/service_role privilege. Temporarily revoke only function EXECUTE from service_role in owned DB; tableSELECT fault is unsuitable for this SECURITYDEFINER RPC. Actual UIreload/Refresh should capture real GET503 while roster/me remain200; inspect falseempty and confirm pendingSQL/fullstateunchanged. Restore exactoriginalACL/privilege immediately, recover via existing Refresh members. Report baseline before any appedit. All external/dynamic notification transports and unrelated writes blocked; exactfixture/functionprovenance/runtime cleanup required. No accepted journey replay/new native/provider/session claim.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-list-source-r1/`,12files+manifest (9sources/63bindings/report/variantnote). Only variantnote added after initial11artifact handoff, prior bytes unchanged. No runtime/fault/fixture/application changes; coordinator scope pending. D05/D06/native/provider leads remain separate; no shared backlog closure.

## September 21 D07 Send invitation — reviewable repair for next batch

**Published, required CI running; stream incomplete.** Clean/pushed `codex/home-request-invite-verification` at **dc130eab9301f33ac38de7ba9ecd0b333680c5f8**, [draft PR128](https://github.com/WangPantopus/skinny-pantopus/pull/128), merged125bc2base. [Exact CI35592119547](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35592119547) running; no green claim. This belongs to next batch, does not extend127/paid publication.

- Sole existing handleApproveAccessRequest in members/page.tsx13additions/4deletions. Reuse pageConfirmation ownership and generation/token/origin/session beforePOST, success/error/finally. Existing retire/busyclear already present. Source outside handler byte-identical tobc2; role/decline/sharedstore/controls/copy/navigation/backend/schema untouched. No new application files or unit tests.
- Accepted baseline12/source13/77bindings reused without repetition. Actual IAB17→SDK→production homeInvitationService/transaction/PostgREST/SQL: normal approval200 creates one exact targeted pending invite and approves request, Requests0. A second synthetic applicant's real request/list200 permits independent remaining check while preserving first invite. Pending confirmation→BrowserForward /edit closes dialog/no additionalPOST; complete request/invite/occupancy/audit snapshots and Notification/capability/commandcounts identical. Fresh BrowserBack caller usable; exact temporary members.manage deny after confirmation opened returns403/current readable error/enabled Invite, same fullrows/counts. Restoreoverride/freshconfirmation→200, second targetedpendinginvite. Fullreload No pending requests. Approvalstatuses200/403/200;two creation200s. Full occupancy remained identical throughout; no membership/recipientacceptance claim.
- Dynamic email/notification modules intercepted for process lifetime: six safe method records for2requestnotifications+2email+2invite-notifications,0realproviders/blockedunexpectedattempts. Notification/capability/sender+decisioncounts0. No rawtokens/emailbody in evidence. Toast Invitation sent is not deliveryproof. Localfixtureledger55/syntheticidentity/transport; no hosted/native/session/otherdialog/delayedapprovalcompletion acceptance.
- TypeScriptexit0; scopedlintexit0/0errors15existingwarnings; diffclean. Before UI, second fixture username exceeded30character SQL limit and server did notlisten; exact partialfixtures cleaned/reseeded with shorter username. This private setup error is excluded from application evidence; no apprepair for it. Existing role/decline and invitation/SQL regression evidence reused because unchanged.
- Cleanup12basecounts0, both extraapplicantUser/auth0, exactrequest/invite/occupancy/audit/Notification/capability/sender+decisioncommands/override0; temporaryoverride removed/noDBgrantschanged. Tab17/API/Nextclosed,5owncontainersstopped/preserved, allreservedIPv4/6portsfree. Temporarylintsymlinkremoved; no peer/native/cachechanges.
- Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-candidate-r1/`,15files+flatmanifest: exactpage/privatefixture/actualHTTP/fullSQL/UI/departure/denial/validation/cleanup. Baseline12/source13 remain separate frozen evidence. Credentials/rawoperatorlogs excluded.

**Candidate handoff frozen for coordinator capture/review and next-batch integration.** No broad D07 closure or further application/runtime work.

## September 21 D07 Send invitation — actual baseline frozen

Adopted merged125 master **bc2bec5adb7aab01f1fd098be7cd9df202739864** on separate `codex/home-request-invite-verification`, preserved125refs, clean/no appedit. Eleven relevant current source bytes match the accepted13file/77binding source bundle. Coordinator runtime-only grant followed; current batch125/126/rootremoval is not expanded.

Actual real requestcreation200/list200 rendered exact synthetic applicant(nooccupancy) in IAB16. Current Send invitation→Cancel produced no approvalPOST and identical full request/invite/occupancy/audit snapshots plus notification/capability/sender/decisioncommandcounts. Existing HomeSettings/Back creates same-document history; Send invitation opened then BrowserForward /edit leaves modal. Click Send invite onSettings→actual approvalPOST200, exact request approved/resolved_by owner, one targeted pending HomeInvite/source_request_id, one HOME_INVITE_CREATED audit. Full occupancy unchanged, no applicant membership. Success toast Invitation sent observed onSettings; it is not delivery evidence.

Private process-lifetime dynamic transport interception suppressed requestnotification/sendHomeInviteEmail/notifyHomeInvite (3safe method records, no raw tokens/emailbody).0realprovider/blockedunexpectedattempts;notification/capability/commandcounts0. Real service/SQL, synthetic identity/transport, localledger55. No recipient acceptance/receiptsemantic/native/hosted/session or broad invitation replay claim.

Proposed smallest repair: only existing handleApproveAccessRequest adopts pageConfirmation identity/current generation/token/origin/session guard beforePOST and success/error/finally, reuses retire busyclear; no sharedstore/UIcopy/backend/schema/newfile/tests. No app change yet; coordinator exact repair review pending.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-baseline-r1/`,12files+flatmanifest: final11sourcebinding/exactpage/actualbaseline+Cancel/fullSQL/privatefixture/cleanup. Source13bundle reused separately. Cleanup all12base counts0 plus exactrequest/invite/occupancy/audit/Notification/capability/sender+decisioncommands/applicantUser/auth/override0; noDBgrantschanged. Tab16/API/Nextclosed,5ownedcontainersstopped/preserved, reservedIPv4/6portsfree. Runtime released. Frozen baseline ready for capture; no repeated verification before candidate scope.

## September 21 D07 Requests Send invitation — source-only comparison

PR125 original e7865fd81 [CI35589989322](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35589989322) passed. Coordinator updated125 to1c9181a596474b1e0e9cae60e589757690cf64fc with identical reviewed page bytes/docs-only additions; updatedCI35590631566 remains coordinator gate. Prior candidate live02 hash0af76cb4 captured54772e50a; frozen original local branch/source and released runtime preserved. No branch switch or application edit for this source-only task.

Existing Requests Invite→Send invitation confirm→SDK approveHouseholdAccessRequest→home.js→homeInvitationService.write(approve_request)→write_home_invitation traced. SQL current authority/source/policy checks and same-actor replay already exist; creates one targeted pending HomeInvite/source_request_id, request approved/resolver/audit, no membership. Awaited UI confirmation lacks accepted role/decline lifetime guards; source similarity alone is not a reproduced defect.11paths×7current/archive/openrefs=77bindings/72present/5historicalmissing, identical approval-handler hashes across all7.

Policy/side-effect distinction: approval separately awaits notifyCreated, which dynamically attempts email with raw token and in-app notification (real helper may badge/socket/push). Proposed private fixture must intercept both modules for process lifetime; log only safe method/count data, no raw capability. Unlike sender-recovery commands this route returns no delivery proof; existing Invitation sent toast cannot establish actual delivery. No recipient acceptance, receipt-policy replacement or copy change is in scope.

Proposed runtime after125integration: adopt finalmaster on separate follow-up and rebind relevant source; only own18141/18142/64550–59. Exact applicant/no occupancy, actual request creation/list200/rendered request; current Cancel noPOST/full state equal, then same-document departure with Send invitation pending. Record any actual stale approvePOST/status and exact pending-invite/request/audit changes while complete membership unchanged. All provider/unrelated mutations blocked; observe transport suppression and zero Notification/command/capability additions; clean exact invitations/requests/applicant and original fixture counts, then release own runtime. Reuse accepted sender/recipient/role/decline/SQL evidence; do not replay it.

Durable owner `.pantopus-recovery/audits/20260921-stream2-request-invite-source-r1/`,13files+flatmanifest (11sources,77bindings,scope/sideeffects/proposal). Source-only; no new acceptance/runtime/tests/native/provider activity. Coordinator scope review pending; original125 and runtime remain frozen.

## September 21 D07 Requests decline — reviewable repair

**Published, CI queued; stream incomplete.** Clean/pushed `codex/home-request-decline-verification` at **e7865fd81d15fe3802b65d2a18b7a3eacc9462e3**, [draft PR125](https://github.com/WangPantopus/skinny-pantopus/pull/125), merged55856362b base. [Exact CI35589989322](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35589989322) queued, no green claim. Coordinator exact caller grant followed; frozen baseline/source evidence below reused unchanged.

- Sole existing members/page.tsx19additions/10deletions: locally rename owned role dialog ref to pageConfirmation for role+decline; retirement closes only matching owned dialog and clears request busy. Decline captures current generation/token/APIorigin/session marker, refuses stale confirmation beforePOST, guards success/error/finally. Existing role behavior reused. Approval/shared dialog/store/backend/schema/design/navigation unchanged; no new application file or unit test.
- Actual IAB15→SDK→production route/service/PostgREST/SQL: current decline200/rejected+audit/Requests0. Create second exact pending applicant request through actual route, current list200 displays it. Open decline→same-document BrowserForward /edit closes dialog; no newPOST and full request/audit/occupancy/invite rows equal. BrowserBack fresh caller usable; exact members.manage override after modal opened yields real403, readable current message, enabled Decline and unchanged full rows. Remove override, fresh confirmation retry200; full reload No pending requests. Focused shared-ref role regression Guest→Admin200, UI ADMINS and SQL saved. Candidate reject statuses200/403/200, role200, two creation200s. Four notification methods suppressed;0provider/blocked unexpected attempts. Broad121/123 role and invitation/SQL acceptance reused.
- TypeScript exit0; scoped ESLint exit0/0errors15existingwarnings; whitespace clean. Initial lint dependency lookup failed before lint ran; reused existing root dependency symlink then completed and removed that temporary symlink. Required CI remains current-head gate. No delayed-decline/session/other-dialog/native/hosted/approval acceptance; synthetic identity/notification transport/local ledger55. Already-submitted commands are not claimed canceled.
- Cleanup:12base fixture counts0, extra applicant/role User/auth0 and request/invite/occupancy/override/audit0. No DB grants changed, exact temporary override removed. Ownedtab15closed, API/Nextstopped,5owncontainersstopped/preserved, all18141/18142/64550–59 IPv4/6portsfree. No peer/native/cache edits.
- Durable candidate owner `.pantopus-recovery/audits/20260921-stream2-request-decline-candidate-r1/`,14files+flatmanifest, exact page/private fixture, actual HTTP/fullSQL/UI/denial/departure/validation/cleanup. Accepted baseline11 and source10bundles remain separate/frozen. Credentials/raw operator logs excluded.

**Candidate handoff frozen for coordinator capture/review/integration.** No broader D07 closure or further app/runtime changes.

## September 21 D07 Requests decline — actual baseline frozen

On unchanged55856362b, IAB14 actual pending Requests loaded through real homeInvitationService/PostgREST/SQL after HTTP request creation200 and list200. Synthetic applicant has no occupancy. Current Cancel produces no rejectionPOST and complete request/audit/occupancy/invite snapshots remain identical. Existing HomeSettings navigation and BrowserBack establish same-document history; Decline opened on Requests then BrowserForward /edit leaves global modal visible. Clicking Decline there sends real rejectPOST200, sets exact request rejected/resolved_by owner/timestamps, adds one HOUSEHOLD_ACCESS_REJECTED audit and shows Request declined toast on Settings. Full occupancy/invite rows remain unchanged. This is actual caller failure, distinct from earlier private queue stub503.

No app change. Propose existing decline handler reuse current role ownership/current-generation pattern, sharing one page-owned confirmation ref with role; before-POST and completion/error/finally guards. Preserve approval handler/shared store/global dialog/controls/policy/backend/schema. Source bundle10files/48bindings reused; no repeated invitation/role acceptance or new unit tests.

Private fixture allows real service; process-lifetime dynamic notification interceptor suppressed exactly request and rejection notification calls; network guard permits only owned local64551, HTTP mutation guard permits only exact request creation/rejection.0blocked network/unexpected mutation attempts. Notification delivery/authentication remain synthetic; local ledger55, current full replay is accepted123CI. No session/native/hosted/approval acceptance.

Baseline durable owner `.pantopus-recovery/audits/20260921-stream2-request-decline-baseline-r1/`,11files+flatmanifest: exact page/private loader/server/full baseline+Cancel+SQL/cleanup. Exact cleanup12base counts0 plus applicantUser/auth/requests/invites/occupancies/overrides/audits0. No database grants changed. IAB14closed, API/Next stopped,5owncontainers stopped/preserved, all reserved IPv4/6ports free. Runtime released; source clean at55856362b. This baseline is frozen for coordinator review/capture; runtime/repair requires next exact scope.

## September 21 D07 Requests decline — source-only reconciliation

PR123 original178b4a17854b56de6b1ace25b58d26d4ea8289e3 [CI35588215044](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35588215044) passed; coordinator merged55856362bd736355616da740ff2fda8b8a5fd01c and captured prior frozen live02 hash30274412 in005d3e645. Adopted that exact master on separate `codex/home-request-decline-verification`;123 refs preserved, worktree clean. Earlier queued sentence below is historical captured handoff.

- Existing standalone Requests decline→SDK rejectHouseholdAccessRequest→home.js reject route→homeInvitationService.write→write_home_invitation traced. SQL current authority/exact source/nonpending/replay gates, atomic rejected status/resolver/audit and no membership grant already exist; actual list uses list_home_household_requests.48source/ref bindings across8paths and6current/archive/open refs:43present/5historicalmissing; decline handler identical across all6. No competing repair or justification for replacement/new implementation.
- Unguarded awaited decline confirmation is source-only concern, not reproduced defect. Accepted123 role lifetime and invitation sender/recipient/SQL contract evidence reused within limits. Earlier Requests503 was private fixture stubbing invitation service, not application failure. Existing invitation fixture patterns can enable actual service/RPC with synthetic identity and intercepted notification transport.
- Proposed coordinator scope: only owned18141/18142/64550–59; real request creation/list/decline through existing caller/route/service/PostgREST/SQL; exact new synthetic applicant/no membership. Runtime private loader must intercept dynamic notification requires for its lifetime and block provider/unrelated writes. UI pending-list200 first; current Cancel/noPOST then same-document departure/confirmation observation and full request/audit/occupancy/invite snapshots. Report actual baseline before any repair. No app edit/runtime start/native/new unit test yet.
- Durable source proposal: owner `.pantopus-recovery/audits/20260921-stream2-request-decline-source-r1/`,10files plus manifest (8sources,48bindings and scope). Source comparison/fixture proposal only; no new acceptance. Exact cleanup plan included. Runtime remains released; coordinator runtime/repair scope pending.

## September 21 D07 role-confirmation lifetime — reviewable repair

**Current: published, required CI queued; stream incomplete.** `codex/home-member-confirmation-lifetime` clean/pushed at **`178b4a17854b56de6b1ace25b58d26d4ea8289e3`**, [draft PR123](https://github.com/WangPantopus/skinny-pantopus/pull/123), final-master b409 base. [Exact CI35588215044](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35588215044) queued; no green claim. Coordinator exact top-README caller-only grant followed; earlier frozen baseline below is preserved unchanged.

- Sole existing standalone `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`,16 additions/3 deletions. Track owned dialog identity; existing retire/unmount dismisses only that matching dialog. Capture generation/token/API origin/session marker before awaiting confirmation; reject stale continuation before POST and stale completion before toast/list refresh. No shared store/dialog, role/permission policy, layout/navigation, SDK/backend/schema/new application file or unit tests changed.
- Reused accepted15-artifact actual baseline and25ref source comparison: global old role dialog persisted after /members→/edit departure and posted200, changing Guest→Admin/one audit from Home Settings. No baseline rerun. Accepted121 five-role/Cancel/permission evidence reused.
- Candidate actual IAB13→SDK→IAM/authority→PostgREST/SQL: one normal current confirmation→one POST200/Admin/one audit. Subsequent open confirmation→BrowserForward /edit closes it immediately, no newPOST, full HomeOccupancy/HomeAuditLog snapshots identical. BrowserBack returns to fresh caller; new confirmation's current permission403 remains visible/full rows unchanged; remove exact override and retry→200/Manager. Normal/current/error paths remain usable.
- Related submitted-request lifetime: one current Member command sent before departure; real saved200 reply held6,003ms and delivered to intact socket after BrowserForward /edit. No former-caller occupants refresh occurred after held response; destination stayed Settings at observation. Returning loaded saved Member. This does not cancel or roll back an already-submitted command. Success-toast nodes were absent at post-delivery observation; no continuous transient-toast timeline is claimed.
- Validation: TypeScript exit0, scoped lint exit0/0errors15existingwarnings, diff clean. Four candidate rolePOSTs200/403/200/200. No new tests, large duplicate role suite or native build. Required current CI remains necessary. No actual other-dialog/session race, late-error reply, hosted/native or explicit-selector acceptance. Synthetic identity and local fixture/6second delivery timing; baseline incidental dashboard/private queue limits remain explicit. Local ledger55; complete current replay in CI.
- Cleanup: all12 base table/object counts0, two extra User/authUsers0, occupancies/overrides/audits0; original empty fixtures restored and no DB privileges changed. Owned tab13 closed, API18142/Next18141 stopped; all5owned r1 containers stopped/preserved; all reserved IPv4/6 ports18141/18142/64550–64559 free. Temporary lint symlink removed and held reply consumed. No peer/native resources touched. Runtime released.
- Durable candidate: owner `.pantopus-recovery/audits/20260921-stream2-member-confirmation-candidate-r1/`,18files plus flat manifest; exact page/probe/fixture, normal/departure/full-row/current-error/delayed-response proofs, validation and cleanup. Prior separate baseline15files remain frozen/reused. Credentials and raw operator logs excluded.

**New repair handoff frozen for coordinator capture.** Coordinator owns review/integration and shared disposition; prior baseline section is not rewritten. No broad D07 completion claim or further app/runtime changes.

## September 21 D07 role-confirmation lifetime — verification resumed

Adopted independently verified final master `b409bc9190dd43bbdcee0cdba8f307ae959d2dc3` on separate `codex/home-member-confirmation-lifetime`; prior121/privacy refs preserved. PR121 and119 merge states independently checked. Existing confirm-store, global dialog/root layout, standalone caller and accepted MemberDetail guards compared across five refs (25bindings). Global dialog is mounted outside route children; no general pathname cleanup found, only unrelated ConversationView cleanup. This is source evidence only until actual departure behavior is reproduced.

Existing standalone role-cycle/permission acceptance is reused. Runtime verification-only grant; no app edits/new UI/test/native scope. Own18141/18142/64550–59 checked free and five stopped owned r1 containers identified before restart. Private existing fixture/actual member contracts reused, synthetic sign-in/ancillary queue limits retained. Exact fixture/audit cleanup required.

**Actual confirmation lifetime failure reproduced:** IAB12 opened Guest→Admin on standalone /members. Existing Home Settings navigation had created a same-document /edit history entry; Browser Forward departed there with confirmation still open. Clicking its remaining Set as Admin sent the old role POST200, persisted target Admin/one audit and displayed success toast on Home Settings. Existing global ConfirmDialog sits outside route children and has no pathname retirement. Exact response/SQL in private member-confirmation-baseline.json. Incidental sidebar Members routes to dashboard (unsupported in this fixture); that navigation is excluded and history returned to the true standalone caller before baseline. No app edits yet. Proposed sole existing standalone page: retain identity of its own role dialog and dismiss it through existing retire/unmount only when still owned; capture current generation/token/origin/session before awaiting confirmation and reject stale continuation before POST. Do not change shared store/global UI, normal confirmation, permissions or cycle. Await coordinator exact path grant; source map25bindings and accepted MemberDetail lifetime convention reused.

**Verification-only checkpoint frozen for coordinator review:** no application edit or new commit; clean branch at b409bc919. Repair proposal above remains pending. Baseline preserved at owner `.pantopus-recovery/audits/20260921-stream2-member-confirmation-baseline-r1/`,15files plus flat manifest, including exact five source files,25ref bindings, real POST200/SQL/audit and full before/after snapshots. No new tests or repeated121 role journeys. Exact cleanup restored empty state:12base counts0, extra2users/auth0 and occupancy/override/audit0. No database grant changes. Tab12/API18142/Next18141 closed; all5owned r1 containers stopped/preserved; IPv4/6 ports18141/18142/64550–64559 free. Runtime released while awaiting the exact caller-only repair grant; do not repeat this accepted baseline when candidate verification resumes.

## September 21 D07 standalone role cycle — reviewable handoff

**Current: published, original-head required CI passed; stream incomplete.** Clean/pushed `codex/home-standalone-member-role-verification`, **`dc9611bc621237271928d7c35e63345308ae236a`**, [draft PR121](https://github.com/WangPantopus/skinny-pantopus/pull/121), final-master0d6a1f57b base. [Exact CI35583917301](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35583917301) completed SUCCESS at dc9611bc621237271928d7c35e63345308ae236a: production web build, web lint/typecheck/existing tests, Identity Firewall, safeguards, full database replay and CI OK passed; backend/native/seeder path-skipped. Read and followed coordinator exact cycle grant91b3dff34; prior privacy feature refs preserved.

- Sole application change: one existing line in `frontend/apps/web/src/app/(app)/app/homes/[id]/members/page.tsx`. Keep current role in the nonowner cycle before locating its index. All existing controls/confirmation/design/navigation, members.manage and canonical server policy remain unchanged. No SDK/backend/schema/new file or unit tests.
- Baseline: actual standalone IAB11 Guest→Admin→Manager→Admin, persisted/audited. Initial private mounted-path receipt filter missed HTTP logs; preserve first3 UI/SQL observations with that limit. After correcting only private filter, repeated Admin→Manager→Admin captured two exact SDK POST200 replies with saved role/role_base and audits. Source-only30ref comparisons reused; six final-master path hashes unchanged from prior reconciliation. Existing role implementation repaired in place.
- Candidate real browser→SDK→IAM→authority RPC→PostgREST/SQL: five UI role transitions Admin→Manager→Member→Restricted→Guest→Admin all200 and saved/audited exactly. Cancel yields noPOST. Withdraw actor members.manage after confirmation opens→403/error toast; full HomeOccupancy and HomeAuditLog snapshots unchanged. Restore exact override→retry200/Manager. Nonowner without grants gets occupants403/no role controls; owned nonowner manager with explicit members.view/manage gets equal-rank403 and unchanged full rows. Owner makes target Member; same nonowner manager then changes it to Restricted200, correct audit actor and full reload displays Restricted. Ten candidate rolePOSTs (eight200/two403), plus Cancel and ungranted-read controls.
- Reused accepted MemberDetail and server authority evidence, without broad duplicate route reruns. TypeScript exit0; scoped lint exit0/0errors15existingwarnings; diff clean. Initial lint invocation from repository root found no web config; reran correctly from web and removed exact temporary symlink. No new tests. Current full CI remains required.
- Limits: synthetic sign-in and exact fixture grants, actual member permissions/services/SQL. Unrelated private fixture access-request queue503 excluded; no queue acceptance. Local ledger55, complete current replay in CI. No native/hosted, explicit role chooser, stale-confirmation/session or concurrent role-write acceptance; D07 as a whole remains open. This corrects the existing cycle only.
- Cleanup: original empty state restored; all12 base fixture/object counts0, two extra users/authUsers0, all owned occupancies/overrides/audits0. No database privilege changes. API18142/Next18141 stopped, tab11 closed; all5owned r1 containers stopped/preserved; IPv4/IPv6 probes18141/18142/64550–64559 allfree. Temporary lint symlink removed; no native/peer resources touched. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-standalone-members-r1/`,24files plus flat manifest: old/new page, source map/bindings, corrected baseline and initial limits, UI/request/SQL records, full-row denial proof, private fixture/runner, validation and cleanup. Credentials and raw operator logs excluded.

**Handoff captured/pushed in coordination `8fe4195cd` at frozen SHA256 6b0045953ab043a2fd18777f16a02f2b910d8f222e1f9573f158698c8b3ed8b2.** Coordinator independently reviewed all24 artifacts, ten POSTs, both full-row denials, Cancel and cleanup, and confirmed original-head CI. This status-only update records that final result. PR121 source and released runtime remain frozen through the coordinated PR120→121→documentation119 batch after paid a795 fullCI35582693975. No repeated role journey, broad completion claim, new application repair or runtime acquisition.

## September 21 D07 standalone Members role verification resumed

Coordinator released the hold after PR114–118 and documentation113 merged. Independently verified master `0d6a1f57b19ddebbaa78df1485546903929aca39` and PR118/113 merge states. Correct application worktree now uses separate `codex/home-standalone-member-role-verification` at final master, clean; prior local and remote privacy refs preserved and both repaired privacy files byte-identical. Existing30path/ref D07 source map reused, not counted as reproduction.

Current scope: actual standalone Members → SDK role POST → current IAM/authority service → canonical SQL; no application edit/new UI/test until failure and exact-path proposal. Existing screen and members.manage permission differences preserved. Own ports18141/18142/64550–59 checked free, five stopped owned r1 containers identified and reacquired. No peer/native resources changed. Private fixture removes its obsolete navigation-permission stub before baseline so /me uses the actual policy. Synthetic sign-in and unrelated provider boundaries remain explicit.

**Actual D07 baseline:** existing Change role UI moved owned target Guest→Admin→Manager→Admin; SQL and3chronological audits matched. Initial private HTTP logger used mounted req.path and missed exact status receipts; this limitation is retained. After correcting only private filter to originalUrl, repeated Admin→Manager→Admin yielded captured2POST200 with exact persisted role/audits. Canonical occupants and /me use real policy/services; unrelated access-request queue503 is a private-fixture limitation, not an app failure. Lower roles remain unreachable through the cycle. Proposed existing standalone members/page.tsx only: retain all nonowner roles before locating current index; preserve current confirmation/layout/navigation and members.manage. No replacement selector/UI/service/schema/new file/test. Explicit role-choice product requirement remains separate. Await exact grant.

## September 21 D06 privacy partial-write repair — reviewable handoff

**Current: published, original-head required CI passed; stream incomplete.** Separate `codex/home-privacy-write-verification` is clean/pushed at **`1ad1a06933e8e2debe5a947b8b5611ed7820421c`**, [draft PR118](https://github.com/WangPantopus/skinny-pantopus/pull/118), stacked on frozen PR11699e0. [Exact CI35579547138](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35579547138) completed SUCCESS: safeguards, backend privacy/Jest, Docker, full schema replay and CI OK; web/native/seeder path-skipped. Current live README exact route grant followed. Coordinator owns integration/merges.

- Sole application path: existing `backend/routes/homePrivacy.js`,5 additions/3 deletions including two stale comments. Capture and throw existing-row read error before default merge/upsert. Successful absence, permissions, validation and error envelope retained. No service/schema/UI/new file or unit test changes.
- Baseline: actual API saved address_precision/photo_blur/vault_auto_lock=true. Persistent SELECT denial caused PATCH500 and unchanged SQL (negative control). Actual PostgREST SELECT403 with controlled restoration of original SELECT before handing the real response to the route allowed PATCH200 `{map_opt_out:true}` to reset all three unrelated saved values to false. Unmodified database response bodies and actual persisted rows; recovery timing and identity synthetic. Twenty source/ref comparisons across current/master/paid/workstream/staging; route identical. Existing implementation repaired in place.
- Candidate:13 actual HTTP→current permission/route→PostgREST→SQL cases passed. Persistent denial and repeated recovered-read denial now stop before any upsert and preserve the entire row, including updated_at. Retry200 preserves unrelated true restrictions; explicitfalse updates only address_precision; current security.manage denial403 and three invalid payload400s preserve SQL; denied INSERT after a successful read500 preserves SQL and restored write retry200 succeeds; genuine absent row initializes unchanged defaults plus supplied map_opt_outtrue. Native/web UI not exercised: no current web toggle caller or available native control. No invented UI acceptance.
- Verification:8 existing homePrivacy checks passed with normal force-exit flag, exit0; syntax/whitespace checks passed. No new tests. PR116 Place UI/service evidence reused within its unchanged source limits. Concurrent partial writes, native seeded defaults/stale responses, hosted/provider and broader toggle consumer behavior remain open. Local schema ledger55/unchanged HomePrivacy; current complete schema replay remains required CI.
- Cleanup: all11 base table counts0, HomePrivacy0, authUser0 and owned Storage objects0. Original SELECT and INSERT restoredtrue. API closed; web/native unused. All five owned r1 containers stopped/preserved; IPv4/IPv6 probes show18141/18142/64550–64559 allfree. No peer resource changes. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-privacy-write-r1/`,11 files plus flat manifest; baseline/candidate HTTP/SQL/PostgREST receipts,20source comparisons, exact old/new route, private reproducible probe/fixture, existing-regression receipt and cleanup. No credentials or raw operator logs copied.

**Handoff captured/pushed in `ed73b0ce4` at frozen SHA256 db729875; this update records final original-head CI.** Hold additional application changes/runtime restart until next bounded scope; D06 remains incomplete. D07 standalone Members is the next available actual-browser alternative, separate from concurrent PATCH/native limitations.

**Independent D07 reconciliation during integration hold (source-only):**30source/ref comparisons across the standalone Members page, existing MemberDetail, SDK, Home IAM route, safe member projection and authority service. Canonical list supplies current role and role_base together; standalone cycle removes that current role before indexOf, so source predicts admin/manager rather than deliberate selection. Existing MemberDetail already has explicit five-role controls and accepted recovery/lifetime evidence, but its owner-only action gate differs from standalone members.manage, so reuse needs a deliberate compatibility decision. Existing role POST/SQL transaction owns authority/rank/age/owner/access-window checks. No new browser baseline, UI acceptance, repair or runtime acquisition. Private source map `.stream2-verification/d07-source-reconciliation.json`. Next actual standalone browser journey and any UI choice require coordinator scope after current integration batch.

## September 21 D06 privacy partial-write verification

Verification-only grant after PR116 evidence capture. Separate `codex/home-privacy-write-verification` starts at unchanged99e0cba3; PR116 remains frozen. Existing route, native caller and schema contracts compared. Actual HTTP/SQL only: no available web toggle caller or native control; no invented UI acceptance. Owned18141/18142/64550–59 listeners checked free and five owned stopped r1 containers identified before reacquisition. No application edit until reproduced persistence failure and coordinator path grant. Distinguish persistent SELECT denial (which can also block upsert) from a read failure followed by recovered write availability; preserve original rows/grants. No native slot or new unit tests.

**Reproduced actual HTTP/SQL failure:** saved address_precision/photo_blur/vault_auto_lock=true. Persistent SELECT denial made PATCH500 and unchanged SQL (explicit negative control). Second actual PostgREST SELECT403 was followed by restoring original SELECT before the route received that response; the same PATCH `{map_opt_out:true}` returned200 and reset all three unrelated saved values to false. No fabricated database response: only recovery timing was controlled in the private fetch harness. Existing route discards the SELECT error and merges defaults before actual upsert. Both API response and SQL prove changed persistence. After probe all11 base table counts0 plus HomePrivacy0 and original SELECT true; API stopped, owned containers remain running pending coordinator disposition. Proposal: existing `backend/routes/homePrivacy.js` only, check/throw existing read error before merging/upsert, retaining genuine-absence defaults and existing error envelope; correct its stale read fallback comments in that same path. No service/schema/UI/new file/unit test. Awaiting exact application grant. Private evidence `.stream2-verification/privacy-write-baseline.json`, source comparisons and reproducible private probe.

## September 21 D06 privacy read failure — reviewable handoff

**Current: published, exact original-head CI passed; stream incomplete.** `codex/home-privacy-read-verification` is clean/pushed at **`99e0cba3a73040e3e6c6bcfeefa9a65ad6ccc814`**, [draft PR116](https://github.com/WangPantopus/skinny-pantopus/pull/116), based on integrated master721d46e6. [Exact CI35578111441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35578111441) completed SUCCESS, including backend/Docker/safeguards/full database replay; web/native path-skipped. Coordinator grant21f42c142 names this service only; prior integration heads remain untouched.

- Sole changed application path: existing `backend/services/homePrivacyService.js`,10 additions/23 deletions including stale fallback comments. Database/transport read failures now propagate to existing callers; successfully absent rows retain defaults. No route/PATCH/UI/schema/new file/unit test change.
- Baseline: real API PATCH saved `address_precision=true`; SQL true and actual Place header omitted the synthetic unit. Denying service-role SELECT on HomePrivacy made actual browser intelligence200 expose `Unit PRIVATE41`; GETprivacy200 falsely returned false while SQL remained true. Restoring SELECT restored restricted rendering. Thirty current/archive/open-branch source pairs compared; privacy service is identical across all six refs. Existing implementation is repaired in place.
- Actual browser → SDK → primary/list/current permissions → intelligence route/composer/privacy service/serializer → PostgREST/SQL: candidate read denial returns500 from privacy and intelligence; Place displays its existing error/retry without address/unit. Repeated UI retry remains safe. Restore SELECT and retry →200 and saved true hides unit. API-saved false →200/browser reload displays unit by existing policy. Exact row deletion/count0 → defaultfalse200/browser default behavior. Recreating true through existing PATCH →200/readtrue/browser hides unit again. No design change.
- Verification:33 existing checks in homePrivacy and Place endpoint suites passed, syntax and whitespace checks passed. No new tests. The local Jest process retained open handles after its passing115-second summary and was stopped; no clean local process-exit claim. Required CI uses the existing normal force-exit command. First silent runner was interrupted, and the rerun disabled Watchman. No unrelated runner/cache repair.
- Limits: synthetic sign-in and unavailable unrelated provider groups, actual Home/Place services and SQL. The initial private adapter setup500 is excluded from app-defect evidence. Local ledger55 contains unchanged HomePrivacy; full current replay remains CI. Independent transport disconnect, native seeded-default fallback, ignored-read PATCH, other privacy controls, outsider, provider and hosted boundaries are not newly accepted. D06 as a whole remains open.
- Cleanup: all12 owned fixture table/object counts0 plus HomePrivacy0; original SELECT restoredtrue. API18142/Next18141 stopped, all five owned r1 containers stopped/preserved, all18141/18142/64550–64559 ports free, owned browser tab10 closed. No native slot or peer resource changes. Runtime released.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-privacy-read-r1/`,14 files plus flat manifest; exact service,30 comparisons, baseline/candidate HTTP/UI observations, existing-regression receipt, private fixture definitions and exact cleanup. Credentials and raw operator logs excluded from Git/chat.

**Handoff captured in coordinator commit `d4ce6c85a`; prior frozen SHA256 bf9c9c5b verified.** Coordinator owns review, integration and merges while the paid combined gate runs. Next independent work may reconcile existing ignored-read PATCH/native fallback leads; no additional application path, schema or native repair is authorized by this milestone. Reuse unaffected accepted evidence; do not repeat the baseline.

## September 21 D06 restrictive Home address privacy — verification resumed

**Current: verification only; no application edit.** Coordinator released the integration hold after PR110/111/112 and documentation PR106 merged with exact-head CI. Own clean application worktree now uses separate branch `codex/home-privacy-read-verification` at final master `721d46e6d2ad6bfc1e67ea70b375d7b2d129d9f0`; frozen feature refs are preserved. PR106/112 merge SHAs and CI35576403371 success independently verified. Earlier accepted Home repairs remain source-bound and are not repeated.

Read the current live README grant, handoff and own status. D06 scope: existing Place consumer/caller with restrictive saved Home address privacy, real SQL read denial and recovery. Compare HomePrivacy policy/service/route/SQL and preserved evidence before proposing any repair. Existing web settings/security is an ownership-policy surface, not HomePrivacy toggles. No new unit tests, redesign, native build, backend/schema edit or application repair is authorized until the actual failure and exact paths are presented to coordinator.

Runtime reacquired after ownership/listener checks: web18141/API18142 and the five existing r1 containers on64550–64559. No peer/native resource changes. Synthetic sign-in and unavailable unrelated provider groups; actual Home primary/list services, Place UI/SDK, current permissions, intelligence/privacy routes, address serializer and PostgREST/SQL. Own local ledger55 includes the unchanged HomePrivacy table; current full-schema replay remains a CI boundary.

**Actual failure reproduced:** existing API PATCH `address_precision=true` saved200; SQL remains true. Existing Place header omits fixture unit. Denying only service-role SELECT on HomePrivacy makes the same browser reload return intelligence200 and display `Unit PRIVATE41`; GETprivacy also returns200 with false. Restoring SELECT restores the restricted header. Grant is restored now. Thirty current/archive/open-branch source pairs compared; earlier audit noted the source concern but did not establish this UI journey. Baseline receipts and exclusions are private in `.stream2-verification/privacy-baseline-evidence.json`.

Proposed exact repair, awaiting coordinator grant: existing `backend/services/homePrivacyService.js` only; propagate read errors to both existing caller error handlers, preserve defaults on genuine missing row. No screen or schema change. Native load-default fallback and ignored-read PATCH are separate source leads and not claimed fixed; no installed-native acceptance. The initial private fixture adapter setup500 is excluded from application-defect evidence.

## September 21 D05 optional settings clearing — reviewable handoff

**Current: published, original-head CI passed; integration held with coordinator; stream incomplete.** Separate authorized branch `codex/home-settings-clear-fields` is clean and pushed at **`22d2bc91e9037b92c441f7e6bd19c00f42811259`**, [draft PR112](https://github.com/WangPantopus/skinny-pantopus/pull/112), stacked on PR110. [Exact CI35574730971](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35574730971) completed SUCCESS: six applicable checks passed and five path-based skips, including the production web build, existing web tests/lint/typecheck, Identity Firewall, safeguards and full database replay. This applies to original head22d2bc91e; subsequent integration-head CI belongs to the coordinator. The coordinator merged PR109 at `c7755c345d14de9b13be81171b141c9c0156bbc6` after updated-head CI35574099206 passed. PR110's original CI passed; its updated `33414dda8` CI35574554620 is running. Remote predecessor branches were not overwritten.

- **Evidence correction:** earlier welcome/rules/other-textarea clearing claims in progress notes were invalid: browser `fill('')` did not change controlled textarea values. DOM readback and request receipts caught this; all six candidate lines were reverted before the genuine baseline. Those text-field claims are excluded and their failed-driver traces retained. The trash-day select-empty baseline was valid. Previous committed read/save/coordinate evidence does not rely on empty-textarea clearing and remains separate.
- Corrected baseline: keyboard select-all/Backspace cleared five textareas, and the trash-day selector was set to empty. DOM readback confirmed all six empty before Save with unchanged source. Actual profile200/settings200 requests omitted all six keys and restored the old values. Six branch comparisons plus the existing validator/SQL establish that present empty strings are accepted; no new implementation or migration is needed.
- Sole changed path: existing `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx`, six additions/six deletions. Send explicit trimmed empty text/day values for `house_rules`, `parking_instructions`, `entry_instructions`, `trash_day`, `local_tips`, and `guest_welcome_message`. Existing controls, defaults, PATCH order, and partial-save semantics are preserved. No backend/schema/new file/unit test/design change.
- Actual UI → SDK → canonical permission/route/existing RPC → PostgREST/SQL: six empty draft values; deny `home.edit` → profile403/no settings write, draft retained and prior SQL values unchanged. Restore authority, then submit local tips of 10,001 characters → profile200/settings400, draft retained and all six SQL values unchanged. Keyboard-clear the invalid text and retry → two200 replies with six explicit empty strings; SQL confirms all six cleared, defaults24h/members unchanged. Full reload retains five empty textareas, trash Not set, and unchanged defaults.
- Validation: typecheck zero errors, scoped lint zero errors/seven warnings, whitespace check clean; required CI runs existing checks. Synthetic identity/ancillary dashboard and local provider boundary remain explicit. Native, hosted, and unrelated save-lifetime boundaries remain unverified; accepted unaffected journeys are reused.
- Cleanup: all12 fixture table/object counts zero. API18142 and Next18141 stopped; all five owned r1 containers stopped and preserved. Ports18141/18142/64551/64552 have no listeners. Owned browser tab9 closed, temporary lint symlink removed. No native slot, peer resource/cache deletion, or shared-runtime change. Runtime grant released to coordinator; private credentials/fixtures remain ignored and uncommitted.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-settings-clear-r1/`,17 files plus flat manifest. Includes exact source, corrected baseline, excluded driver traces, six-field comparisons, HTTP/SQL receipts, validation and cleanup.

**Handoff captured:** coordinator documentation commit `f60ce94e516e4363164e2db2ac2e2d977b439c4d` preserves the prior frozen snapshot and verifies all17 artifacts. This status-only update records final original-head CI. Application source and runtime remain held during the coordinator’s PR110 → PR111 → PR112 integration sequence. D05/D06/D07 leads remain open; no repeated baseline, extra repair, runtime restart or shared-backlog change is authorized by this update. The coordinator owns integration and shared disposition.

## September 21 D05 Home editor coordinates — reviewable handoff

**Current: published, CI queued; stream incomplete and continuing.** Granted separate branch `codex/home-edit-coordinate-read`, clean/pushed **`e50ed198723030208c4cf7016dc8561fee916436`**, [draft PR110](https://github.com/WangPantopus/skinny-pantopus/pull/110) stacked109. [Exact CI35574072291](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35574072291) queued. Sole existing `frontend/apps/web/src/app/(app)/app/homes/[id]/edit/page.tsx`:3parser lines plus finalnewline; no presentation/SDK/backend/schema/newfile/unit test.

- Reproduced actual canonical Home detailGET200 returned `{longitude:-122.33,latitude:47.61}` with savedSQLPOINT; editor fullreload falsely claimed No coordinates. Six source/branch parsers only handledGeoJSON/WKT. Extend existing localparser with finite-number canonicalobject branch; no exported existinghelper available, no replacement architecture.
- Actual UI→canonical Home detail/current permission service/route→SQL: valid47.61/-122.33 fills existing inputs; currentverified-coordinate UI replacement48/-123 is stripped by unchangedserverguard and originalpointreloaded; user_assertedSQL0/-12.34 displays correctly; UIlatitude0/longitude-75.5 saves200 and SQLmatches; invalid91→400/retaineddraft/SQLunchanged. DeliberateSQLNaNpoint→canonicalGET503 beforeform; existingerrornavigation leads/homes, whose listisunsupported infixture and excluded. RestoreSQLNULL→actual200/original emptycoordinates state. LegacyGeoJSON/WKT branches unchanged/reused, not synthetically re-tested.
- Typecheck0errors, scopedlint0errors/6warnings, diffclean. Syntheticidentity, deliberatemalformedSQL, localprovider; native/hosted/geocoder and full unrelatedHomeslist recovery remain unverified. Reuse previoussave/authority/provenance evidence.
- Cleanup12fixturecounts0, API18142stopped, Next18141/own5containers retained; lintsymlinkremoved, no native/peerresource changes. Durable owner `.pantopus-recovery/audits/20260921-stream2-home-edit-coordinate-r1/`12files+flatmanifest, exactsource/comparison/baseline/browser+HTTP+SQL/validation/cleanup.

**Handoff frozen for coordinator capture.** Nextgranted work: existing HomeSettingsTab optional-clearing payload after eachfield's actualfailure and canonicalcontract are established. Welcome/rules already reproduced bothcalls200 with oldvaluesreappearing; othertext/day fields require own baseline beforeinclusion. Preserve all existingcontrols/PATCHorder/partial-save semantics; no save-lifetime/schema extension. PR109 and thissource remain frozen while coordinator integrates.

## September 21 D05 settings save contract — reviewable handoff

**Current: published, CI queued; stream incomplete and continuing.** Granted follow-up branch `codex/home-settings-save-contract`, clean/pushed **`cb29cef1eff41802c0d0a6458b9203590267fce3`**, [draft PR109](https://github.com/WangPantopus/skinny-pantopus/pull/109), stacked on PR108. [Exact CI35573559457](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35573559457) queued. PR108 original39ced [CI35572724323](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35572724323) passed; coordinator owns integration. PR104 merged by coordinator after d304f08df CI35572440658 passed, component unchanged.

- Paths: existing `frontend/packages/api/src/endpoints/homes.ts`, `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx`, `frontend/apps/web/src/app/(app)/app/homes/[id]/settings/page.tsx`; total5 additions/3 deletions. No backend/schema/newfile/unit test/layout/navigation change.
- Failure/reuse: dashboard Save actualPUT404, edited name omitted; legacy nickname editor actualPUT404/unchangedSQL, after method correction its public_info payload actualPATCH400. Canonical existing PATCH validator accepts name; native iOS/Android already sendPATCH/name.24 source/ref pairs and all5 SDK callers compared. Shared updateHome nowPATCH, existing input type admitsname/null, both editors sendcanonicalname. Other SDK methods/current permission/location provenance policies preserved.
- Actual browser cases: legacy name save200→SQL/fullreloadmatch; whitespace nickname produces no write;121chars400 specific validation/retaineddraft; actual home.edit denial403 safe message/SQLunchanged; restore/sameUIretry200. Dashboard profilePATCH200 then existing atomic settingsPATCH200 savedname/type/8hexpiry/welcome/notifications, SQL and fullreloadmatch;121chars400 and permission403 stop before secondcall with unchangedSQL, restore/retry200. Existing Home edit page savedname/type/bedrooms3/bathrooms2/sq_ft1500/year2000→UI success, route200 and SQLmatch.
- Affected LocationPicker/QuickModifiers source callers unchanged: exact locationpayload exercised through realHTTP/SQL→200 user_asserted; invalidlatitude400 unchanged; currentpermission403 unchanged; existingverifiedcoordinate guard strips replacement while allowing independentname. This is route/payload regression, not either full geocoder UI/provider journey.
- Typecheck0errors, scopedlint0errors/18warnings, diffclean; required CI runs existing suites, no newunit tests. Identity/ancillary dashboard synthetic; real Home detail/service/permission/validator/routes/RPC/PostgREST/SQL. Native/hosted/provider boundaries remain open. Existing two-call save transaction scope and optional-clearing/lifetime behavior unchanged, not newly accepted.
- Cleanup12fixturecounts0; no remainingpermissionoverride, ownedAPI18142 stopped; Next18141/own5containers retained for nextslice; temporarylintsymlinkremoved, no native/peerresources. Durable owner `.pantopus-recovery/audits/20260921-stream2-home-settings-save-r1/`17files+manifest, exact3sources/24comparisons/baselines/UI+HTTP+SQL/validation/cleanup.
- New separately reproduced lead: after real route storedverifiedcoordinates, existing Home edit reload says No coordinates. Actual canonicalGET200 returns `{longitude:-122.33,latitude:47.61}` but localparseLocation accepts onlyGeoJSON/WKT. No edit made for this lead. Propose small extension of existing parser, after existing-source comparison, with realread/UI verification and unchanged coordinateprovenance guard; coordinator grant pending.

**Handoff frozen for coordinator capture.** Continue bounded Home backlog; coordinator handles sharedSDK integration/merge/backlog disposition. Do not overwrite reviewer-owned predecessor branches.

## September 21 D05 settings reads — reviewable handoff

**Current: candidate published; stream incomplete and continuing.** Authorized separate branch `codex/home-settings-read-recovery`, clean/pushed at **`39ced0c27b95850a148b12a6b76fb34031cd9293`**, [draft PR108](https://github.com/WangPantopus/skinny-pantopus/pull/108) stacked on member follow-up. Only existing `frontend/apps/web/src/components/home/settings/HomeSettingsTab.tsx` changes (22 additions/7 deletions). [Exact CI35572724323](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35572724323) queued; no green claim. Coordinator merged PR102 after updated3de541d72 CI35571953892 passed. PR104 originaldeda CI35571776785 passed; coordinator owns its remote master update and integration. Neither integration branch was overwritten.

- Reproduced actual GET settings503 by denying owned HomePreference SELECT: form exposed default48h, blank welcome/rules and two enabled Save buttons despite SQL24h, saved welcome/rules and disabled notification preferences. Six current/master/paid/staging/place/archive sources share the silent catch. Existing ErrorState/failureMessage are reused; no new application file/service/schema/design/test.
- Repair: explicit load failure/retry; loading/failure blocks Save; asynchronous reads scoped to Home, current edit authority and component lifetime. Existing successful screen and save protocol preserved.
- Real browser→SDK→canonical homeIam/current permission helper→PostgREST/SQL: repeated503 with zero Save controls; restored SELECT plus UI retry recovered24h, welcome/rules and all5notificationsfalse. Removing exact disposable preference row then fresh load returned200 with notifications defaulttrue and saved Home fields intact. Actual home.view deny returned403/explicit denial/no save; restored access allowed retry. Held real successful200 while Loading, navigated Share, released on live socket: Share remained; changed owned SQL8h/new welcome and reopened Settings→current values. This is departed-panel/fresh-load evidence, not concurrent same-mounted Home/account response-order acceptance.
- Validation: web typecheck0errors, scoped ESLint0errors/7warnings, diffcheckclean. No new unit tests; required CI runs existing checks. Synthetic identity/ancillary dashboard, deliberate delay, local provider boundary; native/hosted/account-switch unverified. Earlier accepted guest/member/audit evidence reused unchanged.
- Separate save baseline: changing Home Name and clicking Save issued SDK PUT `/api/homes/:id`→404; canonical server route is PATCH, SQL unchanged. Name is omitted from the dashboard caller payload. This remains a subsequent bounded repair; this read PR does not establish successful saving. Shared SDK/schema remain untouched pending coordinator scope.
- Cleanup:12base fixture row/object counts0 plus HomePreference0/HomePermissionOverride0; original SELECT grant restoredtrue. API18142 stopped, delay released; Next18141/owned5containers retained for next Home scope, no native slot/peer resources touched. Temporary lint symlink removed.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-settings-read-r1/`,15files plus manifest, binds exact source/comparisons/baseline/candidate/HTTP/delay/validation/cleanup. No credential files or raw operator logs committed or shared.

**Handoff frozen for coordinator capture.** Next: compare canonical profile/settings contracts and all shared SDK updateHome callers, then propose minimal method/payload repair to coordinator. No migration justified or granted, no shared SDK edit yet. Continue backlog after this milestone; coordinator owns merges and shared disposition.

## September 21 D07 member permissions — reviewable handoff

**Current: candidate published, exact-head CI running; stream incomplete and continuing.** Per coordinator direction the assigned Home worktree now uses separate follow-up branch `codex/home-member-permission-recovery`, clean/pushed at **`deda07ecf57f5cf9d8e052e1215782afd60db790`**, [draft PR104](https://github.com/WangPantopus/skinny-pantopus/pull/104) stacked on PR102's branch. Only existing `frontend/apps/web/src/components/home/members/MemberDetail.tsx` changes (85 additions/63 deletions). Do not overwrite coordinator-updated `origin/codex/workstream-home`. [Exact CI35571776785](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35571776785) running; prior audit50289 [CI35570755239](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35570755239) completed SUCCESS, but its master update/integration belongs to coordinator.

- Baselines: actual HomeRolePermission SELECT denial caused real permissions500; panel claimed No specific permissions assigned with Admin Actions enabled despite3 saved permissions. Separately held real MemberA200/member3, close/open GuestB200/guest1, delivered oldA200 on live socket: B name stayed but role/summary/controls became member3. Six current/master/paid/staging/place/archive sources shared the catch and lacked lifetime guards.
- Repair: reuse existing ErrorState/failureMessage for explicit read/retry and hide controls until permissions load; scope reads and all existing asynchronous mutation completions to current panel/member/Home/owner authority. Preserve role choices, successful layout, removal navigation, backend policy and schemas. No new files/unit tests or speculative role-cycle change.
- Actual browser→SDK→homeIam/current permission helper→authority service/PostgREST/SQL: repeated read500 with no admin controls; Enter after restored SELECT returns correctmember3. Intact delayed A200 cannot overwrite Bguest1. UI GuestB→member saved; withdrawn actor members.manage→role403 with canonical message and unchanged SQL; restore→same control savesguest. Existing EditTasks checkbox persisted false then true. MemberA manager save200 held after SQL commit; close/openB; release old mutation200 leaves B panel open/guest/editable, reopenA recovers savedmanager. Later manager→member saved during read-table denial, existing Home access error/reload recovers after restoration. That post-save check uses the parent access guard; no broader command-idempotency claim.
- Validation: final typecheck0 errors, scoped ESLint0 errors/1 ref-cleanup warning, diffcheck clean. Required CI includes existing regressions. Native/hosted/account-switch, access-expiry and ownership-transfer flows are not newly accepted; guards on those existing completion callbacks share the repaired lifetime, with original policies/controls unchanged. Synthetic sign-in/dashboard aggregate and SQL-projected roster, controlled delay; actual permission/mutation handlers/database.
- Cleanup: original HomeRolePermission SELECT restored; original12 fixture table/object counts0 plus extra2User/2auth.users deleted and counted0. Exact Home/actor overrides cleaned with fixture. API18142 stopped; Next18141/own5containers retained for next Home scope, no native slot or peer resources changed. Fault holds released. Browser tab retained for continuation.
- Durable source/evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-member-r1/`,14 files plus manifest, binds exact component, baseline/comparison, real requests, held mutation/live socket, validation and cleanup. Credentials excluded from Git/chat.

**Handoff frozen for coordinator capture/publication.** Continue independent next Home source reconciliation while PR104 source remains fixed for CI; widerD05/D07 and all broader backlog remain incomplete. Coordinator integrates/releases PRs, not Stream2.

## September 21 D07 audit milestone — reviewable handoff

**Current: candidate published, required CI running; stream incomplete and continuing.** `codex/workstream-home` / `50289db7e0ca44f3effb575f717fa479e599f4c5`, [draft PR102](https://github.com/WangPantopus/skinny-pantopus/pull/102). Sole changed application path: `frontend/apps/web/src/components/home/members/MembersSecurityTab.tsx` (46 additions/9 deletions). [Exact-head CI35570755239](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35570755239) in progress; no current green claim.

- Baseline actual UI→SDK→homeIam/current permission helper→PostgREST/SQL rendered20of23 owned audit records. Denying table SELECT made the route500; UI cleared known records and claimed no matching events, retaining stale Load More without error/retry. Six current/master/paid/staging/place/archive source comparisons have the same silent catch.
- Existing component now reuses ErrorState/failureMessage for explicit retry, retains known rows on transient failure, retries the failed pagination offset, and clears history on401/403. Requests are retired across close/Home/current-management-access/unmount/newer read. No new application file/schema/backend/design/unit tests; role controls unchanged.
- Actual browser checks: cold/repeated SQL denial500; Enter retry200→20rows; second-page failure retains20, retry yields23/no duplicate/no extra Load More; unchanged Membership/Secret Reveals filters; genuinely empty200 has no error. Owned members.manage deny→real403 clears all history; restoration/retry recovers20. Held actual offset20 success200/3rows delivered on a live socket after close/reopen→newer offset0 denial403 cannot restore old data. Same-URL hold attempt serialized and is excluded from out-of-order proof.
- Web typecheck0 errors, scoped ESLint0 errors/8 warnings, diffcheck clean. Required CI runs existing regression/build gates. Accepted PR60 contracts and unaffected Home journeys are reused, not rerun.
- Limits: synthetic sign-in, unrelated dashboard aggregate and seeded audit records; actual route/permission/PostgREST/SQL. Controlled response delay. Native/hosted/account-switch and wider D07 role-control boundaries are not accepted by this check.
- Exact cleanup all12 row/object counts0; HomeAuditLog SELECT restored, exact members.manage override removed, private bucket removed. API18142 stopped; Next18141 and owned5containers retained for the next granted Home slice, no active fault, no native slot. Peer resources unchanged.
- Durable evidence: owner `.pantopus-recovery/audits/20260921-stream2-home-audit-r1/` contains14 files plus manifest, source hashes, baseline/candidate/HTTP receipts, transport bound, validation and exact cleanup. No credentials/raw device tokens archived in Git/chat.

**Author handoff ready for coordinator review/publication;** next independent work is existing member-role/permissions source and runtime verification while this commit remains fixed for CI. No merge/backlog closure by Stream2.

## September 21 resumed verification — D07 Members and Security

**Current state: verification; stream incomplete.** Required worktree is clean on `codex/workstream-home`, fast-forwarded from3dc226983 to master0f6e55e01 after independently checking PR60 merged, later master source and open PRs. PR60 Home source is unchanged; accepted browser/SQL/Storage evidence is reused. Latest live handoff/backlog/README and all3stream status reconciled; historical statuses below are source-bound snapshots.

Coordinator grants existing18141/18142/64550–59 and D05/D07 fallback. Native capability inventory showed no booted iOS devices; CUA lists Simulator but rejects its app binding with Invalid app, unchanged from the recorded unavailable control. No build/boot/install/system reset attempted; sole heavy native slot released and coordinator acknowledged. Native M02/Emergency remains unverified.

Next bounded journey: existing dashboard MembersSecurityTab audit-log read/error/retry and member-role controls, real homeIam routes and canonical permissions/SQL. Source lead: audit loader catches errors as empty entries with no retry; verify actual browser before repair. Reuse existing guest fixture and real permissions/PostgREST adapter; synthetic sign-in/dashboard scaffold remains labelled. No application edits yet, no new unit tests, no shared-file/schema grant requested. Product QR/shutoff decisions remain untouched. Continue further unresolved Home slices after each reviewable milestone.

## September 20 integration handoff — master safety changes

**Current state: merged by coordinator; combined-head CI green.** This snapshot supersedes the earlier current-state paragraphs below. Branch `codex/workstream-home` is clean and pushed at **`3dc226983260311a4e4e123d89c4e7fc6a55f38c`**, merging fresh master `2d6ff2069` into accepted Home candidate `66f834cc7`. [PR60](https://github.com/WangPantopus/skinny-pantopus/pull/60) was merged by the coordinator as `ebeea43d50f1ef35c32d2b3de7add9f958f4119d` at23:07:05UTC on September20; freshly verified through GitHub. Stream2 did not independently merge.

- **Requirement and changed paths:** coordinator requested compatibility verification with merged Stream3 safety/session handling. Clean merge adds only `frontend/apps/web/src/components/chat/ConversationView.tsx`, `frontend/apps/web/src/lib/query-provider.tsx`, `frontend/packages/api/src/client.ts`, and `frontend/packages/api/src/endpoints/auth.ts`. No new Home repair, file, unit test, migration, content or appearance change. Home callers/readers/routes/services and migration remain identical to66f834cc7.
- **Focused actual browser acceptance:** existing ShareCenter WiFi form issued a real saved2h pass; holding only its201 reply, closing it and opening a Vendor draft left Create enabled. Releasing the old reply preserved the new draft. Vendor then issued its own8h/3-section link. Both saved passes appeared in issuer list, with no duplicate; SQL showed WiFi2h/count0 and Vendor8h/count1 after opening its displayed guest URL. Public reader showed the expected Vendor parking/entry/emergency content. Existing UI Revoke persisted revoked_at and public reload displayed Access Revoked. A synthetic list503 displayed its explicit error; removing the fault and clicking Retry recovered the actual saved list.
- **Reused evidence:** prior19-case HTTP/service/SQL/PostgREST/local Storage, passcode/quota/time/legacy checks, saved-result metadata, Emergency and document acceptance retain their recorded unchanged-source limits. Stream3's merged real-cookie account-change/held401/refresh acceptance is reused; this Home check does not independently establish those account-switch cases. No redundant broad suite or new unit tests were written.
- **Combined CI:** [CI35543397030](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35543397030), exact head3dc226983, completed SUCCESS:8 applicable checks pass/3 native-seeder path skips. Includes production web build, existing web tests/lint/typecheck, backend/privacy gates, browser Identity Firewall, Docker, migration safeguards and full database replay. Diff whitespace clean.
- **Acceptance disposition:** no reproduced compatibility failure or unresolved acceptance gap blocking this bounded browser repair was found. Synthetic fixture identity/dashboard reads, deliberate response delay/list503 and local provider boundary remain explicit. Installed native M02/Emergency, hosted services, broader D08 account scenarios, exact clipboard readback, placeholder WiFi QR and the web shutoff-category product decision remain broader backlog limits; do not claim native/hosted or full M02/D08 acceptance. Web shutoff creation remains disabled; no design decision was implemented.
- **Cleanup and shared effects:** exact owned files/homes/tasks/users/views/audits/grants/passes/receipts/documents/emergencies/objects all0; private Storage bucket removed by existing cleanup. API18142/Next18141 stopped, all5 own r1 containers stopped and preserved,18141/18142/64551/64552 have no listeners. Both new browser tabs closed, no peer resources/caches/cookies or native slot touched. Only this live02 status changed; coordinator publishes shared docs and decides PR integration/backlog disposition.

**Handoff frozen for coordinator publication.** Coordinator accepted the combined source/browser/CI evidence and merged PR60. Next action: publish this snapshot and select the next bounded Home acceptance slice while preserving all broader limits above.

**Current state: ready for coordinator review — final-head CI green.** Restored the missing assigned worktree at `/private/tmp/pantopus-workstream-home` from its preserved Git index (no staged delta), on `codex/workstream-home`. Adopted later commit `e84b085b7`, including the already-granted Emergency migration `20260916011000` and review corrections; PR60 remains draft and its exact-head CI35166437240 passed all eight applicable jobs. The older migration-request and extra-chip-row notes below are historical: the migration exists and the unapproved chip row was removed. Master integration is documentation-only. No new unit tests planned.

**Released runtime grant:** coordinator acknowledged SQL64552/API64551 (64550–64559), web18141/API18142. Existing `pantopus-stream2-guest-r1` containers were adopted at ledger55, fixture rows/objects cleaned to zero, then all five owned containers stopped (preserved, not removed). Browser uses isolated origin `http://[::1]:18141`; no peer cookies/resources or native builds. Browser M02 milestone is verified within the limits below; final candidate `66f834cc7b6325c27a32634020523a1b6dc7b3d0` pushed to draft PR60. Next: current-head CI/coordinator review, then select the next bounded Home slice; installed native guest/Emergency and broader D08 account/hosted boundaries remain open.

**New reproduced failure (September 20):** the real ShareCenter → CreateGuestPass UI submitted a WiFi pass over the real API/service/SQL; with only the 201 HTTP response held, closing and reopening as Vendor retained `Creating...`. Releasing the old response replaced the new Vendor draft with the old WiFi token while claiming Vendor / 8h / 3 sections (SQL held WiFi / 2h / 1 section). Candidate: existing `CreateGuestPass.tsx` and `ShareCenter.tsx` only, reuse existing generation/ref convention; no new application file/schema/screen or unit tests. Current full HTTP/SQL/Storage harness19/19; browser creation/passcode/refusal/revocation confirmed with SQL view_count0→1 and create/revoke audits. Clipboard cannot be verified in current IAB; displayed link navigation works.

## September 20 milestone — resumed work adoption and stale guest-pass creation

- **Branch/SHA:** `codex/workstream-home` / `0f663dc32fe83b6120be2d75519e266e02be25ee`, [PR60](https://github.com/WangPantopus/skinny-pantopus/pull/60), clean tracked worktree. Master `38f00dcc8` integrated as `24ae11d1b`, documentation only. Adopted all three prior application commits `28bad0d3d`, `6882ba29a`, `e84b085b7`. The branch and preserved index agreed before restoration; no staged work was discarded. Owner checkout/unrelated untracked work untouched.
- **Changed paths:** existing `frontend/apps/web/src/components/home/share/CreateGuestPass.tsx` and `ShareCenter.tsx`. No new app file, screen, service, migration, layout, styling or unit test. Existing form history/open branches were compared; paid branch has no delta in this form. Its current React state and the adjacent generation-ref convention suffice for repair.
- **Baseline:** real WiFi create persisted a 2h/1-section pass; only its HTTP201 was delayed. Close pending panel → open Vendor → type a new title: button stayed Creating. Releasing the response replaced that draft with old WiFi token while summary claimed Vendor/8h/3 sections. This was an actual UI→SDK→router→service→SQL write with synthetic transport delay, not a mocked response body.
- **Repair:** generation and pending guard per panel/Home opening; retired results/errors cannot update a new form; a dismissed but successfully saved pass refreshes its issuer list without closing a newer draft. Result kind/duration/section count/quota come from the saved pass; passcode comes from the submitted value, not later edits.
- **New browser proof:** identical close/reopen/delay sequence now leaves Vendor draft and enabled Create intact; old saved WiFi appears in active list; Vendor then saves its own8h/3-section pass. Separate held create with later edits to duration2→8, sections1→2, quota1→5 and passcode still confirms saved2h/1section/quota1/original passcode. SQL matched each saved record. Invalid quota−1 produced HTTP400 with API explanation, no success and count0; corrected form saved normally.
- **M02 browser checks:** actual dashboard Share tab issue → displayed local guest URL → wrong passcode refusal (SQL view_count0) → correct unlock (count1) → UI revoke → SQL revoked_at/create+revoke audits → public Access Revoked. One-view pass opens once then View Limit Reached without Retry. Scheduled pass → Not Active Yet with Retry; expired → Link Expired; legacy → Link Needs Replacing;128-character passcode field/unlock works. Issuer list reports scheduled with Revoke, current view counts/last viewed and past passes. Synthetic list503 renders explicit error instead of empty list; Retry restores real list. No new defect found in these unchanged accepted paths.
- **Adopted SQL/Storage proof:** reran existing `test-home-guest-pass-http.cjs --container supabase_db_pantopus-stream2-guest-r1 --api http://127.0.0.1:64551`:19/19 including scoped lifecycle, all six native Emergency types, actual document upload/download/receipt/revocation and zero cleanup. Existing 55-migration ledger/constraint verified before run; no replay/reset or migration applied. Prior detailed scoped/Emergency/document browser evidence remains source-bound and was not redundantly repeated.
- **Regressions:** existing `homeSharingLinks.test.tsx`20/20; web typecheck gate0 errors at0 baseline; scoped ESLint0 errors (existing any/ref-cleanup warning categories); `git diff --check` clean. No new unit tests. Earlier PR60 exact-head CI35166437240 is green on `e84b085b7`; it is not final-head evidence. [PR CI35541130110](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35541130110) passed all8 applicable checks/3 native-seeder path skips on0f663dc32. The automatic run arrived late; duplicate manually dispatched35541118755 was cancelled to avoid redundant jobs.
- **Limits:** fixture identity/rate limits and unrelated dashboard reads synthetic, actual share router/service/SQL and local PostgREST/Storage; no hosted provider or installed native acceptance. IAB clipboard action did not produce a readable copied URL, so current copying is unverified; prior accepted copied-link evidence is retained and displayed URL navigation was tested directly. Existing WiFi Quick Connect placeholder remains unimplemented pending the recorded presentation decision. Web Shutoffs create remains disabled pending subtype decision; granted native category migration already exists and real route/SQL saves all six. No broad M02/D08 closure.
- **Shared/integration effects:** only existing share component callback is additive; no SDK/backend/schema/native change in this follow-up, no paid/Stream3 overlap. Coordinator alone reviews/merges and publishes shared status.
- **Cleanup:** browser/API stopped; exact fixture count `{files,homes,tasks,users,views,audits,grants,passes,receipts,documents,emergencies,objects}` all0; private Storage bucket removed by existing cleanup. Five own r1 containers stopped, retained for reuse; ports18141/18142/64551/64552 free. Peer/retained containers remain running. Native slot never acquired. Only private ignored runtime/evidence/dependency links remain in assigned worktree; root link created this turn removed; no raw logs/credentials committed. Browser origin was IPv6 `http://[::1]:18141` (macOS refused127.0.0.2); peer cookies untouched.

## Previous milestone snapshot
State: **ready for review** — the four bounded follow-ups this stream carried
forward (scoped `/shared/:token` links, the alternate `/app/homes/[id]/share`
entry, the members' Emergency page, the shared-document download journey) were
verified end to end, repaired in place and re-verified on `codex/workstream-home`
(fast-forwarded to master `d471611b3` first; guest-pass source identical to the
merged slice). Pushed as **`28bad0d3d`** + **`6882ba29a`**, draft
[PR #60](https://github.com/WangPantopus/skinny-pantopus/pull/60). Runtime reservation released. Full detail in the
[September 16 evening milestone](#milestone--september-16-2026-evening-scoped-links-settings-entry-emergency-info-shared-document-downloads).

**Runtime reservation (self-declared, taken 2026-09-16 ~16:05 PDT, RELEASED
~17:20 PDT):** the same disposable project as before —
`/private/tmp/pantopus-stream2-guest-r1`, container prefix
`pantopus-stream2-guest-r1`, SQL 64552 / API (Kong) 64551, with only db, kong,
postgrest, gotrue and storage-api started (`-x` for the rest). All 54 migrations
replayed (ledger 54). Nothing on 64521-64533, 18089 or 18130-18132 was connected
to or changed. Released with `supabase stop --workdir ... --no-backup`; no
`stream2` container remains, ports 64550-64559 are free, and the retained
`pantopus-home-gig-replay` (64521/64522) and `pantopus-stream3-block-r1` (64532)
containers were verified still up and healthy afterwards.

**Coordinator request (schema, needs assignment before any migration is written):**
both native Add Emergency forms POST `type` = `allergy` / `medical_condition` /
`medication` / `contact` / `pet_medical` / `power_of_attorney` / `other`
(Android `EmergencyFormCategory.backendType`, iOS `EmergencyFormCategory.rawValue`),
and `HomeEmergency_type_chk` refuses six of the seven — reproduced 2026-09-16 in
the replayed database (`INSERT ... type='contact'` → check-constraint violation;
only `other` saves) and through the real route over real PostgREST (HTTP 500
"Failed to create emergency info"). No lossless repair exists without widening
the constraint; a server-side mapping would silently turn an "Allergy" entry
into `first_aid` and change what the native detail screens show. Proposed
additive forward migration (not written): drop and re-add
`HomeEmergency_type_chk` with the nine current values plus the six form
categories, `SET lock_timeout`, "backwards compatible: yes", versioned after
master's newest and clear of the paid branch's `20260916021700..022100` block
(e.g. `20260916030000_home_emergency_form_types.sql`), with `HomeEmergencyType`
in `@pantopus/types` widened to match. Until it is granted the route now
answers a truthful 400 `INVALID_EMERGENCY_TYPE` instead of a 500; the native
forms still cannot save those six categories.

Acknowledged the clarified [working agreement](README.md#working-agreement) and
[verification-first rules](../../AGENTS.md): preserve iOS/Android/web appearance,
verify existing journeys, repair demonstrated failures in place and retest them.
Reuse accepted evidence; justify any new file/schema or replacement through the
required comparison, and label unverified provider/device boundaries explicitly.

## Scope and source

- Inventory: H/R/I/D/F/M Home and household rows. Accepted work stays accepted;
  the [remaining-work inventory](../REMAINING_WORK_2026-09-11.md) remains authoritative.
- Milestone: M02, existing browser guest-pass lifecycle through the Home Share
  tab, issued link, public guest view and revocation, including passcode,
  start/end windows, view limits and stale-result retirement.
- **Worktree/branch actually committed from — `/private/tmp/pantopus-workstream-home`,
  branch `codex/workstream-home`.** This is the assigned Stream 2 worktree and the
  guide's row is correct. The other path a session may report
  (`.../estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380`, branch
  `claude/pantopus-stream-2-home-3ef380`) is only the harness's isolated scratch
  worktree that a remote session is launched into; it sits at master `711340225`
  with a clean tree and **zero commits**, and no application code was written
  there. The single file touched in it was its own untracked `.claude/launch.json`,
  pointed at the app worktree so a local dev server could serve this branch's
  code; it was restored both times. All application edits, both commits and the
  push came from `/private/tmp/pantopus-workstream-home`.
- **Merged.** Commits `70e079543` (browser repairs) and `88d076e56` (real-SQL run
  + what it exposed) reached master through PR #53 as **`4cc9d3787`**; docs PR #54
  merged as `b46934c92`. Independently verified from this worktree: both commits
  are ancestors of `origin/master`.
- **New base: `c14657e35`** (Stream 3's PR #51). `codex/workstream-home`
  fast-forwarded from `/private/tmp/pantopus-workstream-home` and pushed
  (`b46934c92..c14657e35`); branch identical to master, clean tree. The earlier
  `b46934c92` integration was documentation only; this one is not.
- **Integration check, and why it earned a full re-run.** Stream 3's delta touches
  none of this stream's files (`git diff --name-only HEAD...master` matches
  nothing under `guest/[token]`, `components/home/share`, `home-guest-pass*` or
  `endpoints/homeIam`), but it adds a **54th migration**
  (`20260916010000_direct_message_block_admission.sql`). That is a changed schema
  in the same database this stream replays, so the disposable project was rebuilt
  and the real-SQL journey repeated rather than assumed:
  - Replay applied all **54** migrations; ledger = 54; the 4 block-admission
    functions are present.
  - `test-home-guest-pass-http.cjs --container` — **9 checks pass**, owned rows
    back to zero. The new advisory-lock trigger on direct chat does not disturb
    `lock_home_external_share` or any guest-pass path.
  - Web **109 suites / 1481 tests** pass (Stream 3 adds 2 suites / 12 tests; all
    of this stream's remain green); typecheck gate at its 0-error baseline.
  - Runtime released again with `supabase stop --workdir ... --no-backup`; ports
    64551-64557 free; retained `pantopus-home-gig-replay` and
    `pantopus-stream3-block-r1` verified still up and healthy.
- This stream's merged slice also reached the paid branch through the coordinator's
  master integration (`6e106d9d0`); no action needed here.
- No backend, service, schema or migration change. No native/mobile change.

## What the existing journey already did correctly

Verified through the real Share tab and the real `/guest/:token` page in a
browser, against the real `homeIam`/`homeGuest` routers and the real
`homeExternalShareService` over actual HTTP: quick-template and custom issuance,
the returned token becoming a real copyable link and a real QR, the copied link
opening with exactly the bound sections and Home fields, view counting and
"last viewed" reaching the issuer list, the passcode challenge, a wrong passcode
refused **without** spending view quota, a correct passcode unlocking, and
revocation moving the pass to Past Passes and killing the link immediately.
None of that needed repair. Backend/SQL authority, quota, receipt and race
behaviour reuses the accepted [sharing report](../home-invitation-sharing-2026-09-09.md)
within its recorded limits.

## Reproduced failures and the repairs

All five were reproduced in the browser before any edit, and re-verified after.

| Reproduced failure | Repair |
| --- | --- |
| Exhausted view limit rendered "Something Went Wrong" + Try Again (API: 410 `SHARE_VIEW_LIMIT`) | Terminal "View Limit Reached" screen, no retry |
| Unopened start window rendered the same generic error (API: 403 `SHARE_NOT_STARTED`) | "Not Active Yet", retry kept because it can succeed later |
| Legacy link claimed it "was revoked by the home admin" (API: 410 `SHARE_REISSUE_REQUIRED`) | "Link Needs Replacing — ask the sender for a new link" |
| ShareCenter badged `reissue_required` and `scheduled` passes **Active** and counted them in Active Passes | Reads the status the list endpoint already returns; dead links move to Past Passes, scheduled keeps Revoke and shows its start time |
| A failed pass list rendered "No active guest passes" | Explicit failure card with Retry |

Two further defects found while repairing the above: create/revoke/scoped-share
failures were discarded because this API client rejects with a plain object and
the screens tested `err instanceof Error` (a 400 `SHARE_INVALID` showed only
"Failed to create guest pass"); and the two passcode inputs disagreed with the
API's 128-character limit (create unbounded, guest capped at 20), so an issuer
could set a passcode a web guest could not type. Both repaired. Superseded async
results are now dropped on both screens using the repo's existing
`generation = useRef(0)` convention.

Changed paths: `frontend/apps/web/src/app/guest/[token]/page.tsx`,
`frontend/apps/web/src/components/home/share/{ShareCenter,CreateGuestPass,ScopedShareModal}.tsx`,
new `.../share/shareFailure.ts`, `frontend/apps/web/tests/homeSharingLinks.test.tsx`,
`frontend/packages/api/src/endpoints/homeIam.ts`, and new
`scripts/db/{home-guest-pass-http-fixture,test-home-guest-pass-http}.cjs`.

New-file justification: no existing harness exercised these routes over real
HTTP (the tracked `tests/guest-pass.spec.ts` mocks every API response, and the
existing `scripts/db/*-http-fixture.cjs` cover residency/removal/tasks, not
sharing). `shareFailure.ts` is shared by three share screens; the repo has no
reader for this client's plain-object rejection shape (ClaimEvidenceReview keeps
a private one). The existing `homeSharingLinks.test.tsx` was extended rather than
replaced; its denial case had mocked an `Error`, a shape this client never
produces, which is what hid the dropped reason.

## Evidence and limits

- New: `node scripts/db/test-home-guest-pass-http.cjs` — 8 checks over real HTTP
  through the production routers and service. Browser journey driven end to end
  on a local Next dev server: issue → copy → open → passcode → revoke, plus each
  refused state before and after the repair.
- Regressions: web suite **107 suites / 1468 tests** pass; backend
  `homeExternalShareRoutes` + `guestPass` **51 tests** pass; web typecheck gate
  at its 0-error baseline; eslint 0 errors on the changed paths (the two new
  `generation.current` cleanup warnings match the existing ClaimEvidenceReview
  convention, which warns identically).
- **Real SQL (September 16).** `node scripts/db/test-home-guest-pass-http.cjs
  --container supabase_db_pantopus-stream2-guest-r1` — **9 checks pass** with the
  share RPCs executing as actual SQL (all 53 migrations, `service_role` through
  `docker exec psql`), including a new one proving a withdrawn `access.view_wifi`
  grant both refuses issuance and retires links it already backed. The same
  script still passes its 8 checks without a container. The browser journey was
  repeated on the SQL-backed server: issuing from the real Share tab persisted a
  `HomeGuestPass` with `resource_bindings` and a `guest_pass_created` audit row;
  the copied link opened with the bound sections; revoking from the UI set
  `revoked_at`, wrote `guest_pass_revoked`, and turned the link into a 410 and
  the Access Revoked screen. Scheduled and legacy passes kept honest badges from
  the real list status. Owned rows verified back to **zero**.
- **Three defects only real SQL could expose** (all repaired in `88d076e56`):
  1. `HomeEmergency.type` can only hold the `HomeEmergencyType` values already
     declared in `@pantopus/types` (`HomeEmergency_type_chk`: `shutoff_water`,
     `shutoff_gas`, `shutoff_electric`, `breaker_map`, `extinguisher`,
     `first_aid`, `evac_plan`, `emergency_contacts`, `other`). The public guest
     page matched `'shutoff'`/`'contact'`, values this column never holds, so
     **every** emergency entry fell through to the generic icon — a water
     shutoff rendered identically to a contact list. Mapped to the real values
     using the page's own glyphs; confirmed in the browser on real rows.
  2. `inspect_home_external_share` rechecks the issuer's **current** permission
     for each bound section. My transcription only rechecked
     `members.manage`/`home.view`, so it would have kept serving a wifi link
     after the issuer lost `access.view_wifi`. Transcription corrected to match.
  3. `trg_sync_homeaccesssecret_value` refuses an INSERT carrying a secret and
     only moves it into `HomeAccessSecretValue` on UPDATE; the fixture now seeds
     through that contract instead of writing the value table directly.
- **Remaining labelled limits.** Authentication is still synthetic, and dashboard
  reads unrelated to sharing are scaffolded in an uncommitted local launcher.
  Shared-document sections, scoped `/shared/:token` grants, native guest
  acceptance and the alternate `/app/homes/[id]/share` entry remain outside this
  slice. This closes only the bounded browser slice; broader M02 and release
  acceptance stay open.

## Coordination and handoff

- **Shared-file effect:** `frontend/packages/api/src/endpoints/homeIam.ts` —
  `GuestPass.status` widened to include `reissue_required` and `scheduled`,
  which `mutate_home_external_share` already returns. Type-only; no runtime or
  contract change. Flagging it because the SDK package is shared.
- **Runtime reservation taken and released September 16 (self-declared; no
  coordinator row existed and no message channel was available).** Private
  project `/private/tmp/pantopus-stream2-guest-r1`, container prefix
  `pantopus-stream2-guest-r1`, SQL 64552 / API 64551 (studio 64555, inbucket
  64556, analytics 64557, shadow 64553, pooler 64554), created by
  `supabase start --workdir` with all 53 migrations applied (340 public tables).
  Chosen clear of every retained resource; 64521-64533, 18089, 18130-18132 and
  15292 were never connected to or mutated. **Released** with
  `supabase stop --workdir /private/tmp/pantopus-stream2-guest-r1 --no-backup`;
  its ports are free and the retained `pantopus-home-gig-replay` (64521-64527)
  and `pantopus-stream3-block-r1` (64532) containers were verified still up and
  healthy afterwards. The project directory remains for cheap recreation; the
  tracked fixture rebuilds the whole run in one command if the coordinator wants
  to repeat it.
- **Original runtime request (September 15, then blocked):** requested one fresh
  disposable `pantopus-home-guest-pass-*` Postgres container on an unassigned
  port. **Blocked:** the Docker daemon on this Mac did not respond all session —
  `docker ps`, `docker ps -a` and a direct query of `~/.docker/run/docker.sock`
  all hung past 120s with no output, with ten queued `docker ps` processes from
  several sessions. Docker Desktop and its backend/virtualization processes are
  alive and the retained 64522/18089 listeners still accept connections. I ran
  no state-changing docker command and did not restart Docker Desktop, because
  that would disturb the retained rehearsal containers. Coordinator decision
  needed; when the daemon returns, the tracked fixture takes a `container`
  option and the same journey can be re-run against real SQL.
- **Environment finding for every stream:** `qrcode@1.5.4` (and `@types/qrcode`,
  `jsqr`) are in `pnpm-lock.yaml` but absent from the owner's main-checkout
  `node_modules`, so the Share tab and the invitation QR flows fail to build
  there with `Module not found: Can't resolve 'qrcode'`. A `pnpm install` is
  needed in any worktree that builds the web app. I did not run one; I fetched
  those three packages into my own gitignored `node_modules` instead.
- **Proposed, not implemented (needs approval — visible change):** the guest
  page's Wi-Fi "Quick Connect" block renders a static placeholder icon labelled
  "QR Code" under the text "Scan to connect automatically"; nothing is
  scannable, while the app already ships the real shared `QRCode` component used
  on the issuer side. Filling the same 128px box with the real component would
  complete the intended function but changes visible output, so it is held.
- **Resources/cleanup:** local Next dev server (3000) and the fixture HTTP
  server (8000) both stopped. No container, shared cache, database, migration,
  simulator or device was created, written or mutated; ports 64522/18089 were
  never connected to beyond a `pg_isready` liveness probe. Uncommitted local
  dev-environment state remaining in my worktree only: a `node_modules` symlink
  to the main checkout, copied per-package symlink farms, and the three fetched
  packages — all gitignored or untracked, removable on handoff.
- **Peer finding for whoever owns the members' Emergency screen:**
  `frontend/apps/web/src/app/(app)/app/homes/[id]/emergency/page.tsx` orders
  categories by `['shutoff','contact','evacuation','medical','other']` — the same
  invented values the guest page used, none of which `HomeEmergency.type` can
  hold. Not touched here (different screen, outside this slice); routing it to
  the coordinator rather than expanding scope.
- **PR #53 CI is green (run `35128148860`): 6 pass, 5 skip, 0 failures.** Passing:
  CI OK, Detect changes, Deployment and migration safeguards, **Web (lint,
  typecheck gate, Jest) 4m41s**, Web E2E (Identity Firewall) 2m8s, and
  **database / Replay and lint the complete schema 2m2s**. Skipped with no
  changed paths: backend, Backend Docker image, Seeder, android, ios — consistent
  with this candidate touching no backend, schema or native code. The database
  replay job passing is the independent check on the same 53-migration replay
  this stream ran locally; this candidate adds no migration. No native build
  requested, so the heavy slot stays free as far as this stream is concerned.
- **Open bounded row carried forward (assigned to this stream):** the members'
  Emergency screen `frontend/apps/web/src/app/(app)/app/homes/[id]/emergency/page.tsx`
  orders categories by `['shutoff','contact','evacuation','medical','other']` —
  the same invented values the guest page carried, none of which
  `HomeEmergency.type` can hold under `HomeEmergency_type_chk`. Reproduction and
  repair not started; it needs its own baseline before any edit.
- **Next:** awaiting selection of the next bounded sub-slice — the Emergency-page
  row above, scoped `/shared/:token` grants, the shared-document receipt/download
  journey (needs a storage provider boundary, to be labelled), or the alternate
  `/app/homes/[id]/share` entry. No runtime is held by this stream and no native
  build is requested; the heavy slot stays free.


## Milestone — September 16, 2026 (evening): scoped links, Settings entry, Emergency info, shared-document downloads

**Branch / commits:** `codex/workstream-home`, base master `d471611b3`
(fast-forward only; the 11 commits behind were documentation). `28bad0d3d`
(harness + backend + web repairs + tests) and `6882ba29a` (document type label +
backend CI test). Draft PR: **[#60](https://github.com/WangPantopus/skinny-pantopus/pull/60)** — [CI run 35163173561](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35163173561) on `6882ba29a` is **green**: CI OK, Detect changes, Deployment and migration safeguards, Backend (privacy gates + Jest), Backend Docker image, Web (lint, typecheck gate, Jest), Web E2E (Identity Firewall), database / Replay and lint the complete schema all pass; Seeder, android and ios skip with no changed paths. Worktree clean.

**Changed paths (17 files, +1173/−153):** `backend/routes/home.js` (+38: 23514 →
400 `INVALID_EMERGENCY_TYPE`; new `DELETE /:id/emergencies/:emergencyId`),
`backend/routes/homeGuest.js` (attachment/type order), new
`backend/tests/homeEmergencyRoutes.test.js`,
`frontend/apps/web/src/app/(app)/app/homes/[id]/{emergency,share}/page.tsx`,
`frontend/apps/web/src/app/{guest,shared}/[token]/page.tsx`,
`frontend/apps/web/src/components/home/cards/EmergencyCard.tsx`, new
`.../components/home/emergencyTypes.ts`, `.../home/share/{ShareCenter.tsx
(export passStatus), shareFailure.ts (+requiresPasscode)}`, new
`.../home/share/sharedDocumentLabel.ts`, `frontend/apps/web/tests/homeSharingLinks.test.tsx`
(+7 tests), new `frontend/apps/web/tests/homeEmergencyPage.test.tsx` (5 tests),
`frontend/packages/api/src/endpoints/homeProfile.ts` (+`createHomeEmergency`,
`deleteHomeEmergency`), `scripts/db/{home-guest-pass-http-fixture,test-home-guest-pass-http}.cjs`.
No migration, no schema change, no native change, no layout/styling change.

### What the existing journeys already did correctly (verified first, reused)

The scoped-grant **backend** is correct end to end: issuing a `HomeTask` grant,
opening it, view counting, the 128-character passcode challenge/refusal/unlock,
view limits, future windows, legacy (`sharing_version` NULL) links, revocation
with idempotent replay, `can_edit:true` and foreign resource types refused, and
a withdrawn `tasks.view` grant retiring already-issued links — all as real SQL.
The document contract is also correct: `home_external_share_resource` binds the
exact `File` (fingerprint/sha/path checks), the read receipt is consumed once
per download and refuses a stale receipt after revocation, and a withdrawn
`docs.view` grant retires a guest pass that bound a document. The merged guest
slice (issue → copy → open → passcode → revoke) reproduces unchanged on today's
head (9/9 against the fresh 54-migration container before any edit). Emergency
GET/POST routes and their permission gate work for canonical types.

### Reproduced failures and the repairs (all reproduced before editing, re-verified after)

| Reproduced failure | Where | Repair |
| --- | --- | --- |
| Spent view limit → "Something Went Wrong" + Try Again (API 410 `SHARE_VIEW_LIMIT`); unopened window → same generic error (403 `SHARE_NOT_STARTED`); legacy link → "Access Revoked … revoked by the owner" (410 `SHARE_REISSUE_REQUIRED`); unknown token → generic + retry; passcode `maxLength=20` vs API 128 | `/shared/[token]` page (message-substring classification) | Reads the share API code through the existing `shareFailure` reader (now also carrying `requiresPasscode`); terminal screens for limit/reissue/not-found, retry kept only for not-started; `maxLength=128`; `generation` guard for superseded reads. Existing screens/copy retained; titles/bodies vary by code |
| "Share link copied to clipboard" put the **bare 64-hex token** on the clipboard (`res.share_url \|\| res.url \|\| res.token`); scheduled and legacy passes listed under Past Passes as "Expired", no Revoke on a scheduled link; failures showed the raw client message | `/app/homes/[id]/share` (Settings → Guest Passes) | Copies `${origin}/guest/<token>`; uses the exported `passStatus` (scheduled = current + revocable + "Starts …", legacy = "Needs new link", revoked = "Revoked"); `include_revoked:true` so the existing Revoked label is reachable; `failureMessage` for load/create/revoke; `generation` guard |
| Page grouped by `i.category` (no row has it), titled rows by `item.title` (rows have `label`), rendered `item.details` — a jsonb **object** — as a React child: **React throws "Objects are not valid as a React child (found: object with keys {})" and nothing renders** for any real row; Add created a `local-…` row and toasted success without any request; Delete removed only local state; create chips `shutoff/contact/evacuation/medical` are values the column refuses | `/app/homes/[id]/emergency` | Reads `type/label/location/details.{phone,notes,detail}`, groups by the real rollup (`emergencyTypes.ts`, same rollup as the native palettes), saves through `POST` with a `HomeEmergencyType` and the details object, deletes through the new `DELETE`, shows the server's row, reports the API reason on failure, `generation` guard |
| Filtered on `emergency_type ∈ {water_main, gas_shutoff, electrical_panel, sprinkler, contact, evacuation, plan}` — never a real value, so every row landed in "Other"; "+ Add Info" toggled an unused state | dashboard `EmergencyCard` (+ preview) | Buckets by real `type`; reads phone/notes from `details`; "+ Add Info" opens the existing Emergency page |
| Native Add Emergency forms POST `allergy/medical_condition/medication/contact/pet_medical/power_of_attorney` → check-constraint violation → **HTTP 500 "Failed to create emergency info"** (reproduced over the real route + real PostgREST) | `POST /:id/emergencies` | 23514 → 400 `{code:'INVALID_EMERGENCY_TYPE'}`. The schema widening itself needs the coordinator grant recorded at the top of this file; until then those six native categories still cannot be saved |
| No delete route existed (T6.0c "no PATCH/DELETE" row) | `home.js` | `DELETE /:id/emergencies/:emergencyId`: `can_manage_home` gate like POST, exactly-one-row of that home, 404 `EMERGENCY_NOT_FOUND` on replay |
| Every shared-document download served as `application/octet-stream` with an extension-less filename: `res.attachment(title)` ran after `res.type(mime)` and re-derived the type from the title | `homeGuest.js` | `attachment()` first, then the stored MIME type |
| Both public pages badged every shared document "PDF" (`doc.file_type \|\| 'PDF'`; the view carries `mime_type`/`doc_type`) | guest + scoped pages | `sharedDocumentLabel()` from the stored type |

### New-file justifications

`emergencyTypes.ts`: three web readers (page, card, preview) need the same
type→category rollup and detail reader; `@pantopus/types` declares the values
but no web mapping existed. `sharedDocumentLabel.ts`: two public pages, no
shared MIME→label helper (PrivateClaimEvidencePreview's map is private and
image/pdf-only). `homeEmergencyPage.test.tsx`: no suite rendered either
screen and it needs its own `next/navigation`/`homeProfile` mock shape.
`homeEmergencyRoutes.test.js`: no suite loads these handlers; `guestPass.test.js`
exercises the share service against the mocked database, not the routers.
Everything else extends existing files (the fixture/harness, the sharing test,
the SDK file, the share reader, ShareCenter's export).

### Evidence

- **Real HTTP/SQL/Storage harness** — `SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=…
  node scripts/db/test-home-guest-pass-http.cjs --container
  supabase_db_pantopus-stream2-guest-r1 --api http://127.0.0.1:64551`: **19 PASS**
  (8 accepted guest checks + 4 scoped + 3 emergency + 3 document + exact cleanup
  `{passes,views,audits,grants,receipts,tasks,emergencies,documents,files,homes,users,objects}` all 0).
  The same script still passes 8 checks route-only and 9 SQL-only, unchanged.
  In `--api` mode the production admin client (`backend/config/supabaseClient`)
  serves every non-share table/RPC/Storage call, so `home.js`, `homeDocumentFiles.js`
  and `homeDocumentStorage.js` run their real reads/writes; identity and rate
  limits are the only stubs.
- **Baselines** (before the repair, same harness/fixture): native form type →
  `500 {"error":"Failed to create emergency info"}`; download `content-type:
  application/octet-stream`; scratch Jest renders of the merged-master pages
  (not committed): Emergency page → React object-child error, no headings;
  Settings entry → listed the scheduled and legacy passes as "Expired" and
  copied `"baba…ba"` (the bare token).
- **Regressions**: web Jest **110 suites / 1493 tests** (was 109/1481); web
  typecheck gate **0 errors** at its 0-error baseline (run twice, after each
  commit); eslint **0 errors** on the changed paths (warnings are the existing
  `any`/`@ts-nocheck`/`generation.current` categories); backend Jest **118 tests**
  across `guestPass`, `homeEmergencyRoutes` (new, 7), `homeDocumentFiles`,
  `homeDocumentAccess`, `homeAddressRedaction`.
- **Browser journeys** on the local Next dev server (`.claude/launch.json` `web`,
  3000 → fixture 8000 through the existing `/api` rewrite), fixture in
  `--serve 8000` mode against the SQL/Storage-backed project: `/shared/<task>`
  renders the exact task; `<later>` → "Not Active Yet" + Try Again; `<legacy>`
  → "Link Needs Replacing"; `<limited>` opens once, second open → "View Limit
  Reached" with no Try Again; `<locked>` → passcode form with `maxlength=128`,
  wrong code → "Incorrect passcode. Please try again.", `sesame` → task; the
  task grant revoked through the API → "Access Revoked"; `/shared/<doc>` →
  Download link whose in-page fetch returns 200 `text/plain; charset=utf-8`,
  `attachment; filename="Fixture document"`, exact bytes; `/guest/<docPass>` →
  Shared Documents row, same download; Emergency page renders the two seeded
  rows under Shutoffs/Emergency Contacts (the pre-fix page crashes here), Add →
  Shutoffs → Gas → phone/details → row appears and SQL holds
  `type=shutoff_gas, details={notes,phone}`; Delete → confirm → row gone in UI
  and SQL (count back to 2); Settings entry lists 5 active incl. "Scheduled
  pass — Starts 9/17/2026 …" with Revoke and "Legacy pass — Needs new link"
  under Past; Revoke → confirm → pass moves to Past as "Revoked", SQL
  `revoked_at` set, audit `guest_pass_created,guest_pass_revoked`, public link →
  410 `SHARE_REVOKED`; New Pass → Guest → "Ana" → Create & Share → clipboard
  received `http://localhost:3000/guest/<token>` and that link opened the real
  guest page with Wi-Fi/parking/entry/house-rules and the real emergency icons
  (🔧 water shutoff, 📞 contacts). Screenshots were taken but not committed.

### Limits (labelled)

- Authentication is synthetic throughout (`x-fixture-actor` / the seeded owner;
  browser session via the `pantopus_access` + `pantopus_session` cookies).
  Storage is the disposable project's own Supabase Storage, not hosted.
- The dashboard `EmergencyCard` is verified by Jest only; the dashboard page needs
  many unrelated reads the fixture answers 404 (serve-mode catch-all), so it was
  not driven in the browser.
- **Native**: not built or run (no heavy-slot request). The native Add Emergency
  forms remain blocked by the constraint for six categories until the schema
  grant; no native code change is needed once it lands (the forms already send
  those ids). Installed native Emergency verification stays open.
- The scoped page keeps its existing `// @ts-nocheck`.
- `frontend/apps/web/src/components/home/QuickAccess.tsx` renders `{e.details}`
  (same object-child crash) but is **not rendered anywhere** (no importer); left
  untouched as dead code, flagged here.
- No native/mobile screen was changed; no web layout/styling changed.

### Visible change needing approval

The Emergency create form now shows a second small chip row (Water / Gas /
Electric / Breaker map, same chip style) only while "Shutoffs" is selected,
because shutoffs are stored per utility and the form previously saved nothing
at all. Without it the only alternatives were guessing a utility or keeping the
fake save. Everything else on the page is unchanged. If not approved, the row
can be dropped and "Shutoffs" would need a product decision on which type to
store.

### Shared-file / integration effects

- `frontend/packages/api/src/endpoints/homeProfile.ts`: two additive functions
  (`createHomeEmergency`, `deleteHomeEmergency`), Home-owned endpoint file, no
  existing signature changed. Flagged because the SDK package is shared.
- `backend/routes/home.js`: additive DELETE route + a 400 mapping inside the
  existing POST error branch; `backend/routes/homeGuest.js`: two-line ordering
  change. No Stream 1/3 overlap (`git diff --name-only` vs their paths: none).
- `ShareCenter.passStatus` is now exported (no behaviour change);
  `shareFailure.ShareFailure` gains `requiresPasscode` (additive).
- The scratch baseline tests and browser screenshots are not committed; the
  worktree's untracked state is only the gitignored `node_modules` symlink.

### Coordinator requests

1. Review/CI/merge of the draft PR (green locally as above; the harness `--api`
   mode needs the disposable project, the rest runs in CI).
2. The schema grant recorded at the top of this file (widen
   `HomeEmergency_type_chk` + `HomeEmergencyType`); this stream will write the
   forward migration, the SQL contract/generated test and the type widening,
   then re-run the harness with the six native ids.
3. Decision on the shutoff sub-kind row above.

### Runtime and fixture cleanup

Fixture server (8000) and Next dev server (3000) stopped; `--cleanup` counts all
zero (rows and Storage objects); the private bucket was removed; disposable
project stopped with `--no-backup` (no `stream2` container remains; 64550-64559
free); retained 64521/64522/64532 containers verified up and healthy; browser tab
closed. Nothing else on this Mac was created, written or mutated.

### Next

- Upon the schema grant: migration + contract + types, harness re-run, then
  installed native Emergency add/list verification (needs the heavy native slot).
- Remaining M02 breadth outside the browser: native guest-pass acceptance, the
  dashboard Share tab against a fuller scaffold, the wider D08 external-share
  expiry/account-change acceptance.


## Current bounded follow-up — document-card sharing origin

Coordinator reacquired same SQL64552/API64551 and web[::1]:18141/API18142 for Stream2 on September20. Existing r1 containers restarted, not duplicated. Candidate existing DocsCard.handleShare uses `document`/`read` where service/SQL contract expects `HomeDocument`/`view`; verify actual Documents card before editing. No schema/native scope extension. PR60 head0f663dc32 preserved while baseline runs. Local fixture now loads real homeDocumentAccess utility for the existing document-list route; authentication and unrelated dashboard aggregate remain synthetic.

**Reproduced baseline:** uploaded owned text document through real POST `/documents/upload` (201), actual GET `/documents` rendered it in dashboard Documents card. Clicking existing Create share link POSTed `{resource_type:document,permission_scope:read}` and got400 `SHARE_INVALID`; generic toast hid API reason; SQL HomeScopedGrant count0. Existing source/history/open paid branch compared: DocsCard unchanged since import and no competing repair. Reuse canonical HomeDocument/view contract and existing SDK/helper; no replacement screen/service/schema needed. Coordinator notified before changing PR scope.


### Document-card sharing repair — September20

- **Branch/head:** `codex/workstream-home` / `66f834cc7b6325c27a32634020523a1b6dc7b3d0`, draft PR60. Its predecessor0f663dc32 has green CI35541130110; this caller-only commit now passes [CI35541676278](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35541676278):8 applicable checks successful,3 native/seeder path skips, including production web build and full database replay.
- **Path:** existing `frontend/apps/web/src/components/home/cards/DocsCard.tsx`,5 additions/5 deletions. Sends canonical `HomeDocument`/`view`, uses the SDK returned token directly with encoding, and existing `failureMessage` so plain-object API rejections retain their safe message. No new file/unit test/backend/schema/layout/native change.
- **Baseline and reuse:** actual uploaded document reached actual GET `/documents` and dashboard card. Existing share icon returned400 SHARE_INVALID, no grant, with `document`/`read`. Canonical SQL migration20260910040000 and existing19-check HTTP harness already establish HomeDocument/view and exact file/receipt/authority contracts. No paid-branch/archived replacement needed; original caller repaired in place.
- **New end-to-end:** same icon now POSTs HomeDocument/view→201; SQL one grant bound to uploaded document with can_edit=false and view_count0. UI reports copied (IAB clipboard bridge reads empty, so exact clipboard bytes remain unverified). Opening the returned local public link renders exact title and TXT label. Standard target-blank clicks did not send a download in IAB; supported browser locator downloadMedia on the displayed Download link did send the real request,200 text/plain and31 bytes whose SHA256 matched the uploaded fixture. API DELETE of that exact grant→200; reloading public page→Access Revoked. Revocation was API-driven because this card has no grant-management UI.
- **Error boundary:** deny docs.view through the owned fixture override while existing card remains mounted; click sends actual request→403 SHARE_RESOURCE_DENIED, UI displays “The shared content is no longer available.”, grant count stays1 (the revoked original). Overrides restored. Final SQL one grant/one revoked/one view before cleanup.
- **Verification:** web typecheck0 errors, scoped ESLint0 errors/4 pre-existing any warnings, diff whitespace clean. Earlier20 sharing regressions/full current-base CI retained; no unit tests added/repeated for this two-value caller repair.
- **Limits:** browser clipboard bridge and ordinary target-blank download behavior remain labelled IAB boundaries; supported browser download action is byte-exact evidence. Synthetic identity/dashboard aggregate; actual list/upload/share/service/SQL/local Storage. Hosted and installed-native boundaries open.
- **Cleanup:** exact rows/files/receipts/objects all0 again, private bucket removed by existing fixture cleanup; API18142/Next18141 stopped, own5 r1 containers stopped and preserved; no native slot. Two newly created tabs closed; no peer resource/cache/cookie edits. Temporary lint fallback symlink removed; app worktree tracked clean.

**Final handoff:** PR60 remains draft/open/mergeable at66f834cc7b6325c27a32634020523a1b6dc7b3d0; CI35541676278 fully green. Author update complete and ready for coordinator publication. No merge, deployment, shared backlog closure, provider activation or native installation performed. Runtime released again and fixture cleanup0. Next bounded work remains installed native M02/Emergency and wider D08 account/hosted acceptance, subject to runtime/tool availability; do not repeat accepted browser/backend checks without a relevant change or concrete risk.
