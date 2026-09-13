# Older-client residency submission compatibility

September 12, 2026. **Local backend and combined H07/R02 acceptance pass.**
The candidate was prepared on `codex/home-residency-legacy-compatibility`, based
on `80c702a3433193bc9aa58b48cd576ef595e321fd`, and integrated onto the accepted
Task head `767fbb2278774bcd092f2e1b425cc43325bda8a9`. Browser/native product
source is unchanged. Check the integrating commit's exact-head CI separately;
local acceptance does not establish merged master, adoption or deployment.

## Observed legacy defects

The older `POST /api/homes/:id/claim` wrote the claim, occupancy, routing and audit
through separate operations. Preserved earlier HTTP reproductions cover stranded
claims after authority/postage failures and unsafe role/authority routing.
The additional actual HTTP/SDK/SQL baseline completed five cases against the
unchanged old route:

- A rejected tenant request with omitted role became `member` and still lacked
  an occupancy. The old query did not select the existing `claimed_role`.
- Existing verified and pending claims refused without changing their rows.
- Creator bootstrap returned a claim whose routing was stale, although SQL had
  already saved `self_bootstrap` and a provisional occupancy.
- An inactive ended guest occupancy was overwritten as active and restricted,
  while its past end date remained. This proves an unwanted row overwrite, not
  restored effective access beyond expiry.

That baseline temporarily coexisted with an idle retained iOS H07 fixture. It
preserved all row values and schema/function/role/ledger provenance in the 369
then-present tables, including the iOS sender, acceptance, Task and receipt.
The final iOS cleanup separately restored the original 366-table baseline.

An initial setup attempt incorrectly assumed historical claims could coexist.
The real full `UNIQUE(user_id,home_id)` constraint rejected the atomic fixture
setup before any HTTP call. That failed attempt and exact preservation evidence
remain recorded. The corrected design relies on this full constraint and neither
weakens uniqueness nor implements fabricated multi-history reconciliation.

## Candidate behavior

Additive migration `20260912060000` extracts the accepted protected admission
policy into a service-only transactional helper. The old route becomes a small
adapter to the same policy. The protected request UUID, address snapshot, hash,
original receipt, rejection and cancellation protocol remains separate and passes
its existing contracts after this extraction.

Legacy callers still supply optional `claimed_role` and `claimed_address` and
receive `{message, claim}`. New claims return 201; an existing current claim
returns 200. The claim comes from the committed transaction, with an explicit
allowlist of legacy fields. A legacy address is an unreviewed assertion. No
request UUID, reviewed address snapshot or protected command is invented.

The supported residential aliases are renter, tenant, lease_resident, household,
member, family and roommate. The raw legacy role is preserved while canonical
renter/household policy governs admission. Omitted role is resolved under the
transaction locks from the sole existing claim; a new omission defaults to member.
Ownership/management and unsupported role inputs cannot grant residency access.

New claims, restricted pending occupancy, routing and required audit commit
together. Pending retries reuse the unchanged claim and occupancy, without new
audit or notification attempts. Historical stranded pending claims can gain their
missing pending occupancy. Rejected claims can be resubmitted while preserving
the full existing occupancy, dates, age and denies; their previous pending postal
capability is retired without erasing dispatch evidence. Inactive, ended, future,
previously verified or privileged memberships require their separate review or
ownership flow rather than being reactivated or retemplated here.

Saving a claim requests no postcard. The response explicitly states
`postcard_requested: false` and requires a separate current-access check and
verification step. Current reviewer selection includes legitimate owner records
without occupancy, explicit denies, current schedules and age limits. Unknown
activity keeps household review; only known stale authorities select the existing
postal next step.

A changed household-review admission can attempt the existing in-app reviewer
notification after commit. A service-only read binds the exact current pending
claim generation and checks present reviewer authority. Notification text contains
no claimant name, address or unreviewed role. Read or notice failures do not turn
the saved admission into failure. A lost reply before that optional attempt can
leave the notice unsent; this is best effort, not a durable outbox or delivery
receipt. A no-op retry does not duplicate it.

The actual accepted review function rejected canonical `household` when the
reviewer omitted its role. The source-bound HTTP baseline proves omitted approval
returns 403 while explicit `member` succeeds. The retained replay's function
differs from the accepted source; that predecessor result is recorded separately.
The accepted-source baseline temporarily installs the accepted prerequisites,
checks exact function-body equality and reproduces the same defect. The additive
correction inserts only the `household` → `member` approval mapping. Existing
current authority, role ceilings, age, receipt, postal and membership guards
remain unchanged. R03 applicant resubmission and reviewer UI remains separate.

## Validation and evidence status

The service and route regression suites pass 77 checks. The full backend run
passes 5,250 checks in 319 suites, with 16 checks / one suite skipped. It exits
successfully after the existing delayed-handle diagnostic; this is not a live
database test. JS/Python syntax, six migration-policy checks and 49 generated
contract wrappers pass. The initial rerun from the checkout root failed before
tests because the existing
Express test mock resolves dependencies from the working directory; running from
`backend` uses the retained ignored dependency link without installation.

Actual candidate acceptance:

- `test-home-residency-legacy-review-baseline.cjs`: retained actual reviewer
  role-omission baseline and exact body comparison to accepted source pass. Its
  `--accepted-review-source` mode temporarily installs only already accepted
  prerequisites and the accepted Home-view defaults. Final accepted baseline r3
  passes both HTTP cases and exactly restores the retained state.
- `test-home-residency-legacy-upgrade.py`: populated additive rehearsal, complete
  row preservation, protected original preservation and function lint in an
  outer transaction that is fully rolled back. Final r3 preserves every existing
  row and protected original; all five checked PL/pgSQL functions have zero lint
  issues.
- `contracts/home-residency-legacy-compatibility.sql` and its generated pgTAP
  wrapper: canonical admission, old rows, denials, rollback, notices and protected
  original/tombstone assertions.
- `test-home-residency-legacy-contracts.cjs`: eight focused raw and eight generated
  admission, review and postal contracts, including the accepted protected paths.
  All 16 pass in r2.
- `test-home-residency-legacy-http.cjs`: actual legacy and protected HTTP through
  production services and local SDK/SQL, with controlled late write failures,
  lost committed replies and post-commit notification failures. R1 passes 15
  grouped cases through 53 HTTP calls and 53 actual SDK calls. Thirteen controlled
  notification attempts are observed; none establish provider or device delivery.
- `test-home-residency-legacy-concurrency.cjs`: ten observed lock waits covering
  duplicate and different-role submissions, old/new protocol overlap, current
  authority/removal/expiry and protected address changes. All ten pass in r1 with
  each losing SDK transaction observed waiting on a database lock.

Failed/predecessor attempts remain preserved. The first accepted-source harness
attempt failed before DDL/HTTP because a PostgreSQL Boolean was parsed as JSON;
the guard now serializes JSON explicitly. Upgrade r1 caught an unused local after
extraction; the wrapper now performs the same User existence check and row lock
without retaining an unused row. The first contract run refused its shipped-role
inventory because the replay lacked accepted Home-view defaults. The harness
now temporarily applies that accepted migration and removes only its verified
inserted rows during restoration. Every failed attempt restored complete state.
Upgrade r2 and accepted-review r2 remain predecessor evidence with their smaller
prerequisite set; the final r3 runs establish the accepted base-commit policy.

The shared isolated harness uses an ephemeral loopback port, exact owned IDs,
guarded temporary prerequisites and complete before/after populated-state and
function-provenance comparisons. Both notification import paths are intercepted;
external fetch and postage calls are blocked. It does not use the shared native
fixture, adopt migrations or contact providers. All runs restore the exact 366
retained tables, original role rows, full migration ledger and function
definitions/OIDs/owners/ACLs/configuration. Owned actors, Homes and command tables
are cleaned; ephemeral servers are closed. The database lease is released.

Private baseline results and source bindings remain under the existing private
member-first-use evidence root. Final R02 runs are under the separate private
`pantopus-home-residency-legacy-r1` root, with durable source/cleanup manifests and
operator indexing. Raw capabilities, accounts, SQL snapshots and operator logs
remain outside Git. Each accepted run binds the actual migration, services and
harness source; the unit binding separately proves its service/route source
matches the final candidate. Review the integrating commit's exact CI separately.

## Integration verification

Root and an independent review found no blocking regression. Root independently
verified 26 frozen source hashes, 153 durable backend evidence files and the
exact before/after state of all five final acceptance runs.

A separate pre-integration union combines committed H07 migration/contracts with
the frozen R02 additions. All 50 raw and 50 generated SQL contracts pass. Nine
temporary Home prerequisite/candidate migrations run inside each contract's
outer transaction and roll back; every row in 366 populated tables, all original
role/preset and 33 ledger rows, and function/schema provenance are unchanged.
The first wrapper attempt stopped at a read-only preset-ordering assumption
before DDL or any contract; that failure and exact preservation remain recorded.
Root verifies the integrating primary migration/contract bytes against this
accepted union; no accepted contract is weakened or replaced by its older R02
base version. All 370 durable union files are independently hash/size verified.
The inventory is 47 Home / 21 paid / 56 distinct combined versions, including
12 byte-identical shared versions and zero collisions. Paid migrations were
inventoried but not applied by this H07/R02 run; their combined replay/adoption
remains open. No later exact-head CI is implied by the Task predecessor's green run.

No old-client UI, live notification arrival, hosted rollout, combined paid/Home
migration adoption or final launch readiness is established by this candidate.
Legacy clients still lack the protected protocol's explicit original identity
and cancellation fence: a delayed old POST after a rejection is a current-state
resubmission, not recoverable proof of a prior immutable command.
