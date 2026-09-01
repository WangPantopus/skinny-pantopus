# Home Household Claim Engineering Task Breakdown

## Purpose

Break the implementation spec into concrete engineering phases and tasks that can be executed without breaking unrelated app behavior.

This document is the execution plan for:

- `docs/home-household-claim-state-machine-design-2026-04-04.md`
- `docs/home-household-claim-implementation-spec-2026-04-04.md`

## Execution Principles

1. Prefer additive changes before behavioral changes.
2. Preserve legacy `HomeOwnershipClaim.state` behavior until all read/write paths are migrated.
3. Do not remove the single-active-claim constraint until comparison tooling and reconciliation logic are ready.
4. Ship each phase behind explicit feature flags where behavior changes.
5. Treat `HomeOwner` and `HomeOccupancy` as authority sources throughout the rollout.

## Phase Overview

### Phase 0: Instrumentation and Readiness

Goal:

- measure current ownership claim failures and identify all claim-state consumers before changing behavior

### Phase 1: Additive Schema and Compatibility Backfill

Goal:

- introduce new enums/columns and compatibility data without changing user-visible behavior

### Phase 2: Backend Read/Write Compatibility

Goal:

- write and maintain the new model in parallel with the old one while preserving current responses

### Phase 3: Admin Comparison and Reconciliation Infrastructure

Goal:

- provide operational support required before parallel claims are enabled

### Phase 4: Parallel Claim Submission

Goal:

- allow multiple independent ownership claimants on the same home

### Phase 5: Invite/Merge Resolution

Goal:

- let verified household authorities resolve redundant pending claimants safely

### Phase 6: Challenge and Dispute Hardening

Goal:

- support challenge flows against verified households with deterministic dispute exit

### Phase 7: Frontend UX Rollout

Goal:

- expose new flows in mobile/web after backend support is stable

### Phase 8: Cleanup and Deletion of Transitional Logic

Goal:

- remove obsolete compatibility branches after migration is complete

## Phase 0: Instrumentation and Readiness

### Task 0.1: Inventory claim-state consumers

Files to inspect/update:

- `backend/routes/homeOwnership.js`
- `backend/routes/home.js`
- `frontend/packages/api/src/endpoints/homeOwnership.ts`
- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/evidence.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/claim-owner/evidence/page.tsx`
- any dashboard or owner-management surfaces that render claim status

Deliverable:

- list of all read/write paths that depend on `HomeOwnershipClaim.state`

Acceptance criteria:

- every route, job, and UI surface that reads claim state is identified
- every place that writes claim state is identified

### Task 0.2: Add operational metrics

Files to update:

- `backend/routes/homeOwnership.js`
- `backend/utils/logger.js` if needed

Metrics/events:

- ownership claim blocked by `EXISTING_IN_FLIGHT_CLAIM`
- ownership claim blocked by cooldown/rental/frozen state
- evidence upload attempts by legacy state
- review actions by old state

Acceptance criteria:

- logs distinguish policy-blocked vs DB-blocked claim attempts
- logs include `home_id`, `claimant_user_id`, and routing-relevant metadata

### Task 0.3: Add feature flags

Files to update:

- existing feature flag/config system
- backend config loader

Flags:

- `household_claim_v2_read_paths`
- `household_claim_parallel_submission`
- `household_claim_invite_merge`
- `household_claim_challenge_flow`
- `household_claim_admin_compare`

Acceptance criteria:

- flags available in backend config
- flags default to off

## Phase 1: Additive Schema and Compatibility Backfill

### Task 1.1: Add new enums and columns

Files to add/update:

- new migration in `supabase/migrations/`
- if needed, mirrored migration in `backend/database/migrations/`

Schema additions:

- `Home.household_resolution_state`
- `Home.household_resolution_updated_at`
- `HomeOwnershipClaim.claim_phase_v2`
- `HomeOwnershipClaim.terminal_reason`
- `HomeOwnershipClaim.challenge_state`
- `HomeOwnershipClaim.claim_strength`
- `HomeOwnershipClaim.routing_classification`
- `HomeOwnershipClaim.identity_status`
- `HomeOwnershipClaim.merged_into_claim_id`
- `HomeOwnershipClaim.expires_at`
- `HomeVerificationEvidence.confidence_level`

Acceptance criteria:

- migration is additive only
- no existing columns removed or renamed
- migration is reversible if your migration framework supports rollback

### Task 1.2: Backfill compatibility data

Files to add/update:

- migration SQL or backfill script

Backfill requirements:

- populate `claim_phase_v2` from existing `state`
- populate `terminal_reason` with safe defaults
- populate `challenge_state` with `challenged` for legacy `disputed`
- populate `Home.household_resolution_state` from current claims and verified owners

Acceptance criteria:

- all existing ownership claims have a non-null `claim_phase_v2`
- all homes have a non-null `household_resolution_state`

### Task 1.3: Add indexes for new read paths

Files to update:

- same migration as above

Acceptance criteria:

- indexes created without affecting current writes
- explain plan for compare/reconciliation queries is acceptable

## Phase 2: Backend Read/Write Compatibility

### Task 2.1: Create `homeClaimRoutingService`

Files to add:

- `backend/services/homeClaimRoutingService.js`

Initial methods:

- `mapLegacyStateToPhaseV2()`
- `recalculateHomeResolutionState(homeId)`
- `deriveClaimStrength(claimId)`
- `classifySubmission(...)`

Phase 2 constraint:

- service may compute classifications, but must not yet allow parallel claims if the flag is off

Acceptance criteria:

- unit-testable pure helpers exist for state mapping and resolution-state derivation
- service can be called from routes without changing current user-visible behavior

### Task 2.2: Write v2 fields on claim creation

Files to update:

- `backend/routes/homeOwnership.js`

Behavior:

- keep legacy `state`
- also write:
  - `claim_phase_v2`
  - `routing_classification`
  - `identity_status`
  - `expires_at` for initiated claims if applicable

Acceptance criteria:

- claim creation still returns current payload shape
- new fields are populated for new claims

### Task 2.3: Write v2 fields on evidence upload

Files to update:

- `backend/routes/homeOwnership.js`

Behavior:

- when evidence is added, update `claim_phase_v2`
- derive or refresh `claim_strength`
- leave current legacy transitions intact

Acceptance criteria:

- legacy evidence upload flow still works
- v2 fields update deterministically after upload

### Task 2.4: Write v2 fields on review actions

Files to update:

- `backend/routes/homeOwnership.js`

Behavior:

- approve/reject/flag continues to update legacy state
- also updates `claim_phase_v2`, `terminal_reason`, and `challenge_state`
- recalculates `Home.household_resolution_state`

Acceptance criteria:

- no regression to current claim approval flow
- verified claims and rejected claims receive correct v2 data

### Task 2.5: Add read-path compatibility helpers

Files to update:

- `backend/routes/homeOwnership.js`
- `frontend/packages/api/src/endpoints/homeOwnership.ts` if additive fields are typed now

Acceptance criteria:

- current clients can ignore new fields
- backend can expose new fields only when `household_claim_v2_read_paths` is on

## Phase 3: Admin Comparison and Reconciliation Infrastructure

### Task 3.1: Add comparison query/service

Files to add/update:

- `backend/services/homeClaimRoutingService.js`
- optionally new service `backend/services/homeClaimComparisonService.js`

Responsibilities:

- fetch all active claimants for a home
- fetch incumbent verified owners
- fetch evidence side-by-side
- include challenge and routing metadata

Acceptance criteria:

- service returns complete comparison payload for contested/disputed homes

### Task 3.2: Add comparison endpoint

Files to update:

- `backend/routes/homeOwnership.js`

Endpoint:

- `GET /:id/ownership-claims/compare`

Access:

- admin/support or owner-level restricted

Acceptance criteria:

- endpoint returns side-by-side comparison payload
- authorization is explicit and tested

### Task 3.3: Add reconciliation jobs

Files to add:

- `backend/jobs/expireInitiatedHomeClaims.js`
- `backend/jobs/reconcileHomeHouseholdResolution.js`

Behavior:

- expire initiated claims with no evidence
- recompute `household_resolution_state`
- exit `disputed` when challengers terminate

Acceptance criteria:

- jobs are idempotent
- jobs can run repeatedly without state corruption

### Task 3.4: Register/schedule jobs

Files to update:

- cron/job registration entrypoints

Acceptance criteria:

- jobs run in non-destructive dry-run mode first if possible
- logs clearly report promoted, expired, reconciled, and skipped rows

## Phase 4: Parallel Claim Submission

### Preconditions

Do not begin Phase 4 until all are true:

- v2 fields are being written reliably
- comparison endpoint exists
- reconciliation jobs exist
- admin/support can inspect contested homes

### Task 4.1: Remove hard block in policy

Files to update:

- `backend/utils/homeSecurityPolicy.js`

Behavior change:

- stop treating `otherInFlight` as a hard block when `household_claim_parallel_submission` is on
- instead classify the submission as `parallel_claim` or `challenge_claim`

Acceptance criteria:

- with flag off: current behavior unchanged
- with flag on: second claimant is allowed through

### Task 4.2: Drop unique partial index

Files to add/update:

- new migration in `supabase/migrations/`

Change:

- drop `idx_home_claim_active_unique`

Acceptance criteria:

- migration only applied after Phase 4 backend code is deployed
- no duplicate-row corruption from old assumptions

### Task 4.3: Update claim creation flow to set home resolution state

Files to update:

- `backend/routes/homeOwnership.js`
- `backend/services/homeClaimRoutingService.js`

Expected behavior:

- first claimant -> `pending_single_claim`
- second independent claimant -> `contested`
- strong challenger against verified household -> `disputed`

Acceptance criteria:

- state transitions match the implementation spec

### Task 4.4: Preserve claimant-specific evidence path

Files to verify/update:

- `backend/routes/homeOwnership.js`
- upload endpoints if needed

Acceptance criteria:

- each claimant can upload evidence to their own claim only
- no claimant can attach evidence to another claimant's claim

## Phase 5: Invite/Merge Resolution

### Task 5.1: Add relationship-resolution endpoint

Files to update:

- `backend/routes/homeOwnership.js`

Endpoint:

- `POST /:id/ownership-claims/:claimId/resolve-relationship`

Actions:

- `invite_to_household`
- `decline_relationship`
- `flag_unknown_person`

Acceptance criteria:

- only authorized verified household authorities can use it
- action is fully audited

### Task 5.2: Add merge acceptance endpoint

Files to update:

- `backend/routes/homeOwnership.js`
- possibly identity/verification integration code

Endpoint:

- `POST /:id/ownership-claims/:claimId/accept-merge`

Acceptance criteria:

- identity confirmation is required
- claim becomes `merged_into_household`
- evidence is retained, not deleted

### Task 5.3: Reuse existing attach/invite flows safely

Files to update:

- `backend/routes/home.js`
- `backend/services/occupancyAttachService.js`
- `backend/routes/homeOwnership.js`

Constraint:

- do not break legacy invite acceptance for existing verified homes

Acceptance criteria:

- merge path reuses proven occupancy attach behavior where possible
- no duplicate occupancy/owner records are created

### Task 5.4: Update home resolution after merge

Files to update:

- `backend/services/homeClaimRoutingService.js`
- merge endpoints

Acceptance criteria:

- merged claims stop counting as active independent claimants
- home exits `contested` if merge resolves the only remaining conflict

## Phase 6: Challenge and Dispute Hardening

### Task 6.1: Add challenge endpoint

Files to update:

- `backend/routes/homeOwnership.js`

Endpoint:

- `POST /:id/ownership-claims/:claimId/challenge`

Acceptance criteria:

- only sufficiently strong competing claimants can trigger a challenge path
- home enters `disputed`
- incumbent is marked challenged, not immediately removed

### Task 6.2: Add dispute entry/exit rules

Files to update:

- `backend/services/homeClaimRoutingService.js`
- reconciliation job

Acceptance criteria:

- challenger rejection/withdrawal/expiry clears dispute when appropriate
- incumbent uphold returns home to `verified_household`
- challenger success transfers outcome cleanly

### Task 6.3: Audit and notification coverage

Files to update:

- notification services
- audit log writers

Acceptance criteria:

- all challenge/dispute transitions emit audit events
- user notifications exist for major transitions

## Phase 7: Frontend UX Rollout

### Task 7.1: Update API types

Files to update:

- `frontend/packages/api/src/endpoints/homeOwnership.ts`
- `frontend/packages/api/src/index.ts`

Acceptance criteria:

- additive fields typed
- no breaking changes to existing call signatures

### Task 7.2: Update claim-owner start/evidence UX

Files to update:

- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/index.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/evidence.tsx`
- web equivalents

Behavior:

- when another claim exists, show soft notice instead of hard block
- still allow claimant to proceed when backend flag is on

Acceptance criteria:

- legacy copy remains for flag-off environments
- flag-on environments support parallel submission

### Task 7.3: Add owner-side pending claimant resolution UI

Files to add/update:

- owner management screens
- claim review screens

Acceptance criteria:

- verified owners can invite/decline/flag pending claimants
- UI consumes comparison payload safely

### Task 7.4: Add challenge/dispute UX

Files to update:

- claim-owner and dispute screens

Acceptance criteria:

- stronger challenger can enter dispute path
- disputed homes explain restricted actions clearly

## Phase 8: Cleanup and Deletion of Transitional Logic

### Task 8.1: Remove legacy-only compatibility branches

Files to update:

- `backend/routes/homeOwnership.js`
- `backend/utils/homeSecurityPolicy.js`
- frontend claim readers

Precondition:

- all active clients support v2 fields

### Task 8.2: Reduce reliance on legacy `state`

Files to update:

- all readers/writers of `HomeOwnershipClaim.state`

Acceptance criteria:

- `claim_phase_v2` becomes primary internal lifecycle field
- legacy `state` remains only if needed for backward compatibility

### Task 8.3: Cleanup metrics and flags

Files to update:

- config/flag system
- logging and analytics

Acceptance criteria:

- retired flags removed
- temporary instrumentation either promoted or deleted

## Cross-Phase Testing Matrix

### Backend tests

- claim creation with no other claim
- claim creation with one existing pending claimant
- evidence upload transitions
- review transitions
- merge transitions
- challenge transitions
- home resolution recalculation
- dispute exit reconciliation

### Integration tests

- first claimant + second claimant same home
- verified owner invites pending claimant
- challenger disputes verified incumbent
- rejected challenger restores incumbent state

### Regression checks

- residency claims still work
- invite acceptance still works
- home dashboard still loads
- ownership list still loads
- no accidental access grant from claim rows

## Suggested Work Packages

If multiple engineers are involved, split work like this:

### Workstream A: Schema and services

- Phase 1
- Phase 2.1
- Phase 3.3

### Workstream B: Claim routes and policy

- Phase 2.2 to 2.4
- Phase 4
- Phase 5 backend routes
- Phase 6 backend routes

### Workstream C: Admin/support read paths

- Phase 3.1
- Phase 3.2
- later owner/admin review UX

### Workstream D: Frontend UX

- Phase 7 only after backend contracts settle

## Recommended Immediate Next Tasks

Start with these in order:

1. Phase 0.1 inventory of claim-state consumers
2. Phase 0.2 instrumentation
3. Phase 0.3 feature flags
4. Phase 1.1 additive migration
5. Phase 1.2 compatibility backfill
6. Phase 2.1 routing service scaffold

That sequence gives the team a safe starting point without changing user-facing behavior too early.
