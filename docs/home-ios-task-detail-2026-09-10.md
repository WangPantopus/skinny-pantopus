# iOS Home task browsing and current actions — September 10, 2026

## Milestone scope

The Hub and You task lists now open an exact task detail screen. Read-only task
access does not route through the editing form. Creation controls require the
collection's explicit `can_create`; completion, deletion and editing require the
exact record's corresponding capability. Missing capabilities confer no action.
The existing private creator path continues to use the server task contract
without synthesizing general Home membership or owner authority.

A task access client captures the opening account/session and fixes the first
valid server `task_session` proof. Later reads and writes send that proof, use
non-cacheable requests, and validate the exact Home/task response. Completion
checks the current record before its PUT and rereads current capabilities after
it. Deletion requires the actual `Task deleted` response. Unknown or denied
actions clear the prior snapshot instead of restoring optimistic content.

Create and edit navigation recheck current server capabilities. Callbacks execute
on the main actor immediately after the final lifetime check. Leaving the screen
or backgrounding clears visible records and invalidates pending reads/actions;
late responses cannot publish private content or navigate. Resuming rereads with
the original session proof. Session replacement permanently invalidates that
screen's access client.

## Verification

- Swift parser, SwiftFormat and strict SwiftLint pass for the exact 11 Swift
  files; zero lint violations.
- 27 new behavioral tests cover read-only and unknown capabilities, exact
  identity/session/record binding, revocation before mutation, current response
  checks, malformed deletion, fresh create/edit navigation and leaving while
  reads or navigation checks are suspended.
- The 32 existing task-list tests now use actual authorized collection/session
  fixtures. The previous optimistic rollback assertion now requires denied
  access to clear the snapshot without a PUT.
- The final actual iOS app build passes **75 tests with zero failures**: 27 task
  access/lifetime, 32 task-list and 16 existing form tests. Evidence:
  `/private/tmp/pantopus-home-ios-task-detail-r2.log` (exit 0).
- The first compile caught closure typing/capture errors; those are repaired.
  Independent review also found queued activation could run after disappearance;
  activation and Retry now check a captured lifetime revision and current
  view/scene inside the scheduled task, with two regression cases. Final
  independent source review passes with no outstanding finding.
- Exact Swift source manifest: `/private/tmp/pantopus-home-ios-task-detail-files.txt`.
  The 11-file frozen aggregate is
  `eacd75b2dc3dc3e580fa4c5d99c24763f4265434b03ce44f369b6347f1763ec7`;
  individual hashes are in `/private/tmp/pantopus-home-ios-task-detail-frozen.sha256`.
  Source plus this report: `/private/tmp/pantopus-home-ios-task-detail-owned-files.txt`.
- No backend, SQL, hosted data, role grants, providers or subscriptions changed
  in this native checkpoint.

## Remaining acceptance

This is the browsing/current-action checkpoint, not the full native task journey.
The existing creation/editing form still needs the committed `170000` retained
request contract, exact receipt recovery, form session/lifetime protections and
private attachment upload/list/read/retirement. The form is reachable only after
a current capability check from these list/detail controls, but it does not yet
maintain that check throughout its own lifetime. Task detail currently displays
text and schedule fields; private media is not yet rendered. Installed-app
visuals and cross-role household acceptance remain open.

Task assignment notifications remain best-effort after task creation. A separate
`180000` durable assignment outbox is planned after the native checkpoint. No
claim of durable create-to-notification acceptance or full Home release is made.
