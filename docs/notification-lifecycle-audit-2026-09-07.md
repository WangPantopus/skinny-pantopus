# Notification lifecycle audit while staging access is unavailable

This is a focused audit of token registration, saved notification preferences,
Beacon post links and session boundaries on master
`e30e76036a89c49fd3a27c1bdaff1fa5cd147424`. It is not a full-product launch
sign-off. No AWS login, production access or live push send was needed.

## Fixed: registration undid the user's push opt-out

Both `POST /api/notifications/register` and the legacy `/push-token` endpoint
unconditionally upserted `MailPreferences.push_notifications=true`. Native
registration happens automatically on app open/token rotation, so registration
could undo a saved opt-out without the user changing notification settings.

The endpoints now initialize a missing preference row using conflict-ignore
semantics. Existing values and timestamps are preserved, including when a
settings write runs concurrently. Token registration still succeeds, and the
normal settings endpoint remains responsible for explicit opt-in/opt-out.
In-app notification persistence remains independent from device push settings.

The iOS APNs registration log also no longer records the raw device token.

## Verification

- Regression tests reproduced the original unwanted push after opt-out on iOS,
  Android and legacy registration before the fix.
- 18 regression cases now cover first registration, preserved enabled/disabled
  preferences, token rotation, single/bulk in-app notifications without push,
  and explicit opt-in restoring push.
- Full backend Jest suite: **4,281 passed, 16 skipped**, 274 passing suites.
- All repository privacy gates passed.
- Actual Express registration handlers were also exercised with the real
  Supabase SDK against disposable PostgreSQL 17/PostgREST 14 containers. All
  three registration cases preserved an existing opt-out and its timestamp,
  and an explicit opt-out survived a concurrent registration. Authentication
  and the token transport were stubbed; no production database or APNs/FCM
  transport was contacted. The disposable containers were removed afterward.
- Strict SwiftLint passed for the changed iOS file. The change removes a log
  field only; no new native build or physical-device behavior is claimed.

The database mock now honors `ignoreDuplicates` so the regression tests model
the same conflict behavior as PostgREST. No migration is required.

## Remaining evidence

Code tracing found existing handlers for `/post/:id` and `/posts/:id` on both
native clients, deferred post-login navigation, and clearing pending links at
sign-out. This review does not replace physical cold-start/tap testing or prove
every session/network interruption path works.

After account access is restored, finish the
[staging verification journey](beacon-staging-verification-2026-09-07.md):
provider acceptance and displayed notifications on real iOS/Android phones,
foreground/background/normal-termination taps opening the exact post, token
revocation at sign-out, and mute/membership/revoked-access cases against the
actual staging database. Keep those cases marked unverified until exercised.
