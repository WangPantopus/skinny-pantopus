# iOS exact Home task notification routing

Status: verified source checkpoint, September 10, 2026.
This follows the retained task form checkpoint `f24785404` and the durable
assignment outbox `92a35b7f9`. It does not complete private attachments or hosted
household acceptance.

## User behavior

Task-assignment and task-completion notification metadata selects the exact Home
and task before the legacy dashboard link. The notification list and push-tap
handler share the same UUID-validated canonical path:
`/app/homes/:homeId/tasks/:taskId`. Custom-scheme and HTTPS links resolve to a
typed Home task destination. Invalid or incomplete task paths cannot silently
open a different Home screen; older valid dashboard links retain their behavior.

The Place stack opens the existing read-only task detail. Both existing Home
entry points still use this same detail and its permission-checked edit action.
No notification payload supplies task content or grants access. The detail reads
its exact current task and server session through the existing access client;
lost access, missing records and session changes cannot reveal cached task data.

An incoming task route survives navigation consumption until that exact detail
loads, denies access or is left. Signed-out links wait for login. A link received
under an existing account is retained only for that account's unfinished arrival;
another account cannot replay it. Exact arrival completion uses the existing
protected pending-link path and reauthentication guard.

Task notification list rows require the opening current session, matching
personal recipient and personal context before selecting a route. The queued
mark-read action checks that scope again. Marking a row read preserves its task
metadata so a later tap still opens the same exact task. Other notification types
retain their existing routing and display behavior.

## Verification

The ten-file Swift source candidate passes SwiftFormat, strict SwiftLint with
zero findings, Swift parsing and whitespace checks. Independent source review
passes, including the exact route, current recipient/session checks, queued
mark-read guard and retained arrival path. The actual app build and all **132
executed cases** in the six affected suites pass with zero failures.

The actual executed counts are 11 new typed task route tests, five new
notification-row tap tests, 54 existing router tests, nine Place router tests,
26 existing notification view-model tests and 27 task access/action tests.
The initial static source inventory overcounted router cases; 132 is the actual
app result, rather than that earlier estimate.
The new cases cover flat/nested metadata, uppercase UUID normalization, malformed
paths, legacy dashboard compatibility, signed-out login replay, wrong-account
replay denial, exact arrival completion, stale-session/recipient taps, a queued
mark-read after session replacement and metadata preservation after marking read.
The run ended with `TEST SUCCEEDED`; no runtime source change was required
after the frozen candidate passed its app checks.

Private operator manifests and logs are retained outside Git:
`/private/tmp/pantopus-home-ios-task-notification-files.txt` and
`/private/tmp/pantopus-home-ios-task-notification-r1.log`.
The source aggregate (manifest path, NUL, file bytes, NUL for each entry) is
`8228986731e3a405524d8f1c6754b66d3e17cbc1c38f509fff440abba7611952`.

## Remaining work and acceptance limits

- Private task attachment listing, immutable upload retries, current exact byte
  previews and removal controls are the next native slice.
- Installed notification arrival and tap acceptance remain separate from app
  unit/build coverage. This milestone changes no owner-phone installation,
  APNs configuration or hosted data, and does not repeat completed Beacon tests.
- Delivery remains at least once at the existing outbox/provider boundary.
  Navigation adds no exactly-once delivery or device deduplication promise.
- Automatic recurring-task generation, other ownership/relationship workflows
  and full Home release acceptance remain unfinished. Paid dependencies stay
  together for final launch preparation.
