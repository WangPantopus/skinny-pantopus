# Deep-link diagnostics privacy

The iOS router previously recorded the full incoming URL and the resolved
destination's associated values. Password-reset and email-verification links
can contain authentication tokens; invitation links, home links and chat links
can also contain private values. The same full URL was passed to
`Observability.track`, which writes a diagnostic log and, when configured,
a Sentry breadcrumb. The notification-tap handler separately logged its link.

The router now records only its fixed routing category: `authOwned`, `content`
or `discard`. Notification taps record the event without the link payload.
The original URL and destination still go through normal navigation, including
auth handling and deferred post-login routing. OAuth callbacks continue to
bypass the content router. No historical log deletion or external disclosure
assessment is claimed by this source-level fix.

Regression coverage exercises reset/verification tokens, join codes, invitation
tokens, post/chat/home identifiers, unknown URL credentials/query/fragment data,
OAuth callbacks, and signed-out deferred navigation. It checks both that the
diagnostic output contains only the category and that navigation retains the
values needed to open the correct destination.

Local validation passed: 101 tests across the diagnostics and existing routing
suites on the iOS 26.5 simulator, plus strict SwiftLint and SwiftFormat checks
for the changed code. No test credentials or live push providers were used.

This change is independent of PR #6's push opt-out fix and APNs token-log
removal. It requires no database migration or cloud configuration. Physical
push delivery and the broader staging acceptance journey remain unverified.
