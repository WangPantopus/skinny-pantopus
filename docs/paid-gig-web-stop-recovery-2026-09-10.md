# Browser task cancellation and recovery — September 10, 2026

Both active gig detail pages now share one task-action dialog. Cancellation,
reopening bidding and worker release first read the current actor, session and
task/payment terms. A successful HTTP response is insufficient to report
completion: the original request and exact resulting task/financial receipt
must match. Unavailable actions and unconfirmed fees remain explicit.

The browser saves only the request UUID and original nonsecret terms before
submitting. Closing the dialog or reloading preserves an unknown operation.
Status reads never mutate the provider. Explicit retry uses the same request,
reason and terms with the opening server session proof. A freshly authorized
session for the same actor can recover the request; stale screens retire before
another command or late response. The synchronous local session-change marker
also catches replacement before a delayed cross-tab event arrives.

An empty status result never authorizes a new UUID. A competing preview permits
only an explicit retry of the original request. The dialog adopts another request
only after a protected `STOP_ACTIVE` conflict and a verified read of that exact
operation. Its original actor and server retry permission still apply. Completion
clears only matching local recovery data. Escape dismissal, focus containment,
focus restoration and scroll locking are included.

The named TypeScript cancellation/reopening/release methods now require the same
typed command and return pending/completed progress. Two unused duplicate
cancellation implementations were removed after confirming neither had repository
consumers. Both live layouts use `CompletionFlow` and the common dialog.

## Verification

- Independent review passed, including the final session-marker and competing
  request recovery changes.
- Complete web regression: 1,158 passing cases across 86 suites. Final affected
  recovery checks: 22 passing cases after the visible session-retirement refinement.
- Type checking passed; changed components have zero lint errors. Seven existing
  `any` warnings remain in `CompletionFlow`; the new modules have no lint findings.
- Actual installed Chrome ran the production React component against an isolated
  local HTTP oracle. A retained request followed by HTTP 503 remained unconfirmed,
  survived close/reopen and full reload, retried identical command data, and
  showed completion only after the exact receipt. Recovery storage cleared after
  confirmation. Same-cookie session replacement blocked a new command before the
  storage event, and Escape closed the retired dialog. No uncaught browser error
  occurred. The completion view was visually inspected.

The browser rehearsal used synthetic HTTP replies and simple harness styling.
It does not certify the hosted backend, actual payment provider, production CSS
or full end-to-end paid-task acceptance. Private operator logs retain the browser,
regression and type/lint evidence; no credentials or provider secrets were saved.

## Remaining integration

The matching stop backend/migration remains under final verification in draft
PR #34 and must deploy with these clients. Native parity, started-work/no-show/
fee execution, disputes, Connect/debt, remaining durable attention and complete
provider acceptance remain open. The separate task-stop backend report records
its actual service/database evidence. Paid dependencies stay deferred together
to final launch preparation.
