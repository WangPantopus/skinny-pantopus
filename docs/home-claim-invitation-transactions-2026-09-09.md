# Home claim invitation transactions — September 9, 2026

## Scope and current state

This is the next bounded ownership source checkpoint after invitation/sharing
`0c973b8df` and master integration `269128f31` on
`codex/home-permission-boundaries` (draft PR #32). Native navigation checkpoint
`115c238ac` was committed independently during this work. Parent verification reports all
applicable checks on CI run `34441879676` passed at `269128f31`. The work is local
in `/private/tmp/pantopus-home-permission-boundaries`; no hosted migration,
provider write, ordinary role default or verification-age rollout ran.

This checkpoint replaces **claim-bound relationship invitation issuance and
acceptance**. It covers the distinct `claim_merge:` branch of the ordinary
invitation helper and the dedicated ownership `accept-merge` endpoint. It does
not claim that the separate claim submission, evidence review, challenge,
transfer/quorum or lease lifecycle is complete.

## Resulting behavior

The backend calls one service-only PostgreSQL transaction, with the authenticated
actor and exact Home/claim/invitation identifiers. It no longer promotes an owner,
attaches occupancy and closes a claim in separate requests, or restores old
snapshots after a failure. The unsupported `HomeInvite.updated_at` writes are
removed from both relationship issuance and acceptance. Unknown authorization
state, transport errors and late database failures return a private, retryable
503 without a direct-table fallback or compensation writes.

The transaction locks the Home, authority rows, role policy, invitations, claims
and their identity evidence in a consistent order. It checks current issuer
permissions and recipient state after waits. Its rules are:

- A claim alone grants no access. Co-owner issuance needs a current verified
  `HomeOwner`, or a legacy primary pointer with no ownership history for that
  actor, plus effective `ownership.manage` and `members.manage`. An owner role
  string or a stale pointer after revocation cannot create ownership.
- The invitation is addressed to the exact claimant. The policy snapshot binds
  the claim, claimant, type, method and shipped role policy. Changing the claim
  or policy requires reissue; an old member invitation is never silently repaired
  into an owner invitation. Reissue revokes only pending links for that exact
  claim and claimant and issues a new token. The database stores only its hash.
- Current actor/target role ceilings, explicit denies, age bands, status and
  access windows remain authoritative. Explicit child/teen restrictions cannot
  be bypassed by ownership. Historical null age stays null. A new authority set
  cannot exceed the issuer's complete current permission set. Existing restrictive
  overrides are retained rather than replaced by an occupancy template.
- A current failed identity cannot use older successful identity evidence as a
  bypass. Verified identity status or verified IDV evidence for a compatible
  legacy claim is required at acceptance. Evidence stays attached to the original
  claim; no evidence is moved, erased or included in the response.
- Co-owner acceptance adds or verifies the target's own proof without reallocating
  or revoking the incumbent primary. Existing verified proof tiers, occupancy
  dates, age and already-verified timestamps are preserved. Revoked/disputed
  ownership history requires a separate review. Existing future target access
  returns `CLAIM_ACCESS_NOT_STARTED` until that window starts, without creating
  an early verified ownership proof.
- Owner claims become verified co-ownership; admin and resident claims keep their
  distinct roles and merge outcomes. Residency does not create a `HomeOwner`.
  Claim closure, occupancy, proof, invitation receipt, Home resolution and audit
  commit together or all roll back. The transaction never automatically clears
  the Home's operational disputed/frozen security state.
- An exact completed retry returns current eligible access without granting it
  again or duplicating audit/notifications. A revoked recipient cannot replay
  the receipt to restore access. Notifications remain best effort after commit.

Direct client claim/evidence mutation, truncate, reference and trigger privileges
are revoked, including grants inherited from PUBLIC. The new transaction is
callable by `service_role` only. Existing claimant/evidence SELECT policies and
other service-backed ownership gateways remain separate follow-up work.

## Verification

The focused service/token suites pass **35 tests**, with **23** adjacent ordinary
invitation service checks also passing (**58** together). Root's Node 22 ownership
route suite passes **31 tests**. Route regressions bind the exact Home, actor,
claim and invitation to the transaction, preserve typed denials, enforce the
feature flag and prove that old occupancy attachment/compensation is not called.
The old tests that expected stale role clamping and JavaScript rollback have
been replaced with transaction receipt/error tests; the actual mutation,
identity, primary-owner and rollback assertions now execute against canonical
PostgreSQL data.

The final real SQL contract, generated pgTAP wrapper and all **20 observed
PostgreSQL lock-wait races** pass in a disposable local combined replay. They exercise duplicate issue and
acceptance, issuer/recipient revocation, age and permission changes, claim role
and recipient changes, proof withdrawal, policy changes, Home freeze and expiry
while waiting. The race harness explicitly observes the competing connection's
Lock wait, compares committed Home/owner/occupancy/claim/invitation/audit state,
and retires its exact twenty Homes and three synthetic accounts. Raw contract
fixtures roll back. The separate clean committed replay remains unchanged.

Independent source review found no additional blocker in the final transaction,
service, changed route helpers and real SQL contract. It included the missing
occupancy/terminal-receipt guards as well as identity/source/window checks.

The final identity/source/window and receipt guard additions are included in
that passing rerun. Migration SHA-256 is
`94c9a8520a4999caabb450af7fabcf6728a139dcc75fb81ba3dd4c74dd3f2acd`.
An isolated export of committed `115c238ac` plus the staged ownership files
(excluding all uncommitted task/calendar work) passes **4,861 backend tests,
16 skipped, 300 suites**, and every privacy gate including **15 E2E checks**.
A fresh **22-migration** replay passed. Three implicit enum-assignment lint
warnings found there were replaced with explicit casts and refreshed locally.
The final candidate passes all **28 raw SQL contracts and 28 pgTAP wrappers**,
all **20 observed lock-wait races**, and all **6 real SDK/PostgREST checks**.
Application lint reports **163 functions, 75 trigger bindings, zero errors and
five existing warnings**. No new lint warnings remain. The final six ownership
function bodies match the migration source byte for byte, with aggregate SHA-256
`1bf7223a8345305fd31a8dd4ab6d96345b48813ba06a73cde59166b8fbf89d09`.
The migration ledger contains 22 entries; exact fixture tables are empty after
verification. This records the fresh replay followed by the cast-only definition
refresh and complete final SQL rerun, rather than claiming a second full rebuild.
No JavaScript changed after the isolated full suite, and root independently
reviewed the final cast-only diff.

Evidence files in the repository:

- `supabase/migrations/20260910045000_home_claim_merge_transactions.sql`
- `scripts/db/contracts/home-claim-merge-transactions.sql` and generated pgTAP wrapper
- `scripts/db/test-home-claim-merge-concurrency.py`
- `backend/tests/unit/homeClaimMergeService.test.js`
- `backend/tests/unit/homeOwnershipPhase2Compat.test.js`
- `backend/tests/unit/homeInviteTokens.test.js`

Operator logs are private and are not committed. Initial exact fixtures use the
`ddc45000` raw-contract and `ddc45100` concurrency UUID namespaces with synthetic
`.invalid` emails. The harness refuses existing fixture reuse and checks exact
Home/auth/public-user cleanup; it does not perform broad database cleanup.

## Immediate remaining ownership work and acceptance limits

The immediate next ownership checkpoint is the legacy claim review route. It
currently updates the claim before validating evidence, unconditionally promotes
every approved claim type to owner, resets occupancy through the old attach
service and replaces `Home.owner_id`. That alternate path must preserve resident
and admin identity, verify current evidence/identity before committing, preserve
the primary owner, and enforce current actor/target restrictions atomically.
The new claim invitation transaction does not repair this separate route.
The old withdrawal route likewise checks state before separately purging and
deleting by id/user; a concurrent accepted claim can therefore lose its evidence
and source history after that stale precheck. Review, withdrawal and evidence
transitions must be guarded together in the next lifecycle checkpoint.

Then continue claim submission/evidence/withdrawal/challenge and the distinct
direct owner invitation, transfer/removal/quorum and lease flows.
They must recheck current source, recipient, age, dates and authority without
side-effectful partial approvals. They remain release blockers even though the
claim invitation path now uses the protected transaction.

The relationship endpoint's token is delivery-only. A lost issue response or a
failed best-effort notification does not promise successful delivery or provide a
recoverable raw token in invitation lists. Issued-link revoke/reissue UI and
native Home invitation acceptance remain required. This checkpoint does not
include hosted storage-provider checks, legal-title verification or full Home
acceptance. Ordinary role defaults must not be expanded until the remaining
record, authority and client paths are protected. Task/calendar/resource work
uses reserved migration `20260910060000`; paid-gig refund work separately owns
`20260910050000`.
