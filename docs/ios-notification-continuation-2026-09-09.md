# iOS notification session continuation

The iOS router now keeps an unfinished post arrival for the original account
until content loads or the user leaves. A server-ended session retains that
arrival through sign-in; explicit logout, another account and expiration clear
it. This continues the merged Android repair without repeating completed
physical iPhone Beacon preference acceptance.

## Reproduction and repair

On merged master, a new regression consumed an incoming post link and found no
durable destination before the content request completed. The regression failed
as expected. The repair stores the path with its account and 24-hour timestamp,
retains only that account's arrival during server teardown, and ignores late
completion callbacks while reauthentication is pending. Navigation consumption
does not count as successful arrival.

Actual iOS simulator screens exposed a second issue: the post's sheet was still
dismissing when the signed-out landing screen attempted to present its login
cover. The user landed at the address funnel despite the correctly retained
post. RootView now renders the existing login screen directly after a server
session end. The form remains selected when its reason banner is dismissed.
Voluntary logout still uses the normal signed-out landing screen.

A queued auth-state replay could also encounter a post link already dispatched
by the restored session. The router now tracks an active post arrival in memory
so that replay does not navigate to the same post twice. A new process can still
replay the persisted destination.

## Verification

- The initial failing regression is retained in the private evidence.
- 177 targeted tests pass: 108 routing/arrival tests, 60 auth/refresh/resume tests
  and nine private-place arrival tests. The routing count includes 12 new
  session-return cases covering account ownership, concurrent teardown, manual
  logout, late completion, newer links and unchanged/expired TTL.
- On iPhone 17 / iOS 26.5 Simulator, the real app screens with an isolated API
  fixture reject both the post read and token refresh. Ordinary expiry and
  security revocation show their respective messages, hide the post before
  sign-in, and return to the exact park-cleanup post and author after login.
  Both cases also pass after dismissing the session-reason banner, keeping the
  form available and preserving the requested post.
- Six existing entry/Beacon UI journeys pass, including signup/verification
  interruption, save retry, explicit following, muted Following return,
  address-free discovery and ordinary post-login return.
- Strict SwiftLint, SwiftFormat and the icon/overline guards pass.

The API fixture uses fake credentials and is available only in Debug with
explicit UI test flags. These cases establish native navigation and API-client
behavior; they do not establish live APNs delivery, elapsed hosted token expiry
or physical-device acceptance. The owner authorizes simulator continuation.
Live native composer publication is the next case, using fresh staging accounts
with device push disabled. No iPhone observation is pending.

Private build logs, failing/passing test results and fixture state are under
`ios-continuation/` in the durable recovery root. The active fixture is separate
from the already cleaned physical iPhone and Android acceptance fixtures.
