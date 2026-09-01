# Home Household Claim `under_review` Drift Audit

## Purpose

Confirm whether `under_review` is a valid persisted `HomeOwnershipClaim.state` value or only a masked/presentation-layer status, and identify the codepaths affected by the mismatch.

## Conclusion

`under_review` is **not** defined in the checked-in `ownership_claim_state` enum and is **not written** to `HomeOwnershipClaim.state` anywhere in the repository.

In the current repo state, `under_review` is a **presentation-layer status** used to mask multiple internal non-terminal claim states for claimant-facing UI and API responses.

That means any backend database filters using `under_review` against `HomeOwnershipClaim.state` are likely stale, misleading, or dependent on untracked production schema drift.

## Evidence

### Checked-in enum definitions do not include `under_review`

Files:

- `backend/database/migrations/031_home_ownership_identity_system.sql`
- `backend/database/schema.sql`

Enum values present:

- `draft`
- `submitted`
- `needs_more_info`
- `pending_review`
- `pending_challenge_window`
- `approved`
- `rejected`
- `disputed`
- `revoked`

### No repo migration adds `under_review`

Search result:

- no migration in repo adds `under_review` to `ownership_claim_state`

### No repo code writes `state = 'under_review'` for ownership claims

Search result:

- no `HomeOwnershipClaim` insert/update writes `under_review`
- no ownership-claim-specific SQL adds or updates that state

### `under_review` is explicitly used as a masked claimant-facing status

File:

- `backend/routes/homeOwnership.js`

Key behavior:

- `maskClaimState(state)` returns:
  - `approved` for terminal approved
  - `rejected` for terminal rejected
  - `revoked` for terminal revoked
  - `under_review` for everything else

Related API type:

- `frontend/packages/api/src/endpoints/homeOwnership.ts`

`ClaimState` is defined as:

- `under_review`
- `approved`
- `rejected`
- `revoked`

This confirms `under_review` exists in the client contract as a masked status, not necessarily as a database enum value.

## Affected Ownership Codepaths

These locations currently filter `HomeOwnershipClaim.state` using `under_review`.

### `backend/routes/homeOwnership.js`

Affected query:

- existing-claim lookup includes `under_review` in `.in('state', ...)`

Interpretation:

- likely harmless if no row can ever have that value
- but semantically misleading and should be corrected

### `backend/routes/home.js`

Affected queries:

- pending claim lookup for home summaries
- pending claim lookup for home detail/dashboard response

Interpretation:

- pending-claim detection may still work because other valid states are included
- but the query is inconsistent with schema and should be normalized

### `backend/routes/upload.js`

Affected query:

- uploadable claim states include `under_review`

Interpretation:

- if `under_review` is not a valid persisted state, this branch is dead code
- the allowed-state list should be aligned to the real enum

## Non-Issue Clarification

This audit does **not** imply claimant-facing `under_review` is wrong.

That masked status is useful and should likely remain at the API/UI layer for opaque claimant messaging.

The problem is specifically:

- using the masked status as if it were a persisted DB state

## Risk

### Risk 1: schema drift blindness

If production somehow has an altered enum that includes `under_review`, the repo is no longer an accurate source of truth.

### Risk 2: misleading query maintenance

Future engineers may assume `under_review` is a valid DB state and propagate the mistake into new queries, migrations, or admin tools.

### Risk 3: bad migration assumptions

The v2 ownership/household claim migration work could incorrectly map or backfill claim lifecycle states if this distinction is not fixed first.

## Recommended Actions

### Immediate

1. Treat `under_review` as masked output only, not a storage state.
2. Remove `under_review` from backend DB state filters unless production schema audit proves it is real.
3. Document the distinction in Phase 0 inventory and implementation notes.

### Before Phase 1 schema work

1. Confirm production enum values for `ownership_claim_state`.
2. Confirm whether any historical migration exists outside the repo.
3. Normalize ownership-claim backend filters to only real persisted states.

### During v2 migration

Keep two distinct concepts:

- persisted lifecycle state
- claimant-facing masked status

Do not collapse them.

## Recommended Normalization Targets

The following files should be normalized first once production schema is confirmed:

- `backend/routes/homeOwnership.js`
- `backend/routes/home.js`
- `backend/routes/upload.js`

## Final Assessment

This is a real consistency issue, but it looks **contained and understandable**, not deeply systemic.

The safest interpretation is:

- `under_review` is an outward-facing abstraction
- the persisted ownership claim lifecycle remains the enum defined in schema

That distinction should be preserved in all future household-claim work.
