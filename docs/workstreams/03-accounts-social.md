# Stream 3 — Accounts, social and notifications

Updated September 15, 2026 (resumed verification). Owner: accounts/social stream.
State: **repair / verification / CI**. Stream 3 and N04 remain **incomplete**.
Current status is maintained only in this neutral coordination file.

## Source and reconciliation

Application worktree `/private/tmp/pantopus-workstream-accounts-social`, branch
`codex/workstream-accounts-social`. Initial inspection found clean `fc99f8ee7`
with no later changes, PR or CI. Current master `0616d6e79` was integrated as
shared documentation only. Current pushed application milestone: **`dfc860bfe`**.
Draft [PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51);
[CI35051834828](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35051834828)
has an **Android ktlint failure** (BlockedUsersViewModel.kt indentation); web/backend/database/iOS lint gates pass, other native jobs still running. No integration/merge approval and no merge performed.
New uncommitted Android lifetime regression tests reproduce two stale-response defects. Local Next-generated `tsconfig.json`/`.next-stream3` also remains outside
that commit; it will be restored/retired after the browser runtime stops.

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
| Local regressions | **42 backend**, **10 rendered web**, **13 Android JVM**, **13 iOS model** pass. Web TypeScript passes; scoped ESLint has warnings/no errors. iOS scoped SwiftLint/SwiftFormat pass. Android final static checks still pending. Mocked/stubbed persistence/auth applies to these tests. |
| Browser → HTTP → persistence | Actual existing profile Report submitted harassment to one pending UserReport; profile Block succeeded; Settings → Blocked Users displayed Social Bob; Unblock removed the UserBlock; failed personal list + successful empty relationship list showed unavailable/Retry, then confirmed empty after recovery. Actual SDK, HTTP, PostgREST and PostgreSQL; synthetic authentication, older retained schema, local Debug/development runtime. |
| Actual HTTP/PostgreSQL | **9/9** focused cases pass: owner list/removal isolation, bidirectional direct-create denial, duplicate blocks, reverse block after unilateral unblock, warm-cache unblock/create/send with a saved message, existing-room member reads/nonmember denial/bidirectional send denial, unavailable block read503 with no intercepted delivery effects, browser report persistence and retry. |
| Native installed | New owned simulator installed/launched with API18130. Initial preview-auth launch was insufficient (401), so proceeding through real installed sign-in UI backed by a synthetic local sign-in fixture. Actual installed normal sign-in → Hub → Settings → Blocked users displayed persisted Social Bob; Unblock removed the UserBlock (SQL confirmed). Failed personal list + empty profile list displayed existing error/Try again; recovery/Try again displayed confirmed empty. Synthetic sign-in, local PostgREST/SQL; block creation/report/chat and session races remain unverified on installed screens. |
| Socket/provider | Three socket handler regressions pass for query failure and both block directions. HTTP harness captures socket emits/provider attempts; **no real socket transport or provider delivery claim**. |
| CI / integration | PR51 draft/current-head CI Android ktlint failed at line235 (indentation36 vs40); later Android gates did not run. Other completed gates green; native jobs still running. Neither green local tests nor this PR closes N04 or authorizes merging. |

Private detailed scripts, before/after logs, XML, SQL schema snapshot, runtime and
captured persisted rows: `/private/tmp/pantopus-stream3-20260915-r2`.
Key files: `backend-baseline.log`, `backend-final.log`, `web-baseline.log`,
`profile-baseline.log`, `profile-repeat-baseline.log`, `web-final.log`,
`android-baseline.xml`, `android-partial-candidate.xml`, `ios-partial-candidate.log`,
`http-sql-results.json`, `browser-report-persistence.json`,
`browser-unblock-persistence.json`, `ios-unblock-persistence.json`, `android-lifetime-baseline.log` (two distinct failures retried3 each;19 executions/6 failures). Browser/simulator interactions are also in the
current **Resume Stream 3 verification** task transcript. No raw logs, fixture
credentials or device tokens belong in Git/chat. Coordinator integrates detailed
contributions into the existing report; this is not a new backlog.

## Remaining N04 work and immediate next action

Next: repair reproduced native delayed-list/late-rollback defects and CI indentation; reproduce coordinator web profile-navigation pending-action lead. Continue installed profile/chat/report and session/departure journeys. Required native models currently have no accepted account
switch/unmount/late-rollback coverage. Do not infer safety from the partial-list fix.

Still open: all existing block entry points, real socket transport/reconnect,
concurrent block versus already-authorized send (cache invalidation is not a SQL
transaction), multi-process cache boundaries, lost successful replies/retry,
actual offline and navigation/account transitions, PersonaBlock cascade lifetime,
report moderation and old/shared/deep-link authorization. Separate scopes retain
existing policy; do not invent profile/bid/message policies from existing UI copy.
The prior account-deletion/UserBlock FK lead remains to reproduce. Home/gig findings
are routed through the coordinator, including the gig chat-room block path.

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

Active reservations: HTTP18130, web18131; exact3 synthetic local public User
fixtures under prefix `f9150300` on SQL64522/API64521. No REST18089 access or
schema/reset/container mutation. An early cleanup attempt used the wrong
UserProfileBlock column and rolled back. Corrected exact-ID cleanup then passed
zero remaining fixture users before restarting for the current native phase.
**Current fixtures remain active and require final cleanup.**

Heavy native slot retained for installed iOS and lifetime work. New simulator
**Pantopus Stream3 Social R2**, ID `0AE16FA0-E244-414F-86C8-24893BDFD979`, iOS26.5.
App build uses explicit API/socket18130 settings; no existing simulator/physical
phone was installed or changed. Owner's iPhone17 remains untouched. Android JVM
run finished; no Android AVD acquired. Generated products and logs are private.
