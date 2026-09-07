# Beacon return journey

Implemented September 6–7, 2026.

Continues the social discovery work: a creator publishes an update, a follower sees permitted content in Following, and either Following or an audience notification opens that post.

## Behavior

- Following previews and unread counts now apply audience and tier restrictions. Draft and archived updates are excluded. Pending/expired memberships and explicit Beacon blocks cannot expose previews. A failed block/content lookup returns a retryable error instead of an empty success.
- Broadcasts and ordinary persona-post fanout share recipient selection. It respects active/past-due membership, notification opt-out, temporary mute expiry, tier rank, and explicit blocks. Permission lookup failures suppress the notification. Historical subscribers retain the existing Member-rank compatibility behavior.
- A seven-day mute silences notifications. It does not hide permitted updates or unread counts. Native Following shows “Muted,” keeps the content legible, and opens the existing preference sheet when that control is tapped. Expired mutes resume normal presentation.
- iOS and Android Following expose a separate **Read update** action wired to the latest permitted post ID. Profile navigation remains available. Selection mode hides the read action. Opening one post does not mark every update from that Beacon as seen.
- Web Beacon discovery supports dotted handles and includes a direct audience Notifications link. Existing notification route resolution continues to open the published post.
- Once an update is stored, a notification-hook failure no longer makes publishing return an error that encourages a duplicate retry.

Home/address verification and Home intelligence are unchanged. Beacons remain usable without a home address. The publish-to-read test also verifies that a broadcast without an explicit place tag stores no home ID or coordinates.

## Validation

The route suite exercises real Express publish, mute/unmute, Following, and post-detail handlers, plus real notification serialization/persistence, against the repository's in-memory database and mocked push transport. It verifies exact post IDs, audience identity, permission revocation after a notification was created, blocks, tier restrictions, notification outages, and unavailable lookups. It sends nothing to real people.

Native projection tests cover muted unread updates, mute expiry, and the post ID retained for navigation. The iOS app journey uses an isolated HTTP fixture; Android uses the production Following row on an emulator. Existing deep-link tests cover the notification destination.

- Backend: **95 tests pass** across seven suites (the final journey suite includes seven cases).
- Web: **24 tests pass** across Beacon directory, arrival, notification routing, and notification streams.
- iOS: **60 unit tests and two app journeys pass** on iPhone 17 / iOS 26.5. Following and post-detail screenshots reviewed; the redundant native navigation bar on post detail was removed.
- Android: **92 unit tests and one emulator interaction test pass** on API 34. The interaction test distinguishes opening a post from opening the Beacon profile and verifies selection-mode behavior.
- Targeted Kotlin lint and web ESLint pass. Both native app builds succeed.

The web type-check gate still reports the same six pre-existing signatures recorded in the social discovery note: nearbyCells TS2305, NearbyCellsMap TS2724/TS7006, and TS2741 in the two place development pages and placeGroupDetail test. No type-check baseline was changed. Targeted SwiftLint retains one existing HubTabRoot trailing-closure warning.

## Release limits and next work

This is local validation, not a deployed or production-device push-delivery check. Staging should exercise actual PostgREST joins/RLS, creator publishing, follower notification preferences, and background/terminated-app notification opening on physical iOS and Android devices.

The existing Following implementation samples recent posts with a global over-fetch limit and caps each Beacon at 25. Under uneven posting volume or many restricted updates, older permitted posts can be absent from the sample. Exact per-Beacon latest-post/unread retrieval remains a separate database query improvement.

Broadcast delivered_count remains an eligible-recipient estimate; this work does not introduce delivery receipts, notification retries, or exact read analytics. Legacy Settings/YouTabRoot placeholder navigation remains the separate cleanup already recorded in the social discovery note.
