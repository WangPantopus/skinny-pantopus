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

## Remaining acceptance

Hosted raw-role denial, API off/restore, retained audience rows, exact permitted
return and no replay now pass. On resume, the prepared iPhone build's executable
hash, signature, staging API and development push entitlement were verified; it
installed successfully on the designated iPhone 16 Pro / iOS 26.5.2. A fresh
synthetic owner and Beacon have only that iPhone account as a follower, with one
linked APNs registration. Original preference values were saved; global/internal
enablement remains false. No publication has been sent in this resumed fixture.

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
and a fresh session. SwiftFormat and strict SwiftLint pass. The signed device
build and installation of the repaired app are pending.
No test publication has been sent during this investigation.

After verifying save reliability, background the app and verify no device alert
while the in-app row remains and opens the
exact post, then restore the toggle and verify the next notification's exact
return without replay. Verify the audience before every publication and restore
test preferences afterward. Physical Android remains unavailable.
Previously confirmed background/foreground/closed-app, block, mute and global
push cases remain in the [full journey report](beacon-full-journey-2026-09-08.md).
