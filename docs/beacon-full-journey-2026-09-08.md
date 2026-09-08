# Full Beacon staging journey — September 8, 2026

## Integration and test identity

PR #9 merged as `a373b10940813bc5deef37b29f67dcc9b6375994`. Both
[final PR CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34204164211)
and [master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34206108701)
passed. Both environments still have deployment and migration automation disabled.
The staging API and worker initially run `9d1fe24dc` with the previously recorded image.

The dedicated Beacon is `f290b78d-97a4-4606-abe4-a1acfa2d764d`, channel
`b3f1dae3-70a5-4865-a591-cf95303006e7`. Initial audience: only the designated
synthetic Android follower and a separate synthetic Member fixture. Neither
has a home; the creator is another synthetic account. Member access is a
scoped database fixture, without checkout or a charge. The audience feature
flag remains globally false; only these fixture IDs were added to its beta list.
Credentials and raw results remain in the private recovery directory.

## First live matrix milestone

- Publication `8199d309-a91a-44df-9e20-3c346d1ce7fb` matched Following,
  notification `e5063892-8a42-47c4-bafc-a786efa7c213`, and post detail HTTP 200.
  Notification appeared only in the audience stream. Both and only the two
  eligible synthetic recipients received stored notifications.
- Seven-day mute suppressed the follower notification for
  `9e575a15-facf-4915-87dd-902469fb139c`; Following retained the unread update
  and post detail stayed readable.
- Unmuting before the third publication did not produce a notification:
  the ordinary post hook suppresses all fanout at three posts/hour, including
  explicit broadcasts already accepted by the publish route's own limiter.
- Free followers cannot read Member post detail. However, a short restricted
  body was exposed in the channel's generated teaser.
- After Member expiry, post detail correctly returned 403, but the broadcast
  read endpoint returned 200 and the channel returned restricted text. Its
  legacy subscriber compatibility override ignored membership status.
- Blocking denied an older post and removed new Following content/fanout.

A resumed harness initially reused older post IDs and compared them with the
new latest post; those two resulting Following failures are harness artifacts,
not regressions. Subsequent verification must use fresh publications per case.

## Next action at the first checkpoint

Fix the confirmed fanout and access failures, add regressions including draft
and archived direct reads, then deploy the reviewed revision only to staging
and rerun a fresh matrix. Native Beacon taps are pending. The owner is available
for physical iPhone checks; physical Android remains unavailable. The current
app has per-Beacon notification suppression and global push preference but no
Beacon-specific push-only setting; that acceptance case needs implementation.


## Repair milestone

Broadcasts now use the publish route's explicit rate limit without the hidden
ordinary-post fanout cap. Restricted previews use a generic label; subscriber
compatibility applies only to active/past-due memberships. Old notification
and broadcast reads also reject draft/archived persona posts. Provider dispatch
records only notification ID, provider and attempted/accepted counts, allowing
acceptance to be separated from physical display without logging device tokens.

The complete backend suite passed 4,305 tests (16 skipped), including the new
access and fanout regressions; privacy gates passed. Acceptance logging has a
separate privacy regression. Staging rollout and a fresh live matrix are next.
The schema's legacy migration policy forbids adding migrations before baseline
adoption. The missing Beacon push-only setting therefore remains an explicit
unmet acceptance case; do not silently map it onto unrelated alert toggles.


## Staging rollout milestone

API and worker now run `982851170cf5f1bba080b291dbfa07dac3f3188b`, image
`sha256:f84a3ae2ae95f0d2642a7ebefcb6da53edb7a7663139a74a0c74d32bd483b111`.
This is an immutable derivative of the verified prior staging image. Git diff
confirmed exactly three runtime files changed since its source baseline; those
files were copied from the committed revision, with unchanged dependencies.
The existing deployment transaction passed candidate/API/worker readiness and
retained previous containers. No database schema, production runtime/DNS or
GitHub deployment switch changed. Draft [PR #10](https://github.com/WangPantopus/skinny-pantopus/pull/10)
contains the change; backend CI passes, image CI is still running at this checkpoint.


## Fresh live matrix on repaired staging

All 17 checks passed with fresh post IDs against the hosted API and real
PostgREST joins. The authenticated WebSocket received `notification:new` for
the same audience item. No unrelated recipient was present.

| Case | Exact stored post / result |
| --- | --- |
| Publish → Following → audience notification → detail | `877d93bd-92ea-464b-8231-82176680279c`; notification `897f2ad2-95c9-4219-aa5d-2f3efcb621d8`; detail 200; personal stream excluded it. |
| Seven-day mute | `b2bfaa52-6fcd-4d9f-beb7-9fa9b2944b97`; no follower notification; unread Following and detail remain available. |
| Unmute | `36cdd06e-4dda-4bff-bf4e-75d629931cad`; fanout restored on the third publication. |
| Per-Beacon notifications off | `27fcb160-51e3-493f-a3ac-2169ece96834`; follower fanout suppressed. |
| Member restriction | `7ceb5751-02db-4cf2-b6c8-323b8f385a4b`; only the eligible Member sees latest content and receives notification; free detail 403 and channel has no content excerpt. |
| Expired Member | The same Member post returns 403 from both post detail and broadcast read; channel excludes its content. |
| Blocked follower | Old baseline detail 403; no new Following content or notification. |
| Draft | `17d96287-bd75-4867-8ba0-05c3adf18243`; old destinations return 403; channel and Following exclude it. |
| Archived | `75464910-acb5-4511-aba3-ac788046e0b3`; same denial and list exclusion. |

The synthetic Android global push preference was disabled during API-only
checks and restored afterward. Membership/block/mute/Beacon preferences were
restored. Physical/native checks and fixture cleanup remain in progress.
[PR #10 CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34264541400)
passed with backend/privacy, Docker and safeguards; unchanged native/web jobs
were skipped, with their baseline coverage coming from merged-master CI.


## Physical iPhone background milestone

On the existing development-signed Staging build, iPhone 16 Pro / iOS 26.5.2,
the creator published `9cf08e15-ae6e-4cf8-81d3-eeb6dffc4712` with text
“Beacon check B1 — blue lantern.” Notification
`afc149d4-bbc6-4f72-a75b-45d2aa901744` was stored at 18:45:09 UTC with the
exact `/post/<id>` destination. Only the designated iPhone account was in this
separate synthetic Beacon's audience. APNs attempted one token and accepted one.
The owner confirmed background display and that tapping opened that exact post.
This proves actual Beacon publication/fanout/return, beyond the earlier generic
notification fixture. Foreground and ordinary termination are still pending.


The owner also confirmed foreground delivery and exact return for
`4b1029a9-8b85-4526-98b3-dd319018fb66` (“F1 — green comet”), and notification
launch from the closed app for `f606590b-baee-4a83-ace6-35d40ec42932`
(“C1 — amber orbit”). The latter state was an app-switcher swipe-away, not a
reboot. Each corresponding notification has a separate APNs acceptance count
of one. Native blocked-old-notification reopening is being checked next.

## Additional feed inspection

The Android Beacon Updates feed exposed the synthetic draft that Following,
post detail and broadcast channel correctly excluded. Its separate feed
pipeline checked tier rank but omitted publication status. The follow-up uses
the shared visibility predicate before normalization; 50 targeted feed tests
pass. The live matrix must now include `/api/posts/feed?surface=personas` as well
as the Following management and channel lists. An Android sign-in during the
rollout also ended with zero push tokens despite a locally cached registration
acknowledgment; ordinary app sign-out/sign-in recovery is being verified. No raw
device-token/cache value was changed to force delivery.


## Feed repair deployment and physical restriction checks

The final application revision `5d911ca48c8fc8466a0e3943aa698f0e4642fca0`
now runs in API and worker with image
`sha256:01af6b0acabfa658bb6c5b0aaa1069a4da7eec6369f77f5d3d73b1d8c90c5914`.
All 4,308 backend tests passed (16 skipped), and PR application-head `CI OK`
passed. Real staging feed requests now exclude the draft/archive for both
free follower and Member; the restricted update is visible only to the Member.

The owner confirmed that the old C1 notification, still present in the iPhone
notification list, denies access and hides content after blocking. Membership
was restored afterward. A seven-day mute then suppressed M1
`f6971fab-f044-4e97-a7c3-1a508e42e493` entirely; after unmute, M2
`df63bd05-45aa-4b00-b6a7-22c955c57d1b` notified and opened correctly on the phone.
The owner explicitly confirmed only M2 arrived.

Global push off retained the G1 in-app notification
`25fb3f69-5896-40e7-93b7-e4a71592d2f5` for post
`3edadac2-208e-4689-9ca6-1a99c24deee1`, with no provider-dispatch receipt.
Restoring the original true preference produced one accepted APNs send for G2
`c289c4a6-ad53-4072-95cc-871fd876cba8`, notification
`0e79aea6-d8dc-49ee-b6ca-0348394b9dc6`. Owner observation is pending at this checkpoint.


At the owner's request, the global-push pair was repeated. G1R
`f0c9125e-8cb2-4cf5-909e-4a746949d5a5` retained stored notification
`fcf34d51-4d24-491c-9e97-759fcd657484` with push disabled. G2R
`882ae514-014f-4ec8-b1c1-bef072745fc6` generated notification
`03e1ab15-a83d-4204-acd0-a07900dcf414` after restoration. The owner confirmed
that only G2R notified and it opened correctly. The original global preference,
Beacon notification level and mute state are restored; the block is removed.


## Android Beacon milestone

The existing `fd9a60dcd` staging debug APK (1.0.0-debug, version code 1)
on Google APIs ARM64 Android 14/API 34 displayed actual FCM notifications
and opened the exact unique post text in all three tested states. Each send
has a separately recorded provider receipt: one attempted token, one accepted.

| App state | Stored post | Stored notification | Native observation |
| --- | --- | --- | --- |
| Background | `06bd4307-b7e2-4723-b90e-1490039d038d` | `f0189888-ee50-4fe9-afdd-7a4b273ac787` | “Android Beacon B1 — exact post” displayed and opened. |
| Foreground | `d8d2dc9e-f164-4ec5-8c20-dd7d81ef7881` | `d3f9fdf0-d8d0-4653-9f48-b0aa7fab526f` | “Android Beacon F1 — exact post” displayed and opened. |
| Process absent | `e09b8590-9bf0-4d79-8cda-55195799c4ff` | `67c57be9-7332-45ed-bb67-8b2c4c81cb97` | “Android Beacon C1 — exact post” displayed and launched into that post. |

For C1, the app was backgrounded and `am kill` was used; `pidof` confirmed
no app process before publication. This was not Android force-stop or reboot.
The Beacon feed and notification destinations were reachable without a home.
Fresh UI hierarchy captures remain in the private evidence folder.

Normal sign-out/sign-in with the healthy API recovered registration after the
earlier rollout-time failure; exactly one device-linked FCM token was stored.
A failed forced registration can leave the prior fingerprint/cache acknowledgment
intact, so later checks can incorrectly skip recovery. The repair and regression are recorded below. Post detail also renders the fallback
“Pantopus user” instead of the public Beacon author name; exact post content
is correct, but the native persona projection required the follow-up below. Neither
observation was covered by the backend repair. Physical Android remains untested.


The Android audience list retained C1 after blocking. Tapping that row showed
“Couldn't load this post” and “You don't have access to this post,” with no
post body. The direct API separately returned 403. Membership was restored.

## Android repair checkpoint

The follow-up clears the device-registration fingerprint at logout and before
a forced retry; a failed attempt cannot reuse an older acknowledgment. The
push syncer checks pending device registration even when its FCM token matches
the cached token, and foreground entry runs that check. Registration calls are
serialized; a response from an ended session cannot restore the fingerprint.
Post detail now decodes the public `displayName`, `handle` and `avatarUrl`
projection, matching the existing iOS decoder. All 86 targeted tests across six auth/device/push/post-detail suites pass,
including deterministic network failure and late response after logout.
The staging APK was built and installed; `ktlintCheck`, Detekt and Android
`lintDebug` pass. Final native evidence follows.

## Remaining Beacon preference contract

The current controls differ deliberately: per-Beacon notification off/mute
suppresses creation of that follower's notification; global push off retains
the in-app row and suppresses transport. A Beacon-specific **push-only** setting
is absent from the schema, authenticated preference API and native settings.
The remaining implementation should add an additive, default-enabled Beacon
push preference; apply it only to Beacon broadcast transport after the global
check; expose it consistently in web/iOS/Android notification settings; and
verify that off retains the audience row and exact permitted destination.
Restore must affect future sends without replaying suppressed notifications.

`supabase/migration-policy.json` is still in `legacy` mode, and
`scripts/db/check-migrations.cjs` rejects any new migration with “Finish baseline
adoption before adding migration.” Complete the isolated baseline-adoption
rehearsal and review its release contract before adding this schema/API/UI
change. Do not alter frozen migration hashes or use an unrelated mail/gig toggle
as a substitute. No schema change or production cutover is included in this PR.


## Final native check and cleanup

Android source revision is `58f1978e5751adea21dd24f5c55a792050215f3d`.
The updated staging APK SHA-256 is
`9a1b1b0e988531e070a3e091b20b2eecbb5dbedd02be73539da58fcc3d177a38`.
Normal native login registered one linked FCM token. The existing C1 exact
post now shows the public author “Beacon Journey Test.” A fresh background
publication, R1 (`23d3b8d8-202b-4873-81d0-deb8b3b38393`), generated notification
`01dc879f-b5a2-49a3-81c1-14ae753184bc`; FCM attempted/accepted one token.
Its visible notification opened “Android Beacon R1 — exact post” with the
correct public author on the updated APK. The transient-outage retry is covered
by deterministic JVM regressions; no new staging outage was induced.

Normal logout then removed the Android token. Scoped cleanup removed all 27
posts, 34 notifications, two Beacons, three memberships and the two new creator/
member accounts created in this run. Both original device test accounts and
their two prior notifications remain. The iPhone registration is unchanged.
Original global preferences are restored, and only this run's beta-list additions
were removed; the audience feature flag remains globally false. The evidence
IDs above are historical and no longer resolve to live test content.

The original production container/databases/DNS and all other worktrees remain
untouched. Private hierarchy captures, provider receipts, build/test logs and
cleanup counts are indexed under the private operator handoff. The source and
[PR checks](https://github.com/WangPantopus/skinny-pantopus/pull/10/checks) must
be matched separately from the deployed backend and tested native APK.

Remaining release evidence includes physical Android, the missing Beacon-only
push preference, denied OS permission, expired-session/login continuation and
other token-lifecycle states on the released builds. Publications here used
the actual authenticated creator API; native composer interaction and every
settings-screen control were not separately exercised. This report certifies
only the recorded staging cases, not full cross-platform release acceptance.


## CI isolation follow-up

The first native-source CI run hit an existing five-second timeout in
`tests/scout.test.js`: its no-external-data disclosure case made live Census/
FEMA requests. The test now supplies 503 responses and restores `fetch` afterward,
preserving the disclosure and question-list assertions without depending on
provider latency. All 38 Scout tests pass locally. This is a test-only change;
no Scout runtime or staged backend file changed. Consult PR #10 checks for the
final combined backend, image and Android jobs.
