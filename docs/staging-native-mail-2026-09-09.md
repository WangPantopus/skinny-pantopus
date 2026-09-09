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

## Confirmation and access milestone

A second service-only RPC now consumes attempts and commits proof, residency,
member permissions and audit evidence together. Wrong guesses increment under a
row lock; five exhaust the proof. An injected audit failure after proof and
occupancy writes rolls the entire transaction back, leaving the same code usable.
Four concurrent correct submissions create one occupancy and consume one attempt;
eight concurrent wrong guesses stop at five and cannot be bypassed by the correct
code afterward. All local fixtures are cleaned.

A self-claimed owner receives at most member access. Existing independently
verified membership is preserved, including its role and verification age.
Existing household authorities retain the seven-day provisional review window;
retries do not reset it. Removed/suspended/timed-out access, rejected residency,
frozen Homes and changed mailing destinations are denied. Child restrictions
survive the shared permission template. Frozen/revoked requesters are denied
before postage is spent. Preexisting postcard rows without a saved destination
retain legacy verification compatibility; their historical destination cannot be
reconstructed or newly certified by this migration.

Confirmation passes 4,509 backend tests and privacy gates; the first full run
encountered an unrelated notification device-ID socket hang-up, and its targeted
and full reruns passed. A final restricted-request guard adds one regression;
all 29 focused mail request/confirmation tests pass after that guard. All 15 SQL
contracts and function lint pass (121 application functions, 73 trigger bindings,
the same reviewed PostGIS findings/warnings). Twelve competing confirmation
connections pass, in addition to the ten admission connections.

## Remaining work and limits

Native UI changes remove sample tracking from live screens, add read-only
saved/uncertain/empty/error status, and stop interpreting general request failures
as mailed postcards. iOS passes 43 focused tests and strict Swift lint. Android
passes 39 focused tests; a single Detekt magic-number finding was corrected and
quality/build gates are running. Transient confirmation throttles still need an
explicit UI distinction from an exhausted code before native completion.

Both migrations are applied only to the disposable local clone; Free staging
and all running candidates remain unchanged. Next commit the checked backend,
apply it with before/after data and ledger guards to Free staging, then build a
private candidate on existing capacity. Finish native gates and live synthetic
provider/simulator acceptance before merging the complete branch. No real
provider postcard or native live acceptance has run for this branch. Public
API/worker/browser runtimes remain separate. Externally delivered Lob callbacks,
modern multi-unit completion and remaining payment/OAuth acceptance are open.
Smarty activation and a real DPV/unit retest remain required before launch.
