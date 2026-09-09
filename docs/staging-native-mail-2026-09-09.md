# Native postcard verification — September 9, 2026

Worktree `/private/tmp/pantopus-staging-native-mail`, branch
`codex/staging-native-mail`, starts at merged master `3ce4018f5` (PR #27).

## Request reliability milestone

The native ownership endpoint and both residency cold-start callers now share
one atomic postcard admission service. It saves the Home's exact destination,
including `address2`, before dispatch. The SQL transaction serializes per-user
and per-Home budgets, reuses an unexpired proof, and retires only naturally
expired pending rows before admission. It requires an additive service-only RPC;
a missing migration fails closed before sending.

Each new dispatch uses a stable Lob idempotency key and a separate native
correlation ID. Bounded provider retries use the same in-memory payload. Lost
responses or receipt-write failures preserve the pending code and return HTTP
202 with `delivery_unknown`, not a claim that mail was sent. Only a definite
provider rejection retires the proof. Signed native webhook metadata can recover
a missing receipt but cannot replace an already different receipt or bind a
modern mail job. No background process blindly resends an uncertain request.
Production/staging native requests fail if Lob is unconfigured, instead of using
the local mock provider. Raw provider errors, code hashes and provider receipts
are absent from public status responses.

`GET /api/homes/:id/postcard` exposes only the caller's pending request metadata
and never sends mail. Claim/household reads now fail closed on database errors;
a pending residency claim is an explicit relationship for requesting mail.

Verification so far:

- 48 initial focused tests, then 117 targeted backend tests pass.
- Full backend: 4,497 passed, 16 skipped; privacy gates pass. The initial run
  encountered one unrelated `gigLocationFiltering` socket hang-up; its focused
  rerun and the full rerun passed without changing that test.
- All 14 SQL contracts pass on the owned local PostgreSQL clone. Application
  lint covers 120 functions and 73 trigger bindings, with six reviewed stock
  PostGIS findings and 38 pre-existing warnings.
- Ten competing PostgreSQL connections pass same-request reuse, per-user and
  per-Home caps; six expected proofs are created and all local fixtures removed.

## Remaining work and limits

Native changes are in progress: remove sample tracking from the live screens,
show saved/uncertain/empty/error state, read-only refresh, and stop treating
400/429 request failures as successful mailing. They are not yet built or tested.
Confirmation still needs atomic attempt consumption and occupancy attachment,
role/access restrictions, destination binding and idempotent retry. Do not treat
the request milestone as completed native end-to-end acceptance.

This migration is applied only to the disposable local clone; Free staging and
all running candidates remain unchanged. No real provider postcard or native
app acceptance has run for this branch. Public API/worker/browser runtimes remain
separate. External Lob callbacks, modern multi-unit completion and remaining
payment/OAuth acceptance are still open. Smarty activation and the real DPV/unit
retest remain required before launch, with the owner's reminder scheduled.
