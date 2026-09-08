# Pantopus project handoff

Updated September 8, 2026. This is the continuing-work entry point. Detailed
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

The first unfinished priority remains the full Beacon staging journey. The
[September 8 evidence report](beacon-full-journey-2026-09-08.md) records 17
passing live API checks, authenticated WebSocket fanout, exact-post returns,
mute/resume, per-Beacon opt-out, Member/revoked/block access, and draft/archive
denial. Physical iPhone foreground, background, closed-app return, old blocked
notification denial, mute/resume, and repeated global push off/restore all have
owner confirmation. Android emulator foreground/background/process-absent
notification taps and old blocked-notification denial also pass.

Draft [PR #10](https://github.com/WangPantopus/skinny-pantopus/pull/10) repairs
hidden fanout throttling, restricted teaser/membership leaks and draft exposure
in the native Beacon feed. API and worker run
`5d911ca48c8fc8466a0e3943aa698f0e4642fca0`; 4,308 backend tests pass (16
skipped), privacy gates pass and [application CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34265566560)
is green. Android revision `58f1978e5751adea21dd24f5c55a792050215f3d` repairs stale registration acknowledgment
retry and decoding of the public Beacon author; all 86 targeted native tests
pass; formatting, Detekt, Android lint and the staging APK build pass. The
rebuilt APK passed a fresh notification tap with the correct public author. Scoped cleanup is complete: 27 posts, 34 notifications,
two new Beacons/accounts and three memberships removed. The original device
accounts, prior notifications and iPhone registration are preserved; Android
is signed out with zero tokens and original preferences restored. The final
[PR checks](https://github.com/WangPantopus/skinny-pantopus/pull/10/checks) track
the Android changes separately from the earlier backend CI. A subsequent
CI timeout exposed a live provider call in the existing Scout fallback test;
its isolation fix passes all 38 Scout tests and changes no runtime behavior.

Full acceptance remains open: there is no Beacon-specific push-only preference,
and physical Android hardware is unavailable. The schema's legacy migration
policy prevents adding its preference migration before baseline adoption; the
report records the concrete remaining contract and verification work. Preserve
the current global feature flag and deployment/migration switches.

Current work is isolated on `codex/beacon-full-journey` in
`/private/tmp/pantopus-beacon-journey`, based on merged master. The main checkout
and all other worktrees/ignored artifacts are preserved.

Start a new session by:

1. Refreshing Git, PR #10/CI and staging observations; preserve unrelated work.
2. Reading the [remaining Beacon preference contract](beacon-full-journey-2026-09-08.md#remaining-beacon-preference-contract)
   and baseline-adoption runbook. Make its additive schema/API/native setting
   implementable under the migration policy; do not mutate frozen history.
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
| Staging API | `https://staging-api.pantopus.com`; API and worker release `5d911ca48c8fc8466a0e3943aa698f0e4642fca0`. Image ID `sha256:01af6b0acabfa658bb6c5b0aaa1069a4da7eec6369f77f5d3d73b1d8c90c5914`. Repository HEAD may be newer than this deployed image. |
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
| 5. Make production upgrade reviewable | Resume the verified local production-copy rehearsal. Produce forward changes, compatibility checks, reference-data/ACL verification, external-file recovery plan, and deploy/rollback manifest. | Resolve four known missing tables (`AnalyticsEvent`, `GigShare`, `ListingShare`, `MailDeliveryIntent`), 35 catalog-gap columns and the additional native-push contract; inventory further application contracts. Preserve legacy production fields/tables and records. Validate grants/functions and adoption policy. No hosted write/cutover until the concrete plan is reviewed and authorized. |
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
