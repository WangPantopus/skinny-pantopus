# Released-platform notification continuation

The Android emulator now passes OS notification permission denial and restore
against the live staging backend. This is separate from the completed Beacon
push-only preference acceptance. Physical Android hardware remains unavailable.

## Tested release and scope

- Android 14 / API 34, Google APIs ARM64 emulator, verified staging APK from
  `8022e9b05253a91a579f52e883e067514843234a`, SHA-256
  `8ec4055aed0fa4f5b604c0fe0e9d78326824baf75bc30864d23decf8a28baf97`.
- Live staging API/worker release `65d2cc2d9ab4857e044325315f0023a6d8f4bf54`.
- A fresh synthetic owner/Beacon has exactly one follower: the designated
  Android account, with one device-linked FCM token. No iPhone recipient.
- Global and Beacon push preferences both remain enabled. The account originally
  had no notification-preference row, so the default Beacon value is true.
- Global/internal Beacon enablement remains false; only this fresh owner and
  the designated Android follower were added to the beta audience.

## OS permission acceptance

| Action | Observed result |
| --- | --- |
| Deny Android POST_NOTIFICATIONS | Runtime permission false; package not force-stopped. The native “Don’t allow” prompt was also exercised when reopening the app. |
| Background publication P-denied | FCM attempted and accepted one token. No matching body or notification ID in system notification records at 72 seconds; notification shade had no Pantopus alert. |
| Open Audience → retained P-denied notification | Native post showed exactly “Beacon permission P-denied — quiet cedar” with public author “Beacon Platform Test.” |
| Restore the original OS permission | Granted true; original user-set/user-fixed flags restored. Global/Beacon settings remained enabled. |
| Background publication P-restored | FCM attempted and accepted one token; the new alert appeared in the system shade. |
| Tap the restored alert | Native post showed exactly “Beacon permission P-restored — bright maple” with the public author. |
| Check P-denied after restoration | At 324 seconds, no system record/body for the denied publication and no second provider send. |

Provider acceptance is recorded separately from visible system notification and
native post return. The original permission was enabled and is restored.

## Reproduced session-return failure

A third notification, “Beacon session S-revoked — violet bridge,” was published
once and confirmed present in the emulator's notification shade. The test selects
only the fresh native AuthSession created during this run and bound to its
registered Android device. Its server-side revocation leaves the AuthDevice and
other sessions intact. After the server revocation cache window elapsed, tapping
the real notification correctly showed sign-in and the security sign-out message,
without exposing the post. Signing back into the same account then settled on
the first-run Hub instead of the requested post. This tests terminal session
revocation; it does not certify natural access-token expiration or inactivity.

The router consumed the arrival on navigation before the API loaded the post;
auth teardown then cleared the deferred destination. The repair is isolated on
`codex/notification-session-return`, based on completed preference PR #12. It
retains an unfinished post arrival for the original account across server-ended
sessions. Successful load, departure and explicit logout clear the arrival;
another account cannot replay it. All 148 targeted JVM tests pass: 94 routing,
44 authentication and 10 post-detail tests. Coverage includes same-account
continuation, different-account discard, late completion, newer destinations,
manual logout and unchanged expiry. Formatting, Detekt, Android lint and the
staging APK build also pass. The final source-only lint annotation keeps arrival
completion with the router's account binding and does not change behavior.

The repaired staging APK, SHA-256
`759f52e7b1f391cd08cb3b9e129b653efc6143e3b91e251c5cb6eab48dc280d0`,
was installed without clearing app data; installed bytes and staging endpoints
were verified. A fresh S-repaired notification was visible before revoking only
the new native session. Other sessions and the AuthDevice were preserved.
After the cache window elapsed, the actual notification tap showed sign-in with
no post content. The native persisted arrival contained the exact post path,
original account and reauthentication marker. Normal same-account login then
opened exactly “Beacon session S-repaired — emerald harbor,” with public author
“Beacon Platform Test.” The persisted arrival cleared after the successful load.
FCM attempted and accepted one token, with no second send at 143 seconds.

This is live Android emulator evidence for terminal session revocation and
post return. It does not establish physical Android acceptance, iPhone live
session recovery, natural token expiry, or chat-session continuation.

## Evidence and cleanup

| Case | Post | Notification |
| --- | --- | --- |
| P-denied | `386b6ba4-b801-4dc6-b97a-12c361228ae3` | `c58805e9-f95d-467d-915e-89c5c4a6ae72` |
| P-restored | `41d262af-a687-46e5-addd-c4b6611f38dd` | `2a0a37c1-edc8-4f80-a919-ae7fa265c571` |
| S-revoked | `c07d9607-7958-403a-a653-99041795a567` | `781e28a7-3b3e-495f-82f4-1510c03b4d85` |
| S-repaired | `53996f93-2af6-4980-8e77-7f09a8d85b17` | `00d083ae-4863-4271-a276-8ec8b23ea44c` |

Scoped cleanup is complete: normal native logout removed the sole FCM token
and cleared the persisted arrival. The original OS grant/flags and preference
values are restored; the original account and AuthDevice remain. Four posts,
five notifications, the fresh Beacon/membership and creator were removed. All
IDs above are historical and must not be reused for another publication.
Global/internal Beacon enablement remains false, and the beta list is empty.
Private logs, APK/source fingerprints and fresh UI hierarchies are indexed in
the operator checkpoint. Final release-level platform coverage remains open.
The owned emulator is closed after cleanup.

The physical iPhone Beacon preference fixture is already cleaned up after
owner-confirmed off/restore/no-replay acceptance; see the
[preference report](beacon-push-preference-2026-09-08.md).
