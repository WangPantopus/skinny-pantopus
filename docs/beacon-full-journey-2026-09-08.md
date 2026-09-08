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

## Next action and limits

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
