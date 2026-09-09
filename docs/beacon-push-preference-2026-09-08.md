# Beacon push preference — September 8, 2026

Beacon device alerts now have a separate default-enabled preference in source.
Turning it off keeps the in-app audience row, live event, badge update and exact
post destination. Restore affects future publications only. Global push off still
wins; per-Beacon mute/off continues to suppress fanout before creating a row.

## Implementation

Migration `20260909000622_beacon_push_preference.sql` adds non-null boolean
`UserNotificationPreferences.beacon_push_enabled` with default true. Existing
rows gain that default while retaining previous global/category settings. The
authenticated Hub API supplies the default, accepts partial updates and derives
ownership from the session.

Only persona_broadcast transport consults this field, in single and bulk
delivery, after the in-app row exists. A failed preference read suppresses Beacon
device transport because it cannot establish that a saved opt-out is absent.
Missing rows remain enabled; other types retain their existing behavior.

Web/iOS/Android settings expose “Beacon Push Notifications” and explain that
updates remain in the app. Web now merges every key in the debounce window.
All clients serialize saves and ignore older responses when a newer edit is
pending. Rapid changes cannot discard an opt-out or restore an older value.
A failed final save reloads server truth.

## Verification

| Check | Result |
| --- | --- |
| Backend | 53 targeted preference/registration/firewall tests pass; all privacy gates pass |
| Web | Four tests pass: saved off/restore, merged quick changes, overlapping saves and failed-save rollback; TypeScript passes; ESLint has zero errors and one existing explicit-any warning |
| iOS | 16 settings tests pass on iPhone 17 simulator, including defaults, exact partial payload, merged edits and a delayed in-flight save; changed files pass strict SwiftLint and SwiftFormat |
| Android | 24 settings/serialization tests pass, including false/restore and serialized saves; ktlint and Detekt pass |
| SQL upgrade | A pre-migration synthetic row gains Beacon=true while global/Gig opt-outs remain false; fixture removed |
| Complete schema | Eight pgTAP contracts and six real SDK/PostgREST/Following tests pass, including preference defaults/false/restore, null rejection and preservation of unrelated settings |
| Migration tooling | 19 tests pass; the history guard now compares exact Git blob identities, avoiding Node's stdout buffer limit for baselines larger than 1 MiB while still rejecting modified applied SQL |

Canonical predecessor f9362cbca55a25ea51f9a1ebbcb60b72fb7fad22 has fully passing
[CI run 34293457260](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34293457260).
Preference revision 65d2cc2d9ab4857e044325315f0023a6d8f4bf54 is in
[PR #12](https://github.com/WangPantopus/skinny-pantopus/pull/12); its
[CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34295357368)
fully passes backend/privacy, web, Docker, safeguards, database and every native
job. Private logs and credentials remain outside Git.

## Staging rollout

Before expansion, read-only staging inspection confirmed the column and restrictive
Post policy were absent, the three reviewed maintenance RPCs existed, and Post
RLS was enabled. Global/internal feature enablement and both staging release
switches remain false. The starting beta list was empty.
The scoped staging SQL rehearsal has now passed both actual-role contracts and
rolled back completely, preserving existing preferences and migration history.
The reviewed SQL SHA-256 is fe9bf1bdc2225588b99edbe89d3868ff9bc9811aef27ea9b73ea46a9d04fcb46.

The reviewed forward SQL has now been applied on staging after the complete CI
pass. The new column, restrictive post_persona_service_only policy and service-only
grants for auto_archive_expired_posts, get_seeder_tapering_metrics and
record_post_unique_view are present. Existing preference values and the hosted
migration ledger retain their fingerprints. The API and worker now run verified
revision 65d2cc2d9ab4857e044325315f0023a6d8f4bf54, image
sha256:c7d81368d0fac60b73134c0fd3d0243696de6fef4cb40ed6e32bf0c8f9a527f5,
both healthy. HTTPS health reports database connectivity. Previous containers
and their image remain available for rollback.

All 20 fresh live API checks pass. Push off retains the exact audience row,
Following unread/latest-post state, permitted return and authenticated WebSocket
event. Restore persists without replay; the next publication points to its own
post. Per-Beacon mute suppresses rows, unmute restores them, and Member/block/
draft/archive restrictions still deny content. Explicit refollow restores access.
Real anonymous and authenticated-owner PostgREST clients can read an ordinary
public control but cannot read the Beacon, convert a personal post into a Beacon,
or invoke the reviewed view-maintenance RPC. Service access succeeds. This matrix
used only the token-free synthetic follower and sent no device alerts.

Both native staging builds pass. The signed iPhone app uses the staging API and
development APNs entitlement. Android signed in normally and registered one linked
FCM token, then joined the test Beacon after the API-only matrix completed.
Global/internal feature enablement remained false throughout; only the fresh
synthetic accounts and designated Android account entered its beta list.
Physical iPhone availability remains unconfirmed.

The Android walkthrough exposed no-op menu and notification callbacks in the
first-run Hub. Both now dispatch the existing navigation intents, matching iOS,
so an account without a home can reach notifications and the settings drawer.
Revision 8022e9b05253a91a579f52e883e067514843234a passes ktlint, Detekt and the
staging build. Its installed APK successfully opens first-run menu → Settings →
Notification preferences without a home; the Beacon toggle displays and saves.
The [new CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34298026294)
fully passes at that application revision, including all native jobs. The later
documentation checkpoint changes only the handoff and evidence reports.

## Android native preference acceptance

The rebuilt staging APK SHA-256 is
8ec4055aed0fa4f5b604c0fe0e9d78326824baf75bc30864d23decf8a28baf97.
The designated Android 14/API 34 emulator passed the full preference journey:

| Native action | Observed result |
| --- | --- |
| Turn Beacon push off in settings | Saved false in the API and remained off after reopening settings; global push remained true |
| Background app and publish A-off | One audience row for the device account, correct exact-post link; no system alert or FCM acceptance receipt during 72 seconds |
| Open the retained in-app notification | Displayed exactly “Beacon preference A-off — quiet violet” with public author “Beacon Preference Test” |
| Restore the setting and publish A-restored | FCM attempted one token and accepted one; only the new notification appeared in the system shade |
| Tap that device notification | Opened exactly “Beacon preference A-restored — coral sunrise” with the correct author |
| Check the muted publication after restore | Still no device alert or provider receipt at 301 seconds; no notification replay |

These synthetic identifiers correlate the stored post, audience row and native return;
the fixtures were deleted during cleanup.

| Case | Post ID | Notification ID |
| --- | --- | --- |
| A-off | `9dc385e3-7735-42cf-b157-8a6ce55dee0b` | `1351554d-1c52-455b-a20a-0ef48c5bcd4b` |
| A-restored | `a4264b3f-3414-4276-b435-40dbcae48e40` | `627d2412-ad3b-43b3-be56-591de42e21c7` |

The native test audience contained only the designated Android account and the
token-free API follower. During that Android test, the iPhone was not enrolled or notified. These are
emulator observations; physical Android remains unverified.

Every original Android notification preference compared equal after restoration,
as did global push. Native logout removed its token. Scoped cleanup removed all
11 posts, 12 notifications, one Beacon, the remaining membership and two new
synthetic accounts. Both original device accounts, their two prior notifications
and the iPhone registration were preserved. Global/internal enablement stays
false and the beta list is empty again. The emulator was closed after logout.
Future iPhone checks must create a fresh isolated fixture; do not reuse the
deleted creator/channel IDs.

This forward preparation does not adopt a hosted canonical ledger or enable
automation. Never run fresh baseline DDL on a populated project. Complete separate
per-environment ledger adoption before enabling automatic migrations; production
remains unchanged.

## iPhone native preference acceptance

Hosted raw-role denial, API off/restore, retained audience rows, exact permitted
return and no replay now pass. On resume, the prepared iPhone build's executable
hash, signature, staging API and development push entitlement were verified; it
installed successfully on the designated iPhone 16 Pro / iOS 26.5.2. A fresh
synthetic owner and Beacon have only that iPhone account as a follower, with one
linked APNs registration. Original preference values were saved; global/internal
enablement remains false.

The owner reported initial toggle attempts showed “Failed to save” before later
attempts showed “Saved.” The current device registration matches the successful
installation, and an independent API read confirms Beacon push off/global push on.
The first failed save followed 30 refresh requests during startup, exceeding the
30-write/IP budget. iOS supplied credentials in Engine.IO query parameters/headers;
the server expects the Socket.IO namespace auth payload. Rejected connections
could therefore trigger repeated token rotations. Per-request response statuses
were not retained, so rate-limiting of those saves is inferred from the request
counts and middleware; a live staging Engine.IO/Socket.IO check reproduced rejection of the old query/header
format and successful connection using the namespace auth payload. The repair
now uses the namespace payload and bounds recovery until a successful connection.
All 50 targeted iOS tests pass: eight socket recovery, 20 session refresh,
16 notification settings and six API client tests. The regressions cover rejected
replacement tokens, transient failures, recovery after successful authentication
and a fresh session. SwiftFormat and strict SwiftLint pass. Revision
`e328c33580a1e01f2629210668a1a29de303d80d` is pushed to PR #12 and its
[full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34302923001)
fully passes. The repaired signed staging build passed; signature, API/socket hosts,
development APNs entitlement and signing team were verified. Installation succeeded
and the device's current app location matches that installer result. The repaired
executable SHA-256 is
`f5ea0be2fb26ba4246f94d863cc6d8ee7aa08f0df51f59b1529801bf6c1f540a`.
The first launch attempt was blocked by the locked phone. After opening it, the
owner confirms “saved” and Beacon push off. The API independently verifies false,
global push true and preservation of unrelated preferences. Native traffic after
installation contains two authenticated socket connections, two preference writes
and one refresh across 27 requests from the same client, with no other native
client in that observation. The earlier refresh burst is absent. This verifies
the repaired startup and native save milestone.

The I-off publication has now been sent once, after verifying the sole designated
iPhone follower, its APNs registration and the saved opt-out. Its single audience
row points to the exact post and the API return passes. No APNs acceptance
receipt was recorded during 71 seconds. The owner confirms no alert and the
retained in-app exact return. I-off now passes on the physical device.
The owner also reported push restored and the app backgrounded, but API and
direct database reads at 06:24 UTC still showed Beacon false, last updated
03:24 UTC. No native requests reached staging in the latest 30-minute window.
The publication guard stopped before writing anything; I-restored has not been
sent at that checkpoint. On the next native attempt, the owner confirmed the on
value survived reopening settings and the app was backgrounded. A fresh API read
agreed. I-restored was then published once at 06:41:52 UTC, with exactly one
audience row and a passing exact-post API return. APNs attempted one token and
accepted one at 22 seconds. I-off still had zero acceptance receipts at 11,761
seconds, including after restore. The owner confirms only the new notification
arrived and opened exactly “Beacon preference I-restored — turquoise moon,”
without I-off replay. The final I-off observation at 12,032 seconds still has no
provider acceptance receipt. The iPhone preference journey now passes.
Physical Android remains unavailable.
Previously confirmed background/foreground/closed-app, block, mute and global
push cases remain in the [full journey report](beacon-full-journey-2026-09-08.md).

Current synthetic I-off evidence: post `ca5e6f87-38fd-47bb-b7cc-3dd0a66ef6a0`, audience notification
`a66e1230-0efb-4cc4-aa40-b6d4849dc4e6`.

I-restored evidence: post `8384ec5d-197a-4593-b1ce-e9fdb99835c1`, audience
notification `6acbf590-9bdf-43bc-94c2-68c503a77a8b`, body
“Beacon preference I-restored — turquoise moon.” These IDs are historical;
the owned fixtures were removed during cleanup. Do not resend either case.

Scoped cleanup removed two posts, three notifications, the fresh Beacon and its
membership, and the fresh creator account. Full original preference comparison
passed afterward; global push was preserved, as were the original iPhone account,
its one APNs registration and two prior notifications. Global/internal feature
enablement remains false and the beta list is empty. Both Android/API and iPhone
preference fixtures are now cleaned up.

Two current-source iOS simulator UI journeys also pass against the isolated
stateful API fixture: login → exact post, and muted Following → exact Beacon
update with the public author. These exercise production screens and routing;
live expired-session recovery and denied OS notification permission remain
separate acceptance cases.

## CI continuation and integration state

The documentation-head [CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34307328711)
failed only on iPhone SE and the aggregate gate. The in-flight save test asserted
after a fixed 500 ms sleep before its delayed request finished; that request then
consumed later tests' stub responses, also failing the quiet-hours test. The test
now awaits the actual save loop and drains its timer before returning. This is
a test-only change; all 16 settings tests pass five repetitions (80 executions),
with passing SwiftFormat and strict SwiftLint. Fresh PR #12 CI is still required.

PR #10 is merged to master at `c9fd509e3`. PR #11 subsequently merged into
`codex/beacon-full-journey` at `6113691c9`, so the baseline still needs a follow-up
integration PR to master. Draft [PR #13](https://github.com/WangPantopus/skinny-pantopus/pull/13)
now provides it, preserving merge ancestry and including the migration checker
fix already present in PR #12. Legacy-base and canonical-base checks plus six
checker tests pass; its initial merge tree exactly matched the PR #11 result.
PR #13 CI is pending. PR #12 remains draft and unmerged. Its current base is
`codex/database-baseline-adoption`; retarget it after baseline integration so its
review contains only the additive preference and native fixes.
