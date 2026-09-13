# Own residency-review history: backend acceptance

September 13, 2026. This is a bounded continuation of the
[combined residency baseline](home-residency-cycle-baseline-2026-09-13.md).
Acknowledging a protected reviewer decision previously removed its supported
recovery entry without providing a separate way to revisit the saved decision.
The new read-only history lists a reviewer's own recorded decisions for a Home,
including after acknowledgement, while requiring current review authority.
It does not restore membership or make an old approval proof of current access.

## Contract and implementation

The authenticated `/api/homes/residency-review-history` namespace provides a
session bootstrap, a Home list and an exact receipt detail. New reads carry
`X-Pantopus-Session-Scope`; responses bind the current actor and Home. All
history responses, including authentication and error responses, prohibit caching.
The shared SDK exposes separate history types and GET methods; existing original
command stores, submit/cancel protocols and acknowledgement remain unchanged.

The additive `20260913020000_home_residency_review_history.sql` creates an own
history index and three functions. Its public list/detail RPCs use the existing
Home review-scope locks, lock selected receipts and current applicant profiles,
and evaluate current authority after those waits. Direct execution of the
internal projection helper is denied to service_role as well as public client
roles. Only the guarded entry points receive service-role execution permission.

Each item separates these values:

- The immutable saved action, receipt/claim references, recorded and reviewed
  times, original result status, occupancy reference, recorded role and legacy
  indicator. All eight canonical recorded roles are understood. A missing
  legacy role stays unknown.
- A current descriptive claim/applicant lookup: current claim status and only
  public applicant ID/username, with `name: null`. It is explicitly a current
  reference, not a saved historical applicant name.
- `household_access: not_checked`. History neither checks nor grants current
  household access.

Original reasons, requested terms, review tokens, original request UUIDs/hashes,
private profile fields, addresses and postal data are not projected. Service
validation rejects malformed results and explicitly projects allowed fields.
Failures remain unavailable; they do not become an empty list. Current authority
denial is 403. With authority, another reviewer's exact receipt is 404.

Lists use fixed pages of 20, ordered by UTC timestamps retaining six fractional
digits and then receipt UUID, both descending. The canonical opaque cursor binds
actor, Home, timestamp and an existing own receipt. Foreign, malformed or changed
anchors are rejected. A new decision inserted between requests does not shift
the remaining older page or duplicate its entries.

## Actual SQL, HTTP and SDK acceptance

The final backend revision passes populated upgrade, zero SQL lint issues and
all **52 raw plus 52 generated SQL contracts**. Before/after evidence preserves
all 366 retained tables and all 374 candidate tables, full logical schema,
function definitions/ACLs, role rows and migration ledger. Existing prepared
review remains usable and completed decisions remain unchanged. This migration
does not backfill receipts or occupancy.

The default actual route/service/SDK/PostgreSQL journey passes nine groups with
303 total requests: 257 application requests and 46 private fixture controls.
It performs selected-address submission, rejection, same-claim resubmission,
independent approval, protected member removal, current applicant username change
and current review-authority denial/restoration. Further real reject/resubmit
operations create the pagination population; no receipts are inserted as test
shortcuts. It ends with 24 completed submissions, 24 immutable reviewer decisions
(23 for the first reviewer and one for the other) and one completed removal.
All 49 retained original request bodies match actual HTTP body hashes/request
IDs and the corresponding SQL records.

Own-only list/detail, exact microsecond ordering, 20-plus-older pagination with
an intervening new decision, invalid/foreign cursors, current authority, normal
same-account session rotation, and held successful list/detail replies are
covered. Historical decisions and current descriptive identity remain separate.

Two separate fresh expiry journeys each pass 47 total requests: 32 application
requests and 15 controls. Each makes a real submission and rejection, narrows an
existing finite authority window, observes two database waiters, then releases
the lock after actual expiry. Delayed list/detail reads return 403 without
domain writes. One case holds the Home row. In the profile case the first read
waits on the applicant profile; the second may wait transitively on the Home
lock. This does not establish that both directly waited on the profile row.

The populated default fixture continues into
[actual browser acceptance](home-browser-residency-review-history-2026-09-13.md)
before exact cleanup. Both expiry fixtures, that shared HTTP/browser fixture and
the separate fresh browser-cycle fixture finish with all five cleanup flags,
full 374/366 logical restoration, process exit 0 and the owned API port closed.
The history REST container is then stopped with its database/configuration
retained. PostgreSQL relation maintenance estimates and freeze counters are
excluded exactly as documented by the pre-existing preservation comparison;
no domain row, function, privilege, role or ledger difference is excluded.

## Failed predecessors and evidence limits

The first populated upgrade failed a substantive ACL check: inherited default
privileges granted service_role access to the new internal helper. That attempt
rolled back exactly. Revision 2 explicitly revokes this grant and adds direct
denied-call checks to both SQL contract forms. Its wire shape is unchanged.

Static review also found a private adapter still expecting the predecessor REST
port. Private fixture revision 3 corrects only that guard before actual use;
there was no failed runtime or source repair implied by that preparation change.

The original HTTP driver's held-response absence predicate compared the full
outer path with router-relative held metadata and was invalid. A separate audit
of the already persisted events verifies the exact known prefix, actor/session,
identical response digest/byte count, absence of a matching 200 finish before
release and its actual finish afterward for both holds. The original predicate
is not retroactively called valid. The browser independently proves its own
delivered old-success/newer-denial case with corrected assertions.

The HTTP driver does not separately retain raw history response bodies or every
intermediate full-state snapshot. Their assertions passed in the bound run;
independent review is limited to retained originals, final SQL, event metadata
and cleanup snapshots. Browser response bodies and its own read-only intervals
are separately retained. Controlled authentication and providers are not hosted
authentication, delivery or production acceptance.

## Source and durable evidence

Backend source revision 2 is bound by SHA-256
`a84f147f8cb2af742cabe0a63ff92fbc102cc4a81a811636f56683cc21c1b8e2`.
The SQL gate result is bound by
`435ebaa4b50d9b5f4e81efcc86d3321034b4321a8eff255a6f74338cbc7face8`.
The independent HTTP evidence index binds 128 private artifacts and was
independently rehashed by the integrating task. Its SHA-256 is
`af2fe881ef13aa5e015c3857802181a11473a2967f9d7ce21e906f046008b79b`.

Private preparation, failed attempts, source maps, full snapshots and runtime
evidence are under `/private/tmp/pantopus-home-residency-cycle-r1/`. The private
operator index records the verified durable copy under
`home-invitation-handoff-20260912/residency-cycle-20260913/history-backend-browser-r1/`.
No credentials, original tokens, row archives or operator logs belong in Git.

Installed native history, native combined-cycle parity, the separately observed
current-claims privacy/read failures, needs-more-information and legitimate
renewal remain unfinished. This closes no additional acceptance row: **8 of 80
remain locally closed, with 72 partial/open**. The source union is now 49 Home /
21 paid / 58 combined migration versions, with 12 identical shared versions and
zero collisions. Combined replay/adoption and hosted release remain separate.
