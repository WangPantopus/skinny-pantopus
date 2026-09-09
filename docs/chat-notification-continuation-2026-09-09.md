# Chat notification session continuation

Both native routers previously discarded a signed-in chat destination when
navigation consumed it, before the first message request completed. New iOS
and Android regressions reproduced a missing durable path. If that request
ended the session, login could therefore lose the intended conversation.

## Repair

Post and chat arrivals now share the existing account-bound, 24-hour pending
store. They remain pending until permitted content loads or the screen is left.
Server-ended sessions preserve only their original account's unfinished
arrival. Manual logout, another account, and expiry clear it. Late callbacks
cannot erase a newer arrival or one awaiting reauthentication.

iOS tracks the active content destination to suppress duplicate auth-state
replay. The conversation screen reports successful loaded/empty states and its
navigation host reports departure. Android does the same through the chat
host. Android completion matches the room ID independently of an optional
notification title, preserving titles containing `+` during replay. A post and
a chat sharing the same textual ID cannot complete each other's arrival.

## Verification so far

- Both baseline regressions failed as expected; Android repeated the same
  missing-path failure three times under the configured test retry policy.
- iOS: 220 unit tests pass across routing, auth, refresh/resume, private-place
  arrival and the chat model. Six new chat continuation cases bring the
  session-return class to 18 cases.
- Four actual iOS simulator UI journeys pass: post and chat return after each
  of ordinary expiry and security revocation. They verify the reason banner,
  hidden content before login, and exact content after signing back in. The
  chat marker is **Chat return — violet compass**.
- Android: 190 targeted tests pass: 100 router, 44 auth, 34 chat model and 12
  notification dispatcher tests. Six new chat cases cover retention, account
  ownership, late completion, optional titles and cross-destination isolation.
- Android ktlint, Detekt, staging lint and APK assembly pass.
- Live staging/FCM acceptance passes on the owned API 34 emulator. One message,
  **Chat check A1 — sapphire bridge**, produced an actual system notification.
  Only that fresh Android session was revoked. Tapping the notification showed
  the security sign-in reason with the message hidden; normal same-account
  login opened the exact conversation, author and message.
- The native pending store retained the account-bound room before login and
  cleared after content loaded and after normal logout. Server unread count
  became zero. The original session remains revoked; the parked iOS session
  was preserved. Logout removed all fixture FCM tokens, and the fresh follower's
  global push preference was restored off. The owned emulator is closed.

The live Android build is source `699c531a86a286803fb8832aa1e0fc563f977b41`,
APK SHA-256 `8f45829c3cb67f2f7ea5f7132813209381781ea93086aab962f937c0802af28e`.
Its API/Socket URLs and Firebase project were verified as staging before install.
The synthetic direct room and single message remain with the isolated Beacon
fixture for the remaining checks; never resend the same marker.

The iOS UI cases use the opt-in Debug API fixture with fake credentials. They
exercise native screens and API-client/session behavior, not live APNs or
elapsed hosted expiry. The separate native Beacon fixture is parked for the
latter. Detailed private results remain under `ios-continuation/` in the
durable recovery root. No physical iPhone observation is pending.
