# Home Household Claim Implementation Spec

## Purpose

This document translates `docs/home-household-claim-state-machine-design-2026-04-04.md` into an implementation contract.

It is intentionally narrower and more operational than the design doc. It specifies:

- exact additive schema changes
- compatibility rules from current claim states to the new model
- service and endpoint changes
- rollout phases and feature flags
- invariants that protect existing features and flows

The goal is to evolve only the ownership/household claim system without breaking unrelated app behavior.

## Scope

In scope:

- ownership claim lifecycle and evidence routing
- home-level household resolution state
- invite/merge handling for redundant claimants
- challenge/dispute handling for verified households
- admin review data requirements

Out of scope:

- broad address validation redesign
- IAM or HomeOccupancy redesign
- full admin UI implementation details beyond minimum backend/API requirements
- unrelated home surfaces like mailbox, tasks, finance, and local discovery behavior outside claim routing

## Existing Constraints To Preserve

The implementation must preserve all of the following until explicitly migrated:

- `HomeOwner` remains the source of verified ownership relationships
- `HomeOccupancy` remains the source of active household membership and permissions
- `Home.security_state` continues to drive operational restrictions like `disputed`, `frozen`, and `claim_window`
- existing invite flows for already-verified homes continue to work
- `HomeOwnershipClaim.state` remains readable by current code during migration
- existing mobile/web routes remain functional while new behavior is phased in

## Decision Summary

### Chosen implementation strategy

Use an additive compatibility model rather than replacing `HomeOwnershipClaim.state` in place.

Reasons:

- current routes and UI already depend on `state`
- the enum is persisted in production data
- multiple other systems already interpret `approved`, `rejected`, and `disputed`
- a parallel state layer lowers migration risk

### Core additive model

Keep the existing column:

- `HomeOwnershipClaim.state`

Add new columns:

- `Home.household_resolution_state`
- `Home.household_resolution_updated_at`
- `HomeOwnershipClaim.claim_phase_v2`
- `HomeOwnershipClaim.terminal_reason`
- `HomeOwnershipClaim.challenge_state`
- `HomeOwnershipClaim.claim_strength`
- `HomeOwnershipClaim.merged_into_claim_id`
- `HomeOwnershipClaim.routing_classification`
- `HomeOwnershipClaim.identity_status`
- `HomeVerificationEvidence.confidence_level`

## Exact Schema Additions

### New enums

#### `household_resolution_state`

- `unclaimed`
- `pending_single_claim`
- `contested`
- `verified_household`
- `disputed`

#### `claim_phase_v2`

- `initiated`
- `evidence_submitted`
- `under_review`
- `verified`
- `challenged`
- `withdrawn`
- `expired`
- `merged_into_household`
- `rejected`

#### `claim_terminal_reason`

- `none`
- `withdrawn_by_user`
- `expired_no_evidence`
- `merged_via_invite`
- `rejected_review`
- `superseded_by_stronger_claim`
- `duplicate_redundant_claim`
- `revoked_after_challenge`

#### `claim_challenge_state`

- `none`
- `challenged`
- `resolved_upheld`
- `resolved_revoked`

#### `claim_strength`

- `resident_low`
- `resident_standard`
- `owner_standard`
- `owner_strong`
- `owner_legal`

This is a derived routing field, not user-entered data.

#### `claim_routing_classification`

- `standalone_claim`
- `parallel_claim`
- `challenge_claim`
- `merge_candidate`

#### `identity_status`

- `not_started`
- `pending`
- `verified`
- `failed`

#### `evidence_confidence_level`

- `low`
- `medium`
- `high`

### Table changes

#### `Home`

Add:

- `household_resolution_state household_resolution_state NOT NULL DEFAULT 'unclaimed'`
- `household_resolution_updated_at timestamptz NULL`

Do not replace `security_state`.

#### `HomeOwnershipClaim`

Add:

- `claim_phase_v2 claim_phase_v2 NULL`
- `terminal_reason claim_terminal_reason NOT NULL DEFAULT 'none'`
- `challenge_state claim_challenge_state NOT NULL DEFAULT 'none'`
- `claim_strength claim_strength NULL`
- `routing_classification claim_routing_classification NULL`
- `identity_status identity_status NOT NULL DEFAULT 'not_started'`
- `merged_into_claim_id uuid NULL REFERENCES "HomeOwnershipClaim"("id") ON DELETE SET NULL`
- `expires_at timestamptz NULL`

#### `HomeVerificationEvidence`

Add:

- `confidence_level evidence_confidence_level NULL`

### Indexes

Add:

- index on `Home.household_resolution_state`
- index on `HomeOwnershipClaim(home_id, claim_phase_v2)`
- index on `HomeOwnershipClaim(home_id, routing_classification)`
- index on `HomeOwnershipClaim(home_id, challenge_state)`
- index on `HomeOwnershipClaim(expires_at)` where `claim_phase_v2 = 'initiated'`

### Existing unique index handling

Current blocker:

- `idx_home_claim_active_unique` on `HomeOwnershipClaim(home_id)` for `submitted`, `pending_review`, `pending_challenge_window`

Decision:

- do not drop this index in phase 1
- do not change it until the parallel-claim routing code, reconciliation job, and admin comparison view are ready
- drop it only in phase 2 under a feature flag rollout

## Compatibility Mapping

This mapping is required so existing code and new code can coexist.

### Existing `state` -> `claim_phase_v2`

- `draft` -> `initiated`
- `submitted` -> `evidence_submitted`
- `needs_more_info` -> `under_review`
- `pending_review` -> `under_review`
- `pending_challenge_window` -> `under_review`
- `approved` -> `verified`
- `rejected` -> `rejected`
- `disputed` -> `challenged`
- `revoked` -> `rejected`

Notes:

- `revoked` remains semantically overloaded in legacy logic, so `terminal_reason` must distinguish true revocation from duplicate cleanup or stronger-claim supersession
- `needs_more_info` stays readable by current code, but v2 should treat it as an active review branch

### `claim_phase_v2` -> legacy outward behavior

Until mobile/web/API consumers are migrated:

- `initiated`, `evidence_submitted`, `under_review`, `challenged` should surface as legacy claimant-safe `under_review`
- `verified` maps to `approved`
- `rejected` maps to `rejected`
- `merged_into_household` is not shown as a new raw state to legacy clients; surface a generic success/finalized status if needed

## Invariants

These are non-negotiable rules.

1. A claim never grants home access by itself.
2. `HomeOwner` and `HomeOccupancy` remain the only sources of actual ownership/occupancy authority.
3. Evidence remains attached to the claimant who uploaded it, even if the claim is later merged.
4. Invite-based shortcut may skip home-proof, but not identity verification.
5. Parallel claims are allowed only after the unique index is removed and new routing logic is active.
6. A verified incumbent does not lose access automatically when challenged; they move into a challenged/disputed path first.

## Feature Flags

Add these flags before behavior changes:

- `household_claim_v2_read_paths`
- `household_claim_parallel_submission`
- `household_claim_invite_merge`
- `household_claim_challenge_flow`
- `household_claim_admin_compare`

Expected usage:

- phase 1 enables only read-path compatibility and instrumentation
- later phases turn on behavior incrementally

## Backend Services

### New service: `backend/services/homeClaimRoutingService.js`

Responsibilities:

- classify a new claim as standalone, parallel, challenge, or merge candidate
- derive `claim_strength`
- update `Home.household_resolution_state`
- decide whether a home should enter `disputed`
- encapsulate logic currently spread across `homeOwnership.js` and `homeSecurityPolicy.js`

Proposed methods:

- `classifySubmission({ homeId, userId, claimType, method })`
- `deriveClaimStrength({ claimType, evidenceSummary })`
- `recalculateHomeResolutionState(homeId)`
- `shouldEnterDispute({ homeId, claimantId, claimStrength })`
- `markClaimMerged({ claimId, mergedIntoClaimId, actorUserId })`
- `expireStaleInitiatedClaims()`
- `reconcileDisputeExit(homeId)`

### Existing service changes

#### `homeSecurityPolicy.canSubmitOwnerClaim()`

Current behavior:

- blocks on other in-flight claimers

Target behavior:

- phase 1: unchanged except instrumentation hooks
- phase 2: stop blocking on `otherInFlight`; allow policy to return a routing classification instead

New shape:

```js
{
  allowed: true,
  routingClassification: 'parallel_claim',
  blockCode: null,
}
```

Only keep hard blocks for:

- frozen home
- invalid home status
- claimant cooldown
- claimant rate limits

Not for:

- another claimant already in progress

## Endpoint Changes

### `POST /api/homes/:id/ownership-claims`

Current:

- creates one claim
- may return 409 when another in-flight claim exists

Target:

- create claim even if another claimant exists, once phase 2 is enabled
- write both legacy `state` and new `claim_phase_v2`
- set `routing_classification`
- update `Home.household_resolution_state`

Response additions:

- `routing_classification`
- `household_resolution_state`
- `next_step`

Response example:

```json
{
  "message": "We're verifying ownership for this address. You'll be notified when complete.",
  "claim": {
    "id": "uuid",
    "status": "under_review",
    "claim_phase_v2": "evidence_submitted",
    "routing_classification": "parallel_claim"
  },
  "home_resolution": "contested",
  "next_step": "upload_evidence"
}
```

### `POST /api/homes/:id/ownership-claims/:claimId/evidence`

Current:

- uploads evidence
- if legacy state is `draft`, moves to `submitted`

Target:

- continue to support current legacy flow
- also update:
  - `claim_phase_v2` from `initiated` to `evidence_submitted`
  - `claim_strength`
  - evidence confidence default `null`
- trigger `recalculateHomeResolutionState()`

### `POST /api/homes/:id/ownership-claims/:claimId/review`

Current:

- approve/reject/flag

Target:

- keep current interface initially
- on approve:
  - set `claim_phase_v2 = 'verified'`
  - set `challenge_state = 'none'`
  - update `Home.household_resolution_state = 'verified_household'` if no unresolved competitor remains
- on reject:
  - set `claim_phase_v2 = 'rejected'`
  - `terminal_reason = 'rejected_review'`
- on flag:
  - set `claim_phase_v2 = 'challenged'` or mark home disputed depending on context

### New endpoint: `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`

Purpose:

- verified authority resolves another active claimant

Actions:

- `invite_to_household`
- `decline_relationship`
- `flag_unknown_person`

Behavior:

- `invite_to_household`: create/issue invite, mark target claim as merge candidate
- `decline_relationship`: no claim state change
- `flag_unknown_person`: add admin-review signal and possibly `disputed`

### New endpoint: `POST /api/homes/:id/ownership-claims/:claimId/accept-merge`

Purpose:

- claimant accepts invite-based merge path

Behavior:

- verifies invite eligibility
- requires identity verification to pass
- marks claim `merged_into_household`
- sets `terminal_reason = 'merged_via_invite'`
- archives claim evidence but does not delete it
- attaches claimant to home through existing occupancy/owner flows as appropriate

### New endpoint: `POST /api/homes/:id/ownership-claims/:claimId/challenge`

Purpose:

- allow strong competing claim to challenge verified household

Behavior:

- mark target home `household_resolution_state = 'disputed'`
- retain `Home.security_state = 'disputed'` where current operational restrictions already rely on it
- mark incumbent claim or ownership relationship as challenged

## Background Jobs

### New job: expire initiated claims

File:

- `backend/jobs/expireInitiatedHomeClaims.js`

Behavior:

- find claims in `claim_phase_v2 = 'initiated'` past `expires_at`
- set:
  - `claim_phase_v2 = 'expired'`
  - `terminal_reason = 'expired_no_evidence'`
- recalculate home resolution state

### New job: reconcile household resolution state

File:

- `backend/jobs/reconcileHomeHouseholdResolution.js`

Behavior:

- recalculate `Home.household_resolution_state` from active claims, owners, and challenge states
- exit `disputed` when challengers terminate
- exit `contested` when only one viable claimant remains or a verified household has been resolved

### Existing `processClaimWindows` job

No immediate redesign required.

Constraint:

- do not let new household claim logic change challenge-window behavior for occupancy verification until explicitly scoped

## Home Resolution State Computation

The following derived logic should be used by `recalculateHomeResolutionState(homeId)`.

Inputs:

- count of active independent claims
- presence of verified owners
- presence of challenge claims against verified household

Definitions:

- active independent claim = non-terminal claimant not marked as merged
- verified household authority = active verified owner in `HomeOwner` or otherwise approved authority if later extended

Rules:

1. no verified household authority + no active claims -> `unclaimed`
2. no verified household authority + one active claim -> `pending_single_claim`
3. no verified household authority + two or more active independent claims -> `contested`
4. verified household authority + no qualifying challenge -> `verified_household`
5. verified household authority + qualifying active challenge -> `disputed`

## Claim Strength Derivation

Derive from claimant type plus best evidence on the claim.

Initial routing table:

- resident + weak residency evidence -> `resident_low`
- resident + acceptable residency evidence -> `resident_standard`
- owner + tax/mortgage-level evidence -> `owner_standard`
- owner + closing/escrow-level evidence -> `owner_strong`
- owner + deed/title-level evidence -> `owner_legal`

This is a routing heuristic, not final adjudication.

## Admin Requirements For Backend/API

Before enabling parallel claims, the backend must support a comparison payload.

### New comparison response shape

For contested/disputed homes:

```json
{
  "home_id": "uuid",
  "household_resolution_state": "contested",
  "incumbent": { "owner_id": "uuid", "challenge_state": "challenged" },
  "claims": [
    {
      "id": "uuid",
      "claim_phase_v2": "under_review",
      "claim_type": "owner",
      "claim_strength": "owner_legal",
      "evidence": []
    }
  ]
}
```

Minimum read endpoint:

- `GET /api/homes/:id/ownership-claims/compare`

This can be admin-only or owner/support-only in the first version.

## Mobile/Web Compatibility

### Phase 1

No flow changes required.

Clients may receive additive fields but should continue using legacy `status`.

### Phase 2

Update claim screens to:

- allow parallel claim submission
- show a notice when another claim exists
- continue uploading claimant-specific evidence

Do not require full redesign before backend support is ready.

### Phase 3

Add:

- verified-owner pending-claim resolution UI
- invite-to-household merge UI
- challenge UI for stronger ownership claims

## Migration Plan

### Migration A: additive schema only

Safe additive migration:

- create new enums
- add new columns with safe defaults
- backfill `claim_phase_v2` from existing `state`
- backfill `Home.household_resolution_state`
- do not remove old index or old columns

### Migration B: read-path enablement

- backend starts populating new fields on create/update
- no behavior changes for submission blocking yet

### Migration C: parallel claims enablement

Preconditions:

- comparison API available
- admin tooling can view side-by-side claims
- reconciliation job is deployed

Then:

- drop `idx_home_claim_active_unique`
- remove `otherInFlight` block from `canSubmitOwnerClaim()`
- enable `household_claim_parallel_submission`

### Migration D: invite/merge

- enable new resolve-relationship endpoint
- enable accept-merge endpoint
- begin setting `merged_into_household`

### Migration E: challenge flow

- enable challenge endpoint
- turn on `disputed` reconciliation

## Testing Requirements

Minimum test matrix before each phase.

### Phase 1

- backfill mapping from existing states
- legacy routes still return expected payloads
- no unrelated home route regressions

### Phase 2

- second claimant on same home can submit
- both claims remain attached to same home
- evidence uploads remain claimant-specific
- home resolution transitions to `contested`

### Phase 3

- verified owner can invite pending claimant
- claimant merge preserves evidence
- merged claim never grants access before identity confirmation

### Phase 4

- strong challenge moves home to `disputed`
- challenger rejection clears `disputed`
- incumbent remains intact until adjudication completes

## Rollout Stop Conditions

Do not proceed to the next phase if any of these are unresolved:

- claim submission accidentally grants access
- legacy clients cannot interpret claim status
- comparison payload is incomplete for contested homes
- `disputed` homes cannot reliably exit
- duplicate-claim or merge operations destroy evidence history

## File-Level Implementation Map

Primary backend files expected to change:

- `backend/routes/homeOwnership.js`
- `backend/utils/homeSecurityPolicy.js`
- `backend/routes/home.js`
- `backend/services/homeClaimRoutingService.js` (new)
- `backend/jobs/expireInitiatedHomeClaims.js` (new)
- `backend/jobs/reconcileHomeHouseholdResolution.js` (new)

Primary schema/migration files expected:

- new migration for additive enums/columns
- later migration to drop `idx_home_claim_active_unique`

Primary frontend/API files expected later:

- `frontend/packages/api/src/endpoints/homeOwnership.ts`
- claim-owner screens in mobile/web
- owner review/admin-equivalent surfaces

## Explicit Do-Not-Change List For Initial Implementation

The first implementation pass must not:

- rewrite `HomeOwner` semantics
- rewrite `HomeOccupancy` attach rules
- change `AddressClaim` behavior
- change invite token acceptance for existing verified homes
- change residency claim logic outside the household-claim routing boundary
- remove or reinterpret `Home.security_state`

## Recommended Next Step

Use this spec to produce the first concrete engineering task list:

1. additive migration
2. backfill script
3. routing service scaffold
4. compatibility changes in claim create/evidence/review paths
5. comparison API
6. only then the index removal and parallel-claim enablement
