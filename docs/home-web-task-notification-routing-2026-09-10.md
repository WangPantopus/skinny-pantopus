# Browser exact Home task notification journey

Verified local checkpoint, September 10, 2026. This follows the durable Home
assignment outbox `92a35b7f9`, retained native task forms and iOS exact notification
routing. It does not complete full hosted household or browser OS acceptance.

## Current behavior

Task-assignment and task-completion metadata selects the exact Home and task
before an older dashboard link. The notification bell, full notification list and
browser alerts share `/app/homes/:homeId/tasks/:taskId`. The destination reads the
current profile, exact task and matching server session before exposing content.
Notification payloads supply identifiers only; they do not grant access or supply
the displayed task text. Existing private attachments use that same verified
opening scope.

The detail clears task content and attachments when hidden, navigated away from,
or when the account/session changes. Returning makes a fresh authorized read;
an outstanding old response cannot repopulate the page. Denied or missing tasks
show an unavailable state without task content. The page is read-only; existing
Home task forms remain the editing surface.

A notification tap verifies the current recipient and captures the opening
credential marker, API origin and view lifetime before its first asynchronous
read. A delayed mark-read cannot navigate after logout, another account/session,
a hidden tab or a departed view. Internal route validation rejects unsupported
schemes, protocol-relative paths, backslashes and unsafe encoded paths; there
is no raw-link fallback into router navigation.

In-app `notification:new` events still arrive with push disabled. Only a separate
server preference-checked `notification:alert` can produce a browser OS alert.
The shared single/bulk path and durable Home assignment delivery honor global and
type opt-outs; an assignment made while disabled does not replay when restored.
Preference-read errors cannot establish permission to alert. These shared alert
and socket-session changes carry over the reviewed payment-branch implementation,
with the Home outbox connected to the same event and retained intact.

Cookie-backed login replacement immediately retires the old socket and its
alerts. Display and click also reread the synchronous storage marker so an old
callback cannot race ahead of a queued cross-tab storage event. Late events from
retired sockets cannot alter the current connection state. Alert ID deduplication
is bounded and lives in memory; it is not an exactly-once device guarantee.

## Verification

- Complete browser regression: 1,145 passing checks across 90 suites. Actual bell
  and list components cover exact task opening, recipient rejection and delayed
  mark-read after session replacement or leaving. The detail checks cover current
  task identity, access denial and hidden/in-flight/return behavior.
- Type checking: zero errors. Browser lint: zero errors, with 1,171 existing
  repository warnings; no warnings identify the new detail, tap hook or modified
  socket/desktop hook. No baseline or lint rule was relaxed.
- Full backend run: 5,134 passing checks, 16 skipped and one HTTP parsing error in
  the existing audience-membership route suite. Its unchanged affected recheck
  plus notification delivery/preferences passed all 55 checks across four suites.
  No cause is claimed for that broad-run HTTP failure. All privacy gates passed.
- Independent source review passed after repairing the queued cookie-marker edge,
  delayed notification tap and unsafe-link fallback. It covered the current exact
  task/session binding, access hiding and preference-aware alert delivery.
- Actual Chrome rendered-app acceptance used only synthetic replies on localhost
  and the configured loopback API origin. The real notification list marked the
  row read and navigated to the exact task; revocation followed by reload hid its
  private content; an actual second-tab session-marker change cleared the open
  task. The screenshots were visually inspected. No hosted API was contacted.

Private browser evidence is under
`/private/tmp/pantopus-home-task-notification-browser-*`, including the acceptance
harness, result JSON and exact/denied screenshots. Focused/full browser, backend,
typecheck, lint and privacy logs use the same private checkpoint prefix. The
temporary dev server was stopped and its generated output/config change removed.

## Remaining boundaries

This checkpoint does not certify a physical device, a real browser OS popup, or
provider delivery. The outbox/provider boundary remains at least once; browser
memory deduplication does not survive reload. Full notification-list cache
lifetime across account changes remains a separate platform coverage item; exact
task content and the guarded interaction are checked here.

The browser's existing task creation/editing forms still need the same stable
creation receipt and sparse-edit contract now implemented by the native forms.
Native private task attachments, installed full household acceptance, automatic
recurrence, relationships/ownership and remaining release work remain open.
All paid subscriptions and dependencies stay together for final launch preparation.
No owner-phone installation, hosted migration or paid service changed.
