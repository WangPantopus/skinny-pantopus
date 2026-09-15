# Stream 2 — Home and household

Updated September 15, 2026. Owner: Home stream (`/root/home_household`).
State: discovery complete; baseline verification is queued.

## Scope and source

- Inventory: H/R/I/D/F/M Home and household rows. Accepted work stays accepted;
  the [remaining-work inventory](../REMAINING_WORK_2026-09-11.md) remains authoritative.
- First milestone: M02, existing browser guest-pass lifecycle through the Home
  Share tab, issued link, public guest view and revocation. Include passcode,
  start/end windows, view limits and stale-result retirement within this slice.
- Worktree: `/private/tmp/pantopus-workstream-home`.
- Branch: `codex/workstream-home`; verified clean at master
  `e775af9ae393c1e961df8f0043e3aed734326196` during setup.
- Scoped web/API/sharing implementation and SQL contract paths are unchanged
  between master and paid integration `3e93cd167`; no paid branch dependency.

## Existing implementation and reusable evidence

- Web: `frontend/apps/web/src/components/home/share/ShareCenter.tsx`,
  `CreateGuestPass.tsx` in the same directory, and
  `frontend/apps/web/src/app/guest/[token]/page.tsx`.
- Callers: `frontend/packages/api/src/endpoints/homeIam.ts` and `homeGuest.ts`.
  POST/GET/DELETE guest-pass management lives in `backend/routes/homeIam.js`;
  public GET `/api/homes/guest/:token` lives in `backend/routes/homeGuest.js`.
- Service: `backend/services/homeExternalShareService.js`. Existing
  `HomeGuestPass`, `HomeGuestPassView` and `HomeShareReadReceipt` records use
  `mutate_home_external_share`, `read_home_external_share`,
  `inspect_home_external_share` and document-authorization functions.
- Reuse the [sharing report](../home-invitation-sharing-2026-09-09.md),
  [SQL contract](../../scripts/db/contracts/home-external-sharing.sql) and
  [applied migration](../../supabase/migrations/20260910040000_home_external_sharing.sql).
  Accepted evidence covers exact-resource scope, current issuer/recipient authority,
  issuance/revocation, passcode/quota enforcement, receipts and sharing lock races.
  Preserve its source/runtime limits; dashboard counts do not prove redeemability.
- Native create/list/revoke and TokenAccept implementations already exist. Older
  missing-screen claims are stale; native acceptance is outside this first slice.

## Owned candidate files and boundaries

Candidate ownership is the three web files above and guest-specific verification
in `frontend/apps/web/tests/guest-pass.spec.ts` or a bounded existing-fixture harness.
No application changes or tests have run for this new milestone. Backend sharing,
SDK/session helpers and SQL contracts are read-only dependencies unless reproduced
evidence and coordinator assignment expand ownership. No new screen/service/schema
is justified. Preserve layouts and use the existing implementations.

The alternate `/app/homes/[id]/share` entry remains a later compatibility check.
Document-provider and native guest journeys remain separate acceptance boundaries.
Shared authentication, storage, permissions or navigation edits require coordination.

## Findings, unknowns and next verification

Source observations, not reproduced bugs: public-reader and ShareCenter callbacks
adopt asynchronous results without a visible context-generation guard; ShareCenter
turns list failures into an empty list. Existing browser guest tests mock API
responses, so they do not establish actual HTTP/SQL quota or retirement behavior.

Next: reserve an owned fixture/runtime, then exercise the existing browser issue,
copy/open, read and revoke journey through actual HTTP/service/SQL. Add bounded
passcode, future/expired/exhausted, issuer-denial and held-response cases; check
account/Home/token/departure changes where relevant. Reuse accepted backend cases
unless changed source, a failure or a concrete integration risk requires repetition.

Completion criterion: truthful existing UI and usable exact link, matching saved
pass/view/audit records, denied unauthorized reads, retired stale results and safe
retry behavior. Record source/runtime bindings, synthetic boundaries, relevant
regressions and exact fixture cleanup. This completes only the bounded browser
slice; broader M02 and app release acceptance remain open.

## Coordination and handoff

- Resources reserved: none; no runtime, database, device or build mutation in setup.
- Blocker: none for discovery; baseline awaits coordinated runtime reservation.
- Source/evidence change in setup: this status document only; no application edits.
- Next action: obtain fixture ownership and run the bounded baseline before repairs.
- Peer findings/requests: no shared-file edit requested; paid and user PR46 preserved.
