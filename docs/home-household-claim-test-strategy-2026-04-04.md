# Home Household Claim Test Strategy

## Purpose

Define the test strategy for the home household claim rollout so implementation can proceed in phases without breaking existing app behavior.

This document complements the design, implementation spec, engineering breakdown, and PR scope docs by answering:

- what to test
- when to test it
- which layer should own each test
- what must be true before each phase can merge or roll out

## Guiding Principles

1. Protect existing behavior first.
2. Prefer narrow deterministic tests over broad brittle end-to-end tests when possible.
3. Add tests only where they materially reduce rollout risk.
4. Separate compatibility validation from new-behavior validation.
5. Do not rely on manual QA alone for state-machine transitions.

## Primary Risk Areas

The rollout has a few high-risk categories that must be tested explicitly.

### 1. Silent behavior drift in existing claim flows

Examples:

- ownership claim submit changes response shape
- evidence upload no longer works for existing claim states
- dashboard loses pending claim link behavior

### 2. Incorrect v2 field maintenance

Examples:

- `claim_phase_v2` not populated
- `household_resolution_state` recalculated incorrectly
- review actions update legacy state but not v2 state

### 3. Accidental access grant

Examples:

- a claim row is treated like verified ownership
- pending claimant gains occupancy/owner capabilities

### 4. Dispute/merge audit loss

Examples:

- merged claims lose evidence history
- challenge exit leaves home stuck in `disputed`

### 5. Schema/state drift

Examples:

- `under_review` used as a persisted DB state
- migration backfill misclassifies old data

## Test Layers

### Layer A: Migration and backfill validation

Use for:

- additive schema PRs
- compatibility backfill correctness

Best fit:

- migration test database
- SQL assertions
- one-off verification scripts

### Layer B: Pure unit tests

Use for:

- state mapping
- home resolution derivation
- conservative routing helpers

Best fit:

- `homeClaimRoutingService` helper methods

### Layer C: Route integration tests

Use for:

- claim creation
- evidence upload
- review transitions
- compatibility fields being written

Best fit:

- backend integration tests with real DB fixtures or realistic mocks

### Layer D: Regression tests for existing home flows

Use for:

- dashboard loading
- invite acceptance
- home IAM `/me`
- home creation with ownership claim seeding

Best fit:

- existing backend integration tests
- targeted frontend smoke checks only where backend behavior affects routing

### Layer E: Manual QA / release checklist

Use for:

- final verification of user-visible flows after phase rollouts
- flag-on vs flag-off behavior

Manual QA should validate critical paths, but should not replace automated checks for state transitions.

## Existing Test Surfaces To Reuse

Current known backend test files include:

- `backend/tests/integration/homeOnboarding.test.js`
- `backend/tests/integration/home-mailbox.test.js`
- `backend/tests/unit/homePermissions.test.js`
- `backend/tests/unit/homeIam.test.js`
- `backend/tests/unit/homeInviteTokens.test.js`
- `backend/tests/unit/homeCheckAddress.test.js`
- `backend/tests/unit/postCreateHomePlaceContract.test.js`

These should be treated as regression anchors when claim-related backend behavior changes.

## Phase-by-Phase Strategy

## Phase 1: Additive Schema and Compatibility Backfill

Goal:

- ensure new schema lands safely with no behavior change

### Required tests

#### Migration tests

- migration applies cleanly on current schema
- migration can run on a database with representative existing `HomeOwnershipClaim` rows
- indexes and foreign keys are created successfully

#### Backfill assertions

- `draft` -> `initiated`
- `submitted` -> `evidence_submitted`
- `needs_more_info` -> `under_review`
- `pending_review` -> `under_review`
- `pending_challenge_window` -> `under_review`
- `approved` -> `verified`
- `rejected` -> `rejected`
- `disputed` -> `challenged`
- `revoked` -> `rejected`

#### Home resolution backfill assertions

- home with no verified owner and no active claim -> `unclaimed`
- home with one active claim -> `pending_single_claim`
- home with multiple active claims -> `contested`
- home with verified owner and no challenger -> `verified_household`

#### Regression checks

- no route tests fail after schema changes
- no client contract changes required

### Merge gate for Phase 1

Do not merge unless:

- migration/backfill verified on representative data
- no existing route behavior changed
- no `under_review` enum value is introduced into persisted ownership schema

## Phase 2: Backend Read/Write Compatibility

Goal:

- keep v2 fields up to date without changing user-visible behavior

### Required unit tests

For `homeClaimRoutingService`:

- `mapLegacyStateToPhaseV2`
- `isLegacyStateActive`
- `deriveHomeResolutionState`

Test cases should include:

- terminal and non-terminal legacy states
- disputed/challenged mapping
- homes with zero, one, and multiple active claims

### Required integration tests

#### Claim creation

- claim submission still succeeds with current response shape
- legacy `state` written exactly as before
- `claim_phase_v2` written
- `routing_classification` written conservatively
- `identity_status` defaults correctly

#### Evidence upload

- upload still allowed for current legacy states
- upload still rejected for non-uploadable legacy states
- `claim_phase_v2` updates after evidence upload
- `claim_strength` remains null or conservative without changing flow

#### Review actions

- approve updates legacy `state` and v2 fields
- reject updates legacy `state` and v2 fields
- needs-more-info/flag path updates v2 fields without changing current outcome semantics

#### Home resolution recalculation

- home resolution state updates after claim create/review
- no existing route starts depending on it by accident

### Regression checks

- `backend/routes/homeOwnership.js` endpoints unchanged to current clients
- `backend/routes/home.js` still returns dashboard/home data correctly
- `backend/routes/upload.js` still enforces the same behavior
- `backend/routes/homeIam.js` still returns the same ownership-claim-state contract

### Merge gate for Phase 2

Do not merge unless:

- existing integration tests pass
- new compatibility tests pass
- no user-visible status contract changes
- no parallel-claim behavior is enabled

## Phase 3: Admin Comparison and Reconciliation Infrastructure

Goal:

- make contested/disputed states operable before enabling multi-claim behavior

### Required unit tests

- comparison payload builder returns all active claims and incumbent data
- reconciliation logic computes correct `household_resolution_state`
- dispute exit logic clears `disputed` only when appropriate

### Required integration tests

- `GET /ownership-claims/compare` authorization works
- compare endpoint returns side-by-side evidence and claim metadata
- expire-initiated-claims job transitions claims correctly
- reconciliation job is idempotent

### Operational tests

- dry-run job logging is readable
- repeated job execution does not corrupt state

### Merge gate for Phase 3

Do not merge unless:

- comparison payload is complete enough for admin review
- reconciliation jobs are safe to rerun
- no existing invite, dashboard, or claim flow regressed

## Phase 4: Parallel Claim Submission

Goal:

- allow multiple independent ownership claimants on the same home

### Required integration tests

- first claimant can submit as before
- second claimant on same home can now submit when flag is on
- second claimant is still blocked when flag is off
- both claims remain attached to the same home
- claimant A cannot upload to claimant B’s claim
- home resolution becomes `contested`

### Required regression tests

- current single-claim behavior preserved in flag-off mode
- evidence upload still works for the original claimant
- dashboard and owners list still load

### Manual QA

- flag-off environment: unchanged behavior
- flag-on environment: second claimant sees new allowed flow

### Rollout gate for Phase 4

Do not enable in production unless:

- Phase 3 compare/reconciliation is already deployed
- support/admin can inspect contested homes
- metrics exist for contested submission volume and failure reasons

## Phase 5: Invite/Merge Resolution

Goal:

- let verified household authority resolve redundant pending claimants

### Required integration tests

- verified owner can issue resolution action
- pending claimant can accept merge only with valid invite
- identity confirmation is required
- claim becomes `merged_into_household`
- evidence remains preserved
- merged claimant does not create duplicate owner/occupancy records

### Required regression tests

- existing invite token acceptance still works
- existing owner invite flow still works

### Manual QA

- verified owner sees pending claimant resolution options
- claimant accepts merge and lands in correct household outcome

### Merge gate for Phase 5

Do not merge unless:

- merge path preserves evidence history
- identity gate is enforced
- old invite paths are not broken

## Phase 6: Challenge and Dispute Hardening

Goal:

- allow strong competing ownership claims to challenge a verified household safely

### Required integration tests

- strong challenger can trigger dispute path
- incumbent moves to challenged state, not immediate loss of access
- challenger rejection clears `disputed`
- challenger expiry clears `disputed`
- incumbent uphold restores `verified_household`
- challenger success transfers verified outcome cleanly

### Required regression tests

- `Home.security_state` restrictions still behave correctly
- no unrelated home operations become blocked unexpectedly

### Manual QA

- disputed home shows restricted-action messaging
- support/admin can understand both claims and outcome

### Merge gate for Phase 6

Do not merge unless:

- dispute exit is deterministic
- audit trail is complete
- notifications for major dispute transitions exist

## Cross-Cutting Regression Suite

These checks should be run repeatedly across phases.

### Home creation and ownership seeding

- creator can still create a home
- initial owner-claim seeding still works as before

### Dashboard and home detail

- home dashboard loads
- pending claim deep-link behavior still works
- owners list still renders

### IAM and access

- `/api/homes/:id/me` still returns expected ownership claim info
- pending claims do not grant access
- verified ownership still grants access

### Upload

- ownership evidence upload still accepts correct states
- unauthorized claimant cannot upload to another claim

### Admin flows

- admin review path still works
- owner review path still works

### Residency and unrelated home flows

- residency claims still work
- invite acceptance still works
- mailbox/home ancillary tests still pass if touched transitively

## Recommended Test Ownership

### Migration/backfill tests

Owned by:

- schema/migration workstream

### Routing service unit tests

Owned by:

- backend services workstream

### Claim route integration tests

Owned by:

- backend claim-route workstream

### Frontend smoke and QA

Owned by:

- frontend workstream once phase 7 begins

## Test Data Requirements

Create representative fixtures for:

- home with no owner and no claim
- home with one active claim
- home with multiple active claims
- home with verified owner
- home with disputed challenger
- claim with deed evidence
- claim with lease/utility evidence
- claim with rejected/revoked/disputed legacy states

These fixtures should be reusable across phases to prevent drift in test assumptions.

## What Not To Over-Test Early

Avoid adding noisy tests that merely restate simple field mappings in many places.

Prefer:

- concentrated unit coverage for mapping/derivation helpers
- focused integration coverage for route writes and access behavior

Do not add broad UI tests in early phases unless a route contract changes in a way that truly needs them.

## Release Checklist Template

Before enabling a new phase in production:

1. Confirm phase-specific automated tests pass.
2. Confirm regression suite passes.
3. Confirm flag-off behavior still matches current production behavior.
4. Confirm rollout metrics and logs exist.
5. Confirm rollback path is documented.
6. Confirm support/admin has visibility for any new contested/disputed state introduced.

## Recommended Immediate Next Use

Use this test strategy as the reviewer checklist companion when the first implementation PR is opened:

- Phase 1 PR uses Phase 1 section
- Phase 2 PR uses Phase 2 section

That keeps testing aligned with the staged rollout instead of ad hoc validation.
