# Pantopus project handoff

Updated September 9, 2026. This is the continuing-work entry point. Detailed
reports below retain their original dates; their historical blockers must not
be mistaken for current status. Refresh Git, CI and infrastructure observations
before changing anything. A merged branch is not a production release.

## Current objective and first action

Finish the existing **Home, Pulse and Beacon** journeys with reliable privacy,
useful behavior at low neighborhood density, and verified return experiences.
The immediate engineering milestone is **Beacon publication → notification →
the exact permitted post in staging**, after integrating the staging recovery
branch. Actual publication and permitted return are verified on the designated iPhone
and Android emulator; the remaining acceptance gates are listed below.

Integration completed in [PR #9](https://github.com/WangPantopus/skinny-pantopus/pull/9)
on September 8 at 08:44 UTC as `a373b10940813bc5deef37b29f67dcc9b6375994`.
The final PR and [merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34206108701)
now pass. Fresh inspection confirms deployment and database switches remain
false in both environments; the backend workflow skipped its rollout steps.
The deployed backend is still a separate release from merged source.

Beacon delivery, exact returns and push preferences now pass on the designated
iPhone and Android emulator. The next executable priority is the remaining
OS-permission, session-return and token-lifecycle coverage. Physical Android and
native composer interaction remain release gates. The
[full journey report](beacon-full-journey-2026-09-08.md) records the repaired live
API/access matrix and owner-confirmed iPhone foreground, background, closed-app,
blocked-old-link, mute/resume and global push off/restore cases. Android emulator
foreground/background/process-absent notification returns and blocked-old-link
denial also pass. Earlier fixtures were cleaned up; original device accounts,
prior notifications and the iPhone registration were preserved.
[PR #10](https://github.com/WangPantopus/skinny-pantopus/pull/10) contains those
repairs and is merged into master as `c9fd509e31b409ced357a83bf6c445a7738eea1b`;
its [final CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34274045637)
passes at `37a49cce82dc2721c736e3a0971f6fe0f4f896f4`.

The [canonical database baseline](database-canonical-baseline-2026-09-08.md)
is adopted in source on [PR #11](https://github.com/WangPantopus/skinny-pantopus/pull/11).
That PR merged into `codex/beacon-full-journey` as `6113691c94279aa9fbafb9566870bbe714f418dd`,
after PR #10 merged. Consequently, master does not yet contain the baseline;
[PR #13](https://github.com/WangPantopus/skinny-pantopus/pull/13), now ready for review, supplies
that integration, including the large-baseline checker repair from PR #12.
Its initial merge tree exactly matched PR #11; both migration-base checks and
six checker tests pass. Its [full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34319428996)
passes at `ea8cfcedaa1007f0d721e51a57b65bf9edc1ee77`. Integrate #13 before retargeting
#12 to master. PR #12 remains unmerged, as the owner confirmed.
Frozen migration bytes are archived unchanged. The two canonical files replay
through the pinned CLI with reference fingerprints matching all 6,467 static
rows, reviewed full function lint, seven SQL contracts and five real
PostgREST/Following integration tests. All [CI jobs](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34293457260)
pass at `f9362cbca55a25ea51f9a1ebbcb60b72fb7fad22`. The linked
[upgrade rehearsal](database-baseline-rehearsal-2026-09-08.md),
[empty replay](database-empty-replay-2026-09-08.md) and
[reference/lint report](database-reference-lint-2026-09-08.md) retain detailed
preservation evidence and verification limits. Hosted canonical ledger adoption
and production cutover remain separate, unfinished work.

The [Beacon push-only preference](beacon-push-preference-2026-09-08.md) is now
implemented across schema/API/web/iOS/Android on draft
[PR #12](https://github.com/WangPantopus/skinny-pantopus/pull/12). Source revision
`65d2cc2d9ab4857e044325315f0023a6d8f4bf54` has fully passing
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34295357368).
Targeted checks include 53 backend tests, privacy gates, four web tests and
TypeScript, 16 iOS tests, 24 Android tests, eight SQL contracts and six real
integrations. Native formatting/static checks pass.

The rehearsed compatible forward changes are applied only to staging: the new
preference column, restrictive Beacon Post policy and service-only grants for
three reviewed maintenance RPCs. Existing preference values and the hosted
migration ledger retained their fingerprints. API and worker now run
`65d2cc2d9ab4857e044325315f0023a6d8f4bf54`, both healthy, with previous containers
retained for rollback. All 20 fresh live API checks pass, including real anonymous/
authenticated PostgREST denial, in-app/WebSocket continuity during push opt-out,
no replay, exact return, mute and access restrictions. These checks used a
fresh token-free follower and sent no device alerts.

Android native preference acceptance now passes. Its settings saved off/restore;
the muted publication had no alert/provider send during 72 seconds but remained
in-app and opened the exact post. Restore delivered only the new publication,
whose notification opened the exact post and public author; the muted post was
not replayed. The audience was limited to the designated emulator and token-free
API follower. Original preferences were restored and compared; normal logout
removed the Android token. Scoped cleanup removed 11 posts, 12 notifications,
one Beacon and two fresh accounts. The two original device accounts, prior
notifications and iPhone registration were preserved.
The emulator is closed. Signed iPhone and Android staging builds pass.
The native walkthrough exposed inactive menu/notification callbacks on Android's
first-run Hub. Revision `8022e9b05253a91a579f52e883e067514843234a` repairs them;
formatting, static checks and the staging build pass. Actual first-run menu →
settings → notification preferences navigation now works without a home. Its
[new CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34298026294)
fully passes at that application revision. The later documentation checkpoint
does not change application code. On resume, the signed staging iPhone build was
verified and installed successfully on the designated device. A fresh synthetic
owner/Beacon now has only the iPhone account as a follower; original preferences
and the existing APNs registration are recorded for preservation. Only that
owner and designated iPhone account are in the beta list; global/internal
enablement remains false. The owner reported initial native toggle saves failed
before later attempts saved. The installed app was reverified, and the API now
holds Beacon push off with global push on. Investigation found an iOS Socket.IO
auth payload mismatch and repeated refreshes exhausting the shared write budget.
The corrected handshake passes a live staging comparison; 50 targeted iOS tests
pass, including bounded socket recovery, session refresh and preference saves.
Revision `e328c33580a1e01f2629210668a1a29de303d80d` is pushed to PR #12;
its [CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34302923001)
fully passes. The repaired signed staging build passed and was installed
successfully; its signature, endpoints and current device registration match.
The owner now confirms the repaired app saved and Beacon push is off. Independent
reads agree, preserving global push and unrelated settings. Native traffic shows
two authenticated socket connections, two preference writes and only one refresh;
the earlier startup burst is absent. One I-off publication has now been sent to
the sole iPhone follower. Its audience row and exact API destination pass; no APNs
acceptance receipt was recorded during 71 seconds. The owner confirms no alert
and the exact retained in-app return, completing I-off. The first restore attempt
was guarded because server push remained off. The owner subsequently reopened
settings, confirmed a durable on value and backgrounded the app; fresh API reads
agreed. I-restored was then sent once at 06:41 UTC. Its single audience row and
exact API destination pass; APNs attempted and accepted one token. The owner
confirms only the new notification arrived and opened that exact post, with no
I-off replay. I-off still had zero provider receipts at 12,032 seconds. Scoped
cleanup removed two posts, three notifications, the fresh Beacon/membership and
creator account. Original iPhone preferences, its account, one APNs registration
and two prior notifications were preserved. Global/internal enablement remains
false and the beta list is empty. Both current preference fixtures are now
cleaned up; do not reuse their deleted creators/Beacons. Prior confirmed iPhone
cases do not need repeating. Two current-source iOS simulator UI checks also
pass: post-login exact return and muted Following → exact Beacon post, using
isolated API fixtures. They do not certify live expired-session recovery. Physical
Android remains unavailable. Documentation-head
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34307328711)
failed on iPhone SE because a settings test used a fixed delay and left its save
running into a later test. The test now awaits the save task; all 16 settings tests
pass five repetitions (80 executions), along with formatting and strict lint.
[Full PR #12 CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34319484968)
passes at `289612d4e37b4b40a4b6753d6f837dca41e5b353`, including iPhone SE.
Installed application code remains at the previously verified revision.
The later documentation checkpoint `d33a33c1a20c47111017d3c6ea0e1f67ded182e7`
also has fully passing [CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34322453803).

The next [platform milestone](notification-platform-verification-2026-09-09.md)
passes Android OS permission denial, retained in-app exact return, permission
restore and delivery without replay through live staging/FCM. A fresh isolated
Android-only fixture exposed a
real bug: login succeeds but loses the requested post and opens Hub. The repair
now passes 148 targeted tests and a fresh live notification → sign-in → exact
post repeat. Its account-bound arrival clears after successful load. Scoped
cleanup removed four posts, five notifications, the fresh Beacon and creator;
normal logout removed the Android token. Original account/device/preferences/OS
permission are preserved, global/internal flags remain false and beta is empty.
Formatting, Detekt, Android lint and the staging build pass; the owned emulator
is closed after cleanup. Draft [PR #14](https://github.com/WangPantopus/skinny-pantopus/pull/14)
contains application fix `9c443b69afb4e0b488491f4d895fcee55ab9cc3c` on
`codex/notification-session-return`, based on PR #12's `d33a33c1a` checkpoint.
Its [CI checks](https://github.com/WangPantopus/skinny-pantopus/pull/14/checks)
are pending. Check them before integration; the source order is #13 → retarget
#12 to master → retarget #14 to master after #12. None has been merged in this
continuation. Then continue the remaining platform states below.
Keep the already revoked sessions revoked; preserve other sessions and the
original AuthDevice. The iPhone preference
fixture is already cleaned up, and its completed checks need no repetition.

Preserve global/internal feature disablement, unrelated local work and both
release/migration switches. Only fresh synthetic fixtures and designated device
accounts may enter the test audience. Do not run baseline DDL on a populated
hosted database or treat this compatible staging expansion as ledger adoption.

Beacon repairs remain on `codex/beacon-full-journey` in
`/private/tmp/pantopus-beacon-journey`. Baseline prerequisite work is recorded on
`codex/database-baseline-adoption`. Its continuing isolated worktree at
`/private/tmp/pantopus-database-baseline-adoption` now uses child branch
`codex/notification-session-return` for the Android continuation repair, branched
from `codex/beacon-push-preference` after its completed preference acceptance,
based on the Beacon branch so its current handoff/evidence are retained. The main
checkout and all other worktrees/ignored artifacts are preserved.
[PR #11](https://github.com/WangPantopus/skinny-pantopus/pull/11), merged into the
Beacon branch but not yet master, contains the canonical source baseline, archived history and required
database CI in addition to diagnostics, SQL contracts and sanitized evidence.
It does not adopt a hosted ledger or deploy the private forward candidate.

Start a new session by:

1. Refreshing Git, PRs #12–#14/CI and staging observations; preserve unrelated work.
2. Reading the [remaining Beacon preference contract](beacon-full-journey-2026-09-08.md#remaining-beacon-preference-contract)
   and [baseline continuation](database-baseline-rehearsal-2026-09-08.md).
   Read the [empty replay milestone](database-empty-replay-2026-09-08.md), then
   read the [reference/lint decision](database-reference-lint-2026-09-08.md), then
   read the [canonical milestone](database-canonical-baseline-2026-09-08.md) and
   verify its exact-head database CI.
   Existing permissions are preserved; new role grants are a separate change.
   Normal-role replay, Home boundaries, explicit ACLs, Beacon storage/RPC
   restrictions and local SQL/integration checks already pass. Read the
   [preference milestone and staging plan](beacon-push-preference-2026-09-08.md),
   verify its CI, then continue OS-permission/session/token lifecycle acceptance.
   Android/API and iPhone preference fixtures and the separate Android platform
   fixture are cleaned up. Inspect the private checkpoint and finish checks on
   the [session-return repair](notification-platform-verification-2026-09-09.md)
   before creating another fixture. Native composer, iPhone OS permission/live
   session return, natural expiry, chat-session and remaining token lifecycle
   coverage remain open; physical Android requires hardware.
   Do not mutate frozen history.
3. Continuing the remaining platform states in the [matrix](beacon-staging-verification-2026-09-07.md#full-beacon-journey).
   Prior fixtures are cleaned up; create fresh isolated fixtures only for the
   next concrete test and verify the audience before sending. Physical Android
   requires hardware; the iPhone cases already recorded do not need repeating.

Suggested new-session prompt:

> Read AGENTS.md and docs/PROJECT_HANDOFF.md, inspect the current branch and PR/CI
> state, and continue the first unfinished priority. Preserve unrelated local
> work and both existing databases. Start with the Beacon staging journey if
> integration is complete. Update the handoff when the milestone is finished.

## Decisions to preserve

- Home, Pulse and Beacon are all product pillars. Address-free social discovery
  and Beacon following must remain available; local posting eligibility remains
  enforced. Do not require a household simply to follow a publisher.
- Private home usefulness must work without recruiting neighbors. Saving a
  public address preview, household membership, residency verification and
  property ownership are separate facts. Entering an address grants no access
  to another household. Keep private/public identity boundaries explicit.
- Preserve authorized Home intelligence: supported ATTOM/property data,
  weather, air quality, alerts, sunrise/sunset and the visual daylight arc,
  environmental and civic/election sections. Existing provider coverage and
  verification/licensing restrictions still apply; availability is not certified
  merely because the UI code remains present.
- Keep setup progressive and destinations durable across login, signup and
  retry. A follow, save or post requires the relevant explicit action. Distinguish
  saved data from delivered reminders, physical mail or completed payments.
- The owner authorized staging recovery on the existing AWS host, designated
  synthetic-device tests, and feature-branch commits/pushes. Existing paid host
  operation was approved; creating new paid resources was declined. The new
  Supabase and Firebase staging projects use free plans. Do not treat that
  history as authorization for new spending or a production database/DNS cutover.
- Screenshots are not required for this milestone. Sanitized textual evidence
  is sufficient; keep secrets and private database contents out of reports.

The [v1 release brief](v1-release-brief-2026-09-06.md) and
[journey audit](v1-journey-audit-2026-09-06.md) define acceptance. Navigation
redesigns in those documents are proposals, not claims about the deployed UI.

## What is complete, and what the evidence proves

| Work | Latest evidence / limits |
| --- | --- |
| Entry continuity and private address saving | Web/native implementations preserve destinations and explicit private saves. Home access/redaction repairs and calendar continuity are integrated through PR #4. Real provider and device scenarios still need release-level coverage. See [web/shared entry](entry-continuity-implementation-2026-09-06.md), [native entry](native-entry-continuity-2026-09-06.md) and [master integration](master-integration-2026-09-07.md). The old six web type errors were fixed; do not reopen them solely from earlier notes. |
| Social discovery and Beacon return | Address-free discovery, following, publication and permitted Following updates exist. See [social discovery](social-discovery-2026-09-06.md), [Beacon return](beacon-return-journey-2026-09-07.md) and [activity reliability](following-activity-reliability-2026-09-07.md). The live API/access matrix and iPhone/Android emulator returns pass; remaining acceptance limits are recorded in the [full journey report](beacon-full-journey-2026-09-08.md). |
| CI and prior integration | PRs #1–#5 are merged, including contrast/brand work, entry/calendar integration and explicit staging configuration. Full CI passed for deployed backend release `9d1fe24dc`; final consolidated-branch CI must be checked separately. |
| Staging infrastructure | Current backend API and separate worker run on the existing AWS host, with isolated Free Supabase, HTTPS and verified renewal, sandbox Lob/Stripe settings, database TLS, real queue schedules and job consumption. No new instance was created. |
| Hosted API contracts | Authenticated API, secure cookies/CSRF, notification ownership/preferences/read state, Home/Hub/Following/identity/device queries, authenticated WebSocket, CORS and Lob webhook signature/replay checks passed. This does not certify email delivery, storage or real postcards. |
| Production preservation | Production backup captured and restored locally in isolation. All 299 archived COPY sections matched restored row counts/hashes. Upgrade rehearsal retained original records but exposed schema gaps. No production schema/ledger/DNS cutover occurred. External file contents are not included in the database backup. |
| Notification opt-out | Both native and legacy token registration preserve existing global opt-outs. Backend regression/privacy tests and real PostgREST checks passed; Android staging exercised opt-out, re-registration and restore. Raw APNs token logging was removed. See [lifecycle audit](notification-lifecycle-audit-2026-09-07.md). |
| Physical iPhone | iPhone 16 Pro, iOS 26.5.2, development-signed Staging build. Actual Beacon foreground/background/closed-app notifications opened the exact permitted post. Old blocked-notification denial, mute/resume and repeated global push off/restore passed with owner confirmation; provider acceptance is recorded separately. |
| Android emulator | Google APIs ARM64 Android 14/API 34. Real FCM chat notifications opened the exact conversation; Beacon foreground/background/process-absent notifications opened the exact post, and an old blocked notification denied access. Global opt-out persisted across registration, restored delivery worked, logout removed tokens, re-login registered again. Physical Android remains unverified; owner has no Android phone. See [Android report](android-staging-verification-2026-09-08.md). |
| Android fixes | `fd9a60dcd` fixes `+` in chat titles and a false security warning after voluntary logout. 98 routing/dispatcher tests and 93 auth/matching-view-model tests passed; lint/build and final emulator checks passed. This is targeted evidence, not final all-surface CI. |

## Environments and release identity

| Environment | Recorded state |
| --- | --- |
| Production database | Supabase `ankjdyvoduutkhhaxvhx`; existing users/data must be preserved. Resumed after pause; session-pooler TLS connection and backup verified. Current application schema is not ready for the new backend. |
| Existing testing database | Supabase `gzzdqechcbfpalfvgyro`, “Pantopus-backend”; preserve it. It is not production and is not the new staging runtime's database. |
| Isolated staging database | Supabase `ptudkfqdhqpkbkzqlabu`, “Pantopus-staging”; synthetic test accounts plus permitted reference data, no copied real user records. |
| Staging API | `https://staging-api.pantopus.com`; API and worker release `65d2cc2d9ab4857e044325315f0023a6d8f4bf54`. Image ID `sha256:c7d81368d0fac60b73134c0fd3d0243696de6fef4cb40ed6e32bf0c8f9a527f5`. Repository HEAD may be newer than this deployed image. |
| AWS host | Existing Oregon EC2; staging API binds `127.0.0.1:18001` behind nginx; worker has no public port. Container names `pantopus-backend-staging` and `pantopus-worker-staging`. Original production container is retained. Exact host/access details are in the private operator handoff. |
| Production DNS | Last inspected production API DNS points to the old address and times out. Fixing DNS alone would route users to an obsolete backend. Reconcile production first, then perform a planned cutover. |
| GitHub automation | On September 8, both production and staging have `BACKEND_DEPLOY_ENABLED=false` and `DB_MIGRATIONS_ENABLED=false`. Merging source does not deploy while these switches remain false. Re-read them before merging/enabling releases; do not enable deployment to make a source PR mergeable. |
| Firebase | `pantopus-staging`, free Spark; debug Android package `app.pantopus.android.debug`. FCM is used for Android push, not Firebase Auth/database. A narrowly scoped sender key exists privately. The approved temporary project-only key-creation exception was removed and the inherited block restored. |
| Apple push | Sandbox APNs, topic `app.pantopus.ios`; signed app entitlement is development. The supplied WeatherKit and Sign in with Apple keys could not send push. A separately approved APNs key is active; do not substitute the older `.p8` files merely because they parse. Distribution/TestFlight requires separately matching credentials/entitlement. |

Numbered migration 152's `PushToken.platform` / `provider` change was rehearsed
transactionally and applied only to staging. Earlier comparison against staging
missed this contract because both old databases lacked it. Include it in the
production gap audit; the historical migration ledger was not altered.

## Ordered backlog and exit criteria

| Order | Deliverable | Exit criterion |
| --- | --- | --- |
| 1. Integrate this branch — complete | PR #9 merged as `a373b1094`; final PR and merged-master CI pass. | Current work starts from merged master. Deployment/migration switches remain disabled. PRs #6–#8 remain separate review housekeeping; do not treat their state as a blocker to Beacon verification. |
| 2. Beacon end-to-end staging | Dedicated creator and address-free follower publish/read/follow/mute/return through the actual staging API and native UI. | One stored post ID matches Following, audience notification and opened post. No unrelated recipients. Mute/global/type opt-out and restore work; restricted membership and revoked/block access deny correctly, including old notification taps. Record every case in the linked matrix. Do not enable feature flags globally simply to populate fixtures. |
| 3. Finish released-platform notification coverage | Actual post/chat destinations, foreground/background/ordinary cold start, denied permission, expired session/login continuation, token rotation/logout and relevant settings UI. | Exact permitted destination opens on each released platform/state; unread behavior is coherent. Owner confirms physical iPhone observations; physical Android remains explicitly pending until hardware is available. Emulator results are useful but not physical acceptance. |
| 4. Finish isolated vendor/account flows | Safe staging signup/recovery/verification email and real OAuth callbacks; isolated media/document storage; reachable sandbox payments and address-verification states. | New user can authenticate/recover, upload/read only authorized files, and complete reachable test-mode actions. Failures/retries are visible and idempotent; no live charge or postcard is triggered by staging. Use existing/free capacity unless further spending is authorized. |
| 5. Make production upgrade reviewable | The [canonical baseline](database-canonical-baseline-2026-09-08.md) completes local gap repairs, object/reference/ACL comparison, fresh replay, function gates and original-value preservation. Remaining work is per-environment hosted upgrade/ledger adoption planning, external-file recovery and hosted Auth/storage configuration verification, plus deploy/rollback plans. | Preserve legacy production fields/tables and records; reconcile the final release's migrations and platform dependencies. Local replay and compatible staging expansion do not complete hosted ledger adoption. No hosted production write/cutover until the concrete plan is reviewed and authorized. |
| 6. Complete v1 journeys and reachable features | Run Home/Pulse/Beacon acceptance on release candidates; inventory adjacent mailbox, tasks, marketplace, payments and household actions. | Address-free paths, private-address boundaries, correct calendar outcomes, exact-content returns, error/retry/accessibility and real provider coverage pass. Finish or honestly constrain unfinished reachable operations; preserve records, balances and entitlements. |
| 7. Release/pilot | Tie exact web/iOS/Android builds, backend, migrations, flags and rollback together; configure deployment only after its prerequisites. | Approved production cutover and post-deploy checks pass; small consenting pilot measures actual first value and voluntary returns. Passing engineering tests alone is not product-market fit or proof every feature is finished. |

The owner has a separate, uncommitted proposal at
`docs/pantopus-next-stage-design-2026-09-08.md` in the main Mac checkout. It
explores coherent Home/Nearby/Following/Inbox destinations, a private note →
public question → private bookmark journey, and reviewed personal calendar
saves from Beacon events. It explicitly describes new work, not a release.
Preserve it and review it with the owner before treating its label choices,
personal-record contracts or implementation packages as approved scope. Do not
copy it into this recovery PR incidentally. The current v1 gates above remain
the immediate direction unless the owner changes priorities.

## Evidence index and local continuation

Public, versioned reports contain sanitized findings rather than raw secrets:

- [Recovery, backup/restore, schema gaps and runtime](backend-recovery-2026-09-07.md).
- [Local baseline prerequisite expansion and SQL contracts](database-baseline-rehearsal-2026-09-08.md).
- [Staging inventory, native setup and physical iPhone record](staging-notification-setup.md).
- [Android delivery, navigation, opt-out and logout record](android-staging-verification-2026-09-08.md).
- [Beacon live results and fixes](beacon-full-journey-2026-09-08.md) and
  [scenario matrix](beacon-staging-verification-2026-09-07.md).
- [CI/CD setup](ci-cd.md) and [migration adoption runbook](supabase-migration-automation-runbook.md).
- [Following query validation](following-activity-reliability-2026-09-07.md) and
  [notification lifecycle audit](notification-lifecycle-audit-2026-09-07.md).

On the owner's Mac, the private durable evidence root is
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/`.
Start with its `OPERATOR_HANDOFF.md`. It indexes backups, schema rehearsals,
operator logs, private test-account fixtures, push configuration and native test
evidence. Keep these materials private; some logs and SQL archives include
credentials or application records. They are not part of a Git clone. A new
machine needs a separately authorized private transfer and its own access.

The current Beacon checkout is `/private/tmp/pantopus-beacon-journey`; the
prior recovery checkout `/private/tmp/pantopus-current-backend-release` is retained. Temporary build files live in
`/private/tmp/pantopus-native-staging-build`; do not assume either survives a
restart. The branch is pushed and key evidence is copied to the durable private
root. If the checkout is gone, create a fresh feature worktree from current
master after confirming the integration state; never reconstruct code from logs.

Fresh September 8 inspection finds the main checkout
`/Users/yingpengwang/skinny-pantopus` clean on merged master. Preserve ignored
artifacts, the product-design proposal and all other worktrees. Do not reset,
clean, stash wholesale or incidentally commit unrelated files.

Native rebuild commands and environment selection are in staging setup. Android
uses ignored `.env.staging` and `app/src/debug/google-services.json`; iOS uses
the Staging scheme and generated private overlay. Operator scripts may send or
mutate when executed: inspect their intended action, recipient and idempotency
marker before reuse. The Android test app ended signed out with zero registered
tokens and its original push preference restored; the designated iPhone token
remains. Inspect fresh registration state before another send.

## Keep this handoff current

After each milestone, update the top next action, exact commit/deployment state,
results and remaining coverage. Add a dated report for substantial work and
link it here. Record blockers with the concrete next action and any required
owner input. Keep proposals distinct from implementation and device acceptance.
Refresh private operator state when credentials, server configuration or test
fixtures change. Do not append an unfiltered chat/tool transcript: the indexed
reports and private evidence are the durable record.
