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
as mailed postcards. iOS passes 44 focused tests and strict Swift lint. Android
passes 40 focused tests, formatting, Detekt and assembly at the final throttle
fix; its preceding full quality pass includes Android lint. A transient HTTP 429
preserves the typed code; only explicit `LOCKED` means the proof is exhausted.

The printed native postcard link now targets the exact Home's existing
`verify-postcard` route, with the code kept off the URL. Focused provider tests
verify that link and the separate idempotency/correlation namespace. This link repair is running in the refreshed candidate; simulator acceptance remains.

## Live private-candidate acceptance

Both committed migrations were applied only to Free staging
`ptudkfqdhqpkbkzqlabu`. Existing Home, occupancy, residency, native/modern mail and
file records hash identically before/after; the hosted ledger remains absent.
Migration SHA-256 values:

- Admission: `f57501c19e5105a413ba1d6346b584d831ea62dbc3dfd82019f83f48cc77b11e`.
- Confirmation: `76374e3e75bb38d35e5a3b65e1ca4a4188849169e40eebfe44717859cdf8abf8`.

The healthy private candidate runs committed source
`f5f85188b73c4df71ae7b8bbc772422a8412e992`, image
`sha256:a5157a836a41bdc35d97b37e7301c644d1cff0325bdb7b0d8b5b8a10b7a7c608`.
The preceding `7cd158c515ed` image/container is retained stopped for rollback.
Public API/worker/browser/production container identities are unchanged.

Real Lob test acceptance passes: three identical keyed provider calls returned
one postcard after their receipts were deliberately discarded. The saved Apt 4
and code hash remained valid. Real HTTP status/retry reported uncertainty;
unauthenticated/foreign access was denied. A wrong code created no membership.
A locally signed synthetic Lob webhook recovered the receipt. Three concurrent
HTTP correct-code submissions returned one member occupancy and consumed one
successful attempt. Self-claimed ownership, another unit and subsequently revoked
access did not gain access. Unrelated Home document IDs stayed identical.

Cleanup passes: the exact test postcard, disposable Home/proof/claim/occupancy,
synthetic notifications and signed webhook record are deleted. Both fixture
sessions are revoked and denied; zero push tokens remain. Synthetic accounts
remain with global push off. No physical mail was sent. These publishers and
cleanup scripts are complete and must not be blindly repeated.

Next finish native simulator acceptance and current-head integration checks.
The signed synthetic callback is not externally delivered Lob webhook proof.
Modern multi-unit completion and remaining payment/OAuth acceptance remain open.
Smarty activation and a real DPV/unit retest remain required before launch.


## Simulator navigation milestone

The private candidate was refreshed to `26102bfb2072f9e8a89a534bbe03a9860c372875`,
image `sha256:312b5a382fd6e1b3a7cbcf6cf2695550ff3ee41213b27c385a49da19bd00523a`.
The preceding `a5157a836a41` container is retained stopped. Public runtimes remain
unchanged. Two separate synthetic actors and Homes each have one real Lob test
postcard, with exact unit and printed Home link checked; no physical mail.
These simulator fixtures are separate from the cleaned API journey above.

The signed-in Place landing hides iOS back navigation, making its old Hub menu
unreachable. Both native Place headers now expose the existing account menu.
iOS build and strict lint pass; Android build, Detekt and the updated Place
snapshot pass. The snapshot was visually inspected. Normal iOS menu → Settings
→ logout → designated fixture login passes. The first harness attempts failed
before login (hidden back navigation), then before submission (SwiftUI inherited
container identifier); neither consumed a code attempt or sent more mail.

Android printed link → real pending status → read-only refresh → cold restart
→ wrong code rejection → exact code acceptance passes. The database confirms one
verified member for only its designated Home and two attempts (wrong + correct).
iOS final code submission, both same-code retries, final normal logout and exact
fixture cleanup remain. Do not mark these fixtures cleaned or republish them.


## Completed native acceptance and cleanup

The final opt-in iOS `NativePostcardJourneyUITests` run passed in 109.3 seconds.
It uses normal login/logout and disposable runner inputs; ordinary CI skips live
actions. Both platforms pass opening the actual printed Home link, real pending
status, read-only refresh, cold app restart, wrong code rejection, correct code
confirmation, and reopening/retrying the same code. Android also passes launching
the updated app into Place and its new menu → Settings → logout path. iOS passed
that menu path before fixture login. The earlier identifier failure was a test
query issue: the visible button inherited the container's SwiftUI identifier;
the final test selects its visible “Verify code” label.

Database reconciliation confirms exactly one proof and one verified member for
each designated Home, two attempts each (one wrong plus one correct), and no
additional membership or attempt from the replay. Both native logouts revoked
their sessions before operator cleanup. The two exact Lob test postcards are
deleted, temporary Homes/proofs/residency/occupancy/audit/notifications removed,
operator sessions revoked and denied, and zero fixture push tokens remain.
Original Home document IDs are unchanged. The private setup, API journey and
native finalization scripts are complete and must not be rerun.

Evidence is retained privately in `staging-native-mail/ios-native-acceptance-20260909T202354.log`,
the final native UI XML captures, and `native-finalize.log` (sanitized assertions
only are described here). Credentials, printed codes and raw operator logs are
excluded from Git. This is simulator + real Lob test API acceptance, not physical
delivery or an external Lob callback. Current-head full CI and PR #28 integration
remain before the next source checkpoint; multi-unit modern mail attachment,
payment/OAuth and the launch gates remain open.
