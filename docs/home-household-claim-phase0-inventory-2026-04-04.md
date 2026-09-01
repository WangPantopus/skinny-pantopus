# Home Household Claim Phase 0 Inventory

## Purpose

Inventory every current codepath that reads, writes, filters, or otherwise depends on home ownership claim lifecycle semantics before implementing the v2 household claim model.

This document is a safety checklist. It exists to prevent hidden regressions while the ownership/household claim state machine evolves.

Related docs:

- `docs/home-household-claim-state-machine-design-2026-04-04.md`
- `docs/home-household-claim-implementation-spec-2026-04-04.md`
- `docs/home-household-claim-engineering-task-breakdown-2026-04-04.md`

## High-Risk Findings

### 1. `under_review` schema drift

There is a verified mismatch between checked-in database enum definitions and application code:

- the checked-in `ownership_claim_state` enum includes:
  - `draft`
  - `submitted`
  - `needs_more_info`
  - `pending_review`
  - `pending_challenge_window`
  - `approved`
  - `rejected`
  - `disputed`
  - `revoked`
- multiple backend routes still filter using `under_review`

Affected files:

- `backend/routes/home.js`
- `backend/routes/homeOwnership.js`
- `backend/routes/upload.js`

Implication:

- if production schema matches repo schema, some filters containing `under_review` may be dead or misleading
- if production schema has drifted, the repo no longer accurately describes state behavior

This must be clarified before any v2 migration logic is trusted.

### 2. Single-active-claim behavior is enforced in two places

Current single-lane ownership verification is enforced by:

- application policy in `backend/utils/homeSecurityPolicy.js`
- database unique partial index in `supabase/migrations/20260227000001_home_onboarding_security.sql`

Implication:

- removing only one of them will create inconsistent behavior

### 3. Ownership claim lifecycle is spread across many systems

It is not isolated to one route file. Claim state is coupled to:

- home security state
- owner creation
- occupancy attachment
- admin review
- public profile access
- IAM payloads
- upload validation
- notifications
- SQL functions and migrations

Implication:

- state-machine changes must be phased and compatibility-aware

## Inventory

### A. Direct state writers

These locations create or update `HomeOwnershipClaim` rows or fields directly.

#### `backend/routes/homeOwnership.js`

Primary ownership-claim route handler.

Responsibilities:

- create ownership claims
- update review states
- attach evidence metadata
- create invite/vouch-based claims
- seed ownership-transfer-related claim rows
- set dispute-related home security state

Risk level:

- highest

#### `backend/routes/home.js`

Creates ownership claims during home creation when the creator indicates they are the owner.

Responsibilities:

- insert initial ownership claim from home-creation flow

Risk level:

- high

#### `backend/routes/admin.js`

Contains admin review logic for home claims.

Responsibilities:

- approve/reject/flag claim paths from admin surfaces

Risk level:

- high

#### `backend/utils/homeSecurityPolicy.js`

Does not own the full claim row lifecycle, but it updates claim verification-tier-related data.

Responsibilities:

- recalculates claim tier from evidence

Risk level:

- medium

#### `backend/services/addressValidation/landlordAuthorityService.js`

Creates ownership-claim related records when authority evidence is submitted through landlord flows.

Responsibilities:

- create claim/evidence from landlord authority path

Risk level:

- medium

#### `supabase/migrations/20260227000001_home_onboarding_security.sql`

Historical writer via migration cleanup.

Responsibilities:

- revokes duplicate active claims before creating the active-claim unique index

Risk level:

- high for migration planning

### B. Direct state readers

These locations read `HomeOwnershipClaim` rows or filter by claim state for logic or output.

#### `backend/routes/homeOwnership.js`

Responsibilities:

- list my ownership claims
- list home ownership claims
- load claim detail
- gate evidence upload behavior
- infer existing active claim reuse

Risk level:

- highest

#### `backend/routes/home.js`

Responsibilities:

- public-profile access if user has any claim on the home
- dashboard / home payload pending-claim links
- pending owner status and claim id derivation

Risk level:

- high

#### `backend/routes/homeIam.js`

Responsibilities:

- exposes `ownership_claim_state` to the home IAM `/me` payload
- currently only surfaces `rejected` and `needs_more_info`

Risk level:

- high for dashboard/verification-center UX

#### `backend/routes/upload.js`

Responsibilities:

- validates claim state before ownership evidence upload

Risk level:

- high

#### `backend/routes/admin.js`

Responsibilities:

- pending queue filters
- claim detail review surfaces

Risk level:

- high

#### `backend/utils/homeSecurityPolicy.js`

Responsibilities:

- cooldown logic
- claimant rate limits
- active-claim checks
- other-in-flight checks

Risk level:

- highest for policy correctness

#### `backend/utils/trustState.js`

Responsibilities:

- derives trust behavior from pending ownership claim states

Risk level:

- medium

#### `backend/services/addressValidation/landlordAuthorityService.js`

Responsibilities:

- joins authority/evidence logic against existing claim state

Risk level:

- medium

### C. Indirect lifecycle dependencies

These do not necessarily own claim rows, but they depend on ownership/dispute outcomes or adjacent state.

#### `backend/jobs/notifyClaimWindowExpiry.js`

- notifies users based on claim-window timing

#### `backend/jobs/processClaimWindows.js`

- operates on residency challenge windows
- also resets `Home.security_state` from `claim_window` to `normal`
- overlaps conceptually with ownership claim-window semantics

#### `backend/jobs/index.js`

- schedules claim-window-related jobs

#### `backend/services/notificationService.js`

- sends ownership-claim, dispute, and verification notifications

#### `backend/middleware/rateLimiter.js`

- throttles ownership-claim submission

#### `backend/app.js`

- route mount ordering matters for ownership endpoints such as `/my-ownership-claims`

### D. Database and SQL coupling

These schema/migration files encode current lifecycle semantics and must be updated together with application logic.

#### `backend/database/migrations/031_home_ownership_identity_system.sql`

- defines `ownership_claim_state`
- defines `HomeOwnershipClaim`
- defines claim/evidence indexes and policies

#### `backend/database/schema.sql`

- checked-in consolidated schema
- source of truth for enum drift checks

#### `supabase/migrations/20260227000001_home_onboarding_security.sql`

- creates `idx_home_claim_active_unique`

#### `backend/database/migrations/056_neighbor_trust_function.sql`

- SQL logic references ownership claims

#### `backend/database/migrations/057_search_businesses_function.sql`

- business search logic checks for approved ownership claim state

#### `backend/database/migrations/090_home_graph_remediation.sql`

- backfills ownership-related fields from claim presence

### E. Frontend and API consumers

These locations assume current status/state semantics and will need compatibility handling.

#### API layer

- `frontend/packages/api/src/endpoints/homeOwnership.ts`
- `frontend/packages/api/src/endpoints/homes.ts`
- `frontend/packages/api/src/endpoints/upload.ts`
- `frontend/packages/api/src/endpoints/admin.ts`
- `frontend/packages/api/src/endpoints/landlord.ts`
- `frontend/packages/api/src/index.ts`

Notes:

- ownership status and residency status semantics are separate and already slightly inconsistent across files

#### Mobile

- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/evidence.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/index.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/claim-owner/submitted.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/owners/review-claim.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/owners/index.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/owners/invite.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/owners/transfer.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/settings/security.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/dispute.tsx`
- `frontend/apps/mobile/src/app/homes/[id]/dashboard.tsx`
- `frontend/apps/mobile/src/app/homes/index.tsx`
- `frontend/apps/mobile/src/components/homes/useHomeForm.ts`
- `frontend/apps/mobile/src/components/HomeStatusBanner.tsx`
- `frontend/apps/mobile/src/constants/ownershipCopy.ts`
- `frontend/apps/mobile/src/app/admin/review-claims.tsx`

#### Web

- `frontend/apps/web/src/app/(app)/app/homes/[id]/claim-owner/evidence/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/claim-owner/submitted/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/owners/review-claim/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/owners/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/owners/invite/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/owners/transfer/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/settings/security/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/dispute/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/[id]/page.tsx`
- `frontend/apps/web/src/app/(app)/app/homes/find/page.tsx`
- `frontend/apps/web/src/app/(app)/app/network/page.tsx`
- `frontend/apps/web/src/components/home/useHomePermissions.tsx`
- `frontend/apps/web/src/components/home/VerificationCenter.tsx`
- `frontend/apps/web/src/components/home/ResidencyClaimsPanel.tsx`
- `frontend/apps/web/src/app/(app)/app/admin/review-claims/page.tsx`

## Status Semantics To Watch

### Ownership claim row state

Legacy ownership states in repo schema:

- `draft`
- `submitted`
- `needs_more_info`
- `pending_review`
- `pending_challenge_window`
- `approved`
- `rejected`
- `disputed`
- `revoked`

### Masked claimant-facing status

Current claimant-facing APIs often collapse non-terminal ownership states into:

- `under_review`

This is UI-safe, but risky if consumers start treating it like a stored DB state.

### Home owner status

`HomeOwner.owner_status` is different from claim state:

- `pending`
- `verified`
- `disputed`
- `revoked`

### Residency claim status

Residency claims follow separate semantics and must not be silently conflated with ownership claims.

## Must-Update Checklist Before Parallel Claims

- `backend/utils/homeSecurityPolicy.js`
- `backend/routes/homeOwnership.js`
- `backend/routes/home.js`
- `backend/routes/upload.js`
- `backend/routes/homeIam.js`
- `backend/routes/admin.js`
- `backend/services/addressValidation/landlordAuthorityService.js`
- `backend/services/notificationService.js`
- `backend/database/migrations/031_home_ownership_identity_system.sql`
- `backend/database/schema.sql`
- `supabase/migrations/20260227000001_home_onboarding_security.sql`
- frontend ownership claim API types and status readers
- mobile claim-owner evidence flow
- web claim-owner evidence flow
- owner/admin review screens

## Recommended Immediate Follow-Up

Before any Phase 1 or Phase 2 implementation work:

1. resolve or document the `under_review` enum drift
2. confirm all production schema and migration history around `HomeOwnershipClaim.state`
3. add instrumentation for claim block reasons
4. use this inventory as the baseline checklist when touching any ownership-claim logic
