# iOS task cancellation and recovery — September 10, 2026

The four task actions—cancel, close, reopen bidding and leave an assignment—now
use one current-term recovery sheet. The old direct mutation/success methods
were removed from task detail. Closing uses the protected stop command and keeps
its receipt. Rescheduling remains a separate existing task action.

The sheet reads current task/payment terms and binds its opening account, local
session, API origin and first server session proof. It saves one UUID and the
original typed terms before POST. Only an exact completed receipt establishes
success; every task, payment, participant, amount, currency, action and financial
outcome must match. Missing or changed terms, denied access, session replacement
and late responses cannot produce success. Pending/review states remain visible.
No fee is fabricated from a failed preview or described as charged.

Recovery storage is protected, atomic and excluded from backup. It contains only
the original nonsecret command fields, never session proof or provider secrets.
A different action or a fresh login for the same actor recovers the original
request. A missing GET result cannot erase it. Only an explicit same-ID retry
and protected `STOP_ACTIVE` conflict, followed by a validated read, can adopt a
competing operation. Another original actor may read the authorized status but
cannot retry it. Completion clears only matching local recovery data.

A saved Task action status entry remains outside the ordinary task-detail state.
It therefore survives cancellation, loss of the worker role or unavailable raw
task details. Storage errors remain visible instead of becoming an empty state.
This entry only recovers a saved action: disappearing storage cannot turn it into
a new cancellation. The protected status endpoint still checks current access.
Closing a sheet or replacing its session rejects suspended responses while
preserving the original request for later recovery.

## Verification

The first app build passes 65 cases, including 13 new stop workflow checks and
existing detail, reassignment and refund behavior. Independent review then found
the missing entry after a terminal action. The entry and eight actual-detail,
storage and suspended-lifetime/concurrent-sheet checks address that finding.
The final twelve Swift files pass formatting, strict lint with zero findings,
Swift parsing and independent review. The next actual app build passes all 73
cases. A final fixture refinement represents the original released worker and
an unpaid/unassigned close accurately; all 21 affected recovery cases pass again
with unchanged runtime source. Private operator logs retain the build evidence.

These are actual native app builds with synthetic HTTP responses. Installed-app
visual and complete hosted/provider acceptance remain separate release work.
No update was installed on the owner's iPhone, and no provider, hosted database
or paid service changed. Current-head remote CI remains required before merge.

## Next

Finish Android and browser terminal-state recovery parity and complete actual
provider/browser/emulator journeys. Started work, no-show and fee execution,
disputes, Connect/debt, retained-operation support, exact paid-tip acceptance and
capacity/integration remain open. All paid dependencies stay together for final
launch preparation; completed physical Beacon and saved-card checks stay complete.
