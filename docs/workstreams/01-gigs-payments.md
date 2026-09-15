# Stream 1 — Gigs and payments

Updated September 15, 2026. Owner: primary coordinator (`/root`).
State: discovery complete; next baseline verification is queued.

## Scope and source

- Inventory: P01–P10. First milestone: P04, existing
  Start Work recovery and assignment lifetime. Cross-cutting release G/O/L rows
  remain coordinator work; feature-specific UI checks stay with their feature owner.
- Worktree: `/private/tmp/pantopus-paid-gig-integration`.
- Branch: `codex/paid-gig-integration`; setup base `3e93cd167`.
- Canonical PR #34 branch: `codex/staging-paid-gig`, code `c9cb69825`;
  CI run 34998717315 passes 15 applicable jobs/one skip. PR #34 remains draft.

## Existing implementation and reusable evidence

- Existing POST `/api/gigs/:gigId/start` in `backend/routes/gigs.js` verifies the
  assigned worker and paid authorization before updating existing Gig fields.
  `bindGigPaymentSnapshot` already binds owner, price, payment and worker.
- Web uses `frontend/apps/web/src/components/gig-detail/CompletionFlow.tsx` and
  `frontend/packages/api/src/endpoints/gigs.ts`; the latest repair already verifies
  matching receipts and current session/context. Reuse its 180 tests/seven Chrome
  cases within the [recorded limits](../VERIFICATION_FIRST_2026-09-13.md#existing-web-start-work-control).
- Existing native callers are iOS `Features/ContentDetail/GigDetailViewModel.swift`
  and Android `ui/screens/contentdetail/GigDetailViewModel.kt`, using their existing
  Gigs endpoints/repository. Their Start Work behavior still needs bounded proof.
- Reuse earlier completion upload, original-payment, owner-capture and notification
  evidence linked from the [project handoff](../PROJECT_HANDOFF.md).

## Owned candidate files and boundaries

Candidate scope: existing start handler and paid lifecycle route tests; existing
web Start Work/SDK only if a new failure requires it; existing native Gig detail
handlers/endpoints and relevant tests. No current application edit has been made
for this new milestone. Shared notification/socket/auth/storage changes require a
recorded assignment in the coordination guide.

## Findings, unknowns and next verification

Source observations, not newly reproduced failures: the start handler accepts only
`assigned`, the write does not bind `accepted_at`, and the iOS caller discards the
response body. Determine actual saved-result/retry and stale-assignment behavior
before repairing any of these. Existing provider authorization must be preserved.

Next: reproduce a committed start with lost reply, same-worker reassignment during
admission, concurrent requests and native stale/invalid responses using existing
fixtures/contracts. Choose the smallest proven repair; no replacement task flow.

Completion criterion: truthful start/recovery for the current assigned worker,
preserved payment authorization and one saved transition with appropriate existing
side effects; affected native/browser behavior verified within explicit provider
limits. Full payment/provider acceptance remains separate.

## Coordination and handoff

- Resources reserved: none for the new milestone; consult existing leases before use.
- Blocker: fee payer/recipient policy remains unspecified for later cancellation/
  no-show execution; it does not block this first milestone.
- Source/evidence change in this setup: coordination documentation only.
- Next action: acquire the needed fixture reservation and run the bounded baseline.
- Peer findings/requests: none yet. Do not reopen accepted Home/social work.
