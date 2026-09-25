# CURRENT STREAM 3 STATUS — 2026-09-25 peer session (supersedes the 2026-09-22 summary below)

Stream 3 is an independent peer. It reports to the user; Stream 1 runs the serial merge queue. This is the live Stream 3 status location; the detailed history below stays as it was.

## Git and integration (master `02abf6bd3`)

- **PR427:** web booking actions, merged through batch PR431. The resolved booking-detail file matches the exercised 417+427 runtime.
- **ID mapping:** sent to Stream 1 and accepted.
  - Closed: S3-03, S3-04, S3-05 (batch428: 411/417/421) and S3-44 (427).
  - Partial: S3-18 (web only).
  - Ledger per Stream 1: 96 merged / 59 unfinished.
- **[PR436](https://github.com/WangPantopus/skinny-pantopus/pull/436):** native scheduling truth, head `45c492d4e2f09cc40e038cf58ac94a316537e898`, CI pending at open, offered to Stream 1 for batch 13. Real-app afters passed on iOS and Android.
  - Bundle `20260925-stream3-scheduling-automation-truth-r1`, MANIFEST.json SHA-256 `aed2e2cde9ee96fc322c15bc09433f89d18d57f5005feabd70c582e76739ee11`.
  - Covers S3-51 native, S3-52 partial and two new findings (invented Booking settings values; the Android policy editor's wrong owner).
- **Local branch `claude/stream3-social-confirm-and-requests`** (`/private/tmp/pantopus-stream3-social-r1`): S3-58 (profile block confirm) and S3-63 (connection-request link opens Requests), iOS and Android.
  - Befores reproduced on both installed apps.
  - Needs one heavy build, then afters and PR.
- **Local branch `claude/stream3-web-load-failures`** (`058be0ec2`): S3-40 list, S3-41, S3-45.
  - Pending: web before/after (needs a heavy Next warm-up turn), S3-51 web settings parity, and the S3-63 web variant.

## Runtime (private, `/private/tmp/pantopus-stream3-s351-runtime-20260925-r1`)

- **API 18134:** runs from the Stream 3 worktree; its backend tree equals master. Jobs, cron and providers are off, and keys are minted in memory from the stack JWK.
- **No-send proxy 18130:**
  - Reads pass through, except write-capable GETs: availability, and booking-page for anything but Owner's personal page.
  - Mutations are refused, except local auth and the template preview POST.
  - Socket upgrades are refused.
- **Retained DB `pantopus-stream3-block-r1`** (64531/64532): the Personal draft BookingPage `807dd420…` and 6 IdentityAuditLog rows are intact.
- **Devices:** iOS 0AE16FA0 and emulator-5554 are shut down, device slots released, heavy released.

## Side effects this session

- Auth bookkeeping from login, refresh and logout.
- One default `UserPrivacySettings` row for Owner, created 2026-09-25 21:18:59.308287Z when Privacy was opened. Exact cleanup awaits the user: `user_id='81990c03-c41b-4026-ad07-ad82c1ef896d' AND created_at='2026-09-25 21:18:59.308287+00'`.
- One PlaceSectionCache refresh.
- No scheduling, template, workflow, booking, block or relationship rows. The block POSTs in the S3-58 befores were refused before upstream.

## New findings and candidates

- **Fixed in PR436:** Booking settings stated invented values, and the Android policy editor could create a bogus business page.
- **Product decision with the user:** workflows and templates are stored but nothing executes them. A = honest copy, B = hide.
- **Handed to Stream 1:** homeowner iOS can't reach You, and Android tall sheets draw under the status bar.
- **S3-63 web variant (to verify):** `/app/connections?tab=requests` matches no web tab key, so the page likely renders no tab and an empty body.
- **Candidates:**
  - Template editors discard a non-empty draft without confirmation.
  - The Android page DTO types `cancellation_policy` as a String.
  - Auto-created pages default to America/New_York.
  - iOS login "Not you?" removes that account's stored session and shows the next remembered account (reported by Stream 1; to reproduce).

## Next

1. Social build (heavy after Streams 2 and 1), then afters and PR.
2. Web before/after (S3-40/41/45, S3-51 parity, S3-63 web) and a PR.
3. S3-60 (iOS Edit profile swipe discards edits) with the next iOS turn.
4. Needs the user's go-ahead: one scoped zero-cost fixture set in the isolated DB for S3-50/52/57/48/43 and the S3-51 no-show CTA, plus the privacy-row cleanup.

# CURRENT STREAM 3 RESUME SUMMARY — 2026-09-22

This is the current handoff point. It supersedes older opening paragraphs and stale “pending”
wording below while preserving the detailed history and evidence links. Stream 3 is not a whole-app
closure claim; it is ready for coordinator integration review with the explicit open boundaries here.

## Git, application and merge state

- **Application worktree:** `/private/tmp/pantopus-workstream-accounts-social`, branch
  `local/stream3-ios-integration`, `HEAD=b956a00767835586b5114698a3a2e91fbcddefad`. It has
  unrelated existing local web changes in `frontend/apps/web/src/lib/publicShare.ts`,
  `frontend/apps/web/tsconfig.json` and untracked `frontend/apps/web/.next-stream3/`; preserve
  them and do not reset or fold them into Stream 3.
- **Android worktree:** `/private/tmp/pantopus-stream3-android`, branch
  `local/stream3-android-integration`, clean at `HEAD=3b374454ad07060cf5dcaa1ce02fc48b3be4c88e`.
- **Live coordination worktree:** `/Users/yingpengwang/pantopus-coordination`, branch
  `codex/workstream-coordination`; this file is the only live Stream 3 status location. The
  current status commits are pushed to `origin/codex/workstream-coordination`.
- **PR195:** [merged](https://github.com/WangPantopus/skinny-pantopus/pull/195) by the coordinator at 22:05 UTC as
  `86f63a0eaf70dfc808950649aae34ef45015c985` after update to `7f557a0069` and fresh exact-head CI `35786420151`
  (Android lint/test/assemble, emulator tests, schema replay and aggregate CI OK). The earlier head
  `3b374454a` CI `35768401037` also passed. The Android worktree was fast-forwarded (clean) to `7f557a006`.
- **Merged scoped repairs:** PR163 → `e5335f584dd99f82e7c66a3974b04400098f0c0c`; PR168 →
  `b30e0d395`; PR178 mailbox route order → `715ccd8c0`; PR182 profile PATCH contract → merged
  remotely at head `7b6ddc6516769e02d12b6eff37f52fb0d326455e` on 2026-09-22. The older PR182
  paragraph below says “no merge” because it predates that merge; treat this summary as current.

## Grouped implementation repairs and source bindings

- **Cache invalidation:** existing `backend/routes/blocks.js` and
  `backend/routes/neighborMessages.js`; PR163 repaired block/unblock feed-filter invalidation
  without redesigning the cache or schema.
- **Android social safety:** existing
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileViewModel.kt`
  is the sole PR195 production diff. It scopes the personal `UserBlock` visibility guard to Local
  profiles and fails closed when `/api/users/blocked` is unavailable; Persona/Relationship scopes
  remain distinct. The earlier Detekt-only extraction is in the merged PR168 Android path.
- **Profile PATCH contract:** existing `backend/routes/users.js` commits `26fe9d57f` and
  `b956a0076` return the canonical user projection and emit `PROFILE_READBACK_UNAVAILABLE` after
  a write when UserSkill readback fails. No DTO, UI, schema or migration replacement was added.
- **Mailbox:** PR178’s existing route-order repair is integrated; Stream 3 made no duplicate
  mailbox implementation.

## Earlier Stream 3 coverage retained for integration review

The table below groups the earlier merged work and its accepted evidence so the next agent can
continue from the existing implementation and reports rather than repeat the same journeys. The
PR links identify the source revisions; the detailed reports and bundle indexes remain the
evidence of behavior and limits.

| Area and existing source contract | Merged work and retained evidence | Current boundary |
| --- | --- | --- |
| Auth/session callers, web session state, native sign-in and deliberate logout | [PR65](https://github.com/WangPantopus/skinny-pantopus/pull/65), [PR82](https://github.com/WangPantopus/skinny-pantopus/pull/82), [PR136](https://github.com/WangPantopus/skinny-pantopus/pull/136), [PR138](https://github.com/WangPantopus/skinny-pantopus/pull/138), [PR145](https://github.com/WangPantopus/skinny-pantopus/pull/145), [PR149](https://github.com/WangPantopus/skinny-pantopus/pull/149), [PR151](https://github.com/WangPantopus/skinny-pantopus/pull/151), [PR152](https://github.com/WangPantopus/skinny-pantopus/pull/152); retained browser/native evidence covers account-deletion confirmation, unavailable security records, logout/session-expiry feedback, push registration after sign-in, resend verification and iOS deliberate sign-out. | Apple/Google callback, provider cancellation/revocation and physical-device/keychain behavior remain unverified; A01/A02 stay partial. |
| Web social, chat, feed, map, profile, marketplace and Beacon callers | [PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51), [PR64](https://github.com/WangPantopus/skinny-pantopus/pull/64), [PR65](https://github.com/WangPantopus/skinny-pantopus/pull/65), [PR66](https://github.com/WangPantopus/skinny-pantopus/pull/66), [PR67](https://github.com/WangPantopus/skinny-pantopus/pull/67), [PR69](https://github.com/WangPantopus/skinny-pantopus/pull/69), [PR70](https://github.com/WangPantopus/skinny-pantopus/pull/70), [PR73](https://github.com/WangPantopus/skinny-pantopus/pull/73), [PR83](https://github.com/WangPantopus/skinny-pantopus/pull/83), [PR84](https://github.com/WangPantopus/skinny-pantopus/pull/84), [PR85](https://github.com/WangPantopus/skinny-pantopus/pull/85), [PR86](https://github.com/WangPantopus/skinny-pantopus/pull/86), [PR88](https://github.com/WangPantopus/skinny-pantopus/pull/88), [PR89](https://github.com/WangPantopus/skinny-pantopus/pull/89), [PR90](https://github.com/WangPantopus/skinny-pantopus/pull/90), [PR91](https://github.com/WangPantopus/skinny-pantopus/pull/91), [PR93](https://github.com/WangPantopus/skinny-pantopus/pull/93), [PR94](https://github.com/WangPantopus/skinny-pantopus/pull/94), [PR95](https://github.com/WangPantopus/skinny-pantopus/pull/95), [PR96](https://github.com/WangPantopus/skinny-pantopus/pull/96), [PR97](https://github.com/WangPantopus/skinny-pantopus/pull/97), [PR99](https://github.com/WangPantopus/skinny-pantopus/pull/99), [PR105](https://github.com/WangPantopus/skinny-pantopus/pull/105), [PR107](https://github.com/WangPantopus/skinny-pantopus/pull/107), [PR111](https://github.com/WangPantopus/skinny-pantopus/pull/111), [PR114](https://github.com/WangPantopus/skinny-pantopus/pull/114), [PR115](https://github.com/WangPantopus/skinny-pantopus/pull/115), [PR117](https://github.com/WangPantopus/skinny-pantopus/pull/117), [PR178](https://github.com/WangPantopus/skinny-pantopus/pull/178), [PR186](https://github.com/WangPantopus/skinny-pantopus/pull/186); retained browser/API/SQL evidence covers reports, failed drafts, search, profile authorization, chat destinations, feed filters, Beacon links/comments and stale-handle recovery. | Owner-routed Marketplace, Home, payment, booking, wallet and subscription actions remain with their owning streams; provider/native release evidence is limited. |
| Scheduling, reminder preferences and booking notification routes | [PR72](https://github.com/WangPantopus/skinny-pantopus/pull/72), [PR75](https://github.com/WangPantopus/skinny-pantopus/pull/75), [PR77](https://github.com/WangPantopus/skinny-pantopus/pull/77), [PR80](https://github.com/WangPantopus/skinny-pantopus/pull/80), [PR81](https://github.com/WangPantopus/skinny-pantopus/pull/81), [PR101](https://github.com/WangPantopus/skinny-pantopus/pull/101), [PR103](https://github.com/WangPantopus/skinny-pantopus/pull/103), [PR120](https://github.com/WangPantopus/skinny-pantopus/pull/120), [PR126](https://github.com/WangPantopus/skinny-pantopus/pull/126), [PR129](https://github.com/WangPantopus/skinny-pantopus/pull/129); retained worker/source, retry, preference, local SMTP and paused-host evidence is indexed in the N05 sections. | No claim of a settled daily-agenda producer/recipient/channel policy or physical delivered reminder; natural-timer evidence remains bounded to the recorded local run. |
| Native notifications, Pulse/Beacon and profile safety callers | [PR164](https://github.com/WangPantopus/skinny-pantopus/pull/164), [PR165](https://github.com/WangPantopus/skinny-pantopus/pull/165), [PR166](https://github.com/WangPantopus/skinny-pantopus/pull/166), [PR167](https://github.com/WangPantopus/skinny-pantopus/pull/167), [PR168](https://github.com/WangPantopus/skinny-pantopus/pull/168), plus the open [PR195](https://github.com/WangPantopus/skinny-pantopus/pull/195); retained installed-emulator evidence covers N01 local notification controls and local social identity/follow/post/reply/mute boundaries. | N02 still needs physical Android notification acceptance; N01 release/device states, N03 release-candidate cohort, and wider N04 native/socket/provider lifetime remain open. Emulator evidence is local/emulator evidence only. |
| Block/unblock cache and safety endpoints | [PR163](https://github.com/WangPantopus/skinny-pantopus/pull/163) retained the existing `blocks.js`/`neighborMessages.js` contracts and real browser → HTTP → PostgREST/SQL cache evidence. | Hosted moderation/provider processing and remaining entry-point/socket coverage are not claimed. |
| Profile persistence and provider-backed storage/address boundaries | [PR182](https://github.com/WangPantopus/skinny-pantopus/pull/182) retained the existing `users.js` PATCH contract and installed 503→200 readback retry; A03/A04 retained chooser/S3 failure and address-provider-unavailable UI/API evidence. | Hosted storage success/lifecycle and activated Smarty/geography/unit success remain unverified; the A04 literal `%20` street fixture is explicitly not a geography-success claim. |

## Evidence and runtime bindings

Durable evidence is at
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1`.
The verified bundle has 198 files and MANIFEST SHA-256
`1fa796d1b6f08e89b549f0aadf0f6986241fbd511184ff2825dc889071957f26`; raw logs, credentials,
tokens and database archives remain outside Git/chat. Operational receipts are under
`/private/tmp/pantopus-stream3-20260920-r1`.

Accepted real boundaries include: PR163 web screen → HTTP → PostgREST/SQL cache behavior;
installed Android notification list/filter/read/delete/Cancel/offline rollback/retry and induced
HTTP-5xx rollback/retry; Android local-neighbor block → Settings → fresh deep link with fail-closed
blocked-list read fault; Pulse/Beacon/follow/post/reply/mute and identity separation; A03 chooser →
real multipart portfolio upload reaching the existing S3 credential failure with zero File rows;
A05 installed profile PATCH 503 preserving two unsaved values → same-form 200 retry; A02 cold-process
session restoration and logout; and A04 route plus installed Add Home provider-unavailable result,
retry, draft preservation, disabled continuation and discard/logout.

Source/APK/device bindings: Android repair source head `3b374454a`; installed repaired APK
SHA-256 `2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`; earlier retained
notification APK SHA-256 `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`;
Android device `emulator-5554`; retained iOS simulator `Pantopus Stream3 Social R2`, UDID
`0AE16FA0-E244-414F-86C8-24893BDFD979`. Intended local ports are API `18130`, Next `18131`,
SQL/Postgres `64532`, PostgREST `64531`, Mailpit `64535/64536`; API and Next are currently stopped,
while the retained local Supabase/Mailpit containers remain available for an assigned runtime.
The N03 release-build/native slot has not been reassigned and no build should start here.

The current native bundle above is authoritative for the latest installed work. Earlier retained
indexes remain applicable where their source/configuration is unchanged: the 20260915 social
bundle [current MANIFEST](../../../skinny-pantopus/.pantopus-recovery/audits/20260915-stream3-social-r2/MANIFEST.json) is `f5ac697ba9f06552aeda14b1bbfa01f4b795779817bcf4f9bbe1e368956bac13`; the
20260920 accounts/social [current MANIFEST](../../../skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/MANIFEST.json) is
`09b2c346c28031033c2943bacfb85ae7ae54b5cba4bef232df18b039b210971c`. These are file hashes re-read
at consolidation; older a6534761/cca38fc2 values below identify earlier bundle snapshots, not
the current manifest bytes. Earlier artifacts keep their own original source and runtime limits.

Fixture cleanup is recorded: N03 block/home/occupancy/overlay counts zero; N01 local/emulator HTTP-5xx target
removed after successful retry; A03 Bob File rows zero after S3 failure; A04 temporary HomeAddress,
Home and AddressClaim rows zero; A05 Bob first/last/middle/bio restored, zero UserSkill rows and
privileges restored; every exercised account logged out and local API processes stopped.

## Current authoritative acceptance accounting

The exact quoted N01–N05/A01–A05 criteria and evidence mapping are in the “Exact ten-row acceptance
mapping for next handoff” section below. Current state is: N01 release/device notification states
remain partial; N02 physical Android remains open; N03 release-candidate Pulse/Beacon cohort remains
open; N04 moderation processing, wider entry points and full native/socket/provider lifetime remain
open; N05 daily-agenda delivery has no settled producer/recipient/channel policy; A01 external
Apple/Google callbacks remain open; A02 provider/device revocation combinations remain open; A03
hosted storage success/lifecycle remains open; A04 legitimate unavailable handling is accepted but
activated Smarty/geography/unit success remains open; A05 owner-routed Marketplace/subscription/
booking/wallet/mail/search/Home/payment actions remain open. Unit-test coverage is excluded from
these functional/evidence estimates and no new unit tests were written.

## Next actions and explicit non-actions

PR195 is merged (`86f63a0ea`). **Assigned next (coordinator, 22:45 UTC): iOS parity of the PR195 defect.** iOS
`PublicProfileViewModel.loadRelationship(id:)` reads only `/relationship` and leaves `canFollow` true on error.
Reproduce on installed iOS `0AE16FA0` first, then mirror PR195 minimally (Local scope only) only if it reproduces. The heavy
native slot goes to Stream 3 next; details are in the coordination summary's current resume point. The next agent may
use the exact prerequisites in the final section below, preserve accepted reports, and repair only a
reproduced defect in the existing caller/endpoint/service contract. Do **not** rerun the accepted
PR163 cache journey, PR168 Detekt repair, PR195 local block/read-fault journey, N01 local/emulator
notification matrix, A03 S3 credential failure, A04 provider-unavailable variants, A05 profile
503→200 retry, or A02 cold-process pass. Do not start a native build without the reassigned slot;
do not activate providers, purchase services, run hosted migrations, add schema, redesign UI, add
unit-test files, or merge independently.

Known boundaries/inconsistencies are deliberate: the A04 UI used literal `%20` street input from
ADB, so it does not claim normal geography success; the installed APK is debug, not release
candidate; green PR195 CI does not claim skipped backend/web/iOS jobs; and historical sections below
retain their original timestamps and limits.

# Stream 3 — Accounts, social and notifications

Current September21 10:33UTC: approved isolated natural scheduler check completed
and exact fixtures/messages cleaned; final evidence/limits appended below. Prior
source-only/pending paragraphs are historical. Stream remains incomplete; unchanged
b409 source and retained runtime preserved, no new application edits.

Updated September21 — **Stream incomplete; ongoing verification.**
Sole live status remains this neutral coordination file. No new unit tests written.
Application `/private/tmp/pantopus-workstream-accounts-social`, separate branch
`codex/stream3-scheduler-reconciliation` at released master
**b409bc9190dd43bbdcee0cdba8f307ae959d2dc3**, tracked clean plus owned .next-stream3.
Coordinator integrated PR120 as246407e8e, PR121e61cffed6 and docs119→b409 after exact
gates. All earlier feature refs preserved. Current assignment source-only N05 scheduler/
daily-agenda reconciliation, no new runtime or application edit. Retained API18130/PID7996
was started before this source-only adoption; Next18131/PID14742 and Supabase64531–37
remain reserved. No natural scheduler test yet, no native/provider/full-stream closure.

## N05 scheduler/daily-agenda source reconciliation and isolation proposal

Source-only README assignment followed. Seven current/master/paid/staging/place/Beacon/
originalfc99 revisions map jobs/index.js, bookingReminders, schedulingNotifyPrefs,
bookingNotifyService and web notificationPrefs. All register bookingReminders with
real node-cron UTC3,18,33,48 * * * *; neither pg-boss nor Lambda exclusion set includes
it. app.js starts jobs after listening unless CRON_ENABLED=false; test environment skips.
Installed node-cron4.2.1. Retained local runtime CRON_ENABLED/PGBOSS_ENABLED=false,
SMTP127.0.0.1:64535. No environment changed or jobs activated.

Worker first globally completes past confirmed Bookings, then scans confirmed bookings.
BookingPage.reminder_minutes precedes host reminder_lead_times; current <=8minute early
allowance/120minutecatchup/up-to30day offset and booking/kind receipt remain. Host
notify_me.reminder gates existing notification; invitee savednotification/email is separate.
Accepted earlier manual-worker/SQL/localSMTP/offset/retry/cancellation evidence remains
valid but does not establish natural registration execution or whole-app startup.

Web daily_agenda row promises each morning8am in all7refs, with no backend daily-agenda
keyword consumer found. Current iOS/Android explicitly label existing booking_request
as Booking request after older misleading Daily agenda copy. This is a separate unresolved
contract, not proof that an implementation is absent or authorization to build a digest.
No native execution or worker pause/hostemail/attendee/daily-agenda delivery acceptance.

Proposed natural-cadence check, **not started; coordinator approval pending**:
private child loads unchanged jobs/index.js; allow only wrapped jobName bookingReminders
through to real node-cron, record/skip other registrations. Fail-closed transport query
isolation adds exact temporary Booking id to every Booking read/PATCH, including completion
sweep. One future owned temporary booking uses existing read-only account/page/event;
real wall clock waits for next original UTC tick, no manual invocation/time advance.
Observe callback/ownedlog+notice/localSMTP, stop task after completion, verify original
retained rows unchanged and no unexpected additions, clean exact new IDs. Isolation
wrappers are synthetic boundaries: natural selected-job timing only, not unmodified
all-jobs app startup or hosted provider delivery. Alternative emptyDB/PostgREST expansion
would need new runtime assignment/replay; not acquired. Never enable all cron on retainedDB.

Private scheduler-source-reconciliation.json contains exact revision/sourcehash map;
mirror now495files, allhashverified, MANIFEST **c73d600dc87b9d4f140feaad01dda2422e0a2fb64a5799c5a087da3b81c1e2fb**.
No app/harness/fixture/schema/provider mutation, no new tests or repeated acceptedjourney.
Next: coordinator reviews contract/isolation before any runtime expansion; continue to
preserve N01–N05/A01–A05 platform/provider/session limits below.

## Scheduling Resume persistence — PR120 handoff

Exact component-only grant recorded README661ada630 after real no-PUT/unchangedSQL/
reloadbaseline. Seven existing/archive/open Resume callbacks identical. Only existing
NotificationPrefsForm changed: import existing readGroup, derive paused from existing
prefs, call existing serialized persist with scheduling spread/paused:false. Existing
rollback/owner generation handles the banner along with all preferences. Normal controls,
layout and navigation preserved; no backend/SDK/schema/newfile/unit test/worker edits.

Actual Bob GoTrue/browser(tab18)→SDK→existing preferencesPUT→PostgREST/SQL:
UPDATEdenial then two keyboardResume attempts produce500 at09:24:03.952 and09:24:27.828;
paused banner/disabledcontrols return and originalJSON remains exactlyunchanged. Restore
UPDATE, keyboardretryPUT200 at09:25:02.544 saves paused:false, preserves nestedhost channels,
notify_me.reminder and unrelated sentinel key. Fullreload no pausedbanner/Resumebutton,
reminderpush/email remainenabled. This verifies persisted Resume state, not paused worker
or notification delivery. SQL seeded pausedfixture; no pause-creationUI claim.

Installed TypeScript --noEmit and scopedESLint both exit0/emptylogs; diffcheckpass.
No new unit tests. Reuse unchanged PR103 read/save/retry and reminder-offset evidence;
no broad suite repeats. New intact held-response account-switch/departure/native checks
not performed; current owner-generation/serializedqueue behavior reused unchanged.
No SMTP/provider/worker execution or pause-delivery policy expansion.

Cleanup: exactabf9180d-de0c-4251-af8d-9a0801f616ba removed, originalBobpreference
absence0 restored; UPDATEgrant restored, tab18closed. Original bookings/page/otherfixtures
untouched. Private scheduling-resume-final-evidence.json binds5sourcehashes, comparison,
baseline,failedwrites,savedJSON,actualUI/fullreload,checks/cleanup/limits. Durable
**493files** hashverified, MANIFEST
**01c10c465af654c5d6220bdb808dd365afc88f0bad15d2f629ac482c070e133d**
in existing accounts-social-r3 mirror. Older artifacts retain ownsource/runtime limits.
Next: exact120CI and coordinatorreview; featuremerge held behind paid a795 fullCI35582693975.
Whole N01–N05/A01–A05 provider/native/session/delivery acceptance remains open below.

## N05/A05 Scheduling Resume — actual baseline, no application edit

README granted existing NotificationPrefsForm/PauseBanner runtime-only verification.
Actual Bob real GoTrue UI /app/scheduling/settings/notifications loaded saved
SchedulingNotificationPreference.prefs.scheduling.paused=true: banner and disabled
matrix. Keyboard Resume hides banner/enables controls; HTTP log records no preferences
PUT, and SQL JSON remains exactly unchanged including paused=true. Full reload restores
the banner/disabled controls. No worker/SMTP/provider execution or delivery-policy claim.
State was SQL seeded; no pause-creation UI claim. PR103 key retention/read/save/retry
and prior reminder offsets/delivery evidence reused within their unchanged boundaries.

Existing screen→SDK get/updateNotificationPreferences→scheduling.js GET/PUT
/notification-preferences→existing preference JSON contract traced. Seven current/master/
paid/staging/place/Beacon/originalfc99 Resume callbacks identical and local-only.
Proposed smallest existing component repair: call existing serialized persist with
nested scheduling spread/paused:false, derive banner state from prefs so existing
optimistic/confirmed rollback and owner generation retirement apply. Assignment pending;
no app edit/new file/test/schema/worker/global notification policy change.

Exact temporary preference **abf9180d-de0c-4251-af8d-9a0801f616ba** removed; original
Bob preference absence restored0. Unrelated keys stayed unchanged, no privileges changed,
tab17closed. Original booking/page/fixtures retained; no peer runtime touched.
Private scheduling-resume-fixture.json, after-click.json, baseline.json and source-
comparison.json bind source, original state, HTTP/SQL and actual UI history. Durable
**486files** hashverified; MANIFEST
**09b13897635dfc265f6a5941a715ef02e7db102bf28f042677840b968eee6349**
in existing accounts-social-r3 mirror. Latesthead does not rebind older evidence.
Next: coordinator component-only proposal review; if granted, actual UPDATE failure/
rollback/retry, persisted Resume/fullreload and unrelated-key preservation. Worker pause,
channel delivery and native/session-held-response acceptance remain separate/unverified.

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

## PR117 final exact-head CI

AutomaticCI35579542422 independently confirmed SUCCESS on exacte729a516a87fb4e406b93462a86ff5b57d6a25d0. Final job receipt professional-housemate-ci-final.json;
durable mirror482files all hashverified, MANIFEST **5cbf7d8b2530cfe1bd323bbdadd8f0937543699c103d41536fe6ebc63f1bdb5c**.
Earlier481source/runtime artifacts unchanged; no repeat journey/new fixture/code edit.
Coordinator owns review/integration, held behind paid fullCI; no whole-stream closure.

## PR120 final exact-head CI and source-only limits

Coordinator reviewed493files/fivebindings and captured live03248883e0 in f07a40cdc.
AutomaticCI35583298837 now independently confirmed SUCCESS on exact
03279bd78b2c9691bcfb5fc76305a1b38834a78f. Final jobreceipt scheduling-resume-ci-final.json;
mirror494files allhashverified, MANIFEST **88077e0ddcd7fa4c4b32c607d1cd0f2f53a57ca289699a95a412f53981bdfc1d**.
Source frozen; no repeated runtime acceptance/new fixture/app change. Coordinator holds
new featuremerges/repairs behind paid a795 fullCI.

Source-only N05 reconciliation: notificationPrefs.ts daily_agenda row promises each
morning8am, but scoped backend search found no key consumer. Existing bookingReminders
cron is minutes3,18,33,48 in jobs/index.js. Prior manually invoked worker/localSMTP
evidence does not establish natural scheduler/daily-agenda delivery. These are separate
unverified contract leads, not missing-feature proof or new delivery-policy authorization.


## N05 natural scheduler verification — active September21 10:28UTC

The later top-README runtime-only grant supersedes the earlier pending proposal.
Resumed/adopted private harness and plan; no existing child or SQL fixture was running.
Import inspection selected bookingReminders and skipped49 registrations, with zero
network requests/sockets/violations. Source b409 unchanged; retained API7996/Next14742
remain untouched. Full retained Booking3/Page1/ReminderLog3/Notification20/EventType1/
SchedulingNotificationPreference0 rows and Mailpit12 messages captured privately.
Exact temporary Booking be6c416f-550e-4d56-80e0-01d4e524aca4 created; one private
child armed for original UTC10:33 tick, no manual worker call or time advance.
Every Booking query/sweep scoped to that ID; downstream fixture-only writes/local
transport guards installed before imports. Current acceptance pending callback,
SQL/SMTP observation and cleanup. Private scheduler-natural-* artifacts in existing
20260920-r1 directory; no application changes/new unit tests/provider/native work.


## N05 isolated natural tick — completed September21 10:33UTC

Unchanged b409 selected bookingReminders registration ran once at10:33:00.005UTC
for original10:33:00.000 schedule (node-cron4.2.1), without manual invocation or
time advance.49 other registrations skipped. Guards installed before imports:
zero violations,14 real local PostgREST calls, every Booking GET/PATCH exact-ID
scoped including terminal sweep. Real receipt POST201 and Notification POST201;
local SMTP accepted one exact invitee email at10:33:00.156. SQL snapshots confirm
one new reminder_60m receipt and one saved host notification, no unrelated additions
or retained mutations. Child stopped after one callback and exited0; independently
confirmed absent. API7996/Next14742 remain retained/unchanged.

Exact cleanup: Booking be6c416f-550e-4d56-80e0-01d4e524aca4, ReminderLog
6417de49-52a8-471d-9cd5-941261f1c6fb, Notification129c7777-aace-460e-bfee-58bde8e76e79
and Mailpit message DZ7KzVpdR4MKPd73fxm9Sv removed. Full Booking/Page/ReminderLog/
Notification/EventType/SchedulingNotificationPreference rows equal pre-test snapshots;
original12 Mailpit message IDs restored. No grants, sessions, providers or appfiles
changed; no new unit tests or repeated manual-worker journey.

Evidence scheduler-natural-source/import-inspection/result/observations/cleanup.json
and private harness/snapshots in existing durable accounts-social-r3 directory.
Mirror 511files allhashverified; MANIFEST **6eeeb6178d8bbca87ac1fc1a31b18e1f6f66b37b7d598c4a7555e4accc964ebd**.
Synthetic boundaries: selected-job registration filter, exact query/write/transport
isolation and SQL-seeded booking. Timer, PostgREST/SQL persistence and local SMTP
were real. This is not a new UI journey, unmodified all-jobs startup, hosted provider,
physical-device/native or daily-agenda acceptance. Prior UI/manual-worker evidence
retains its own sources/limits. No implementation commit/PR/CI needed for runtime-only
work; integrated PR120 gates remain unchanged. Whole stream remains incomplete.
Next: coordinator evidence review/next bounded assignment; unresolved daily-agenda,
worker pause/channel policy, after-final-check cancellation and provider/native/session
boundaries remain open. Do not repeat this accepted isolated timer check unchanged.


## Pause/resume source contract — next bounded proposal

Source-only grant: separate codex/stream3-scheduling-pause-contract adopts
9ae572d748cadad856b5a2c8561e7bc3e7cc4624; prior refs/evidence/retained runtime preserved.
Diff from b409 is coordination docs and Home role caller only; accepted scheduler
source bindings unchanged. Seven current/archive/open references,49 source bindings
recorded in scheduling-pause-source-reconciliation.json. No runtime or app changes.

Web NotificationPrefsForm reads scheduling.paused and Resume persists false via
existing per-user preference GET/PUT/JSONB. Banner promises Notifications paused /
Emergency alerts still come through. iOS and Android notification models instead
read BookingPage.is_paused and Resume updates that page flag. Existing web accepting-
bookings card says Bookings are paused / New bookings are turned off; public scheduling
route uses is_paused to reject new bookings409. These are distinct persisted contracts.
Native parity/runtime effects remain unverified; do not conflate or change either policy.

Existing schedulingNotifyPrefs hostWants/hostWantsKey read notify_me only; worker
uses reminder offsets and sendBookingReminder invokes hostWantsKey(reminder). Service
explicitly documents host in-app/push gating with transactional invitee reminders
unaffected. Source predicts host saved-notification delivery despite scheduling.paused,
but no new delivery failure reproduced. Email/attendee/emergency/daily-agenda behavior
is not specified sufficiently to invent broader suppression rules.

Propose one new exact temporary booking and host preference scheduling.paused=true/
notify_me.reminder=true, preserving original absence. Bind actual web paused banner
to GET/SQL, run existing worker once with exact fixture/query/write/local-SMTP guards,
observe saved host notification separately from transactional invitee mail, clean exact
rows/mail and verify retained snapshots. Reuse accepted Resume persistence and natural
timer evidence; no repeat timer or provider/native sends. Runtime execution and any
repair await coordinator assignment; source-only grant fully completed.

Durable mirror now510 hashesverified, MANIFEST **1db1537fc545f860e72ce2c1189ed9b5f230c60517184d8b71acf671e22a9819**. Two natural-check
raw import/runtime log copies removed from durable bundle as requested; originals
preserved private in20260920-r1. Structured import/result/SMTP/SQL/cleanup receipts
remain, so accepted evidence is intact. New source-only head does not imply rerun.


## Web paused notifications — reproduced delivery baseline September21 10:41UTC

Runtime-only grant executed on9ae source, existing API/Next retained. Real authorized
Bob GoTrue UI sign-in → notification settings shows Notifications paused / Emergency
alerts still come through, disabled host controls, Resume. Exact SQL-seeded preference
c2afadb8-91d5-4011-829e-6c9c72c74247 has scheduling.paused=true/notify_me.reminder=true.
Initial actual GET200 logged; zero-delay unmodified reload GET304 binds Bob actor to
current cached representation. First private assertion wrongly expected200 and rejected
304; corrected receipt retains this limitation. No response fault or synthetic auth.
Known local expired-session origin issue required ordinary sign-in at configured origin;
this does not establish expiry continuation acceptance.

Unchanged worker manually invoked exactly once under accepted exact-ID/query/write/
recipient/local transport guards (not natural timer). Zero violations, real host
Notification a7a9be50-acaa-4f82-80da-06d635bf21ed saved despite paused banner/SQL.
Receipt661c99de-209f-487c-afb1-0584cd7a969e saved; one transactional invitee localSMTP
mail accepted10:40:42.961 and observed separately. UI after delivery still paused;
no physical push/provider claim. Source confirms both hostWants/hostWantsKey ignore
scheduling.paused. Proposed smallest repair: each existing host gate returns false
on strict prefs.scheduling?.paused===true before existing notify_me check. Preserve
invitee transactional branches/page availability/offsets/error handling/UI. No edits;
coordinator assignment required. This does not define emergency/email/attendee policy.

Exact temporary booking70d010f7-ccc8-43e0-a35e-e48d8fdc1b95/preference/log/notice
and mailPRRojHUrBgNKzwUTKsvLnu removed. All six full retained-table snapshots equal
originals, preferenceabsence0 restored, original12 mailIDs restored. Child exited0
and absent, tab19closed, retained API/Next/DB unchanged. Ordinary browser authsession
retained; auth/audit tables are not claimed restored. No grants changed/new unit tests.

Private scheduling-pause-* structured evidence/UI captures/operator scripts mirrored,
raw runtime log remains private only. Durable 526files hashesverified; MANIFEST
**d4139b811d92ce4f2e6ee36521ab2c3929815c117691d5d2a233fe6adfac4d5d**. Prior Resume and natural scheduler acceptance reused without rerun.
Next coordinator review/exact repair assignment; native page-pause mismatch/dailyagenda
and full-stream provider/session/native boundaries remain open.


## Host pause gate repair — candidate verified/pushed September21 10:51UTC

Exact README grant followed; only schedulingNotifyPrefs.js hostWants/hostWantsKey
add strict scheduling?.paused===true false-return after successful getPrefs. Two
added lines, existing recipient/default/read-error/page/offset/UI contracts preserved.
Source **efaeaab5c4db7191dacd1a7da280bfbf7f35fa29**, branch
codex/stream3-scheduling-pause-contract pushed; draft publication/automaticCI pending.
No new tests, source baseline/49bindings and prior Resume/natural timing reused.

Candidate actual paused web screen, SQL preferencea22a6f22-6e22-4f91-a595-822b756ca99d:
manual unchanged worker plus existing notifyBookingEvent(confirmed) consumer produce
zero host notices and two transactional localSMTP emails. Actual web Resume PUT200
persists paused:false; fresh booking plus same two callers produce host reminder and
confirmation notices, two more local emails. Candidate children load repaired source;
retained API uses unchanged preference persistence. Confirmed fanout directly invoked;
booking-confirmation transition UI/API itself was not exercised. No natural timer rerun,
provider/device/native/emergency/dailyagenda/channel expansion. First fresh-booking
insert violated existing overlap constraint (no row/delivery); nonoverlapping due slot
used for successful case. Guard violations0 in both children, both exit0/absent.

Exact2bookings0f9085c5-6fb8-432f-9d80-f78250a495da and
c54a0168-5ee9-4f2c-872d-06ea0eed1082,2receipt rows,2hostnotices,1preference and4mail
messages deleted; all exact IDs in scheduling-pause-candidate-cleanup.json. Six full
table snapshots and original12mailIDs restored; preferenceabsence0, tab20closed,
retained API/Next/DB unchanged. Ordinary browserauthsession retained, no grantschanged.
26 existing schedulingLogic tests pass, node syntax/diffcheckpass. Runtime/import
rawlogs remain private only; structured final receipt records checks and limitations.
Durable 549files allhashverified, MANIFEST **b618852cdd9bc76a6db517a6f53720b849fdf70c3af0af76f585f5c924299c89**.
Next required automaticCI/coordinator review; no selfmerge/whole-stream closure.


PR126 published draft https://github.com/WangPantopus/skinny-pantopus/pull/126.
Exact efaeaab5c automaticCI35590893520 completed SUCCESS (6applicable passes/5path
skips), including backend/privacy, image, schema and CI OK. No new web/native
acceptance. Final CI structured receipt mirrored:550files hashesverified, MANIFEST
**d4efa3b39f3a7e2e7aff66ee7f746819b707a5281bcbaa3e3a5fda03977839eb**. Coordinator owns review/integration; source frozen and no rerun.


## Host channel source-only reconciliation after PR126 integration

Independently confirmed126 MERGED5b80279643bb72c800648cb922685e8818afc4f1,
updated49becdb41 exactCI35591151829 success; accepted gatehash8c40b8d4 matches.
Separate codex/stream3-scheduling-channel-contract adopts5b802, preserves priorrefs,
evidence and retained runtime. No new appedit/runtime/tests or accepted-journey replay.
Seven refs/49bindings in scheduling-channel-source-reconciliation.json supplement
existing maps. Web host Push writes notify_me plus nested scheduling.host row; Email
only writes nested email. GET/PUT preserve JSON. Existing host gates precede saved
Notification insert; shared notification service then independently gates physical
push using global MailPreferences/type prefs. Saved notice is not physicalpush.
Native host P/E bind one notify_me boolean, not separate nested email (source-only).
Existing scheduling fanout emails non-user invitee; no host nested-email consumer
found in inspected delivery path. Existing recipient policy keeps invitee transactional
reminders; emergency/dailyagenda/hostemail policy cannot be invented from this search.

Propose one exact temporary unpaused prefs+due booking; actual web Reminder sent
Email off→on while Push/notify_me.reminder staysfalse, preserve unknownkeys, bind
PUT/GET/SQL/reload. One unchanged manually invoked worker with exact query/sweep/
write/recipient guards/localSMTP only; observe hostemail independently of savednotice
and transactional inviteemail. Allow exacthost/inviteerecipients only and reject external
providers. Fullsnapshot/exactcleanup, no timer/native/provider rerun. This is proposed
verification, not reproduced defect or repair authorization; awaiting coordinator scope.
Durable 551 hashesverified, MANIFEST **a3c5e0d35c33106683d8489155152a58e68f98f4f7cb38bea9dba54531de5852**. No rawlogs added.


## Host Reminder sent Email — actual baseline September21 11:02UTC

Granted later-batch runtime-only check on5b802; no appedit. Exact actorBob matches
bookinghost. Actual existing web Emailoff→on, Push staysfalse; instrumented PUT200
identifies actor, SQL retains notify_me.reminder=false, nestedhost.reminder_sent.email
true and sentinel. Actual reload GET200 sameactor/visible Emailon Push off. Initial
Playwright checkbox selector found no DOMrole match; observed native AX checkbox
click succeeded. No request occurred from failed locator.

One unchanged manually invoked worker, exactfixture/sweep/write/recipient/socket
guards, violations0, exit0: one reminder receipt, no host Notification, no host SMTP,
one transactional invitee SMTP accepted11:02:18.081. Saved Emailon therefore does
not produce host mail in this bounded existing reminder path. Source map established
no nestedhostemail consumer; existing getUserContact/bookingEmailHtml/emailService
and worker failure release can be reused. Propose extend existing sendBookingReminder
only for strict explicit host email opt-in independently of push, respecting strict
pause, exacthost contact and existing email/template transport; require success and
preserve invitee/default/page/shared-service policies. Lookup/suppression handling and
partial-recipient retry boundaries must be resolved in exact repair grant; no new
system/schema/defaults or implementation yet. This does not close other host emails.

Exact bookingf09a3df3-2a72-4c93-8255-8a09cf31d119,preference
2a02dc86-61e1-4007-9a43-d372d7259f60,receiptbce24579-1567-40b4-9a92-e4eca7b023ec
and Mailpit7WYq9JJMpa5vJB9V5Lga3y removed. Six fulltable snapshots/original12mailIDs
restored; originalprefabsence0, no hostnotice created. Childabsent/tab21closed, retained
API/Next/DB/authsession unchanged. No grants/providers/native/timer/newtests. Initial
prefs/booking SQLseeded, actual UI emailcommand; manual worker/isolation limits explicit.
Structured scheduling-channel-* receipts/UI/snapshots/scripts mirrored, rawlog private.
Durable 567 hashesverified, MANIFEST **0acba78f4c5cb57089dfdfedd98f587ad2874786c2a7babdef4f9ae9ffc0ac88**.
Next coordinator evidence review/exact repair proposal; closed125/126batch untouched.


## Host-email repair proposal — contact/suppression/retry source reconciliation

No code/runtime changes or baseline rerun. Sevenrefs/42bindings added in structured
scheduling-channel-repair-proposal.json. Exact proposed path only existing
bookingNotifyService.js sendBookingReminder: explicit nestedhost reminderemailtrue,
strictpausefalse, exactassignedhost (no owner fallback), checked existing User contact
select fields, existing template/format/emailService. Lookup error/missingrow/emptyemail
throws before email fanout and worker releases receipt; no silent completed delivery or
address fallback. User.email normally NOTNULL; invalid-data case must retain synthetic
boundary if canonical fixture cannot express it. Existing generic getUserContact callers
remain unchanged. Candidate source/semantics still require coordinator assignment.

Do not reuse invitee EmailSuppression for host: unsubscribe scope uses caller-supplied
invitee address and booking owner, so doing so could grant guests suppression over a
host. Existing invitee branch untouched. MailPreferences.email_notifications exists,
but web description is Receive email updates about your gigs and bids; inspected
scheduling/genericemail consumers do not establish broaderglobal precedence. Proposed
minimal repair leaves this contract unchanged and uses explicit scheduling opt-in/pause.
A global scheduling-email optout rule needs explicit product decision; no inventedpolicy.

Preflight opted-in hostcontact before recipient emails; hostsend before unchanged
invitee branch avoids invitee duplication on known hostfailure. Check success===true
or throw/releaseclaim. Hostsuccess→inviteefailure still releases claim and can repeat
hostmail on retry; accepted-but-lostSMTPack likewise can duplicate. Existing savednotice
idempotency stays; no exactly-once claim/new ledger/schema. Same-address role
deduplication not invented. Runtime proposal includes actualUI→localSMTP, off/absent/
pause negatives, lookupfailure/restore, host SMTPfailure/retry/dedupe and partialrecipient
failure/retry with exact message accounting. LostACK remains limited unless separately
exercised. Full fixture/grant/mail restoration, no native/timer/provider/newtests.
Durable 568hashesverified, MANIFEST **fcc7206c1e70967f334f10b0a58662925b6ba7b9b66c020882218819e26bd39d**; rawlogs private.
Next coordinator scope/policy review before any repair.


## Host reminder Email repair — next-batch candidate September21 11:13UTC

Exact grant fulfilled only in existing sendBookingReminder,29addedlines. Strict
explicit nestedhost email opt-in/notpaused, checked exactassignedhost User contact
(no ownerfallback), existingtemplate/emailService success requirement before invitee
email. Existing hostnotice/idempotency/invitee branches/sharedhelpers/gigs-bidsglobal
setting/defaults untouched. No guest-controlled suppression applied tohost. Source
**c3f1bd03868d916530e0477c318e3f5ddd43c91a**, branch codex/stream3-scheduling-channel-contract committed/pushed.
Draft publication/automaticCI pending, coordinator owns next-batch integration.

15 bounded worker attempts: actual web Emailopt-in PUT200/SQL→host1/invitee1;
completed repeat0/0. Off/absent/paused eachhost0/invitee1. Real exactUserSELECT403
via privilege denial→mail0/claimreleased; restore→1/1. Synthetic missingcontact→0/0/
released; restore1/1. Synthetic hostpreacceptanceSMTP rejection→0/0/released; retry
1/1 thencompletedrepeat0/0. Inviteerejection afterhostaccepted→1/0/released; retry
1/1 thenrepeat0/0. Partialcase exacthost2/invitee1 proves at-least-once limit, not
exactlyonce; lostSMTPack untested/can duplicate. Allguards violations0/childrenexit0.
SMTPfaults are injected sendMail rejection responses; successful deliveries real local
SMTP. Missingcontact response synthetic afterrealquery, contactpermissionfailure real.
No timer/native/provider rerun. Negativeprefs SQLseeded. First tab22closed too soon
after optimisticclick, SQLoff; reopenedtab23/retried and waited PUT200/SQLon before
worker. Initial unpersisted attempt excluded; no account/session-lifetime claim.

Exact8ownedbookingIDs in hostmail-cleanup.json; intermediate bookings/logs removed by
exactID between cases. Finalreceipt4092324f-f0f5-4a1e-84f9-7b541891faa1 and preference
ff053c30-a55a-43f4-8670-38a6c3b2ab64 removed;14mailIDs cleaned (host6/invitee8).
Six fulltable snapshots/original12mailIDs restored, originalSELECT privilege true
restored, childabsent/tabs22+23closed. API/Next/DB/authsession retainedunchanged.
26existing schedulingLogic tests/syntax/diffcheckpass, no newtests. Structured
hostmail-final/matrix/percase/SQL/SMTP/UI/cleanup/operator artifacts private mirrored;
rawlogs excluded. Durable 601hashesverified, MANIFEST **063354ba650ec189fa7345431ddab1a4bcaf5f04684537e322eaf1fd80ed47e9**.
Whole stream and otherhostemail/native/provider/session acceptance remain open.


PR129 draft https://github.com/WangPantopus/skinny-pantopus/pull/129 published.
Exactc3f originalCI35592896635 SUCCESS:6applicablepasses/5pathskips, including
backend/image/schema/CI OK. Coordinator reviewed601 source/runtimehashes and
independent retained-row equality; guarded master update/newheadCI remain separate.
Source/runtime frozen. FinalCI receipt mirrored:602hashesverified, MANIFEST
**2b37a97af78791d5493cc802ce80610cb0fe74ded9a5da682f323f81a0202d24**. No repeated journey or extra product change.


## Next A02 source-only proposal — local session-refresh origin

129 source/runtime frozen on localc3f; coordinator guarded03a2 update has identical
service and requiredCI underway. No app/runtime/fixture/newtest or acceptedjourney
replay. Reused actual prior incidental stale-session observations: configured
stream3-auth.localhost navigation reached localhost/session/refresh transientfailure;
ordinary correct-origin login recovered. No current production/authdefect asserted.

Sevenrefs/35bindings map middleware→refreshpage→SDK/client→Nextconfig. Middleware
builds redirects with new URL(...,req.url), client refresh uses same-originrelative
POST and transient preservescookies. InstalledNext15.5.15 runMiddleware constructs
absolute URL using server fetchHostname or localhost. This is a configuration lead,
not proof of rootcause/deploymentfailure. Source proposal artifact includes exacthash.

Propose first nonmutating HTTP redirect check on retainedNext with only synthetic
sessionflag1/noauth token: existing protected settings path on configuredalias vs
localhost, inspect Location origin/preservedpathquery and current startup/reverseproxy
contract. Explicitly not real refresh/authacceptance. If configuration-only, propose
local runtime correction before sharedauth edits; real browser expirycontinuation
requires separatecontrolledownedsession scope. No tokens/timeadvance/foreigncookies.
Durable603hashesverified, MANIFEST **61f6c35d991164c94541ad1b56e117084c99b69b910755df6eb5adb9ab6b56c2**, artifact
session-refresh-origin-source-proposal.json. Await coordinator bounded assignment.


## Local refresh redirect origin — nonmutating observation11:22UTC

Granted retainedNext HTTP-only check: same protected notifications path+two query
parameters, synthetic sessionflag1/noaccess/auth token. AliasHost and localhostHost
both307 to http://localhost:18131/session/refresh; redirectTo preserves exactpath/query,
no Set-Cookie on eitherresponse. Redirects notfollowed, no browser/session/SQLchanges.
Actual parent14400 starts next dev --hostname127.0.0.1 --port18131, child14742
listensloopback. InstalledNext builds middleware URL using serverfetchHostname and
normalizes127.0.0.1 tolocalhost; app usesreq.url. This explains the local observed
origin with existing startup; no hosted/production/authdefect or realexpiryclaim.

Propose changing only owned Next startup hostname to stream3-auth.localhost if
OSloopbackresolution confirmed, keepingport/distDir/proxy/session. No restart applied;
requires coordinator runtimegrant. Then repeat just redirect-origin check before any
real expiryjourney. Do not change auth/CORS/trustforwardedhost to mask localsetup.
Resolution details, bothHTTPheaders and startupcontract in session-refresh-origin-http.json.
Durable604hashesverified, MANIFEST **a2ada5a8c84c7cceafb5ed16fb97fb868240d6552480664ba6e33eaed26c5ba6**. All prior129/runtimeevidence preserved.


## Owned Next hostname corrected — local runtime only11:26UTC

Granted correction performed after PID/cwd/parent and exclusive loopback alias checks.
Captured original process argv/env through NUL-separated OS procargs into private
launch file (not mirrored or printed). Stopped only parent14400/listener14742; both
absent/portreleased. Same executable/cwd/env/distDir/cache/port18131/APIproxy started
with only --hostname stream3-auth.localhost changed. Newparent42165/listener42493,
exec61129, listenerIPv6::1. Independently compared newprocess environment exactequal
and argv hostname-only. API7996/18130 retained, no DB/cache/cookies/authsession/source
changes. Private restore runner retained; restoration not needed because startupworks.

Both aliasHost and localhostHost probes now307 with relative /session/refresh Location
and exact original redirectTo path/query preserved; no SetCookie. Synthetic marker
only/noaccess/auth token, no redirectfollowing/browserauth. This fixes recorded local
redirectorigin configuration; real expiry/refresh continuity remains unverified and
requires separate grant. No productionauthfix/CI/newtests/provider/nativeclaim.

Structured next-hostname-change/probes receipts plus nonsecret restartoperator mirrored;
private raw launch environment/runtime log excluded. Durable607hashesverified, MANIFEST
**f7ae6e2e3d3d2ce16336e8c5e3946fbbcb0dec805be43c9fa9116e40fd15111b**. New ownedNext reservation42493/42165 replaces old14742/14400;
API/DB/session remainretained.129/evidence/application branch unchanged.


## Natural access-cookie expiry proposal — plan only

Existing Bob browserlogin receipt10:40:13.684UTC, accesscookie maxAge3600 source,
no later login/refresh success recorded through11:27:50. Natural expiry candidate
after11:40:13.684; keep closed tabs/session and recheck renewal receipts before
any granted navigation. No cookie deletion/manualrefreshpage/clock/JWT/authDBchange.
Propose one actual protected settings navigation afterexpiry (harmlessquery marker),
observe middleware recovery→same-origin refreshPOST→localGoTrue→originaldestination
and Bob identity/identity-boundpreferencesGET, full unchangedprefs SQL. SafeHTTP
receipts already record method/path/status; GoTrue evidence only narrowly parsed
metadata+whitelisted nonsecret session fields, no rawtokens/hashes/headers/logs. If
unavailable distinguish source-inferred provider path rather than inventreceipt.
Naturalexpiry label remains timing-based unless safeexpiry metadata available; missing
cookie simulation/manualrefreshentry would be different scopes, not substitutes.

Close only new ownedtab; remove unusedmetadataflag; preserve rotated ordinarysession/
registry timestamps. No authDBrestoration claim/logout/revocation/other-sessionchange.
If no recovery or failure, preserve/report actualstate rather than silently relogin.
Plan/cleanup/observability detail session-natural-refresh-plan.json; no execution yet.
Durable608hashesverified, MANIFEST **e10f218b9bfa68cc161b8063df0141a0e7c39f64e98ff1f690e08bdf0c862a72**. Coordinatorreview pending.


Natural-session runtime grant active: waiting with owned testtabs closed until
11:40:20UTC; renewed-history check through11:36:32 still latestlogin10:40:13.684.
Before snapshot records originalprefsabsence0 and actor-only whitelisted app/GoTrue
session metadata, no token/hash/cookie fields. No navigation or session mutation yet.
Next exactaction: recheck no renewal, capture receipt offsets, open protectedsettings
with harmlessquery on correctedalias; never manuallyenter refresh or relogin.


## A02 natural local session recovery — verified bounded11:41UTC

Granted actual UI continuation passed after natural access-cookie window: lastlogin
10:40:13.684+3600s source lifetime, no intervening renewal, navigation after11:40:20.
No cookie removal/manualrefreshentry/clock/JWT/authDBmanipulation. Timing-based
naturalexpiry, not directcookie-store inspection. Actual tab24 first displayed same-
origin /session/refresh and Restoring your session; automatically returned to original
settings URL with stream3_natural_refresh=1 and Auth Bob identity. APIrefreshPOST200
11:40:41.755; independent localGoTruePOST/token grant_type refresh_token200 at11:40:41.
Actor sessionfdbea9cf-e8b0-4c4c-a666-09b88887a880 last_refresh_at11:40:41.744,
issued10:40:13.676/unrevoked. Other actor appsession metadata unchanged.

PreferencesGET20011:40:45.081 exactBob actor; fullSQLprefs originalabsence0 unchanged.
One actualreload stays same destination/query/account; only one refreshPOST total,
no recoveryloop. Tab24closed, zero-delay metadataflag consumed, naturalbrowser/session
rotation/authregistry timestamps retained; no authDBrestore/logout/revocation claim.
No credentials/tokens/cookies/hashes/rawGoTrue logs exported. Existing API7996 auth
source bytes unchanged0d6→c3f; corrected Next42165/42493 currentc3f. No source edit/
CI/newtests/native/hosted/OAuth/otherdestination or crossaccount acceptance.

Safe session-natural-before/after/start/UI/final metadata/operator mirrored, 616
hashesverified, MANIFEST **bd26e7cfbaa7640f166d00bb8d50ebd21cef9440e3791dc809985995b6a0ad76**. Existing fullstream limits remain;
coordinator review/next bounded assignment. Localhostname correction remains configonly.

Postcheck found Next automatic tsconfig generated-types include/reordering from
ownedrestart. Prior trackedclean confirmed; restored exact HEAD bytes, sourceclean
again except owneduntracked .next-stream3. No intended application/config edit.
Private session-natural-generated-config-cleanup.json records before/restored hashes.


After frozen natural result capture182fbeaf1: next A02 source-only proposal maps
existing transient refresh UI/SDK and AuthDevice read503. Conditional existing
session device association only (not yet queried), propose ownedDB AuthDeviceSELECT
denial→manualrefreshpage503/Tryagain→restore/read200/currentBobdestination. Explicit
manualentry/databasefault, not another naturalexpiry run. BlanketAuthSessiondenial
may take legacyfallback and is not proposed. No binding/cookie/JWT/clockmutation;
if noexistingdeviceassociation, stop/review alternative. Exactgrant/prefs/tabcleanup,
GoTrue safe metadata/rotation boundaries in session-transient-retry-source-proposal.json.
No runtimegrant/execution/appchanges yet.617durablehashesverified, MANIFEST
**56bde763ec34c613feb7f2a98292fe7b490420bc633c24ed3dc4eabdb7950f43**. Prior616 acceptance/source/session evidence unchanged.


Granted read-only association preflight: existing exact Bob unrevoked session from
natural recovery has device association **false**. Query returned boolean
only; no deviceID/credential export, no binding/session/cookie/grant mutation.
Structured session-transient-device-association.json records provenance. Later
proposal now618hashesverified, MANIFEST **b82fa1d1973cf9f0447a9ee2b96093babd61e043c2c150525e790feb8b34b5c4**. Runtime/faultmanualrefresh
still ungranted/unexecuted; accepted616 natural evidence remains unchanged.

Association is absent: AuthDevice-denial proposal stopped without runtime execution
or manufactured binding. One coordinator message incorrectly said PRESENT before
reading tool output; immediately corrected. Structured evidence/live03 boolean were
always false. Existing session and natural acceptance preserved.


Alternative transient recovery source-only proposal: reuse private http-probe
pre-Express request emit interception (existing refreshhold is post-GoTrue and
inappropriate). Proposed one-shot exactPOST/refresh+ownedport/loopback+Origin+
cookie-transport+unique fullReferer marker match, short-expiry descriptor consumed
before synthetic503, no forward/noSetCookie/no logout. Nonmatchingrequests untouched.
Actual manualrefreshpage transientUI→keyboardTryagain forwards normally→realGoTrue
200/currentBobdestination; no naturalexpiry rerun. Observe safeinterception/noGoTrue
firstattempt/no registryrotation and exactactor/prefs onretry. No token/header/body
values logged. Existing private hook extension needs separately granted ownedAPI
restart/exactenv/source binding; cleanup marker+hookrestore/ownrestart, retainNext/DB/
rotatedsession, closetab. No binding/grant/cookie/appmutation executed. Detailed
session-transient-transport-proposal.json mirrored;619hashesverified, MANIFEST
**81eb4927744b732a680891d1fe8959fec8985bb3c49412d16f9d57b4e0efe3bc**. AuthDevice-denial proposal remains stopped (associationfalse).


## A02 synthetic transient refresh retry — bounded verification complete

Actual existing web refresh page manually entered with unique relative settings
destination. One-shot pre-Express private hook returned503 at11:50:30.610UTC;
all exact request match booleans true, no forwarding/Set-Cookie. Actual UI showed
Couldn’t restore your session, session retained, Try again. Keyboard retry reached
real backend20011:50:49.349 and local GoTrue POST/token refresh_token20011:50:49.
Returned original settings URL/query and Auth Bob identity. Preferences GET304
identity-bound to Bob (cache revalidation, not fresh200); full SQLprefs remained
original absence0. An observer initially expected200; accepted observed304 without
repeating refresh/UI. No login/logout HTTP receipt in this interval.

Failure snapshot full actor prefs/app-session/GoTrue-session metadata and safe
GoTrue receipts equal before. Retry retained all73 own appsession IDs; only
fdbea9cf-e8b0-4c4c-a666-09b88887a880 changed in own app and GoTrue metadata.
Exactly one new successful GoTrue refresh. Other own session metadata unchanged;
other-account metadata not inspected. Successful ordinary rotation retained.
No DB fixtures/grants/binding/cookies/clock/JWT changed; no authDBrestore claim.

Cleanup: original private hook exactSHA d7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; consumed descriptor and metadataflag absent. Fault API63469 stopped.
Restored API73610/exec69695 listens127.0.0.1:18130, original backendcwd and exact
original captured argv/environment verified in memory without secret export.
Next42165/42493 unchanged; owned Supabase retained, testtab25 closed. Local source
c3f1bd03868d916530e0477c318e3f5ddd43c91a; trackedclean, owned.next-stream3 only.
No application edit/newtests/CI in this runtime-only scope; PR129 merge separately
confirmed747b45754b24accce096898508e2de3355ed86a3. No new implementation acceptance.

Manual entry/synthetic pre-forward failure is not natural expiry, real provider
outage, database failure, native/hosted/OAuth/cross-account/session-matrix coverage.
AuthDevice proposal remains stopped: existing device associationfalse. Prior
natural616 evidence remains reusable within original limits; no journey rerun.

Durable evidence: /Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream3-accounts-social-r3/
transient-before/after-failure/after-retry/final, intercept, runtime-change, navigation
and actual UI failure/success snapshots. Private launch environment/raw operator
logs excluded. 628 artifact hashes verified; MANIFEST **18bb02a8179b131c5dbfe4ce05199ca5bdf7a9c83e00ee6098e234672b52ed72**.
Coordinator review pending; full stream remains incomplete, next bounded assignment.


## Next A01–A02 source reconciliation — runtime review pending

Accepted628 transient result frozen by coordinator6a3c7c692. Adopted current
masterde0ac6ef3c051485b5800a288194ee563396a12a on codex/stream3-session-return-reconciliation; old
codex/stream3-scheduling-channel-contract/c3f ref preserved. No tracked edits;
owned.next-stream3 retained. Nine existing auth screen/caller/route/service bindings
are byte-identical to c3f; only intervening Home page/docs differ. API73610 still
loadedc3f/Next42165+42493 retained; no blanket new-master runtime evidence claim.

PR82 already covers actual revoke-others/global/partial failure and account retirement.
Natural/transient refresh accepted separately; do not replay. Proposed remaining
ordinary profile Settings logout→unauthenticated protected settings link with query→
login redirectTo→real Bob login→exact authorized destination and prefs. Existing
profile/settings handleLogout calls API auth.logout→users local route→GoTrue local
signout/authDeviceService.logoutLocal→AuthSession revoke; middleware and login
preserve safe path/query. Source mapping and nine hashes in
session-logout-return-source-proposal.json. No concrete failure claimed from source.

Runtime proposal deliberately retires only retained Bob fdbea9cf session after safe
identity preflight; no others/global/device association. Compare all own session
metadata/preferences; prove old local GoTrue removal/registry revoke, exact current
identity on newly created login session, no unauthenticated private content. Retain
natural revoked/audit/newlogin records; no resurrection/DBreset. Close new tabs only.
No logout/revocation executed, no app edits/newtests/CI or native/provider expansion.
Negative destination authorization/remote revocation/offline logout remain separate.
Durable629 artifacts, MANIFEST **c8d396cde23983b70d932029029ce60c323dac722df763842a5c8ac5332218d0**. Coordinator scoped review
required before runtime. Full stream remains incomplete.


## Granted local logout/return baseline — actual failure, review required

Preflight UI Auth Bob and uninterrupted successful login/refresh history to fdbea9cf;
exact current registry unrevoked. Actual profile Settings keyboard Log Out returned
POSTlogout20012:19:21.183UTC, current registry revoked and exact GoTrue session
removed. All other own app/GoTrue metadata equal, full prefs[] unchanged. UI login
then direct protected scheduling-settings?stream3_logout_return=1 redirected to
login with exact encoded path/query; no private settings content in observed UI.

Unexpected automatic refresh burst immediately after logout: {"('/api/users/profile', 304)": 4, "('/api/users/logout', 200)": 1, "('/api/users/refresh', 400)": 29, "('/api/users/refresh', 429)": 2, "('/api/users/login', 429)": 1}.
Actual Bob sign-in submitted once12:20:01.521 returned429 with visible Too many
requests. Please try again shortly. No new GoTrue token receipt or login session.
Postfailure metadata exactly equals postlogout snapshot. Destination return NOT
verified. Source matches general one-minute limiter text; root cause/attribution of
refreshburst unresolved, do not claim repaired or bypass limiter. No retry performed.

Tab26closed; unused zero-delay preference observation descriptor removed. Runtime
API73610/Next42165+42493/DB retained. Old session naturally revoked; browser now
signed out, no session resurrection/newlogin/cookie manipulation. No source edit or
newtests. Baseline artifacts logout-return-before/after-logout/final and UI before/
loggedout/login-required/login-failure mirrored, 636 hashes; MANIFEST
**c3634539de03ea53b554aff9e5f768e8eb214feceec371a4f45dca2e6b86f15d**. Coordinator review before repair/retry.


Postlogout source attribution: captured first3seconds include60 each401 homes/
businesses/professional/seats and30 featureflag401 alongside29refresh400+2refresh429.
ProfileToggle unconditional mount loads those four endpoints; QueryProvider keyed
retirement remounts on every clear; SDK web401 unconditional canRefresh and invalid
refresh clear emits another marker. Singleflight covers only overlap, not successive
remount waves. Strong source/sequence feedback-loop match, not exact tab attribution:
existing HTTP logs lack Origin/Referer/tabID. Current inventory only retained tab4
reset-password, query omitted and tab untouched; source has no automatic API call.
Historical tab state unknowable from these receipts. Root18132 lead not independently
attributed. Global30/minute write limiter runs before user/auth routes, consistent
with logout+29refresh then429s/login rejection. Do not raise/bypass limiter.

Proposed smallest existing SDK401 gate: automatic web refresh only with active
session signal (including stale-access flag), otherwise reject without refresh or
repeatedclear; preserve explicit recovery/mobile/generation guards. No edit or
retry executed. PR82 client/provider bytes identical; historical retirement retained;
openPR metadata47/46/34 no dedicatedauthfix. Detailed source hashes/sequence/limits
logout-burst-source-attribution.json; durable637 MANIFEST **edbf0d6a92976197bbcfd117b6447187555a08e7907669b056b7a0dc45feee9a**.
Coordinator review pending; original failedreturn remains unverified.


## PR136 — stop signed-out automatic web refresh

Granted oneexisting SDK client.ts gate now requires hasActiveSession for automatic
web401 refresh. Mobile branch, explicitrefresh, staleaccess sessionflag, generation
guards/singleflight/privacy retirement unchanged. No limiter/backend/UI/provider
redesign/newfiles/tests. Commit d6fba68d3cf1154211849a1b659a7e48d03012a6 pushed
on codex/stream3-session-return-reconciliation; draft
https://github.com/WangPantopus/skinny-pantopus/pull/136 (separate paidbatch).

After naturalratewindow ordinary UI login created14312967-9a68-4c51-bcb0-0266f6898285;
other own sessions unchanged. Candidate Nextcompiled SDK guard present in loaded
page/layoutchunks; DOM script list recorded. Actual Settings keyboardlogout retired
only14312967 registry/GoTrue;9 trailing privateGET401, **zero refreshPOST/429**.
Observed immediate intermediate remounted shell had blankaccount/defaultsettings;
then login navigation completed. Protected own scheduling-settings query redirected
to exactlogin redirectTo, no private settings content in observedloginUI. Actual
login200/localGoTrue passwordgrant20012:27:45 returned original path/query/AuthBob.
Newsession507ef9ec-89b6-4ff3-a04c-6c69d5e0618c onlyaddition; all other own app/GoTrue
metadata unchanged from postlogout. Fullprefs[] unchanged; identity-bound prefsGET304
12:27:45.738 cachevalidation. Complete measuredcandidate interval:2POST200 (logout/
returnlogin),9GET401, zero refresh/429; initial setup login precedes this interval.

Cleanup: tab27closed, zero-delaydescriptorconsumed, retained natural revoked/audit/
newloginrecords. API73610/Next42165+42493/DB unchanged, no counterreset/restart.
Sourcebefore-finalcommit hash in logout-fix-before; UI/script/safeHTTP/SQL/GoTrue
snapshots in logout-fix-*. Prior natural/explicitrefresh evidence reused for unchanged
controlflow only; new401gate staleaccess compatibility sourcechecked, no newexpiry
runtime claim. No native/hosted/negative-destination/broadsessionclosure. Baseline
historical tab initiator stillunproven; candidate boundedjourney passes.

Existing57 authArrival/sessionRefresh tests pass; web typegate0errors; SDKscoped
lint0errors/33existingwarnings; diffcheckpass. StandaloneSDK typecheck stillfails35
diagnostics. Isolated old/candidate compilecomparison both59normalizedidentical
(includes copy-specific module resolutionerrors), not standalonegreen. Initial
pnpm isolatedcommand couldn't resolve workspace; direct existingtsc used. Initial
webeslint invocation ignored externalfile; actualpackageconfig rerun recorded.
No newtests or testcoverage claim. RequiredCI pending, no merge/integration claim.
Durable653 hashes verified; MANIFEST **2786b1fae61dbc82ed908c0c055900c7d4aeaff203e16157c7947cd6c9cdcd55**. Coordinatorreview.


Next source-only A02 proposal: ordinary local logout pre-forwardfailure. PR82
revocation partialfailure happened AFTER commit; PR136 local200 retirement and
refreshnatural/transient cannot establish this boundary. Existing profilelogout
catch assumes cookiescleared and navigateslogin after localclear; SDK clearsession
only after POSTsuccess; retained sessionflag can still authenticate middlewarelogin
redirect. Potential misleading failure handling requires actual baseline, not policy
invention. Proposed separately granted exact owned507ef9ec session + one-shot
preExpress POSTlogout503, noforward/SetCookie, fullmetadata/prefs equality/UIobserve.
No runtime, retry/logout/login or appedit executed. Restore privatehook/env/restart
ownAPI only ifgrant, close ownnewtab, preserve natural session; no cookie/clock/JWT/
device/DBreset. Not genuineoffline or lostsuccessfulreply. Detailed existingfive
bindings/isolation/cleanup in logout-failure-source-proposal.json. PR136fixed;
CI35599880117 browserE2E/database/safeguards passed, webjob stillrunning.
Durable654 hashes; MANIFEST **e4000f55b7a1c627d96027ca49e8e9e0880825b6081d9f0afa428b10b92877eb**; coordinatorreviewpending.


PR136 exact d6fba68d3 CI35599880117 **SUCCESS**: weblint/typegate/Jest/productionbuild,
IdentityFirewallE2E, database replay/safeguards andCI OK allpassed. Backend/native/
Seeder jobs skipped bychangefilter, not runtimeverified. Receiptlogout-fix-ci.json;
durable655 MANIFEST **b95bd5576d3d29058da1fef589f133638cdd744ca0d3775b2f01611f0a87c8b4**. Draft remains coordinatorreview/
integration pending; standaloneSDKdiagnostic limitation unchanged.


## Separate local logout pre-forward503 baseline — reproduced UI failure

Granted exact Bob/current507ef9ec preflight matched complete prior metadata and UI.
Private one-shot matched all exactlogout/18130/loopback/Origin/transport/Referer
conditions;50312:37:15.297UTC, descriptorconsumed/noforward/noSetCookie. Actual
Settings keyboardlogout showed no appfailure/retry, navigated automatically to
/app/place displaying AuthBob. Devissuebadge briefly visible, not usablelogouterror.
Full own app/GoTrue metadata and prefs[] unchanged; no GoTrue token receipt or
HTTPlogin/refresh/retry, subsequent profile304s. Sessionretained as expected for
pre-forwardfailure; silentlyreturning to authenticatedPlace is the reproducedgap.
No manualretry/login/logout or apprepair. This is synthetic503, not actualoffline
or lostsuccessfulreply; no native/provider/broadauthclosure.

Cleanup complete: faultAPI3022stopped, restoredAPI3800/exec20593 originalargv/env/cwd
exact in-memory comparison; originalhookSHAd7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored, markerabsent, testtab28closed, Next42165/42493+DB retained. Actualcurrent
507ef9ec session retained, no DB/grant/device/cookie/clock/JWTmutation. Locald6f
source/PR136 frozen; no new appedit/tests/CI in baseline. Privateenv/operatorlogs
excluded. Safe logout-failure-before/after/intercept/runtime-change/cleanup/UI
artifacts mirrored, 662 hashes; MANIFEST **c511bc373dccac4d4c578277c4376f00ca945675986e28931e2244ec1004fc14**. Coordinator
review/repairassignment pending; scopedproposal reuse existing handleLogout error
feedback and return before localclear/navigation on rejection, preservingdesign.


## PR138 — actionable profile Settings logout failure

Adopted finalmaster2d66626c on separate codex/stream3-logout-failure-feedback; old
136branch preserved. Only existinghandleLogout catch: existingtoast.error safe
Could not confirm sign-out. Please try again. thenreturn beforelocalclear/navigation.
Successfulpath/otherhandlers/design unchanged. Commit287058421aea780806c59142fa7796df971b3e98
pushed draft https://github.com/WangPantopus/skinny-pantopus/pull/138 . No newfiles/tests.

ActualUI Bob/current507ef9ec preflight; reviewedprivate exactone-shot50312:41:56.166
allmatchtrue/noforward/noSetCookie. Settings/identity retained; error visible inAX
and keyboard LogOut stillusable. Full own app/GoTrue metadata andprefs[] unchanged.
Fault consumed; samebutton keyboardretry real200 retiresonly507ef9ec inregistry/
GoTrue and reacheslogin. Allotherownmetadata/prefs unchanged; zero refresh/429;
no loginreturn replay (accepted136 unchangedsuccessfulpath reused). Onefault only,
no optionalduplicateattempt. Synthetic preforward failure, not offline/lostcommit;
wording doesnotassert stillsignedin for all errors. Native/hosted remainsunverified.

Cleanup: faultAPI6394 stopped, restoredAPI7948/exec60505 originalenv/argv/cwd exact
in-memory verified, originalhookSHA d7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; descriptorabsent/tab29closed. Next42165/42493+DB retained. Naturalrevoked/
auditrecords retained; browser now signedout, no resurrection/newlogin. Baseline
andcandidate ownmetadata/UI/HTTP/cleanup in logout-feedback-*; privateenv/rawlogs
excluded. Existing57authchecks pass, webtypegate0errors, scopedlint0errors/one
existingts-nocheckwarning, diffpass. Sourcepage retains existingts-nocheck, so type
gate alone doesnotverify handler; actualUI/HTTP/SQL is primary.

ExactCI35601204534 queued at287058421; draftreview/integrationpending. Durable
673 hashes; MANIFEST **6c40498319ab8d84d371dbf982c9d81b4eae7a2ac9533fa3cbc9dd3f80122272**. Fullstream remainsincomplete.


Evidence correction: initial logout-feedback-ui-failure.txt saved a later AXdiff
after toast removal, so alone didnot substantiate errorvisibility. Recovered original
CUA function_call_output at12:41:56.394 from ownsession logline20980 into NEW
logout-feedback-ui-failure-original-tool.txt: Settings URL/AuthBob and exacterror
text at107, reusableLogout92 focused, Dismissnotification108. ProvenanceJSON records
originalcall/timestamp/source/hash. Originaldiff preserved, no reconstruction or
browser/relogin/logout replay. Durable675 verifiedhashes; MANIFEST
**c6117ee2ec41d001556967f0b6b91ddf600d5afed7d1e9fefc7b1ee5b22a76cc**. PR138sourceunchanged; coordinatorreview.


PR138 original exact287058421 CI35601204534 **SUCCESS**: webchecks/build,
IdentityFirewallE2E, database replay/safeguards, aggregatepassed. Backend/native/
Seeder skipped byscope, not runtimeproof. Receiptlogout-feedback-ci.json; durable
676 verifiedhashes MANIFEST **bcd878a527a399fb842ffe0e80d75f5a79fea752430371b0cb539eca36022349**. Originalbranchfixed,
coordinator merge/integration reviewpending. No further runtimeexpansion inbatch.


## Final cohort disposition — PR138 merged, bounded acceptance retained

Remote read confirms PR138 updated head532296c802ae9aba5616f26568c4398edd096db4
CI35601772751 SUCCESS and merge b946eb9ea99819ffb27f42252cdaab237d02dea0.
Coordinator reports update added only four accepted Home137 paths; tested Settings
page bytes unchanged. PR137 merged274e6e1c first; coordinator combined paidlocal
1f1c353c sourcebindings/checks reported passing. Those combined checks are coordinator
evidence, not a Stream3 rerun. Original287058421/CI35601204534 evidence retained.
Corrected original toast AX/provenance remains accepted; original later diff preserved.

Implementation/CI/merge complete for this narrow handler repair. Actual acceptance
remains synthetic pre-forward503 keeping Settings/error/currentidentity, unchanged
fullownmetadata/prefs, then real local logoutretry200 retiring only507/currentGoTrue
and reachinglogin without refreshburst/429. No native/hosted/genuineoffline/lostcommit
or wholeauth/stream completion claim. Prior136 destinationreturn reused only for
unchanged successfulflow. Fullstream broader acceptance remains open.

Retained last-verified runtime API7948/exec60505, Next42165/42493, ownedDB; original
privatehook/env restored, descriptorabsent/testtab29closed, browser signedout, natural
revoked/auditrecords retained. This disposition update does not probe runtime again.
No local sourceadoption, UI/API/check replay or new scope. Localoriginal287058421
branch and old136ref preserved. Durable676 manifest remains
bcd878a527a399fb842ffe0e80d75f5a79fea752430371b0cb539eca36022349.
Coordinator finaldocumentation/publication owns next integration step.


## Source-only next boundary — lost committed local logout reply

Current originmasterf4b27786172d7b2cae641b4c94f9e77aa75928c1 fetched only, not adopted; local287058421
fixed. Eight relevantpage/SDK/middleware/Nextproxy/backendservice bindings exactcurrent
master. PR82 partialfailure AFTERretirement and destroyed globalreply duringaccount
switch do not verify sameaccountlocalresponse-loss retry. PR136 successfuldelivered
logout andPR138 preforward503 likewise insufficient. Boundaryunverified; no observed
newdefect/runtimeclaim. Detailedlogout-lost-response-source-proposal.json mapsordering:
queuedclearCookieheaders→resolveproof→GoTruelocalrevoke→best-effortregistry/audit→
originalres.json; SDK onlyretireslocally afterreceivedsuccess, UIcatchsafeerror.
HTTP200alone cannot prove revocation (helper/safeHook can swallowfailures).

Propose separately granted newordinaryBoblogin (currentlysignedout), exactownsession
snapshot; private one-shot exactlogout response-end hold ORIGINAL200 beforeheaders
sent, verify SQLcurrentretired/GoTrueabsent andothermetadata/prefs unchanged while
socketpending, then destroyonlyoriginalsocket beforeheaders/bodydelivery. No
synthetic200/503, no cookie/tokenvalues. Record actualNextproxy/browser failure and
automaticauth; stale sessionflag may triggerrecovery, so no no-refreshassumption.
Optional separatelygranted samebuttonretry onlyifexistingcontrolremains; no relogin
or workaround ifnot. Non200/headerssent/deadline/failedcommitproof: stop and release
originaluntouched response wherepossible, record actualvariant. Preserve natural
records; exacthook/env/ownedAPIrestore+closetab/descriptor cleanup. No appedit/tests/
login/logout/refresh/provider/native/runtimeaction in this source-onlyassignment.
Existingimplementation/privatehook suffices; no replacement/schema or duplicate
backlog. Durable677 verifiedhashes MANIFEST **06df0aa18798993509bd9a092fa3596be0961bae2399f01eb54e044abc7f42d4**. Coordinator
runtimereviewrequired; source/runtime/signedoutstate preserved.


## Lost committed local logout reply — bounded original-response result

Initial prematuregrant withdrawn before anyruntimeaction: onlyREADME/source/ps/Git
reads occurred. Corrected written grant used aftereightmasterbindings confirmed;
paidnext.config onlyunrelatedstatusprivacyheaders differs. Local287058421fixed,
no adoption/appedit/test/provider/native action. One actualBoblogin established
5d64b918-f785-4075-b742-67a0128f42f3; allotherownmetadata/prefs unchanged.

Original actual Settingslogout200 held13:30:00.004UTC atresponseend withallrequest
matchbooleans true, headersSentfalse,4queuedclearCookieheaders (no valuesrecorded).
LiveSQLproof whilepending: exactcurrentregistryrevoked/GoTrueabsent, allotherown
app/GoTrue rows andprefs[] equalbefore. Only afterproof, originalsocketdestroyed
13:30:00.153 after149ms (under8secdeadline). Close13:30:00.154 hadheadersSentfalse,
destroyed/socketDestroyedtrue,writableEnded/Finishedfalse; no finish event/original
response delivery. Originalstatus200 comesfromheldresponse, not deliveredHTTPlog.
No manufacturedstatus/body/session/cookie.

FirstUI capture stillSettings/AuthBob; subsequent actualUI login preserving
redirectTo=/app/profile/settings. OneautomaticrefreshPOST401 at13:30:04.836;
no GoTruetokencall/newlogin/429. Full finalownmetadata/prefs exactlycommitproof;
onlysetupsession wasretired, no resurrection. No currentLogoutcontrol remained,
so conditionalmanualretry NOTperformed; no relogin/workaround. Actualbrowser
endedsignedout; intermediateerror/toast and exactNext/browserlogoutstatus not
captured (filteredbrowserlogs empty, retainedNextlog no matchingstatus). Do not
claim a particular502/status or zero-frame privateUI; cachedSettings initially
visible is not serverauthorization. OriginalAPI→Nextresponse-loss boundary proven,
physicaloffline/native/hosted/providerfailure notverified. No repairneeded established
for observed automaticrecovery; conditionalretry remainsunexercised.

Cleanup: originalprivatehook exactSHAd7c8b95318bab69c34050b6924df8ed9f7a5b44be79d0a3f39e8b35cd9768a5d
restored; faultAPI48055 stopped, restoredAPI48548/exec80449 original
env/argv/cwd exactinmemory; descriptor/decisionabsent, tab30closed. Next42165/42493
+DBretained, naturalrevoked/auditrecords andsignedoutstatepreserved. No rawenv/log/
token/cookie export. Safe logout-loss-* snapshots/observer/transport/UI/cleanup
mirrored, 691 verifiedhashes MANIFEST **d49d23a7d72e93b75e6f7f2379e8a8d3a0d83d763ed874ca0eecc818b421120f**. No newCI/source
change; coordinatorreviewpending within above limits.


## Next inventory priority — A02 remote revocation/open browser (proposal only)

Reuse accepted82/136/138/691. PR82 proved sign-out-others auxiliaryHTTP401, not
private-state retirement/current authorization in a still-open secondary browser.
Local logout/reply-loss acceptance cannot substitute. This is the next bounded
security/session gap; native/provider/platform limitations remainopen. No repeated
source searches or runtimejourneys thismilestone. ExistingSecurity step-up action→
/api/auth/sessions/revoke-others→authDeviceService/AuthSession/GoTrue contract from
accepted82; latest client/middleware bindings reused with exact priorlimits.

Propose one visible secondarybrowser case after coordinator narrowremote-action
source rebind and isolationreview. Existing authorizedfixture must have zeroactive
sessions before creating two ownlogins; do not revoke retainedBob/peerfixture
sessions. Two independent cookie/store contexts and distinctsessionIDs required;
two tabs alone insufficient. Supported separateprofile capability or reviewedowned
alternateorigin stillunverified. If no zero-sessionfixture/context, stop for exact
assignment; no speculativeaccountcreation. ClientA actualSecurity signoutothers,
clientBprotectedSettings read/poll denied/private-state retired; Aretained/Brevoked
SQL/GoTrue, eventualsafe logincontinuation undercurrentauthorization. No global/
offline/native/frozenbrowser/provider expansion or oldcancel/passwordtestrepeat.
Naturalrecords retained, newlycreatedsessions cleanup onlywithinfuturegrant.
Detailed a02-remote-open-browser-next-proposal.json. Not runtime-ready: fixture/context
availability and narrowremoteroute binding pending. Current signedout/API48548/
NextDB/source preserved. Durable692 MANIFEST **b5d2ea6bfc7064d33a17d47c34720268f3eae3223064e94ed6ea1a7c81418576**.


A02 assigned readonlypreflight:12 targeted Security/StepUpSDK/routes/middleware/
services/socket/config bindings exactmasterf4b277861, no sourceadoption/change.
Knownowned AuthEvan d3671605-b8cc-4e92-8c82-99aa5041ff48 existsinapp+auth, email
confirmed, zero unrevokedapp/GoTrue sessions/devices/resumegrants. Alice/Charlie
zero counts excluded because actualaccountsdeleted; Bob3/Dana14actives preserved.
Currentbrowser signedout; recoverytab4 untouched. No accountcreation/login/revoke.

Supportedcontext inventory IAB1 andChromeextension4; distinctbrowser surfaces, not
yet provenisolatedauthenticatedsessions. Proposed sameownedalias18131 inboth, no
alternatehost/profileinstallation. Host-onlylax cookies, refreshpath/api/users/refresh;
APIcapturedoriginalenv explicitlyallowsalias. AliasSocketContext uses sameorigin
/socket.io rewrite, not literal-localhostdirectbranch. Actualsocketconnect/delivery
stillunverified. Passwordstepup creates thenrevokes temporaryGoTrue session; future
evidence must accountforit and confirmabsence, not assumeonlytwo sessioncreations.

Future narrowjourney: verifydistinctA/Bsession IDs on sameexistingEvanfixture after
recheckingzeroactive; AexistingSecuritystepup signoutothers, BvisibleprotectedSettings
read/poll/sessionevent denies+retiresUI/login; Aretained/Brevoked andtempstepups gone.
No historicalcancel/passwordcase replay/native/provider/global/offline expansion.
CleanupnormalA logout onlyifgranted/newtabs only/naturalrecords retained. No runtime
restart/appedit/tests/cookie-storage mutation or userhistory access. Detailed source/
fixture/context/config a02-remote-open-browser-preflight.json plus two safe inventory
artifacts; durable695 MANIFEST **c772d3d05b9548edf915893272db8bf7fcddd07799760ea4837df9a6e6f71655**. Runtimegrantpending.


Assigned two-browser runtime stopped before authentication: exactEvanzero/full
baseline confirmed (27historicalapp rows, GoTrue0,prefs0,devices/grants0). IABtab31
opened login only. Chromecreate request timedout30s and resetCUA; oldChrome4 then
reportedunavailable. No credentials entered in eitherbrowser; no login/revocation.
Recovered/closed onlynewIAB31; laterbrowserinventory showsChrome2 andIAB1. Readonly
Chrome2 ownedtargettab query returnednone; no Chromecreationconfirmed, no borrowed
user tabs closed or storage/history read. No blindcreate retry/profile workaround.

Full afterEvanmetadata/prefs exactlybaseline; no authHTTP sincebaseline. API48548/
NextDB/source unchanged; originaltab4/signedoutstate preserved. This is capability
interruption, not product failure or remote-revocation acceptance. Context4→2
identity/retry scope needs coordinatorreconciliation; actual two-context isolation
unverified. Safe remote-browser-before/abort artifacts; durable697
MANIFEST **622e0f021ff1778933d0089cb65905867e8c23862bf94909c8dd569df1891eeb**. No tests/appedit/runtime restart.


## A02 reconnect retry — runtime restored, second browser context unavailable

README "one A02 browser reconnect retry" followed on a new Claude session (harness
changed from Codex). Documented retainedAPI48548/80449 andNext42165/42493 were absent
at start: no18130/18131 listener, PIDs gone, hostuptime1d3h (no reboot); retained
Supabase stream3-block-r1 64531–37 andSMTP64535 still running. Only the owned API/Next
were restarted from the exact previously captured private launch files (identical
executable/argv/cwd/22-key env, original hook sha d7c8b953 unchanged, all21 fault
trigger paths absent), Next with NEXT_DIST_DIR=.next-stream3 on stream3-auth.localhost
18131; login page200. This is restoration from identical inputs, not continuity of the
prior processes. No app edit/env mutation/DB write; local287058421 source fixed.

Evan recheck after restart (a02-retry-before.json): appUnrevoked0/total27, GoTrue0,
devices0, resumeGrants0, prefs0; appSessions/GoTrue/prefs byte-equal to remote-browser-
abort.json; only two /api/health404 liveness probes in authHTTP since restart.

Second context: Claude in Chrome list_connected_browsers returned [] initially and on
the one bounded retry; tabs_context reported extension not connected, no tab group, no
owned target tab. Google Chrome process57357 runs but no extension instance is signed
in to this account. Prior Codex IAB1/Chrome4→2 identities are not addressable here.
Per grant: no tab creation, profile/alternate browser/extension install, cookie edit,
IAB login or credentials. Built-in browser pane left closed. Capability boundary, not
product failure; distinct-session/A step-up/B retirement scope untouched.

User reported the extension installed and signed in; three further connection reads
still returned [] and one bounded tabs_context createIfEmpty reported not connected
(no tab created). Read-tier computer-use look at Chrome only: profile window shows
claude.ai settings with Preferred browser = Built-in browser and no pinned Claude
extension icon; the other window is an Incognito Pantopus tab owned elsewhere, untouched.
Extension instance is not registered to this account from this session; likely side
panel never opened/signed in for this profile, different Claude account, or reload
needed. No install/reload/sign-in/profile/incognito change performed.

Artifacts a02-retry-before/runtime-restore/browser-boundary.json; durable700
MANIFEST **6aadada10fe3ceb6f94576bf1b2becc3bc015e808e76fef69d0d7de807862f82**.
Next: user opens the Claude side panel in Chrome signed in as this account (or
coordinator assigns another supported second context); then Chrome target tab first,
then IAB tab, per grant. Runtime36126(API)/36139(Next) retained. No tests/app edit.


## A02 remote sign-out — two-context journey completed

User confirmed the extension; Claude in Chrome then reported one connected browser.
Evan rechecked zero (a02-retry-prelogin.json equal to before). Exactly two owned tabs:
Chrome tab257777372 (clientA) and built-in pane tab (clientB, emulated1280x900 because
the hidden pane reports0x0). One ordinary UI login each: A POST/api/users/login200
01:32:03→session15b7e0a8; B 01:32:52→f10f6310. Binding by real requests: server
AuthSession.user_agent from each login equals that browser's navigator.userAgent
(Chrome/153 vs Claude/2.2553.1 Chrome/152); A's Security page listed both with
"This device" on the earlier one. Two app + two GoTrue sessions, devices/grants/prefs0.

A existing Security "Sign out of all other devices"→password step-up modal→POST
/api/auth/step-up200 01:34:45.811→POST/api/auth/sessions/revoke-others200 .896 (both
Chrome UA in API log). GoTrue audit: login .770 (temporary step-up session), logout
.803 (temporary removed), logout .879 (B). SQL: B revoked_at01:34:45.884 reason user,
A unrevoked; GoTrue only A; 27 historical rows/prefs/devices/grants byte-equal to
baseline. Only non-session change: auth.users.last_sign_in_at moved to the step-up
login time. A Security re-listed "This device" only; A polls continued304.

B untouched on personal Settings: its next real ~5s polls at01:34:48.763 returned401
(unread-count/chat stats/received-offers), SDK POST/api/users/refresh401 once, no
GoTrue token call/429, then location /login?redirectTo=%2Fapp%2Fprofile%2Fsettings with
Sign in form only. No manual control, workaround login or timer change. No socket
connection/event evidence captured; no socket delivery claim. Retirement proven via
HTTP401 path only. Post-retirement layout GETs401 observed, no visible failure.

Assigned cleanup: A ordinary Settings Log Out→POST/api/users/logout200→/login;
A revoked_at01:36:14 reason logout, no refresh POST/429; final GoTrue0/app unrevoked0,
appTotal29 (27+2 natural revoked rows retained). Both owned tabs closed, viewport
reset, no other tab/store touched. Runtime36126/36139 and DB retained; no fault
triggers armed; no app edit/new test. Not physical offline/native/hosted/provider.
Artifacts a02-retry-{prelogin,after-login-a,after-login-b,bindings-pre-revoke,
after-revoke,final,result}.json; durable707
MANIFEST **f50472b0c2c7825c8c5aa26a6ab59085ea6ff95329d406991d15cba8a7247234**.
Next: coordinator review; A02 open-browser gap closed within these limits.


## Next inventory priority — A01 signup verification and reset completion (proposal only)

With the A02 open-browser gap closed, the next unresolved accounts row runnable on the
retained local runtime is A01: complete signup/email verification and the password-reset
final credential change that earlier needed user takeover. Eight bindings (users.js,
emailService.js, register/verify-email/verify-email-sent/forgot-password/reset-password
pages, SDK auth.ts) are byte-equal to origin/master ed391c3a6; local287058421 fixed.

Contract from source: register→503 when delivery unavailable→400 taken/invalid→admin
generateLink(signup)→User insert (verified:false, auth user deleted on insert failure)→own
SMTP verification link {APP_URL}/verify-email?token_hash→503 if send fails→201, no
auto-login. verify-email→anon verifyOtp→400 invalid/expired→User.verified sync→any
verifyOtp session dropped→login. forgot-password (5/15min)→generateLink(recovery,
/reset-password)→sendPasswordResetEmail→one enumeration-safe message. reset-password→
client length/match checks→verifyOtp(recovery,token_hash)→scoped updateUser→revoke ALL
sessions/devices/grants+watermark→200→login; 400 invalid/expired or unable. Mail sink is
retained Mailpit 64535/64536 (12 lifecycle messages retained), not GoTrue's mailer.

Proposed runtime (not started): one new owned synthetic stream3-auth-r3-*@example.com
created only by the real register form and deleted exactly at cleanup; Evan d3671605
(zero sessions) as reset target, password restored to the recorded fixture value by a
second real reset. Journeys: signup success→Mailpit→verify link→verified→first login;
duplicate email/username 400; login-before-verification actual response; consumed
verify link reuse 400 and resend; reset success→old password fails/new succeeds; consumed
reset token reuse 400; unknown email same message/no mail. Expired tokens need clock or
config change (limit). No provider/native/hosted mail, no limiter exhaustion, no lost-
response hook in this milestone. Detailed a01-signup-reset-source-proposal.json; durable708
MANIFEST **f967e080959dde6c0e05f6b89f6275b651576cbb218712ee9b7f5d30d327cb01**.
Coordinator fixture/account-creation grant required before runtime. Runtime36126/36139
and signed-out state retained; no app edit/new test.


## A01 signup verification and reset completion — verified; unverified-login repair PR145

User granted the A01 runtime scope directly. Built-in pane tab only (UA Claude/2.2553.1),
retained API/Next/DB, real Mailpit 64535/64536. Signup: real /register form for new owned
stream3-auth-r3-frank@example.com→POST/api/users/register201 01:55:35→/verify-email-sent;
auth.users unconfirmed, User.verified false; Mailpit "Confirm your email for Pantopus"
with /verify-email?token_hash link (token never exported). Login before verification with
correct credentials→POST/api/users/login401 and "Invalid email or password" while API log
recorded GoTrue "Email not confirmed": REPRODUCED DEFECT — users.js mapped every
signInWithPassword error to the generic401, leaving its own 403 "Please verify your email
before signing in."/needsVerification branch unreachable. Verify link→verify-email200
01:57:21→login page; email_confirmed_at set, verified true, GoTrue/app sessions0 (verifyOtp
session dropped). Consumed link reuse→400 "Invalid or expired verification link/code" +
Resend; resend for verified account→200 enumeration-safe message, API skipped, no mail.
Verified login200→/app/place; logout200. Duplicate signup→400 "A user with this email
address has already been registered" visible, no new rows.

Reset (Evan d3671605, zero sessions): forgot-password200→recovery_sent_at, GoTrue audit
user_recovery_requested, Mailpit "Reset your Pantopus password"; unknown email→same message,
no mail. Reset page client checks "Passwords do not match."/"Password must be at least 12
characters." without network. Reset200 02:01:16→login page; GoTrue audit login/
user_updated_password/user_modified/logout (scoped recovery session removed), AuthSession
rows byte-equal, prefs/devices/grants unchanged, "All devices were signed out" notice mailed.
Old password401, new password200→/app/place, logout200. Consumed token reuse→400 "Invalid or
expired reset token". Fixture password restored by a second real forgot/reset; original
credential login200 then logout. Expired-token/SMTP-outage/limiter-exhaustion not exercised.

Repair: smallest existing-route change on codex/stream3-unverified-login-feedback
(932bfc227, PR145 https://github.com/WangPantopus/skinny-pantopus/pull/145): in the existing
authError branch map /email not confirmed/i to the existing 403 needsVerification response
(9 lines added). API restarted from the exact captured recipe (36126→50622). Fresh unverified
stream3-auth-r3-grace@example.com→login403 with "Please verify your email before signing in."
and the login page's existing Resend control; resend200 mailed "Your Pantopus verification
link"; verified account wrong password still401 generic, no resend control. Existing
tests/authDpop + authUsersHooks 127 passed; node --check clean; no eslint config in backend;
no new unit tests. Next dev rewrote web tsconfig include for .next-stream3 (unstaged).

Cleanup: Frank/Grace AuthSession/User/auth.users rows deleted in one transaction (auth.users
3/User3/orphan0); Evan active0/GoTrue0, two natural revoked login rows retained; Mailpit19
natural messages retained; pane tab closed/viewport reset; runtime50622/36139+DB retained.
Artifacts a01-{before-evan,signup-mail,signup-result,reset-before-evan,reset-mail,
reset-after-evan,reset-final-evan,reset-result,fix-verification,cleanup}.json; durable718
MANIFEST **60ed88d5f44ce6c0caf08f900cc2e2c419bf14a108a581fa007a5de13ef55a2f**.
Next: PR145 CI/review; remaining A01 limits are providers disabled, expired tokens,
delivery outage and native clients.


## Native iOS/Android accounts journeys — verified; three more repairs (PR149/151/152)

User directed full native coverage. Built Debug iOS (xcodebuild, worktree .env API/SOCKET
127.0.0.1:18130) on owned simulator Pantopus Stream3 Social R2 (erased twice: unknown r2
passcode, then clean push-fix check) and Debug Android (gradlew assembleDebug, .env
10.0.2.2:18130; first daemon died at host load 170, retry 10m51s) on new owned emulator
Pantopus_Stream3_Accounts_R3 (android-34 arm64). Retained API restarted twice from the
exact recipe to load repairs (50622→80982); Next 36139/DB retained. Evidence in
native-accounts-result.json (27 journeys) and screenshots; durable719
MANIFEST **51cbc2a6b4f725468b12f183c46766652519c1521c297a654a88c830d9b7478b**.

Verified natively (real API/SQL/GoTrue audit for each): iOS/Android login with device
registration (iOS trusted, emulator unverified), wrong password 401 messages, OAuth Apple
start→consent→cancel, Devices screens (iOS gated by device-owner prompt; simulator accepts
any passcode), remove orphaned device (wrong step-up → password_failed/device retained;
correct → DELETE device, session device_revoked), sign-out-others from iOS and from Android
retiring the web client (401s→refresh 401→login redirect), web revoke retiring iOS and
Android via socket kick (kicked:1 then kicked:2, both refresh_refused within 200ms,
"You were signed out for security" + account hint), forgot/reset on both (deep link
pantopus://auth/reset-password, mismatch/no request, success revokes all others with
password_reset, fixture password restored by the iOS reset), Android native sign-up →
unverified login 403 + Resend (PR145 natively), Android notification preferences toggle
PUT /api/hub/preferences persisted and restored, Blocked users empty state, Settings
logout on both, iOS cold-start resume, simctl push foreground banner.

Defects reproduced and repaired (smallest existing-code changes, each verified on rebuilt/
restarted runtime): PR149 iOS posted the APNs token before any sign-in → 401 → first-ever
login screen said "Your session has expired" (defer until signedIn; token now saved by the
post-login device registration). PR151 resent verification links are magiclink tokens but
native clients post type=signup → "Link expired" in-app (verify-email retries the hashed
token with the alternate purpose; Android verified from the resent token). PR152 after a
deliberate iOS Log out a racing GET /api/hub with no token hit endSession(.expired) → the
login screen claimed expiry (reason published only when a session actually ended).
One Android ANR occurred only during host load 74–170 with an idle main thread afterwards
and never recurred at load <10; a stale system ANR window needed an emulator reboot.

Limits: no APNs/FCM provider delivery (simctl push only), no Face ID enrolment path, no
physical devices, providers disabled, Lockdown (sign out everywhere) and native account
deletion not exercised, retained DB lacks LocalProfile.verified_resident (chat identity
warning only). Cleanup: Hank and Evan's test preference row deleted (auth.users 3/User 3,
Evan active sessions 0); natural revoked sessions/devices/push tokens and Mailpit retained;
simulator/emulator apps left installed and signed out; web tab closed. No new unit tests.

Addendum: Android Lockdown verified — Devices→Lockdown→dialog→password step-up→POST step-up
200→POST /api/auth/sessions/revoke-all 200 (sockets disconnected); own session revoked reason
lockdown, Evan active sessions 0/45, remembered devices 0/4 active, GoTrue 0; app on login with
account hint, no banner. A second emulator ANR (6.5s input timeout at host load ≈13 while
system_server itself skipped 36/88 frames) is recorded as emulator starvation, not an app
defect; a dedicated Android performance pass on a quiet host is recommended. Native account
deletion left unexercised to preserve fixtures. Durable719 MANIFEST
**dd5a17bb716623447c3a4e44998e00ae298538c3e3f7759f6c46100bb35e7a42**.

Addendum 2: iOS Lockdown verified — popover confirm → password step-up → revoke-all; own session revoked reason lockdown, active sessions 0, devices 0/4, GoTrue 0; login shows "You were signed out for security" + hint. Durable719 MANIFEST **7d6a3522a978b020ef1cd4c6f4098713688fbfbe13f3483dd16dad52540abf2d**.

Addendum 3: PR152 first commit failed two existing iOS unit tests on CI (terminal-401 contract); replaced by a deliberate-sign-out flag (72ec734db), both suites 41/41 locally, rebuilt app re-verified: Settings→Log out with the same racing no-token 401 shows only the account hint. Durable719 MANIFEST **09b2c346c28031033c2943bacfb85ae7ae54b5cba4bef232df18b039b210971c**.

Coordinator note follow-up: PR152 was repaired as directed (suppress the reason only for
the app's own sign-out): AuthManager remembers a deliberate local sign-out, the next login
clears it, and the terminal 401 handler ignores a 401 while it is set and state is
signedOut; endSession is unchanged. AuthManagerTests + DeepLinkRouterSessionReturnTests
41/41 locally, PR152 CI green on 72ec734db (all three simulators). Stream3 accounts scope
for this session is complete; awaiting merges of PR149/151/152 and the next assignment.

## Stream 3 resumed verification — cache boundary and CI handoff (2026-09-22)

This section records the resumed work after the previous native batch; it does not replace
the earlier evidence or claim closure for the remaining N01–N05/A01–A05 inventory rows.

### PR163 warm-cache repair

Requirement: a block or unblock must take effect through the existing feed screen without
waiting for the feed-filter TTL. The existing implementation cached UserBlock-derived feed
filters for 60 seconds and block routes only invalidated the block-service cache.

Baseline reproduced on the retained local API/DB and the real browser Connections screen:
Bob warmed a temporary Dana post, blocked Dana from Dana's existing profile menu, and
immediately reloaded the feed; the post remained visible. Bob then unblocked Dana from
Settings → Blocked Users and immediately reloaded; the post remained hidden until the
normal 60-second TTL expired. This is a real UI → HTTP → persistence → feed observation;
the temporary relationship/post/blocks were fixture rows, not mocked persistence.

Repair is the smallest existing-service extension in PR163 commit `d6b623a0e`: after a
successful block/unblock, `routes/blocks.js` invalidates both affected users' feed-filter
caches; sender blocking in `routes/neighborMessages.js` does the same. The candidate API
was started from the PR163 worktree on the retained port, and the same real UI journey
immediately hid the post after block and restored it after unblock. The candidate did not
touch peer runtimes. Existing follow/post/comment privacy checks remain documented in the
PR and were not redesigned.

Cleanup was completed against the recorded fixture IDs. Final probes show no temporary
probe post, relationship, or block; retained baseline is 6 posts, 20 notifications, and
1 pre-existing UserBlock. The cleanup helper was invoked with `--help` by mistake, but its
actual deletion set matched the recorded temporary batch; no unrelated rows were retained.
Evidence: private operational audit under
`/private/tmp/pantopus-stream3-20260920-r1` and durable native bundle
`.pantopus-recovery/audits/20260922-stream3-native-social-r1` (MANIFEST
`4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`). PR body updated with the reproduced baseline, repair, cleanup and
limitations. The coordinator refreshed the branch to `f1ca9002` and merged PR163 as
`e5335f584dd99f82e7c66a3974b04400098f0c0c`.

### Android PR168 CI repair

Fresh PR168 CI reached ktlint and instrumented tests but failed Detekt because the newly
added `PrivacyHandshakeViewModel.fetchAndProject` measured complexity 22 (threshold 18).
The code was repaired in place by extracting the existing suggestion/follow fallback and
its unchanged error branches into `fetchSuggestionAndFollow`; no suppression or new test
was added. Branch `codex/stream3-android-social-follow-block-chat` was rebased onto
`origin/master` `662ab04b` and force-with-lease pushed at `41b1c8a15`. The coordinator
will run the next CI; no new native build is claimed for this code-only repair.

### Fresh Android native recheck and current boundaries

The cache repair is verified end to end on the retained web runtime. The granted Android
slot was used once: `:app:assembleDebug` succeeded from integration `b0f7b6bbe`, the fresh
APK was installed only on `emulator-5554`, and the four pending screens were exercised.
Current Location opened the real Android permission dialog and denial returned the existing
location error; Beacon Follow exercised the 404 suggestion fallback plus plain follow 201;
the retained reverse UserBlock produced Follow 403 and the existing refusal toast; direct
message send produced 403, the blocked-conversation banner, and zero persisted ChatMessage
rows. A same-actor Bob→Evan block was also created and removed through the real profile and
Settings screens. The retained fixtures derive `Persona` identity (no home-residency context),
so the Persona Follow affordance remained visible after that personal UserBlock; this is a
distinct Persona scope and does not substantiate the local-neighbor Follow-row-hide branch.
Android logged out through Settings afterward. Screenshots and records are in the durable
bundle; its current MANIFEST is `4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`.

Final cleanup capture: `final-cleanup-20260922.json` records the restored baseline
(6 posts, 8 comments, 20 notifications, 1 retained pre-existing UserBlock, zero
temporary follows/reports, Evan active sessions 0, Bob active sessions 4). Evan's
recorded fixture password was restored through the real reset link and endpoint; the
private helper's payload typo was corrected after the first failed attempt, and the
verification session was revoked. Mailpit history was preserved (44 retained messages
at capture). The refreshed bundle MANIFEST is
`4a9cf65e2182ae604aef07e049d6cf54dce248b9805f98a8291c7a751f708aea`.

New iOS device-hub interaction is currently unavailable, and no provider delivery,
physical-device, hosted-migration, or APNs/FCM evidence is claimed here. The Android slot
is released. Remaining work is coordinator integration/CI and the other independently open
N01–N05/A01–A05 acceptance rows; do not rerun the cleanup helper or claim unit-test
coverage as feature closure.

## A05 profile safety action — real web reachability and report contract (2026-09-22)

The initial bounded A05 pass exercised the existing web profile action through the retained
local runtime. An authorized isolated Bob fixture logged in through the real
`stream3-auth.localhost:18131` login page, opened Dana's real public profile, expanded
its existing overflow menu, selected **Report profile**, and reached the existing
**Report User** modal. Selecting an allowed reason enabled the existing **Submit Report**
button. The final click, persistence, duplicate, failure/retry, and cleanup were completed
in the addendum below; the initial source/UI evidence remains separately bound in
`a05-profile-report-source-ui-20260922.json`.

The source trace is bound to the current worktree: `PublicProfileClient.handleReport`
creates the action-scoped target, `submitReport` calls the existing
`api.users.reportUser`, the SDK posts `/api/users/:userId/report`, and `users.js` applies
`verifyToken`, the established Joi reason set, target existence, duplicate idempotence,
`UserReport` persistence, and a 503 when the table is unavailable. `ProfileHeader` keeps
Report profile in the existing overflow menu and `ReportModal` keeps the current visual
and reason treatment. The final status and refreshed MANIFEST are recorded below.

No application file, schema, provider, or unit test was added.

### A05 profile report — persistence, duplicate, failure and cleanup complete

The prepared report was submitted through the same real browser UI on the retained local
API/database. The UI showed the existing `Report submitted` toast and SQL found exactly one
`UserReport` row for the isolated Bob→Dana pair (`spam`). Repeating the same report through
the UI returned the same generic success toast and SQL remained one row with the same id,
matching the endpoint's existing `already_reported` idempotence contract.

For the unavailable-storage case, `service_role` SELECT on `UserReport` was revoked before
a third UI submission. The UI showed the existing `Couldn't submit your report. Please
retry.` toast and no extra row was written. SELECT/INSERT were restored, a retry through the
UI returned the success toast, and SQL still showed the single original row. The exact
temporary row was then deleted with actor/target/reason predicates (`DELETE 1`, follow-up
count 0); the fixture actor logged out through Settings → Log Out and the browser ended at
`/login`. Evidence: `a05-profile-report-final-evidence-20260922.json`. The source/UI checkpoint was 111 files; the API evidence below refreshes the bundle to 112 files.

This closes the web profile report journey within the local fixture scope. It does not claim
moderation-review behavior, provider delivery, an external recipient, or a native profile
report screen; existing native and other content-report evidence remains the applicable
coverage for those surfaces. No application/schema/unit-test change was made.


## A05 profile search → destination — actual web workflow (2026-09-22)

A separate reachable-action pass used the existing web AppShell search with the isolated
Bob fixture. Typing `stream3_auth_r3_dana` and submitting the real header form navigated to
`/app/discover?q=stream3_auth_r3_dana`; the real universal-search result list showed
`Auth Dana /stream3_auth_r3_dana PROFILE`. Clicking that existing result opened the real
`/stream3_auth_r3_dana` profile route and showed the existing Message, Request / Hire,
Follow, Share, and overflow actions. The actor then logged out through Settings → Log Out
and the browser ended at `/login`.

The source trace is `AppShell.openDiscover` → existing `/app/discover?q=` route,
`useUniversalSearch` → `identitySearch.searchProfiles` for profile scopes with stale-query
retirement, and `UnifiedResultCard` → `router.push(item.href)`. Evidence is
`a05-search-profile-destination-20260922.json`; the source/UI checkpoint was the 111-file manifest; the API evidence below refreshes it. This verifies the
real web search-to-profile destination within the local runtime; it does not claim search
provider/index freshness, native search parity, or unrelated marketplace/subscription/
booking/wallet/mail actions. No application/schema/unit-test change was made.

The report-storage fault injection is also explicitly bounded: service_role SELECT was
revoked only on `UserReport`, then SELECT/INSERT were restored; final `\dp` showed the
standard full `arwdDxtm` ACL. No other table privilege was touched. A pre-fault ACL snapshot
was not captured, so the evidence records the final ACL and this limitation rather than
claiming an unsubstantiated byte-for-byte before/after comparison.


### A05 profile search — API and no-write evidence addendum

The same search journey was bound to the real API and retained SQL. An authorized Bob
fixture login returned HTTP 200; `GET /api/identity/search?scope=all&q=stream3_auth_r3_dana&limit=5`
returned HTTP 200 with one `local_profile` result (`Auth Dana`, href
`/stream3_auth_r3_dana`), and fixture logout returned HTTP 200. Before/after SQL counts
for `UserFollow|UserBlock|UserReport|Notification|ChatMessage|Post` were identical at
`0|1|0|20|0|6`, proving the read-only search made no social/report/message/post writes.
The identity-search `local_profile` id is deliberately distinct from the Auth User id; the
route href is the established destination contract. Evidence: `a05-search-api-20260922.json`.
The refreshed 112-file MANIFEST is **4a55f3e217be0b6fad71802d3d8a3a1bb403a9ad429e2ab78874d2870e6de9ae**.

## A05 mailbox screen/API read pass — route-order finding (2026-09-22)

The existing web Mail sidebar opened `/app/mailbox` in the retained local runtime and
showed the existing Personal Mailbox empty state with Compose and scope/filter controls.
A real authorized Bob API session then called `GET /api/mailbox?scope=personal` and received
HTTP 200 with zero mail items; logout returned HTTP 200. Before/after SQL counts for
`Mail|MailAction|Notification|UserFollow|UserBlock|UserReport` were identical at
`0|0|20|0|1|0`, so this read-only mailbox pass created no records or social side effects.
Evidence: `a05-mailbox-api-20260922.json`; the durable 113-file MANIFEST is
**14a8d7dbd312353923955306778267ac0d37161d8190717c0d88a4fdb83cc294**.

The same API session exposed a concrete existing route-order gap: `GET /api/mailbox/preferences`
returned HTTP 404 even though `backend/routes/mailbox.js` declares a GET `/preferences`
handler. The generic GET `/:id` mail-detail route appears earlier and consumes the literal
`preferences` path; no current frontend caller references the preferences SDK methods. No
code was edited because this is a shared mailbox route-order finding awaiting coordinator
ownership. The evidence records the actual status, source ordering, and no-write boundary;
no seed/send/claim/archive/star/delete, provider/SMTP, or native mailbox-delivery claim was
made.

## A05 audience/subscription entry — feature-flag boundary (2026-09-22)

The existing web `/app/audience` route was opened with an authorized Bob fixture. Its
current `audience_profile` flag-off behavior redirected through the existing effect to
`/app/persona`, where the legacy Beacon creation screen was visible with handle, display
name, bio, public-link and Next controls. No Beacon or subscription form was submitted.

The same boundary was checked through the real API: Bob login HTTP 200, `GET
/api/personas/me` HTTP 200 with `persona:null`, `GET /api/personas/audience-identity/me`
HTTP 404 `Not found` because that endpoint is feature-flag gated, and logout HTTP 200.
Before/after SQL counts for `PublicPersona|BroadcastChannel|PersonaMembership|PersonaTier|PersonaBlock|Notification`
were identical at `1|1|1|3|0|20`, proving no write or notification side effect. Evidence:
`a05-audience-api-20260922.json`; the durable 114-file MANIFEST is
**504858aec1ac7d0f0e67ca9ac52d3b1c68f4d48d8ab977f4dc0beae45f07183a**.

This records the current release-flag boundary and legacy fallback. It does not claim
Beacon creation, paid subscription checkout, Stripe/provider, native audience, or payment
acceptance; no application/schema/unit-test change was made.

## A03 shared storage/provider reconciliation — real profile UI and local API/SQL (2026-09-22)

This bounded A03 pass reused the existing upload/document implementations and the accepted private document, native picker, and completion-proof evidence already linked in the verification reconciliation. It did not add or replace a screen, service, table, migration, provider configuration, or unit test. The source was rebound to application worktree `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; the relevant storage source paths and SHA-256 bindings are in `a03-storage-source-ui-20260922.json`.

The real web UI used the authorized isolated Auth Bob fixture through `stream3-auth.localhost:18131`, opened the existing `/app/profile/edit` caller, and rendered the existing **Edit Profile → Profile Picture → Upload Photo** control. Its observed file input accepts JPEG/PNG/GIF/WebP, is single-file, and retains the existing 5 MB client message. No file was selected and no upload was submitted, so this is real screen/picker evidence only; it does not claim provider upload success. The tab was logged out/closed afterward.

An authorized isolated Bob session then used the retained real API at `127.0.0.1:18130` and SQL64532. `GET /api/users/profile`, `GET /api/files/portfolio`, `GET /api/files/portfolio/:Dana`, and `GET /api/homes` each returned HTTP 200. Before/after counts for `File`, Bob's `File`, `FileQuota`, local `storage.buckets`, local `storage.objects`, and `Notification` were identical at zero files/quota/storage objects and the retained notification count. API health returned HTTP 200 with a connected database. Details are in `a03-read-api-20260922.json`.

Because the existing `/api/files/quota` handler calls `get_or_create_user_quota`, a separate bounded journey verified that contract rather than silently treating it as a read. With Bob's quota row confirmed absent before the request, the real authorized `GET /api/files/quota` returned HTTP 200 and persisted one exact `FileQuota` row (1 GiB limit, 0 used, 1000 max files). After logout, the exact Bob row was deleted (`DELETE 1`) and the final row count returned to zero. Details are in `a03-quota-route-20260922.json`.

Implementation completion: existing caller, SDK, route, quota RPC, local SQL and cleanup were exercised; no repair was required. Local test success: the UI/API/SQL checks above passed; no new unit tests were written per instruction. End-to-end verification: local web screen plus real HTTP and persisted local rows are supported; no bytes were uploaded in this pass. CI/integration: no CI rerun or code PR was created because no application source changed; existing accepted CI/evidence remains reusable only where its source/configuration is unchanged.

The implementation retains two established storage boundaries: the web profile caller uses `@pantopus/api` upload `POST /api/upload/profile-picture` backed by the S3 service, while legacy `files.ts` also exposes Supabase-backed home/portfolio/generic contracts. The existing document/lease and gig-completion evidence remains source-bound and was not replaced. No current profile caller uses the legacy profile-picture route; this source difference was recorded, not redesigned.

Remaining A03 limitations are explicit: hosted S3/CloudFront permissions, quotas, lifecycle and production buckets were not exercised; no external provider or hosted migration was touched; no new iOS/Android chooser/provider journey was run in this pass; and provider success/failure for an actual profile or home byte upload remains unverified here. Local storage buckets/objects were empty at cleanup. Evidence bundle `20260922-stream3-native-social-r1` now has 118 files; MANIFEST SHA-256 is `62c8d789cd79b1bb2a5a00c1f4420bfbbbd1c0c2a2825991d54aa8ed40ca5c05`. No fixture credentials, raw tokens, or operator logs were added to Git.

## N05 daily-agenda preference — actual web/API/SQL contract check (2026-09-22)

This bounded N05 follow-up reused the merged host-pause and host-reminder-email repairs and did not repeat their accepted worker journeys. Source was rebound to the current Stream3 checkout `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; six relevant source hashes and the implementation comparison are in `n05-daily-agenda-source-ui-20260922.json`.

The real IAB opened `/app/scheduling/settings/notifications` for the authorized isolated Auth Bob fixture. The existing screen visibly renders **Daily agenda — Each morning at 8am**. Email was initially pressed; Push and SMS were disabled. Clicking the existing Email control produced **Notification changes saved**, persisted `scheduling.host.daily_agenda.email=false`, and visibly cleared the pressed state. Clicking it again produced the same save confirmation, persisted `email=true`, and restored the pressed state. Settings → Log Out ended at `/login`, and the tab was closed.

The companion real API read returned HTTP 200 from `GET /api/scheduling/notification-preferences`; Bob had no preference row before the UI write, and the default response contained `notify_me`, `notify_attendees`, and `reminder_lead_times` but no `daily_agenda` key. The two UI clicks created and updated one preference row through the existing PUT route. Notification count remained 20, BookingReminderLog 3, and Mail 0. After capture, the exact Bob `SchedulingNotificationPreference` row was deleted (`DELETE 1`) and the final row was absent. Evidence: `n05-daily-agenda-api-20260922.json` and `n05-daily-agenda-final-20260922.json`.

Assessment: the user-facing preference and persistence contract work locally, but the current scoped backend search/source has no daily-agenda scheduler or delivery consumer. A saved toggle is not a delivered agenda. No digest, worker, notification policy, schema, provider, native surface, or unit test was added because the finding does not authorize inventing that policy. Implementation/local checks and cleanup pass; end-to-end delivery, provider/native/background/cold-start and hosted email/push boundaries remain unverified. The durable bundle now has 121 files with MANIFEST SHA-256 `e16a92fb8f895ddbc665db499aa88c19d9d5f4a7745a6cf44c8e639a2fa894a3`.

## N02 saved notifications — real web read/filter and API/SQL reconciliation (2026-09-22)

This bounded N02 pass reused the existing notification route, SDK, page, badge context,
and AppShell behavior. Source was rebound to the current Stream3 checkout
`local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; the
relevant source hashes are recorded in `n02-notifications-ui-source-20260922.json`.
No application file, schema, provider configuration, or unit test was added.

The real IAB opened `/app/notifications` for the authorized isolated Auth Bob fixture.
After the existing login redirect completed, the screen rendered **Notifications**, the
existing **Mark all read** action, all/unread/read filters, and notification rows for
reminders, booking confirmations, and Beacon activity. The initial state showed 7 unread
notifications. Selecting **Unread** rendered 7 rows; selecting **Read** rendered 4 rows.
No mark-read or delete mutation was sent. Settings → Log Out returned the tab to `/login`,
and the IAB tab was closed.

The same fixture used the real local API. Login returned HTTP 200;
`GET /api/notifications?limit=20` returned HTTP 200 with 11 records and `unreadCount=7`;
`GET /api/notifications/unread-count` returned HTTP 200 with the existing count/total/
byContext payload; `GET /api/hub/preferences` returned HTTP 200; and logout returned
HTTP 200. Before/after SQL counts were unchanged: Notification total 20, Bob unread 7,
PushToken 0, UserNotificationPreferences 0, and Bob active AuthSession 4. Evidence is in
`n02-notifications-api-20260922.json` and `n02-notifications-ui-source-20260922.json`;
the refreshed durable bundle MANIFEST is
`c84f26b102a99957228616fc4644ce60437aa8f600839b1d2bf0cfdb0c4df681` (126 files).

Assessment: implementation and local API/UI read behavior are verified for the web
saved-notification surface, with no repair indicated by this pass. End-to-end provider or
device behavior is not claimed: APNs/FCM delivery, token registration/rotation, denied
permission, foreground/background/cold-start delivery, account-switch continuation, and
physical-device evidence remain open or are covered only by the prior bounded native
evidence. CI/integration was not rerun because no application source changed; no unit-test
coverage is claimed or required for this read-only verification.

## A04 provider/OAuth capability boundary — current local read-only check (2026-09-22)

A04 source was rebound to the current Stream3 checkout `local/stream3-ios-integration` at `acedbf14a83bcae72ce4817504661fd3809caa1a`; route/config/provider hashes and the existing staging report binding are in `a04-provider-source-20260922.json`. The accepted provider report remains authoritative for Smarty/geographic/Lob behavior and disabled Google/Apple staging capability; no provider activation or address ownership change was authorized.

The retained local API performed only capability reads. `GET /api/users/oauth/google` and `/api/users/oauth/apple` each returned HTTP 200 with the existing local GoTrue authorization URL. The generated local authorize URLs were fetched with `redirect: manual`; both returned HTTP 400 with no `Location`, so no external provider consent or callback was followed. Invalid provider `bogus` returned HTTP 400 with the existing validation message. SQL counts for User (3), AuthSession (180), Notification (20), and auth audit rows (453) were identical before and after; no session, user, notification, mail or provider row was created. Evidence: `a04-provider-api-20260922.json` and `a04-provider-boundary-20260922.json`.

Implementation/local verification: existing provider-name validation, local authorize URL generation and disabled-provider failure are confirmed; no repair is indicated. End-to-end/provider verification: no successful or cancelled Google/Apple consent, Smarty/geographic validation, Lob postcard, hosted provider, production configuration or purchase was exercised. CI/integration: no code changed, so no CI or PR was created. The durable bundle now has 124 files; MANIFEST SHA-256 is `09677f0c24dca41fab514514db773c2c63a73bb2448a4b9b478506c24fac3334`.

## A05 native profile edit — PATCH response contract and installed Android journey (2026-09-22)

This was the next uncovered A05 action after the web report/search/mailbox/audience checks. The
existing Android caller was located in the installed Edit profile screen and its profile API
client; the server caller is `backend/routes/users.js` `PATCH /api/users/profile`. The baseline
was reproduced with the existing Auth Bob fixture: the real Android screen entered valid first
and last names, the endpoint returned HTTP 200, but the native `ProfileUpdateResponse.user`
decoder failed because the PATCH receipt omitted canonical account metadata, residency, skills,
avatar/stat fields and `createdAt`. The screen retained **2 unsaved** and analytics recorded
`form.edit_profile.submit result=error`, although SQL had already applied the name update.
No Android DTO defaults or UI redesign was added.

The smallest repair is in application commit `26fe9d57f8568b704969e60c515dde07e3e9aa10`
(and follow-up `b956a0076`): the existing PATCH receipt now reuses the saved `User` row plus
the existing `UserSkill` and `getPublicResidencySummary` projection, returning the same canonical
fields consumed by GET `/api/users/profile` (`accountType`, `role`, `verified`, `residency`,
avatar aliases, skills, stats, `createdAt`, settings and timestamps). A controlled service-role
`UserSkill` SELECT fault initially showed the old code returned HTTP 200 with `skills: []`,
which could falsely confirm emptiness. The follow-up now returns HTTP 503 with
`PROFILE_READBACK_UNAVAILABLE` after the write when that readback is unavailable; the privilege
was restored and the temporary bio was cleared. A normal real-token PATCH after restoration
returned HTTP 200 with all canonical fields, and the exact profile cleanup was verified.
Evidence: `a05-native-profile-edit-contract-20260922.json` and
`a05-profile-skill-read-fault-20260922.json`.

End-to-end installed Android verification used the existing APK on `emulator-5554`
(SHA-256 `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`); Android source
was unchanged after reverting the rejected generic-default experiment. The real API/SQL runtime
was local GoTrue/PostgREST/SQL on 18130/64531/64532. Saving valid Auth/Bob names produced
`HTTP PATCH -> 200`, `form.edit_profile.submit result=success`, and cleared the unsaved
indicator. A temporary `BobTemp` last-name edit showed one unsaved change; **Discard** restored
Bob with no PATCH. Clearing last name rendered the existing **Last name is required.** error,
retained the unsaved state, and sent no HTTP request. The fixture was restored to
`first_name=NULL`, `last_name=NULL`, `name='Auth Bob'`; API GET confirmed that state and no
skills rows existed for this fixture. Evidence: `a05-native-profile-edit-ui-20260922.json`
and `a05-native-profile-edit-cleanup-20260922.json`.

Implementation completion: the response contract and truthful readback failure path are repaired
and pushed on `local/stream3-ios-integration`; no schema, migration, provider or native source
file changed. Local verification: `node --check backend/routes/users.js`, `git diff --check`,
normal HTTP contract, controlled SQL fault and cleanup all passed. Installed-screen E2E:
Android save/discard/validation passed against persisted local data. CI/integration: no new unit
tests were written per instruction; coordinator CI/review remains required, and the branch is
pushed for coordinator integration. No fresh iOS installed build was needed for this backend-only
contract change; iOS decoder/device behavior remains accepted/source-bound evidence rather than a
new iOS run. Bob has no `UserSkill` rows, so this fixture proves the field is present and typed as
an array but does not prove a populated-skill preservation case. External photo upload/OAuth and
provider delivery remain outside this journey.

The durable audit bundle now contains 130 files with MANIFEST SHA-256
`a17d90aa41cae3167b7cf76e50dc67de6d193cd587c74ddd93f0ba6990dce915`. The current local API
process was stopped after verification; the user-owned browser tab was left untouched. No
credentials, raw tokens, database archives or operator logs were added to Git.

### A05 native profile edit — populated-skill preservation addendum

Coordinator requested a populated-skill case rather than relying only on Bob's empty baseline. A
single disposable `UserSkill` row (`Stream3 Temporary Skill`) was inserted for Bob, then a real
GoTrue bearer called the existing PATCH route on an isolated API instance at 18134. GET before,
PATCH 200, and GET after each returned the one skill unchanged alongside the canonical fields;
the PATCH also applied a temporary bio. The exact row was deleted by id/user predicate, the bio,
first/last/name baseline was restored, and SQL ended at zero Bob `UserSkill` rows. Evidence:
`a05-native-profile-edit-populated-skill-20260922.json`. This is HTTP/API/persistence evidence
for populated-skill preservation; the installed Android screen's prior save used the same decoder
contract, while the skill list itself is not rendered by the current Edit profile screen.

The refreshed durable bundle has 131 files; MANIFEST SHA-256 is
`1ed1182466b240fab36ecc6b2bd4a0eb92b2b4706c339174b7fd4ef29ff982fc`. The app repair remains
backend-only, so no new native build was needed; the exclusive heavy slot is released.

### A05 profile PATCH review/CI receipt

The focused repair was republished from current `master` as PR [#182](https://github.com/WangPantopus/skinny-pantopus/pull/182)
(branch `codex/stream3-profile-contract`) so coordinator review does not inherit the other
Stream3 integration commits. PR CI completed green for backend privacy/Jest, backend Docker,
complete schema replay/lint, deployment/migration safeguards, and change detection; Seeder,
Web, Web E2E, Android and iOS jobs were correctly skipped by the change detector. No merge or
hosted activation was performed.

A fresh iOS profile save was attempted against the retained installed simulator, but its current
state is the existing security sign-out screen and the Device Hub control surface timed out; no
valid iOS save claim is made. The Android installed-screen and real API/SQL evidence above remain
the supported native E2E result for this backend-only contract repair.

## N02 native saved notifications — installed Android list/filter read pass (2026-09-22)

The retained installed Android app was relaunched against the owned local API at 18130 with the
existing Auth Bob session. The real **Notifications** screen loaded through HTTP GET 200s and
rendered the existing All/Unread/Read tabs, **Mark all read** action, and notification cards.
The initial tab counts were All 11, Unread 7, Read 4. Selecting Unread showed count 7; selecting
Read showed count 4. No mark-read/delete action was tapped. Settings → Log out completed through
the actual screen; the final API log recorded the session revoked and subsequent unauthenticated
hub request. Evidence: `n02-android-ui-20260922.json`, `unread.xml`, `read.xml`, and
`read-filter.png`.

SQL before/after remained unchanged: Notification total 20, Bob unread 7, Bob PushToken rows 0,
and Bob UserNotificationPreferences rows 0. The emulator's Firebase provider logged its existing
invalid-local-API-key warning; this is an emulator/provider boundary, not FCM delivery evidence.
Implementation and installed-screen local E2E pass for list/filter/logout; no application source
changed and no unit tests were added. Physical Android, APNs/FCM provider delivery, token
registration/rotation, and cold-start/foreground/background provider delivery remain unverified.
The durable bundle now has 135 files; MANIFEST SHA-256 is
`bc8dadc5cee6c2b301beec356935cef14a9c7cacadef96620badf9290a41da3c`.

## Current ordered boundary accounting after native N02 pass (2026-09-22)

- **N01:** retained web/native route and local notification records are covered by existing
  evidence plus the N02 Android read pass; provider-delivered foreground/background/cold-start,
  token rotation and physical-device acceptance still require APNs/FCM-capable credentials or
  hardware. No local repair is indicated.
- **N02:** web/API/SQL read/filter and installed Android list/filter/logout are now bound. Mark-all
  mutation, provider delivery and physical-device behavior remain intentionally unexercised.
- **N03:** local discovery/follow/post/reply/mute and identity-scope evidence is retained; remaining
  release-flag/provider freshness and old-link/access-change cases need a current fixture or an
  owner decision before changing policy. Existing Persona and UserBlock scopes remain distinct.
- **N04:** block/unblock, blocked DM, report, access/error/cache paths and installed Android safety
  checks are recorded; hosted moderation/provider review and any cross-stream schema/FK repair
  remain coordinator/shared-owner work.
- **N05:** reminder/pause/retry evidence and the real daily-agenda preference save are recorded;
  the current source has no daily-agenda delivery consumer, so no delivery claim is possible
  without an established scheduler/policy owner. Saved schedule alone remains insufficient.
- **A01–A02:** signup/verification/recovery, refresh/logout/revocation/account switching and
  protected-data retirement use accepted evidence; external OAuth/provider consent and physical
  device boundaries remain unavailable locally. No shared auth edit is proposed.
- **A03–A04:** local storage reads/quota and provider capability boundaries are recorded; hosted
  S3/CloudFront, external OAuth/address providers and production activation require provider/shared
  ownership. No activation or migration was performed.
- **A05:** profile report/search/edit and installed Android profile save are verified; mailbox
  preferences remains an existing route-order issue owned outside this stream, audience remains
  feature-flag gated, and Home/payment/booking/wallet findings route to their owners. No duplicate
  replacement implementation is authorized.

This accounting separates implementation, local UI/API/SQL E2E, CI, and external-provider/device
boundaries. It is not a whole-stream completion claim.

## N02 native saved notifications — Mark all read mutation and exact fixture restoration (2026-09-22)

Coordinator requested the existing installed-screen mutation rather than leaving the visible
control unexercised. I captured the complete Auth Bob notification snapshot first
(`n02-mark-all-before.json`: 11 rows, 7 unread, 4 read), then used the installed Android
Notifications screen on `emulator-5554` against the retained local API/SQL runtime. Tapping the
existing **Mark all read** control produced an Android logcat `HTTP POST -> 200`; the screen then
showed All 11, Unread 0, Read 11, and SQL confirmed 11 rows with 0 unread. No new rows were
created. The action was deliberately reversed using one SQL transaction that updated only each
captured row's `is_read` value by exact id. Reopening the installed screen returned All 11,
Unread 7, Read 4; SQL matched. Full evidence is in
`n02-mark-all-android-20260922.json`, `n02-mark-all-before.json`,
`n02-mark-all-after.xml`, and `n02-mark-all-restored.xml`.

This verifies the real Android UI -> HTTP handler -> persisted notification mutation and the
read-state refresh/restore path for an owned local fixture. It does not establish FCM/APNs
provider delivery, physical-device behavior, or background/cold-start receipt. The restored
fixture is intentionally unchanged for subsequent agents. The durable bundle now has 140 files;
MANIFEST SHA-256 is `641bd363087878b984abc539d34c3d30277ca40d4e39d1e74a1bf58e0b18bd98`.

## N05 daily-agenda source and contract reconciliation (2026-09-22)

The source comparison requested by the coordinator is now recorded in
`n05-daily-agenda-source-reconciliation-20260922.json`. It searched the Stream 3 checkout at
`b956a00767835586b5114698a3a2e91fbcddefad`, current `origin/master` at
`2b7378aa474a26b67ea6f9dba61ad97105aa7c0b`, all local refs, and the existing backend,
frontend, Supabase, scripts and docs roots. History search found only the original Calendarly
UI import (`ede9ad4e6`) and the initial import (`ae6fe86c0`) for the `daily_agenda` key; no
archived/open branch adds a producer or delivery worker.

The current web component persists a `daily_agenda` row with copy **Each morning at 8am** and
email-default presentation. The current iOS and Android models explicitly document that the old
Daily agenda label mapped to the server's `booking_request` key and now present **Booking
request**. The backend scheduling route/service persists generic preferences and reminder lead
times; `bookingReminders`, the cron registration, `notificationService`, `mailDayNotification`
and `internalBriefing` contain no daily-agenda consumer. The exact file hashes and findings are
in the evidence JSON. Therefore the persistence/UI contract exists locally, but producer
schedule/timezone, included agenda items, recipients/channels, quiet hours, retries/deduplication,
read-record semantics and access-change behavior remain undecided. No daily-agenda worker,
provider send, native/background behavior, schema or unit test was added; a saved toggle is not
delivery evidence.

## A05 mailbox route-order disposition correction (2026-09-22)

The earlier boundary wording was stale. Coordinator confirms the mailbox preferences route-order
repair is merged in PR178 at commit `715ccd8c0`. Stream 3 made no duplicate mailbox change; the
issue is now an integrated coordinator disposition rather than an open Stream 3 repair. The
remaining A05 boundaries are the existing audience feature flag and Home/payment/booking/wallet
routes owned by their respective streams.

## Updated current boundary accounting after N02 Mark all and N05 source reconciliation

- **N02:** web/API/SQL and installed Android list/filter/logout plus the existing Mark all read
  mutation are verified against the owned local fixture. Provider delivery, token rotation,
  physical-device and background/cold-start behavior remain unverified.
- **N05:** reminder/pause/retry evidence and preference persistence are recorded. The exact
  source comparison finds no daily-agenda producer or consumer, and the advertised delivery
  semantics are undecided; no delivery claim or speculative worker was made.
- **A05:** profile report/search/edit and installed Android profile save are verified; mailbox
  route-order repair is integrated as PR178 `715ccd8c0`, so no duplicate repair remains. Audience
  remains feature-flag gated; Home/payment/booking/wallet findings route to their owners.

This remains a bounded Stream 3 accounting, not a whole-app completion claim. Unit-test coverage
is intentionally excluded from completion percentages and no new unit tests were written.

## N03 old Beacon link after handle access change — focused repair and browser regression (2026-09-22)

A current owned fixture was used instead of closing this case from the historical old-link note.
The existing Beacon owner changed `stream3-local-r3` to disposable `stream3-old-link-r1` through
`PATCH /api/personas/:id`; the real API immediately returned 404 for the old handle and 200 for
the new handle, including the current posts route. The real IAB browser initially reproduced a
concrete stale-page defect: `/persona/stream3-local-r3` still rendered the previous Beacon after
reload because `fetchPublicPersona` shared the public-share `revalidate: 60` cache. This was an
actual server/UI cache result, not a mocked response.

The smallest repair is PR [#186](https://github.com/WangPantopus/skinny-pantopus/pull/186),
commit `f941c3bb4`, from current `origin/master` `2b7378aa4`. It adds an opt-in `noStore` fetch
option in the existing `publicShare` helper and applies it only to `fetchPublicPersona`; all
other public-share fetches, page layout, visual treatment, navigation and the existing 404 page
remain unchanged. After the repair, the same IAB old URL rendered the existing 404 page, while
the current URL rendered the existing Beacon screen with `@stream3-old-link-r1`. The owner then
restored the original handle through the existing PATCH route; the original URL rendered the
existing Beacon screen again and the disposable URL returned 404. API and SQL cleanup confirmed
the original persona handle, audience identity handle and follower count were restored. No new
fixture rows, schema, provider, native screen or unit test was added.

Focused verification: real GoTrue owner/fan login, HTTP 200/404 routes, PostgREST/SQL persisted
handle and identity reads, real IAB AX snapshots for stale 404/current Beacon/restored Beacon,
`pnpm --filter @pantopus/web type-check` exit 0 and `git diff --check` exit 0. Evidence:
`n03-old-link-access-change-20260922.json`, `n03-old-link-ui-20260922.json`, and
`n03-ui-cleanup-20260922.json`. The durable bundle now has 143 files; MANIFEST SHA-256 is
`cfee70e780cd8f0a70808577ce29a58d5fc77985959fdd0f7f1e6218ce9e5a4f`.

The real browser/API case verifies old-link invalidation after an authorized handle change and
exact restoration. It does not establish native/provider delivery or decide suspension/deletion
policy. PR review/CI and coordinator integration remain separate; the standalone PR is attached
for review and must not be merged independently here.

## Current N03 disposition after old-link pass

N03 now has a current web/API/SQL old-link/access-change regression and focused repair in review;
retained follow/unfollow, posting, reply, mute, identity-scope and restricted-post evidence still
applies within its recorded limits. Release/provider freshness, installed-native discovery/reply,
and product decisions for suspension/deletion remain unverified or policy-owned. No unit-test
coverage is claimed or required for this functional estimate.

## N03 public post old-link after deletion — reproduced cache defect and focused repair (2026-09-22)

Coordinator requested the existing public-post path be exercised with an owned disposable post.
Before editing, current `origin/master` and the paid-gig, booking-lifecycle, iOS-social and
Android-social refs all had the same `fetchPublicPost` implementation: the existing shared
`fetchPublicJson` `revalidate: 60` cache, with no post-specific invalidation. History contained no
archived/open post-link repair. The existing route is `frontend/apps/web/src/app/posts/[id]/page.tsx`
and its API caller is `fetchPublicPost` in `frontend/apps/web/src/lib/publicShare.ts`; it keeps the
existing public post page, explicit-share state and 404 treatment.

A disposable public `Post` row was inserted for owned Auth Bob with global/public visibility. The
real IAB rendered the existing public post page with its title/content, Open In App and Join the
conversation links. The owner then used the existing HTTP `DELETE /api/posts/:id` handler (200).
The same real unauthenticated API GET returned 404 and Postgres showed count 0, but a hard reload
of the real browser still rendered the deleted post from the 60-second server cache. This was a
reproduced stale-content failure, not a source assumption.

PR [#186](https://github.com/WangPantopus/skinny-pantopus/pull/186) now also applies the existing
opt-in `noStore` fetch option to `fetchPublicPost` (latest commit `cf34d604d`). The persona
no-store repair remains in the same focused old-link/access-change PR; other public-share fetches,
page layout, navigation and visual treatment are unchanged. After the repair the same deleted
URL rendered the existing Next 404 page (`404`, `This page could not be found.`), while API stayed
404 and SQL stayed at zero. No post row or other fixture survived; the isolated browser tab was
closed.

Focused verification: real API/PostgREST/SQL creation, public UI read, owner DELETE, API 404/SQL
zero and browser stale/404 recheck; `pnpm --filter @pantopus/web type-check` exit 0 and
`git diff --check` exit 0. Evidence: `n03-public-post-old-link-20260922.json` and
`n03-public-post-delete-20260922.json`. The durable bundle now has 145 files; MANIFEST SHA-256 is
`eb052cdef91a4948efa16cf93828137ce42de653784f772280bffd0d2624a0b6`.

This verifies public-post deletion invalidation locally. It does not invent or claim a separate
non-owner visibility-revocation policy, native/provider delivery, or hosted deployment behavior.
PR review/CI and coordinator integration remain separate.

## N02 native receipt timestamp correction (2026-09-22)

The earlier `n02-android-ui-20260922.json` receipt had an unsupported future Pacific timestamp
(`13:45:00-0700`). It has been corrected to `06:44:22-0700` using the filesystem mtime of the
captured `read-filter.png`; `unread.xml` (`06:43:57-0700`) and `read.xml` (`06:44:01-0700`)
corroborate the same local capture window. The separate Mark all receipt remains
`06:52:46-0700`, sourced from `n02-mark-all-after.xml` mtime. The correction is recorded in
`n02-timestamp-correction-20260922.json`; no session time was invented and no UI/API/SQL result
changed. The durable bundle now has 146 files; MANIFEST SHA-256 is
`51339e601abe137bf8c636133d25d37b4cfddacd0a28a36ef7257515cdde3de0`.

## N02 installed Android single-notification delete (2026-09-22)

The accepted web PR86 deletion/failure/retry evidence was reviewed before this pass and was not
repeated: it already covers real web single-delete success, DELETE failure/toast and retry, lost
successful reply, duplicate taps, delayed filter-switch stale-row handling and account-switch
retirement. The remaining locally feasible client-specific gap was the installed Android success
control. No application source or UI design changed.

A disposable Auth Bob `Notification` row was inserted directly in the owned local SQL fixture with
marker `n02-delete-r1`, then the retained Android APK (SHA
`83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`) loaded the existing
Notifications screen through the real API. The row was visible with All 12 / Unread 8 / Read 4.
Long-pressing the existing row opened the existing **Delete notification?** confirmation; tapping
its existing Delete action generated `DELETE /api/notifications/c86bfd54-d3f8-469b-b5e1-ee7f6ca20590`
HTTP 200 in the backend log and the Android HTTP log. The row disappeared from the installed
screen. SQL then showed Bob Notification rows 11, unread 7, fixture rows 0 and target rows 0.
The disposable row therefore required no restore; exact-id/marker cleanup was verified. The app
was logged out through Settings → Log out and the follow-up request returned 401.

Evidence: `n02-android-single-delete-20260922.json`, `n02-delete-before.xml`,
`n02-delete-after-confirm.xml`, `n02-delete-after.png`, and `n02-android-delete-http-receipt-20260922.json`. This binds
installed Android UI → HTTP DELETE handler → persisted deletion for one owned fixture. It does not
claim Android installed failure/retry behavior; the accepted web evidence covers those cases, and
no new unit tests were added. Physical Android and FCM/APNs delivery remain external boundaries.

## N02 installed Android `new_follower` notification destination (2026-09-22)

Coordinator requested a final-rewrite binding for the retained Android implementation in
`DeepLinkRouter.notificationPath` (the `new_follower` single-segment rewrite to `/u/<username>`).
Using the same retained installed APK, a disposable Auth Bob row was inserted with type
`new_follower`, link `/stream3_auth_r3_evan`, unread state, and marker
`n02-new-follower-r1`; the follower id was the existing Auth Evan fixture. This is a real persisted
notice, not a direct bare-link launch.

The installed Notifications screen showed the disposable card at All 12 / Unread 8 / Read 4. A
real tap on that row generated the existing `PATCH /api/notifications/9a6e99b5-cedf-4101-a93d-4e539aeeb86a/read`
200, then the backend logged `GET /api/users/username/stream3_auth_r3_evan`,
`GET /api/users/d3671605-b8cc-4e92-8c82-99aa5041ff48/relationship`, and the existing transaction
review read. Android's installed HTTP log recorded the corresponding GET 200 responses. The
visible destination was the existing public profile showing **Auth Evan** and
`stream3_auth_r3_evan`; no raw web URL was launched. SQL confirmed the notice was read before
cleanup and the Bob←Evan `UserFollow` count remained 0. The exact disposable notice was deleted by
id plus marker and the final SQL marker count was 0. Settings → Log out then returned the app to
Sign in; the backend recorded `auth.signed_out` and the following request returned 401.

Evidence: `n02-android-new-follower-destination-20260922.json`,
`n02-new-follower-before.xml`, `n02-new-follower-after.xml`,
`n02-new-follower-profile.png`, and `n02-android-new-follower-http-receipt-20260922.json`. This verifies the final
`new_follower` implementation through the real installed notification row, read mutation, native
routing, profile API, relationship/read-only companion calls, visible profile and persisted cleanup.
It does not establish provider-delivered notification receipt, physical-device behavior,
foreground/background/cold-start FCM behavior, or iOS installed destination behavior. The retained
APK is the accepted build; no heavy native build or unit test was run. The local API log also shows
an existing non-fatal `chat.local_profile_identity_lookup_error` during hub bootstrap
(`LocalProfile.verified_resident` is absent in this fixture schema); it did not block the
notification/profile journey and was not changed in this pass.

## N02 client-specific boundary accounting after the Android destination pass

- **Web:** accepted PR86 evidence remains the source for real list/read/delete failure/retry,
  lost-reply, duplicate-tap, stale-response and account-switch cases. No broad rerun was needed.
- **Android:** installed list/filter/logout, Mark all read with exact restoration, single-delete
  success, and the persisted `new_follower` row → native Auth Evan profile destination are now
  bound to the retained local runtime. Android installed delete failure/retry and provider receipt
  remain unverified; no source change was necessary.
- **iOS:** the existing accepted notification model/UI evidence remains applicable for its source
  contract, but this run has no fresh installed iOS destination/provider receipt. No iOS claim is
  added here.
- **Provider/device:** no APNs/FCM delivery, token rotation, physical handset, or true
  foreground/background/cold-start delivery claim is made. These remain explicit external limits,
  separate from local implementation and UI/API/SQL success.

The durable private evidence bundle now has 156 files; MANIFEST SHA-256 is
`99bf0cb46f5127210137e35290932978fd914d2cca950d78e384ac50d41fa3c1`. Raw log files remain only in the private
operational folder; the durable bundle contains sanitized request/status receipts.

## Evidence bundle hygiene correction (2026-09-22)

Raw Android/backend `.log` files from the N02 passes were removed from the durable private bundle after coordinator review. The raw originals remain only under `/private/tmp/pantopus-stream3-20260920-r1`; durable evidence now uses `n02-android-delete-http-receipt-20260922.json` and `n02-android-new-follower-http-receipt-20260922.json` with method/path/status summaries. The refreshed 156-file MANIFEST SHA-256 is `99bf0cb46f5127210137e35290932978fd914d2cca950d78e384ac50d41fa3c1`. No journey was rerun and no application behavior changed.

## N02 installed Android delete Cancel, offline rollback and retry (2026-09-22)

Coordinator requested one final client-specific control check where the retained runtime could
support it without a build. A disposable unread Auth Bob notification (`n02-cancel-r1`) was shown
on the installed Android Notifications screen with All 12 / Unread 8 / Read 4. Long-pressing the
existing row opened **Delete notification?**. Tapping the existing **Cancel** control closed the
confirmation without sending DELETE; the row remained visible and SQL stayed at 12 Bob rows, 8
unread, marker count 1.

For a real offline failure, I stopped only the owned API process after the confirmation opened and
then tapped the same existing Delete control. Android recorded `HTTP DELETE -> transport failure`.
The installed screen rolled the optimistic removal back: after scrolling to the top,
the original **Stream3 cancel notification** card and unread dot were visible again. SQL remained
at 12 rows / 8 unread / marker 1. This is a real transport outage and rollback, not a mocked
repository result.

I restarted the same local API, repeated the same long-press/confirmation/Delete journey, and the
installed Android log recorded DELETE 200. The card disappeared, SQL returned to Bob 11 rows / 7
unread, and exact id plus marker counts were 0. Settings → Log out returned Sign in, with the
follow-up request receiving 401. The durable evidence uses sanitized receipts only:
`n02-android-delete-cancel-failure-retry-20260922.json`,
`n02-android-delete-cancel-failure-retry-http-receipt-20260922.json`,
`cancel-before.xml`, `cancel-confirm.xml`, `cancel-after.xml`, `failure-confirm.xml`,
`failure-after-scroll.xml`, `n02-cancel-failure-after-scroll.png`, `retry-after.xml`, and
`n02-cancel-retry-after.png`.

This adds installed Android Cancel, network-failure rollback and reconnect retry evidence. It does
not claim an Android HTTP 5xx fault; accepted web PR86 evidence remains the source for real HTTP
failure/toast, lost-reply, duplicate-tap and stale-response cases. No application source, design,
build, schema or unit test changed. No provider/device delivery claim is made. The existing
non-fatal hub `chat.local_profile_identity_lookup_error` remains a local schema boundary only.

The durable private bundle now has 166 files; MANIFEST SHA-256 is
`f1996b9a0d3b3d284c73eab0f643bee3b484927daf43c85e9c4655bcca74ba00`.

## PR168 description and N03 Android boundary reconciliation (2026-09-22)

PR [#168](https://github.com/WangPantopus/skinny-pantopus/pull/168) now describes the final
implementation and current evidence rather than the retired founder-stop/ktlint-failure state.
The body records the existing handshake 404 → plain-follow fallback, the blocked-profile Follow
visibility guard, the blocked-chat refusal banner, the extracted complexity helper and ktlint
repair, retained installed APK SHA `83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`,
and current CI run `35746647258`. It explicitly preserves the unverified local-neighbor
Follow-row-hide branch: the installed Persona fixture has no local-home residency context, so its
Persona Follow affordance remains a distinct scope and is not claimed as local-neighbor evidence.

The current PR CI has Detect changes, deployment/migration safeguards and complete schema replay/lint
passing; Android lint/assemble and emulator checks are still running. No new source, build, schema
or unit-test work was performed during this documentation update.

## Final N01–N05/A01–A05 client-specific disposition (2026-09-22)

Coordinator confirms PR168 merged as `b30e0d395` after exact-head CI run
`35746647258` passed. The following row-by-row disposition supersedes the earlier generic
whole-stream table and records whether another local journey is independently actionable:

- **N01 — notification delivery and continuation:** Existing web/native notification routes,
  saved-record reads, login continuation, unread/preferences handling and the installed Android
  list/filter/mark-read controls are covered by the retained reports and current N02 evidence.
  Foreground/background/cold-start provider receipt, token rotation, physical Android/iPhone
  delivery and provider-denied permission behavior remain unverified. No local source journey can
  close those rows without APNs/FCM credentials or hardware; saved `Notification` rows must not be
  presented as provider-delivery evidence.
- **N02 — saved notification actions and destinations:** Web/API/SQL PR86 evidence covers read,
  delete, HTTP failure/toast, lost reply, retry, duplicate tap, stale response and account-switch
  retirement. Retained Android now covers list/filter/logout, Mark all with exact restoration,
  single delete, Cancel, offline transport failure with optimistic rollback, reconnect retry and
  a real `new_follower` row through read mutation to the native Auth Evan profile. A fresh iOS
  installed destination and Android HTTP-5xx injection remain unrun; the latter is the same source
  failure path already bound on web. Provider receipt and physical-device delivery remain external.
  No non-redundant local repair is indicated.
- **N03 — Pulse, Beacon and social identity:** Retained web/API/SQL and native evidence covers
  discovery/follow/unfollow, Beacon fallback under the release flag, posting/reply/mute paths,
  blocked access, identity separation and old-link/access-change invalidation. The Persona fixture
  has no local-home residency context, so it does not prove the separate local-neighbor
  Follow-row-hide branch. Native discovery/post/reply/mute on a fresh release cohort, provider
  freshness and any product decision that changes Persona/UserBlock/local-neighbor scope remain
  open; a new native build is unnecessary unless the coordinator assigns that distinct fixture
  journey.
- **N04 — social safety:** Block/unblock from the existing profile/settings paths, blocked DM
  denial, reverse-block persistence, report creation/idempotence/failure/retry, access/cache/error
  behavior and installed Android safety paths are recorded. Remaining work is hosted moderation or
  shared-owner schema/FK integration and any iOS physical/provider boundary; no independent local
  source repair is indicated. Existing UserBlock, UserProfileBlock, PersonaBlock and Relationship
  scopes remain distinct.
- **N05 — reminders/calendar:** Natural reminder worker, pause/resume, retry/failure and
  authorized destination evidence are retained, and the daily-agenda web preference has a real
  UI/API/SQL persistence proof. Source reconciliation found no daily-agenda producer/consumer or
  settled schedule/recipient/channel/retry contract. Delivery cannot be verified locally until an
  owner defines that policy and assigns a scheduler/provider; a saved preference alone is not
  delivery evidence.
- **A01 — signup, verification and recovery:** Real web signup/email verification/reset and the
  accepted native account journeys are recorded, including actionable unverified-login feedback.
  External Google/Apple consent/callback/provider failures and physical-provider boundaries remain
  unavailable locally; no additional local auth screen repair is indicated.
- **A02 — sessions and account lifetime:** Natural refresh, transient retry, logout failure/retry,
  remote sign-out, lock-down, account switching and protected local-data retirement use accepted
  evidence. Remaining physical provider revocation, cold-process/device and external OAuth return
  boundaries require provider/device capability; no shared auth edit is proposed.
- **A03 — shared storage:** Existing profile/document picker UI, local profile/portfolio/home reads,
  quota route and exact cleanup are recorded. A real native chooser-to-byte upload and hosted
  S3/CloudFront permissions/lifecycle/quota/provider failure remain unverified and require shared
  storage ownership or provider credentials; no local replacement is justified.
- **A04 — provider dependencies/OAuth:** Current local Google/Apple capability reads and invalid
  provider handling are recorded, with no activation or external callback followed. Real provider
  consent/callback/failure, hosted address/storage dependencies and production activation remain
  external/shared-owner boundaries; no local provider configuration change is authorized.
- **A05 — remaining reachable actions:** Web profile report/search/edit and audience/mailbox
  boundaries plus installed Android profile save are recorded; the mailbox route-order repair is
  integrated as PR178 `715ccd8c0`. Remaining Marketplace/subscription/booking/wallet/mail/search
  actions and Home/payment findings belong to their owners; they require source ownership or an
  explicitly assigned route fixture rather than another Stream 3 duplicate audit.

This is the final client-specific accounting for this pass. It separates implementation and local
UI/API/SQL evidence from CI/merge state and provider, device, policy and ownership boundaries. No
unit-test coverage is claimed or required, and no new tracker or raw log was added.


## N02 installed Android HTTP 5xx delete rollback and retry (2026-09-22 addendum)

This closes the previously listed Android HTTP-5xx injection gap for the locally retained
implementation. I reused the existing Notifications screen, confirmation, DELETE handler and
owned PostgREST/SQL fixture; no application, schema, design, or migration change was made. The
retained installed APK was SHA-256
`83cc0db08992e83dd1faa87a7baacdf582624a3e847f965f6361ab5fdd2cdf93`, running against the owned
API on port 18130 and PostgREST/SQL on 64531/64532. Auth Bob
`c021d181-d7df-4ba9-9e49-fd1cdd6d5548` received disposable Notification
`8559382b-224b-42cb-8b40-505316df9e9b` with type `stream3_notification_http500_check` and marker
`n02-http500-r1`.

Baseline fault: after confirming the existing long-press **Delete notification?** action, I
revoked only `DELETE` on the existing `public."Notification"` table from `service_role`. The
installed Android log recorded `HTTP DELETE -> 500 (145ms)`; the API recorded the real DELETE
path and PostgreSQL `permission denied for table Notification`. SQL stayed at 12 Bob rows / 8
unread / fixture 1 / target 1, so the row was not silently lost. After restoring the grant, the
same installed row and confirmation path recorded HTTP 200 (123ms); SQL became 11 / 7 / 0 / 0
and the existing screen no longer showed the fixture. The API was stopped cleanly, the grant was
checked true, the disposable row was absent, and the installed account was logged out through
Settings → Log out. The failure-state XML/screenshot was not retained before compaction; the
sanitized Android HTTP receipt, backend 500 receipt, unchanged SQL counts and retained post-retry
XML substantiate the result. No provider, physical-device, iOS, CI, hosted-migration or unit-test
claim is made.

Evidence: `n02-android-http500-delete-retry-20260922.json`,
`n02-android-http500-delete-retry-http-receipt-20260922.json`, and `retry-after.xml` in the
private durable bundle. This is an induced local database-permission fault and is separate from
provider delivery. It complements, rather than duplicates, the accepted web PR86 failure/retry
journey.

## N03 installed Android local-neighbor block-state repair (2026-09-22 addendum)

The accepted PR168 Android implementation had a concrete reopened-profile defect: its existing
relationship endpoint reports `Relationship` only, while personal blocks are stored in
`UserBlock`. After a real profile **More → Block this user**, the same screen hid Follow/Connect,
but a fresh deep-link reopen fetched profile/posts/relationship and restored Follow/Connect even
though the Bob → Evan `UserBlock` row still existed. The canonical local-neighbor source was
checked before editing: `GET /api/users/id/:id` derives verified residency from existing
`HomeOccupancy`, and the existing `ProfileFollowRow` renders from `canFollow`; no new table or
scope was needed.

Focused repair on branch `local/stream3-android-integration` extends the existing
`PublicProfileViewModel.loadRelationship` path. It reads the existing `/api/users/blocked` list
before calling the existing relationship endpoint; a matching personal `UserBlock` sets
`canFollow=false`, `isFollowing=false`, and `connection=Blocked`. A blocked-list read failure
fails closed with non-actionable actions and the existing truthful toast rather than restoring
Follow/Connect. Relationship, PersonaBlock and other scopes remain distinct. The existing visual
layout/navigation was preserved and no unit tests, schema/model files or migrations were added.

The focused Android build passed (`./gradlew :app:assembleDebug`, 43 tasks, `BUILD SUCCESSFUL in
1m 24s`); installed APK SHA-256 is
`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`. With an owned canonical
fixture (existing Home `2ca4bc33-a285-4faa-9420-48edb97eb603`, Bob owner and Evan member both
active/verified, existing Evan LocalProfile temporarily exposing the local badge), the installed
UI showed Verified neighbor + Follow/Connect before blocking. Real profile block POST 200 hid the
actions. A fresh deep-link reopen on the repaired APK kept Message + Verified neighbor and showed
zero Follow/Connect. Settings → Blocked users listed Evan; existing Unblock removed the row, and
a fresh reopen restored Follow/Connect. With `SELECT` on `public."UserBlock"` revoked, the real
`GET /api/users/blocked` returned 500; the repaired profile stayed non-actionable with no
Follow/Connect and the UserBlock row remained. The SELECT grant was restored before cleanup.
Exact cleanup removed the UserBlock, restored the LocalProfile overlay, deleted the two
HomeOccupancy rows and Home; final counts were block=0/home=0/occupancy=0/overlay=0. The
installed account was logged out through Settings and the API was stopped cleanly.

Evidence: `n03-android-local-follow-block-repair-20260922.json`, its sanitized HTTP receipt,
`n03-local-before.xml/png`, `n03-local-after-block.xml/png`,
`n03-local-blocked-refresh.xml/png` (pre-repair reproduction), `n03-repair-blocked.xml/png`,
`n03-repair-unblocked.xml`, and `n03-repair-readfault.xml/png`. iOS installed behavior, physical
provider/device behavior, CI/integration merge state and hosted moderation remain separate
boundaries; this addendum claims only the verified Android local-profile path.

## Stream 3 handoff reconciliation after the 2026-09-22 native passes

The durable private evidence bundle now contains 181 files; refreshed MANIFEST SHA-256 is
`637c0364dd9c2e700270ef1dc9e328d66b0a2005601dca503cc9be5a5f572e92`. Raw logs and credentials
remain outside the bundle. Implementation completion, local UI/API/SQL success, CI/merge state,
and external provider/device limits are intentionally reported separately:

- **N01:** local saved-record/list/preferences and installed Android controls are evidenced; APNs/FCM provider delivery, token rotation, physical devices, and true foreground/background/cold-start delivery remain unavailable.
- **N02:** web PR86 and installed Android list/filter/read/delete/cancel/offline rollback/retry/new-follower destination plus the induced Android HTTP-5xx rollback/retry are evidenced; iOS installed destination and provider delivery remain unavailable.
- **N03:** web/API/SQL and Android discovery/follow/unfollow/post/reply/mute/identity/block paths are evidenced, including the repaired reopened local-neighbor block state; fresh iOS cohort/provider freshness and any policy change across Persona/UserBlock/local-neighbor scopes remain unverified.
- **N04:** local block/unblock, DM refusal, reporting/idempotence/failure/retry and access/cache/error paths are evidenced; hosted moderation/shared-owner schema, iOS installed and provider boundaries remain outside this worktree.
- **N05:** reminder worker and daily-agenda preference persistence are evidenced; no source producer/consumer or settled delivery policy exists for daily-agenda delivery, so delivery is not claimed.
- **A01:** signup, verification, recovery and native account flows are evidenced; external Google/Apple consent/callback and provider failures remain unavailable.
- **A02:** refresh, retry, logout, remote sign-out, lock-down, account switching and local-data retirement are evidenced; physical provider revocation/cold-process boundaries remain unavailable.
- **A03:** existing profile/document-picker contracts, reads and quota are evidenced; native chooser-to-byte upload and hosted storage permissions/lifecycle remain shared-provider boundaries.
- **A04:** local provider capability and invalid-provider handling are evidenced; real consent/callback/production activation remains unavailable and was not changed.
- **A05:** reachable web/native report, search, edit, audience, mailbox and profile actions are evidenced; booking/payment/Home findings remain with their owners. The `/signup` booking misroute is already owned by Stream 1 and was not duplicated here.

No new unit tests were added per user direction. The workstream is ready for coordinator review of the
Android source commit and status/evidence commit; no merge, hosted migration, provider activation,
or independent CI claim is made here.


## A03 Android local chooser-to-byte upload boundary (2026-09-22 addendum)

To close one independently local A03 acceptance gap without holding a heavy build slot, I reused
the installed Android APK (SHA-256
`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`) and the existing profile
Portfolio screen. After real local Bob authentication, **Profile → Portfolio → Add portfolio
item** opened the existing `ActivityResultContracts.GetContent("*/*")` flow. Android DocumentsUI
showed the owned Downloads file `stream3-portfolio-r1.png`; selecting it returned the real
content URI, display name, MIME type and 68 bytes to the existing sheet, which populated the
filename and title. Tapping the existing Add control issued the real multipart
`POST /api/files/portfolio` through API 18130.

The request returned HTTP 500. The backend receipt is the existing route's S3 thumbnail/original
upload path failing with `Resolved credential object is not valid`; the local runtime has no valid
AWS bucket/credential configuration. SQL showed zero Bob `File` rows for the marker and zero Bob
File rows overall, so no partial record was left. The emulator file was deleted, Bob logged out
through Settings, and the API stopped cleanly. This proves the chooser and byte-read path through
the app's existing caller and API boundary, while the final hosted object/persistence step is
blocked by the shared-storage provider configuration. No local replacement, schema change, UI
redesign, provider activation or unit test was added; an owner with approved isolated S3-compatible
credentials must rerun the same existing journey for successful hosted persistence evidence.
Evidence: `n03-android-portfolio-chooser-failure-20260922.json`.

## PR195 CI repair and current head (2026-09-22 addendum)

Fresh current-master CI run `35763514679` exposed 21 existing
`PublicProfileViewModelTest` failures caused by the new block-list call being evaluated for
established Persona test profiles whose mocks intentionally do not provide a blocked-list result.
The focused source repair scopes the already verified personal UserBlock visibility check to the
Local profile kind—the concrete reopened local-neighbor gap—while leaving Persona, Relationship and
other block scopes unchanged. Existing class verification then passed with
`./gradlew :app:testDebugUnitTest --tests app.pantopus.android.ui.screens.profile.PublicProfileViewModelTest`
(`BUILD SUCCESSFUL`, 37 tasks, 2m43s). The repair is commit `3b374454a` on PR [#195](https://github.com/WangPantopus/skinny-pantopus/pull/195), still one changed production file relative to current master; fresh exact-head CI is running. No new tests were written or modified.

The private durable bundle now contains 182 files; refreshed MANIFEST SHA-256 is
`0c14162f655e7b7ec546201eac52a4206032df56f9e3f990073f75c0a9c027ea`.


## N02 retained iOS saved-notification destination capability check (2026-09-22 addendum)

A bounded read-only check used the owned booted **Pantopus Stream3 Social R2** simulator
`0AE16FA0-E244-414F-86C8-24893BDFD979` (iOS 26.5). `xcrun simctl listapps` confirmed the
installed `app.pantopus.ios` build 1.0.0 (1); `xcrun simctl launch` returned process 58323 and a
screenshot captured the actual Pantopus sign-in screen. It showed the existing security message
**You were signed out for security. Sign in again.** and a masked remembered Auth Evan account.

This check did not mutate simulator state, restart the device, build/install, inject a notification,
or enter credentials. The current session exposes no CUA native app/accessibility surface
(`getApp("Simulator")` is invalid), so I could enumerate/launch/capture but could not navigate the
installed UI to a saved notification row or destination. The iOS saved-notification destination
therefore remains explicitly unverified; this is a precise simulator-control/session boundary,
separate from APNs delivery and separate from Android/web evidence. Evidence:
`n02-ios-saved-notification-capability-20260922.json` and `ios-capability-20260922.png`.

The private durable bundle now contains 184 files; refreshed MANIFEST SHA-256 is
`30fd45250bd87efe01dfb803d3c8635f771f75e1df04faf0e6107bd7b9ef99ed`.


## A02 installed Android cold-process/session recovery (2026-09-22 addendum)

I reused the installed Android build and the existing Bob fixture for the one locally actionable
A02 boundary that remained distinct from the accepted web natural-expiry, synthetic retry and
two-context remote sign-out evidence. A real Android login (`POST /api/users/login` 200) opened the
existing hub with Auth, Notifications, Menu and setup cards. I then force-stopped the app process
and relaunched the existing `MainActivity` without clearing app data or touching the database.

The socket disconnected at 18:50:36.850Z. On cold relaunch the API received no second login; instead
`GET /api/users/profile` 200 at 18:50:40.344Z was followed by a new socket session and the normal
hub/chat/discovery/notification reads. The installed app first showed its existing notification
permission prompt; tapping the existing **Don’t allow** control returned to the authenticated hub
showing Auth, Notifications, Menu and the existing setup cards. This binds local process retirement
→ protected session restoration → real UI/API continuity. Settings → Log out then returned Sign in,
`POST /api/users/logout` 200, the follow-up hub request was no-token/401, and the API stopped
cleanly. No source, schema, provider, design or unit-test change was made.

Evidence: `a02-android-cold-process-recovery-20260922.json`, `a02-cold-before.xml`, and
`a02-cold-after.xml`. The post-permission hub XML was not retained separately; the visible state
and API receipts are recorded honestly. This does not claim physical keychain failure, provider
revocation, APNs/FCM delivery or hosted OAuth behavior. The durable private bundle now contains
187 files; refreshed MANIFEST SHA-256 is
`3f0a7bac2613d80a2a6d314e1b8eaa51c5671b4a412fc071aec989fc3a3edb47`.

## A05 installed Android profile readback fault and retry (2026-09-22 addendum)

The existing backend repair for the profile PATCH readback contract had already been verified at
HTTP/API level, but its user-facing Android fault/retry state had not been exercised. I reused the
existing installed APK (`2728688a30a78449c990c302ebc72053802322772a990e7a3a6030e2265d504a`) on
`emulator-5554`, the existing **Settings → Edit profile** screen, and the existing
`PATCH /api/users/profile` caller. With the disposable Auth Bob fixture, I entered temporary
`Fault` / `Probem` values and tapped the existing Save control after revoking only
`SELECT` on `public."UserSkill"` from `service_role`. The real request returned HTTP 503 with
`PROFILE_READBACK_UNAVAILABLE`; the server logged that the profile write completed but skills
readback was unavailable. The installed screen retained **2 unsaved changes** and did not show a
false saved state. This is the real UI/API boundary for the repaired readback error path, not a
mocked response.

After restoring the existing `UserSkill` SELECT grant, the same pending form was retried through
the same Save control. The real request returned HTTP 200; the screen showed **All changes saved ·
just now**, and the server logged `Profile updated`. The temporary first/last name write was then
removed by an exact SQL fixture cleanup because the public PATCH validation requires string name
parts; the User row ended with `first_name=NULL`, `last_name=NULL`, `middle_name=NULL`, `name='Auth Bob'`,
`bio=NULL`, zero Bob `UserSkill` rows, and the SELECT grant restored. Settings logout returned
HTTP 200 and the local API process was stopped. No application, schema, design, provider or unit
-test change was made.

Evidence: `a05-android-profile-readback-fault-retry-20260922.json` and
`a05-android-fault-evidence-20260922/{fault-before.xml,fault-after-503.xml,retry-200.xml}`.
The two fault-state XML captures intentionally have the same visible state because the repaired
failure preserves the pending form; the distinct retry XML records the transition to saved. This
proves local installed UI/API/SQL error and retry handling. It does not claim hosted provider,
iOS or physical-device behavior.

## Current row-accounting correction after the native addenda (2026-09-22)

The older generic row table above predates the latest native evidence. The current accounting is:

- **N01:** local saved-record/list/preferences and installed controls are evidenced; APNs/FCM
  delivery, token rotation, physical-device delivery, and true provider foreground/background/
  cold-start behavior remain unverified.
- **N02:** the authoritative remaining criterion is physical Android notification/device acceptance.
  Installed Android emulator list/filter/read/delete/Cancel/offline rollback/reconnect retry,
  `new_follower` destination, and induced Android HTTP-5xx rollback/retry are supporting emulator
  evidence only; physical Android acceptance remains open because no physical Android is available.
- **N03:** web/API/SQL and Android discovery/follow/unfollow/post/reply/mute/identity/block paths,
  including reopened local-neighbor block visibility and fail-closed blocked-list read fault, are
  evidenced. Fresh iOS/provider freshness and policy changes across Persona/UserBlock/local-home
  scopes remain outside this local runtime.
- **N04:** local block/unblock, blocked DM refusal, report idempotence/failure/retry, access/cache/
  error paths and installed Android safety are evidenced. Hosted moderation/shared-owner schema and
  iOS/provider boundaries remain owner work.
- **N05:** reminder worker/pause/retry and daily-agenda preference persistence are evidenced; no
  daily-agenda producer/consumer or settled delivery policy exists, so delivery is not claimed.
- **A01:** web/native signup, verification, recovery and unverified-login feedback are evidenced;
  external Google/Apple consent/callback/provider boundaries remain unavailable.
- **A02:** refresh/retry/logout/remote sign-out/lock-down/account switching/local-data retirement
  and installed Android cold-process session restoration are evidenced; physical provider
  revocation and external OAuth return remain unavailable.
- **A03:** existing document-picker/chooser-to-byte path and local reads/quota are evidenced; the
  real hosted portfolio upload returned the provider's existing credential 500 with no partial row,
  so hosted S3/CloudFront success and lifecycle remain shared-provider boundaries.
- **A04:** the authoritative row is address/provider coverage: activated Smarty, geography/unit
  disambiguation and legitimate unavailable responses. Real local full-address and unit routes now
  return explicit unavailable/manual-review envelopes and the installed Add Home form preserves its
  draft with retry/edit and a disabled continuation; activated external provider success remains
  unavailable without provider ownership.
- **A05:** web report/search/edit/audience/mailbox and installed profile save are evidenced; this
  addendum now also covers installed profile readback HTTP-503 preservation and same-form HTTP-200
  retry. Marketplace/subscription/booking/wallet/mail/search and Home/payment findings remain with
  their owners.

The durable private bundle now contains 191 files with MANIFEST SHA-256
`f72d89f805e0592d0a7d967e2ed1afb121dfe10ad81212543b2c2efc4f892107`. No unit-test coverage is
claimed or required; implementation, local UI/API/SQL behavior, CI, merge, and external provider
boundaries remain separately reported.

## PR195 exact-head CI completion (2026-09-22 addendum)

The fresh current-master CI run `35768401037` for PR [#195](https://github.com/WangPantopus/skinny-pantopus/pull/195)
completed successfully at head `3b374454ad07060cf5dcaa1ce02fc48b3be4c88e`. Android **Lint, test,
assemble** and **Instrumented tests (emulator)** are SUCCESS, as are deployment/migration safeguards,
complete schema replay/lint, change detection and the aggregate **CI OK** job. Backend, web, iOS and
seeder jobs were correctly skipped by change detection because this PR contains the focused Android
production repair only. The earlier exact-head failure was superseded by this scoped Local-profile
guard repair; no merge was performed here. Coordinator review/merge remains the integration boundary.

## Authoritative N02/A04 row mapping correction (2026-09-22)

The authoritative backlog in `docs/REMAINING_WORK_2026-09-11.md` defines **N02** as:
“Physical Android notification/device acceptance remains unverified; emulator delivery is not
hardware acceptance. No physical Android is currently available in the recorded setup.” The
installed Android/emulator notification journeys and the induced HTTP-5xx rollback/retry remain
valid emulator/local evidence, but they do not close that physical-device criterion. This row has
no additional iOS or provider requirement in the authoritative wording, so those are not counted
as N02 gaps here.

The same backlog defines **A04** as: “Remaining address/provider coverage, including activated
Smarty scenarios, geography/unit disambiguation and legitimate unavailable responses. Prepare
what is possible on existing/free capacity first.” OAuth consent/callback belongs to **A01** and
is removed from the A04 accounting. A bounded real local A04 route pass used the existing
`POST /api/v1/address/validate` and `POST /api/v1/address/validate/unit` handlers with real Auth
Bob bearer sessions and providers intentionally absent/disabled in the retained local
configuration. Full validation returned HTTP 200 with `ADDRESS_VALIDATION_UNAVAILABLE`,
`SERVICE_ERROR`, confidence 0 and `manual_review`; a temporary isolated multi-unit
`HomeAddress` fixture (`missing_secondary_flag=true`) plus unit `2B` returned HTTP 200 with
`ADDRESS_REVALIDATION_UNAVAILABLE` and the same explicit unavailable/manual-review verdict. Both
sessions logged out HTTP 200; the temporary address was deleted (zero rows, no Home or
AddressClaim), and the API stopped. No provider activation, purchase, successful external
Smarty/geography result or schema/application change was made.

Evidence: `a04-address-unavailable-20260922.json`; the raw local API log remains operational only.
The durable private bundle now contains 192 files with MANIFEST SHA-256
`758a5f48e9757539b69863d1bf043724573c3724acc0ccf1f62094c51a814b1a`.

## Exact ten-row acceptance mapping for next handoff (2026-09-22)

This block quotes the current authoritative criterion and binds it to the evidence above. It
supersedes earlier shorthand rows while preserving their reports.

- **N01 criterion:** “Close remaining release-build notification states across platforms: exact
  post/chat/task destinations, foreground/background/cold start, permission denial, login
  continuation, token changes, account switching and unread state. Preserve completed evidence
  rather than rerunning it blindly.” Existing web/native notification routes, saved-record reads,
  unread/preferences, Android emulator actions and installed cold-process/session continuity are
  retained. Release-build cross-platform foreground/background/cold-start delivery, token-change
  behavior and physical-device delivery remain unverified.
- **N02 criterion:** “Physical Android notification/device acceptance remains unverified; emulator
  delivery is not hardware acceptance. No physical Android is currently available in the recorded
  setup.” Installed Android emulator list/filter/read/delete/Cancel/offline rollback/reconnect
  retry, destination and induced HTTP-5xx rollback/retry are recorded as emulator evidence only.
  The physical Android acceptance row remains open solely because the required device is unavailable.
- **N03 criterion:** “Release-candidate Pulse and Beacon journeys must preserve address-free
  discovery, explicit following, eligible posting, conversation/reply return, mute/unfollow and
  private/public identity boundaries.” Web/API/SQL and retained Android discovery, follow/unfollow,
  Beacon fallback, posting/reply, mute and identity separation are recorded. A fresh release-
  candidate native cohort for the complete Pulse/Beacon sequence remains unverified; no policy or
  provider claim is inferred from the debug APK evidence.
- **N04 criterion:** “Reporting, blocking, moderation and old/shared/deep-link access need a
  usable end-to-end safety workflow under the final release flags. Draft PR51 at `dfc860bfe` has
  bounded browser/HTTP/PostgreSQL and regression evidence; native lifetime, real socket/provider
  delivery and wider entry-point acceptance remain open.” Web/API/SQL report persistence,
  idempotence/failure/retry, block/unblock, DM denial, cache/access/deep-link checks and installed
  Android safety are recorded, including PR195’s fail-closed local-neighbor visibility repair.
  Moderation processing, full native lifetime/socket/provider delivery and any wider entry point
  outside the exercised inventory remain open.
- **N05 criterion:** “Any promised calendar/reminder delivery must arrive once, open the correct
  authorized destination and honor preferences; saved schedule data is separate evidence.” Existing
  reminder worker/pause/retry/destination evidence and real preference persistence are recorded.
  No daily-agenda producer/consumer or settled delivery policy exists in this scope, so a saved
  preference is not counted as delivery.
- **A01 criterion:** “Remaining real signup, verification/recovery email and OAuth callbacks,
  including Apple/Google, cancellation, provider failure and return to the original authorized
  destination.” Web signup/email verification/recovery and accepted native account flows are
  recorded, including actionable unverified-login feedback. External Apple/Google consent,
  cancellation/failure callbacks and authorized return remain unverified.
- **A02 criterion:** “Real onboarding/account session expiry, revocation, logout/account switching
  and local protected-data retirement across provider and client combinations not covered by
  controlled local login.” Natural refresh/retry, logout failure/retry, remote sign-out, lock-down,
  account switching, local-data retirement and installed Android cold-process restoration are
  recorded. Provider-combination revocation and other client/provider combinations outside the
  controlled local runtime remain unverified.
- **A03 criterion:** “Hosted media/document upload, preview, replacement, deletion, permissions,
  quotas and file cleanup under actual Auth/Storage configuration.” Existing profile/document
  screens, reads/quota and Android chooser-to-byte request are recorded. The real hosted portfolio
  request reached the existing S3 path and returned its credential 500 with no partial row; hosted
  success and complete preview/replacement/deletion/permission/lifecycle evidence require shared
  storage credentials/ownership.
- **A04 criterion:** “Remaining address/provider coverage, including activated Smarty scenarios,
  geography/unit disambiguation and legitimate unavailable responses. Prepare what is possible on
  existing/free capacity first.” The real local full-address and unit-revalidation routes now
  return explicit `ADDRESS_VALIDATION_UNAVAILABLE` and `ADDRESS_REVALIDATION_UNAVAILABLE` verdicts
  under the existing disabled-provider configuration, with an isolated multi-unit fixture and
  exact cleanup. Activated Smarty/geography success and external provider scenarios remain
  unavailable without provider ownership/credentials; no activation or purchase was made.
- **A05 criterion:** “Reconcile all reachable marketplace, subscription, booking, wallet, mail,
  profile, search and adjacent actions against the current release inventory. Old static audits
  are discovery inputs, not proof that each item is still broken.” Web report/search/audience/
  mailbox/profile edit and installed profile save plus the installed profile readback fault/retry
  are recorded. Marketplace/subscription/booking/wallet/search-adjacent and Home/payment findings
  remain with their owners; the `/signup` booking misroute was not duplicated.

No unit-test coverage is claimed or required by the user direction. The remaining items above are
explicit device, release-candidate, provider, policy or owner boundaries rather than silently
converted implementation claims.

## A04 installed Add Home unavailable response and retry (2026-09-22 addendum)

The route-only A04 unavailable result was followed through the existing installed Android caller to
check that a successful HTTP 200 envelope cannot look like verified success or discard the address
form. On `emulator-5554` with real Auth Bob login, **Hub → Start verification → Add address
manually** accepted the existing street/unit/city/state/ZIP fields and issued the real
`POST /api/v1/address/validate` against the same local runtime with Google/Smarty unavailable.
The response was HTTP 200 with `error_code=ADDRESS_VALIDATION_UNAVAILABLE`,
`verdict.status=SERVICE_ERROR`, `address_id=null`, confidence 0 and `next_actions=[manual_review]`.

The existing Android screen rendered **Address verification is unavailable. Try again.** with
**Try again** and **Edit address** actions. It retained all entered fields, showed the existing
step-2 property-review surface, and kept **Continue** disabled; it did not create a Home or claim
or present a verified result. Tapping **Try again** repeated the same real HTTP request and left the
same banner, fields and disabled continuation. Going back opened the existing **Discard your
progress?** dialog; choosing **Discard** removed the draft, and Settings → Log out returned HTTP
200. The API process then stopped cleanly.

This is installed UI/API behavior on the existing caller, not a mocked response. The server's
`manual_review` next action is recorded as an explicit provider/policy boundary; the current client
offers retry/edit and does not submit a manual review case. No application repair was justified
because the draft is preserved, the failure is visible and continuation is blocked. Evidence:
`a04-address-ui-unavailable-20260922.json` and
`a04-address-ui-evidence-20260922/{form-before.xml,after-unavailable.xml,after-retry.xml,after-unavailable.png,after-retry.png}`.
The durable private bundle now contains 198 files with MANIFEST SHA-256
`1fa796d1b6f08e89b549f0aadf0f6986241fbd511184ff2825dc889071957f26`.

## Minimal prerequisites for the remaining open criteria (2026-09-22)

No further local variant is justified after the accepted A04 unavailable UI/retry pass. The next
agent should start only when the corresponding capability is present:

- **N01:** a release-candidate build on the target platforms, an authorized notification provider
  fixture with token rotation, and physical-device access for foreground/background/cold-start and
  permission-continuation evidence.
- **N02:** a physical Android device and release build capable of receiving the authorized
  notification fixture; emulator evidence cannot substitute for this row.
- **N03:** an assigned release-candidate native build slot with final Pulse/Beacon flags and
  disposable address-free identities/posts/replies so the complete discovery → follow → eligible
  post → reply return → mute/unfollow → private/public identity sequence can be exercised.
- **N04:** a moderation owner who can provide the final release flags, moderation processing
  disposition and any approved socket/provider fixture needed beyond the recorded local HTTP/SQL
  and installed Android safety paths.
- **N05:** a product owner must define the daily-agenda producer, recipient/channel, exact-once
  timing, authorized destination and retry policy; then an assigned scheduler/provider runtime is
  required. A saved preference cannot supply those missing semantics.
- **A01:** authorized Apple/Google OAuth client credentials, redirect origins and consent/callback
  environments, plus provider failure/cancellation controls for returning to a protected original
  destination.
- **A02:** approved provider revocation/expiry controls and at least the required client/device
  combinations for keychain/session retirement; controlled local login cannot prove them.
- **A03:** shared storage owner approval plus valid isolated S3/CloudFront credentials, bucket,
  quota/lifecycle and cleanup fixture for hosted byte upload/preview/replacement/deletion.
- **A04:** activated Smarty/geography/unit provider credentials or a free approved provider fixture
  that yields real candidate/disambiguation outcomes. The legitimate-unavailable response and
  installed retry/draft behavior are already accepted locally.
- **A05:** route ownership and authorized fixtures for Marketplace, subscription, booking, wallet,
  mail/search-adjacent and Home/payment actions; Stream 3 should not duplicate those owners' audits.

These are capability prerequisites, not new backlog rows. No provider activation, purchase, schema
change, design change or unit-test file was added.

## N03/N04/N01 native-social-r1 — installed iOS+Android journeys verified; 8 defects reproduced, 6 PRs (September 22)

Branches (each from master c1280e078, none merged): backend `codex/stream3-userblock-content-gate`
29951b76a → PR163; iOS `codex/stream3-ios-push-tap-main-thread` 579a57fe7 → PR164,
`codex/stream3-ios-deeplink-surface` 8890d1a58 → PR165, `codex/stream3-ios-social-follow-block-chat`
8b4d47c0a → PR166; Android `codex/stream3-android-deeplink-location` 32a216f9a → PR167,
`codex/stream3-android-social-follow-block-chat` f248ce8e9 → PR168. Verification builds came from
local integration branches (iOS 4adcc12c8 = 164+165+166, Android 827f28a08 = 167+168), one native
build at a time. Retained API restarted once from the exact captured recipe (80982 → 49623) to load
PR163; Next 36139, DB, Mailpit and both devices retained.

Runtime/actors: iOS 0AE16FA0 as Evan, Android emulator-5554 as Bob (later Evan for the account
switch). Evan's fixture password was rotated to a throwaway through the REAL forgot/reset flow
(pantopus://auth/reset-password deep link) because the headless simulator offers no scriptable or
pasteboard text path and the fixture value must never be printed; restored at cleanup by the same
real flow from a script. Simulated GPS on both devices; the emulator's fused location never returned
a fix (geo fix + test provider both failed) so Android posted to Connections.

Verified natively (real API/SQL receipts per journey): Pulse Nearby/Connections feed load, empty
state, injected 503 error frame + Try again recovery (both); address-free rendering (city/coords
label only, no street); iOS Nearby Ask post via fresh GPS (POST /api/posts 201, ask_local/nearby),
Android Connections post (201); shared post link to another user's Nearby post (Android 200);
comment + threaded reply with post_commented / comment_replied notifications and exact foreground
tap destinations on both platforms; Beacon profile, follow/unfollow of a user and (after the fix) of
a Beacon; report post (PostReport pending), report user (UserReport pending) on both; block from the
profile on both, Settings → Blocked users list/unblock/re-block with one DELETE for a double tap
(Android), block while a DM is open (Android details sheet, thread closes); DM after block refused
403 in both directions (no ChatMessage written); held block reply (private hook, 25 s auto-release);
simctl push foreground banner + tap destination; Android background (HOME→link) and cold start
(force-stop→link) destinations; POST_NOTIFICATIONS denial (system prompt → logcat only, no in-app
state); Android sign-out → deferred post link → login form → sign in as Evan → continuation to the
post and Evan-only unread count.

Reproduced defects → repairs: (1) iOS background push banner tap crashed (SIGABRT, UIKit
state-restoration assert in the async didReceive completion) → PR164; (2) iOS Place/Mail-tab deep
links rendered under the Nearby→Pulse sheet (profile, Beacon, notifications; 3 occurrences) → PR165;
(3) new_follower link `/<username>` unroutable natively (tap marked read, no navigation) → PR165 +
PR167; (4) Beacon Follow dead-ended on the flag-gated fan-handle-suggestion 404 under the release
default → plain-follow fallback PR166 + PR168; (5) UserBlock did not gate follow/feed/post
reads/comments — blocker followed the blocked user (notification delivered), blocked author's post
readable via shared link → PR163 (backend) + Follow row hidden after block PR166/PR168; (6) chat 403
rendered as bare "Failed to send · Retry" → banner copy PR166/PR168; (7) Android composer "Current
Location" never requested the runtime permission → PR167; (8) Android `pantopus://feed` from a
child screen left the child on top (recorded, not fixed — navigateToRootTab restoreState).

Re-verified on the rebuilt iOS app: sheet dismissed and Notifications visible on the link;
new_follower tap opens the profile; Beacon follow → suggestion 404 → POST /api/personas/:id/follow
201 → "You're following" step (Dana got persona_follow); refused send shows "You can't send messages
in this conversation."; background banner tap keeps pid 52093 (0 crash reports) and opens the room.
Backend gate on the restarted API: Bob's post → 403 for Evan, blocked comments dropped, follow → 403.
Backend Jest 10 suites/153 pass. Android: bare-username link opens the profile on the rebuilt app; the remaining Android re-verification (composer permission prompt, Beacon fallback, blocked Follow, refused-send copy) runs after the next Android rebuild carrying 87460475e (two emulator ANRs under xcodebuild host load ≈21 were starvation, not app defects).

Limits: simctl push and adb `am start` stand in for APNs/FCM (no provider delivery); emulator, not
hardware (N02 boundary unchanged); throwaway password rotation labelled; no report-outcome
notification exists (no PostReport/UserReport reader) — moderation outcome is a product boundary;
persona broadcasts remain readable/followable across a personal UserBlock (persona surfaces gated by
PersonaBlock/tier only) — founder call; retained DB lacks find_businesses_nearby (matched-businesses
404) and LocalProfile.verified_resident; Mapbox key absent so location_name is a coordinate string;
iOS Ask title not rendered on native cards/detail (design question, web to compare); `PERSONA ·
VERIFIED` chip shown for any user without home residency (derivedKind) — product call; iOS pushed
Place-stack screens show duplicated back/title chrome (presentation, untouched).

Cleanup: partial — pre-existing Notification read flags restored from preflight after an accidental "Mark all read" (Bob), POST_NOTIFICATIONS re-granted, iOS Beacon membership removed by unfollow; batch-1 rows (2 Posts, 2 PostComments, 1 PostReport, 2 UserReports, 2 UserBlocks, 1 UserFollow, 5 Notifications) still present for the remaining re-verification and are deleted child-first by `cleanup-social-r4-rows.py` (dry run recorded); Evan stays signed in on both devices for batch 2 and his fixture password is restored at the final cleanup by `restore-evan-password.py` (real reset flow).

Evidence: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1/`
(preflight.json, n03/n04/n01-native-result.json, push payload, crash .ips, screenshots), 95
files, MANIFEST **392f263c7ff73f9500a2c43cf05d1cb90c1ef3efea74fcb6e5f5bbb1ab1c3b14**. CI at publication: PR163 29951b76a FAILURE/SKIPPED/SUCCESS;PR164 579a57fe7 /SKIPPED/SUCCESS;PR165 ba8f7374e /SKIPPED/SUCCESS;PR166 8b4d47c0a /SKIPPED/SUCCESS;PR167 87460475e /SKIPPED/SUCCESS;PR168 f248ce8e9 /FAILURE/SKIPPED/SUCCESS; Runtime: API pid 49623:18130 (codex/stream3-userblock-content-gate 29951b76a), Next 36139:18131, containers *pantopus-stream3-block-r1 + pantopus-stream3-mail-r3, simulator 0AE16FA0 (installed local/stream3-ios-integration e86b9fe5b = PR164+165+166), emulator-5554 (installed 827f28a08 = PR167 first commit + PR168; rebuild with 87460475e pending). Next: finish the Android re-verification, run touched unit suites, batch-1 row cleanup, then batch 2 rows (A05 native sweep → A03 → N05 → A02 → A01 → A04/N02 notes).
Open founder questions: personal block vs persona surfaces; Ask title rendering; PERSONA·VERIFIED chip semantics; report-outcome notifications.


## Founder stop — native-social-r1 state at 09:25UTC (September 22)

Stopped on instruction before the Android on-device re-verification finished. Everything is
committed and pushed; no build is running. Branches/heads/PRs: backend
`codex/stream3-userblock-content-gate` 29951b76a → PR163 (CI: privacy Gate 3a fails because the
new top-level require shifted the allowlisted `routes/users.js:306` compat line to :307 — remedy:
inline the require at the follow-route use site or move the allowlist key; Jest passed); iOS
`codex/stream3-ios-push-tap-main-thread` 579a57fe7 → PR164 (CI green), `codex/stream3-ios-deeplink-surface`
ba8f7374e → PR165 (CI green; router widening withdrawn for the accepted unknown-path contract,
replaced by a type-scoped `new_follower` link rewrite), `codex/stream3-ios-social-follow-block-chat`
8b4d47c0a → PR166 (CI green); Android `codex/stream3-android-deeplink-location` 87460475e → PR167
(CI green), `codex/stream3-android-social-follow-block-chat` f248ce8e9 → PR168 (CI: ktlint, three
formatting findings listed in the PR); verification builds pushed as `codex/stream3-verify-ios-integration`
e86b9fe5b and `codex/stream3-verify-android-integration` 10c4368c6 (never for merge); docs PR170.

Reproduced/fixed: see the section above (8 defects, 6 PRs). Re-verified on device: all iOS fixes
(sheet dismissal, new_follower tap → profile on the r4c build only for the list path, Beacon plain
follow, refused-send banner, background push tap without crash) and the backend gate (403 post read,
comments dropped, follow refused). Not re-verified: Android composer permission prompt, Android
Beacon fallback / blocked Follow row / refused-send copy on the rebuilt APK (the installed APK is
827f28a08 = PR167 first commit + PR168; the 87460475e rewrite is built locally but not installed);
iOS DeepLinkRouter suites not rerun after the rewrite (last run on 46bde64f3: 123 executed, 3
failures all from the withdrawn widening); Android unit suites not run.

Evidence: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260922-stream3-native-social-r1/`
100 files, MANIFEST **9ff965be0d1042fc3e147ee15bb5224c1c2c500ede9bd59be251d9ee8721faf4** (result.md indexes
every journey; crash .ips, push payload, cleanup/restore scripts included). Limits: simctl push and
adb `am start` stand in for APNs/FCM; simulator/emulator only; Evan's password rotated through the
real reset flow (throwaway, never the fixture value in transcripts).

Runtime left running: API pid 49623 on 127.0.0.1:18130 (code = PR163 branch), Next pid 36139 on
18131 (stream3-auth.localhost), containers `*pantopus-stream3-block-r1` + `pantopus-stream3-mail-r3`,
simulator 0AE16FA0 signed in as Evan with build e86b9fe5b, emulator-5554 signed in as Evan (Bob
signed out) with the 827f28a08 APK; emulator location permission revoked for the pending test.
Rows created and NOT cleaned (guarded child-first script `cleanup-social-r4-rows.py` in the bundle):
Posts 5f7a2322/b9cf8480, PostComments 60a4048a/b4691d46, PostReport de0dfb95, UserReports
a492140b/ac8a85d3, UserBlocks 440b7047/acde5f0c, UserFollow 63bcd4ff, Notifications b35ea1b0/
a78eb98a/93b05807/46375f39/04922c53. Evan has 2 active device sessions and the throwaway password
(`restore-evan-password.py` restores it through the real reset flow); Bob's pre-existing notification
read flags were restored and POST_NOTIFICATIONS re-granted.

Exact next step: fix the two CI findings (PR163 inline require; PR168 ktlint), install the
10c4368c6 APK, finish the four Android re-verifications, rerun the iOS DeepLinkRouter suites and
the Android view-model suites, run the cleanup + password restore, refresh MANIFEST/docs, then
batch 2 (A05 → A03 → N05 → A02 → A01 → A04/N02). START HERE note:
`/private/tmp/pantopus-stream3-20260920-r1/RESUME-2026-09-22.md`.
