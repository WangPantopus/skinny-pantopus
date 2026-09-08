# Android staging push and logout verification

## Tested environment

Real FCM notifications reached the existing **Google APIs ARM64 emulator,
Android 14 / API 34** (`Pantopus_Entry_API_34`). This is emulator evidence;
no physical Android phone was available. The staging debug app uses package
`app.pantopus.android.debug` and the private Firebase client configuration for
`pantopus-staging`.

The public staging API remained on backend release
`9d1fe24dc1f9ba4d6c07137405fa85b5b2cc3afb` throughout this run. Android started
from `b357d5c4b`, then was rebuilt with the two fixes in this report's commit.
No backend image, production database or production DNS change was needed.
No new paid resources were created.

## Live results

Only two synthetic staging accounts participated: the existing iPhone test
account sent messages through the normal chat API to the dedicated Android
test account. The sender was authenticated through the API; this did not test
the iPhone's compose UI. Both were the only active participants in room
`a704e09c-e384-43e0-a98c-4c92a0317ad2`. All three messages returned HTTP 201.

| Check | Evidence and result |
| --- | --- |
| Android login and registration | Actual app sign-in succeeded; staging stored one `android` / `fcm` token linked to a device, with global push enabled. |
| Background chat push | Message `ad2ab070-56e0-48eb-ac48-da40710cdd94`, sent at 07:37:16 UTC, appeared in the Android notification shade. Tapping opened the correct room and stored message. |
| Chat header encoding | The first tap exposed `iPhone+Staging+Test`. After rebuilding, the header displayed `iPhone Staging Test`. A separate supported link preserved `C++ Crew & café 50%`. |
| Global push opt-out | The authenticated preferences API disabled global push. Re-registering the same FCM token returned HTTP 200 and left the opt-out intact. Message `2f7527fc-240e-4d8b-b34f-33d3ff74e32d` was stored at 07:43:27 UTC; no Pantopus notification was observed at 07:44:15 UTC. This is a bounded observation, not a delivery receipt. |
| Restore and tap | The original global preference was restored to true. Message `63250df3-39b5-4eb1-87b2-6e4c761a07ee`, sent at 07:47:33 UTC, produced a visible notification. Its tap opened the same conversation, with the corrected header and all three messages visible. |
| Logout cleanup | Settings → Log out removed all push tokens for the Android test account. It initially showed an incorrect security warning; the auth fix below removed that warning. |
| Re-login and final logout | The final APK signed in through the UI and registered a linked FCM token again at 08:03:31 UTC. A second UI logout left zero Android account tokens and global push true. Fresh signed-out landing and login screens contained no security warning. |

The chat route sends push directly; it does not create an in-app `Notification`
row. These tests establish OS-notification → conversation behavior, not
notifications-list row navigation or Beacon publication. The chat sends did not
capture individual Google HTTP receipts; actual emulator display is the delivery
evidence. The separate earlier FCM validation-only request returned HTTP 200.

## Fixes and checks

Chat route builders now encode spaces as `%20` rather than form-encoded `+`.
Compose Navigation decodes URI escapes, so this preserves both readable spaces
and literal plus signs. All four chat entry builders use the same correction.

Voluntary logout now disconnects the socket before requesting server revocation,
ignores security-signout callbacks while that logout is underway or already
complete, and clears stale session-end reasons. Server revocation and local
credential cleanup still run. Genuine revocation of an active session retains
its security reason. Two regression tests cover a revocation callback before
the logout response and a late callback after logout.

Validation passed:

- 98 existing routing and notification-dispatcher unit tests after the header fix.
- 93 auth, authenticator and matching root-view-model tests after the logout fix,
  including both new regression cases; zero failures, errors or skips.
- Android `ktlintCheck` and staging `assembleDebug` after each code change.
- Emulator installation and fresh UI checks of the corrected chat header,
  special characters, re-login, token registration and neutral logout.

Private evidence contains unique, successfully captured UI XML, build logs,
APK hash and sanitized server checks. A failed UI dump can leave an older XML
file behind; only successful fresh captures were used for final assertions.
Credentials and raw tokens remain private and excluded from Git. Test messages
are retained in the isolated staging conversation for follow-up review; the
Android app is signed out and its original push preference is restored.

## Remaining coverage

Physical Android delivery, foreground and ordinary cold-start behavior, iPhone
chat/post destinations, category preferences, quiet hours, and the full
[Beacon journey](beacon-staging-verification-2026-09-07.md#full-beacon-journey)
still need verification. The global preference check used the backend API; it
does not verify the preferences screen. Android force-stop was not used as a
substitute for an ordinary cold start.
