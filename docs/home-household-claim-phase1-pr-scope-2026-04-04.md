# Home Household Claim Phase 1 PR Scope

## Purpose

Define the exact scope of the first implementation PR for the home household claim project.

This PR is intentionally limited to:

- additive schema preparation
- compatibility backfill
- zero user-visible behavior changes
- zero parallel-claim behavior changes

This document is designed to prevent scope creep and reduce regression risk.

Related docs:

- `docs/home-household-claim-state-machine-design-2026-04-04.md`
- `docs/home-household-claim-implementation-spec-2026-04-04.md`
- `docs/home-household-claim-engineering-task-breakdown-2026-04-04.md`
- `docs/home-household-claim-phase0-inventory-2026-04-04.md`
- `docs/home-household-claim-under-review-drift-audit-2026-04-04.md`

## PR Goal

Prepare the data model for the new household-claim system without changing how the app behaves today.

After this PR:

- the database can store v2 household-claim metadata
- existing ownership claims are backfilled into the new compatibility fields
- homes have an initial computed household-resolution state
- existing routes and clients continue to behave exactly as before

## Strict Non-Goals

This PR must **not** do any of the following:

- allow multiple active ownership claims on one home
- drop `idx_home_claim_active_unique`
- change ownership claim submission behavior
- change evidence upload behavior
- add new invite/merge behavior
- add challenge/dispute behavior changes
- change mobile or web UX
- change `Home.security_state` semantics
- reinterpret `HomeOwner` or `HomeOccupancy`

## Files Expected In Scope

### Required

- new migration in `supabase/migrations/`
- optional mirrored migration in `backend/database/migrations/` if this repo requires it
- `backend/database/schema.sql` only if schema snapshots are normally updated alongside migrations

### Optional but still in-scope

- a backfill helper script if migration-only backfill is not appropriate
- a small internal compatibility helper file if needed for later phases, but only if it is read-only or unused by production behavior

### Explicitly out of scope for this PR

- `backend/routes/homeOwnership.js`
- `backend/routes/home.js`
- `backend/routes/upload.js`
- `backend/routes/admin.js`
- `frontend/packages/api/src/endpoints/homeOwnership.ts`
- any mobile/web screens

Those codepaths should remain untouched in this PR unless a migration framework absolutely requires generated schema updates.

## Schema Additions In Scope

### New enums

- `household_resolution_state`
- `claim_phase_v2`
- `claim_terminal_reason`
- `claim_challenge_state`
- `claim_strength`
- `claim_routing_classification`
- `identity_status`
- `evidence_confidence_level`

### New columns

#### `Home`

- `household_resolution_state`
- `household_resolution_updated_at`

#### `HomeOwnershipClaim`

- `claim_phase_v2`
- `terminal_reason`
- `challenge_state`
- `claim_strength`
- `routing_classification`
- `identity_status`
- `merged_into_claim_id`
- `expires_at`

#### `HomeVerificationEvidence`

- `confidence_level`

### New indexes

- index on `Home.household_resolution_state`
- index on `HomeOwnershipClaim(home_id, claim_phase_v2)`
- index on `HomeOwnershipClaim(home_id, routing_classification)`
- index on `HomeOwnershipClaim(home_id, challenge_state)`
- partial index on `HomeOwnershipClaim(expires_at)` for initiated claims if useful

## Backfill Scope

### Required backfill

#### `HomeOwnershipClaim.claim_phase_v2`

Map from current `state`:

- `draft` -> `initiated`
- `submitted` -> `evidence_submitted`
- `needs_more_info` -> `under_review`
- `pending_review` -> `under_review`
- `pending_challenge_window` -> `under_review`
- `approved` -> `verified`
- `rejected` -> `rejected`
- `disputed` -> `challenged`
- `revoked` -> `rejected`

#### `HomeOwnershipClaim.terminal_reason`

Backfill to:

- `none` by default

Do not attempt deep historical classification in Phase 1.

#### `HomeOwnershipClaim.challenge_state`

Backfill to:

- `challenged` for legacy `state = 'disputed'`
- `none` otherwise

#### `Home.household_resolution_state`

Initial backfill rules:

1. if at least one verified owner exists and no active challenger exists -> `verified_household`
2. else if one active claim exists -> `pending_single_claim`
3. else if more than one active claim exists -> `contested`
4. else -> `unclaimed`

Use a conservative interpretation of "active claim" based on current persisted states:

- `draft`
- `submitted`
- `needs_more_info`
- `pending_review`
- `pending_challenge_window`

Do not use masked `under_review` in migration logic.

## Decisions Deferred To Later PRs

The following remain explicitly deferred:

- exact computation of `claim_strength`
- exact computation of `routing_classification`
- exact use of `identity_status`
- dispute exit reconciliation job
- invite/merge write paths
- challenge-trigger write paths

For Phase 1:

- `claim_strength` may remain null
- `routing_classification` may remain null
- `identity_status` may default to `not_started`

## Migration Design Rules

### Rule 1: additive only

Do not:

- drop old columns
- rename old columns
- alter the existing `ownership_claim_state` enum
- remove existing constraints

### Rule 2: backfill must be idempotent

If rerun accidentally in a partial deploy scenario, it should not corrupt data.

### Rule 3: do not assume production drift

The migration must be based on checked-in schema semantics, not on unverified assumptions such as `under_review` being a real DB enum value.

### Rule 4: avoid heavyweight locks where possible

If the table sizes are large, use migration patterns that reduce lock duration for index creation and backfill where the environment allows it.

## Acceptance Criteria

This PR is complete only if all are true:

1. New enums and columns exist.
2. Existing ownership claims have non-null `claim_phase_v2`.
3. Existing homes have non-null `household_resolution_state`.
4. Existing app behavior is unchanged.
5. No API payloads or route semantics changed.
6. No existing mobile/web screen changes are required.
7. No claim submission behavior changed.
8. No linter/test regressions were introduced by schema snapshot or helper updates.

## Validation Checklist

### Schema validation

- migration applies cleanly on a database with current schema
- migration does not require manual data cleanup
- foreign key on `merged_into_claim_id` is valid

### Data validation

- sample approved claim backfills to `verified`
- sample disputed claim backfills to `challenged`
- sample draft/submitted claim backfills to non-terminal v2 state

### No-behavior-change validation

- existing ownership claim submission still returns the same payload
- existing evidence upload still works
- owners list still works
- dashboard still works
- public profile access still works

## Rollback Notes

Preferred rollback strategy:

- do not attempt to "un-backfill" values
- if rollback is needed, disable use of the new fields at the application layer
- only drop new fields in a dedicated rollback migration if absolutely necessary

This is another reason Phase 1 should avoid behavior changes.

## Reviewer Checklist

Reviewers should explicitly confirm:

1. No route logic changed.
2. No client/API types changed.
3. No unique index was removed.
4. Backfill mappings match the implementation spec exactly.
5. `under_review` was not introduced into the DB enum.
6. Migration is truly additive.

## Suggested Commit / PR Boundary

This should ideally be one PR containing:

- additive migration
- optional schema snapshot update
- optional backfill helper if migration-only approach is not enough

Do not mix this PR with:

- service creation
- backend route changes
- feature flags
- instrumentation changes
- UI changes

Those belong in subsequent PRs.

## Follow-Up PR After Phase 1

The next PR after this one should be:

- Phase 2 backend read/write compatibility

Not:

- parallel claims
- invite/merge
- frontend UX changes

That sequencing keeps the rollout safe and bug-resistant.
