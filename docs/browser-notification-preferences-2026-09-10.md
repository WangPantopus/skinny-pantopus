# Browser notification preferences and session changes — September 10, 2026

Browser operating-system alerts previously listened to `notification:new`. That
stream intentionally includes in-app updates when global or Beacon push is off,
so the browser could still show an alert for a suppressed mobile notification.
The server now emits a separate `notification:alert` event only after the same
current push-preference checks used by device delivery. Single, bulk and durable
paid-gig delivery all follow this rule. In-app rows, badge updates and live list
updates remain available when alerts are off. Restoring preferences sends no
historical alert. Unreadable global or categorized preferences cannot authorize
transport; absent granular preference rows retain their documented defaults.

The browser listens only to eligible alert events. It keeps a bounded 256-item
recipient/notification ID set to suppress repeated relay alerts during the
mounted session, including after the popup closes. Focused tabs do not alert.
Exact internal post links use the app router; malformed navigation cannot execute
an arbitrary location. Popups close and retained clicks stop working when the
opening account/session/API changes or the hook unmounts.

Cookie-authenticated sessions can have the same JavaScript `__session__` marker
after an account change. SocketProvider now observes both same-tab auth mutations
and cross-tab session-change signals, immediately retires the old socket and
reconnects even when that marker is unchanged. Late connection callbacks from a
retired socket cannot change the current connection state. Logout retires the
connection without creating another.

## Verification

- Seven React/socket integration checks cover in-app-only events, exact-post
  routing, duplicate delivery after popup close, focused/denied permission,
  same-tab and cross-tab cookie replacement, retained old callbacks, logout and
  malformed navigation. The full web run passes 1,089 checks; TypeScript reports
  zero errors and changed-file lint passes.
- Final isolated backend regression passes 4,833 checks with 16 existing skips;
  all privacy gates and their 15 audience-profile checks pass. The twelve new
  delivery checks cover single/bulk global and Beacon opt-out, restoration,
  durable wallet preference parity and all categorized preference read failures.
- The final backend snapshot uses committed `296ce1b8b` plus the two owned backend
  files, verified byte-identical to the reviewed source. Independent review
  passes for server eligibility, socket session retirement and browser behavior.
- Initial snapshot preparation omitted external repository fixtures; those were
  restored before the successful full run. One initial unrelated local socket
  hangup did not recur in that final unchanged-source run. No assertion was
  relaxed and no test was disabled.

Private logs: `/private/tmp/pantopus-desktop-alert-web-full-r1.log`,
`/private/tmp/pantopus-desktop-alert-web-types-r1.log`,
`/private/tmp/pantopus-desktop-alert-backend-full-r2.log` and
`/private/tmp/pantopus-desktop-alert-privacy-r1.log`.

## Verification limits and next work

These are source-level browser/socket and backend integration checks with
controlled transport. The combined candidate still needs an actual browser
journey and final-head CI. No browser production deployment, physical device
update or provider operation ran here. The browser cache is bounded and not
persistent across application restart; underlying provider delivery remains at
least once after an uncertain acknowledgement. Financial receipts and stored
in-app notification uniqueness are unaffected. The already-completed physical
Beacon and saved-card acceptance must not be repeated.
