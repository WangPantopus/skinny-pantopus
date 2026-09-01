# Home Household Claim Decision Log

## Purpose

Record the current decisions for the home household claim redesign in one concise place so implementation PRs do not reinterpret the design midstream.

This is the decision authority document for the docs created on 2026-04-04.

Related docs:

- `docs/home-household-claim-state-machine-design-2026-04-04.md`
- `docs/home-household-claim-implementation-spec-2026-04-04.md`
- `docs/home-household-claim-engineering-task-breakdown-2026-04-04.md`
- `docs/home-household-claim-phase1-pr-scope-2026-04-04.md`
- `docs/home-household-claim-phase2-pr-scope-2026-04-04.md`

## Status

Current project status:

- planning/specification complete enough to begin phased implementation later
- implementation not yet authorized
- no behavior-changing code for the new household-claim model is currently in progress

## Frozen Decisions

These are considered decided unless explicitly reopened.

### D1. Additive rollout, not in-place replacement

Decision:

- evolve the ownership claim model using additive fields and compatibility mapping
- do not replace `HomeOwnershipClaim.state` in place at the start

Reason:

- current routes, clients, and SQL already depend on the legacy field

Impact:

- Phase 1 and Phase 2 remain compatibility-first

### D2. Separate claim lifecycle from household resolution

Decision:

- keep person-level claim lifecycle separate from home-level household resolution state

Fields:

- `HomeOwnershipClaim.claim_phase_v2`
- `Home.household_resolution_state`

Reason:

- prevents overloading `Home.security_state`
- keeps resolution and claimant lifecycle independently understandable

### D3. `Home.security_state` is not being replaced

Decision:

- preserve current `Home.security_state` semantics for operational restrictions

Reason:

- existing flows already rely on `claim_window`, `disputed`, `frozen`, etc.

Impact:

- new household-resolution state is additive

### D4. Evidence belongs to the claimant, not the home

Decision:

- uploaded evidence remains attached to the person’s claim
- merge/invite resolution may archive evidence, but must not delete or reassign it silently

Reason:

- auditability
- dispute resilience

### D5. Metadata belongs to the home

Decision:

- home metadata can be reused/prefilled across claimants
- this does not grant proof-sharing

Reason:

- lower friction without weakening verification integrity

### D6. Invitation may shortcut home-proof, not identity

Decision:

- verified household authority may shortcut home-proof for another person
- invitation must not bypass identity confirmation

Reason:

- preserves household convenience while preventing trust abuse

### D7. First claimant is not inherently stronger

Decision:

- claim timing is not a tiebreaker
- evidence quality and claim type matter more than who arrived first

Reason:

- required to protect rightful owners against earlier bad-faith claimants

### D8. Parallel claims are allowed only after prerequisites

Decision:

- the product direction is to allow multiple independent claimants on the same home
- but this must not happen until:
  - additive schema lands
  - compatibility writes land
  - comparison API exists
  - reconciliation jobs exist

Reason:

- removing the unique index before the ecosystem is ready would be unsafe

### D9. `under_review` is a presentation-layer status, not a persisted ownership enum

Decision:

- treat `under_review` as masked claimant-facing output
- do not use it as the source-of-truth DB state for `HomeOwnershipClaim.state`

Reason:

- checked-in schema does not define it as a valid enum value

Reference:

- `docs/home-household-claim-under-review-drift-audit-2026-04-04.md`

### D10. Phase 1 is schema-only

Decision:

- first implementation PR should be additive schema + compatibility backfill only

Reason:

- smallest safe slice
- no route or UI behavior changes

### D11. Phase 2 is compatibility-write only

Decision:

- second implementation PR should update backend write paths to maintain v2 fields
- still no parallel-claim enablement

Reason:

- lets the new model become trustworthy before behavior depends on it

### D12. Admin comparison support is required before parallel claims

Decision:

- do not enable parallel claims until there is a side-by-side claim comparison view/API

Reason:

- contested/disputed homes are not operable without comparison tooling

### D13. Automatic approval by queue delay is not accepted

Decision:

- contested claims should not auto-advance toward approval just because admin is slow

Allowed instead:

- admin priority escalation
- stale queue alerts
- operational SLA handling

Reason:

- queue delay is an operations problem, not evidence of claim correctness

### D14. Explicit terminal reasons are required

Decision:

- terminal claim outcomes must remain distinguishable

Examples:

- withdrawn
- expired
- merged into household
- rejected
- superseded

Reason:

- analytics
- admin tooling
- dispute traceability

## Deferred Decisions

These are intentionally not frozen yet and may need approval before implementation reaches later phases.

### Q1. One claim table vs specialized tables

Still open:

- keep owner/resident claims in one table
- or split specialized tables with a shared wrapper

Current default:

- keep one claim table for now

### Q2. Who can resolve another claimant via invite

Still open:

- verified owner only
- or also designated admin/manager roles

Current conservative default:

- verified owner only

### Q3. Minimum threshold for challenge claims

Still open:

- what minimum evidence strength is required before a challenge can move a home into `disputed`

Current conservative default:

- strong ownership evidence required

### Q4. How unverified claimant metadata edits should behave

Still open:

- auto-apply
- stage for confirmation
- store as suggested updates only

Current conservative default:

- do not auto-apply without a later explicit design decision

### Q5. `stale_contested` persisted state vs operational flag

Still open:

- persisted DB state
- derived queue/ops flag only

Current conservative default:

- operational flag only

### Q6. Phase 2 scope for admin route compatibility writes

Still open:

- whether `backend/routes/admin.js` should be included in the same PR as `backend/routes/homeOwnership.js`

Current preference:

- include only if required to keep v2 compatibility fields coherent

## Decision Ownership

Unless explicitly changed:

- product/state-machine decisions should be confirmed by the user
- implementation-safety decisions should follow the conservative path described in the PR scope docs

## Change Control

Any PR that changes one of the frozen decisions above should:

1. update this decision log
2. update the relevant PR scope doc
3. explain why the previous decision is no longer valid

## Current Recommended Sequence

1. Phase 1 PR: additive schema + backfill
2. Phase 2 PR: backend compatibility writes
3. Phase 3 PR: admin comparison + reconciliation
4. Phase 4 PR: parallel claim enablement
5. Phase 5 PR: invite/merge
6. Phase 6 PR: challenge/dispute hardening

## Summary

The project is intentionally choosing:

- additive migration over replacement
- conservative rollout over fast rollout
- evidence integrity over friction shortcuts
- operational tooling before contested-claim enablement

That sequencing is the main safeguard against regressions in the rest of the app.
