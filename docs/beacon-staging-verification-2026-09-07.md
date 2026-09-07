# Beacon notification staging verification

## Current readiness

For the latest infrastructure inventory and explicit native staging build
commands, see [staging notification setup](staging-notification-setup.md).

The master integration commit `4172e37fcacead6cb3cea1e6c1398604b7f356fe`
passed the complete [PR #4 CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34142598999),
including the web type-check gate, backend/privacy tests, Android build and
emulator tests, and all three iOS simulator test jobs.

Read-only inspection on September 7 found:

- GitHub's `staging` environment exists, but `BACKEND_DEPLOY_ENABLED=false`.
- It has no environment secrets and no recorded staging deployments.
- Local backend `.env` targets local Supabase; native development builds target
  local network/emulator API addresses. A separate hosted development database
  is configured in `.env.dev`, but it has not been designated for this test.
- The committed Android `app/google-services.json` remains a placeholder.
- Local no-send checks return exit 1 for both APNs and FCM: credentials are
  absent from the active local backend configuration.
- No dedicated test accounts or physical device tokens have been designated.

Live delivery is **unverified**. No live notification, deployment, or database
change was performed during this readiness check. Use the existing deployment
procedure in [ci-cd.md](ci-cd.md) if staging must be provisioned; migration
execution remains governed by the repository's baseline-adoption policy.

## Configuration check that sends nothing

Run from `backend`, in the intended staging runtime or with its explicit env
file. The script loads `.env` by default; `DOTENV_CONFIG_PATH` selects another
file. Existing process environment variables retain dotenv's normal precedence.

```sh
node scripts/push-smoke.js --check --platform ios
node scripts/push-smoke.js --check --platform android
```

Exit 0 means the selected provider's configuration fields are present (or the
legacy Expo provider is enabled). It does **not** validate credential authority,
the Android client Firebase project, network reachability, token registration,
or device delivery. Missing configuration returns 1; invalid arguments return 2.
This mode never calls a transport sender.

Before the device test, point the web/native apps and API at the same staging
release, install a real Firebase configuration for the Android build, and wire
APNs/FCM server credentials as described in
[push-native-migration.md](push-native-migration.md#6-environment-variables).
Match the APNs endpoint to the installed app's signing environment.

## One-device transport check

Use only a designated test device and account. Let that app register its token
through `POST /api/notifications/register`. Confirm the saved provider/platform
and device association without copying tokens into shared logs or this document.

Load that device's token into `PUSH_SMOKE_TOKEN` from the team's secret store.
The environment variable avoids including the token in process arguments.
For a published test post accessible to that follower, run:

```sh
node scripts/push-smoke.js --platform ios --link /post/TEST_POST_ID
node scripts/push-smoke.js --platform android --link /post/TEST_POST_ID
```

Each invocation sends one real notification to its configured token. Run the
command only for the platform/device currently under test, replacing the post
ID and token for that test. There is no automatic retry.

Exit 0 requires explicit acceptance of that exact token: HTTP success from
APNs/FCM or an Expo ok ticket with a receipt ID. Authentication failures,
timeouts, throttling, invalid tokens, and unconfirmed sends return nonzero.
Provider acceptance still requires checking display and tap destination on the
physical device. An Expo ticket is acceptance by Expo, not an APNs/FCM receipt.

This raw transport check bypasses notification persistence, membership rules,
and user preferences. It cannot establish that the Beacon journey works.

## Full Beacon journey

Use a dedicated creator and follower with no unrelated followers or registered
devices. Add a separate test member only for the restricted-content cases; use
the established staging membership fixture/payment sandbox, never a real charge.
Record the release SHA and the test post ID for each case.

| Case | Action | Required evidence |
| --- | --- | --- |
| Address-free entry | Sign in as the follower without adding a home; discover and follow the test Beacon. | Pulse/Beacon entry and Following work without an address prompt; creator identity remains public persona data. |
| Publish and return | Creator publishes a followers-only broadcast with unique test text. | Publish returns one stored post; Following `latestPost.id`, audience notification `/post/<id>`, and opened post all refer to that same ID. |
| Real database | Inspect API results from the deployed staging service. | Actual PostgREST persona/tier joins resolve; drafts, archived posts, blocked viewers, and inactive memberships do not leak through lists or post detail. |
| In-app notification | Keep the follower signed in with the audience notification stream open, then publish. | Notification appears in the audience stream; its link opens the exact permitted post. Personal notifications do not receive the audience item. |
| Physical device | Repeat publication with the iOS/Android app foregrounded, backgrounded, and normally terminated. | Record provider acceptance separately from visible notification, then verify the tap opens the exact post. Record OS/device/build. Android force-stop is a separate state, not an ordinary termination test. |
| Mute and resume | Mute the Beacon for seven days, publish, then unmute and publish again. | Muted publication remains readable in Following with unread information but creates no follower notification. The new unmuted publication produces a notification. |
| Preference opt-out | Disable Beacon notifications, then separately test global push and this notification type's push setting. | Beacon opt-out suppresses fanout; global/type push opt-out suppresses device push while stored in-app notification behavior remains intact. Restore settings between cases. |
| Restricted update | Publish a Member-rank update with free follower and eligible test member present. | Only the eligible member sees the restricted Following update and receives its notification; direct free-follower read is denied. |
| Revoked access | End the test membership or block the test follower after a notification exists; tap that older notification. | The server denies access on read; an old notification does not grant permission. A blocked viewer receives no new updates. |

Capture only sanitized IDs, HTTP status, timestamps, app state, and screenshots
of test content. Keep credentials, device tokens, home addresses, and private
account names out of the report. After verification, remove test posts, restore
test notification preferences, and sign out/unregister only the designated
devices using the normal app flow.

## Acceptance and limits

Call live Beacon delivery verified only after both physical platforms pass the
publish → Following → notification → exact-post journey, the permission cases
pass against the real staging database, and evidence is recorded for the
tested commit. Report any unavailable state/platform as unverified.

`BroadcastMessage.delivered_count` remains an eligible-recipient estimate.
Following now selects permitted updates per Beacon before applying its 25+
unread cap; see [the activity-query validation](following-activity-reliability-2026-09-07.md).
The count remains capped rather than lifetime-exact. The transport change adds explicit acceptance results for the
smoke tool; it does not add delivery receipts, retries, or durable analytics.

Local validation of this follow-up passes 114 tests across 11 push, Beacon
journey, recipient-selection, device-registration, and notification-context
suites. The transport tests simulate provider success, OAuth/APNs auth errors,
throttling, network failures, and invalid tokens without live network sends.
