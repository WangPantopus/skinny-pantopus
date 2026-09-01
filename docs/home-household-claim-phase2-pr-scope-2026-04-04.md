# Home Household Claim Phase 2 PR Scope

## Purpose

Define the exact scope of the second implementation PR for the home household claim project.

This PR is intentionally limited to:

- backend read/write compatibility for the new v2 household-claim fields
- zero user-visible behavior changes
- zero parallel-claim enablement
- zero invite/merge behavior changes
- zero challenge/dispute behavior changes

This PR exists to ensure the application starts writing and maintaining the new model before any behavioral switch is turned on.

Related docs:

- `docs/home-household-claim-state-machine-design-2026-04-04.md`
- `docs/home-household-claim-implementation-spec-2026-04-04.md`
- `docs/home-household-claim-engineering-task-breakdown-2026-04-04.md`
- `docs/home-household-claim-phase1-pr-scope-2026-04-04.md`
- `docs/home-household-claim-phase0-inventory-2026-04-04.md`
- `docs/home-household-claim-under-review-drift-audit-2026-04-04.md`

## PR Goal

Start populating and maintaining the new household-claim compatibility fields on all current ownership-claim write paths while preserving all existing route behavior and client-visible semantics.

After this PR:

- new ownership claims populate v2 compatibility fields
- evidence uploads update v2 lifecycle metadata
- review actions update v2 lifecycle metadata
- `Home.household_resolution_state` is recalculated during ownership claim lifecycle changes
- current API responses remain backward compatible

## Strict Non-Goals

This PR must **not** do any of the following:

- allow multiple active ownership claims on one home
- drop or weaken `idx_home_claim_active_unique`
- remove `otherInFlight` blocking logic
- introduce new public endpoints
- change ownership claim submission UX
- change mobile or web claim flows
- expose new v2 states as the default public API contract
- add invite-to-household merge behavior
- add challenger behavior or dispute routing changes
- change `Home.security_state` semantics

## Files Expected In Scope

### Required

- `backend/services/homeClaimRoutingService.js` (new)
- `backend/routes/homeOwnership.js`

### Optional but still in-scope

- `frontend/packages/api/src/endpoints/homeOwnership.ts` only for additive optional types if needed
- unit tests for the new routing/state-mapping service

### Explicitly out of scope for this PR

- `backend/utils/homeSecurityPolicy.js` behavior changes
- `backend/routes/home.js`
- `backend/routes/upload.js`
- `backend/routes/admin.js`
- `backend/routes/homeIam.js`
- job scheduling / cron changes
- mobile/web screen changes
- any migration that drops constraints or changes existing enums

## Core Deliverables

### 1. New internal routing service

Add:

- `backend/services/homeClaimRoutingService.js`

Minimum methods for this PR:

- `mapLegacyStateToPhaseV2(state)`
- `isLegacyStateActive(state)`
- `deriveHomeResolutionState({ activeClaims, hasVerifiedOwner, hasActiveChallenge })`
- `recalculateHomeResolutionState(homeId)`
- `deriveInitialRoutingClassification({ homeId, userId, claimType, method })`
- `deriveInitialIdentityStatus({ method })`
- `deriveClaimStrength(claimId)` returning `null` or conservative values where evidence is insufficient

### 2. Claim creation compatibility writes

Update `POST /api/homes/:id/ownership-claims` to also write:

- `claim_phase_v2`
- `routing_classification`
- `identity_status`
- `expires_at` if the project chooses to start using it immediately

Legacy fields must still be written exactly as today.

### 3. Evidence upload compatibility writes

Update evidence-handling paths to also write:

- `claim_phase_v2`
- `claim_strength` if derivable

Legacy behavior must stay intact.

### 4. Review compatibility writes

Update claim review paths to also write:

- `claim_phase_v2`
- `terminal_reason`
- `challenge_state`
- recomputed `Home.household_resolution_state`

Legacy behavior must stay intact.

### 5. Optional additive read-path exposure

If needed, expose new fields only as additive optional fields and only where safe.

Do not require existing clients to consume them.

## Allowed Behavior Changes

Only the following behavior changes are allowed:

- internal v2 fields become populated and updated
- `Home.household_resolution_state` becomes more current after claim lifecycle changes

No user should observe a flow change in claim submission, evidence upload, approval, or rejection.

## Data Rules

### Legacy-to-v2 mapping

Use the implementation-spec mapping exactly:

- `draft` -> `initiated`
- `submitted` -> `evidence_submitted`
- `needs_more_info` -> `under_review`
- `pending_review` -> `under_review`
- `pending_challenge_window` -> `under_review`
- `approved` -> `verified`
- `rejected` -> `rejected`
- `disputed` -> `challenged`
- `revoked` -> `rejected`

### Claim strength in Phase 2

Do not overfit claim-strength logic in this PR.

Allowed approach:

- set `claim_strength = null` when evidence is absent or ambiguous
- set only conservative obvious values if the evidence-type mapping is straightforward

Do not introduce routing decisions based on `claim_strength` yet.

### Routing classification in Phase 2

`routing_classification` may be conservative in this PR.

Recommended:

- default new claims to `standalone_claim`
- do not yet classify as `parallel_claim` or `challenge_claim` in a way that changes behavior

Rationale:

- Phase 2 should prepare the field, not activate the multi-claim policy

### Identity status in Phase 2

Recommended:

- default to `not_started`
- optionally set to `pending` for methods that inherently represent an identity-bearing verification path if that can be done without ambiguity

## Files and Required Changes

### `backend/services/homeClaimRoutingService.js`

Must contain:

- pure mapping helpers
- home-resolution-state derivation helpers
- minimal DB-backed `recalculateHomeResolutionState(homeId)`

Must not contain:

- parallel-claim enablement logic that changes submission behavior
- invite merge logic
- challenge dispute logic beyond conservative state derivation

### `backend/routes/homeOwnership.js`

May update:

- claim creation
- evidence upload metadata writes
- review metadata writes

Must not change:

- response status codes
- response shapes in breaking ways
- current policy blocking
- current claimant-facing masked status behavior

### `frontend/packages/api/src/endpoints/homeOwnership.ts`

Only if needed:

- add optional types for additive fields such as `claim_phase_v2`
- do not change required existing type fields or current API assumptions

If avoidable, defer frontend typing changes to a later PR.

## Explicit Review Paths In Scope

This PR may update both:

- owner review path in `backend/routes/homeOwnership.js`
- admin review path only if absolutely necessary to keep v2 fields coherent

Preferred approach:

- if admin review must be included for consistency, keep the changes limited to writing v2 fields only

If admin review is touched:

- document that inclusion explicitly in the PR description
- do not change admin route behavior beyond compatibility writes

## House Resolution Recalculation Scope

Allowed triggers in this PR:

- after claim creation
- after evidence upload
- after claim review approve/reject/flag

Conservative derivation rules:

1. verified owner exists and no active challenger -> `verified_household`
2. no verified owner and one active claim -> `pending_single_claim`
3. no verified owner and more than one active claim -> `contested`
4. otherwise -> `unclaimed`

For Phase 2:

- do not attempt advanced `disputed` logic unless it directly mirrors existing `state = 'disputed'`

## Compatibility Constraints

### Must preserve

- `maskClaimState()` behavior
- current `submitOwnershipClaim()` response contract
- current `getMyOwnershipClaims()` masked status behavior
- existing evidence upload permissions and states
- existing owner/admin review action results

### Must not assume

- `under_review` is a valid DB state
- production has untracked schema drift
- frontend is ready to consume v2 fields

## Acceptance Criteria

This PR is complete only if all are true:

1. `homeClaimRoutingService` exists with tested mapping helpers.
2. New claims populate v2 compatibility fields.
3. Evidence uploads keep v2 fields current.
4. Review actions keep v2 fields current.
5. `Home.household_resolution_state` is recalculated on ownership lifecycle changes.
6. Existing ownership endpoints behave the same to current clients.
7. No parallel-claim behavior is enabled.
8. No unique constraint or blocking behavior is removed.

## Validation Checklist

### Claim creation

- creating a normal ownership claim still succeeds exactly as before
- legacy `state` remains unchanged
- new v2 columns are populated

### Evidence upload

- upload still allowed in the same legacy states
- `claim_phase_v2` updates correctly
- no claimant-facing response changes

### Review

- approve still promotes owner exactly as before
- reject still rejects exactly as before
- needs-more-info / flag path still behaves as before
- v2 fields reflect the outcome

### Home resolution

- home with verified owner backfills/remains `verified_household`
- home with one active claim computes `pending_single_claim`
- no current route starts depending on this field yet

## Testing Requirements

Recommended minimum tests:

- unit tests for `mapLegacyStateToPhaseV2`
- unit tests for `deriveHomeResolutionState`
- integration test for claim creation writing v2 fields
- integration test for evidence upload updating v2 fields
- integration test for review updating v2 fields

Regression checks:

- ownership claim submit endpoint unchanged
- my-claims endpoint unchanged
- evidence upload unchanged
- owner review unchanged

## Rollback Notes

If rollback is needed:

- disable any code path reading the new v2 fields
- keep additive schema in place
- revert only the compatibility writes

Do not attempt to remove the Phase 1 schema additions during a quick rollback unless absolutely necessary.

## Reviewer Checklist

Reviewers should explicitly confirm:

1. No submission blocking behavior changed.
2. No route contract changed in a breaking way.
3. No mobile/web flow changes were introduced.
4. No parallel-claim behavior was accidentally enabled.
5. `under_review` was not reintroduced as a persisted DB state.
6. Home-resolution-state recalculation is conservative and side-effect-safe.

## Suggested Commit / PR Boundary

This should ideally be one PR containing:

- new routing service
- compatibility writes in ownership claim routes
- minimal tests

Do not combine this PR with:

- Phase 1 migration work, if that has not landed yet
- admin comparison API
- job scheduling
- invite/merge
- challenge/dispute expansion
- frontend UX changes

## Follow-Up PR After Phase 2

The next PR after this one should be:

- Phase 3 admin comparison and reconciliation infrastructure

Not:

- parallel claims directly

That keeps the rollout safe and preserves the sequence required to avoid regressions.
