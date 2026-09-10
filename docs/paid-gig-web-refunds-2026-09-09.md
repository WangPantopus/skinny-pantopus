# Paid-gig web refund recovery — September 9, 2026

The payer's existing gig payment section now reads protected refund history and
offers an explicit full/partial refund or authorization-hold release where the
payment state permits a request. It depends on the durable refund service and
`20260910050000_paid_gig_refund_receipts.sql` in the same draft PR #34; those are
being verified separately. This client checkpoint must not deploy independently
of that server contract.

## Behavior

Opening the section only reads current scoped history. A separate confirmation
starts an operation. The server's exact payment/request receipt determines
pending, additional-action, completed, failed and canceled outcomes. An HTTP
success flag alone never claims a completed refund. Hold release is described
separately from refunding captured money; neither action claims to cancel the task.

The original UUID, optional amount and reason code survive interruption under
an actor/payment/API-specific local recovery key. No provider secret, token or
free-text description is stored there. An empty history read retains an unknown
local operation. Retries preserve omitted amount versus explicit amount and the
original reason/description from server history. A conflicting request replaces
the uncertain local identity only when the server explicitly reports
`REFUND_ACTIVE`. History with a matching ID but different original terms blocks
continuation. Policy/admin history remains readable; retry follows the server's
caller-specific `canRetry` value.

Account/payment changes remount the section. A same-user session mutation or API
origin change invalidates the existing screen and fences later responses. The
shared API client emits a nonsecret change marker so another browser tab's
cookie-session replacement can invalidate the screen too. Requests are not
automatically retried after such a change; reopening reads current history.

The displayed form validates decimal cents and remaining amount. An immediate
in-memory guard prevents duplicate confirmation clicks. Failed local persistence
prevents creating a new operation that could not recover after restart. The
server remains authoritative for current payer/admin access, provider identity,
amounts, payment state, disputes and wallet settlement.

## Verification and limits

The full web run passes **80 suites / 1,060 tests**. The expanded focused run
passes **26 tests**: 24 refund UI cases and 2 actual shared-client session-signal
cases. Changed-file lint and the zero-error TypeScript gate pass. Independent
contract review led to explicit active-conflict handling, immutable session/API
scope, original-term comparison and support for small historical policy refunds.

Cases cover partial integer cents, invalid amounts, explicit confirmation,
duplicate clicks, lost responses and restart, negative recovery reads, exact
receipt/term checks, requires-action status, hold release, account/session/API
changes, cross-tab changes, storage failure and restricted historical retries.
The new shared-client tests are additional to the preceding full run. API/provider
responses are controlled in these UI tests; no real refund or hosted rollout is
claimed.

Next complete the server checkpoint and combined CI, remaining native refund
controls, historical assigned authorization, residual worker settlement after a
pre-release partial refund, and the complete synthetic paid-gig provider journey.
Historical Connect reversal/debt and broader dispute accounting remain separate
release checks. The existing successful saved-card fixtures are already cleaned
and must not be reused for this acceptance.

## Worker release projection follow-up

The payer now starts a new refund only after the server explicitly reports
worker earnings as held. A partially refunded payment already credited to the
worker, an external transfer, missing release state or unknown reconciliation
shows a support/status path. Reading status closes an already-open creation
form when the worker release has completed. Recovery of a previously sent
request keeps its existing identity and caller-specific retry availability.

Shared types carry the separate release status and optional exact wallet
settlement receipt. The UI checks receipt identity, currency, amount, refund
basis and status before showing a credit. A fully refunded payment can report
zero remaining earnings without claiming a credit receipt. Worker summaries
separate original expected earnings from the amount historically credited;
they do not present the payer's gross net as worker income, add separate tips
to that receipt, or claim a current wallet balance after later adjustments.

The complete expanded web suite passes **81 suites / 1,082 tests**. Final
focused refund/summary/session checks pass **58 tests**, changed-file lint
passes and the TypeScript gate has zero errors. Independent final contract
review passes. These responses are controlled fixtures; the corresponding
`20260910070000` settlement backend is still being verified in the same draft
PR and no real provider or hosted acceptance is claimed. Native refund controls
and the complete paid-gig sandbox lifecycle remain unfinished.
