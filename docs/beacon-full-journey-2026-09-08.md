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
